// Server-side task helpers. Client components import from "@/lib/tasks/rules" instead.
import { addNotification, candidates, clients, employees, jobs, taskComments, users } from "@/lib/mock/data";
import type { Task, User } from "@/lib/types";
import { statusOf, taskLinkFor } from "./rules";

export * from "./rules";

const person = (id: string | null | undefined) => {
    const u = id ? users.find((x) => x.id === id) : undefined;
    return u ? { id: u.id, name: u.name, role: u.role } : null;
};

function relatedOf(t: Task): { type: string; id: string; label: string; href: string | null } | null {
    if (!t.relatedType || !t.relatedId) return null;
    const id = t.relatedId;
    switch (t.relatedType) {
        case "CANDIDATE": { const c = candidates.find((x) => x.id === id); return { type: "Candidate", id, label: c?.name ?? id, href: `/ta/candidates/${id}` }; }
        case "JOB": { const j = jobs.find((x) => x.id === id); return { type: "Job", id, label: j?.title ?? id, href: `/ta/requisitions/${id}` }; }
        case "CLIENT": { const c = clients.find((x) => x.id === id); return { type: "Client", id, label: c?.companyName ?? id, href: `/admin/clients/${id}` }; }
        case "EMPLOYEE": { const e = employees.find((x) => x.id === id); return { type: "Employee", id, label: e?.name ?? id, href: null }; }
        default: return null;
    }
}

/** Task with names resolved, as the task screens show it. */
export function taskView(t: Task, me: User) {
    const status = statusOf(t);
    const today = new Date().toISOString().split("T")[0];
    return {
        ...t,
        status,
        type: t.type ?? "TASK",
        labels: t.labels ?? [],
        watcherIds: t.watcherIds ?? [],
        assignee: person(t.assignedToId),
        reporter: person(t.createdById),
        watchers: (t.watcherIds ?? []).map(person).filter(Boolean),
        related: relatedOf(t),
        commentCount: taskComments.filter((c) => c.taskId === t.id).length,
        isOverdue: status !== "DONE" && !!t.dueDate && t.dueDate.slice(0, 10) < today,
        isWatching: (t.watcherIds ?? []).includes(me.id),
        updatedAt: t.updatedAt ?? t.createdAt,
    };
}

export function notifyTask(t: Task, userIds: string[], title: string, message: string) {
    for (const userId of new Set(userIds)) {
        const u = users.find((x) => x.id === userId);
        if (!u || u.status !== "ACTIVE") continue;
        addNotification({ orgId: t.orgId, userId, title, message, link: taskLinkFor(u.role, t.key) });
    }
}
