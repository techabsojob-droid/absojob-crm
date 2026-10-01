import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, applications, interviews, jobs, clients, users, referrals, addAudit, addNotification } from "@/lib/mock/data";
import { canWorkOnApplication, notifyRoles, syncReferralFromApplication } from "@/lib/mock/pipeline";
import { canTransition } from "@/lib/types";

const ELEVATED_ROLES = ["SUPER_ADMIN", "TA_MANAGER"];
// Fields only Super Admin / TA Manager may change
const PROTECTED_FIELDS = ["blacklisted", "blacklistReason", "ownership", "doNotContact", "doNotContactReason"];

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id } = await params;
    const candidate = candidates.find((c) => c.id === id && c.orgId === me.orgId);
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    // All applications for this candidate
    const candApps = applications.filter((a) => a.candidateId === id && a.orgId === me.orgId);

    const enrichedApps = candApps.map((app) => {
        const job = jobs.find((j) => j.id === app.jobId);
        const client = job ? clients.find((c) => c.id === job.clientId) : undefined;
        const recruiter = users.find((u) => u.id === app.recruiterId);
        const appInterviews = interviews.filter((i) => i.applicationId === app.id);

        return {
            ...app,
            jobTitle: job?.title ?? "—",
            jobDepartment: job?.department ?? "—",
            jobLocation: job?.location ?? "—",
            jobEmploymentType: job?.employmentType ?? "—",
            salaryMinLpa: job?.salaryMinLpa ?? 0,
            salaryMaxLpa: job?.salaryMaxLpa ?? 0,
            clientName: client?.companyName ?? "—",
            clientIndustry: client?.industry ?? "—",
            recruiterName: recruiter?.name ?? "—",
            recruiterRole: recruiter?.role ?? "—",
            interviews: appInterviews.map((i) => ({
                ...i,
                recruiterName: users.find((u) => u.id === i.createdBy)?.name ?? "—",
            })),
        };
    });

    // Referral info if any
    const referral = referrals.find((r) => r.candidateId === id);
    const referredByUser = candidate.referredByUserId
        ? users.find((u) => u.id === candidate.referredByUserId)
        : undefined;
    const referralJob = referral?.jobId ? jobs.find((j) => j.id === referral.jobId) : undefined;

    // Build full interview list across all applications
    const allInterviews = enrichedApps.flatMap((a) =>
        a.interviews.map((i) => ({
            ...i,
            jobTitle: a.jobTitle,
            clientName: a.clientName,
            applicationStage: a.stage,
        }))
    );

    // Timeline events — reconstruct full journey
    const timeline: { date: string; type: string; title: string; detail: string; icon: string }[] = [];

    // Added to system
    timeline.push({
        date: candidate.createdAt,
        type: "ADDED",
        title: "Added to Database",
        detail: sourceLabel(candidate.source, referredByUser?.name),
        icon: "USER_PLUS",
    });

    // Each application event
    candApps.forEach((app) => {
        const job = jobs.find((j) => j.id === app.jobId);
        const client = job ? clients.find((c) => c.id === job.clientId) : undefined;
        const label = `${job?.title ?? "Position"} @ ${client?.companyName ?? "Company"}`;

        timeline.push({
            date: app.createdAt,
            type: "APPLIED",
            title: `Added to Pipeline`,
            detail: label,
            icon: "BRIEFCASE",
        });

        // Stage moves (approximate via updatedAt)
        if (!["SOURCED", "REJECTED", "BACKED_OUT"].includes(app.stage)) {
            timeline.push({
                date: app.updatedAt,
                type: "STAGE_MOVE",
                title: `Stage: ${app.stage.replaceAll("_", " ")}`,
                detail: label,
                icon: "ARROW_RIGHT",
            });
        }
        if (app.stage === "JOINED" && app.actualJoinDate) {
            timeline.push({
                date: app.actualJoinDate,
                type: "JOINED",
                title: "Candidate Joined",
                detail: `${label} — Placed successfully`,
                icon: "CHECK_CIRCLE",
            });
        }
        if (app.stage === "REJECTED") {
            timeline.push({
                date: app.updatedAt,
                type: "REJECTED",
                title: "Application Rejected",
                detail: app.rejectionReason ?? label,
                icon: "X_CIRCLE",
            });
        }
    });

    // Interview events
    allInterviews.forEach((i) => {
        timeline.push({
            date: i.scheduledAt,
            type: "INTERVIEW",
            title: `Interview: ${i.round.replaceAll("_", " ")}`,
            detail: `${i.interviewerName} · ${i.mode} · ${i.status}${i.score ? ` · Score ${i.score}/10` : ""}`,
            icon: "CALENDAR",
        });
    });

    // Sort timeline newest first
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Stats summary
    const totalInterviews = allInterviews.length;
    const completedInterviews = allInterviews.filter((i) => i.status === "COMPLETED").length;
    const avgScore = completedInterviews > 0
        ? Math.round(
            (allInterviews
                .filter((i) => i.score != null)
                .reduce((s, i) => s + (i.score ?? 0), 0) /
                allInterviews.filter((i) => i.score != null).length) * 10
        ) / 10
        : null;

    const activeApp = candApps.find((a) => !["REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage));
    const activeJob = activeApp ? jobs.find((j) => j.id === activeApp.jobId) : undefined;
    const activeClient = activeJob ? clients.find((c) => c.id === activeJob.clientId) : undefined;

    return NextResponse.json({
        candidate,
        referredByUser: referredByUser
            ? { id: referredByUser.id, name: referredByUser.name, role: referredByUser.role, email: referredByUser.email }
            : null,
        referral: referral
            ? { ...referral, jobTitle: referralJob?.title ?? null }
            : null,
        applications: enrichedApps,
        allInterviews,
        timeline,
        stats: {
            totalApplications: candApps.length,
            activeApplications: candApps.filter((a) => !["REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)).length,
            totalInterviews,
            completedInterviews,
            avgInterviewScore: avgScore,
            currentStage: activeApp?.stage ?? null,
            activeJobTitle: activeJob?.title ?? null,
            activeClientName: activeClient?.companyName ?? null,
            daysInSystem: Math.floor((Date.now() - new Date(candidate.createdAt).getTime()) / 86400000),
        },
    });
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id } = await params;
    const candidate = candidates.find((c) => c.id === id && c.orgId === me.orgId);
    if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const isElevated = ELEVATED_ROLES.includes(me.role);

    // Reject changes to protected fields from non-elevated users (unchanged values are ignored)
    const protectedChange = PROTECTED_FIELDS.find(
        (k) => body[k] !== undefined && JSON.stringify(body[k] ?? null) !== JSON.stringify((candidate as any)[k] ?? null)
            && !(k === "blacklistReason" && !body.blacklisted && !candidate.blacklisted)
    );
    if (protectedChange && !isElevated) {
        return NextResponse.json({ error: `Only Super Admin or TA Manager can change ${protectedChange}` }, { status: 403 });
    }

    // ── Offer: create (moves application to OFFER_SENT) ──
    if (body.newOffer) {
        const o = body.newOffer;
        const app = applications.find((a) => a.id === o.applicationId && a.orgId === me.orgId && a.candidateId === candidate.id);
        if (!app) return NextResponse.json({ error: "Select the job application this offer is for" }, { status: 400 });
        if (!canWorkOnApplication(me, app)) {
            return NextResponse.json({ error: "You can only release offers for applications assigned to you" }, { status: 403 });
        }
        const ctc = Number(o.offeredCtcLpa);
        if (!Number.isFinite(ctc) || ctc <= 0) return NextResponse.json({ error: "Offered CTC must be greater than 0" }, { status: 400 });
        if (app.stage !== "OFFER_SENT" && !canTransition(app.stage, "OFFER_SENT")) {
            return NextResponse.json(
                { error: `Cannot release an offer while the application is in ${app.stage.replace(/_/g, " ")}` },
                { status: 422 }
            );
        }
        const job = jobs.find((j) => j.id === app.jobId);
        const client = job ? clients.find((c) => c.id === job.clientId) : undefined;
        if (!candidate.offers) candidate.offers = [];
        // A revised offer supersedes any open offer for the same application
        candidate.offers.forEach((prev) => {
            if (prev.applicationId === app.id && ["SENT", "NEGOTIATION", "DRAFT"].includes(prev.status)) prev.status = "WITHDRAWN";
        });
        const offer = {
            id: `ofr-${crypto.randomUUID().slice(0, 8)}`,
            applicationId: app.id,
            jobId: app.jobId,
            jobTitle: job?.title ?? "—",
            clientId: job?.clientId ?? "",
            clientName: client?.companyName ?? "—",
            offeredCtcLpa: ctc,
            fixedLpa: Number(o.fixedLpa) || ctc,
            joiningBonusLpa: Number(o.joiningBonusLpa) || 0,
            offeredDate: new Date().toISOString().split("T")[0],
            joiningDate: o.joiningDate || "",
            expiryDate: o.expiryDate || o.validityDate || "",
            status: "SENT" as const,
            createdBy: me.name,
            createdAt: new Date().toISOString(),
        };
        candidate.offers.unshift(offer);
        const prevStage = app.stage;
        app.stage = "OFFER_SENT";
        if (offer.joiningDate) app.expectedJoinDate = offer.joiningDate;
        app.updatedAt = new Date().toISOString();
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "OFFER_CREATED", entity: "Application", entityId: app.id,
            detail: `${candidate.name}: offer ₹${ctc} LPA for ${offer.jobTitle} (${prevStage} → OFFER_SENT)`,
        });
        syncReferralFromApplication(app, me);
    }

    // ── Offer: candidate response ──
    if (body.offerResponse) {
        const { offerId, response, reason } = body.offerResponse;
        const offer = candidate.offers?.find((x) => x.id === offerId);
        if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
        if (!["SENT", "VIEWED", "NEGOTIATION"].includes(offer.status)) {
            return NextResponse.json({ error: `Offer is already ${offer.status.toLowerCase()}` }, { status: 422 });
        }
        if (!["ACCEPTED", "DECLINED", "NEGOTIATION"].includes(response)) {
            return NextResponse.json({ error: "response must be ACCEPTED, DECLINED or NEGOTIATION" }, { status: 400 });
        }
        const app = offer.applicationId
            ? applications.find((a) => a.id === offer.applicationId && a.orgId === me.orgId)
            : applications.find((a) => a.candidateId === candidate.id && a.jobId === offer.jobId && a.orgId === me.orgId && a.stage === "OFFER_SENT");
        if (app && !canWorkOnApplication(me, app)) {
            return NextResponse.json({ error: "You can only update offers for applications assigned to you" }, { status: 403 });
        }
        if (response !== "NEGOTIATION" && (!app || app.stage !== "OFFER_SENT")) {
            return NextResponse.json({ error: "The linked application is not in OFFER SENT stage" }, { status: 422 });
        }
        offer.status = response;
        offer.respondedAt = new Date().toISOString();
        if (reason) offer.candidateResponse = String(reason);
        if (response === "DECLINED") offer.declineReason = reason ? String(reason) : "Declined by candidate";

        if (app && response === "ACCEPTED") {
            app.stage = "OFFER_ACCEPTED";
            if (offer.joiningDate) app.expectedJoinDate = offer.joiningDate;
            app.updatedAt = new Date().toISOString();
            notifyRoles(me.orgId, ["TA_MANAGER"], {
                title: "Offer accepted ✅",
                message: `${candidate.name} accepted the ${offer.jobTitle} offer. Start onboarding from the pipeline.`,
                link: "/ta/pipeline",
            }, [app.recruiterId]);
        } else if (app && response === "DECLINED") {
            app.stage = "BACKED_OUT";
            app.rejectionReason = offer.declineReason ?? "Offer declined";
            app.updatedAt = new Date().toISOString();
            addNotification({
                orgId: me.orgId, userId: app.recruiterId,
                title: "Offer declined",
                message: `${candidate.name} declined the ${offer.jobTitle} offer`,
                link: `/ta/candidates/${candidate.id}`,
            });
        }
        if (app) syncReferralFromApplication(app, me);
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: `OFFER_${response}`, entity: "Application", entityId: app?.id ?? offer.id,
            detail: `${candidate.name}: ${offer.jobTitle} offer ${response.toLowerCase()}${reason ? ` — ${reason}` : ""}`,
        });
    }

    const changes: { field: string; from: unknown; to: unknown }[] = [];
    const allowed = [
        "name", "email", "alternateEmail", "phone", "alternatePhone", "whatsappNumber",
        "gender", "dateOfBirth", "nationality", "maritalStatus",
        "currentCity", "currentState", "currentCountry", "permanentAddress", "pinCode",
        "location", "currentCompany", "currentDesignation", "previousCompany",
        "totalExperienceYears", "relevantExperienceYears", "industry", "functionalArea",
        "employmentType", "seniorityLevel", "status", "tags",
        "currentCtcLpa", "expectedCtcLpa", "noticePeriodDays",
        "skills", "primarySkills", "secondarySkills", "detailedSkills", "certifications",
        "bio", "headline", "workExperience", "education",
        "preferences", "compensationDetails", "availabilityDetails",
        "documents", "communications", "notes", "screeningEvaluation",
        "referenceChecks", "compliance", "ownership",
        "linkedinUrl", "githubUrl", "portfolioUrl", "websiteUrl",
        "rating", "blacklisted", "blacklistReason", "resumeUrl", "profileCompletionScore",
        "doNotContact", "doNotContactReason", "archived", "clientSubmissions",
        "candidateTasks", "customFieldValues",
    ];
    allowed.forEach((k) => {
        if (body[k] === undefined) return;
        const before = (candidate as any)[k];
        if (JSON.stringify(before ?? null) !== JSON.stringify(body[k] ?? null)) {
            changes.push({ field: k, from: before ?? null, to: body[k] });
        }
        (candidate as any)[k] = body[k];
    });

    // Append new note or communication if submitted
    if (body.newNote) {
        if (!candidate.notes) candidate.notes = [];
        candidate.notes.unshift({
            id: `not-${Date.now()}`,
            category: body.newNote.category || "General",
            text: body.newNote.text,
            authorName: me.name,
            isPrivate: Boolean(body.newNote.isPrivate),
            createdAt: new Date().toISOString(),
        });
    }

    if (body.newCommunication) {
        if (!candidate.communications) candidate.communications = [];
        candidate.communications.unshift({
            id: `comm-${Date.now()}`,
            type: body.newCommunication.type || "PHONE",
            direction: body.newCommunication.direction || "OUTGOING",
            subject: body.newCommunication.subject,
            message: body.newCommunication.message,
            outcome: body.newCommunication.outcome || "Connected",
            nextFollowUpDate: body.newCommunication.nextFollowUpDate,
            createdByName: me.name,
            createdAt: new Date().toISOString(),
        });
    }

    if (body.newTask) {
        if (!candidate.candidateTasks) candidate.candidateTasks = [];
        candidate.candidateTasks.unshift({
            id: `tsk-${Date.now()}`,
            title: body.newTask.title,
            description: body.newTask.description,
            assignedToName: body.newTask.assignedToName || me.name,
            dueDate: body.newTask.dueDate,
            priority: body.newTask.priority || "MEDIUM",
            relatedJobTitle: body.newTask.relatedJobTitle,
            status: "PENDING",
            createdAt: new Date().toISOString(),
        });
    }

    if (body.newSubmission) {
        if (!candidate.clientSubmissions) candidate.clientSubmissions = [];
        candidate.clientSubmissions.unshift({
            id: `sub-${Date.now()}`,
            jobId: body.newSubmission.jobId,
            jobTitle: body.newSubmission.jobTitle,
            clientId: body.newSubmission.clientId,
            clientName: body.newSubmission.clientName,
            submittedBy: me.name,
            submittedAt: new Date().toISOString(),
            status: "PENDING_REVIEW",
            clientFeedback: body.newSubmission.clientFeedback,
        });
    }

    // Record audit trail from server-computed changes (client-supplied old/new values are not trusted)
    const short = (v: unknown) => {
        const t = typeof v === "string" ? v : JSON.stringify(v);
        return t && t.length > 200 ? `${t.slice(0, 200)}…` : t;
    };
    if (!candidate.internalAuditLogs) candidate.internalAuditLogs = [];
    changes.forEach((c) => {
        candidate.internalAuditLogs!.unshift({
            id: `aud-${crypto.randomUUID().slice(0, 8)}`,
            action: "PROFILE_UPDATED",
            fieldChanged: c.field,
            previousValue: short(c.from),
            newValue: short(c.to),
            actorName: me.name,
            reason: body.auditReason || "Direct edit",
            timestamp: new Date().toISOString(),
        });
    });
    if (changes.length > 0) {
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "CANDIDATE_UPDATED", entity: "Candidate", entityId: candidate.id,
            detail: `${candidate.name}: ${changes.map((c) => `${c.field}: ${short(c.from)} → ${short(c.to)}`).join("; ").slice(0, 1000)}`,
        });
    }

    candidate.updatedAt = new Date().toISOString();

    return NextResponse.json(candidate);
}

function sourceLabel(source: string, referrerName?: string | null): string {
    const map: Record<string, string> = {
        AGENT_REFERRAL: referrerName ? `Referred by ${referrerName}` : "Agent Referral",
        JOB_PORTAL: "Job Portal (Naukri / Indeed)",
        LINKEDIN: "LinkedIn Sourcing",
        WALK_IN: "Walk-In",
        DATABASE: "Bulk Database Import",
        CAMPUS: "Campus Hiring",
        OTHER: "Other Source",
    };
    return map[source] ?? source;
}
