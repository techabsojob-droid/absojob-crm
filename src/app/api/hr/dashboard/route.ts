import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    employees, onboardingRecords, payrollRecords, attendance,
    leaveRequests, applications, documents, exitRecords, todayStr,
} from "@/lib/mock/data";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const orgEmployees = employees.filter((e) => e.orgId === me.orgId);
    const activeEmps = orgEmployees.filter((e) => e.status === "ACTIVE");

    // Today's attendance
    const todayAtt = attendance.filter((a) => a.orgId === me.orgId && a.date === todayStr);
    const presentToday = todayAtt.filter((a) => ["PRESENT", "LATE"].includes(a.status)).length;
    const absentToday = todayAtt.filter((a) => a.status === "ABSENT").length;
    const lateToday = todayAtt.filter((a) => a.status === "LATE").length;
    const onLeaveToday = todayAtt.filter((a) => a.status === "ON_LEAVE").length;
    const wfhToday = todayAtt.filter((a) => a.status === "WFH").length;

    // Pending
    const pendingLeaves = leaveRequests.filter((l) => l.orgId === me.orgId && l.status === "PENDING");
    const activeOnboarding = onboardingRecords.filter((o) => o.orgId === me.orgId && o.status !== "COMPLETED" && o.status !== "REJECTED");
    const pendingDocs = documents.filter((d) => d.orgId === me.orgId && d.status === "PENDING");
    const pendingExits = exitRecords.filter((e) => e.orgId === me.orgId && e.status !== "COMPLETED");

    // Current month payroll
    const currentMonth = todayStr.substring(0, 7);
    const currentPayroll = payrollRecords.filter((p) => p.orgId === me.orgId && p.month === currentMonth);
    const payrollPaid = currentPayroll.length > 0 && currentPayroll.every((p) => p.status === "PAID");
    const totalPayrollAmount = currentPayroll.reduce((sum, p) => sum + p.netSalary, 0);

    // Department breakdown
    const deptMap: Record<string, number> = {};
    orgEmployees.forEach((e) => {
        deptMap[e.department] = (deptMap[e.department] || 0) + 1;
    });
    const departmentBreakdown = Object.entries(deptMap).map(([dept, count]) => ({
        name: dept,
        count,
    }));

    // Gender breakdown
    const genderMap: Record<string, number> = { Male: 0, Female: 0, Other: 0 };
    orgEmployees.forEach((e) => {
        if (e.gender === "MALE") genderMap["Male"]++;
        else if (e.gender === "FEMALE") genderMap["Female"]++;
        else genderMap["Other"]++;
    });
    const genderBreakdown = Object.entries(genderMap).map(([gender, count]) => ({
        name: gender,
        count,
    }));

    // Recruitment → HR Pipeline counts
    const orgApps = applications.filter((a) => a.orgId === me.orgId);
    const pipeline = {
        selected: orgApps.filter((a) => a.stage === "HR_ROUND").length,
        offerReleased: orgApps.filter((a) => a.stage === "OFFER_SENT").length,
        offerAccepted: orgApps.filter((a) => a.stage === "OFFER_ACCEPTED").length,
        onboarding: activeOnboarding.length,
        joined: orgApps.filter((a) => a.stage === "JOINED").length,
    };

    // Pending Action Items for HR
    const pendingActions = [
        ...pendingLeaves.map((l) => ({
            id: l.id,
            type: "LEAVE_APPROVAL",
            title: `Leave request from ${orgEmployees.find((e) => e.userId === l.userId)?.name || "Employee"}`,
            subtitle: `${l.leaveType} (${l.fromDate} to ${l.toDate}) — ${l.reason}`,
            link: "/hr/leave",
            priority: "HIGH",
        })),
        ...activeOnboarding.map((o) => ({
            id: o.id,
            type: "ONBOARDING_TASK",
            title: `Onboarding: ${o.candidateName}`,
            subtitle: `${o.position} (${o.department}) — ${o.progressPercent}% completed`,
            link: "/hr/onboarding",
            priority: o.progressPercent < 30 ? "HIGH" : "MEDIUM",
        })),
        ...pendingDocs.map((d) => ({
            id: d.id,
            type: "DOCUMENT_VERIFICATION",
            title: `Verify ${d.title}`,
            subtitle: `${d.employeeName || "Employee"} · ${d.category}`,
            link: "/hr/documents",
            priority: "MEDIUM",
        })),
        ...pendingExits.map((ex) => ({
            id: ex.id,
            type: "EXIT_CLEARANCE",
            title: `Resignation Clearance: ${ex.employeeName}`,
            subtitle: `Last Working Day: ${ex.lastWorkingDay} · Status: ${ex.status}`,
            link: "/hr/exit",
            priority: "HIGH",
        })),
    ];

    return NextResponse.json({
        kpis: {
            totalEmployees: orgEmployees.length,
            activeEmployees: activeEmps.length,
            newJoiners: orgEmployees.filter((e) => {
                const diff = (Date.now() - new Date(e.joiningDate).getTime()) / (1000 * 60 * 60 * 24);
                return diff <= 60;
            }).length,
            employeesOnLeave: onLeaveToday,
            presentToday,
            absentToday,
            lateToday,
            wfhToday,
            pendingLeaveRequests: pendingLeaves.length,
            pendingOnboarding: activeOnboarding.length,
            payrollStatus: payrollPaid ? "Paid" : currentPayroll.length > 0 ? "Processed" : "Draft",
            totalPayrollAmount,
        },
        attendanceToday: {
            present: presentToday,
            absent: absentToday,
            late: lateToday,
            onLeave: onLeaveToday,
            wfh: wfhToday,
        },
        departmentBreakdown,
        genderBreakdown,
        pipeline,
        pendingActions,
        recentEmployees: orgEmployees.slice(-5).reverse(),
    });
}
