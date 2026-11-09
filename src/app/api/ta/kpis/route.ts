import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { clients, jobs, users } from "@/lib/mock/data";
import { accessibleClientIds, canAccessClient, canAccessJobId, hasOrgWideRecruitmentAccess, teamScopeIds } from "@/lib/mock/pipeline";
import { istNow } from "@/lib/mock/ess";
import { KPI_DEFS, bucketLabel, bucketOf, bucketsBetween, clientName, countEvents, emptyCounts, kpiEvents, userLabel, type Granularity, type KpiEvent } from "@/lib/mock/kpi";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GRANULARITIES: Granularity[] = ["daily", "weekly", "monthly"];
const DAY = 86400000;

// GET /api/ta/kpis?from=&to=&granularity=daily|weekly|monthly&recruiterId=&clientId=&jobId=
// Recruiter-wise KPIs from live CRM records. Recruiters see only themselves; a TA Manager sees
// themselves and their team; Super Admin sees every recruiter.
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const p = new URL(request.url).searchParams;

    const today = istNow().date;
    const to = DATE_RE.test(p.get("to") ?? "") ? p.get("to")! : today;
    const from = DATE_RE.test(p.get("from") ?? "") ? p.get("from")! : `${today.slice(0, 7)}-01`;
    if (from > to) return NextResponse.json({ error: "'From' date must be on or before 'To' date" }, { status: 400 });
    if (+new Date(to) - +new Date(from) > 366 * 2 * DAY) return NextResponse.json({ error: "Pick a range of two years or less" }, { status: 400 });
    const granularity = (GRANULARITIES.includes(p.get("granularity") as Granularity) ? p.get("granularity") : "daily") as Granularity;
    const effectiveG: Granularity = granularity === "daily" && +new Date(to) - +new Date(from) > 120 * DAY ? "weekly" : granularity;

    // Whose numbers this user may see
    const scope = me.role === "TA_RECRUITER" ? new Set([me.id]) : teamScopeIds(me);
    const people = users.filter((u) => u.orgId === me.orgId && ["TA_RECRUITER", "TA_MANAGER"].includes(u.role) && u.status !== "EXITED" && (!scope || scope.has(u.id)));
    const recruiterId = p.get("recruiterId");
    if (recruiterId && recruiterId !== "ALL" && !people.some((u) => u.id === recruiterId)) {
        return NextResponse.json({ error: "You can only view KPIs for yourself or your team" }, { status: 403 });
    }
    const clientId = p.get("clientId");
    if (clientId && clientId !== "ALL" && !canAccessClient(me, clientId)) return NextResponse.json({ error: "This client is not assigned to you" }, { status: 403 });
    const jobId = p.get("jobId");
    if (jobId && jobId !== "ALL" && !canAccessJobId(me, jobId)) return NextResponse.json({ error: "This requisition is not assigned to you" }, { status: 403 });

    const ids = new Set(recruiterId && recruiterId !== "ALL" ? [recruiterId] : people.map((u) => u.id));
    const visibleClients = accessibleClientIds(me);
    let events: KpiEvent[] = kpiEvents(me.orgId).filter((e) => ids.has(e.recruiterId) && e.day >= from && e.day <= to);
    if (clientId && clientId !== "ALL") events = events.filter((e) => e.clientId === clientId);
    if (jobId && jobId !== "ALL") events = events.filter((e) => e.jobId === jobId);

    // Trend
    const buckets = bucketsBetween(from, to, effectiveG);
    const byBucket = new Map<string, KpiEvent[]>(buckets.map((b) => [b, []]));
    for (const e of events) byBucket.get(bucketOf(e.day, effectiveG))?.push(e);
    const series = buckets.map((b) => ({ bucket: b, label: bucketLabel(b, effectiveG), ...countEvents(byBucket.get(b)!) }));

    // Recruiter comparison
    const recruiters = people.filter((u) => ids.has(u.id)).map((u) => {
        const c = countEvents(events.filter((e) => e.recruiterId === u.id));
        const rate = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
        return {
            ...userLabel(u),
            isMe: u.id === me.id,
            totals: c,
            conversion: {
                submitToInterview: rate(c.interviewsScheduled, c.submitted),
                interviewToSelect: rate(c.selected, c.interviewsAttended),
                offerAcceptance: rate(c.offersAccepted, c.offersReleased),
                offerToJoin: rate(c.joined, c.offersAccepted),
            },
        };
    }).sort((a, b) => b.totals.joined - a.totals.joined || b.totals.submitted - a.totals.submitted || a.name.localeCompare(b.name));

    // Client breakdown — clients the viewer can't access are grouped, never named
    const byClient = new Map<string, KpiEvent[]>();
    for (const e of events) {
        const k = e.clientId && visibleClients.has(e.clientId) ? e.clientId : e.clientId ? "__other" : "__none";
        byClient.set(k, [...(byClient.get(k) ?? []), e]);
    }
    const clientRows = [...byClient.entries()].map(([k, list]) => ({
        clientId: k.startsWith("__") ? null : k,
        clientName: k === "__other" ? "Other clients" : k === "__none" ? "Not linked to a requisition" : clientName(k),
        totals: countEvents(list),
    })).sort((a, b) => b.totals.submitted + b.totals.joined * 5 - (a.totals.submitted + a.totals.joined * 5));

    const visibleJobs = jobs.filter((j) => j.orgId === me.orgId && (hasOrgWideRecruitmentAccess(me) || canAccessJobId(me, j.id)));
    return NextResponse.json({
        range: { from, to, granularity: effectiveG, requestedGranularity: granularity },
        kpis: KPI_DEFS,
        totals: events.length ? countEvents(events) : emptyCounts(),
        series,
        recruiters,
        byClient: clientRows,
        canCompare: me.role !== "TA_RECRUITER",
        options: {
            recruiters: people.map(userLabel),
            clients: clients.filter((c) => visibleClients.has(c.id)).map((c) => ({ id: c.id, name: c.companyName })).sort((a, b) => a.name.localeCompare(b.name)),
            jobs: visibleJobs.map((j) => ({ id: j.id, title: j.title, code: j.requisitionCode ?? null, clientId: j.clientId })),
        },
    });
}
