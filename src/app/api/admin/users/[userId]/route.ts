import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    users, jobs, candidates, clients, applications, interviews, placements, tasks, auditLogs, attendance, leaveRequests,
    promotions, salaryRevisions, shifts,
} from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { fyRevenue, pipelineMetrics } from "@/lib/metrics";
import { statusOf } from "@/lib/tasks";

const WORK_MODE = { OFFICE: "Office", HYBRID: "Hybrid", REMOTE: "Remote" } as const;
const EMPLOYMENT = { FULL_TIME: "Full-Time Permanent", PART_TIME: "Part-Time", CONTRACT: "Contract", INTERN: "Intern" } as Record<string, string>;
const fmtDay = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const perAnnum = (inr: number) => `₹${Math.round(inr).toLocaleString("en-IN")} / annum`;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { userId } = await params;

    const user = users.find((u) => u.id === userId && u.orgId === me.orgId);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const emp = employeeForUser(user.id);
    const canSeePay = ["SUPER_ADMIN", "HR_ADMIN"].includes(me.role) || me.id === user.id;

    const primaryManager = users.find((u) => u.id === user.reportingTo);
    const directReports = users.filter((u) => u.reportingTo === user.id);

    // Activity & Assignments
    const userJobs = jobs.filter((j) => j.assignedTas.includes(user.id));
    const myApps = applications.filter((a) => a.recruiterId === user.id);
    const userApplications = myApps.map((a) => {
        const cand = candidates.find((c) => c.id === a.candidateId);
        const job = jobs.find((j) => j.id === a.jobId);
        return {
            ...a,
            candidateName: cand?.name || "Candidate",
            jobTitle: job?.title || "Position",
            clientName: clients.find((c) => c.id === job?.clientId)?.companyName ?? "—",
        };
    });

    const userInterviews = interviews.filter((iv) => myApps.some((a) => a.id === iv.applicationId)).map((iv) => {
        const app = myApps.find((a) => a.id === iv.applicationId);
        const cand = candidates.find((c) => c.id === app?.candidateId);
        const job = jobs.find((j) => j.id === app?.jobId);
        return { ...iv, candidateName: cand?.name || "Candidate", jobTitle: job?.title || "Role" };
    });

    const userPlacements = placements.filter((p) => p.recruiterId === user.id);
    const userTasks = tasks.filter((t) => t.assignedToId === user.id);
    const userAudit = auditLogs.filter((a) => a.actorUserId === user.id || a.entityId === user.id);
    const userAttendance = attendance.filter((att) => att.userId === user.id).slice(-30);
    const userLeaves = leaveRequests.filter((l) => l.userId === user.id);
    const pipeline = pipelineMetrics(myApps, interviews, candidates);
    const billing = fyRevenue(userPlacements);

    // Attendance
    const presentCount = userAttendance.filter((a) => a.status === "PRESENT" || a.status === "WFH" || a.status === "LATE").length;
    const absentCount = userAttendance.filter((a) => a.status === "ABSENT").length;
    const halfDayCount = userAttendance.filter((a) => a.status === "HALF_DAY").length;
    const leaveCount = userAttendance.filter((a) => a.status === "ON_LEAVE").length;
    const lateArrivals = userAttendance.filter((a) => a.status === "LATE" || (a.lateByMinutes ?? 0) > 0);

    // Role history from HR records (promotions + transfers live in HR › Lifecycle)
    const empPromotions = emp ? promotions.filter((p) => p.employeeId === emp.id && ["APPROVED", "APPLIED"].includes(p.status)) : [];
    const promotionHistory = empPromotions
        .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
        .map((p) => ({ date: fmtDay(p.effectiveDate), fromRole: p.currentDesignation, toRole: p.newDesignation, approvedBy: p.approvedByName ?? p.requestedByName, reason: p.reason }));
    if (emp) promotionHistory.push({ date: fmtDay(emp.joiningDate), fromRole: "—", toRole: empPromotions.at(-1)?.currentDesignation ?? emp.designation, approvedBy: "HR", reason: "Joined the organisation" });

    // Compensation from the HR salary record and approved revisions
    const revisions = emp ? salaryRevisions.filter((r) => r.employeeId === emp.id && ["APPROVED", "PROCESSED"].includes(r.status)).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)) : [];
    const ctc = emp?.salary?.annualCtc ?? 0;
    const compensation = canSeePay ? {
        currentBaseInr: ctc,
        monthlyNetInr: emp?.salary?.netMonthly ?? 0,
        variableTargetInr: null,
        realizedIncentiveInr: null,
        currency: "INR",
        history: [
            ...revisions.map((r) => ({ effectiveDate: fmtDay(r.effectiveDate), amount: perAnnum(r.newCtc), type: `${r.revisionType.replaceAll("_", " ").toLowerCase()} (+${r.incrementPercent}%)`, approvedBy: r.requestedByName })),
            ...(emp ? [{ effectiveDate: fmtDay(emp.joiningDate), amount: perAnnum(revisions.at(-1)?.currentCtc ?? ctc), type: "Joining compensation", approvedBy: "HR" }] : []),
        ],
    } : null;

    const shift = emp?.shiftId ? shifts.find((s) => s.id === emp.shiftId) : shifts.find((s) => s.orgId === user.orgId && s.status === "ACTIVE");
    const employeeCode = emp?.employeeId ?? null;

    return NextResponse.json({
        user: {
            ...user,
            passwordHash: undefined,
            employeeId: employeeCode,
            reportingToName: primaryManager?.name ?? null,
            reportingToRole: primaryManager?.role ?? null,
            secondaryManagerName: null,
            team: user.department ?? emp?.department ?? null,
            workMode: emp?.workMode ? `${WORK_MODE[emp.workMode]}${emp.location ? ` (${emp.location})` : ""}` : null,
            employmentType: emp ? EMPLOYMENT[emp.employmentType] ?? emp.employmentType : null,
            joiningDate: emp?.joiningDate ?? user.joinedAt,
            probationStatus: emp?.probationStatus ?? null,
            probationEndDate: emp?.probationEndDate ?? null,
            shift: shift ? `${shift.name} (${shift.startTime} – ${shift.endTime})` : null,
            workEmail: user.email,
            workPhone: user.phone || null,
            emergencyContact: emp?.emergencyContact?.phone ? `${emp.emergencyContact.phone}${emp.emergencyContact.name ? ` (${emp.emergencyContact.name}${emp.emergencyContact.relationship ? `, ${emp.emergencyContact.relationship}` : ""})` : ""}` : null,
        },
        reporting: {
            primaryManager: primaryManager ? { id: primaryManager.id, name: primaryManager.name, role: primaryManager.role, designation: primaryManager.designation } : null,
            secondaryManager: null,
            directReports: directReports.map((d) => ({ id: d.id, name: d.name, role: d.role, designation: d.designation })),
        },
        metrics: {
            assignedJobsCount: userJobs.length,
            assignedCandidatesCount: userApplications.length,
            interviewsCount: userInterviews.length,
            placementsCount: userPlacements.length,
            pendingTasksCount: userTasks.filter((t) => statusOf(t) !== "DONE").length,
            revenueGeneratedInr: userPlacements.reduce((sum, p) => sum + (p.revenueInr || 0), 0),
            conversionRate: pipeline.conversionPct ?? 0,
            attendanceRate: userAttendance.length > 0 ? Math.round((presentCount / userAttendance.length) * 100) : null,
            presentDays: presentCount,
            absentDays: absentCount,
            halfDays: halfDayCount,
            leaveDays: leaveCount,
            lateArrivalsCount: lateArrivals.length,
            billingContributionInr: billing.amount,
            billingPeriod: billing.label,
        },
        pipeline,
        employeeRecord: emp ? { id: emp.id, code: emp.employeeId, department: emp.department, designation: emp.designation } : null,
        jobs: userJobs,
        candidates: userApplications,
        interviews: userInterviews,
        placements: userPlacements,
        tasks: userTasks,
        auditLogs: userAudit,
        attendance: userAttendance,
        leaves: userLeaves,
        promotions: promotionHistory,
        compensation,
    });
}
