import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { attendance, attendanceCorrections, users, hoursWorkedOf } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { attendanceMonth, dayKind, istNow, onApprovedLeave, punch, shiftFor, wfhAllowedOn } from "@/lib/mock/ess";
import { body } from "@/lib/mock/fin/http";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET ?month=YYYY-MM — my attendance calendar (punches + leave + holidays + week-offs), shift and today's status
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const now = istNow();
    const m = new URL(request.url).searchParams.get("month");
    const month = m && MONTH_RE.test(m) ? m : now.date.slice(0, 7);
    const emp = employeeForUser(me.id);
    const shift = shiftFor(emp, me.orgId);
    const view = attendanceMonth(me, month);
    const today = attendance.find((a) => a.userId === me.id && a.date === now.date);
    const kind = dayKind(me.orgId, now.date, emp?.location);
    const leave = onApprovedLeave(me.id, now.date);

    return NextResponse.json({
        month,
        shift,
        today: {
            date: now.date, holiday: kind.holiday, weekOff: kind.weekOff,
            onLeave: leave ? { type: leave.leaveType, halfDay: leave.halfDay ?? null } : null,
            wfhAllowed: wfhAllowedOn(emp, now.date), workMode: emp?.workMode ?? "OFFICE",
            record: today ? { ...today, hoursWorked: hoursWorkedOf(today) } : null,
        },
        days: view.days,
        summary: { ...view.summary, lateDays: view.summary.late, halfDays: view.summary.halfDay, leaves: view.summary.onLeave, totalHours: view.summary.hours },
        corrections: emp ? attendanceCorrections.filter((c) => c.employeeId === emp.id).slice(0, 20) : [],
        // Back-compat fields used by older widgets
        records: view.days.filter((d) => d.checkIn).reverse().map((d) => ({ id: d.date, date: d.date, status: d.status, checkIn: d.checkIn, checkOut: d.checkOut, hoursWorked: d.hours })),
        todayRecord: today ? { ...today, hoursWorked: hoursWorkedOf(today) } : null,
        teamView: me.role !== "SUPER_ADMIN" ? null : attendance.filter((a) => a.orgId === me.orgId && a.date === now.date).map((a) => ({ ...a, hoursWorked: hoursWorkedOf(a), userName: users.find((u) => u.id === a.userId)?.name ?? "—" })),
    });
}

// POST { action: "check_in" | "check_out", mode?: "OFFICE" | "WFH" }
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const b = await body(request);
    if (!["check_in", "check_out"].includes(b.action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    const r = punch(auth.user, b.action, b.mode === "WFH" ? "WFH" : "OFFICE");
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r.record);
}
