import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    users, clients, jobs, applications, candidates, commissionLedger,
    auditLogs, ACTIVE_STAGES,
} from "@/lib/mock/data";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const orgJobs = jobs.filter((j) => j.orgId === me.orgId);
    const orgApps = applications.filter((a) => a.orgId === me.orgId);
    const orgClients = clients.filter((c) => c.orgId === me.orgId);
    const orgUsers = users.filter((u) => u.orgId === me.orgId);
    const joined = orgApps.filter((a) => a.stage === "JOINED");

    const activeJobs = orgJobs.filter((j) => !["CLOSED", "CANCELLED", "FULFILLED"].includes(j.status));
    const openPositions = activeJobs.reduce((s, j) => s + (j.openings - j.filled), 0);
    const inPipeline = orgApps.filter((a) => ACTIVE_STAGES.includes(a.stage)).length;

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const revenueThisMonth = commissionLedger
        .filter((l) => l.orgId === me.orgId && l.type !== "REFERRAL_INCENTIVE" && l.status !== "CANCELLED" && new Date(l.createdAt) >= monthStart)
        .reduce((s, l) => s + l.amountInr, 0);
    const pendingReceivables = commissionLedger
        .filter((l) => l.orgId === me.orgId && l.type === "PLACEMENT_COMMISSION" && ["PENDING", "APPROVED"].includes(l.status))
        .reduce((s, l) => s + l.amountInr, 0);

    const funnel = [
        "SOURCED", "SCREENING", "INTERVIEW_SCHEDULED", "TECH_ROUND",
        "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT", "JOINED",
    ].map((stage) => ({
        stage,
        count: orgApps.filter((a) => a.stage === stage).length,
    }));

    return NextResponse.json({
        kpis: {
            totalClients: orgClients.length,
            activeClients: orgClients.filter((c) => c.status === "ACTIVE").length,
            teamSize: orgUsers.filter((u) => u.status === "ACTIVE").length,
            agents: orgUsers.filter((u) => u.role === "AGENT" && u.status === "ACTIVE").length,
            recruiters: orgUsers.filter((u) => u.role.startsWith("TA_")).length,
            activeJobs: activeJobs.length,
            openPositions,
            pendingApprovals: orgJobs.filter((j) => j.status === "PENDING_APPROVAL").length,
            inPipeline,
            placementsTotal: joined.length,
            revenueThisMonth,
            pendingReceivables,
        },
        funnel,
        recentAudit: auditLogs.filter((l) => l.orgId === me.orgId).slice(0, 8),
        urgentJobs: activeJobs
            .filter((j) => j.priority === "URGENT" || j.priority === "HIGH")
            .slice(0, 5)
            .map((j) => ({ ...j, clientName: orgClients.find((c) => c.id === j.clientId)?.companyName ?? "—" })),
    });
}
