// ─── Shared HR workflow rules ─────────────────────────────────
// Leave decisions go through one function whether they come from the
// HRMIS screen or a manager's self-service workspace.

import type { LeaveRequest, User } from "@/lib/types";
import { addAudit, addNotification, leaveRequests, users } from "./data";
import { approversFor, employeeForUser } from "./identity";
import { leaveDaysOf, syncLeaveBalanceRecord } from "./ess";

/** Working days charged for a leave (week-offs / holidays excluded, half-day = 0.5). */
export function leaveDays(l: Pick<LeaveRequest, "fromDate" | "toDate"> & Partial<LeaveRequest>): number {
    if (l.orgId && l.userId) return leaveDaysOf(l as LeaveRequest);
    return Math.max(1, Math.round((+new Date(l.toDate) - +new Date(l.fromDate)) / 86400000) + 1);
}

/** HR / Super Admin can decide any leave; a reporting manager can decide their direct reports'. */
export function canDecideLeave(me: User, leave: LeaveRequest): boolean {
    if (leave.orgId !== me.orgId || leave.userId === me.id) return false;
    if (me.role === "SUPER_ADMIN" || me.role === "HR_ADMIN") return true;
    return approversFor(leave.userId).managerUserId === me.id;
}

/** Pending leaves the user is allowed to decide. */
export function leavesAwaiting(me: User): LeaveRequest[] {
    return leaveRequests.filter((l) => l.status === "PENDING" && canDecideLeave(me, l));
}

export function decideLeave(me: User, leave: LeaveRequest, status: "APPROVED" | "REJECTED", note?: string | null): { error?: string; status?: number } {
    if (!canDecideLeave(me, leave)) return { error: "You are not allowed to decide this leave request", status: 403 };
    if (leave.status !== "PENDING") return { error: `Already ${leave.status.toLowerCase()}`, status: 409 };
    if (status === "REJECTED" && !String(note ?? "").trim()) return { error: "A reason is required to reject leave", status: 400 };

    leave.status = status;
    leave.approverId = me.id;
    leave.decisionNote = note ?? null;
    syncLeaveBalanceRecord(leave.userId);

    // Reflect an approved leave that covers today on the HR record
    const today = new Date().toISOString().split("T")[0];
    if (status === "APPROVED" && leave.fromDate <= today && leave.toDate >= today) {
        const emp = employeeForUser(leave.userId);
        if (emp && emp.status === "ACTIVE") emp.status = "ON_LEAVE";
    }

    const requester = users.find((u) => u.id === leave.userId);
    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: `LEAVE_${status}`, entity: "LeaveRequest", entityId: leave.id,
        detail: `${requester?.name ?? leave.userId}: ${leave.leaveType} ${leave.fromDate} → ${leave.toDate} ${status.toLowerCase()}${note ? ` — ${note}` : ""}`,
    });
    addNotification({
        orgId: me.orgId, userId: leave.userId,
        title: `Leave ${status.toLowerCase()}`,
        message: `Your ${leave.leaveType.toLowerCase()} leave (${leave.fromDate} → ${leave.toDate}) was ${status.toLowerCase()} by ${me.name}${note ? ` — ${note}` : ""}`,
        link: "/portal/leave",
    });
    return {};
}

// ─── Announcement targeting ───────────────────────────────────
// ALL → everyone · TA → recruitment team · AGENTS → field agents ·
// EMPLOYEES → every internal staff member (HR, TA, employees, admins)
export function isAnnouncementFor(user: User, audience: string[]): boolean {
    if (user.role === "SUPER_ADMIN" || audience.includes("ALL")) return true;
    if (audience.includes("TA") && (user.role === "TA_MANAGER" || user.role === "TA_RECRUITER")) return true;
    if (audience.includes("AGENTS") && user.role === "AGENT") return true;
    if (audience.includes("EMPLOYEES") && user.role !== "AGENT") return true;
    return false;
}
