// ─── Recruitment KPIs (computed live from CRM records) ────────
// Nothing here is stored: every KPI is derived from the records recruiters already
// create (applications, calls, stage moves in the audit log, client submissions,
// interviews, offers, placements), so it updates as soon as an activity is recorded
// and can never drift from — or duplicate — the underlying data.

import type { User } from "@/lib/types";
import { STAGE_ORDER, type ApplicationStage } from "@/lib/types";
import { applications, auditLogs, callActivities, candidates, clients, interviews, jobs, placements, recruiterTargets, users } from "./data";
import { istNow } from "./ess";

export type KpiKey =
    | "sourced" | "contacted" | "shortlisted" | "submitted" | "interviewsScheduled"
    | "interviewsAttended" | "selected" | "offersReleased" | "offersAccepted" | "joined";

export const KPI_DEFS: { key: KpiKey; label: string; hint: string }[] = [
    { key: "sourced", label: "Candidates sourced", hint: "Candidates added to a requisition pipeline" },
    { key: "contacted", label: "Candidates contacted", hint: "Distinct candidates reached on a connected call or moved to Contacted" },
    { key: "shortlisted", label: "Shortlisted", hint: "Applications moved to Shortlisted" },
    { key: "submitted", label: "Profiles submitted", hint: "CVs shared with the client" },
    { key: "interviewsScheduled", label: "Interviews scheduled", hint: "Interview rounds scheduled in the period (excl. cancelled)" },
    { key: "interviewsAttended", label: "Interviews attended", hint: "Interview rounds completed" },
    { key: "selected", label: "Selected", hint: "Applications marked Selected (or offered)" },
    { key: "offersReleased", label: "Offers released", hint: "Offers sent to candidates" },
    { key: "offersAccepted", label: "Offers accepted", hint: "Offers the candidate accepted" },
    { key: "joined", label: "Joined", hint: "Candidates who joined" },
];
export const KPI_KEYS = KPI_DEFS.map((d) => d.key);

export interface KpiEvent {
    kpi: KpiKey;
    recruiterId: string;
    day: string; // IST date YYYY-MM-DD
    jobId: string | null;
    clientId: string | null;
    /** Counted once per bucket (e.g. a candidate contacted twice in a day counts once). */
    key: string;
}

export type KpiCounts = Record<KpiKey, number>;
export const emptyCounts = (): KpiCounts => Object.fromEntries(KPI_KEYS.map((k) => [k, 0])) as KpiCounts;

const dayOf = (iso: string | null | undefined) => (iso ? (iso.length === 10 ? iso : istNow(new Date(iso)).date) : null);
const STAGE_MOVE = /([A-Z_]+) → ([A-Z_]+)/;
const OFFER_RELEASED = ["SENT", "VIEWED", "NEGOTIATION", "ACCEPTED", "DECLINED", "EXPIRED"];

