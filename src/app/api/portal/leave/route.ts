import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { leaveRequests, storedFiles, users, addAudit, addNotification } from "@/lib/mock/data";
import { approversFor, employeeForUser } from "@/lib/mock/identity";
import { decideLeave, leavesAwaiting } from "@/lib/mock/hr";
import { directReports, istNow, leaveBalancesFor, leaveDaysOf, syncLeaveBalanceRecord, validateLeave } from "@/lib/mock/ess";
import { holidays } from "@/lib/mock/data";
import { body } from "@/lib/mock/fin/http";
import type { LeaveRequest } from "@/lib/types";

const withMeta = (l: LeaveRequest) => ({
    ...l,
    days: leaveDaysOf(l),
    approverName: l.approverId ? users.find((u) => u.id === l.approverId)?.name ?? null : null,
    attachmentUrl: l.attachmentFileId ? `/api/files/${l.attachmentFileId}` : null,
    userName: users.find((u) => u.id === l.userId)?.name ?? "—",
});

// GET — my leave: balances (policy-driven), requests, approvals I can decide, team calendar, upcoming holidays
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const today = istNow().date;
    const mine = leaveRequests.filter((l) => l.orgId === me.orgId && l.userId === me.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const bal = leaveBalancesFor(me);
    const team = directReports(me);
    const teamUserIds = new Set(team.map((e) => e.userId).filter(Boolean) as string[]);
    const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

    return NextResponse.json({
        requests: mine.map(withMeta),
        balanceList: bal,
        // Back-compat map { CASUAL: { total, used } }
        balances: Object.fromEntries(bal.filter((b) => ["CASUAL", "EARNED", "SICK"].includes(b.type)).map((b) => [b.type, { total: b.allowance ?? 0, used: b.used, pending: b.pending, available: b.available }])),
        approvals: (() => {
            const list = leavesAwaiting(me).map(withMeta);
            return list.length || me.role === "SUPER_ADMIN" || me.role === "HR_ADMIN" || team.length ? list : null;
        })(),
        teamCalendar: team.length ? leaveRequests.filter((l) => teamUserIds.has(l.userId) && ["APPROVED", "PENDING"].includes(l.status) && l.toDate >= today && l.fromDate <= in60).map(withMeta).sort((a, b) => a.fromDate.localeCompare(b.fromDate)) : null,
        upcomingHolidays: holidays.filter((h) => h.orgId === me.orgId && h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5),
    });
}

// POST { leaveType, fromDate, toDate, halfDay?, reason, attachmentFileId? } — apply
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    if (b.attachmentFileId && !storedFiles.some((f) => f.id === b.attachmentFileId && f.ownerUserId === me.id)) return NextResponse.json({ error: "Attachment not found — upload it again" }, { status: 400 });
    const v = validateLeave(me, b as never);
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: v.status });

    const leave: LeaveRequest = {
        id: `lv-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, userId: me.id, leaveType: b.leaveType,
        fromDate: b.fromDate, toDate: b.toDate, halfDay: b.halfDay || null, days: v.days, reason: String(b.reason).trim().slice(0, 1000),
        attachmentFileId: b.attachmentFileId || null, status: "PENDING", approverId: null, decisionNote: null, createdAt: new Date().toISOString(),
    };
    leaveRequests.unshift(leave);

    // Route to the reporting manager and HR (fallback: Super Admin when there is no HR)
    const { hrIds, managerUserId } = approversFor(me.id);
    const targets = new Set<string>([...hrIds, ...(managerUserId ? [managerUserId] : [])]);
    if (targets.size === 0) users.filter((u) => u.orgId === me.orgId && u.role === "SUPER_ADMIN" && u.status === "ACTIVE").forEach((u) => targets.add(u.id));
    targets.delete(me.id);
    const span = leave.halfDay ? `${leave.fromDate} (${leave.halfDay.toLowerCase()} half)` : `${leave.fromDate} → ${leave.toDate}`;
    targets.forEach((userId) => {
        const target = users.find((u) => u.id === userId);
        addNotification({ orgId: me.orgId, userId, title: "Leave request pending", message: `${me.name} applied for ${leave.leaveType.toLowerCase()} leave (${span}, ${v.days} day(s))`, link: target?.role === "HR_ADMIN" ? "/hr/leave" : "/portal/leave" });
    });
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "LEAVE_APPLIED", entity: "LeaveRequest", entityId: leave.id, detail: `${leave.leaveType} ${span} (${v.days} day(s))` });
    return NextResponse.json(withMeta(leave), { status: 201 });
}

// PATCH { id, decision: approve|reject, decisionNote } — approver; { id, action: "cancel", reason } — requester
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const leave = leaveRequests.find((l) => l.id === b.id && l.orgId === me.orgId);
    if (!leave) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });

    if (b.action === "cancel") {
        if (leave.userId !== me.id) return NextResponse.json({ error: "You can only cancel your own leave" }, { status: 403 });
        if (!["PENDING", "APPROVED"].includes(leave.status)) return NextResponse.json({ error: `Leave is already ${leave.status.toLowerCase()}` }, { status: 409 });
        if (leave.status === "APPROVED" && leave.fromDate <= istNow().date) return NextResponse.json({ error: "Leave that has started cannot be cancelled — ask HR to adjust it" }, { status: 409 });
        const wasApproved = leave.status === "APPROVED";
        leave.status = "CANCELLED";
        leave.cancelledAt = new Date().toISOString();
        leave.cancelReason = String(b.reason ?? "").trim() || null;
        syncLeaveBalanceRecord(me.id);
        const emp = employeeForUser(me.id);
        if (wasApproved && emp?.status === "ON_LEAVE") emp.status = "ACTIVE";
        const { managerUserId, hrIds } = approversFor(me.id);
        new Set([...(managerUserId ? [managerUserId] : []), ...(wasApproved ? hrIds : []), ...(leave.approverId ? [leave.approverId] : [])]).forEach((userId) => {
            if (userId !== me.id) addNotification({ orgId: me.orgId, userId, title: "Leave cancelled", message: `${me.name} cancelled ${leave.leaveType.toLowerCase()} leave ${leave.fromDate} → ${leave.toDate}`, link: "/portal/leave" });
        });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "LEAVE_CANCELLED", entity: "LeaveRequest", entityId: leave.id, detail: `${leave.fromDate} → ${leave.toDate}${leave.cancelReason ? ` — ${leave.cancelReason}` : ""}` });
        return NextResponse.json(withMeta(leave));
    }

    const result = decideLeave(me, leave, b.decision === "approve" ? "APPROVED" : "REJECTED", b.decisionNote);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(withMeta(leave));
}
