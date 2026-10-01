import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    jobs, applications, candidates, clients, commissionLedger,
    users, referrals, interviews, ACTIVE_STAGES,
} from "@/lib/mock/data";
import { pipelineMetrics } from "@/lib/metrics";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const orgJobs = jobs.filter((j) => j.orgId === me.orgId);
    const orgApps = applications.filter((a) => a.orgId === me.orgId);
    const orgClients = clients.filter((c) => c.orgId === me.orgId);

    // 1. Recruiter performance leaderboard
    const recruiters = users.filter((u) => u.orgId === me.orgId && u.role.startsWith("TA_"));
    const recruiterStats = recruiters.map((r) => {
        const apps = orgApps.filter((a) => a.recruiterId === r.id);
        const joined = apps.filter((a) => a.stage === "JOINED").length;
        const active = apps.filter((a) => ACTIVE_STAGES.includes(a.stage)).length;
        const interviewsDone = apps.filter((a) => ["TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"].includes(a.stage)).length;
        return {
            id: r.id,
            name: r.name,
            activePipeline: active,
            interviews: interviewsDone,
            joined,
            conversionRate: apps.length > 0 ? Math.round((joined / apps.length) * 100) : 0,
            avgTimeToHireDays: pipelineMetrics(apps, interviews, candidates).avgTimeToHireDays,
        };
    }).sort((a, b) => b.joined - a.joined || b.conversionRate - a.conversionRate);

    // 2. Source effectiveness
    const sourceCounts = ["AGENT_REFERRAL", "JOB_PORTAL", "LINKEDIN", "WALK_IN", "DATABASE", "CAMPUS", "OTHER"].map((src) => ({
        source: src,
        candidates: candidates.filter((c) => c.orgId === me.orgId && c.source === src).length,
    }));

    // 3. Client-wise revenue
    const clientRevenue = orgClients
        .map((c) => ({
            clientName: c.companyName,
            revenue: commissionLedger
                .filter((l) => l.clientId === c.id && l.type === "PLACEMENT_COMMISSION" && l.status !== "CANCELLED")
                .reduce((s, l) => s + l.amountInr, 0),
            openJobs: orgJobs.filter((j) => j.clientId === c.id && ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status)).length,
        }))
        .sort((a, b) => b.revenue - a.revenue);

    // 4. Monthly placement trend: joins per month over the last 6 months
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - (5 - i));
        const ym = d.toISOString().slice(0, 7);
        return {
            month: d.toLocaleString("en-IN", { month: "short" }),
            placements: orgApps.filter((a) => a.stage === "JOINED" && (a.actualJoinDate || a.updatedAt).slice(0, 7) === ym).length,
        };
    });

    // 5. Referral stats
    const orgReferrals = referrals.filter((r) => r.orgId === me.orgId);
    const referralStats = {
        total: orgReferrals.length,
        hired: orgReferrals.filter((r) => r.status === "HIRED").length,
        incentiveTotal: orgReferrals.reduce((s, r) => s + r.incentiveAmount, 0),
        byAgent: users
            .filter((u) => u.orgId === me.orgId && u.role === "AGENT")
            .map((ag) => {
                const mine = orgReferrals.filter((r) => r.agentId === ag.id);
                return {
                    name: ag.name,
                    referrals: mine.length,
                    hires: mine.filter((r) => r.status === "HIRED").length,
                    earned: mine.reduce((s, r) => s + r.incentiveAmount, 0),
                };
            })
            .sort((a, b) => b.hires - a.hires),
    };

    // Days from entering the pipeline to joining, across everyone who joined
    const joined = orgApps.filter((a) => a.stage === "JOINED");
    const avgTimeToHireDays = joined.length
        ? Math.round(joined.reduce((s, a) => s + Math.max(0, (new Date(a.actualJoinDate || a.updatedAt).getTime() - new Date(a.createdAt).getTime()) / 86400000), 0) / joined.length)
        : null;

    return NextResponse.json({
        avgTimeToHireDays,
        recruiterStats,
        sourceCounts,
        clientRevenue,
        monthlyTrend,
        referralStats,
        stageDistribution: ACTIVE_STAGES.map((stage) => ({
            stage,
            count: orgApps.filter((a) => a.stage === stage).length,
        })),
    });
}
