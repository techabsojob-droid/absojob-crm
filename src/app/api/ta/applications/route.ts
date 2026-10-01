import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, candidates, jobs, clients, interviews, users, referrals, addAudit, addNotification, nextIds } from "@/lib/mock/data";
import { canWorkOnApplication, isJobAssignedTo, isRecruitmentManager, markApplicationJoined, syncReferralFromApplication, validRecruiters } from "@/lib/mock/pipeline";
import { canTransition, allowedNextStages, TERMINAL_STAGES, STAGE_ORDER, type ApplicationStage } from "@/lib/types";

const ALL_STAGES = new Set<string>([...STAGE_ORDER, "ON_HOLD", "REJECTED", "BACKED_OUT", "BLACKLISTED"]);

// GET: pipeline applications (mine / org-wide for manager), joined with candidate + job
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    const mineOnly = url.searchParams.get("mine") === "1";

    // Recruiters see applications they own or on jobs assigned to them; managers see the whole org
    let list = applications.filter((a) => canWorkOnApplication(me, a));
    if (mineOnly) list = list.filter((a) => a.recruiterId === me.id);

    let enriched = list.map((a) => {
        const c = candidates.find((x) => x.id === a.candidateId)!;
        const j = jobs.find((x) => x.id === a.jobId)!;
        const client = j ? clients.find((cl) => cl.id === j.clientId) : undefined;
        const openOffer = c?.offers?.find((o) => o.applicationId === a.id && ["SENT", "VIEWED", "NEGOTIATION"].includes(o.status));
        return {
            ...a,
            recruiterName: users.find((u) => u.id === a.recruiterId)?.name ?? "Unassigned",
            openOfferId: openOffer?.id ?? null,
            openOfferCtcLpa: openOffer?.offeredCtcLpa ?? null,
            openOfferStatus: openOffer?.status ?? null,
            referredBy: referrals.find((r) => r.candidateId === a.candidateId && r.orgId === a.orgId)
                ? users.find((u) => u.id === referrals.find((r) => r.candidateId === a.candidateId)!.agentId)?.name ?? null
                : null,
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
                .filter((i) => i.applicationId === a.id && ["SCHEDULED", "RESCHEDULED"].includes(i.status))
                .sort((x, y) => +new Date(x.scheduledAt) - +new Date(y.scheduledAt))[0]?.scheduledAt ?? null,
        };
    });

    if (jobId) enriched = enriched.filter((a) => a.jobId === jobId);

    return NextResponse.json(enriched);
}

