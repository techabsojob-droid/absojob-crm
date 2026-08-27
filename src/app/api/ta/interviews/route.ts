import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { interviews, applications, candidates, jobs, clients, users, addAudit, nextIds } from "@/lib/mock/data";
import type { InterviewStatus, InterviewOutcome } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const filter = url.searchParams.get("filter"); // upcoming | completed

    const orgApps = applications.filter((a) => a.orgId === me.orgId);
    let list = interviews
        .filter((i) => i.orgId === me.orgId)
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
    const auth = await requireRole("TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.applicationId || !body.scheduledAt || !body.round) {
        return NextResponse.json({ error: "applicationId, scheduledAt and round are required" }, { status: 400 });
    }
    const app = applications.find((a) => a.id === body.applicationId && a.orgId === me.orgId);
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const interview = {
        id: nextIds.interview(),
        orgId: me.orgId,
        applicationId: body.applicationId,
        round: body.round,
        mode: body.mode ?? "VIDEO",
        scheduledAt: body.scheduledAt,
        durationMins: Number(body.durationMins) || 45,
        interviewerName: body.interviewerName || "Client Panel",
        status: "SCHEDULED" as InterviewStatus,
        outcome: "PENDING" as InterviewOutcome,
        score: null,
        feedback: null,
        meetingLink: body.meetingLink ?? null,
        createdBy: me.id,
        createdAt: new Date().toISOString(),
    };
    interviews.push(interview);

    if (["TECH_1", "TECH_2", "CLIENT_ROUND", "HR_ROUND", "FINAL"].includes(interview.round) && app.stage === "SCREENING") {
        app.stage = "INTERVIEW_SCHEDULED";
    } else if (app.stage === "INTERVIEW_SCHEDULED" && interview.round === "TECH_1") {
        app.stage = "TECH_ROUND";
    } else if (app.stage === "TECH_ROUND" && ["CLIENT_ROUND"].includes(interview.round)) {
        app.stage = "CLIENT_ROUND";
    } else if (app.stage === "CLIENT_ROUND" && interview.round === "HR_ROUND") {
        app.stage = "HR_ROUND";
    }
    app.updatedAt = new Date().toISOString();

    const cand = candidates.find((c) => c.id === app.candidateId);
    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "INTERVIEW_SCHEDULED", entity: "Interview", entityId: interview.id,
        detail: `${interview.round} for ${cand?.name ?? "candidate"} @ ${new Date(interview.scheduledAt).toLocaleString("en-IN")}`,
    });

    return NextResponse.json(interview, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, status, outcome, score, feedback } = await request.json();
    const interview = interviews.find((i) => i.id === id && i.orgId === me.orgId);
    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    if (status) interview.status = status as InterviewStatus;
    if (outcome) interview.outcome = outcome as InterviewOutcome;
    if (score !== undefined && score !== null) interview.score = Number(score);
    if (feedback !== undefined) interview.feedback = feedback;

    if (status === "COMPLETED") {
        const app = applications.find((a) => a.id === interview.applicationId);
        if (app && ["NO_HIRE", "MAYBE"].includes(outcome)) {
            app.screeningNotes = `${app.screeningNotes ? app.screeningNotes + "\n" : ""}[${interview.round}] Score ${interview.score}/10 — ${feedback ?? ""}`;
        }
    }

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "INTERVIEW_FEEDBACK", entity: "Interview", entityId: interview.id,
        detail: `${interview.round}: ${outcome}${score ? ` (${score}/10)` : ""}`,
    });

    return NextResponse.json(interview);
}
