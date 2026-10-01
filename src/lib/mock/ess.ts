// ─── Employee self-service engine ─────────────────────────────
// One place for the rules the employee portal, HRMIS and payroll share:
// the work calendar (IST, week-offs, holidays, shifts), leave balances and
// validation, attendance punches, WFH / correction decisions and income tax.

import type { AttendanceRecord, Employee, LeaveRequest, LeaveType, ShiftSchedule, TaxDeclaration, TaxRegime, User } from "@/lib/types";
import {
    addAudit, addNotification, attendance, attendanceCorrections, employees, holidays, leaveBalances, leavePolicies,
    leaveRequests, nextIds, organizationSettingsSeed, shifts, taxDeclarations, users, wfhRequests,
} from "./data";
import { employeeForUser } from "./identity";
import { annualTax } from "./fin/payroll";
import { fyOf, settingsFor } from "./fin/core";

// ─── Time (all attendance rules run in India Standard Time) ──

export function istNow(d = new Date()): { date: string; minutes: number; iso: string } {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
            .formatToParts(d).map((p) => [p.type, p.value])
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), iso: d.toISOString() };
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); };
const addDaysStr = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ─── Work calendar ───────────────────────────────────────────

export function workingWeekdays(orgId: string): Set<number> {
    const names: string[] = organizationSettingsSeed[orgId]?.workingDays ?? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    return new Set(names.map((n) => DAY_NAMES.indexOf(n)).filter((i) => i >= 0));
}

export function holidayOn(orgId: string, date: string, location?: string | null) {
    return holidays.find((h) => h.orgId === orgId && h.date === date && h.type !== "OPTIONAL" && (!h.locations?.length || !location || h.locations.some((l) => location.toLowerCase().includes(l.toLowerCase()))));
}

export function dayKind(orgId: string, date: string, location?: string | null): { off: boolean; weekOff: boolean; holiday: string | null } {
    const weekOff = !workingWeekdays(orgId).has(new Date(`${date}T00:00:00Z`).getUTCDay());
    const h = holidayOn(orgId, date, location);
    return { off: weekOff || !!h, weekOff, holiday: h?.name ?? null };
}

/** Working days charged for a leave: week-offs and holidays are not counted; half-day = 0.5. */
export function chargeableDays(orgId: string, from: string, to: string, halfDay?: string | null, location?: string | null): number {
    if (halfDay) return dayKind(orgId, from, location).off ? 0 : 0.5;
    let n = 0;
    for (let d = from; d <= to; d = addDaysStr(d, 1)) if (!dayKind(orgId, d, location).off) n++;
    return n;
}

export function leaveDaysOf(l: LeaveRequest): number {
    if (typeof l.days === "number") return l.days;
    const emp = employeeForUser(l.userId);
    return chargeableDays(l.orgId, l.fromDate, l.toDate, l.halfDay, emp?.location);
}

// ─── Shifts ──────────────────────────────────────────────────

export function shiftFor(emp: Employee | undefined, orgId: string): Pick<ShiftSchedule, "id" | "name" | "code" | "startTime" | "endTime" | "graceMinutes" | "workingHours"> {
    const assigned = emp?.shiftId ? shifts.find((s) => s.id === emp.shiftId && s.status === "ACTIVE") : undefined;
    const general = shifts.find((s) => s.orgId === orgId && s.code === "GEN_DAY" && s.status === "ACTIVE");
    if (assigned ?? general) return (assigned ?? general)!;
    const cfg = organizationSettingsSeed[orgId] ?? {};
    return { id: "default", name: "General", code: "GEN", startTime: cfg.workStartTime ?? "09:30", endTime: cfg.workEndTime ?? "18:30", graceMinutes: cfg.gracePeriodMinutes ?? 15, workingHours: 9 };
}

// ─── Leave balances ──────────────────────────────────────────

