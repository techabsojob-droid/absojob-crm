import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/mock/server";
import {
    jobs, clients, candidates, applications, interviews,
    referrals, commissionLedger, attendance, tasks, announcements,
    todayStr, ACTIVE_STAGES, userById, hoursWorkedOf,
} from "@/lib/mock/data";
import type { UserRole } from "@/lib/types";

const AUDIENCE_BY_ROLE: Record<UserRole, "ALL" | "TA" | "AGENTS" | "EMPLOYEES"> = {
    SUPER_ADMIN: "ALL",
    TA_MANAGER: "TA",
    TA_RECRUITER: "TA",
    AGENT: "AGENTS",
    EMPLOYEE: "EMPLOYEES",
};

export async function GET() {
    const me = await getSessionUser();
    if (!me || me.status !== "ACTIVE") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Referral / earnings stats (uniform shape for every role) ───
    const myRefs = referrals
        .filter((r) => r.orgId === me.orgId && r.agentId === me.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const placedRefs = myRefs.filter((r) => r.status === "HIRED");
    const inPipelineRefs = myRefs.filter((r) => !["HIRED", "REJECTED"].includes(r.status));

    const myCredits = commissionLedger.filter(
        (l) => l.userId === me.id && l.type === "REFERRAL_INCENTIVE"
    );
    const totalEarned = myCredits
        .filter((l) => ["PAID", "APPROVED"].includes(l.status))
        .reduce((s, l) => s + Math.abs(l.amountInr), 0);
    const pendingPayoutTotal = myCredits
        .filter((l) => ["APPROVED", "PENDING"].includes(l.status))
        .reduce((s, l) => s + Math.abs(l.amountInr), 0);

    // ─── Attendance today ───
    const todayAtt = attendance.find((a) => a.userId === me.id && a.date === todayStr) ?? null;

    // ─── Pending tasks ───
    const myTasks = tasks
        .filter((t) => t.assignedToId === me.id && !t.completed)
        .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
        .slice(0, 5)
        .map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            createdByName: userById(t.createdById)?.name ?? "—",
            dueDate: t.dueDate ?? null,
        }));

    // ─── Recent referrals (enriched) ───
    const myReferrals = myRefs.slice(0, 5).map((r) => ({
        id: r.id,
        candidateName: candidates.find((c) => c.id === r.candidateId)?.name ?? "—",
        jobTitle: r.jobId ? (jobs.find((j) => j.id === r.jobId)?.title ?? null) : null,
        referredAt: r.createdAt,
        status: r.status,
        payoutAmount: r.incentivePaid ? r.incentiveAmount : null,
    }));

    // ─── Announcements visible to my role ───
    const aud = AUDIENCE_BY_ROLE[me.role];
    const visibleAnnouncements = announcements
        .filter((a) => a.orgId === me.orgId && (a.audience.includes("ALL") || a.audience.includes(aud)))
        .sort((a, b) =>
            Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt))
        .map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            pinned: a.pinned,
            priority: a.pinned ? "HIGH" : "MEDIUM",
            createdAt: a.createdAt,
        }));

    // ─── Openings relevant to referrals + upcoming interviews for referred candidates ───
    const activeOpenings = jobs
        .filter((j) => j.orgId === me.orgId && ["APPROVED", "SOURCING", "INTERVIEWING"].includes(j.status))
        .slice(0, 6)
        .map((j) => ({
            id: j.id,
            title: j.title,
            clientName: clients.find((c) => c.id === j.clientId)?.companyName ?? "—",
            location: j.location,
            openingsLeft: j.openings - j.filled,
            inPipeline: applications.filter(
                (a) => a.jobId === j.id && ACTIVE_STAGES.includes(a.stage)
            ).length,
        }));

    const myCandIds = new Set(myRefs.map((r) => r.candidateId));
    const upcomingInterviews = interviews
        .filter((i) => {
            if (i.orgId !== me.orgId || i.status !== "SCHEDULED") return false;
            const app = applications.find((a) => a.id === i.applicationId);
            return app ? myCandIds.has(app.candidateId) : false;
        })
        .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
        .slice(0, 4)
        .map((i) => {
            const app = applications.find((a) => a.id === i.applicationId)!;
            return {
                ...i,
                candidateName: candidates.find((c) => c.id === app.candidateId)?.name ?? "—",
                jobTitle: jobs.find((j) => j.id === app.jobId)?.title ?? "—",
            };
        });

    return NextResponse.json({
        role: me.role,
        referralStats: {
            total: myRefs.length,
            inPipeline: inPipelineRefs.length,
            placed: placedRefs.length,
            totalEarned,
        },
        pendingPayoutTotal,
        todayAttendance: todayAtt
            ? { checkIn: todayAtt.checkIn, checkOut: todayAtt.checkOut, hoursWorked: hoursWorkedOf(todayAtt) }
            : null,
        myTasks,
        myReferrals,
        announcements: visibleAnnouncements,
        activeOpenings,
        upcomingInterviews,
    });
}
