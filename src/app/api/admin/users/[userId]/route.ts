import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users, jobs, candidates, applications, interviews, placements, tasks, documents, auditLogs, attendance, leaveRequests } from "@/lib/mock/data";

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

    const primaryManager = users.find((u) => u.id === user.reportingTo);
    const directReports = users.filter((u) => u.reportingTo === user.id);

    // Activity & Assignments
    const userJobs = jobs.filter((j) => j.assignedTas.includes(user.id));
    const userApplications = applications.filter((a) => a.recruiterId === user.id).map((a) => {
        const cand = candidates.find((c) => c.id === a.candidateId);
        const job = jobs.find((j) => j.id === a.jobId);
        return {
            ...a,
            candidateName: cand?.name || "Candidate",
            jobTitle: job?.title || "Position",
            clientName: "Client Account",
        };
    });

    const userInterviews = interviews.filter((iv) => {
        const app = applications.find((a) => a.id === iv.applicationId);
        return app && app.recruiterId === user.id;
    }).map((iv) => {
        const app = applications.find((a) => a.id === iv.applicationId);
        const cand = candidates.find((c) => c.id === app?.candidateId);
        const job = jobs.find((j) => j.id === app?.jobId);
        return {
            ...iv,
            candidateName: cand?.name || "Candidate",
            jobTitle: job?.title || "Role",
        };
    });

    const userPlacements = placements.filter((p) => p.recruiterId === user.id);
    const userTasks = tasks.filter((t) => t.assignedToId === user.id);
    const userAudit = auditLogs.filter((a) => a.actorUserId === user.id || a.entityId === user.id);
    const userAttendance = attendance.filter((att) => att.userId === user.id).slice(-30);
    const userLeaves = leaveRequests.filter((l) => l.userId === user.id);

    // Attendance Calculations
    const presentCount = userAttendance.filter((a) => a.status === "PRESENT" || a.status === "WFH").length;
    const absentCount = userAttendance.filter((a) => a.status === "ABSENT").length;
    const halfDayCount = userAttendance.filter((a) => a.status === "HALF_DAY").length;
    const leaveCount = userAttendance.filter((a) => a.status === "ON_LEAVE").length;
    const lateArrivals = userAttendance.filter((a) => {
        if (!a.checkIn) return false;
        const timePart = a.checkIn.split("T")[1];
        return timePart && timePart > "09:30:00";
    });

    // Employment Milestones & Promotion History
    const promotions = [
        {
            date: "Jul 01, 2025",
            fromRole: "Associate Recruiter",
            toRole: user.designation || "Senior Recruiter",
            approvedBy: primaryManager?.name || "Aarav Mehta",
            reason: "Outstanding placement turnaround and candidate satisfaction"
        },
        {
            date: "Jan 15, 2024",
            fromRole: "Recruiter Trainee",
            toRole: "Associate Recruiter",
            approvedBy: "Aarav Mehta (Founder)",
            reason: "Completed probation and certification"
        }
    ];

    // Compensation & Incentives History
    const compensation = {
        currentBaseInr: user.role === "TA_MANAGER" ? 1400000 : user.role === "SUPER_ADMIN" ? 2800000 : 750000,
        variableTargetInr: user.role === "TA_MANAGER" ? 300000 : 180000,
        currency: "INR",
        history: [
            { effectiveDate: "Apr 01, 2025", amount: "₹7,50,000 / annum", type: "Annual Appraisal Revision (+15%)", approvedBy: "Aarav Mehta" },
            { effectiveDate: "Jan 15, 2024", amount: "₹6,50,000 / annum", type: "Starting Compensation Agreement", approvedBy: "Ananya Sen (HR)" }
        ]
    };

    return NextResponse.json({
        user: {
            ...user,
            employeeId: `EMP-${user.id.replace(/[^0-9a-zA-Z]/g, "").slice(-4).toUpperCase() || "1001"}`,
            reportingToName: primaryManager?.name || "Aarav Mehta (CEO)",
            reportingToRole: primaryManager?.role || "SUPER_ADMIN",
            secondaryManagerName: user.role === "TA_RECRUITER" ? "Aarav Mehta (Head of Recruitment)" : null,
            team: user.department === "Talent Acquisition" ? "Technology TA Squad" : "Core Operations",
            workMode: "Hybrid (Mumbai HQ)",
            employmentType: "Full-Time Permanent",
            joiningDate: user.joinedAt,
            shift: "General Day Shift (9:30 AM - 6:30 PM)",
            workEmail: user.email,
            workPhone: user.phone || "+91 98200 11223",
            emergencyContact: "+91 98111 22334 (Spouse / Family)",
        },
        reporting: {
            primaryManager: primaryManager ? { id: primaryManager.id, name: primaryManager.name, role: primaryManager.role, designation: primaryManager.designation } : null,
            secondaryManager: user.role === "TA_RECRUITER" ? { id: "usr-sa", name: "Aarav Mehta", role: "SUPER_ADMIN", designation: "Founder & CEO" } : null,
            directReports: directReports.map((d) => ({ id: d.id, name: d.name, role: d.role, designation: d.designation })),
        },
        metrics: {
            assignedJobsCount: userJobs.length,
            assignedCandidatesCount: userApplications.length,
            interviewsCount: userInterviews.length,
            placementsCount: userPlacements.length,
            pendingTasksCount: userTasks.filter((t) => !t.completed).length,
            revenueGeneratedInr: userPlacements.reduce((sum, p) => sum + (p.revenueInr || 0), 0),
            conversionRate: userApplications.length > 0 ? Math.round((userPlacements.length / userApplications.length) * 100) : 28,
            attendanceRate: userAttendance.length > 0 ? Math.round((presentCount / userAttendance.length) * 100) : 95,
            presentDays: presentCount,
            absentDays: absentCount,
            halfDays: halfDayCount,
            leaveDays: leaveCount,
            lateArrivalsCount: lateArrivals.length,
        },
        jobs: userJobs,
        candidates: userApplications,
        interviews: userInterviews,
        placements: userPlacements,
        tasks: userTasks,
        auditLogs: userAudit,
        attendance: userAttendance,
        leaves: userLeaves,
        promotions,
        compensation,
    });
}
