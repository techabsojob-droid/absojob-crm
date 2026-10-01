// ─── Shared pipeline side-effects ─────────────────────────────
// Every path that changes an application's lifecycle (pipeline move,
// onboarding conversion, offer response) goes through these helpers so
// job fill counts, placements, audit and notifications stay consistent.

import type { Application, ApprovalRequest, JobRequisition, ReferralStatus, User, UserRole } from "@/lib/types";
import { addAudit, addNotification, applications, approvals, candidates, clients, commissionLedger, jobs, nextIds, placements, referrals, users } from "./data";

export function notifyRoles(
    orgId: string,
    roles: UserRole[],
    n: { title: string; message: string; link: string | null },
    extraUserIds: (string | null | undefined)[] = []
) {
    const targets = new Set<string>(
        users.filter((u) => u.orgId === orgId && u.status === "ACTIVE" && roles.includes(u.role)).map((u) => u.id)
    );
    extraUserIds.forEach((id) => { if (id) targets.add(id); });
    targets.forEach((userId) => addNotification({ orgId, userId, ...n }));
}

/**
 * Marks an application as JOINED exactly once: increments the job fill count,
 * closes the job when all openings are filled, and creates the placement record.
 * Returns false if the application was already joined (idempotent).
 */
export function markApplicationJoined(app: Application, actor: User, joinDate: string): boolean {
    if (app.stage === "JOINED") return false;

    const now = new Date().toISOString();
    app.stage = "JOINED";
    app.actualJoinDate = joinDate;
    app.updatedAt = now;

    const job = jobs.find((j) => j.id === app.jobId && j.orgId === app.orgId);
    const cand = candidates.find((c) => c.id === app.candidateId);
    if (cand) cand.updatedAt = now;

    if (job) {
        job.filled = Math.min(job.openings, (job.filled || 0) + 1);
        if (job.filled >= job.openings) job.status = "FULFILLED";
        job.updatedAt = now;
    }

    const alreadyPlaced = placements.some(
        (p) => p.orgId === app.orgId && p.candidateId === app.candidateId && p.jobId === app.jobId
    );
    if (job && cand && !alreadyPlaced) {
        const client = clients.find((c) => c.id === job.clientId);
        const recruiter = users.find((u) => u.id === app.recruiterId);
        const acceptedOffer = cand.offers?.find((o) => o.jobId === job.id && o.status === "ACCEPTED");
        const offeredSalaryLpa = acceptedOffer?.offeredCtcLpa ?? cand.expectedCtcLpa ?? 0;
        const commissionRate = client?.billing?.feePercent ?? client?.commissionRate ?? 8.33;
        const guaranteeDays = client?.billing?.guaranteeDays ?? 90;

        placements.unshift({
            id: `plc-${crypto.randomUUID().slice(0, 8)}`,
            orgId: app.orgId,
            candidateId: cand.id,
            candidateName: cand.name,
            clientId: job.clientId,
            clientName: client?.companyName ?? "—",
            jobId: job.id,
            jobTitle: job.title,
            recruiterId: app.recruiterId,
            recruiterName: recruiter?.name ?? "—",
            accountManagerName: users.find((u) => u.id === client?.accountManagerId)?.name,
            placementDate: now.split("T")[0],
            offeredPosition: job.title,
            offeredSalaryLpa,
            joiningDate: joinDate,
            joiningStatus: "JOINED",
            revenueInr: Math.round(offeredSalaryLpa * 100000 * (commissionRate / 100)),
            invoiceId: null,
            invoiceNumber: null,
            guaranteePeriodDays: guaranteeDays,
            guaranteeEndDate: new Date(new Date(joinDate).getTime() + guaranteeDays * 86400000).toISOString().split("T")[0],
            replacementStatus: "NO_REPLACEMENT",
            notes: null,
            createdAt: now,
        });
    }

    addAudit({
        orgId: app.orgId, actorUserId: actor.id, actorRole: actor.role,
        action: "CANDIDATE_JOINED", entity: "Application", entityId: app.id,
        detail: `${cand?.name ?? "Candidate"} joined ${job?.title ?? ""} on ${joinDate}`,
    });

    if (job && cand) {
        notifyRoles(app.orgId, ["FINANCE_ADMIN"], {
            title: "Placement ready to bill",
            message: `${cand.name} joined ${job.title} (${clients.find((c) => c.id === job.clientId)?.companyName ?? "client"})`,
            link: "/finance/billing",
        });
    }

    notifyRoles(
        app.orgId,
        ["TA_MANAGER"],
        {
            title: "Placement confirmed 🎉",
            message: `${cand?.name ?? "Candidate"} joined ${job?.title ?? ""}`,
            link: "/ta/pipeline",
        },
        [app.recruiterId]
    );

    syncReferralFromApplication(app, actor);

    return true;
}

