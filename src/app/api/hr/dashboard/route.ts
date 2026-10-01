import { NextResponse, NextRequest } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    employees, onboardingRecords, payrollRecords, attendance,
    leaveRequests, applications, documents, exitRecords, jobs,
    performanceReviews, assets, trainingPrograms, interviews,
    todayStr,
} from "@/lib/mock/data";

export async function GET(req: NextRequest) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange") || "today"; // today, week, month, quarter, year
    const selectedDept = searchParams.get("department") || "ALL";
    const selectedLocation = searchParams.get("location") || "ALL";
    const selectedEmpType = searchParams.get("employmentType") || "ALL";
    const selectedStatus = searchParams.get("status") || "ALL";

    let orgEmployees = employees.filter((e) => e.orgId === me.orgId);

    // Apply dashboard filters
    if (selectedDept !== "ALL") {
        orgEmployees = orgEmployees.filter((e) => e.department.toLowerCase() === selectedDept.toLowerCase());
    }
    if (selectedLocation !== "ALL") {
        orgEmployees = orgEmployees.filter((e) => (e.location || "").toLowerCase().includes(selectedLocation.toLowerCase()));
    }
    if (selectedEmpType !== "ALL") {
        orgEmployees = orgEmployees.filter((e) => e.employmentType === selectedEmpType);
    }
    if (selectedStatus !== "ALL") {
        orgEmployees = orgEmployees.filter((e) => e.status === selectedStatus);
    }

    const activeEmps = orgEmployees.filter((e) => e.status === "ACTIVE");
    const onLeaveEmps = orgEmployees.filter((e) => e.status === "ON_LEAVE");
    const noticePeriodEmps = orgEmployees.filter((e) => e.status === "NOTICE_PERIOD");
    const exitedEmps = orgEmployees.filter((e) => e.status === "EXITED");

    // Today's attendance
    const todayAtt = attendance.filter((a) => a.orgId === me.orgId && a.date === todayStr);
    const presentToday = todayAtt.filter((a) => ["PRESENT", "LATE"].includes(a.status)).length;
    const absentToday = todayAtt.filter((a) => a.status === "ABSENT").length;
    const lateToday = todayAtt.filter((a) => a.status === "LATE").length;
    const onLeaveToday = todayAtt.filter((a) => a.status === "ON_LEAVE").length;
    const wfhToday = todayAtt.filter((a) => a.status === "WFH").length;
    const halfDayToday = todayAtt.filter((a) => a.status === "HALF_DAY").length;

    // Attendance Exceptions (late today, missing check-in/out)
    const lateEmployees = todayAtt
        .filter((a) => a.status === "LATE" || (a.checkIn && a.checkIn.includes("T10:")))
        .map((a) => {
            const emp = orgEmployees.find((e) => e.userId === a.userId || e.id === a.userId);
            return {
                id: a.id,
                name: emp?.name || "Staff Member",
                department: emp?.department || "General",
                checkIn: a.checkIn ? a.checkIn.split("T")[1]?.substring(0, 5) : "10:15",
                delayMinutes: 25,
            };
        });

    const missingCheckoutEmployees = todayAtt
        .filter((a) => a.checkIn && !a.checkOut)
        .slice(0, 5)
        .map((a) => {
            const emp = orgEmployees.find((e) => e.userId === a.userId || e.id === a.userId);
            return {
                id: a.id,
                name: emp?.name || "Staff Member",
                department: emp?.department || "Operations",
                checkIn: a.checkIn ? a.checkIn.split("T")[1]?.substring(0, 5) : "09:30",
            };
        });

    // Attendance 7-Day Trend
    const past7Dates = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split("T")[0];
    });

    const attendanceTrend = past7Dates.map((dateStr) => {
        const dayAtt = attendance.filter((a) => a.orgId === me.orgId && a.date === dateStr);
        const dayPresent = dayAtt.filter((a) => ["PRESENT", "LATE"].includes(a.status)).length || Math.floor(Math.random() * 3) + 7;
        const dayLate = dayAtt.filter((a) => a.status === "LATE").length || Math.floor(Math.random() * 2) + 1;
        const dayAbsent = dayAtt.filter((a) => a.status === "ABSENT").length || Math.floor(Math.random() * 2);
        const dayWfh = dayAtt.filter((a) => a.status === "WFH").length || 1;
        return {
            date: dateStr.slice(5), // MM-DD
            present: dayPresent,
            late: dayLate,
            absent: dayAbsent,
            wfh: dayWfh,
        };
    });

    // Pending Requests & Approvals
    const pendingLeaves = leaveRequests.filter((l) => l.orgId === me.orgId && l.status === "PENDING");
    const activeOnboarding = onboardingRecords.filter((o) => o.orgId === me.orgId && o.status !== "COMPLETED" && o.status !== "REJECTED");
    const pendingDocs = documents.filter((d) => d.orgId === me.orgId && d.status === "PENDING");
    const pendingExits = exitRecords.filter((e) => e.orgId === me.orgId && e.status !== "COMPLETED");

    // Upcoming Leave (Next 14 Days)
    const upcomingLeaves = leaveRequests
        .filter((l) => l.orgId === me.orgId)
        .map((l) => {
            const emp = orgEmployees.find((e) => e.userId === l.userId || e.id === l.userId);
            return {
                id: l.id,
                employeeName: emp?.name || "Staff Member",
                department: emp?.department || "Operations",
                leaveType: l.leaveType,
                fromDate: l.fromDate,
                toDate: l.toDate,
                status: l.status,
                reason: l.reason,
            };
        });

    // Current month payroll
    const currentMonth = todayStr.substring(0, 7);
    const currentPayroll = payrollRecords.filter((p) => p.orgId === me.orgId && p.month === currentMonth);
    const payrollPaid = currentPayroll.length > 0 && currentPayroll.every((p) => p.status === "PAID");
    const totalPayrollAmount = currentPayroll.reduce((sum, p) => sum + p.netSalary, 0);
    const grossPayrollAmount = currentPayroll.reduce((sum, p) => sum + (p.basicSalary + p.hra + p.allowances + p.bonuses), 0);
    const totalDeductions = currentPayroll.reduce((sum, p) => sum + (p.deductions + p.tax), 0);

    // Monthly Payroll Trend (Last 4 Months)
    const payrollTrend = [
        { month: "Jun 2026", gross: 910000, net: 780000, employees: 9 },
        { month: "Jul 2026", gross: 940000, net: 805000, employees: 9 },
        { month: "Aug 2026", gross: 980000, net: 840000, employees: 10 },
        { month: "Sep 2026", gross: grossPayrollAmount || 1020000, net: totalPayrollAmount || 875000, employees: activeEmps.length },
    ];

    // Department breakdown
    const deptMap: Record<string, { total: number; active: number }> = {};
    orgEmployees.forEach((e) => {
        if (!deptMap[e.department]) deptMap[e.department] = { total: 0, active: 0 };
        deptMap[e.department].total += 1;
        if (e.status === "ACTIVE") deptMap[e.department].active += 1;
    });
    const departmentBreakdown = Object.entries(deptMap).map(([dept, counts]) => ({
        name: dept,
        count: counts.total,
        active: counts.active,
        growth: "+1",
    }));

    // Location breakdown
    const locMap: Record<string, number> = {};
    orgEmployees.forEach((e) => {
        const loc = e.location || "Mumbai";
        locMap[loc] = (locMap[loc] || 0) + 1;
    });
    const locationBreakdown = Object.entries(locMap).map(([location, count]) => ({
        name: location,
        count,
        present: Math.max(1, count - 1),
    }));

    // Work Mode breakdown
    const workModeBreakdown = [
        { name: "Office", count: orgEmployees.filter((e) => (e.workMode || "OFFICE") === "OFFICE").length },
        { name: "Hybrid", count: orgEmployees.filter((e) => e.workMode === "HYBRID").length },
        { name: "Remote", count: orgEmployees.filter((e) => e.workMode === "REMOTE").length },
    ];

    // Recruitment → HR Pipeline counts
    const orgApps = applications.filter((a) => a.orgId === me.orgId);
    const orgJobs = jobs.filter((j) => j.orgId === me.orgId);
    const pipeline = {
        selected: orgApps.filter((a) => a.stage === "HR_ROUND").length,
        offerReleased: orgApps.filter((a) => a.stage === "OFFER_SENT").length,
        offerAccepted: orgApps.filter((a) => a.stage === "OFFER_ACCEPTED").length,
        onboarding: activeOnboarding.length,
        joined: orgApps.filter((a) => a.stage === "JOINED").length,
        openPositions: orgJobs.reduce((sum, j) => sum + (j.openings - j.filled), 0),
        interviewsToday: interviews.filter((i) => i.scheduledAt?.startsWith(todayStr)).length,
    };

    // Needs Your Attention / Action Center (Prioritized)
    const needsAttention = [
        ...(absentToday > 0 ? [{
            id: "att-absent-alert",
            type: "CRITICAL",
            category: "Attendance",
            title: `${absentToday} Unapproved Absences Today`,
            description: "Employees marked absent without approved leave application.",
            link: "/hr/attendance",
            cta: "Review Attendance",
        }] : []),
        ...pendingLeaves.map((l) => ({
            id: `leave-${l.id}`,
            type: "HIGH",
            category: "Leave",
            title: `Leave Approval: ${orgEmployees.find((e) => e.userId === l.userId || e.id === l.userId)?.name || "Employee"}`,
            description: `${l.leaveType} (${l.fromDate} to ${l.toDate}) — ${l.reason}`,
            link: "/hr/leave",
            cta: "Approve / Reject",
        })),
        ...activeOnboarding.map((o) => ({
            id: `onb-${o.id}`,
            type: o.progressPercent < 40 ? "HIGH" : "MEDIUM",
            category: "Onboarding",
            title: `Onboarding Pending: ${o.candidateName}`,
            description: `${o.position} (${o.department}) — ${o.progressPercent}% checklist completed`,
            link: "/hr/onboarding",
            cta: "Complete Formalities",
        })),
        ...pendingDocs.map((d) => ({
            id: `doc-${d.id}`,
            type: "MEDIUM",
            category: "Documents",
            title: `Document Verification: ${d.title}`,
            description: `${d.employeeName || "Employee"} · ${d.category} awaiting HR review`,
            link: "/hr/documents",
            cta: "Verify File",
        })),
        ...pendingExits.map((ex) => ({
            id: `exit-${ex.id}`,
            type: "HIGH",
            category: "Exit",
            title: `Resignation Clearance: ${ex.employeeName}`,
            description: `LWD: ${ex.lastWorkingDay} · Clearance checklist pending`,
            link: "/hr/exit",
            cta: "Process Exit",
        })),
    ];

    // Probation tracker
    const onProbationEmployees = orgEmployees
        .filter((e) => e.probationStatus === "ON_PROBATION")
        .map((e) => ({
            id: e.id,
            name: e.name,
            department: e.department,
            designation: e.designation,
            joiningDate: e.joiningDate,
            probationEndDate: e.probationEndDate || "In 30 Days",
            status: "Review Due",
        }));

    // Upcoming People Events (Birthdays, Anniversaries, Joinings)
    const upcomingEvents = [
        { id: "ev-1", type: "ANNIVERSARY", name: "Aarav Mehta", title: "2nd Work Anniversary", date: "Tomorrow", department: "Leadership" },
        { id: "ev-2", type: "JOINING", name: "Rohan Verma", title: "First 15-day Check-in", date: "In 3 Days", department: "Engineering" },
        { id: "ev-3", type: "BIRTHDAY", name: "Ananya Sen", title: "Birthday Celebration", date: "This Friday", department: "Human Resources" },
        { id: "ev-4", type: "PROBATION", name: "Sneha Patil", title: "Probation Evaluation End", date: "In 15 Days", department: "Field" },
    ];

    // Data Quality Health Indicators
    const missingDocsCount = orgEmployees.filter((e) => !e.bankDetails?.panNumber || !e.emergencyContact?.phone).length;
    const dataQuality = {
        score: Math.round(((orgEmployees.length - missingDocsCount) / orgEmployees.length) * 100),
        missingBankDetails: orgEmployees.filter((e) => !e.bankDetails?.accountNumber).length,
        missingEmergencyContact: orgEmployees.filter((e) => !e.emergencyContact?.phone).length,
        unassignedManager: orgEmployees.filter((e) => !e.reportingManagerId && e.designation !== "Founder & CEO").length,
    };

    // HR Operations Health Scorecard
    const hrHealth = [
        { metric: "Daily Attendance", status: absentToday <= 1 ? "HEALTHY" : "ATTENTION", value: `${Math.round((presentToday / Math.max(1, activeEmps.length)) * 100)}% Present` },
        { metric: "Leave SLA", status: pendingLeaves.length <= 2 ? "HEALTHY" : "ATTENTION", value: `${pendingLeaves.length} Pending` },
        { metric: "Payroll Readiness", status: payrollPaid ? "HEALTHY" : "HEALTHY", value: currentPayroll.length > 0 ? "Processed" : "Draft" },
        { metric: "Onboarding Flow", status: activeOnboarding.length <= 3 ? "HEALTHY" : "ATTENTION", value: `${activeOnboarding.length} Active` },
        { metric: "Document Verification", status: pendingDocs.length === 0 ? "HEALTHY" : "ATTENTION", value: `${pendingDocs.length} To Verify` },
        { metric: "Exit & Clearances", status: pendingExits.length <= 1 ? "HEALTHY" : "CRITICAL", value: `${pendingExits.length} On Notice` },
    ];

    return NextResponse.json({
        kpis: {
            totalEmployees: orgEmployees.length,
            activeEmployees: activeEmps.length,
            onLeaveEmployees: onLeaveEmps.length,
            noticePeriodEmployees: noticePeriodEmps.length,
            exitedEmployees: exitedEmps.length,
            newJoiners: orgEmployees.filter((e) => {
                const diff = (Date.now() - new Date(e.joiningDate).getTime()) / (1000 * 60 * 60 * 24);
                return diff <= 60;
            }).length,
            employeesOnLeave: onLeaveToday,
            presentToday,
            absentToday,
            lateToday,
            wfhToday,
            halfDayToday,
            presenceRate: Math.round((presentToday / Math.max(1, activeEmps.length)) * 100),
            pendingLeaveRequests: pendingLeaves.length,
            pendingOnboarding: activeOnboarding.length,
            pendingTotalApprovals: pendingLeaves.length + pendingDocs.length + pendingExits.length,
            payrollStatus: payrollPaid ? "Paid" : currentPayroll.length > 0 ? "Processed" : "Draft",
            totalPayrollAmount,
            grossPayrollAmount,
            totalDeductions,
        },
        attendanceToday: {
            present: presentToday,
            absent: absentToday,
            late: lateToday,
            onLeave: onLeaveToday,
            wfh: wfhToday,
            halfDay: halfDayToday,
        },
        attendanceTrend,
        lateEmployees,
        missingCheckoutEmployees,
        departmentBreakdown,
        locationBreakdown,
        workModeBreakdown,
        pipeline,
        payrollTrend,
        needsAttention,
        upcomingLeaves,
        onProbationEmployees,
        upcomingEvents,
        dataQuality,
        hrHealth,
        recentEmployees: orgEmployees.slice(-5).reverse(),
        allEmployeesQuickList: orgEmployees.map((e) => ({
            id: e.id,
            employeeId: e.employeeId,
            name: e.name,
            email: e.email,
            phone: e.phone,
            department: e.department,
            designation: e.designation,
            reportingManagerName: e.reportingManagerName || "Founder & CEO",
            joiningDate: e.joiningDate,
            employmentType: e.employmentType,
            status: e.status,
            workMode: e.workMode || "OFFICE",
            location: e.location || "Mumbai",
            netSalary: e.salary?.netMonthly || 0,
        })),
    });
}
