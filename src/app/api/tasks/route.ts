import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { addAudit, taskActivity, tasks, users } from "@/lib/mock/data";
import {
    TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES, canAssignTo, canEditTask, canViewTask, cleanLabels, ensureTaskKeys,
    newActivity, nextTaskKey, notifyTask, statusOf, taskView,
} from "@/lib/tasks";
import type { Task, TaskRelatedType, TaskStatus, TaskType } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RELATED: TaskRelatedType[] = ["CANDIDATE", "JOB", "CLIENT", "EMPLOYEE"];

// GET /api/tasks?view=all|mine|reported|watching&status=&priority=&assignee=&label=&q=
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    ensureTaskKeys(tasks, me.orgId);

    const p = new URL(request.url).searchParams;
    const view = p.get("view") ?? "all";
    const q = (p.get("q") ?? "").trim().toLowerCase();

    let list = tasks.filter((t) => canViewTask(me, t, users));
    if (view === "mine") list = list.filter((t) => t.assignedToId === me.id);
    if (view === "reported") list = list.filter((t) => t.createdById === me.id);
    if (view === "watching") list = list.filter((t) => (t.watcherIds ?? []).includes(me.id));
    for (const [param, pick] of [["status", (t: Task) => statusOf(t)], ["priority", (t: Task) => t.priority], ["assignee", (t: Task) => t.assignedToId], ["type", (t: Task) => t.type ?? "TASK"]] as const) {
        const v = p.get(param);
        if (v && v !== "ALL") list = list.filter((t) => pick(t) === v);
    }
    const label = p.get("label");
    if (label && label !== "ALL") list = list.filter((t) => (t.labels ?? []).includes(label));
    if (q) list = list.filter((t) => [t.key, t.title, t.description, ...(t.labels ?? [])].some((s) => s?.toLowerCase().includes(q)));

    return NextResponse.json(list.map((t) => ({ ...taskView(t, me), canEdit: canEditTask(me, t, users) })));
}

// POST /api/tasks — create a ticket
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON, validated field by field below
    let b: Record<string, any>;
    try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

    const title = String(b.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Summary is required" }, { status: 400 });
    const assignee = users.find((u) => u.id === (b.assignedToId || me.id));
    if (!assignee || !canAssignTo(me, assignee)) return NextResponse.json({ error: "You can't assign tasks to this person" }, { status: 403 });
    for (const f of ["dueDate", "startDate"]) {
        if (b[f] && !DATE_RE.test(b[f])) return NextResponse.json({ error: `Invalid ${f}` }, { status: 400 });
    }
    if (b.startDate && b.dueDate && b.startDate > b.dueDate) return NextResponse.json({ error: "Start date is after the due date" }, { status: 400 });
    const watcherIds = (Array.isArray(b.watcherIds) ? b.watcherIds : [])
        .filter((id: string) => users.some((u) => u.id === id && u.orgId === me.orgId && u.status === "ACTIVE"));
    const relatedType = RELATED.includes(b.relatedType) && b.relatedId ? (b.relatedType as TaskRelatedType) : null;
    const estimate = Number(b.estimateHours);

    const now = new Date().toISOString();
    const task: Task = {
        id: `tsk-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        key: nextTaskKey(tasks, me.orgId),
        type: TASK_TYPES.includes(b.type) ? (b.type as TaskType) : "TASK",
        status: TASK_STATUSES.includes(b.status) ? (b.status as TaskStatus) : "TODO",
        assignedToId: assignee.id,
        createdById: me.id,
        title: title.slice(0, 200),
        description: String(b.description ?? "").trim().slice(0, 5000) || null,
        labels: cleanLabels(b.labels),
        watcherIds: [...new Set<string>(watcherIds)],
        startDate: b.startDate || null,
        dueDate: b.dueDate || null,
        estimateHours: Number.isFinite(estimate) && estimate > 0 ? Math.min(estimate, 999) : null,
        priority: TASK_PRIORITIES.includes(b.priority) ? b.priority : "MEDIUM",
        relatedType,
        relatedId: relatedType ? String(b.relatedId) : null,
        linkedApplicationId: null,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
    };
    if (task.status === "DONE") { task.completed = true; task.completedAt = now; }
    tasks.unshift(task);
    taskActivity.push(newActivity(task, me.id, "CREATED"));

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "TASK_CREATED", entity: "Task", entityId: task.id,
        detail: `${task.key} "${task.title}" assigned to ${assignee.name}${task.dueDate ? `, due ${task.dueDate}` : ""}`,
    });
    if (assignee.id !== me.id) notifyTask(task, [assignee.id], "New task assigned", `${me.name} assigned you ${task.key}: ${task.title}`);
    notifyTask(task, task.watcherIds!.filter((id) => id !== me.id && id !== assignee.id), "Added as watcher", `${me.name} added you to ${task.key}: ${task.title}`);

    return NextResponse.json({ ...taskView(task, me), canEdit: true }, { status: 201 });
}
