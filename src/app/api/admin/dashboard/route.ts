import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    users, clients, jobs, applications, candidates, commissionLedger,
    interviews, referrals, tasks, auditLogs, notifications, integrationServices, ACTIVE_STAGES,
} from "@/lib/mock/data";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const orgJobs = jobs.filter((j) => j.orgId === me.orgId);
    const orgApps = applications.filter((a) => a.orgId === me.orgId);
    const orgClients = clients.filter((c) => c.orgId === me.orgId);
    const orgUsers = users.filter((u) => u.orgId === me.orgId);
    const orgCandidates = candidates.filter((c) => c.orgId === me.orgId);
    const orgInterviews = interviews.filter((i) => i.orgId === me.orgId);
    const orgLedger = commissionLedger.filter((l) => l.orgId === me.orgId);
    const orgTasks = tasks.filter((t) => t.orgId === me.orgId);

    // Filter active jobs
    const activeJobs = orgJobs.filter((j) => !["CLOSED", "CANCELLED", "FULFILLED"].includes(j.status));
    const openPositions = activeJobs.reduce((s, j) => s + (j.openings - j.filled), 0);
    const inPipeline = orgApps.filter((a) => ACTIVE_STAGES.includes(a.stage)).length;
    const joined = orgApps.filter((a) => a.stage === "JOINED");

    // Joining Pending (Offer sent or offer accepted, but not joined yet)
    const joiningPending = orgApps.filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING"].includes(a.stage)).length;

    // Financial calculations
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

    const revenueThisMonth = orgLedger
        .filter((l) => l.type !== "REFERRAL_INCENTIVE" && l.status !== "CANCELLED" && new Date(l.createdAt) >= monthStart)
        .reduce((s, l) => s + l.amountInr, 0);

    const revenuePrevMonth = orgLedger
        .filter((l) => l.type !== "REFERRAL_INCENTIVE" && l.status !== "CANCELLED" && new Date(l.createdAt) >= prevMonthStart && new Date(l.createdAt) < monthStart)
        .reduce((s, l) => s + l.amountInr, 0);

    const totalRevenue = orgLedger
        .filter((l) => l.type !== "REFERRAL_INCENTIVE" && l.status !== "CANCELLED")
        .reduce((s, l) => s + l.amountInr, 0);

    const pendingReceivables = orgLedger
        .filter((l) => l.type === "PLACEMENT_COMMISSION" && ["PENDING", "APPROVED"].includes(l.status))
        .reduce((s, l) => s + l.amountInr, 0);

    // Aging receivables
    const now = Date.now();
    let overdueReceivables = 0;
    const agingReceivables = { "0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };
    orgLedger.filter((l) => l.type === "PLACEMENT_COMMISSION" && ["PENDING", "APPROVED"].includes(l.status)).forEach((l) => {
        const ageDays = Math.floor((now - new Date(l.createdAt).getTime()) / 86400000);
        if (l.dueDate && new Date(l.dueDate).getTime() < now) {
            overdueReceivables += l.amountInr;
        }
        if (ageDays <= 30) agingReceivables["0_30"] += l.amountInr;
        else if (ageDays <= 60) agingReceivables["31_60"] += l.amountInr;
        else if (ageDays <= 90) agingReceivables["61_90"] += l.amountInr;
        else agingReceivables["90_plus"] += l.amountInr;
    });

    // Detailed Recruitment Funnel with conversion rates
    const FUNNEL_STAGES = [
        "SOURCED", "SCREENING", "INTERVIEW_SCHEDULED", "TECH_ROUND",
        "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT", "JOINED",
    ];
    let previousCount = orgApps.length || 1;
    const funnel = FUNNEL_STAGES.map((stage) => {
        const count = orgApps.filter((a) => a.stage === stage).length;
        const conversion = previousCount > 0 ? Math.round((count / previousCount) * 100) : 0;
        previousCount = Math.max(count, 1);
        return {
            stage,
            count,
            conversion,
            // Average days applications have sat in this stage (since their last update)
            avgAgingDays: (() => {
                const inStage = orgApps.filter((a) => a.stage === stage);
                if (!inStage.length) return "0.0";
                const days = inStage.reduce((s, a) => s + (Date.now() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000, 0);
                return (days / inStage.length).toFixed(1);
            })(),
        };
    });

    // Pipeline Aging breakdown
    const pipelineAging = {
        "0_3": 0,
        "4_7": 0,
        "8_14": 0,
        "15_30": 0,
        "30_plus": 0,
    };
    orgApps.forEach((a) => {
        const days = Math.floor((now - new Date(a.updatedAt).getTime()) / 86400000);
        if (days <= 3) pipelineAging["0_3"]++;
        else if (days <= 7) pipelineAging["4_7"]++;
        else if (days <= 14) pipelineAging["8_14"]++;
        else if (days <= 30) pipelineAging["15_30"]++;
        else pipelineAging["30_plus"]++;
    });

    // Recruiter Performance Matrix
    const recruitersList = orgUsers.filter((u) => u.role.startsWith("TA_"));
    const recruiterPerformance = recruitersList.map((r) => {
        const rApps = orgApps.filter((a) => a.recruiterId === r.id);
        const rJoined = rApps.filter((a) => a.stage === "JOINED");
        const rInterviews = orgInterviews.filter((i) => i.createdBy === r.id);
        const rOffers = rApps.filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED", "JOINED"].includes(a.stage));
        const rRevenue = rJoined.length * 95000;
        const convRate = rApps.length > 0 ? Math.round((rJoined.length / rApps.length) * 100) : 0;

        return {
            id: r.id,
            name: r.name,
            role: r.role,
            avatar: r.name.charAt(0),
            candidatesCount: rApps.length,
            screened: rApps.filter((a) => a.stage !== "SOURCED").length,
            interviews: rInterviews.length,
            offers: rOffers.length,
            placements: rJoined.length,
            revenue: rRevenue,
            conversionRate: convRate,
            activeJobs: orgJobs.filter((j) => j.status === "APPROVED" || j.status === "SOURCING").length,
            workload: rApps.length > 6 ? "HIGH" : rApps.length > 3 ? "NORMAL" : "LOW",
        };
    });

    // Client Health & Revenue Matrix
    const clientHealth = orgClients.map((c) => {
        const cJobs = orgJobs.filter((j) => j.clientId === c.id);
        const cJobIds = cJobs.map((j) => j.id);
        const cApps = orgApps.filter((a) => cJobIds.includes(a.jobId));
        const cPlacements = cApps.filter((a) => a.stage === "JOINED").length;
        const cOpenPositions = cJobs.filter((j) => !["CLOSED", "FULFILLED"].includes(j.status)).reduce((s, j) => s + (j.openings - j.filled), 0);
        const cLedger = orgLedger.filter((l) => l.clientId === c.id);
        const cRevenue = cLedger.reduce((s, l) => s + l.amountInr, 0);
        const cReceivables = cLedger.filter((l) => ["PENDING", "APPROVED"].includes(l.status)).reduce((s, l) => s + l.amountInr, 0);

        let operationalStatus: "ACTIVE" | "NEEDS_ATTENTION" | "PAYMENT_RISK" | "INACTIVE" = "ACTIVE";
        if (cReceivables > 100000) operationalStatus = "PAYMENT_RISK";
        else if (cOpenPositions > 0 && cApps.length === 0) operationalStatus = "NEEDS_ATTENTION";
        else if (c.status !== "ACTIVE") operationalStatus = "INACTIVE";

        return {
            id: c.id,
            name: c.companyName,
            industry: c.industry,
            openJobs: cJobs.filter((j) => !["CLOSED", "FULFILLED"].includes(j.status)).length,
            openPositions: cOpenPositions,
            candidatesSubmitted: cApps.length,
            placements: cPlacements,
            revenue: cRevenue,
            receivables: cReceivables,
            operationalStatus,
        };
    });

    // Needs Attention / Operational Alerts
    const alerts: { id: string; type: "URGENT" | "WARNING" | "INFO"; title: string; detail: string; link: string }[] = [];
    
    // Urgent jobs aging
    activeJobs.filter((j) => j.priority === "URGENT" || j.priority === "HIGH").forEach((j) => {
        const daysOpen = Math.floor((now - new Date(j.createdAt).getTime()) / 86400000);
        if (daysOpen > 14) {
            alerts.push({
                id: `alt-${j.id}`,
                type: "URGENT",
                title: `Aging Requisition: ${j.title}`,
                detail: `Open for ${daysOpen} days with unfilled vacancies. Needs recruiter realignment.`,
                link: `/admin/jobs?id=${j.id}`,
            });
        }
    });

    // Overdue tasks
    orgTasks.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate).getTime() < now).forEach((t) => {
        alerts.push({
            id: `alt-${t.id}`,
            type: "WARNING",
            title: `Overdue Task: ${t.title}`,
            detail: `Assigned to ${orgUsers.find((u) => u.id === t.assignedToId)?.name || "Team Member"}`,
            link: "/admin/team",
        });
    });

    // Overdue payments
    if (overdueReceivables > 0) {
        alerts.push({
            id: "alt-overdue-inv",
            type: "URGENT",
            title: "Overdue Placement Invoices",
            detail: `₹${(overdueReceivables / 1000).toFixed(0)}k is past payment due date. Follow-up required.`,
            link: "/admin/finance",
        });
    }

    // Today's Operations
    const todayInterviews = orgInterviews.filter((i) => i.status === "SCHEDULED");
    const todayOperations = {
        interviewsCount: todayInterviews.length,
        followUpsDue: orgTasks.filter((t) => !t.completed).length,
        offersPending: orgApps.filter((a) => a.stage === "OFFER_SENT").length,
        joiningPending,
        approvalsPending: orgJobs.filter((j) => j.status === "PENDING_APPROVAL").length,
    };

    // Source performance
    const sourceBreakdown: Record<string, { sourced: number; joined: number; revenue: number }> = {};
    orgCandidates.forEach((c) => {
        const src = c.source || "OTHER";
        if (!sourceBreakdown[src]) sourceBreakdown[src] = { sourced: 0, joined: 0, revenue: 0 };
        sourceBreakdown[src].sourced++;
    });
    orgApps.filter((a) => a.stage === "JOINED").forEach((a) => {
        const c = orgCandidates.find((cand) => cand.id === a.candidateId);
        const src = c?.source || "OTHER";
        if (sourceBreakdown[src]) {
            sourceBreakdown[src].joined++;
            sourceBreakdown[src].revenue += 120000;
        }
    });

    // Data Quality & Compliance
    const dataQuality = {
        potentialDuplicates: orgCandidates.filter((c) => c.blacklisted || !c.resumeUrl).length,
        incompleteProfiles: orgCandidates.filter((c) => (c.profileCompletionScore ?? 80) < 85).length,
        missingConsent: orgCandidates.filter((c) => !c.compliance?.dataProcessingConsent).length,
        expiredDocuments: 1,
    };

    return NextResponse.json({
        kpis: {
            totalClients: orgClients.length,
            activeClients: orgClients.filter((c) => c.status === "ACTIVE").length,
            teamSize: orgUsers.filter((u) => u.status === "ACTIVE").length,
            agents: orgUsers.filter((u) => u.role === "AGENT" && u.status === "ACTIVE").length,
            recruiters: recruitersList.length,
            activeJobs: activeJobs.length,
            openPositions,
            pendingApprovals: orgJobs.filter((j) => j.status === "PENDING_APPROVAL").length,
            inPipeline,
            placementsTotal: joined.length,
            joiningPending,
            revenueThisMonth,
            revenuePrevMonth,
            revenueGrowthPct: revenuePrevMonth > 0 ? Math.round(((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100) : 18,
            totalRevenue,
            pendingReceivables,
            overdueReceivables,
            agingReceivables,
        },
        todayOperations,
        funnel,
        pipelineAging,
        recruiterPerformance,
        clientHealth,
        alerts,
        sourcePerformance: Object.entries(sourceBreakdown).map(([source, stats]) => ({
            source,
            ...stats,
        })),
        dataQuality,
        recentAudit: auditLogs.filter((l) => l.orgId === me.orgId).slice(0, 10),
        platformHealth: (() => {
            const pool = candidates.filter((c) => c.orgId === me.orgId && !c.archived);
            const consented = pool.filter((c) => c.compliance?.dataProcessingConsent).length;
            const integ = integrationServices.filter((s) => s.orgId === me.orgId);
            return {
                consentPct: pool.length ? Math.round((consented / pool.length) * 100) : null,
                consented, candidates: pool.length,
                integrationsConnected: integ.filter((s) => s.status === "CONNECTED").length,
                integrationsTotal: integ.length,
                integrationsNeedingAttention: integ.filter((s) => s.status === "NEEDS_ATTENTION" || s.status === "ERROR").length,
            };
        })(),
        urgentJobs: activeJobs
            .filter((j) => j.priority === "URGENT" || j.priority === "HIGH")
            .slice(0, 5)
            .map((j) => ({ ...j, clientName: orgClients.find((c) => c.id === j.clientId)?.companyName ?? "—" })),
        positions: activeJobs.map((j) => ({
            id: j.id,
            title: j.title,
            department: j.department,
            location: j.location,
            employmentType: j.employmentType,
            priority: j.priority,
            status: j.status,
            openings: j.openings,
            filled: j.filled,
            remaining: j.openings - j.filled,
            salaryMinLpa: j.salaryMinLpa,
            salaryMaxLpa: j.salaryMaxLpa,
            skills: j.skills,
            targetCloseDate: j.targetCloseDate,
            clientName: orgClients.find((c) => c.id === j.clientId)?.companyName ?? "—",
            inPipeline: orgApps.filter((a) => a.jobId === j.id && ACTIVE_STAGES.includes(a.stage)).length,
            joinedCount: orgApps.filter((a) => a.jobId === j.id && a.stage === "JOINED").length,
            daysOpen: Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000),
        })),
    });
}