/** Every KPI event in an org. Cheap enough to rebuild per request at CRM scale. */
export function kpiEvents(orgId: string): KpiEvent[] {
    const out: KpiEvent[] = [];
    const apps = applications.filter((a) => a.orgId === orgId);
    const appById = new Map(apps.map((a) => [a.id, a]));
    const jobById = new Map(jobs.filter((j) => j.orgId === orgId).map((j) => [j.id, j]));
    const clientOf = (jobId: string | null | undefined) => (jobId ? jobById.get(jobId)?.clientId ?? null : null);
    const userByName = new Map(users.filter((u) => u.orgId === orgId).map((u) => [u.name, u.id]));
    const push = (kpi: KpiKey, recruiterId: string | null | undefined, at: string | null | undefined, jobId: string | null | undefined, key: string) => {
        const day = dayOf(at);
        if (!recruiterId || !day) return;
        out.push({ kpi, recruiterId, day, jobId: jobId ?? null, clientId: clientOf(jobId), key });
    };

    // Sourced + joined come straight from applications
    for (const a of apps) {
        push("sourced", a.recruiterId, a.createdAt, a.jobId, a.id);
        if (a.stage === "JOINED") push("joined", a.recruiterId, a.actualJoinDate ?? a.updatedAt, a.jobId, a.id);
    }

    // Stage history lives in the audit log ("Name: FROM → TO"); credited to the application owner
    const movedApps = new Set<string>();
    for (const l of auditLogs) {
        if (l.orgId !== orgId || l.entity !== "Application" || l.action !== "STAGE_MOVED") continue;
        const app = appById.get(l.entityId);
        const m = l.detail.match(STAGE_MOVE);
        if (!app || !m) continue;
        movedApps.add(app.id);
        const to = m[2] as ApplicationStage;
        if (to === "CONTACTED") push("contacted", app.recruiterId, l.createdAt, app.jobId, `cand:${app.candidateId}`);
        if (to === "SHORTLISTED") push("shortlisted", app.recruiterId, l.createdAt, app.jobId, app.id);
        if (to === "SELECTED") push("selected", app.recruiterId, l.createdAt, app.jobId, app.id);
    }
    // Older applications with no recorded moves: credit stages they have clearly passed at their last update
    const reached = (stage: ApplicationStage, target: ApplicationStage) => STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(target);
    for (const a of apps) {
        if (movedApps.has(a.id) || STAGE_ORDER.indexOf(a.stage) < 0) continue;
        if (reached(a.stage, "SHORTLISTED")) push("shortlisted", a.recruiterId, a.updatedAt, a.jobId, a.id);
        if (reached(a.stage, "SELECTED")) push("selected", a.recruiterId, a.updatedAt, a.jobId, a.id);
    }

    // Connected calls = candidates contacted
    for (const c of callActivities) {
        if (c.orgId !== orgId || c.callStatus !== "CONNECTED") continue;
        const jobId = c.jobId ?? (c.applicationId ? appById.get(c.applicationId)?.jobId : null);
        push("contacted", c.recruiterId, c.calledAt, jobId, `cand:${c.candidateId}`);
    }

    // Submissions and offers live on the candidate; credit the application owner, else the named user
    for (const cand of candidates) {
        if (cand.orgId !== orgId) continue;
        for (const s of cand.clientSubmissions ?? []) {
            const owner = (s.applicationId && appById.get(s.applicationId)?.recruiterId) || userByName.get(s.submittedBy);
            push("submitted", owner, s.submittedAt, s.jobId, s.id);
        }
        for (const o of cand.offers ?? []) {
            if (!OFFER_RELEASED.includes(o.status)) continue;
            const app = o.applicationId ? appById.get(o.applicationId) : undefined;
            const owner = app?.recruiterId || userByName.get(o.createdBy);
            push("offersReleased", owner, o.offeredDate, o.jobId, o.id);
            // An offer implies the candidate was selected, even if the Selected stage was skipped
            push("selected", owner, o.offeredDate, o.jobId, o.applicationId ?? o.id);
            if (o.status === "ACCEPTED") push("offersAccepted", owner, o.respondedAt ?? o.offeredDate, o.jobId, o.id);
        }
    }

    for (const i of interviews) {
        if (i.orgId !== orgId || i.status === "CANCELLED") continue;
        const app = appById.get(i.applicationId);
        if (!app) continue;
        push("interviewsScheduled", app.recruiterId, i.scheduledAt, app.jobId, i.id);
        if (i.status === "COMPLETED") push("interviewsAttended", app.recruiterId, i.scheduledAt, app.jobId, i.id);
    }
    return out;
}

/** Counts per KPI; events with the same key count once (first occurrence wins). */
export function countEvents(events: KpiEvent[]): KpiCounts {
    const seen = new Set<string>();
    const c = emptyCounts();
    for (const e of events) {
        const k = `${e.kpi}|${e.key}`;
        if (seen.has(k)) continue;
        seen.add(k);
        c[e.kpi]++;
    }
    return c;
}

// ─── Periods and buckets ─────────────────────────────────────

export type Granularity = "daily" | "weekly" | "monthly";

const addDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const mondayOf = (date: string) => { const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); return addDays(date, dow === 0 ? -6 : 1 - dow); };
export const monthEnd = (month: string) => { const [y, m] = month.split("-").map(Number); return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`; };

export function bucketOf(day: string, g: Granularity): string {
    if (g === "monthly") return day.slice(0, 7);
    if (g === "weekly") return mondayOf(day);
    return day;
}

/** Every bucket between two dates, so empty days/weeks still show on charts. */
export function bucketsBetween(from: string, to: string, g: Granularity): string[] {
    const out: string[] = [];
    if (g === "monthly") {
        for (let m = from.slice(0, 7); m <= to.slice(0, 7);) {
            out.push(m);
            const [y, mo] = m.split("-").map(Number);
            m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
        }
        return out;
    }
    const step = g === "weekly" ? 7 : 1;
    for (let d = g === "weekly" ? mondayOf(from) : from; d <= to && out.length < 400; d = addDays(d, step)) out.push(d);
    return out;
}

export function bucketLabel(b: string, g: Granularity): string {
    if (g === "monthly") return new Date(`${b}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
    const d = new Date(`${b}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
    return g === "weekly" ? `Wk of ${d}` : d;
}

// ─── Targets: assigned vs achieved ───────────────────────────

export const TARGET_METRICS = [
    { key: "joinings", label: "Joinings", kpi: "joined" as KpiKey, money: false },
    { key: "offers", label: "Offers released", kpi: "offersReleased" as KpiKey, money: false },
    { key: "interviews", label: "Interviews scheduled", kpi: "interviewsScheduled" as KpiKey, money: false },
    { key: "submissions", label: "Profiles submitted", kpi: "submitted" as KpiKey, money: false },
    { key: "revenue", label: "Revenue", kpi: null, money: true },
] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number]["key"];

export interface TargetLine {
    metric: TargetMetric; label: string; money: boolean;
    assigned: number | null; achieved: number;
    achievementPct: number | null; remaining: number | null; shortfall: number | null; isShortfall: boolean | null;
    today: number; thisWeek: number; expectedByToday: number | null; onTrack: boolean | null;
}

/** Revenue booked by these recruiters (placement fee) per IST day. */
function revenueEvents(orgId: string, ids: Set<string>) {
    return placements.filter((p) => p.orgId === orgId && ids.has(p.recruiterId) && !["NO_SHOW", "CANCELLED"].includes(p.joiningStatus))
        .map((p) => ({ day: dayOf(p.placementDate)!, amount: p.revenueInr || 0 })).filter((x) => x.day);
}

/**
 * Target lines for a month. `targetUserId` owns the target; `creditIds` are the people whose
 * results count (a recruiter: themselves; a TA Manager: themselves plus their team).
 */
export function targetLines(orgId: string, targetUserId: string, creditIds: Set<string>, month: string, events: KpiEvent[]): TargetLine[] {
    const target = recruiterTargets.find((t) => t.orgId === orgId && t.userId === targetUserId && t.month === month) ?? null;
    const today = istNow().date;
    const from = `${month}-01`, to = monthEnd(month);
    const weekStart = mondayOf(today);
    const mine = events.filter((e) => creditIds.has(e.recruiterId) && e.day >= from && e.day <= to);
    const rev = revenueEvents(orgId, creditIds).filter((r) => r.day >= from && r.day <= to);

    // Pro-rated expectation by calendar day (current month only)
    const daysInMonth = Number(to.slice(8));
    const elapsed = today < from ? 0 : today > to ? daysInMonth : Number(today.slice(8));
    const isCurrent = today >= from && today <= to;

    return TARGET_METRICS.map((m) => {
        const achievedIn = (pred: (day: string) => boolean) => m.kpi
            ? countEvents(mine.filter((e) => e.kpi === m.kpi && pred(e.day)))[m.kpi]
            : rev.filter((r) => pred(r.day)).reduce((s, r) => s + r.amount, 0);
        const achieved = achievedIn(() => true);
        const assigned = target ? Number(target[m.key] ?? 0) : null;
        const has = assigned !== null && assigned > 0;
        const expected = has && isCurrent ? Math.round((assigned! * elapsed) / daysInMonth * 10) / 10 : has && today > to ? assigned : null;
        return {
            metric: m.key, label: m.label, money: m.money,
            assigned: has ? assigned : null,
            achieved,
            achievementPct: has ? Math.round((achieved / assigned!) * 1000) / 10 : null,
            remaining: has ? Math.max(0, assigned! - achieved) : null,
            shortfall: has ? assigned! - achieved : null,
            isShortfall: has ? achieved < assigned! : null,
            today: isCurrent ? achievedIn((d) => d === today) : 0,
            thisWeek: isCurrent ? achievedIn((d) => d >= weekStart && d <= today) : 0,
            expectedByToday: expected,
            onTrack: expected === null ? null : achieved >= expected,
        };
    });
}

/** Cumulative daily progress of one metric through a month (for the burn-up chart). */
export function dailyProgress(orgId: string, creditIds: Set<string>, month: string, metric: TargetMetric, events: KpiEvent[]) {
    const def = TARGET_METRICS.find((m) => m.key === metric)!;
    const from = `${month}-01`, to = monthEnd(month);
    const today = istNow().date;
    const perDay = new Map<string, number>();
    if (def.kpi) {
        const seen = new Set<string>();
        for (const e of events) {
            if (e.kpi !== def.kpi || !creditIds.has(e.recruiterId) || e.day < from || e.day > to || seen.has(e.key)) continue;
            seen.add(e.key);
            perDay.set(e.day, (perDay.get(e.day) ?? 0) + 1);
        }
    } else {
        for (const r of revenueEvents(orgId, creditIds)) if (r.day >= from && r.day <= to) perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.amount);
    }
    let run = 0;
    return bucketsBetween(from, to, "daily").map((d) => {
        run += perDay.get(d) ?? 0;
        return { day: d, label: String(Number(d.slice(8))), value: d <= today ? run : null };
    });
}

export const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.companyName ?? "—" : "No requisition");
export const userLabel = (u: User) => ({ id: u.id, name: u.name, role: u.role, designation: u.designation ?? null });
