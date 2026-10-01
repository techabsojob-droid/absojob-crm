import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { leaveRequests, employees, users } from "@/lib/mock/data";
import { decideLeave } from "@/lib/mock/hr";

// GET: list leave requests for HR management
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase();

    const list = leaveRequests.filter((l) => l.orgId === me.orgId);

    const enriched = list.map((l) => {
        const emp = employees.find((e) => e.userId === l.userId || e.id === l.userId);
        const user = users.find((u) => u.id === l.userId);
        const name = emp?.name || user?.name || "Employee";
        const dept = emp?.department || user?.department || "Operations";
        const code = emp?.employeeId || "—";
        const approver = l.approverId ? users.find((u) => u.id === l.approverId)?.name ?? null : null;
        return {
            ...l,
            employeeName: name,
            department: dept,
            employeeCode: code,
            approverName: approver,
        };
    });

    let filtered = enriched;
    if (status && status !== "ALL") {
        filtered = filtered.filter((r) => r.status === status);
    }
    if (q) {
        filtered = filtered.filter((r) => r.employeeName.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q));
    }

    return NextResponse.json(filtered);
}

// PATCH: approve or reject leave request
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { id, status, decisionNote } = body;

    if (!id || !status || !["APPROVED", "REJECTED"].includes(status)) {
        return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const item = leaveRequests.find((l) => l.id === id && l.orgId === me.orgId);
    if (!item) {
        return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    const result = decideLeave(me, item, status, decisionNote);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json(item);
}