const LABEL: Record<LeaveType, string> = { CASUAL: "Casual", SICK: "Sick", EARNED: "Earned / Privilege", UNPAID: "Unpaid (LOP)", COMP_OFF: "Comp-off", MATERNITY: "Maternity", PATERNITY: "Paternity" };
const NO_NOTICE: LeaveType[] = ["SICK", "UNPAID", "COMP_OFF"];
export const COMP_OFF_VALIDITY_DAYS = 90;
const SICK_CERT_AFTER_DAYS = 2;

export interface LeaveBalance {
    type: LeaveType; label: string;
    allowance: number | null; // null = unlimited (unpaid)
    used: number; pending: number; available: number | null;
    minNoticeDays: number; maxConsecutiveDays: number | null; allowedOnProbation: boolean; eligible: boolean; note?: string;
}

function hoursOf(a: AttendanceRecord) {
    if (!a.checkIn || !a.checkOut) return 0;
    return Math.max(0, (+new Date(a.checkOut) - +new Date(a.checkIn)) / 3600000);
}

/** Comp-off days earned by working a full shift half or more on week-offs / holidays in the validity window. */
export function compOffEarned(userId: string, today = istNow().date): number {
    const since = addDaysStr(today, -COMP_OFF_VALIDITY_DAYS);
    return attendance.filter((a) => a.userId === userId && a.workedOnOffDay && a.date >= since && a.date <= today)
        .reduce((s, a) => s + (hoursOf(a) >= 7 ? 1 : hoursOf(a) >= 4 ? 0.5 : 0), 0);
}

export function leaveBalancesFor(user: Pick<User, "id" | "orgId">, year = Number(istNow().date.slice(0, 4))): LeaveBalance[] {
    const emp = employeeForUser(user.id);
    const lb = emp ? leaveBalances.find((b) => b.employeeId === emp.id) : undefined;
    const mine = leaveRequests.filter((l) => l.userId === user.id && ["APPROVED", "PENDING"].includes(l.status));
    const sum = (type: LeaveType, status: string, yearly = true) =>
        mine.filter((l) => l.leaveType === type && l.status === status && (!yearly || l.fromDate.startsWith(String(year)))).reduce((s, l) => s + leaveDaysOf(l), 0);
    const onProbation = emp?.probationStatus === "ON_PROBATION" || emp?.probationStatus === "EXTENDED";
    // Joiners this year get a pro-rated allowance (to the nearest half day)
    const joinedThisYear = emp?.joiningDate?.startsWith(String(year));
    const proRate = (n: number) => (joinedThisYear ? Math.round(((n * (12 - Number(emp!.joiningDate.slice(5, 7)) + 1)) / 12) * 2) / 2 : n);

    const types: LeaveType[] = ["CASUAL", "SICK", "EARNED", "COMP_OFF", "UNPAID"];
    if (!emp?.gender || emp.gender === "FEMALE") types.push("MATERNITY");
    if (!emp?.gender || emp.gender === "MALE") types.push("PATERNITY");

    return types.map((type) => {
        const p = leavePolicies.find((x) => x.leaveType === type);
        let allowance: number | null;
        if (type === "UNPAID") allowance = null;
        else if (type === "COMP_OFF") allowance = compOffEarned(user.id);
        else if (lb && type === "CASUAL") allowance = lb.casualAllowance;
        else if (lb && type === "SICK") allowance = lb.sickAllowance;
        else if (lb && type === "EARNED") allowance = lb.earnedAllowance + lb.carryForward;
        else allowance = p ? (["CASUAL", "SICK", "EARNED"].includes(type) ? proRate(p.annualAllowance) : p.annualAllowance) : type === "MATERNITY" ? 182 : type === "PATERNITY" ? 5 : 0;
        const used = sum(type, "APPROVED", type !== "COMP_OFF");
        const pending = sum(type, "PENDING", type !== "COMP_OFF");
        const allowedOnProbation = p?.probationAllowed ?? !["EARNED", "MATERNITY", "PATERNITY"].includes(type);
        return {
            type, label: LABEL[type], allowance, used, pending,
            available: allowance === null ? null : Math.max(0, allowance - used - pending),
            minNoticeDays: NO_NOTICE.includes(type) ? 0 : p?.minNoticeDays ?? 0,
            maxConsecutiveDays: p?.maxConsecutiveDays ?? null,
            allowedOnProbation,
            eligible: !(onProbation && !allowedOnProbation),
            note: type === "COMP_OFF" ? `Earned by working on week-offs / holidays; valid ${COMP_OFF_VALIDITY_DAYS} days` : type === "SICK" ? `Medical certificate needed beyond ${SICK_CERT_AFTER_DAYS} days` : onProbation && !allowedOnProbation ? "Available after probation" : undefined,
        };
    });
}

