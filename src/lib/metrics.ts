// Recruitment metrics computed from real records, shared by team profiles,
// job pages and reports so every screen shows the same numbers.
import type { Application, ApplicationStage, Candidate, Interview, PlacementRecord } from "@/lib/types";

const DAY = 86400000;
const OFFERED: ApplicationStage[] = ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"];
const ACCEPTED: ApplicationStage[] = ["OFFER_ACCEPTED", "ONBOARDING", "JOINED"];
const PAST_SCREENING: ApplicationStage[] = ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", ...OFFERED];
const SCREENED: ApplicationStage[] = [...PAST_SCREENING, "REJECTED", "BACKED_OUT"];

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

export interface PipelineMetrics {
    applications: number;
    joined: number;
    offersReleased: number;
    offersAccepted: number;
    offerAcceptancePct: number | null; // accepted / released
    screeningPassPct: number | null; // moved past screening / screened
    conversionPct: number | null; // joined / applications
    interviewToOfferPct: number | null;
    avgDaysToFirstInterview: number | null;
    avgDaysToOffer: number | null;
    avgTimeToHireDays: number | null;
    sourcing: { source: string; count: number; pct: number }[];
}

/** Metrics over a set of applications (one recruiter's, one job's, or the whole org's). */
export function pipelineMetrics(apps: Application[], allInterviews: Interview[], allCandidates: Candidate[]): PipelineMetrics {
    const ids = new Set(apps.map((a) => a.id));
    const ivs = allInterviews.filter((i) => ids.has(i.applicationId));
    const firstInterview = new Map<string, number>();
    for (const i of ivs) {
        const t = new Date(i.scheduledAt).getTime();
        if (!firstInterview.has(i.applicationId) || t < firstInterview.get(i.applicationId)!) firstInterview.set(i.applicationId, t);
    }

    const offered = apps.filter((a) => OFFERED.includes(a.stage));
    const accepted = apps.filter((a) => ACCEPTED.includes(a.stage));
    const joined = apps.filter((a) => a.stage === "JOINED");
    const screened = apps.filter((a) => SCREENED.includes(a.stage));
    const interviewed = apps.filter((a) => firstInterview.has(a.id));

    const toInterview = apps
        .filter((a) => firstInterview.has(a.id))
        .map((a) => Math.max(0, (firstInterview.get(a.id)! - new Date(a.createdAt).getTime()) / DAY));
    const toOffer = offered.map((a) => Math.max(0, (new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime()) / DAY));
    const toHire = joined.map((a) => Math.max(0, (new Date(a.actualJoinDate || a.updatedAt).getTime() - new Date(a.createdAt).getTime()) / DAY));

    const bySource = new Map<string, number>();
    for (const a of apps) {
        const src = allCandidates.find((c) => c.id === a.candidateId)?.source ?? "OTHER";
        bySource.set(src, (bySource.get(src) ?? 0) + 1);
    }

    return {
        applications: apps.length,
        joined: joined.length,
        offersReleased: offered.length,
        offersAccepted: accepted.length,
        offerAcceptancePct: pct(accepted.length, offered.length),
        screeningPassPct: pct(screened.filter((a) => PAST_SCREENING.includes(a.stage)).length, screened.length),
        conversionPct: pct(joined.length, apps.length),
        interviewToOfferPct: pct(interviewed.filter((a) => OFFERED.includes(a.stage)).length, interviewed.length),
        avgDaysToFirstInterview: round1(avg(toInterview)),
        avgDaysToOffer: round1(avg(toOffer)),
        avgTimeToHireDays: round1(avg(toHire)),
        sourcing: [...bySource.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([source, count]) => ({ source, count, pct: Math.round((count / apps.length) * 100) })),
    };
}

/** Revenue booked from placements in the current Indian financial year (Apr–Mar). */
export function fyRevenue(list: PlacementRecord[]): { label: string; amount: number } {
    const now = new Date();
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const start = `${startYear}-04-01`;
    return {
        label: `FY${String(startYear + 1).slice(2)}`,
        amount: list.filter((p) => (p.placementDate || p.joiningDate) >= start).reduce((s, p) => s + (p.revenueInr || 0), 0),
    };
}
