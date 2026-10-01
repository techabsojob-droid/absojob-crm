import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { attendance, attendanceCorrections, hoursWorkedOf, leaveRequests, performanceReviews, wfhRequests } from "@/lib/mock/data";
import { leavesAwaiting } from "@/lib/mock/hr";
import { expensesAwaitingManager } from "@/lib/mock/finance";
import { decideCorrection, decideWfh, directReports, istNow, onApprovedLeave } from "@/lib/mock/ess";
import { bad, body } from "@/lib/mock/fin/http";

// GET — my direct reports: today's attendance, leave, pending approvals, probation reviews due
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const team = directReports(me);
    const today = istNow().date;
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const ids = new Set(team.map((e) => e.id));
    const members = team.map((e) => {
        const rec = e.userId ? attendance.find((a) => a.userId === e.userId && a.date === today) : undefined;
        const leave = e.userId ? onApprovedLeave(e.userId, today) : undefined;
        const mtd = e.userId ? attendance.filter((a) => a.userId === e.userId && a.date.startsWith(today.slice(0, 7))) : [];
        return {
            id: e.id, name: e.name, designation: e.designation, email: e.email, phone: e.phone, workMode: e.workMode ?? null, status: e.status,
            today: leave ? `ON_LEAVE (${leave.leaveType.toLowerCase()})` : rec?.checkIn ? rec.status : "NOT_MARKED",
            checkIn: rec?.checkIn ?? null, hoursToday: rec ? hoursWorkedOf(rec) : 0,
            lateThisMonth: mtd.filter((a) => a.status === "LATE").length,
            probationEndDate: e.probationStatus === "ON_PROBATION" ? e.probationEndDate ?? null : null,
            upcomingLeave: e.userId ? leaveRequests.filter((l) => l.userId === e.userId && ["APPROVED", "PENDING"].includes(l.status) && l.toDate >= today && l.fromDate <= in30).map((l) => ({ id: l.id, type: l.leaveType, fromDate: l.fromDate, toDate: l.toDate, status: l.status })) : [],
        };
    });
    return NextResponse.json({
        isManager: team.length > 0,
        members,
        summary: {
            size: members.length,
            present: members.filter((m) => ["PRESENT", "LATE", "WFH", "HALF_DAY"].includes(m.today)).length,
            onLeave: members.filter((m) => m.today.startsWith("ON_LEAVE")).length,
            notMarked: members.filter((m) => m.today === "NOT_MARKED").length,
            probationDue: members.filter((m) => m.probationEndDate && m.probationEndDate <= in30).length,
        },
        approvals: {
            leave: leavesAwaiting(me).length,
            wfh: wfhRequests.filter((w) => ids.has(w.employeeId) && w.status === "PENDING").map((w) => ({ id: w.id, employeeName: w.employeeName, startDate: w.startDate, endDate: w.endDate, days: w.days, reason: w.reason })),
            corrections: attendanceCorrections.filter((c) => ids.has(c.employeeId) && c.status === "PENDING").map((c) => ({ id: c.id, employeeName: c.employeeName, date: c.date, requestedCheckIn: c.requestedCheckIn, requestedCheckOut: c.requestedCheckOut, reason: c.reason })),
            expenses: expensesAwaitingManager(me).length,
            reviews: performanceReviews.filter((r) => ids.has(r.employeeId) && r.status === "MANAGER_REVIEW").length,
        },
    });
}

// PATCH { kind: "WFH" | "CORRECTION", id, decision: approve | reject, note } — reporting manager decides
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const ids = new Set(directReports(me).map((e) => e.id));
    const rec = b.kind === "WFH" ? wfhRequests.find((w) => w.id === b.id) : b.kind === "CORRECTION" ? attendanceCorrections.find((c) => c.id === b.id) : undefined;
    if (!rec) return bad("Request not found", 404);
    if (!ids.has(rec.employeeId)) return bad("Only the reporting manager (or HR) can decide this", 403);
    const r = (b.kind === "WFH" ? decideWfh : decideCorrection)(me, b.id, b.decision === "approve", b.note);
    if (r.error) return bad(r.error, r.status);
    return NextResponse.json({ success: true });
}