export interface LeaveInput { leaveType: LeaveType; fromDate: string; toDate: string; halfDay?: "FIRST" | "SECOND" | null; reason: string; attachmentFileId?: string | null }

export function validateLeave(user: User, b: LeaveInput): { error: string; status: number } | { days: number } {
    const today = istNow().date;
    const date = /^\d{4}-\d{2}-\d{2}$/;
    if (!b.leaveType || !date.test(b.fromDate ?? "") || !date.test(b.toDate ?? "") || !String(b.reason ?? "").trim()) return { error: "Leave type, valid dates and a reason are required", status: 400 };
    if (b.toDate < b.fromDate) return { error: "End date cannot be before start date", status: 400 };
    if (b.halfDay && b.fromDate !== b.toDate) return { error: "Half-day leave must be for a single date", status: 400 };
    if (b.halfDay && !["FIRST", "SECOND"].includes(b.halfDay)) return { error: "Choose first or second half", status: 400 };
    if (b.fromDate < addDaysStr(today, -30)) return { error: "Leave older than 30 days cannot be applied — contact HR", status: 400 };
    if (b.toDate > addDaysStr(today, 365)) return { error: "Leave can be planned up to one year ahead", status: 400 };
    const bal = leaveBalancesFor(user, Number(b.fromDate.slice(0, 4))).find((x) => x.type === b.leaveType);
    if (!bal) return { error: "This leave type is not available to you", status: 400 };
    if (!bal.eligible) return { error: `${bal.label} leave is not available during probation`, status: 422 };
    const emp = employeeForUser(user.id);
    const days = chargeableDays(user.orgId, b.fromDate, b.toDate, b.halfDay, emp?.location);
    if (days <= 0) return { error: "The selected dates are week-offs or holidays — no leave needed", status: 400 };
    if (bal.minNoticeDays && b.fromDate >= today) {
        const notice = Math.round((+new Date(b.fromDate) - +new Date(today)) / 86400000);
        if (notice < bal.minNoticeDays) return { error: `${bal.label} leave needs ${bal.minNoticeDays} day(s) notice`, status: 422 };
    }
    if (bal.maxConsecutiveDays && days > bal.maxConsecutiveDays) return { error: `${bal.label} leave can be at most ${bal.maxConsecutiveDays} consecutive working days`, status: 422 };
    if (b.leaveType === "SICK" && days > SICK_CERT_AFTER_DAYS && !b.attachmentFileId) return { error: `Attach a medical certificate for sick leave over ${SICK_CERT_AFTER_DAYS} days`, status: 400 };
    const overlap = leaveRequests.find((l) => l.userId === user.id && ["PENDING", "APPROVED"].includes(l.status) && l.fromDate <= b.toDate && l.toDate >= b.fromDate
        && !(l.halfDay && b.halfDay && l.fromDate === b.fromDate && l.halfDay !== b.halfDay));
    if (overlap) return { error: `Overlaps your ${overlap.status.toLowerCase()} leave (${overlap.fromDate} → ${overlap.toDate})`, status: 409 };
    if (bal.available !== null && days > bal.available) return { error: `Insufficient ${bal.label.toLowerCase()} balance — ${bal.available} day(s) available`, status: 422 };
    return { days };
}