// ─── Referral loop: agent referral ↔ pipeline ↔ incentive ─────

/** Tiered referral incentive by offered CTC (LPA). */
export function referralIncentiveFor(ctcLpa: number): number {
    if (ctcLpa >= 20) return 25000;
    if (ctcLpa >= 10) return 15000;
    if (ctcLpa >= 5) return 10000;
    return 5000;
}

const ACTIVE_REVIEW: string[] = ["SOURCED", "SCREENING"];
const SHORTLIST: string[] = ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING"];
const CLOSED: string[] = ["REJECTED", "BACKED_OUT", "BLACKLISTED"];

/**
 * Mirrors an application's progress onto the agent's referral and, on joining,
 * books the referral incentive in the commission ledger (once).
 */
export function syncReferralFromApplication(app: Application, actor: User) {
    const ref = referrals.find((r) => r.orgId === app.orgId && r.candidateId === app.candidateId && (r.jobId === app.jobId || r.jobId === null))
        ?? referrals.find((r) => r.orgId === app.orgId && r.candidateId === app.candidateId);
    if (!ref) return;
    if (!ref.jobId) ref.jobId = app.jobId;

    let next: ReferralStatus | null = null;
    if (app.stage === "JOINED") next = "HIRED";
    else if (SHORTLIST.includes(app.stage)) next = "SHORTLISTED";
    else if (ACTIVE_REVIEW.includes(app.stage)) next = "UNDER_REVIEW";
    else if (CLOSED.includes(app.stage)) {
        const otherActive = applications.some((a) => a.id !== app.id && a.candidateId === app.candidateId && !CLOSED.includes(a.stage));
        if (!otherActive) next = "REJECTED";
    }
    // Never move a hired referral backwards
    if (!next || next === ref.status || ref.status === "HIRED") return;

    const job = jobs.find((j) => j.id === app.jobId);
    const cand = candidates.find((c) => c.id === app.candidateId);
    ref.status = next;
    (ref as { updatedAt?: string }).updatedAt = new Date().toISOString();

    if (next === "HIRED") {
        const offer = cand?.offers?.find((o) => o.applicationId === app.id && o.status === "ACCEPTED");
        if (!ref.incentiveAmount) ref.incentiveAmount = referralIncentiveFor(offer?.offeredCtcLpa ?? cand?.expectedCtcLpa ?? 0);
        const booked = commissionLedger.some((l) => l.type === "REFERRAL_INCENTIVE" && l.userId === ref.agentId && l.applicationId === app.id);
        if (!booked) {
            commissionLedger.unshift({
                id: nextIds.ledger(),
                orgId: app.orgId,
                userId: ref.agentId,
                clientId: null,
                applicationId: app.id,
                type: "REFERRAL_INCENTIVE",
                amountInr: ref.incentiveAmount,
                status: "PENDING",
                description: `Referral incentive — ${cand?.name ?? "candidate"} joined ${job?.title ?? ""}`,
                invoiceNumber: null,
                dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
                paidAt: null,
                createdAt: new Date().toISOString(),
            });
        }
    }

    addAudit({
        orgId: app.orgId, actorUserId: actor.id, actorRole: actor.role,
        action: "REFERRAL_STATUS_SYNCED", entity: "Referral", entityId: ref.id,
        detail: `${cand?.name ?? "Candidate"} referral → ${next}`,
    });
    addNotification({
        orgId: app.orgId, userId: ref.agentId,
        title: next === "HIRED" ? "Your referral joined 🎉" : "Referral update",
        message: next === "HIRED"
            ? `${cand?.name ?? "Your referral"} joined ${job?.title ?? ""}. Incentive ₹${ref.incentiveAmount.toLocaleString("en-IN")} is pending approval.`
            : `${cand?.name ?? "Your referral"} is now ${next.replace(/_/g, " ").toLowerCase()} for ${job?.title ?? "a role"}`,
        link: "/portal/referrals",
    });
}

