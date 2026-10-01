import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    employees, attendance, leaveRequests, payrollRecords,
    exitRecords, jobs, candidates, applications
} from "@/lib/mock/data";

// GET /api/hr/analytics
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const orgEmps = employees.filter((e) => e.orgId === me.orgId && e.status === "ACTIVE");
    const totalHeadcount = orgEmps.length;

    // 1. Department Breakdown
    const deptDistribution: Record<string, number> = {};
    orgEmps.forEach((e) => {
        deptDistribution[e.department] = (deptDistribution[e.department] || 0) + 1;
    });

    // 2. Attendance Metrics
    const orgAttendance = attendance.filter((a) => a.orgId === me.orgId);
    const presentCount = orgAttendance.filter((a) => a.status === "PRESENT" || a.status === "WFH").length;
    const lateCount = orgAttendance.filter((a) => a.status === "LATE").length;
    const wfhCount = orgAttendance.filter((a) => a.status === "WFH").length;
    const attPct = orgAttendance.length > 0 ? Math.round((presentCount / orgAttendance.length) * 100) : 94;

    // 3. Payroll Metrics
    const orgPayroll = payrollRecords.filter((p) => p.orgId === me.orgId && p.month === "2026-09");
    const totalPayrollNet = orgPayroll.reduce((acc, p) => acc + (p.netSalary || 0), 0);
    const avgSalary = orgPayroll.length > 0 ? Math.round(totalPayrollNet / orgPayroll.length) : 85000;

    // 4. Recruitment Funnel
    const orgJobs = jobs.filter((j) => j.orgId === me.orgId);
    const openJobs = orgJobs.filter((j) => !["CLOSED", "FULFILLED", "CANCELLED"].includes(j.status)).length;
    const totalCands = candidates.filter((c) => c.orgId === me.orgId).length;
    const joinedCount = applications.filter((a) => a.orgId === me.orgId && a.stage === "JOINED").length;

    // 5. Attrition Metrics
    const orgExits = exitRecords.filter((e) => e.orgId === me.orgId);
    const totalExits = orgExits.length;
    const attritionRate = totalHeadcount > 0 ? ((totalExits / (totalHeadcount + totalExits)) * 100).toFixed(1) : "0.0";

    return NextResponse.json({
        overview: {
            headcount: totalHeadcount,
            attendanceRate: `${attPct}%`,
            monthlyPayroll: totalPayrollNet,
            averageSalary: avgSalary,
            openPositions: openJobs,
            totalCandidates: totalCands,
            hiresJoined: joinedCount,
            totalExits,
            attritionRate: `${attritionRate}%`,
        },
        departments: Object.entries(deptDistribution).map(([dept, count]) => ({
            name: dept,
            count,
            percent: Math.round((count / Math.max(1, totalHeadcount)) * 100),
        })),
        attendanceTrend: [
            { day: "Mon", rate: 96, late: 2, wfh: 4 },
            { day: "Tue", rate: 94, late: 4, wfh: 3 },
            { day: "Wed", rate: 98, late: 1, wfh: 5 },
            { day: "Thu", rate: 92, late: 5, wfh: 4 },
            { day: "Fri", rate: 90, late: 3, wfh: 12 },
        ],
        payrollByDept: [
            { dept: "Engineering", amount: 4850000, headcount: 18 },
            { dept: "Talent Acquisition", amount: 3200000, headcount: 14 },
            { dept: "Human Resources", amount: 1650000, headcount: 6 },
            { dept: "Operations", amount: 1400000, headcount: 8 },
            { dept: "Sales & Growth", amount: 2100000, headcount: 6 },
        ],
        recruitmentFunnel: [
            { stage: "Sourced Candidates", count: totalCands },
            { stage: "Shortlisted", count: Math.round(totalCands * 0.6) },
            { stage: "Interviews", count: Math.round(totalCands * 0.3) },
            { stage: "Offers Made", count: Math.round(totalCands * 0.12) },
            { stage: "Joined", count: joinedCount },
        ],
        attritionReasons: [
            { reason: "Higher Compensation Opportunity", count: 3, percent: 50 },
            { reason: "Higher Education / Relocation", count: 2, percent: 33 },
            { reason: "Career Path Diversification", count: 1, percent: 17 },
        ],
    });
}
