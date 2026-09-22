import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { tasks, users, applications } from "@/lib/mock/data";
import type { Task } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const priority = url.searchParams.get("priority");
    const completed = url.searchParams.get("completed");

    let list = tasks.filter((t) => t.orgId === me.orgId).map((t) => {
        const assigned = users.find((u) => u.id === t.assignedToId);
        const creator = users.find((u) => u.id === t.createdById);
        return {
            ...t,
            assignedToName: assigned?.name ?? "Unassigned",
            createdByName: creator?.name ?? "Admin",
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
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const newTask: Task = {
            id: `tsk-${Date.now().toString().slice(-4)}`,
            orgId: me.orgId,
            assignedToId: body.assignedToId || me.id,
            createdById: me.id,
            title: body.title,
            description: body.description || null,
            dueDate: body.dueDate || null,
            priority: body.priority || "MEDIUM",
            linkedApplicationId: body.linkedApplicationId || null,
            completed: false,
            createdAt: new Date().toISOString(),
        };

        tasks.unshift(newTask);
        return NextResponse.json(newTask, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create task" }, { status: 400 });
    }
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, completed, priority, assignedToId } = await request.json();
    const item = tasks.find((t) => t.id === id && t.orgId === me.orgId);
    if (!item) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (completed !== undefined) {
        item.completed = completed;
        item.completedAt = completed ? new Date().toISOString() : null;
    }
    if (priority) item.priority = priority;
    if (assignedToId) item.assignedToId = assignedToId;

    return NextResponse.json(item);
}
