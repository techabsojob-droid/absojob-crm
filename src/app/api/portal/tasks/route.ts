import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { tasks, users } from "@/lib/mock/data";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER", "AGENT", "EMPLOYEE");
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
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER", "AGENT", "EMPLOYEE");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, completed } = await request.json();
    const task = tasks.find((t) => t.id === id && t.assignedToId === me.id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // Default action = mark complete (pages send only { id })
    task.completed = completed === undefined ? true : Boolean(completed);
    task.completedAt = task.completed ? new Date().toISOString() : null;
    return NextResponse.json({ success: true, id: task.id });
}
