import type { User } from "@/lib/types";

/** Who an actor may assign tasks to. Recruiters assign to themselves only. */
export function canAssignTo(me: User, target: User): boolean {
    if (target.orgId !== me.orgId || target.status !== "ACTIVE") return false;
    if (me.role === "SUPER_ADMIN" || me.role === "HR_ADMIN") return true;
    if (me.role === "TA_MANAGER") return ["TA_MANAGER", "TA_RECRUITER", "AGENT"].includes(target.role) || target.id === me.id;
    return target.id === me.id;
}

/** The task list each role can open (used as the notification link). */
export function taskLinkFor(role: User["role"]): string {
    if (role === "SUPER_ADMIN") return "/admin/tasks";
    if (role === "HR_ADMIN") return "/hr/tasks";
    if (role === "TA_MANAGER" || role === "TA_RECRUITER") return "/ta/tasks";
    return "/portal/tasks";
}
