import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { interviews, applications, candidates, jobs, clients, users, addAudit, addNotification, nextIds } from "@/lib/mock/data";
import { canWorkOnApplication, syncReferralFromApplication } from "@/lib/mock/pipeline";
import { STAGE_ORDER, TERMINAL_STAGES, type ApplicationStage, type InterviewStatus, type InterviewOutcome, type InterviewRound } from "@/lib/types";

const ROUNDS: InterviewRound[] = ["SCREENING_CALL", "TECH_1", "TECH_2", "CLIENT_ROUND", "HR_ROUND", "FINAL"];
const STATUSES: InterviewStatus[] = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"];
const OUTCOMES: InterviewOutcome[] = ["PENDING", "STRONG_HIRE", "HIRE", "MAYBE", "NO_HIRE"];

// Pipeline stage an application should be in once a round is scheduled
const ROUND_STAGE: Record<InterviewRound, ApplicationStage> = {
    SCREENING_CALL: "SCREENING",
    TECH_1: "TECH_ROUND",
    TECH_2: "TECH_ROUND",
    CLIENT_ROUND: "CLIENT_ROUND",
    HR_ROUND: "HR_ROUND",
    FINAL: "HR_ROUND",
};

export async function GET(request: Request) {
    // Any staff member can list interviews where they are the interviewer (?assigned=me)
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const filter = url.searchParams.get("filter"); // upcoming | completed
    const assignedToMe = url.searchParams.get("assigned") === "me";
    const isRecruitment = ["SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER"].includes(me.role);
    if (!assignedToMe && !isRecruitment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orgApps = applications.filter((a) => a.orgId === me.orgId);
    let list = interviews
        .filter((i) => {
            if (i.orgId !== me.orgId) return false;
            if (assignedToMe) return i.interviewerUserId === me.id;
            const app = orgApps.find((a) => a.id === i.applicationId);
            return !!app && canWorkOnApplication(me, app);
        })
        .map((i) => {
            const app = orgApps.find((a) => a.id === i.applicationId);
            const cand = app ? candidates.find((c) => c.id === app.candidateId) : undefined;
            const job = app ? jobs.find((j) => j.id === app.jobId) : undefined;
            return {
                ...i,
                candidateName: cand?.name ?? "—",
                jobTitle: job?.title ?? "—",
                clientName: job ? clients.find((c) => c.id === job.clientId)?.companyName ?? null : null,
                recruiterName: app ? (users.find((u) => u.id === app.recruiterId)?.name ?? null) : null,
            };
        });

    if (filter === "upcoming") {
        list = list.filter((i) => ["SCHEDULED", "RESCHEDULED"].includes(i.status))
            .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
    } else if (filter === "completed") {
        list = list.filter((i) => ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(i.status))
            .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
    } else {
        list.sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
    }

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.applicationId || !body.scheduledAt || !body.round) {
        return NextResponse.json({ error: "applicationId, scheduledAt and round are required" }, { status: 400 });
    }
    if (!ROUNDS.includes(body.round)) {
        return NextResponse.json({ error: `Invalid round: ${body.round}` }, { status: 400 });
    }
    if (Number.isNaN(new Date(body.scheduledAt).getTime())) {
        return NextResponse.json({ error: "scheduledAt is not a valid date" }, { status: 400 });
    }
    const app = applications.find((a) => a.id === body.applicationId && a.orgId === me.orgId);
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (!canWorkOnApplication(me, app)) {
        return NextResponse.json({ error: "You can only schedule interviews for candidates assigned to you" }, { status: 403 });
    }
    const interviewer = body.interviewerUserId
        ? users.find((u) => u.id === body.interviewerUserId && u.orgId === me.orgId && u.status === "ACTIVE")
        : undefined;
    if (body.interviewerUserId && !interviewer) {
        return NextResponse.json({ error: "Interviewer not found" }, { status: 400 });
    }
    if (TERMINAL_STAGES.includes(app.stage) || app.stage === "ON_HOLD") {
        return NextResponse.json({ error: `Cannot schedule an interview for an application in ${app.stage.replace(/_/g, " ")}` }, { status: 422 });
    }

    const interview = {
        id: nextIds.interview(),
        orgId: me.orgId,
        applicationId: body.applicationId,
        round: body.round as InterviewRound,
        mode: body.mode ?? "VIDEO",
        scheduledAt: new Date(body.scheduledAt).toISOString(),
        durationMins: Number(body.durationMins) || 45,
        interviewerName: interviewer?.name || body.interviewerName || "Client Panel",
        interviewerUserId: interviewer?.id ?? null,
        status: "SCHEDULED" as InterviewStatus,
        outcome: "PENDING" as InterviewOutcome,
        score: null,
        feedback: null,
        meetingLink: body.meetingLink ?? null,
        createdBy: me.id,
        createdAt: new Date().toISOString(),
    };
    interviews.push(interview);

    // Advance the pipeline forward only (never move a candidate backwards or past offer)
    const target = ROUND_STAGE[interview.round];
    const curIdx = STAGE_ORDER.indexOf(app.stage);
    const targetIdx = STAGE_ORDER.indexOf(target);
    const offerIdx = STAGE_ORDER.indexOf("OFFER_SENT");
    if (curIdx !== -1 && curIdx < targetIdx && curIdx < offerIdx) {
        app.stage = target;
        syncReferralFromApplication(app, me);
    }
    app.updatedAt = new Date().toISOString();

    const cand = candidates.find((c) => c.id === app.candidateId);
    const jobTitle = jobs.find((j) => j.id === app.jobId)?.title ?? "a role";
    const when = new Date(interview.scheduledAt).toLocaleString("en-IN");
    if (interviewer && interviewer.id !== me.id) {
        addNotification({
            orgId: me.orgId, userId: interviewer.id,
            title: "You are interviewing",
            message: `${interview.round.replace(/_/g, " ")} with ${cand?.name ?? "a candidate"} (${jobTitle}) on ${when}`,
            link: "/portal/interviews",
        });
    }
    if (app.recruiterId !== me.id) {
        addNotification({
            orgId: me.orgId, userId: app.recruiterId,
            title: "Interview scheduled",
            message: `${interview.round.replace(/_/g, " ")} for ${cand?.name ?? "candidate"} on ${when}`,
            link: "/ta/interviews",
        });
    }
    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "INTERVIEW_SCHEDULED", entity: "Interview", entityId: interview.id,
        detail: `${interview.round} for ${cand?.name ?? "candidate"} @ ${new Date(interview.scheduledAt).toLocaleString("en-IN")}`,
    });

    return NextResponse.json(interview, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, status, outcome, score, feedback, scheduledAt } = await request.json();
    const interview = interviews.find((i) => i.id === id && i.orgId === me.orgId);
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    const ownerApp = applications.find((a) => a.id === interview.applicationId);
    const isInterviewer = interview.interviewerUserId === me.id;
    const canManage = !!ownerApp && ["SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER"].includes(me.role) && canWorkOnApplication(me, ownerApp);
    if (!canManage && !isInterviewer) {
        return NextResponse.json({ error: "You are not allowed to update this interview" }, { status: 403 });
    }
    // Interviewers may only submit feedback, not reschedule / cancel
    if (!canManage && status && status !== "COMPLETED") {
        return NextResponse.json({ error: "Interviewers can only submit feedback" }, { status: 403 });
    }

    if (status && !STATUSES.includes(status)) {
        return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    if (outcome && !OUTCOMES.includes(outcome)) {
        return NextResponse.json({ error: `Invalid outcome: ${outcome}` }, { status: 400 });
    }
    if (score !== undefined && score !== null && (Number.isNaN(Number(score)) || Number(score) < 0 || Number(score) > 10)) {
        return NextResponse.json({ error: "Score must be between 0 and 10" }, { status: 400 });
    }
    if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(interview.status) && status === "RESCHEDULED") {
        return NextResponse.json({ error: `Cannot reschedule an interview that is ${interview.status.toLowerCase()}` }, { status: 422 });
    }

    const previous = `${interview.status} @ ${interview.scheduledAt}`;

    if (status === "RESCHEDULED") {
        const when = new Date(scheduledAt);
        if (!scheduledAt || Number.isNaN(when.getTime())) {
            return NextResponse.json({ error: "A valid new date/time is required to reschedule" }, { status: 400 });
        }
        interview.scheduledAt = when.toISOString();
    }

    if (status) interview.status = status as InterviewStatus;
    if (outcome) interview.outcome = outcome as InterviewOutcome;
    if (score !== undefined && score !== null) interview.score = Number(score);
    if (feedback !== undefined) interview.feedback = feedback;

    const app = applications.find((a) => a.id === interview.applicationId);
    if (status === "COMPLETED" && app && outcome && outcome !== "PENDING") {
        app.screeningNotes = `${app.screeningNotes ? app.screeningNotes + "\n" : ""}[${interview.round}] ${outcome}${interview.score != null ? ` · Score ${interview.score}/10` : ""}${feedback ? ` — ${feedback}` : ""}`;
        app.updatedAt = new Date().toISOString();
    }

    const action = status === "RESCHEDULED" ? "INTERVIEW_RESCHEDULED"
        : status === "CANCELLED" ? "INTERVIEW_CANCELLED"
        : status === "NO_SHOW" ? "INTERVIEW_NO_SHOW"
        : "INTERVIEW_FEEDBACK";
    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action, entity: "Interview", entityId: interview.id,
        detail: `${interview.round}: ${previous} → ${interview.status} @ ${interview.scheduledAt}${outcome ? ` · ${outcome}` : ""}${score != null ? ` (${score}/10)` : ""}`,
    });

    if (isInterviewer && !canManage && app && status === "COMPLETED") {
        const cand2 = candidates.find((c) => c.id === app.candidateId);
        addNotification({
            orgId: me.orgId, userId: app.recruiterId,
            title: "Interview feedback submitted",
            message: `${me.name}: ${interview.round.replace(/_/g, " ")} for ${cand2?.name ?? "candidate"} — ${outcome ?? "feedback"}${interview.score != null ? ` (${interview.score}/10)` : ""}`,
            link: "/ta/interviews",
        });
    }
    if (status === "RESCHEDULED" && app) {
        if (interview.interviewerUserId && interview.interviewerUserId !== me.id) {
            addNotification({
                orgId: me.orgId, userId: interview.interviewerUserId,
                title: "Interview rescheduled",
                message: `${interview.round.replace(/_/g, " ")} moved to ${new Date(interview.scheduledAt).toLocaleString("en-IN")}`,
                link: "/portal/interviews",
            });
        }
        addNotification({
            orgId: me.orgId, userId: app.recruiterId,
            title: "Interview rescheduled",
            message: `${interview.round.replace(/_/g, " ")} moved to ${new Date(interview.scheduledAt).toLocaleString("en-IN")}`,
            link: "/ta/interviews",
        });
    }

    return NextResponse.json(interview);
}
