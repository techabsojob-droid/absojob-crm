import { NextResponse } from "next/server";
import { decideCorrection, decideEmployeeRequest, decideWfh } from "@/lib/mock/ess";
import { requireRole } from "@/lib/mock/server";
import {
    leaveRequests, employeeRequests, wfhRequests,
    attendanceCorrections, promotions, transfers,
    employees, addAudit, addNotification
} from "@/lib/mock/data";
import { decideLeave } from "@/lib/mock/hr";
import { syncEmployeeToUser } from "@/lib/mock/identity";

export interface UnifiedApprovalItem {
    id: string;
    kind: "LEAVE" | "WFH" | "ATTENDANCE_CORRECTION" | "EMPLOYEE_REQUEST" | "PROMOTION" | "TRANSFER";
    employeeName: string;
    department: string;
    title: string;
    detail: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    date: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
}

// GET /api/hr/approvals
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") || "ALL";

    const unified: UnifiedApprovalItem[] = [];

    // 1. Leaves
    leaveRequests.filter((l) => l.orgId === me.orgId).forEach((l) => {
        const emp = employees.find((e) => e.userId === l.userId || e.id === l.userId);
        unified.push({
            id: l.id,
            kind: "LEAVE",
            employeeName: emp?.name || "Employee",
            department: emp?.department || "Operations",
            title: `${l.leaveType} Leave`,
            detail: `${l.fromDate} to ${l.toDate}: ${l.reason}`,
            priority: "MEDIUM",
            date: l.createdAt || l.fromDate,
            status: l.status === "PENDING" ? "PENDING" : l.status === "APPROVED" ? "APPROVED" : "REJECTED",
        });
    });

    // 2. Employee Requests
    employeeRequests.filter((r) => r.orgId === me.orgId).forEach((r) => {
        unified.push({
            id: r.id,
            kind: "EMPLOYEE_REQUEST",
            employeeName: r.employeeName,
            department: r.department,
            title: `${r.type.replace(/_/g, " ")} Request`,
            detail: r.description,
            priority: r.priority,
            date: r.requestedAt,
            status: r.status === "PENDING" ? "PENDING" : r.status === "APPROVED" ? "APPROVED" : "REJECTED",
        });
    });

    // 3. WFH Requests
    wfhRequests.filter((w) => w.orgId === me.orgId).forEach((w) => {
        unified.push({
            id: w.id,
            kind: "WFH",
            employeeName: w.employeeName,
            department: w.department,
            title: `Remote Work Request (${w.days} days)`,
            detail: `${w.startDate} to ${w.endDate}: ${w.reason}`,
            priority: "MEDIUM",
            date: w.startDate,
            status: w.status,
        });
    });

    // 4. Attendance Corrections
    attendanceCorrections.filter((c) => c.orgId === me.orgId).forEach((c) => {
        const emp = employees.find((e) => e.id === c.employeeId);
        unified.push({
            id: c.id,
            kind: "ATTENDANCE_CORRECTION",
            employeeName: c.employeeName,
            department: emp?.department || "General",
            title: `Punch Correction for ${c.date}`,
            detail: `Requested: ${c.requestedCheckIn} - ${c.requestedCheckOut}. Reason: ${c.reason}`,
            priority: "MEDIUM",
            date: c.date,
            status: c.status,
        });
    });

    // 5. Promotions
    promotions.filter((p) => p.orgId === me.orgId).forEach((p) => {
        unified.push({
            id: p.id,
            kind: "PROMOTION",
            employeeName: p.employeeName,
            department: p.currentDepartment,
            title: `Promotion to ${p.newDesignation}`,
            detail: `Proposed CTC: ₹${p.newCtcLpa} LPA. Reason: ${p.reason}`,
            priority: "HIGH",
            date: p.effectiveDate,
            status: p.status === "APPLIED" || p.status === "APPROVED" ? "APPROVED" : p.status === "REJECTED" ? "REJECTED" : "PENDING",
        });
    });

    // Sort by pending first, then date descending
    let list = unified.sort((a, b) => {
        if (a.status === "PENDING" && b.status !== "PENDING") return -1;
        if (b.status === "PENDING" && a.status !== "PENDING") return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    if (statusFilter !== "ALL") {
        list = list.filter((item) => item.status === statusFilter);
    }

    return NextResponse.json(list);
}

// PATCH /api/hr/approvals
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, kind, action, reviewComment } = await request.json(); // action: "APPROVE" | "REJECT"
    if (!["APPROVE", "REJECT"].includes(action)) {
        return NextResponse.json({ error: "action must be APPROVE or REJECT" }, { status: 400 });
    }
    const approve = action === "APPROVE";
    if (!approve && !String(reviewComment ?? "").trim()) {
        return NextResponse.json({ error: "A reason is required when rejecting" }, { status: 400 });
    }

    // Notify the employee behind an HR record
    const notifyEmployee = (employeeId: string, title: string, message: string, link = "/portal/requests") => {
        const emp = employees.find((e) => e.id === employeeId);
        if (emp?.userId) addNotification({ orgId: me.orgId, userId: emp.userId, title, message, link });
    };
    const outcome = approve ? "approved" : "rejected";
    let detail = "";

    if (kind === "LEAVE") {
        const l = leaveRequests.find((r) => r.id === id && r.orgId === me.orgId);
        if (!l) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
        const result = decideLeave(me, l, approve ? "APPROVED" : "REJECTED", reviewComment);
        if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ success: true, id, status: l.status });
    } else if (kind === "EMPLOYEE_REQUEST") {
        const r = employeeRequests.find((req) => req.id === id && req.orgId === me.orgId);
        if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });
        const res = decideEmployeeRequest(me, r, approve ? "APPROVED" : "REJECTED", reviewComment);
        if (res.error) return NextResponse.json({ error: res.error }, { status: res.status });
        return NextResponse.json({ success: true, id, status: r.status });
    } else if (kind === "WFH" || kind === "ATTENDANCE_CORRECTION") {
        const r = (kind === "WFH" ? decideWfh : decideCorrection)(me, id, approve, reviewComment);
        if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ success: true, id });
    } else if (kind === "PROMOTION") {
        const p = promotions.find((req) => req.id === id && req.orgId === me.orgId);
        if (!p) return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
        if (p.status !== "PENDING") return NextResponse.json({ error: `Already ${p.status.toLowerCase()}` }, { status: 409 });
        p.status = approve ? "APPLIED" : "REJECTED";
        p.approvedByName = me.name;
        if (approve) {
            // Apply to the employee (and their login) so every module sees the new role / pay
            const emp = employees.find((e) => e.id === p.employeeId);
            if (emp) {
                emp.designation = p.newDesignation;
                emp.department = p.newDepartment;
                const monthly = Math.round((p.newCtcLpa * 100000) / 12);
                emp.salary = {
                    basic: Math.round(monthly * 0.5), hra: Math.round(monthly * 0.2), allowances: Math.round(monthly * 0.3),
                    deductions: emp.salary?.deductions ?? 0, netMonthly: monthly - (emp.salary?.deductions ?? 0), annualCtc: monthly * 12,
                };
                emp.updatedAt = new Date().toISOString();
                syncEmployeeToUser(emp);
            }
        }
        detail = `${p.employeeName}: promotion to ${p.newDesignation} ${outcome}`;
        notifyEmployee(p.employeeId, approve ? "Congratulations on your promotion 🎉" : "Promotion update", approve ? `You are now ${p.newDesignation} (effective ${p.effectiveDate})` : `Promotion request was not approved${reviewComment ? ` — ${reviewComment}` : ""}`, "/portal/profile");
    } else {
        return NextResponse.json({ error: `Unsupported approval kind: ${kind}` }, { status: 400 });
    }

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: `APPROVAL_${approve ? "APPROVED" : "REJECTED"}`,
        entity: kind,
        entityId: id,
        detail: `${detail}${reviewComment ? ` — ${reviewComment}` : ""}`,
    });

    return NextResponse.json({ success: true, id, status: approve ? "APPROVED" : "REJECTED" });
}
