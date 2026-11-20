import { NextResponse } from "next/server";
import { integrationCatalog } from "@/lib/integrations";
import { requireRole } from "@/lib/mock/server";
import {
    users, clients, jobs, applications, candidates, commissionLedger,
    interviews, referrals, tasks, auditLogs, notifications, ACTIVE_STAGES, invoices,
} from "@/lib/mock/data";
import { balanceDue, creditStatusOf, inrOf, isOpen } from "@/lib/mock/finance";
import { OPEN_JOB_STATUSES } from "@/lib/requisition-options";

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

    // Period picked on the dashboard: revenue and joinings are counted inside it, and compared with the period before
    const period = new URL(request.url).searchParams.get("period") ?? "THIS_MONTH";
    const range = periodRange(period);
    const billable = orgLedger.filter((l) => l.type !== "REFERRAL_INCENTIVE" && l.status !== "CANCELLED");
    const inRange = (iso: string | null | undefined, from: Date, to: Date) => !!iso && new Date(iso) >= from && new Date(iso) < to;
    const revenuePeriod = billable.filter((l) => inRange(l.createdAt, range.from, range.to)).reduce((s, l) => s + l.amountInr, 0);
    const revenuePrevPeriod = billable.filter((l) => inRange(l.createdAt, range.prevFrom, range.from)).reduce((s, l) => s + l.amountInr, 0);
    const joinedInPeriod = orgApps.filter((a) => a.stage === "JOINED" && inRange(a.actualJoinDate || a.updatedAt, range.from, range.to)).length;

    // Billed vs collected, last 6 calendar months (IST)
    const revenueTrend = Array.from({ length: 6 }, (_, i) => {
        const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0); start.setMonth(start.getMonth() - (5 - i));
        const end = new Date(start); end.setMonth(end.getMonth() + 1);
        return {
            month: start.toLocaleDateString("en-IN", { month: "short" }),
            revenue: billable.filter((l) => l.amountInr > 0 && inRange(l.createdAt, start, end)).reduce((n, l) => n + l.amountInr, 0),
            collections: billable.filter((l) => l.status === "PAID" && inRange(l.paidAt ?? null, start, end)).reduce((n, l) => n + l.amountInr, 0),
        };
    });

    const revenueThisMonth = orgLedger
        .filter((l) => l.type !== "REFERRAL_INCENTIVE" && l.status !== "CANCELLED" && new Date(l.createdAt) >= monthStart)
        .reduce((s, l) => s + l.amountInr, 0);

    const revenuePrevMonth = orgLedger
        .filter((l) => l.type !== "REFERRAL_INCENTIVE" && l.status !== "CANCELLED" && new Date(l.createdAt) >= prevMonthStart && new Date(l.createdAt) < monthStart)
        .reduce((s, l) => s + l.amountInr, 0);

    const totalRevenue = orgLedger
        .filter((l) => l.type !== "REFERRAL_INCENTIVE" && l.status !== "CANCELLED")
        .reduce((s, l) => s + l.amountInr, 0);

    // Receivables: balance due on the Finance workspace's open invoices (INR, incl. GST), same as Finance shows
    const now = Date.now();
    const openInvoices = invoices.filter((i) => i.orgId === me.orgId && isOpen(i));
    const todayStr = new Date(now + 5.5 * 3600000).toISOString().slice(0, 10); // IST date
    let pendingReceivables = 0;
    let overdueReceivables = 0;
    const agingReceivables = { "0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };
    for (const inv of openInvoices) {
        const due = inrOf(inv, balanceDue(inv));
        pendingReceivables += due;
        if (inv.dueDate < todayStr) overdueReceivables += due;
        const ageDays = Math.floor((Date.parse(todayStr) - Date.parse(inv.issueDate.slice(0, 10))) / 86400000);
        if (ageDays <= 30) agingReceivables["0_30"] += due;
        else if (ageDays <= 60) agingReceivables["31_60"] += due;
        else if (ageDays <= 90) agingReceivables["61_90"] += due;
        else agingReceivables["90_plus"] += due;
    }

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
        const cOpenJobs = cJobs.filter((j) => (OPEN_JOB_STATUSES as readonly string[]).includes(j.status));
        const cOpenPositions = cOpenJobs.reduce((s, j) => s + Math.max(0, j.openings - j.filled), 0);
        const cLedger = orgLedger.filter((l) => l.clientId === c.id);
        const cRevenue = cLedger.reduce((s, l) => s + l.amountInr, 0);
        const credit = creditStatusOf(me.orgId, c.id);
        const cReceivables = credit.outstanding;

        // Payment risk = on credit hold or anything overdue (thresholds in Finance › Settings)
        let operationalStatus: "ACTIVE" | "NEEDS_ATTENTION" | "PAYMENT_RISK" | "INACTIVE" = "ACTIVE";
        if (credit.onHold || credit.maxOverdue > 0) operationalStatus = "PAYMENT_RISK";
        else if (cOpenPositions > 0 && cApps.length === 0) operationalStatus = "NEEDS_ATTENTION";
        else if (c.status !== "ACTIVE") operationalStatus = "INACTIVE";

        return {
            id: c.id,
            name: c.companyName,
            industry: c.industry,
            openJobs: cOpenJobs.length,
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
            link: "/finance/invoices",
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
        incompleteProfiles: orgCandidates.filter((c) => c.profileCompletionScore != null && c.profileCompletionScore < 85).length,
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
            // null when there is nothing to compare with (no invented growth figure)
            revenueGrowthPct: revenuePrevMonth > 0 ? Math.round(((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100) : null,
            period: range.label,
            revenuePeriod,
            revenuePeriodGrowthPct: revenuePrevPeriod > 0 ? Math.round(((revenuePeriod - revenuePrevPeriod) / revenuePrevPeriod) * 100) : null,
            joinedInPeriod,
            totalRevenue,
            pendingReceivables,
            overdueReceivables,
            agingReceivables,
        },
        todayOperations,
        funnel,
        pipelineAging,
        revenueTrend,
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
            const integ = integrationCatalog();
            return {
                consentPct: pool.length ? Math.round((consented / pool.length) * 100) : null,
                consented, candidates: pool.length,
                integrationsConnected: integ.filter((s) => s.availability === "LIVE").length,
                integrationsTotal: integ.length,
                integrationsNeedingAttention: integ.filter((s) => s.availability === "NEEDS_SETUP").length,
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


/** Date range for the dashboard's period filter, plus the equally long period before it. */
function periodRange(period: string): { from: Date; to: Date; prevFrom: Date; label: string } {
    const now = new Date();
    const day = new Date(now); day.setHours(0, 0, 0, 0);
    const tomorrow = new Date(day); tomorrow.setDate(day.getDate() + 1);
    const back = (from: Date, to: Date) => new Date(from.getTime() - (to.getTime() - from.getTime()));
    switch (period) {
        case "TODAY": return { from: day, to: tomorrow, prevFrom: back(day, tomorrow), label: "Today" };
        case "THIS_WEEK": {
            const from = new Date(day); from.setDate(day.getDate() - ((day.getDay() + 6) % 7)); // Monday
            return { from, to: tomorrow, prevFrom: new Date(from.getTime() - 7 * 86400000), label: "This week" };
        }
        case "LAST_MONTH": {
            const from = new Date(day.getFullYear(), day.getMonth() - 1, 1), to = new Date(day.getFullYear(), day.getMonth(), 1);
            return { from, to, prevFrom: new Date(day.getFullYear(), day.getMonth() - 2, 1), label: "Last month" };
        }
        case "THIS_QUARTER": {
            const q = Math.floor(day.getMonth() / 3) * 3;
            const from = new Date(day.getFullYear(), q, 1);
            return { from, to: tomorrow, prevFrom: new Date(day.getFullYear(), q - 3, 1), label: "This quarter" };
        }
        case "THIS_FY": {
            const y = day.getMonth() >= 3 ? day.getFullYear() : day.getFullYear() - 1; // April to March
            const from = new Date(y, 3, 1);
            return { from, to: tomorrow, prevFrom: new Date(y - 1, 3, 1), label: "This financial year" };
        }
        default: {
            const from = new Date(day.getFullYear(), day.getMonth(), 1);
            return { from, to: tomorrow, prevFrom: new Date(day.getFullYear(), day.getMonth() - 1, 1), label: "This month" };
        }
    }
}
