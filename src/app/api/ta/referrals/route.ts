import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { referrals, candidates, jobs, clients, users, applications, referralMessages, addAudit, addNotification, nextIds } from "@/lib/mock/data";
import { isJobAssignedTo, isRecruitmentManager, syncReferralFromApplication } from "@/lib/mock/pipeline";
import type { Application } from "@/lib/types";

const CLOSED_JOB = ["DRAFT", "PENDING_APPROVAL", "FULFILLED", "CLOSED", "CANCELLED", "ON_HOLD"];

// GET: referral review queue for TA (managers: all; recruiters: referrals for their jobs or not yet mapped)
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const status = new URL(request.url).searchParams.get("status");

    const list = referrals
        .filter((r) => r.orgId === me.orgId)
        .filter((r) => isRecruitmentManager(me) || !r.jobId || isJobAssignedTo(r.jobId, me.id))
        .filter((r) => !status || status === "ALL" || r.status === status)
        .map((r) => {
            const cand = candidates.find((c) => c.id === r.candidateId);
            const job = r.jobId ? jobs.find((j) => j.id === r.jobId) : undefined;
            const app = applications.find((a) => a.candidateId === r.candidateId && (!r.jobId || a.jobId === r.jobId));
            return {
                ...r,
                candidateName: cand?.name ?? "—",
                candidateEmail: cand?.email ?? "",
                candidatePhone: cand?.phone ?? "",
                currentCompany: cand?.currentCompany ?? null,
                totalExperienceYears: cand?.totalExperienceYears ?? 0,
                expectedCtcLpa: cand?.expectedCtcLpa ?? 0,
                skills: cand?.skills ?? [],
                jobTitle: job?.title ?? null,
                clientName: job ? clients.find((c) => c.id === job.clientId)?.companyName ?? null : null,
                agentName: users.find((u) => u.id === r.agentId)?.name ?? "—",
                applicationId: app?.id ?? null,
                applicationStage: app?.stage ?? null,
                resumeUrl: r.resumeFileId ? `/api/files/${r.resumeFileId}` : cand?.resumeUrl ?? null,
                messages: referralMessages.filter((m) => m.referralId === r.id).length,
            };
        })
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return NextResponse.json(list);
}

// PATCH: accept a referral into a job pipeline, or reject it with a reason
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, action, jobId, reason } = await request.json();
    const ref = referrals.find((r) => r.id === id && r.orgId === me.orgId);
    if (!ref) return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    if (["HIRED", "REJECTED"].includes(ref.status)) {
        return NextResponse.json({ error: `Referral is already ${ref.status.toLowerCase()}` }, { status: 409 });
    }
    const cand = candidates.find((c) => c.id === ref.candidateId);

    if (action === "REJECT") {
        if (!String(reason ?? "").trim()) return NextResponse.json({ error: "A reason is required" }, { status: 400 });
        if (!isRecruitmentManager(me) && ref.jobId && !isJobAssignedTo(ref.jobId, me.id)) {
            return NextResponse.json({ error: "This referral is for a job not assigned to you" }, { status: 403 });
        }
        ref.status = "REJECTED";
        ref.reviewNotes = String(reason).trim();
        ref.updatedAt = new Date().toISOString();
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "REFERRAL_REJECTED", entity: "Referral", entityId: ref.id, detail: `${cand?.name ?? "Candidate"}: ${ref.reviewNotes}` });
        addNotification({ orgId: me.orgId, userId: ref.agentId, title: "Referral not taken forward", message: `${cand?.name ?? "Your referral"} — ${ref.reviewNotes}`, link: "/portal/referrals" });
        return NextResponse.json(ref);
    }

    if (action !== "ACCEPT") return NextResponse.json({ error: "action must be ACCEPT or REJECT" }, { status: 400 });

    const targetJobId = jobId || ref.jobId;
    const job = jobs.find((j) => j.id === targetJobId && j.orgId === me.orgId);
    if (!job) return NextResponse.json({ error: "Select the job to add this candidate to" }, { status: 400 });
    if (CLOSED_JOB.includes(job.status)) return NextResponse.json({ error: `Job is ${job.status.replace(/_/g, " ").toLowerCase()}` }, { status: 422 });
    if (!isRecruitmentManager(me) && !isJobAssignedTo(job.id, me.id)) {
        return NextResponse.json({ error: "You can only add candidates to requisitions assigned to you" }, { status: 403 });
    }
    if (!cand) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    if (cand.blacklisted) return NextResponse.json({ error: "Candidate is blacklisted" }, { status: 422 });

    let app = applications.find(
        (a) => a.orgId === me.orgId && a.candidateId === cand.id && a.jobId === job.id && !["REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)
    );
    if (!app) {
        // Owner: the job's primary recruiter, else the reviewer
        const owner = job.primaryRecruiterId || job.assignedTas?.[0] || me.id;
        const created: Application = {
            id: nextIds.application(),
            orgId: me.orgId,
            candidateId: cand.id,
            jobId: job.id,
            stage: "SCREENING",
            recruiterId: owner,
            fitScore: 0,
            screeningNotes: `Referral from ${users.find((u) => u.id === ref.agentId)?.name ?? "agent"}${ref.reviewNotes ? ` — ${ref.reviewNotes}` : ""}`,
            rejectionReason: null,
            expectedJoinDate: null,
            actualJoinDate: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        applications.push(created);
        app = created;
        if (owner !== me.id) {
            addNotification({ orgId: me.orgId, userId: owner, title: "Referral added to your pipeline", message: `${cand.name} for ${job.title}`, link: "/ta/pipeline" });
        }
    }
    ref.jobId = job.id;
    cand.tags = (cand.tags || []).filter((t) => t !== "Pending Review");
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "REFERRAL_ACCEPTED", entity: "Referral", entityId: ref.id, detail: `${cand.name} added to ${job.title} (application ${app.id})` });
    syncReferralFromApplication(app, me);

    return NextResponse.json({ referral: ref, applicationId: app.id });
}
