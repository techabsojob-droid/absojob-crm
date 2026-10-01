import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { tasks, users, employees, addAudit, addNotification, nextIds } from "@/lib/mock/data";
import type { Task } from "@/lib/types";
import { taskLinkFor } from "@/lib/tasks";

// GET /api/hr/tasks
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER", "EMPLOYEE", "AGENT");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const search = url.searchParams.get("q")?.toLowerCase();
    const assignedTo = url.searchParams.get("assignedTo");

    let list = tasks.filter((t) => t.orgId === me.orgId).map((t) => {
        const assigned = users.find((u) => u.id === t.assignedToId);
        const creator = users.find((u) => u.id === t.createdById);
        const emp = employees.find((e) => e.userId === t.assignedToId);
        return {
            ...t,
            assignedToName: assigned?.name || emp?.name || "Unassigned",
            createdByName: creator?.name || "HR Admin",
        };
    });

    if (assignedTo === "ME") {
        list = list.filter((t) => t.assignedToId === me.id);
    }
    if (status === "COMPLETED") list = list.filter((t) => t.completed);
    if (status === "ACTIVE") list = list.filter((t) => !t.completed);
    if (priority && priority !== "ALL") list = list.filter((t) => t.priority === priority);
    if (search) {
        list = list.filter((t) => t.title.toLowerCase().includes(search) || (t.description || "").toLowerCase().includes(search));
    }

    return NextResponse.json(list);
}

// POST /api/hr/tasks
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const { title, description, assignedToId, priority = "MEDIUM", dueDate } = body;

        if (!title?.trim()) {
            return NextResponse.json({ error: "Task title is required" }, { status: 400 });
        }
        if (assignedToId && !users.some((u) => u.id === assignedToId && u.orgId === me.orgId && u.status === "ACTIVE")) {
            return NextResponse.json({ error: "Assignee not found in your organization" }, { status: 400 });
        }

        const newTask: Task = {
            id: `tsk-${crypto.randomUUID().slice(0, 8)}`,
            orgId: me.orgId,
            title: title.trim(),
            description: description?.trim() || null,
            assignedToId: assignedToId || me.id,
            createdById: me.id,
            priority,
            dueDate: dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
        };

        tasks.unshift(newTask);

        addAudit({
            orgId: me.orgId,
            actorUserId: me.id,
            actorRole: me.role,
            action: "TASK_CREATED",
            entity: "Task",
            entityId: newTask.id,
            detail: `Created task "${newTask.title}" for ${assignedToId || "self"}`,
        });

        if (assignedToId && assignedToId !== me.id) {
            const assignee = users.find((u) => u.id === assignedToId);
            addNotification({
                orgId: me.orgId,
                userId: assignedToId,
                title: "New Task Assigned",
                message: `${me.name} assigned you a new task: ${newTask.title}`,
                link: assignee ? taskLinkFor(assignee.role) : "/portal/tasks",
            });
        }

        return NextResponse.json(newTask, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }
}

// PATCH /api/hr/tasks
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER", "EMPLOYEE", "AGENT");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const { id, completed, priority, assignedToId, title, description } = await request.json();
        const task = tasks.find((t) => t.id === id && t.orgId === me.orgId);
        if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

        const isManager = ["SUPER_ADMIN", "HR_ADMIN"].includes(me.role) || (me.role === "TA_MANAGER" && task.createdById === me.id);
        const isOwner = task.assignedToId === me.id || task.createdById === me.id;
        if (!isManager && !isOwner) {
            return NextResponse.json({ error: "You can only update your own tasks" }, { status: 403 });
        }
        // Assignees may only complete / reopen; editing and reassignment is for the creator or HR/Admin
        if (!isManager && task.createdById !== me.id && (priority || assignedToId || title || description !== undefined)) {
            return NextResponse.json({ error: "You can only mark this task complete" }, { status: 403 });
        }

        if (completed !== undefined && completed !== task.completed) {
            task.completed = !!completed;
            task.completedAt = completed ? new Date().toISOString() : null;
            if (completed && task.createdById !== me.id) {
                addNotification({
                    orgId: me.orgId, userId: task.createdById,
                    title: "Task completed",
                    message: `${me.name} completed "${task.title}"`,
                    link: null,
                });
            }
        }
        if (priority) task.priority = priority;
        if (assignedToId && assignedToId !== task.assignedToId) {
            const assignee = users.find((u) => u.id === assignedToId && u.orgId === me.orgId && u.status === "ACTIVE");
            if (!assignee) return NextResponse.json({ error: "Assignee not found" }, { status: 400 });
            task.assignedToId = assignee.id;
            if (assignee.id !== me.id) {
                addNotification({
                    orgId: me.orgId, userId: assignee.id,
                    title: "Task assigned to you",
                    message: `${me.name}: ${task.title}`,
                    link: ["AGENT", "EMPLOYEE"].includes(assignee.role) ? "/portal/tasks" : "/hr/tasks",
                });
            }
        }
        if (title) task.title = title;
        if (description !== undefined) task.description = description;

        addAudit({
            orgId: me.orgId,
            actorUserId: me.id,
            actorRole: me.role,
            action: "TASK_UPDATED",
            entity: "Task",
            entityId: task.id,
            detail: `Updated task ${task.id} (completed: ${task.completed})`,
        });

        return NextResponse.json(task);
    } catch {
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
}
