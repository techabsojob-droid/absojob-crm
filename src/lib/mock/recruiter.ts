// ─── Recruiter workspace & partner programme rules ────────────
// Shared by TA and portal routes: message templates, recruiter KPIs
// against monthly targets, and agent (partner) performance.

import type { Candidate, MessageTemplate, User } from "@/lib/types";
import { agentProfiles, applications, candidates, clients, commissionLedger, interviews, jobs, organizations, placements, recruiterTargets, referrals, users } from "./data";
import { referralIncentiveFor } from "./pipeline";
import { settingsFor } from "./fin/core";

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type TemplateVars = Partial<Record<"candidateName" | "jobTitle" | "clientName" | "interviewDate" | "recruiterName" | "companyName" | "contactPerson", string>>;

export function renderTemplate(text: string, vars: TemplateVars): string {
    return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (vars as Record<string, string | undefined>)[k] ?? m);
}

/** Builds template variables for a candidate (optionally in the context of one application). */
export function varsFor(me: User, cand?: Candidate | null, applicationId?: string | null, clientId?: string | null): TemplateVars {
    const app = applicationId ? applications.find((a) => a.id === applicationId) : cand ? applications.find((a) => a.candidateId === cand.id && !["REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "JOINED"].includes(a.stage)) : undefined;
    const job = app ? jobs.find((j) => j.id === app.jobId) : undefined;
    const client = clients.find((c) => c.id === (clientId ?? job?.clientId));
    const next = app ? interviews.filter((i) => i.applicationId === app.id && i.status === "SCHEDULED" && +new Date(i.scheduledAt) >= Date.now()).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))[0] : undefined;
    return {
        candidateName: cand?.name?.split(" ")[0],
        jobTitle: job?.title,
        clientName: client?.companyName,
        contactPerson: client?.contactPerson,
        interviewDate: next ? new Date(next.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : undefined,
        recruiterName: me.name,
        companyName: organizations.find((o) => o.id === me.orgId)?.name ?? "AbsoJob",
    };
}

export function templateUsable(t: MessageTemplate, orgId: string) {
    return t.orgId === orgId;
}

// ─── Recruiter KPIs ──────────────────────────────────────────

const inMonth = (d: string | null | undefined, month: string) => !!d && d.slice(0, 7) === month;
const JOINED_OK = ["JOINED", "CONFIRMED"];

export function recruiterMonth(user: User, month: string) {
    const myApps = applications.filter((a) => a.orgId === user.orgId && a.recruiterId === user.id);
    const myAppIds = new Set(myApps.map((a) => a.id));
    const subs = candidates.filter((c) => c.orgId === user.orgId).flatMap((c) => c.clientSubmissions ?? []).filter((s) => (s.submittedBy === user.name || (s.applicationId && myAppIds.has(s.applicationId))) && inMonth(s.submittedAt, month));
    const ivs = interviews.filter((i) => i.orgId === user.orgId && (i.createdBy === user.id || myAppIds.has(i.applicationId)) && inMonth(i.scheduledAt, month) && i.status !== "CANCELLED");
    const offers = candidates.filter((c) => c.orgId === user.orgId).flatMap((c) => c.offers ?? []).filter((o) => (o.createdBy === user.name || (o.applicationId && myAppIds.has(o.applicationId))) && inMonth(o.offeredDate, month) && !["DRAFT", "WITHDRAWN"].includes(o.status));
    const plcs = placements.filter((p) => p.orgId === user.orgId && p.recruiterId === user.id);
    const joinings = plcs.filter((p) => inMonth(p.joiningDate, month) && JOINED_OK.some((s) => p.joiningStatus.includes(s))).length
        || myApps.filter((a) => a.stage === "JOINED" && inMonth(a.actualJoinDate ?? a.updatedAt, month)).length;
    const revenue = plcs.filter((p) => inMonth(p.placementDate, month)).reduce((s, p) => s + (p.revenueInr || 0), 0);
    return { submissions: subs.length, interviews: ivs.length, offers: offers.length, joinings, revenue };
}

export function lastMonths(n: number): string[] {
    const out: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = n - 1; i >= 0; i--) {
        const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
        out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
}

export function recruiterPerformance(user: User, month: string) {
    const actual = recruiterMonth(user, month);
    const target = recruiterTargets.find((t) => t.orgId === user.orgId && t.userId === user.id && t.month === month) ?? null;
    const myApps = applications.filter((a) => a.orgId === user.orgId && a.recruiterId === user.id);
    const funnel: Record<string, number> = {};
    myApps.forEach((a) => { funnel[a.stage] = (funnel[a.stage] ?? 0) + 1; });
    const trend = lastMonths(6).map((m) => ({ month: m, ...recruiterMonth(user, m) }));
    const inc = commissionLedger.filter((l) => l.orgId === user.orgId && l.userId === user.id && l.type === "RECRUITER_INCENTIVE");
    const incentives = {
        pending: inc.filter((l) => ["PENDING", "APPROVED"].includes(l.status)).reduce((s, l) => s + l.amountInr, 0),
        paid: inc.filter((l) => l.status === "PAID").reduce((s, l) => s + l.amountInr - (l.tdsAmount ?? 0), 0),
        entries: inc.slice(0, 20).map((l) => ({ id: l.id, description: l.description, amount: l.amountInr, status: l.status, paidAt: l.paidAt ?? null, createdAt: l.createdAt })),
    };
    const total = myApps.length || 1;
    const joined = myApps.filter((a) => a.stage === "JOINED").length;
    const offered = myApps.filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"].includes(a.stage)).length;
    const ratios = {
        submissionToOffer: Math.round((offered / total) * 100),
        offerToJoin: offered ? Math.round((joined / offered) * 100) : 0,
        activePipeline: myApps.filter((a) => !["JOINED", "REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "BLACKLISTED"].includes(a.stage)).length,
    };
    return { month, actual, target, funnel, trend, incentives, ratios };
}

// ─── Revenue vs target, shortfall and incentive ──────────────

/** Indian financial year (April–March) months from April up to and including `month`. */
export function fyMonthsUpTo(month: string): string[] {
    const [y, m] = month.split("-").map(Number);
    const startYear = m >= 4 ? y : y - 1;
    const out: string[] = [];
    for (let d = new Date(startYear, 3, 1); ; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        out.push(k);
        if (k === month) break;
    }
    return out;
}

const fyLabel = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    const start = m >= 4 ? y : y - 1;
    return `FY ${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

/**
 * Money view for one recruiter: revenue against the revenue target for the month and the
 * financial year so far, the shortfall (and joinings needed to close it), and incentives.
 * Incentives come from the commission ledger, booked when the placement invoice is collected.
 */
export function recruiterEarnings(user: User, month: string) {
    const pct = settingsFor(user.orgId).recruiterIncentivePct ?? 0;
    const targetOf = (m: string) => recruiterTargets.find((t) => t.orgId === user.orgId && t.userId === user.id && t.month === m) ?? null;

    const monthRevenue = recruiterMonth(user, month).revenue;
    const monthTarget = targetOf(month)?.revenue ?? null;

    const fy = fyMonthsUpTo(month);
    const fyRevenue = fy.reduce((sum, m) => sum + recruiterMonth(user, m).revenue, 0);
    const fyTargets = fy.map(targetOf).filter((t): t is NonNullable<typeof t> => !!t && t.revenue > 0);
    const fyTarget = fyTargets.length ? fyTargets.reduce((sum, t) => sum + t.revenue, 0) : null;

    // Average fee per placement (this recruiter's last 12 months, else the org's) to say how many joinings close the gap
    const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const avgOf = (list: typeof placements) => {
        const xs = list.filter((p) => p.placementDate >= since && (p.revenueInr || 0) > 0);
        return xs.length ? xs.reduce((sum, p) => sum + p.revenueInr, 0) / xs.length : null;
    };
    const avgFee = avgOf(placements.filter((p) => p.orgId === user.orgId && p.recruiterId === user.id)) ?? avgOf(placements.filter((p) => p.orgId === user.orgId));

    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const daysLeft = month === thisMonth ? lastDay - Number(today.slice(8, 10)) + 1 : month > thisMonth ? lastDay : 0;

    const gap = (revenue: number, target: number | null) => target == null ? null : {
        target,
        shortfall: Math.max(0, target - revenue),
        surplus: Math.max(0, revenue - target),
        achievedPct: target > 0 ? Math.round((revenue / target) * 100) : null,
        joiningsNeeded: target > revenue && avgFee ? Math.ceil((target - revenue) / avgFee) : 0,
    };

    // Incentives
    const ledger = commissionLedger.filter((l) => l.orgId === user.orgId && l.userId === user.id && ["RECRUITER_INCENTIVE", "CLAWBACK"].includes(l.type) && l.status !== "CANCELLED");
    const inc = ledger.filter((l) => l.type === "RECRUITER_INCENTIVE");
    const monthEnd = `${month}-31T23:59:59`;
    const sum = (xs: typeof ledger) => xs.reduce((s, l) => s + l.amountInr, 0);
    const paid = inc.filter((l) => l.status === "PAID");
    const tds = paid.reduce((s, l) => s + (l.tdsAmount ?? 0), 0);
    const clawback = Math.abs(sum(ledger.filter((l) => l.type === "CLAWBACK")));
    // Placements whose invoice hasn't been collected yet → incentive still to come
    const booked = new Set(inc.map((l) => l.placementId).filter(Boolean));
    const upcoming = placements.filter((p) => p.orgId === user.orgId && p.recruiterId === user.id && fy.includes(p.placementDate.slice(0, 7))
        && !booked.has(p.id) && !["NO_SHOW", "CANCELLED"].includes(p.joiningStatus) && (p.revenueInr || 0) > 0);

    return {
        month,
        fyLabel: fyLabel(month),
        fyFrom: fy[0],
        incentivePct: pct,
        avgFeePerPlacement: avgFee == null ? null : Math.round(avgFee),
        daysLeftInMonth: daysLeft,
        thisMonth: { revenue: monthRevenue, ...(gap(monthRevenue, monthTarget) ?? { target: null, shortfall: null, surplus: null, achievedPct: null, joiningsNeeded: null }) },
        yearToDate: {
            revenue: fyRevenue, monthsWithTarget: fyTargets.length, months: fy.length,
            ...(gap(fyRevenue, fyTarget) ?? { target: null, shortfall: null, surplus: null, achievedPct: null, joiningsNeeded: null }),
        },
        incentive: {
            earnedThisMonth: sum(inc.filter((l) => l.createdAt.slice(0, 7) === month)),
            earnedThisYear: sum(inc.filter((l) => l.createdAt.slice(0, 7) >= fy[0] && l.createdAt <= monthEnd)),
            earnedAllTime: sum(inc),
            pending: sum(inc.filter((l) => ["PENDING", "APPROVED"].includes(l.status))),
            paidGross: sum(paid),
            tds,
            paidNet: sum(paid) - tds,
            clawback,
            expected: Math.round(upcoming.reduce((s, p) => s + p.revenueInr, 0) * (pct / 100)),
            expectedPlacements: upcoming.length,
        },
    };
}

// ─── Partner (agent) stats ───────────────────────────────────

export function agentStats(agentId: string) {
    const refs = referrals.filter((r) => r.agentId === agentId);
    const by = (s: string) => refs.filter((r) => r.status === s).length;
    const ledger = commissionLedger.filter((l) => l.userId === agentId && ["REFERRAL_INCENTIVE", "CLAWBACK"].includes(l.type));
    const sum = (f: (l: (typeof ledger)[number]) => boolean) => ledger.filter(f).reduce((s, l) => s + l.amountInr, 0);
    const earned = sum((l) => l.type === "REFERRAL_INCENTIVE" && l.status !== "CANCELLED");
    const paid = sum((l) => l.type === "REFERRAL_INCENTIVE" && l.status === "PAID");
    const tds = ledger.filter((l) => l.status === "PAID").reduce((s, l) => s + (l.tdsAmount ?? 0), 0);
    const clawback = Math.abs(sum((l) => l.type === "CLAWBACK" && l.status !== "CANCELLED"));
    const pending = sum((l) => l.type === "REFERRAL_INCENTIVE" && ["PENDING", "APPROVED"].includes(l.status));
    const potential = refs.filter((r) => r.status === "SHORTLISTED").reduce((s, r) => {
        const c = candidates.find((x) => x.id === r.candidateId);
        return s + referralIncentiveFor(c?.expectedCtcLpa ?? 0);
    }, 0);
    return {
        total: refs.length, submitted: by("SUBMITTED"), underReview: by("UNDER_REVIEW"), shortlisted: by("SHORTLISTED"), hired: by("HIRED"), rejected: by("REJECTED"),
        conversion: refs.length ? Math.round((by("HIRED") / refs.length) * 100) : 0,
        earned, paid, pending, tds, clawback, netPaid: paid - tds, potential,
    };
}

export function partnerLeaderboard(orgId: string) {
    return users.filter((u) => u.orgId === orgId && u.role === "AGENT" && u.status === "ACTIVE").map((u) => {
        const s = agentStats(u.id);
        return { userId: u.id, name: u.name, city: agentProfiles.find((p) => p.userId === u.id)?.city ?? u.location ?? "", referrals: s.total, hired: s.hired, conversion: s.conversion };
    }).sort((a, b) => b.hired - a.hired || b.conversion - a.conversion || b.referrals - a.referrals);
}

// ─── Resumes ─────────────────────────────────────────────────

import { storedFiles } from "./data";

/** Latest uploaded resume (stored file) for a candidate — candidate documents first, then a partner's referral upload. */
export function resumeFileOf(cand: Candidate) {
    const doc = (cand.documents ?? []).filter((d) => d.type === "RESUME" && d.fileUrl.startsWith("/api/files/")).sort((a, b) => b.version - a.version)[0];
    const id = doc?.fileUrl.split("/").pop() ?? referrals.find((r) => r.candidateId === cand.id && r.resumeFileId)?.resumeFileId;
    return id ? storedFiles.find((f) => f.id === id) ?? null : null;
}