// PATCH: move stage (validated by the pipeline state machine), update notes, reject / hold
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, stage, screeningNotes, rejectionReason, holdReason, joinDate, recruiterId } = await request.json();
    const app = applications.find((a) => a.id === id && a.orgId === me.orgId);
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    if (!canWorkOnApplication(me, app)) {
        return NextResponse.json({ error: "You can only update applications assigned to you" }, { status: 403 });
    }

    const oldStage = app.stage;
    const cand = candidates.find((c) => c.id === app.candidateId);

    // Reassign owner recruiter (managers only)
    if (recruiterId !== undefined && recruiterId !== app.recruiterId) {
        if (!isRecruitmentManager(me)) {
            return NextResponse.json({ error: "Only Super Admin or TA Manager can reassign candidates" }, { status: 403 });
        }
        const { ok } = validRecruiters(me.orgId, [recruiterId]);
        if (!ok.length) return NextResponse.json({ error: "Recruiter not found in your organization" }, { status: 400 });
        const prevOwner = users.find((u) => u.id === app.recruiterId)?.name ?? "Unassigned";
        app.recruiterId = ok[0].id;
        app.updatedAt = new Date().toISOString();
        if (cand) {
            cand.ownership = { ...(cand.ownership || {}), assignedRecruiterId: ok[0].id, assignedRecruiterName: ok[0].name, assignedAt: new Date().toISOString() } as typeof cand.ownership;
        }
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "APPLICATION_REASSIGNED", entity: "Application", entityId: app.id,
            detail: `${cand?.name ?? "Candidate"}: ${prevOwner} → ${ok[0].name}`,
        });
        if (ok[0].id !== me.id) {
            addNotification({
                orgId: me.orgId, userId: ok[0].id,
                title: "Candidate assigned to you",
                message: `${cand?.name ?? "A candidate"} for ${jobs.find((j) => j.id === app.jobId)?.title ?? "a job"} is now yours`,
                link: "/ta/pipeline",
            });
        }
    }

    if (stage && stage !== oldStage) {
        if (!ALL_STAGES.has(stage)) {
            return NextResponse.json({ error: `Unknown stage: ${stage}` }, { status: 400 });
        }
        const target = stage as ApplicationStage;

        if (target === "ONBOARDING") {
            return NextResponse.json(
                { error: "Use 'Start Onboarding' after the offer is accepted — it creates the HR onboarding record." },
                { status: 400 }
            );
        }
        if (target === "OFFER_SENT" && oldStage !== "ON_HOLD") {
            return NextResponse.json({ error: "Use 'Release Offer' to move a candidate to OFFER SENT — it records the offered CTC and joining date." }, { status: 400 });
        }
        if (target === "BLACKLISTED") {
            return NextResponse.json({ error: "Blacklist the candidate from the candidate profile instead" }, { status: 400 });
        }
        if (!canTransition(oldStage, target)) {
            const allowed = allowedNextStages(oldStage).filter((s) => s !== "ONBOARDING").map((s) => s.replace(/_/g, " "));
            return NextResponse.json(
                {
                    error: `Cannot move from ${oldStage.replace(/_/g, " ")} to ${target.replace(/_/g, " ")}.` +
                        (allowed.length ? ` Allowed: ${allowed.join(", ")}` : " This is a final stage."),
                },
                { status: 422 }
            );
        }
        if (target === "REJECTED" && !String(rejectionReason ?? "").trim()) {
            return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
        }
        if (target === "ON_HOLD" && !String(holdReason ?? "").trim()) {
            return NextResponse.json({ error: "A hold reason is required" }, { status: 400 });
        }

        // Keep the offer record in step with the pipeline
        const openOffer = cand?.offers?.find((o) => o.applicationId === app.id && ["SENT", "VIEWED", "NEGOTIATION"].includes(o.status));
        if (openOffer && target === "OFFER_ACCEPTED") {
            openOffer.status = "ACCEPTED";
            openOffer.respondedAt = new Date().toISOString();
            if (openOffer.joiningDate) app.expectedJoinDate = openOffer.joiningDate;
        } else if (openOffer && (target === "REJECTED" || target === "BACKED_OUT")) {
            openOffer.status = target === "BACKED_OUT" ? "DECLINED" : "WITHDRAWN";
            openOffer.respondedAt = new Date().toISOString();
            if (target === "BACKED_OUT") openOffer.declineReason = String(rejectionReason ?? "Candidate backed out");
        }

        if (target === "JOINED") {
            markApplicationJoined(app, me, joinDate || app.expectedJoinDate || new Date().toISOString().split("T")[0]);
        } else {
            app.stage = target;
            app.updatedAt = new Date().toISOString();
            if (target === "REJECTED") app.rejectionReason = String(rejectionReason).trim();
            if (target === "ON_HOLD") {
                app.holdReason = String(holdReason).trim();
                app.stageBeforeHold = oldStage;
            }
            if (oldStage === "ON_HOLD") app.stageBeforeHold = null;
            if (!TERMINAL_STAGES.includes(target) && target !== "ON_HOLD") {
                app.holdReason = null;
                app.rejectionReason = null;
            }
        }

        const reason = target === "REJECTED" ? ` (reason: ${app.rejectionReason})` : target === "ON_HOLD" ? ` (reason: ${app.holdReason})` : "";
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: target === "REJECTED" ? "CANDIDATE_REJECTED" : "STAGE_MOVED", entity: "Application", entityId: app.id,
            detail: `${cand?.name ?? "Candidate"}: ${oldStage} → ${target}${reason}`,
        });
        syncReferralFromApplication(app, me);
    }
    if (screeningNotes !== undefined) app.screeningNotes = screeningNotes;

    return NextResponse.json(app);
}

// POST: push an existing DB candidate into a requisition pipeline
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.candidateId || !body.jobId) {
        return NextResponse.json({ error: "candidateId and jobId required" }, { status: 400 });
    }

    const cand = candidates.find((c) => c.id === body.candidateId && c.orgId === me.orgId);
    if (!cand) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    if (cand.blacklisted) return NextResponse.json({ error: "Candidate is blacklisted" }, { status: 422 });
    const job = jobs.find((j) => j.id === body.jobId && j.orgId === me.orgId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (["DRAFT", "PENDING_APPROVAL", "FULFILLED", "CLOSED", "CANCELLED", "ON_HOLD"].includes(job.status)) {
        return NextResponse.json({ error: `Job is ${job.status.replace(/_/g, " ").toLowerCase()} and not accepting candidates` }, { status: 422 });
    }

    if (!isRecruitmentManager(me) && !isJobAssignedTo(job.id, me.id)) {
        return NextResponse.json({ error: "You can only add candidates to requisitions assigned to you" }, { status: 403 });
    }

    const dup = applications.find(
        (a) => a.orgId === me.orgId && a.candidateId === body.candidateId && a.jobId === body.jobId && !["REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)
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
    syncReferralFromApplication(app, me);

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "CANDIDATE_SOURCED", entity: "Application", entityId: app.id,
        detail: `${cand.name} added to ${job.title}`,
    });

    return NextResponse.json(app, { status: 201 });
}
