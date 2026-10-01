import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { addAudit, taskActivity, taskComments, tasks, users } from "@/lib/mock/data";
import {
    STATUS_LABEL, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES, applyStatus, canAssignTo, canEditTask, canViewTask,
    cleanLabels, newActivity, notifyTask, statusOf, taskFollowers, taskView,
} from "@/lib/tasks";
import type { Task, TaskRelatedType, TaskStatus, User } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RELATED: TaskRelatedType[] = ["CANDIDATE", "JOB", "CLIENT", "EMPLOYEE"];
const nameOf = (id: string | null | undefined) => users.find((u) => u.id === id)?.name ?? null;

function findTask(idOrKey: string, me: User): Task | undefined {
    const k = decodeURIComponent(idOrKey);
    return tasks.find((t) => t.orgId === me.orgId && (t.id === k || t.key === k));
}

// GET /api/tasks/:idOrKey — task with comments and history
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const t = findTask((await params).id, me);
    if (!t || !canViewTask(me, t, users)) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const comments = taskComments
        .filter((c) => c.taskId === t.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c) => ({ ...c, author: { id: c.authorId, name: nameOf(c.authorId) ?? "Former user" }, canEdit: c.authorId === me.id }));
    const history = taskActivity
        .filter((a) => a.taskId === t.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((a) => ({ ...a, actorName: nameOf(a.actorId) ?? "Someone" }));

    return NextResponse.json({ ...taskView(t, me), comments, history, canEdit: canEditTask(me, t, users) });
}

// PATCH /api/tasks/:idOrKey — change fields, or { watch: true|false }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const t = findTask((await params).id, me);
    if (!t || !canViewTask(me, t, users)) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON, validated field by field below
    let b: Record<string, any>;
    try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

    // Anyone who can see a task may watch / unwatch it
    if (typeof b.watch === "boolean") {
        const set = new Set(t.watcherIds ?? []);
        if (b.watch) set.add(me.id); else set.delete(me.id);
        t.watcherIds = [...set];
        return NextResponse.json(taskView(t, me));
    }

    if (!canEditTask(me, t, users)) return NextResponse.json({ error: "Only the assignee, reporter or a manager can edit this task" }, { status: 403 });

    const changes: { field: string; from: string | null; to: string | null }[] = [];
    const track = (field: string, from: unknown, to: unknown) => {
        const f = from == null || from === "" ? null : String(from);
        const n = to == null || to === "" ? null : String(to);
        if (f !== n) changes.push({ field, from: f, to: n });
    };
    const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

    // Validate everything first so a bad field doesn't leave a half-applied edit
    if (b.title !== undefined && !String(b.title).trim()) return bad("Summary can't be empty");
    if (b.status !== undefined && !TASK_STATUSES.includes(b.status)) return bad("Invalid status");
    if (b.type !== undefined && !TASK_TYPES.includes(b.type)) return bad("Invalid type");
    if (b.priority !== undefined && !TASK_PRIORITIES.includes(b.priority)) return bad("Invalid priority");
    for (const f of ["dueDate", "startDate"]) if (b[f] && !DATE_RE.test(b[f])) return bad(`Invalid ${f}`);
    let newAssignee: User | undefined;
    if (b.assignedToId !== undefined && b.assignedToId !== t.assignedToId) {
        newAssignee = users.find((u) => u.id === b.assignedToId);
        if (!newAssignee || !canAssignTo(me, newAssignee)) return NextResponse.json({ error: "You can't assign this task to that person" }, { status: 403 });
    }
    if (b.relatedType !== undefined && b.relatedType !== null && !RELATED.includes(b.relatedType)) return bad("Invalid link type");

    const prevStatus = statusOf(t);
    if (b.title !== undefined) { const v = String(b.title).trim().slice(0, 200); track("summary", t.title, v); t.title = v; }
    if (b.description !== undefined) { const v = String(b.description ?? "").trim().slice(0, 5000) || null; if ((t.description ?? null) !== v) changes.push({ field: "description", from: null, to: null }); t.description = v; }
    if (b.type !== undefined) { track("type", t.type ?? "TASK", b.type); t.type = b.type; }
    if (b.priority !== undefined) { track("priority", t.priority, b.priority); t.priority = b.priority; }
    if (b.dueDate !== undefined) { track("due date", t.dueDate, b.dueDate || null); t.dueDate = b.dueDate || null; }
    if (b.startDate !== undefined) { track("start date", t.startDate, b.startDate || null); t.startDate = b.startDate || null; }
    if (b.estimateHours !== undefined) {
        const n = Number(b.estimateHours);
        const v = b.estimateHours === null || b.estimateHours === "" || !(n > 0) ? null : Math.min(n, 999);
        track("estimate", t.estimateHours != null ? `${t.estimateHours}h` : null, v != null ? `${v}h` : null);
        t.estimateHours = v;
    }
    if (b.labels !== undefined) { const v = cleanLabels(b.labels); track("labels", (t.labels ?? []).join(", "), v.join(", ")); t.labels = v; }
    if (b.relatedType !== undefined || b.relatedId !== undefined) {
        const type = b.relatedType ?? null, id = type ? String(b.relatedId ?? "") || null : null;
        track("link", t.relatedId, id);
        t.relatedType = id ? type : null;
        t.relatedId = id;
    }
    if (newAssignee) { track("assignee", nameOf(t.assignedToId), newAssignee.name); t.assignedToId = newAssignee.id; }
    if (b.status !== undefined && b.status !== prevStatus) { track("status", prevStatus, b.status); applyStatus(t, b.status as TaskStatus); }

    if (!changes.length) return NextResponse.json(taskView(t, me));
    t.updatedAt = new Date().toISOString();
    for (const c of changes) taskActivity.push(newActivity(t, me.id, "UPDATED", c.field, c.from, c.to));
    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "TASK_UPDATED", entity: "Task", entityId: t.id,
        detail: `${t.key}: ${changes.map((c) => c.field === "description" ? "description edited" : `${c.field} → ${c.to ?? "none"}`).join(", ")}`,
    });

    if (newAssignee && newAssignee.id !== me.id) {
        notifyTask(t, [newAssignee.id], "Task assigned to you", `${me.name} assigned you ${t.key}: ${t.title}`);
    }
    if (b.status !== undefined && b.status !== prevStatus) {
        notifyTask(t, taskFollowers(t, me.id).filter((id) => id !== newAssignee?.id),
            b.status === "DONE" ? "Task completed" : "Task status changed",
            `${me.name} moved ${t.key} "${t.title}" to ${STATUS_LABEL[b.status as TaskStatus]}`);
    }

    return NextResponse.json(taskView(t, me));
}
