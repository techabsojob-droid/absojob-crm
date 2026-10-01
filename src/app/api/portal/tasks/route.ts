import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { tasks, taskActivity, users, addNotification, nextIds } from "@/lib/mock/data";
import { applyStatus, newActivity, nextTaskKey, statusOf } from "@/lib/tasks";

export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const mine = tasks
        .filter((t) => t.orgId === me.orgId && t.assignedToId === me.id)
        .sort((a, b) =>
            Number(a.completed) - Number(b.completed) ||
            (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
        .map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description ?? null,
            priority: t.priority,
            dueDate: t.dueDate ?? null,
            status: (t.completed ? "COMPLETED" : "PENDING") as "COMPLETED" | "PENDING",
            completedAt: t.completed ? (t.completedAt ?? t.createdAt) : null,
            createdByName: users.find((u) => u.id === t.createdById)?.name ?? "—",
        }));

    return NextResponse.json(mine);
}

export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, completed } = await request.json();
    const task = tasks.find((t) => t.id === id && t.assignedToId === me.id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // Default action = mark complete (pages send only { id })
    const wasDone = task.completed;
    const next = completed === undefined || Boolean(completed) ? "DONE" : "TODO";
    if (statusOf(task) !== next) taskActivity.push(newActivity(task, me.id, "UPDATED", "status", statusOf(task), next));
    applyStatus(task, next);
    if (task.completed && !wasDone && task.createdById !== me.id) {
        addNotification({
            orgId: me.orgId, userId: task.createdById,
            title: "Task completed",
            message: `${me.name} completed "${task.title}"`,
            link: null,
        });
    }
    return NextResponse.json({ success: true, id: task.id });
}

// POST { title, description?, dueDate?, priority? } — personal to-do
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await request.json().catch(() => ({}));
    const title = String(b.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (b.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    const t = { id: nextIds.task(), orgId: me.orgId, key: nextTaskKey(tasks, me.orgId), type: "TASK" as const, status: "TODO" as const, labels: [], watcherIds: [], assignedToId: me.id, createdById: me.id, title: title.slice(0, 200), description: String(b.description ?? "").trim().slice(0, 1000) || null, dueDate: b.dueDate || null, priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(b.priority) ? b.priority : "MEDIUM", linkedApplicationId: null, completed: false, completedAt: null, createdAt: new Date().toISOString() };
    tasks.push(t);
    return NextResponse.json(t, { status: 201 });
}
