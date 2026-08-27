import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, candidates, jobs, clients, interviews, addAudit, nextIds } from "@/lib/mock/data";
import type { ApplicationStage } from "@/lib/types";

// GET: pipeline applications (mine / org-wide for manager), joined with candidate + job
export async function GET(request: Request) {
    const auth = await requireRole("TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    const mineOnly = url.searchParams.get("mine") === "1" && me.role === "TA_RECRUITER";

    let list = applications.filter((a) => a.orgId === me.orgId);
    if (mineOnly) list = list.filter((a) => a.recruiterId === me.id);

    let enriched = list.map((a) => {
        const c = candidates.find((x) => x.id === a.candidateId)!;
        const j = jobs.find((x) => x.id === a.jobId)!;
        const client = j ? clients.find((cl) => cl.id === j.clientId) : undefined;
        return {
            ...a,
            candidateName: c?.name ?? "—",
            candidateEmail: c?.email ?? "",
            candidatePhone: c?.phone ?? "",
            currentCompany: c?.currentCompany ?? null,
            expectedCtcLpa: c?.expectedCtcLpa ?? 0,
            currentCtcLpa: c?.currentCtcLpa ?? 0,
            totalExperienceYears: c?.totalExperienceYears ?? 0,
            noticePeriodDays: c?.noticePeriodDays ?? 0,
            skills: c?.skills ?? [],
            jobTitle: j?.title ?? "—",
            clientName: client?.companyName ?? null,
            nextInterview: interviews
                .filter((i) => i.applicationId === a.id && i.status === "SCHEDULED")
                .sort((x, y) => +new Date(x.scheduledAt) - +new Date(y.scheduledAt))[0]?.scheduledAt ?? null,
        };
    });

    if (jobId) enriched = enriched.filter((a) => a.jobId === jobId);

    return NextResponse.json(enriched);
}

// PATCH: move stage, update notes, reject etc.
export async function PATCH(request: Request) {
    const auth = await requireRole("TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, stage, screeningNotes, rejectionReason } = await request.json();
    const app = applications.find((a) => a.id === id && a.orgId === me.orgId);
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const oldStage = app.stage;
    if (stage) {
        app.stage = stage as ApplicationStage;
        app.updatedAt = new Date().toISOString();

        const job = jobs.find((j) => j.id === app.jobId);
        const cand = candidates.find((c) => c.id === app.candidateId);

        if (stage === "JOINED") {
            if (job && job.filled < job.openings) job.filled += 1;
            if (job && job.filled >= job.openings) job.status = "FULFILLED";
            if (cand) cand.updatedAt = new Date().toISOString();
            const { addNotification } = await import("@/lib/mock/data");
            addNotification({
                orgId: me.orgId,
                userId: me.id,
                title: "Placement confirmed 🎉",
                message: `${cand?.name ?? "Candidate"} joined ${job?.title ?? ""}`,
                link: "/ta/pipeline",
            });
        }

        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "STAGE_MOVED", entity: "Application", entityId: app.id,
            detail: `${cand?.name ?? "Candidate"}: ${oldStage} → ${stage}`,
        });
    }
    if (screeningNotes !== undefined) app.screeningNotes = screeningNotes;
    if (rejectionReason !== undefined) app.rejectionReason = rejectionReason;

    return NextResponse.json(app);
}

// POST: push an existing DB candidate into a requisition pipeline
export async function POST(request: Request) {
    const auth = await requireRole("TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.candidateId || !body.jobId) {
        return NextResponse.json({ error: "candidateId and jobId required" }, { status: 400 });
    }

    const dup = applications.find(
        (a) => a.orgId === me.orgId && a.candidateId === body.candidateId && a.jobId === body.jobId && !["REJECTED", "BACKED_OUT"].includes(a.stage)
    );
    if (dup) return NextResponse.json({ error: "Candidate already in pipeline for this job" }, { status: 409 });

    const app = {
        id: nextIds.application(),
        orgId: me.orgId,
        candidateId: body.candidateId,
        jobId: body.jobId,
        stage: "SOURCED" as ApplicationStage,
        recruiterId: me.id,
        fitScore: Number(body.fitScore) || Math.floor(50 + Math.random() * 40),
        screeningNotes: body.screeningNotes ?? null,
        rejectionReason: null,
        expectedJoinDate: null,
        actualJoinDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    applications.push(app);

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "CANDIDATE_SOURCED", entity: "Application", entityId: app.id,
        detail: `Added to ${jobs.find((j) => j.id === app.jobId)?.title ?? "pipeline"}`,
    });

    return NextResponse.json(app, { status: 201 });
}