/** Keeps the HRMIS leave-balance register in step with approved leave. */
export function syncLeaveBalanceRecord(userId: string) {
    const emp = employeeForUser(userId);
    const lb = emp ? leaveBalances.find((b) => b.employeeId === emp.id) : undefined;
    if (!lb) return;
    const year = istNow().date.slice(0, 4);
    const used = (t: LeaveType) => leaveRequests.filter((l) => l.userId === userId && l.leaveType === t && l.status === "APPROVED" && l.fromDate.startsWith(year)).reduce((s, l) => s + leaveDaysOf(l), 0);
    lb.casualUsed = used("CASUAL");
    lb.sickUsed = used("SICK");
    lb.earnedUsed = used("EARNED");
}

export function onApprovedLeave(userId: string, date: string) {
    return leaveRequests.find((l) => l.userId === userId && l.status === "APPROVED" && l.fromDate <= date && l.toDate >= date);
}

// ─── Attendance ──────────────────────────────────────────────

export function wfhAllowedOn(emp: Employee | undefined, date: string): boolean {
    if (!emp) return false;
    if (emp.workMode === "REMOTE") return true;
    return wfhRequests.some((w) => w.employeeId === emp.id && w.status === "APPROVED" && w.startDate <= date && w.endDate >= date);
}

export function punch(user: User, action: "check_in" | "check_out", mode: "OFFICE" | "WFH" = "OFFICE"): { error: string; status: number } | { record: AttendanceRecord & { hoursWorked: number } } {
    const now = istNow();
    const emp = employeeForUser(user.id);
    const shift = shiftFor(emp, user.orgId);
    let rec = attendance.find((a) => a.orgId === user.orgId && a.userId === user.id && a.date === now.date);

    if (action === "check_in") {
        if (rec?.checkIn) return { error: "Already checked in today", status: 409 };
        const leave = onApprovedLeave(user.id, now.date);
        if (leave && !leave.halfDay) return { error: `You are on approved ${leave.leaveType.toLowerCase()} leave today — cancel it first to mark attendance`, status: 409 };
        if (mode === "WFH" && !wfhAllowedOn(emp, now.date)) return { error: "No approved WFH for today — raise a WFH request first", status: 422 };
        const kind = dayKind(user.orgId, now.date, emp?.location);
        const late = Math.max(0, now.minutes - (toMin(shift.startTime) + shift.graceMinutes));
        const status: AttendanceRecord["status"] = mode === "WFH" ? "WFH" : late > 0 && !kind.off ? "LATE" : "PRESENT";
        if (!rec) {
            rec = { id: nextIds.attendance(), orgId: user.orgId, userId: user.id, date: now.date, status, checkIn: now.iso, checkOut: null };
            attendance.push(rec);
        } else {
            rec.checkIn = now.iso;
            rec.status = status;
        }
        rec.mode = mode;
        rec.lateByMinutes = kind.off ? 0 : late;
        rec.workedOnOffDay = kind.off;
        return { record: { ...rec, hoursWorked: 0 } };
    }
    if (!rec?.checkIn) return { error: "Check in first", status: 409 };
    if (rec.checkOut) return { error: "Already checked out today", status: 409 };
    rec.checkOut = now.iso;
    const hours = hoursOf(rec);
    if (hours < shift.workingHours / 2 && !rec.workedOnOffDay) rec.status = "HALF_DAY";
    return { record: { ...rec, hoursWorked: Math.round(hours * 10) / 10 } };
}

export type DayStatus = AttendanceRecord["status"] | "HOLIDAY" | "WEEK_OFF" | "UPCOMING" | "NOT_MARKED";

