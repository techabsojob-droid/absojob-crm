import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    employees, attendance, payrollRecords,
    exitRecords, jobs, candidates, applications, interviews
} from "@/lib/mock/data";
import { pipelineMetrics } from "@/lib/metrics";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORTLISTED = ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"];
const OFFERED = ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"];

const tally = <T,>(list: T[], key: (x: T) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const x of list) { const k = key(x) || "Not set"; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, percent: list.length ? Math.round((count / list.length) * 100) : 0 }));
};

// GET /api/hr/analytics — everything on HR › Reports, computed from live records
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const orgEmps = employees.filter((e) => e.orgId === me.orgId && e.status === "ACTIVE");
    const totalHeadcount = orgEmps.length;

    // Attendance: overall rate and a per-weekday view of the last 14 days
    const orgAttendance = attendance.filter((a) => a.orgId === me.orgId);
    const presentLike = (s: string) => s === "PRESENT" || s === "WFH" || s === "LATE" || s === "HALF_DAY";
    const attPct = orgAttendance.length ? Math.round((orgAttendance.filter((a) => presentLike(a.status)).length / orgAttendance.length) * 100) : null;
    const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const recent = orgAttendance.filter((a) => a.date >= since);
    const attendanceTrend = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => {
        const rows = recent.filter((a) => WEEKDAYS[new Date(`${a.date}T00:00:00`).getDay()] === day);
        return {
            day,
            rate: rows.length ? Math.round((rows.filter((a) => presentLike(a.status)).length / rows.length) * 100) : null,
            late: rows.filter((a) => a.status === "LATE").length,
            wfh: rows.filter((a) => a.status === "WFH" || a.mode === "WFH").length,
        };
    });

    // Payroll: latest processed month
    const orgPayrollAll = payrollRecords.filter((p) => p.orgId === me.orgId);
    const payrollMonth = [...new Set(orgPayrollAll.map((p) => p.month))].sort().at(-1) ?? null;
    const orgPayroll = orgPayrollAll.filter((p) => p.month === payrollMonth);
    const totalPayrollNet = orgPayroll.reduce((acc, p) => acc + (p.netSalary || 0), 0);
    const avgSalary = orgPayroll.length ? Math.round(totalPayrollNet / orgPayroll.length) : 0;
    const payrollByDept = tally(orgPayroll, (p) => p.department).map(({ name, count }) => ({
        dept: name,
        headcount: count,
        amount: orgPayroll.filter((p) => (p.department || "Not set") === name).reduce((s, p) => s + (p.netSalary || 0), 0),
    })).sort((a, b) => b.amount - a.amount);

    // Recruitment
    const orgJobs = jobs.filter((j) => j.orgId === me.orgId);
    const openJobs = orgJobs.filter((j) => !["CLOSED", "FULFILLED", "CANCELLED"].includes(j.status)).length;
    const totalCands = candidates.filter((c) => c.orgId === me.orgId).length;
    const orgApps = applications.filter((a) => a.orgId === me.orgId);
    const interviewed = new Set(interviews.map((i) => i.applicationId));
    const joinedCount = orgApps.filter((a) => a.stage === "JOINED").length;
    const recruitment = pipelineMetrics(orgApps, interviews, candidates);

    // Attrition
    const orgExits = exitRecords.filter((e) => e.orgId === me.orgId);
    const totalExits = orgExits.length;
    const attritionRate = totalHeadcount + totalExits > 0 ? ((totalExits / (totalHeadcount + totalExits)) * 100).toFixed(1) : "0.0";

    return NextResponse.json({
        overview: {
            headcount: totalHeadcount,
            attendanceRate: attPct != null ? `${attPct}%` : "—",
            monthlyPayroll: totalPayrollNet,
            payrollMonth,
            averageSalary: avgSalary,
            openPositions: openJobs,
            totalCandidates: totalCands,
            hiresJoined: joinedCount,
            totalExits,
            attritionRate: `${attritionRate}%`,
        },
        departments: tally(orgEmps, (e) => e.department),
        workforce: {
            employmentType: tally(orgEmps, (e) => e.employmentType.replaceAll("_", " ").toLowerCase()),
            probation: orgEmps.filter((e) => e.probationStatus === "ON_PROBATION" || e.probationStatus === "EXTENDED").length,
            locations: tally(orgEmps, (e) => e.location),
            gender: tally(orgEmps, (e) => e.gender ? e.gender.replaceAll("_", " ").toLowerCase() : null),
            workMode: tally(orgEmps, (e) => e.workMode?.toLowerCase()),
        },
        attendanceTrend,
        payrollByDept,
        recruitmentFunnel: [
            { stage: "In Pipeline", count: orgApps.length },
            { stage: "Shortlisted", count: orgApps.filter((a) => SHORTLISTED.includes(a.stage)).length },
            { stage: "Interviews", count: orgApps.filter((a) => interviewed.has(a.id)).length },
            { stage: "Offers Made", count: orgApps.filter((a) => OFFERED.includes(a.stage)).length },
            { stage: "Joined", count: joinedCount },
        ],
        recruitment: {
            avgTimeToHireDays: recruitment.avgTimeToHireDays,
            offerAcceptancePct: recruitment.offerAcceptancePct,
            offersReleased: recruitment.offersReleased,
            topSource: recruitment.sourcing[0] ?? null,
            secondSource: recruitment.sourcing[1] ?? null,
        },
        attritionReasons: tally(orgExits, (x) => x.reason).map(({ name, count, percent }) => ({ reason: name, count, percent })),
    });
}
