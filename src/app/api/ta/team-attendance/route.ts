import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { attendance, attendanceCorrections, auditLogs, hoursWorkedOf } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { attendanceMonth, decideCorrection, istNow, onApprovedLeave } from "@/lib/mock/ess";
import { recruitmentTeam } from "@/lib/mock/pipeline";
import { leavesAwaiting } from "@/lib/mock/hr";
import { bad, body } from "@/lib/mock/fin/http";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const COUNTED = ["PRESENT", "LATE", "HALF_DAY", "WFH", "ON_LEAVE", "ABSENT"] as const;

/** The recruiters this lead manages, with their HR employee record (corrections are keyed by employee). */
function teamOf(me: Parameters<typeof recruitmentTeam>[0]) {
    return recruitmentTeam(me).map((u) => ({ user: u, emp: employeeForUser(u.id) }));
}

// GET ?month=YYYY-MM[&userId=] — team attendance: today's snapshot, month register per member,
// regularization requests (pending + decided) and the audit trail of decisions
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const p = new URL(request.url).searchParams;
    const today = istNow().date;
    const month = MONTH_RE.test(p.get("month") ?? "") ? p.get("month")! : today.slice(0, 7);
    const only = p.get("userId");

    const team = teamOf(me).filter((m) => !only || only === "ALL" || m.user.id === only);
    const members = team.map(({ user: u, emp }) => {
        const view = attendanceMonth(u, month);
        const rec = attendance.find((a) => a.userId === u.id && a.date === today);
        const leave = onApprovedLeave(u.id, today);
        const todayDay = view.days.find((d) => d.date === today);
        return {
            id: u.id, name: u.name, designation: u.designation ?? null, employeeCode: emp?.employeeId ?? null,
            today: {
                status: leave && !leave.halfDay ? "ON_LEAVE" : rec?.checkIn ? rec.status : todayDay?.status ?? "NOT_MARKED",
                checkIn: rec?.checkIn ?? null, checkOut: rec?.checkOut ?? null, hours: rec ? hoursWorkedOf(rec) : 0,
                lateByMinutes: rec?.lateByMinutes ?? 0, mode: rec?.mode ?? null,
            },
            summary: view.summary,
            days: view.days.map((d) => ({ date: d.date, status: d.status, checkIn: d.checkIn, checkOut: d.checkOut, hours: d.hours, lateByMinutes: d.lateByMinutes, leaveType: d.leaveType, holiday: d.holiday })),
        };
    });

    const empIds = new Set(team.map((m) => m.emp?.id).filter(Boolean) as string[]);
    const corrections = attendanceCorrections.filter((c) => c.orgId === me.orgId && empIds.has(c.employeeId))
        .sort((a, b) => (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1) || b.date.localeCompare(a.date))
        .slice(0, 200)
        .map((c) => ({ ...c, userId: team.find((m) => m.emp?.id === c.employeeId)?.user.id ?? null }));
    const corrIds = new Set(corrections.map((c) => c.id));
    const history = auditLogs.filter((l) => l.orgId === me.orgId && l.entity === "AttendanceCorrection" && corrIds.has(l.entityId))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 100);

    const count = (s: string) => members.filter((m) => m.today.status === s).length;
    return NextResponse.json({
        month,
        today,
        members,
        snapshot: {
            size: members.length,
            ...Object.fromEntries(COUNTED.map((s) => [s, count(s)])),
            NOT_MARKED: count("NOT_MARKED"),
        },
        monthTotals: Object.fromEntries((["present", "late", "halfDay", "wfh", "onLeave", "absent", "workingDays"] as const).map((k) => [k, members.reduce((s, m) => s + m.summary[k], 0)])),
        corrections,
        pendingCount: corrections.filter((c) => c.status === "PENDING").length,
        // Leave is applied and decided on the Leave tab (same flow as the employee portal)
        pendingLeave: leavesAwaiting(me).filter((l) => team.some((m) => m.user.id === l.userId)).map((l) => ({
            id: l.id, userId: l.userId, name: team.find((m) => m.user.id === l.userId)?.user.name ?? "—",
            leaveType: l.leaveType, fromDate: l.fromDate, toDate: l.toDate, halfDay: l.halfDay ?? null, days: l.days ?? null, reason: l.reason,
        })),
        history,
    });
}

// PATCH { id, decision: "approve" | "reject", note } — review a team member's regularization request
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const c = attendanceCorrections.find((x) => x.id === b.id && x.orgId === me.orgId);
    if (!c) return bad("Request not found", 404);
    const empIds = new Set(teamOf(me).map((m) => m.emp?.id).filter(Boolean));
    if (!empIds.has(c.employeeId)) return bad("You can only review requests from your own team", 403);
    if (!["approve", "reject"].includes(b.decision)) return bad("decision must be approve or reject");
    const r = decideCorrection(me, c.id, b.decision === "approve", b.note);
    if (r.error) return bad(r.error, r.status);
    return NextResponse.json({ success: true, correction: c });
}
