import { NextResponse } from "next/server";
import { isAnnouncementFor } from "@/lib/mock/hr";
import { getSessionUser } from "@/lib/mock/server";
import {
    jobs, clients, candidates, applications, interviews,
    referrals, commissionLedger, attendance, tasks, announcements,
    todayStr, ACTIVE_STAGES, userById, hoursWorkedOf,
} from "@/lib/mock/data";
import { agentProfiles } from "@/lib/mock/data";
import { agentStats, partnerLeaderboard } from "@/lib/mock/recruiter";
import { declarationFor, directReports, istNow, leaveBalancesFor, shiftFor } from "@/lib/mock/ess";
import { employeeForUser } from "@/lib/mock/identity";
import { attendanceCorrections, documents, exitRecords, holidays, hrPolicies, onboardingRecords, performanceReviews, policyAcknowledgements, wfhRequests } from "@/lib/mock/data";
import { fyOf } from "@/lib/mock/fin/core";
import { leavesAwaiting } from "@/lib/mock/hr";



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
    const visibleAnnouncements = announcements
        .filter((a) => a.orgId === me.orgId && isAnnouncementFor(me, a.audience))
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

    // Partner programme block (agents): conversion, earnings split and leaderboard
    const kyc = agentProfiles.find((p) => p.userId === me.id);
    const board = me.role === "AGENT" ? partnerLeaderboard(me.orgId) : [];
    const myRank = board.findIndex((b) => b.userId === me.id);
    const partner = me.role === "AGENT" ? {
        stats: agentStats(me.id),
        kycStatus: kyc?.kycStatus ?? null,
        kycNote: kyc?.kycNote ?? null,
        rank: myRank >= 0 ? myRank + 1 : null,
        partners: board.length,
        // Other partners are shown by first name only
        leaderboard: board.slice(0, 5).map((b, i) => ({ rank: i + 1, name: b.userId === me.id ? `${b.name} (you)` : b.name.split(" ")[0], hired: b.hired, referrals: b.referrals, conversion: b.conversion, me: b.userId === me.id })),
    } : null;

    // Employee self-service block: shift, balances, next holiday and everything waiting on me
    const emp = me.role === "AGENT" ? undefined : employeeForUser(me.id);
    let employee = null;
    if (emp) {
        const now = istNow();
        const bal = leaveBalancesFor(me);
        const actions: { label: string; href: string; tone: "amber" | "red" | "blue" }[] = [];
        const unacked = hrPolicies.filter((p) => p.orgId === me.orgId && p.status === "PUBLISHED" && !policyAcknowledgements.some((a) => a.policyId === p.id && a.userId === me.id && a.version === p.version));
        if (unacked.length) actions.push({ label: `Acknowledge ${unacked.length} company polic${unacked.length > 1 ? "ies" : "y"}`, href: "/portal/policies", tone: "amber" });
        const selfReview = performanceReviews.filter((r) => r.employeeId === emp.id && ["GOALS_SET", "SELF_REVIEW"].includes(r.status));
        if (selfReview.length) actions.push({ label: "Submit your self review", href: "/portal/performance", tone: "amber" });
        const decl = declarationFor(emp.id, fyOf(now.date));
        if (!decl || decl.status === "DRAFT") actions.push({ label: "Submit your tax declaration for this year", href: "/portal/tax", tone: "blue" });
        if (decl?.status === "REJECTED") actions.push({ label: "Tax declaration sent back — fix and resubmit", href: "/portal/tax", tone: "red" });
        const rejectedDocs = documents.filter((d) => d.employeeId === emp.id && d.status === "REJECTED");
        if (rejectedDocs.length) actions.push({ label: `${rejectedDocs.length} document(s) rejected — re-upload`, href: "/portal/profile?tab=documents", tone: "red" });
        const onb = onboardingRecords.find((o) => o.createdEmployeeId === emp.id && o.status !== "COMPLETED");
        if (onb && onb.checklist.some((c) => !c.completed && !c.submittedFileId)) actions.push({ label: "Complete your joining checklist", href: "/portal/onboarding", tone: "amber" });
        if (!emp.emergencyContact?.phone) actions.push({ label: "Add an emergency contact", href: "/portal/profile", tone: "blue" });
        const reports = directReports(me);
        const reportIds = new Set(reports.map((r) => r.id));
        const teamPending = leavesAwaiting(me).length + wfhRequests.filter((w) => reportIds.has(w.employeeId) && w.status === "PENDING").length + attendanceCorrections.filter((c) => reportIds.has(c.employeeId) && c.status === "PENDING").length;
        if (teamPending) actions.push({ label: `${teamPending} team request(s) awaiting your approval`, href: "/portal/team", tone: "amber" });
        const exit = exitRecords.find((x) => x.employeeId === emp.id && ["PENDING_APPROVAL", "NOTICE_PERIOD", "CLEARANCE", "SETTLED"].includes(x.status));
        employee = {
            code: emp.employeeId, designation: emp.designation, department: emp.department, workMode: emp.workMode ?? "OFFICE",
            shift: shiftFor(emp, me.orgId),
            probation: emp.probationStatus === "ON_PROBATION" ? emp.probationEndDate ?? null : null,
            leave: bal.filter((b) => ["CASUAL", "SICK", "EARNED", "COMP_OFF"].includes(b.type)).map((b) => ({ type: b.type, label: b.label, available: b.available, allowance: b.allowance })),
            nextHoliday: holidays.filter((h) => h.orgId === me.orgId && h.date >= now.date && h.type !== "OPTIONAL").sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
            actions, isManager: reports.length > 0, teamSize: reports.length,
            exit: exit ? { status: exit.status, lastWorkingDay: exit.lastWorkingDay } : null,
        };
    }

    return NextResponse.json({
        role: me.role,
        partner,
        employee,
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
