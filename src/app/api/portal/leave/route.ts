import { NextResponse } from "next/server";
import { getSessionUser, requireRole } from "@/lib/mock/server";
import { leaveRequests, users, addNotification } from "@/lib/mock/data";
import type { LeaveRequest, LeaveStatus } from "@/lib/types";

export async function GET() {
    const auth = await requireRole("AGENT", "EMPLOYEE", "SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const mine = leaveRequests
        .filter((l) => l.orgId === me.orgId && l.userId === me.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    // leave balance (mock policy: 12 casual, 10 earned, 15 sick per year)
    const year = new Date().getFullYear();
    const used = (type: string) =>
        mine
            .filter((l) => l.leaveType === type && ["APPROVED"].includes(l.status) && l.fromDate.startsWith(String(year)))
            .reduce((s, l) => s + Math.max(1, Math.round((+new Date(l.toDate) - +new Date(l.fromDate)) / 86400000) + 1), 0);

    return NextResponse.json({
        requests: mine.map((l) => ({
            ...l,
            approverName: l.approverId ? users.find((u) => u.id === l.approverId)?.name ?? null : null,
        })),
        balances: {
            CASUAL: { total: 12, used: used("CASUAL") },
            EARNED: { total: 10, used: used("EARNED") },
            SICK: { total: 15, used: used("SICK") },
        },
        // pending approvals visible to SUPER_ADMIN
        approvals:
            me.role === "SUPER_ADMIN"
                ? leaveRequests
                      .filter((l) => l.orgId === me.orgId && l.status === "PENDING")
                      .map((l) => ({ ...l, userName: users.find((u) => u.id === l.userId)?.name ?? "—" }))
                : null,
    });
}

export async function POST(request: Request) {
    const auth = await requireRole("AGENT", "EMPLOYEE");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.leaveType || !body.fromDate || !body.toDate || !body.reason) {
        return NextResponse.json({ error: "leaveType, fromDate, toDate and reason are required" }, { status: 400 });
    }
    if (new Date(body.toDate) < new Date(body.fromDate)) {
        return NextResponse.json({ error: "toDate cannot be before fromDate" }, { status: 400 });
    }

    const leave: LeaveRequest = {
        id: `lv-${Date.now().toString(36)}`,
        orgId: me.orgId,
        userId: me.id,
        leaveType: body.leaveType,
        fromDate: body.fromDate,
        toDate: body.toDate,
        reason: body.reason,
        status: "PENDING",
        approverId: null,
        decisionNote: null,
        createdAt: new Date().toISOString(),
    };
    leaveRequests.unshift(leave);

    for (const sa of users.filter((u) => u.orgId === me.orgId && u.role === "SUPER_ADMIN")) {
        addNotification({
            orgId: me.orgId,
            userId: sa.id,
            title: "Leave request pending",
            message: `${me.name} applied for ${body.leaveType.toLowerCase()} leave (${body.fromDate} → ${body.toDate})`,
            link: "/portal/leave",
        });
    }

    return NextResponse.json(leave, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, decision, decisionNote } = await request.json();
    const leave = leaveRequests.find((l) => l.id === id && l.orgId === me.orgId);
    if (!leave) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    if (leave.status !== "PENDING") return NextResponse.json({ error: "Already decided" }, { status: 409 });

    leave.status = (decision === "approve" ? "APPROVED" : "REJECTED") as LeaveStatus;
    leave.approverId = me.id;
    leave.decisionNote = decisionNote ?? null;

    addNotification({
        orgId: me.orgId,
        userId: leave.userId,
        title: `Leave ${leave.status.toLowerCase()}`,
        message: `Your ${leave.leaveType.toLowerCase()} leave (${leave.fromDate} → ${leave.toDate}) was ${leave.status.toLowerCase()}${decisionNote ? ` — ${decisionNote}` : ""}`,
        link: "/portal/leave",
    });

    void getSessionUser; // session already validated via requireRole
    return NextResponse.json(leave);
}
