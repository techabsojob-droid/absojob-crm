import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { tasks, taskActivity, users, applications, addAudit, addNotification } from "@/lib/mock/data";
import type { Task } from "@/lib/types";
import { applyStatus, canAssignTo, newActivity, nextTaskKey, statusOf, taskLinkFor } from "@/lib/tasks";

const TASK_MANAGERS = ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"];

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const priority = url.searchParams.get("priority");
    const completed = url.searchParams.get("completed");
    const mine = url.searchParams.get("mine") === "1";
    const isManager = TASK_MANAGERS.includes(me.role);

    let list = tasks
        .filter((t) => t.orgId === me.orgId)
        .filter((t) => (isManager && !mine) || t.assignedToId === me.id || t.createdById === me.id)
        .map((t) => {
            const assigned = users.find((u) => u.id === t.assignedToId);
            const creator = users.find((u) => u.id === t.createdById);
            return {
                ...t,
                assignedToName: assigned?.name ?? "Unassigned",
                createdByName: creator?.name ?? "Admin",
                isOverdue: !t.completed && !!t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString()),
            };
        });

    if (q) {
        list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    }
    if (priority && priority !== "ALL") list = list.filter((t) => t.priority === priority);
    if (completed === "true") list = list.filter((t) => t.completed);
    if (completed === "false") list = list.filter((t) => !t.completed);

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    let body: Record<string, any>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Task title is required" }, { status: 400 });

    const assignee = users.find((u) => u.id === (body.assignedToId || me.id));
    if (!assignee || !canAssignTo(me, assignee)) {
        return NextResponse.json(
            { error: me.role === "TA_RECRUITER" ? "Recruiters can only create tasks for themselves" : "You cannot assign tasks to this user" },
            { status: 403 }
        );
    }
    if (body.linkedApplicationId && !applications.some((a) => a.id === body.linkedApplicationId && a.orgId === me.orgId)) {
        return NextResponse.json({ error: "Linked application not found" }, { status: 400 });
    }
    if (body.dueDate && Number.isNaN(new Date(body.dueDate).getTime())) {
        return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const newTask: Task = {
        id: `tsk-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        key: nextTaskKey(tasks, me.orgId),
        type: "TASK",
        status: "TODO",
        labels: [],
        watcherIds: [],
        assignedToId: assignee.id,
        createdById: me.id,
        title,
        description: body.description || null,
        dueDate: body.dueDate || null,
        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(body.priority) ? body.priority : "MEDIUM",
        linkedApplicationId: body.linkedApplicationId || null,
        completed: false,
        createdAt: new Date().toISOString(),
    };
    tasks.unshift(newTask);
    taskActivity.push(newActivity(newTask, me.id, "CREATED"));

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "TASK_CREATED", entity: "Task", entityId: newTask.id,
        detail: `"${newTask.title}" assigned to ${assignee.name}${newTask.dueDate ? `, due ${newTask.dueDate}` : ""}`,
    });
    if (assignee.id !== me.id) {
        addNotification({
            orgId: me.orgId, userId: assignee.id,
            title: "New task assigned",
            message: `${me.name}: ${newTask.title}${newTask.dueDate ? ` (due ${newTask.dueDate})` : ""}`,
            link: taskLinkFor(assignee.role),
        });
    }

    return NextResponse.json(newTask, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, completed, priority, assignedToId, dueDate } = await request.json();
    const item = tasks.find((t) => t.id === id && t.orgId === me.orgId);
    if (!item) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const isManager = TASK_MANAGERS.includes(me.role);
    if (!isManager && item.assignedToId !== me.id && item.createdById !== me.id) {
        return NextResponse.json({ error: "You can only update your own tasks" }, { status: 403 });
    }

    const changes: string[] = [];
    if (completed !== undefined && completed !== item.completed) {
        taskActivity.push(newActivity(item, me.id, "UPDATED", "status", statusOf(item), completed ? "DONE" : "TODO"));
        applyStatus(item, completed ? "DONE" : "TODO");
        changes.push(completed ? "completed" : "reopened");
        if (completed && item.createdById !== me.id) {
            addNotification({
                orgId: me.orgId, userId: item.createdById,
                title: "Task completed",
                message: `${me.name} completed "${item.title}"`,
                link: null,
            });
        }
    }
    if (priority && priority !== item.priority) {
        if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
        item.priority = priority;
        changes.push(`priority → ${priority}`);
    }
    if (dueDate !== undefined) {
        if (dueDate && Number.isNaN(new Date(dueDate).getTime())) return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
        item.dueDate = dueDate || null;
        changes.push(`due → ${dueDate || "none"}`);
    }
    if (assignedToId && assignedToId !== item.assignedToId) {
        const assignee = users.find((u) => u.id === assignedToId);
        if (!assignee || !canAssignTo(me, assignee)) {
            return NextResponse.json({ error: "You cannot reassign this task to that user" }, { status: 403 });
        }
        item.assignedToId = assignee.id;
        changes.push(`reassigned → ${assignee.name}`);
        if (assignee.id !== me.id) {
            addNotification({
                orgId: me.orgId, userId: assignee.id,
                title: "Task assigned to you",
                message: `${me.name}: ${item.title}`,
                link: taskLinkFor(assignee.role),
            });
        }
    }

    if (changes.length) {
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "TASK_UPDATED", entity: "Task", entityId: item.id,
            detail: `"${item.title}": ${changes.join(", ")}`,
        });
    }

    return NextResponse.json(item);
}