/** Month calendar for one user: punches merged with leave, holidays and week-offs. */
export function attendanceMonth(user: Pick<User, "id" | "orgId">, month: string) {
    const emp = employeeForUser(user.id);
    const today = istNow().date;
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const joined = emp?.joiningDate ?? "0000-00-00";
    const days = [];
    const summary = { workingDays: 0, present: 0, late: 0, halfDay: 0, wfh: 0, onLeave: 0, absent: 0, holidays: 0, hours: 0, lateMinutes: 0 };
    for (let d = 1; d <= last; d++) {
        const date = `${month}-${String(d).padStart(2, "0")}`;
        const rec = attendance.find((a) => a.userId === user.id && a.date === date);
        const kind = dayKind(user.orgId, date, emp?.location);
        const leave = leaveRequests.find((l) => l.userId === user.id && l.status === "APPROVED" && l.fromDate <= date && l.toDate >= date);
        let status: DayStatus;
        if (rec?.checkIn || (rec && !["ABSENT"].includes(rec.status) && rec.status !== "ON_LEAVE")) status = rec.status;
        else if (leave && !kind.off) status = "ON_LEAVE";
        else if (kind.holiday) status = "HOLIDAY";
        else if (kind.weekOff) status = "WEEK_OFF";
        else if (date > today || date < joined) status = "UPCOMING";
        else if (date === today) status = "NOT_MARKED";
        else status = rec?.status ?? "ABSENT";
        const hours = rec ? Math.round(hoursOf(rec) * 10) / 10 : 0;
        if (!kind.off && date <= today && date >= joined) summary.workingDays++;
        if (status === "PRESENT") summary.present++;
        if (status === "LATE") { summary.late++; summary.present++; summary.lateMinutes += rec?.lateByMinutes ?? 0; }
        if (status === "HALF_DAY") summary.halfDay++;
        if (status === "WFH") { summary.wfh++; summary.present++; }
        if (status === "ON_LEAVE") summary.onLeave++;
        if (status === "ABSENT") summary.absent++;
        if (status === "HOLIDAY") summary.holidays++;
        summary.hours += hours;
        days.push({ date, status, checkIn: rec?.checkIn ?? null, checkOut: rec?.checkOut ?? null, hours, mode: rec?.mode ?? null, lateByMinutes: rec?.lateByMinutes ?? 0, holiday: kind.holiday, leaveType: leave?.leaveType ?? null, halfDayLeave: leave?.halfDay ?? null, workedOnOffDay: !!rec?.workedOnOffDay });
    }
    summary.hours = Math.round(summary.hours * 10) / 10;
    const attended = summary.present + summary.halfDay * 0.5;
    const presentDays = summary.present;
    return {
        days,
        summary: { ...summary, presentDays, attendanceRate: summary.workingDays ? Math.round(((attended + summary.onLeave) / summary.workingDays) * 100) : 100, avgHours: presentDays ? Math.round((summary.hours / (presentDays + summary.halfDay)) * 10) / 10 : 0 },
    };
}

// ─── WFH & attendance-correction decisions (HR or reporting manager) ──

function notifyEmp(employeeId: string, orgId: string, title: string, message: string, link: string) {
    const e = employees.find((x) => x.id === employeeId);
    if (e?.userId) addNotification({ orgId, userId: e.userId, title, message, link });
}

export function decideWfh(me: User, id: string, approve: boolean, note?: string | null): { error?: string; status?: number } {
    const w = wfhRequests.find((x) => x.id === id && x.orgId === me.orgId);
    if (!w) return { error: "WFH request not found", status: 404 };
    if (w.status !== "PENDING") return { error: `Already ${w.status.toLowerCase()}`, status: 409 };
    if (!approve && !String(note ?? "").trim()) return { error: "A reason is required when rejecting", status: 400 };
    w.status = approve ? "APPROVED" : "REJECTED";
    w.reviewedByName = me.name;
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `WFH_${w.status}`, entity: "WfhRecord", entityId: w.id, detail: `${w.employeeName}: ${w.startDate} → ${w.endDate}${note ? ` — ${note}` : ""}` });
    notifyEmp(w.employeeId, me.orgId, `WFH ${w.status.toLowerCase()}`, `WFH ${w.startDate} → ${w.endDate} was ${w.status.toLowerCase()} by ${me.name}${note ? ` — ${note}` : ""}`, "/portal/requests");
    return {};
}

