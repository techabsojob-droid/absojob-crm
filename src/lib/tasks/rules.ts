import type { Task, TaskActivity, TaskStatus, TaskType, User, UserRole } from "@/lib/types";

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"];
export const TASK_TYPES: TaskType[] = ["TASK", "FOLLOW_UP", "CALL", "MEETING", "DOCUMENTS", "INTERVIEW"];
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const STATUS_LABEL: Record<TaskStatus, string> = {
    TODO: "To Do", IN_PROGRESS: "In Progress", IN_REVIEW: "In Review", BLOCKED: "Blocked", DONE: "Done",
};

const MANAGERS: UserRole[] = ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"];
const TA_SIDE: UserRole[] = ["TA_MANAGER", "TA_RECRUITER", "AGENT"];

/** Older rows have no status: derive it from the completed flag. */
export function statusOf(t: Task): TaskStatus {
    return t.status ?? (t.completed ? "DONE" : "TODO");
}

/** Set status and keep the legacy completed / completedAt fields in step. */
export function applyStatus(t: Task, status: TaskStatus) {
    t.status = status;
    const done = status === "DONE";
    if (done && !t.completed) t.completedAt = new Date().toISOString();
    if (!done) t.completedAt = null;
    t.completed = done;
    t.updatedAt = new Date().toISOString();
}

/** Who an actor may assign tasks to. Recruiters assign to themselves only. */
export function canAssignTo(me: User, target: User): boolean {
    if (target.orgId !== me.orgId || target.status !== "ACTIVE") return false;
    if (me.role === "SUPER_ADMIN" || me.role === "HR_ADMIN") return true;
    if (me.role === "TA_MANAGER") return TA_SIDE.includes(target.role) || target.id === me.id;
    return target.id === me.id;
}

/** Super Admin / HR see every task; TA managers see their team's; everyone else sees tasks they're on. */
export function canViewTask(me: User, t: Task, users: User[]): boolean {
    if (t.orgId !== me.orgId) return false;
    if (t.assignedToId === me.id || t.createdById === me.id || (t.watcherIds ?? []).includes(me.id)) return true;
    if (me.role === "SUPER_ADMIN" || me.role === "HR_ADMIN") return true;
    if (me.role === "TA_MANAGER") {
        const role = (id: string) => users.find((u) => u.id === id)?.role;
        return TA_SIDE.includes(role(t.assignedToId)!) || TA_SIDE.includes(role(t.createdById)!);
    }
    return false;
}

/** Assignee, reporter and managers who can see it may change fields; anyone who can see it may comment. */
export function canEditTask(me: User, t: Task, users: User[]): boolean {
    if (!canViewTask(me, t, users)) return false;
    return t.assignedToId === me.id || t.createdById === me.id || MANAGERS.includes(me.role);
}

/** Next ticket key for an org, e.g. ABS-9. */
export function nextTaskKey(tasks: Task[], orgId: string, prefix = "ABS"): string {
    const max = tasks
        .filter((t) => t.orgId === orgId && t.key?.startsWith(`${prefix}-`))
        .reduce((m, t) => Math.max(m, Number(t.key!.slice(prefix.length + 1)) || 0), 0);
    return `${prefix}-${max + 1}`;
}

/** Older tasks (created by legacy screens) get a key the first time they're listed. */
export function ensureTaskKeys(tasks: Task[], orgId: string) {
    for (const t of tasks) if (t.orgId === orgId && !t.key) t.key = nextTaskKey(tasks, orgId);
}

/** The task list each role can open (used as the notification link). */
export function taskLinkFor(role: UserRole, key?: string): string {
    const base = role === "SUPER_ADMIN" ? "/admin/tasks" : role === "HR_ADMIN" ? "/hr/tasks"
        : role === "TA_MANAGER" || role === "TA_RECRUITER" ? "/ta/tasks" : "/portal/tasks";
    return key ? `${base}?task=${encodeURIComponent(key)}` : base;
}

export function newActivity(t: Task, actorId: string, action: TaskActivity["action"], field?: string, fromValue?: string | null, toValue?: string | null): TaskActivity {
    return {
        id: `tac-${crypto.randomUUID().slice(0, 8)}`,
        orgId: t.orgId, taskId: t.id, actorId, action,
        field: field ?? null, fromValue: fromValue ?? null, toValue: toValue ?? null,
        createdAt: new Date().toISOString(),
    };
}

/** Everyone who follows a task: assignee, reporter, watchers (minus the actor). */
export function taskFollowers(t: Task, exceptId: string): string[] {
    return [...new Set([t.assignedToId, t.createdById, ...(t.watcherIds ?? [])])].filter((id) => id && id !== exceptId);
}

/** Pull @Full Name mentions out of a comment, matched against the given people. */
export function findMentions(body: string, people: { id: string; name: string }[]): string[] {
    const lower = body.toLowerCase();
    return people.filter((p) => lower.includes(`@${p.name.toLowerCase()}`)).map((p) => p.id);
}

export function cleanLabels(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const out = input
        .map((l) => String(l).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_.]/g, "").slice(0, 30))
        .filter(Boolean);
    return [...new Set(out)].slice(0, 10);
}