// ─── Recruitment access scoping ───────────────────────────────
// Super Admin / TA Manager see and act on everything in their org.
// A recruiter works on jobs assigned to them and applications they own.

export function isRecruitmentManager(user: User): boolean {
    return user.role === "SUPER_ADMIN" || user.role === "TA_MANAGER";
}

export function isJobAssignedTo(jobId: string, userId: string): boolean {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return false;
    return job.primaryRecruiterId === userId || (job.assignedTas || []).includes(userId) || job.requestedById === userId;
}

export function canWorkOnApplication(user: User, app: Application): boolean {
    if (app.orgId !== user.orgId) return false;
    if (isRecruitmentManager(user)) return true;
    return app.recruiterId === user.id || isJobAssignedTo(app.jobId, user.id);
}

/** Validates recruiter ids for assignment: active TA users (or Super Admin) in the org. */
export function validRecruiters(orgId: string, ids: string[]): { ok: User[]; invalid: string[] } {
    const ok: User[] = [];
    const invalid: string[] = [];
    ids.forEach((id) => {
        const u = users.find((x) => x.id === id && x.orgId === orgId && x.status === "ACTIVE" && ["TA_RECRUITER", "TA_MANAGER", "SUPER_ADMIN"].includes(x.role));
        if (u) ok.push(u); else invalid.push(id);
    });
    return { ok, invalid };
}

// ─── Job assignment notifications ────────────────────────────

/** Notifies recruiters newly added to a job (primary or team). */
export function notifyJobAssignment(job: JobRequisition, previousIds: string[], actor: User) {
    const current = new Set([...(job.assignedTas || []), ...(job.primaryRecruiterId ? [job.primaryRecruiterId] : [])]);
    const client = clients.find((c) => c.id === job.clientId);
    current.forEach((uid) => {
        if (previousIds.includes(uid) || uid === actor.id) return;
        addNotification({
            orgId: job.orgId, userId: uid,
            title: job.primaryRecruiterId === uid ? "You are the primary recruiter" : "Job assigned to you",
            message: `${job.title}${client ? ` · ${client.companyName}` : ""} (${job.openings} opening${job.openings > 1 ? "s" : ""})`,
            link: `/ta/requisitions/${job.id}`,
        });
    });
}

// ─── Unified approvals ───────────────────────────────────────

export function createApproval(input: Omit<ApprovalRequest, "id" | "status" | "date" | "requestedByName" | "requestedByRole"> & { requester: User }, notify: UserRole[]) {
    const { requester, ...rest } = input;
    const existing = approvals.find(
        (a) => a.orgId === rest.orgId && a.relatedRecordId === rest.relatedRecordId && a.type === rest.type && a.status === "PENDING"
    );
    if (existing) return existing;
    const item: ApprovalRequest = {
        ...rest,
        id: `apr-${crypto.randomUUID().slice(0, 8)}`,
        requestedByName: requester.name,
        requestedByRole: requester.role,
        date: new Date().toISOString(),
        status: "PENDING",
    };
    approvals.unshift(item);
    notifyRoles(rest.orgId, notify, {
        title: "Approval needed",
        message: `${requester.name}: ${item.title}`,
        link: "/admin/approvals",
    });
    return item;
}

/** Closes pending approval(s) for a record when it is decided through another screen. */
export function resolveApprovalsFor(recordId: string, status: "APPROVED" | "REJECTED", actor: User, comment?: string) {
    approvals
        .filter((a) => a.orgId === actor.orgId && a.relatedRecordId === recordId && a.status === "PENDING")
        .forEach((a) => {
            a.status = status;
            a.reviewedById = actor.id;
            a.reviewedByName = actor.name;
            a.reviewedAt = new Date().toISOString();
            a.reviewComment = comment ?? null;
            addNotification({
                orgId: a.orgId, userId: a.requestedById,
                title: status === "APPROVED" ? "Request approved" : "Request rejected",
                message: `${a.title} — ${status.toLowerCase()} by ${actor.name}${comment ? `: ${comment}` : ""}`,
                link: null,
            });
        });
}