export function decideCorrection(me: User, id: string, approve: boolean, note?: string | null): { error?: string; status?: number } {
    const c = attendanceCorrections.find((x) => x.id === id && x.orgId === me.orgId);
    if (!c) return { error: "Correction not found", status: 404 };
    if (c.status !== "PENDING") return { error: `Already ${c.status.toLowerCase()}`, status: 409 };
    if (!approve && !String(note ?? "").trim()) return { error: "A reason is required when rejecting", status: 400 };
    c.status = approve ? "APPROVED" : "REJECTED";
    c.reviewedByName = me.name;
    if (approve) {
        const emp = employees.find((e) => e.id === c.employeeId);
        const uid = emp?.userId ?? c.employeeId;
        let rec = attendance.find((a) => a.orgId === me.orgId && a.userId === uid && a.date === c.date);
        if (!rec) {
            rec = { id: nextIds.attendance(), orgId: me.orgId, userId: uid, date: c.date, status: "PRESENT", checkIn: null, checkOut: null };
            attendance.push(rec);
        }
        // Requested times are IST wall-clock times
        const at = (t: string) => (t.includes("T") ? t : new Date(`${c.date}T${t.length === 5 ? `${t}:00` : t}+05:30`).toISOString());
        rec.checkIn = at(c.requestedCheckIn);
        rec.checkOut = at(c.requestedCheckOut);
        const shift = shiftFor(emp, me.orgId);
        rec.status = hoursOf(rec) < shift.workingHours / 2 ? "HALF_DAY" : "PRESENT";
        rec.lateByMinutes = 0;
    }
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `ATTENDANCE_CORRECTION_${c.status}`, entity: "AttendanceCorrection", entityId: c.id, detail: `${c.employeeName}: ${c.date}${note ? ` — ${note}` : ""}` });
    notifyEmp(c.employeeId, me.orgId, `Attendance correction ${c.status.toLowerCase()}`, `Your correction for ${c.date} was ${c.status.toLowerCase()} by ${me.name}${note ? ` — ${note}` : ""}`, "/portal/attendance");
    return {};
}

/** Direct reports (HR records) of the signed-in user. */
export function directReports(user: Pick<User, "id">): Employee[] {
    const me = employeeForUser(user.id);
    return employees.filter((e) => e.status !== "EXITED" && ((me && e.reportingManagerId === me.id) || (e.userId && users.find((u) => u.id === e.userId)?.reportingTo === user.id)));
}

// ─── Income tax (projection for TDS, both regimes) ───────────

export function declarationFor(employeeId: string, fy: string): TaxDeclaration | undefined {
    return taxDeclarations.find((d) => d.employeeId === employeeId && d.fy === fy);
}

export function taxProjection(emp: Employee, regime: TaxRegime, d?: Partial<TaxDeclaration> | null) {
    const s = settingsFor(emp.orgId).payroll;
    const sal = emp.salary ?? { basic: 0, hra: 0, allowances: 0 };
    const basic = sal.basic * 12, hra = sal.hra * 12;
    const gross = (sal.basic + sal.hra + sal.allowances) * 12;
    const pf = s.pfEnabled ? Math.round(Math.min(sal.basic, s.pfWageCeiling) * (s.pfRatePct / 100)) * 12 : 0;
    const pt = s.ptState === "MH" ? 2500 : s.ptState === "KA" ? 2400 : 0;
    const lines: { label: string; amount: number }[] = [];
    if (regime === "OLD") {
        const c80 = Math.min(150000, pf + Number(d?.sec80C || 0));
        const hraEx = d?.hraRentPaid ? Math.max(0, Math.min(hra, Number(d.hraRentPaid) - 0.1 * basic, (d.metroCity ? 0.5 : 0.4) * basic)) : 0;
        lines.push({ label: "80C (incl. employee PF)", amount: c80 });
        lines.push({ label: "80D health insurance", amount: Math.min(75000, Number(d?.sec80D || 0)) });
        lines.push({ label: "HRA exemption", amount: Math.round(hraEx) });
        lines.push({ label: "Home loan interest 24(b)", amount: Math.min(200000, Number(d?.homeLoanInterest || 0)) });
        lines.push({ label: "NPS 80CCD(1B)", amount: Math.min(50000, Number(d?.nps80CCD1B || 0)) });
        lines.push({ label: "Other (80E, 80G…)", amount: Math.max(0, Number(d?.otherDeductions || 0)) });
        lines.push({ label: "Professional tax", amount: pt });
    }
    const deductions = lines.reduce((t, l) => t + l.amount, 0);
    const standardDeduction = regime === "NEW" ? 75000 : 50000;
    const tax = annualTax(Math.max(0, gross - deductions), regime);
    return { regime, gross, standardDeduction, deductions, lines: lines.filter((l) => l.amount > 0), taxableIncome: Math.max(0, gross - deductions - standardDeduction), annualTax: tax, monthlyTds: Math.round(tax / 12) };
}

