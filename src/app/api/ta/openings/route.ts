import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, clients, jobs, users } from "@/lib/mock/data";
import { canAccessJob } from "@/lib/mock/pipeline";
import type { JobRequisition } from "@/lib/types";

const OPEN = ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE", "JOINING"];
const CLOSED_APP = ["JOINED", "REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "BLACKLISTED"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const postedOf = (j: JobRequisition) => (j.publishedAt ?? j.approvedAt ?? j.createdAt).slice(0, 10);

// GET /api/ta/openings?industry=&clientId=&q=&location=&experience=&employmentType=&status=OPEN|ALL|<status>&recruiterId=&postedFrom=&postedTo=
// Every job opening the user is authorised to see (same access rules as requisitions), across
// the industries of their clients, with facets for the filter bar.
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const p = new URL(request.url).searchParams;
    const val = (k: string) => { const v = (p.get(k) ?? "").trim(); return v && v !== "ALL" ? v : null; };

    // Authorised openings only; drafts stay private to their author
    const visible = jobs.filter((j) => canAccessJob(me, j) && (j.status !== "DRAFT" || j.requestedById === me.id));
    const clientOf = new Map(clients.filter((c) => c.orgId === me.orgId).map((c) => [c.id, c]));
    const name = (id: string | null | undefined) => (id ? users.find((u) => u.id === id)?.name ?? null : null);

    const rows = visible.map((j) => {
        const c = clientOf.get(j.clientId);
        const apps = applications.filter((a) => a.jobId === j.id);
        const joined = apps.filter((a) => a.stage === "JOINED").length;
        const filled = Math.min(j.openings || 0, Math.max(j.filled || 0, joined));
        const recruiterIds = [...new Set([j.primaryRecruiterId, ...(j.assignedTas ?? [])].filter(Boolean) as string[])];
        return {
            id: j.id, code: j.requisitionCode ?? null, title: j.title, department: j.department,
            clientId: j.clientId, clientName: c?.companyName ?? "—", industry: c?.industry || "Other",
            location: j.location || [j.city, j.locationState].filter(Boolean).join(", ") || "—",
            workMode: j.workMode ?? null, employmentType: j.employmentType,
            experienceMin: j.experienceMinYears, experienceMax: j.experienceMaxYears,
            salaryMinLpa: j.salaryMinLpa, salaryMaxLpa: j.salaryMaxLpa,
            vacancies: j.openings, filled, remaining: Math.max(0, (j.openings || 0) - filled),
            status: j.status, isOpen: OPEN.includes(j.status), priority: j.priority,
            primaryRecruiterId: j.primaryRecruiterId ?? recruiterIds[0] ?? null,
            primaryRecruiterName: name(j.primaryRecruiterId ?? recruiterIds[0]),
            recruiters: recruiterIds.map((id) => ({ id, name: name(id) ?? id })),
            inPipeline: apps.filter((a) => !CLOSED_APP.includes(a.stage)).length,
            skills: j.skills ?? [],
            postedAt: postedOf(j),
            targetCloseDate: j.targetCloseDate ?? null,
        };
    });

    // Facets come from what this user can see, so they never reveal other clients
    const uniq = <T,>(xs: T[]) => [...new Set(xs)].filter((x) => x !== null && x !== undefined && x !== "") as NonNullable<T>[];
    const facets = {
        industries: uniq(rows.map((r) => r.industry)).sort(),
        clients: uniq(rows.map((r) => r.clientId)).map((id) => ({ id, name: clientOf.get(id)?.companyName ?? id })).sort((a, b) => a.name.localeCompare(b.name)),
        locations: uniq(rows.map((r) => r.location)).sort(),
        employmentTypes: uniq(rows.map((r) => r.employmentType)).sort(),
        statuses: uniq(rows.map((r) => r.status)).sort(),
        recruiters: uniq(rows.flatMap((r) => r.recruiters.map((x) => x.id))).map((id) => ({ id, name: name(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name)),
    };

    const q = val("q")?.toLowerCase();
    const location = val("location")?.toLowerCase();
    const exp = val("experience") !== null ? Number(val("experience")) : null;
    const status = p.get("status") ?? "OPEN";
    const postedFrom = DATE_RE.test(p.get("postedFrom") ?? "") ? p.get("postedFrom")! : null;
    const postedTo = DATE_RE.test(p.get("postedTo") ?? "") ? p.get("postedTo")! : null;

    const items = rows.filter((r) =>
        (!val("industry") || r.industry === val("industry"))
        && (!val("clientId") || r.clientId === val("clientId"))
        && (!q || r.title.toLowerCase().includes(q) || (r.code ?? "").toLowerCase().includes(q) || r.skills.some((s) => s.toLowerCase().includes(q)))
        && (!location || r.location.toLowerCase().includes(location))
        && (exp === null || !Number.isFinite(exp) || (r.experienceMin <= exp && exp <= r.experienceMax))
        && (!val("employmentType") || r.employmentType === val("employmentType"))
        && (status === "ALL" || (status === "OPEN" ? r.isOpen : r.status === status))
        && (!val("recruiterId") || r.recruiters.some((x) => x.id === val("recruiterId")))
        && (!postedFrom || r.postedAt >= postedFrom)
        && (!postedTo || r.postedAt <= postedTo)
    ).sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || b.postedAt.localeCompare(a.postedAt));

    const byIndustry = facets.industries.map((ind) => {
        const xs = items.filter((r) => r.industry === ind);
        return { industry: ind, openings: xs.length, vacancies: xs.reduce((s, r) => s + r.remaining, 0) };
    }).filter((x) => x.openings > 0);

    return NextResponse.json({
        items,
        facets,
        summary: {
            openings: items.length,
            vacancies: items.reduce((s, r) => s + r.remaining, 0),
            clients: new Set(items.map((r) => r.clientId)).size,
            industries: byIndustry.length,
            unassigned: items.filter((r) => r.isOpen && r.recruiters.length === 0).length,
        },
        byIndustry,
    });
}