/** Regime + declared deductions used by payroll TDS for a month (null = org default rule). */
export function payrollTaxFor(emp: Employee, month: string): { regime: TaxRegime; monthly: number } | null {
    const d = declarationFor(emp.id, fyOf(`${month}-01`));
    if (!d || !["SUBMITTED", "VERIFIED"].includes(d.status)) return null;
    return { regime: d.regime, monthly: taxProjection(emp, d.regime, d).monthlyTds };
}

// ─── Employee requests (HR decision applies the change) ──────

import type { EmployeeRequest } from "@/lib/types";
import { syncEmployeeToUser } from "./identity";
import { notifyRoles } from "./pipeline";

export const LETTER_TYPES = ["SALARY_CERTIFICATE", "EXPERIENCE_LETTER"];

export function decideEmployeeRequest(me: User, r: EmployeeRequest, status: "APPROVED" | "REJECTED" | "IN_REVIEW", comments?: string | null): { error?: string; status?: number } {
    if (!["PENDING", "IN_REVIEW"].includes(r.status)) return { error: `Already ${r.status.toLowerCase()}`, status: 409 };
    if (status === "REJECTED" && !String(comments ?? "").trim()) return { error: "A reason is required when rejecting", status: 400 };
    const emp = employees.find((e) => e.id === r.employeeId);
    const now = new Date().toISOString();
    if (status === "APPROVED" && emp && r.payload) {
        const p = r.payload;
        if (r.type === "BANK_CHANGE") {
            emp.bankDetails = { ...emp.bankDetails, accountName: p.accountName || emp.bankDetails?.accountName, accountNumber: p.accountNumber, bankName: p.bankName, ifscCode: p.ifscCode };
            notifyRoles(me.orgId, ["FINANCE_ADMIN"], { title: "Employee bank details changed", message: `${emp.name} (${emp.employeeId}) — new account from next payroll`, link: "/finance/payroll" });
        }
        if (r.type === "NAME_CHANGE" && p.name) { emp.name = p.name; syncEmployeeToUser(emp); }
        if (r.type === "ADDRESS_CHANGE") emp.personalDetails = { ...emp.personalDetails, ...(p.currentAddress ? { currentAddress: p.currentAddress } : {}), ...(p.permanentAddress ? { permanentAddress: p.permanentAddress } : {}) };
        emp.updatedAt = now;
    }
    r.status = status;
    r.reviewedAt = now;
    r.reviewedByName = me.name;
    if (comments) r.comments = comments;
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `REQUEST_${status}`, entity: "EmployeeRequest", entityId: r.id, detail: `${r.employeeName}: ${r.type} ${status.toLowerCase()}${r.payload && status === "APPROVED" ? " (change applied)" : ""}${comments ? ` — ${comments}` : ""}` });
    if (emp?.userId) {
        const letter = status === "APPROVED" && LETTER_TYPES.includes(r.type);
        addNotification({
            orgId: me.orgId, userId: emp.userId,
            title: status === "IN_REVIEW" ? "Request in review" : letter ? "Your letter is ready 📄" : `Request ${status.toLowerCase()}`,
            message: `${r.type.replace(/_/g, " ").toLowerCase()} — ${status.replace(/_/g, " ").toLowerCase()}${comments ? `: ${comments}` : ""}`,
            link: letter ? `/portal/letters/${r.id}` : "/portal/requests",
        });
    }
    return {};
}
