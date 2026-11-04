import { NextResponse } from "next/server";
import { nextTaskKey } from "@/lib/tasks";
import { requireRole } from "@/lib/mock/server";
import { applications, callActivities, candidates, clients, jobs, tasks, users, addAudit, nextIds } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { canWorkOnApplication, isRecruitmentManager } from "@/lib/mock/pipeline";
import { csvDownload } from "@/lib/csv";
import type { CallActivity } from "@/lib/types";
import { CALL_INTERESTS, CALL_PURPOSES, CALL_STATUSES, istDay, parseCall, pick } from "@/lib/calls";

const STATUSES = CALL_STATUSES;
const INTEREST = CALL_INTERESTS;
const PURPOSES = CALL_PURPOSES;

function enrich(c: CallActivity) {
    const job = c.jobId ? jobs.find((j) => j.id === c.jobId) : undefined;
    const cand = candidates.find((x) => x.id === c.candidateId);
    return {
        ...c,
        recruiterName: users.find((u) => u.id === c.recruiterId)?.name ?? "—",
        candidateName: cand?.name ?? "—",
        candidatePhone: cand?.phone ?? null,
        jobTitle: job?.title ?? null,
        clientName: job ? clients.find((cl) => cl.id === job.clientId)?.companyName ?? null : null,
    };
}

const label = (s: string | null | undefined) => (s ? s.replace(/_/g, " ").toLowerCase() : "");

/**
 * GET — call history, newest first.
 *   ?candidateId= | ?jobId= | ?applicationId=   calls for one record (any recruiter in the org)
 *   ?mine=1                                     my calls (array, as before)
 *   ?view=log                                   Calls page: { items, stats, recruiters } with filters
 *        &scope=mine|team &from=YYYY-MM-DD &to=YYYY-MM-DD &status= &interest= &purpose= &recruiterId= &q=
 *        &format=csv                            same filters as a CSV download
 * Recruiters only ever see their own calls in the log; team leads may widen it to the team.
 */
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const q = new URL(request.url).searchParams;
    const candidateId = q.get("candidateId");
    const jobId = q.get("jobId");
    const applicationId = q.get("applicationId");
    const view = q.get("view");

    if (view !== "log") {
        if (!candidateId && !jobId && !applicationId && q.get("mine") !== "1") return bad("candidateId, jobId, applicationId, mine=1 or view=log is required");
        const rows = callActivities
            .filter((c) => c.orgId === me.orgId)
            .filter((c) => !candidateId || c.candidateId === candidateId)
            .filter((c) => !jobId || c.jobId === jobId)
            .filter((c) => !applicationId || c.applicationId === applicationId)
            .filter((c) => q.get("mine") !== "1" || c.recruiterId === me.id)
            .sort((a, b) => +new Date(b.calledAt) - +new Date(a.calledAt))
            .map(enrich);
        return NextResponse.json(rows);
    }

    // ── Calls log ──
    const manager = isRecruitmentManager(me);
    const team = manager && q.get("scope") === "team";
    const date = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
    const from = date(q.get("from"));
    const to = date(q.get("to"));
    if (from && to && from > to) return bad("'From' date must be before 'To' date");
    const status = pick(STATUSES, q.get("status"));
    const interest = pick(INTEREST, q.get("interest"));
    const purpose = pick(PURPOSES, q.get("purpose"));
    const recruiterId = team ? q.get("recruiterId") : null;
    const search = (q.get("q") ?? "").trim().toLowerCase();
    const searchDigits = search.replace(/\D/g, "");

    const rows = callActivities
        .filter((c) => c.orgId === me.orgId)
        .filter((c) => (team ? true : c.recruiterId === me.id))
        .filter((c) => !recruiterId || c.recruiterId === recruiterId)
        .filter((c) => !from || istDay(c.calledAt) >= from)
        .filter((c) => !to || istDay(c.calledAt) <= to)
        .filter((c) => !status || c.callStatus === status)
        .filter((c) => !interest || c.candidateInterest === interest)
        .filter((c) => !purpose || c.purpose === purpose)
        .map(enrich)
        .filter((c) => !search
            || c.candidateName.toLowerCase().includes(search)
            || (searchDigits.length >= 4 && (c.candidatePhone ?? "").replace(/\D/g, "").includes(searchDigits))
            || (c.jobTitle ?? "").toLowerCase().includes(search)
            || (c.callOutcome ?? "").toLowerCase().includes(search))
        .sort((a, b) => +new Date(b.calledAt) - +new Date(a.calledAt));

    if (q.get("format") === "csv") {
        return csvDownload(rows.map((c) => ({
            "Call date & time": new Date(c.calledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            Candidate: c.candidateName, Phone: c.candidatePhone ?? "", Job: c.jobTitle ?? "", Client: c.clientName ?? "",
            Recruiter: c.recruiterName, Type: label(c.callType), Status: label(c.callStatus), Purpose: label(c.purpose),
            "Duration (min)": c.durationMins ?? "", Interest: label(c.candidateInterest),
            Communication: label(c.communicationRating), Technical: label(c.technicalRating), Attitude: label(c.attitudeRating), Overall: label(c.overallRating),
            "Role fit": label(c.roleFit), "Skills assessed": c.skillsAssessed ?? [], Strengths: c.strengths ?? "", Concerns: c.concerns ?? "",
            "Screening feedback": c.screeningFeedback ?? "", "Reason for job change": c.reasonForJobChange ?? "",
            "Current CTC (LPA)": c.currentCtcLpa ?? "", "Expected CTC (LPA)": c.expectedCtcLpa ?? "", "Notice (days)": c.noticePeriodDays ?? "",
            "Offer in hand": c.offerInHand == null ? "" : c.offerInHand ? "Yes" : "No", "Offer CTC (LPA)": c.offerInHandCtcLpa ?? "",
            "Willing to relocate": label(c.willingToRelocate), "Current location": c.currentLocation ?? "", "Interview availability": c.interviewAvailability ?? "",
            Outcome: c.callOutcome ?? "", Remarks: c.remarks, "Next action": label(c.nextAction), "Follow-up date": c.followUpDate ?? "",
        })), `calls-${from ?? "all"}-${to ?? "today"}.csv`);
    }

    const connected = rows.filter((c) => c.callStatus === "CONNECTED");
    const talk = connected.map((c) => c.durationMins ?? 0).filter((m) => m > 0);
    const todayIst = istDay(new Date().toISOString());
    const followUpsOpen = tasks.filter((t) => t.orgId === me.orgId && t.type === "FOLLOW_UP" && !t.completed && (team ? true : t.assignedToId === me.id)
        && rows.some((c) => c.followUpTaskId === t.id));
    const stats = {
        total: rows.length,
        connected: connected.length,
        connectRatePct: rows.length ? Math.round((connected.length / rows.length) * 100) : null,
        avgTalkMins: talk.length ? Math.round((talk.reduce((s, m) => s + m, 0) / talk.length) * 10) / 10 : null,
        totalTalkMins: talk.reduce((s, m) => s + m, 0),
        interested: connected.filter((c) => c.candidateInterest === "INTERESTED").length,
        notInterested: connected.filter((c) => c.candidateInterest === "NOT_INTERESTED").length,
        uniqueCandidates: new Set(rows.map((c) => c.candidateId)).size,
        followUpsOpen: followUpsOpen.length,
        followUpsOverdue: followUpsOpen.filter((t) => t.dueDate && t.dueDate < todayIst).length,
        byStatus: STATUSES.map((s) => ({ status: s, count: rows.filter((c) => c.callStatus === s).length })).filter((x) => x.count),
    };
    const recruiters = team
        ? users.filter((u) => u.orgId === me.orgId && (u.role === "TA_RECRUITER" || u.role === "TA_MANAGER") && u.status !== "EXITED").map((u) => ({ id: u.id, name: u.name }))
        : [];
    return NextResponse.json({ scope: team ? "team" : "mine", items: rows.slice(0, 500), truncated: rows.length > 500, stats, recruiters });
}

// POST — log one call. Appends a new row (history is never overwritten).
// A follow-up date creates a FOLLOW_UP task for the recruiter; CTC / notice / location heard on the call update the candidate profile.
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);

    const cand = candidates.find((c) => c.id === b.candidateId && c.orgId === me.orgId);
    if (!cand) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    if (cand.doNotContact) return bad(`${cand.name} is marked Do Not Contact${cand.doNotContactReason ? ` (${cand.doNotContactReason})` : ""}`, 422);
    const app = b.applicationId ? applications.find((a) => a.id === b.applicationId && a.candidateId === cand.id) : undefined;
    if (b.applicationId && !app) return bad("Application does not belong to this candidate");
    if (app && !canWorkOnApplication(me, app)) return NextResponse.json({ error: "This application is not assigned to you" }, { status: 403 });

    const parsed = parseCall(b);
    if (!parsed.ok) return bad(parsed.error);
    const { callStatus, purpose, nextAction, remarks } = parsed.call;
    const connected = callStatus === "CONNECTED";

    const now = new Date().toISOString();
    const call: CallActivity = {
        id: nextIds.call(),
        orgId: me.orgId,
        candidateId: cand.id,
        applicationId: app?.id ?? null,
        jobId: app?.jobId ?? null,
        recruiterId: me.id,
        ...parsed.call,
        followUpTaskId: null,
        createdAt: now,
    };

    if (call.followUpDate) {
        const job = app ? jobs.find((j) => j.id === app.jobId) : undefined;
        call.followUpTaskId = nextIds.task();
        tasks.push({
            id: call.followUpTaskId, orgId: me.orgId, key: nextTaskKey(tasks, me.orgId), type: "FOLLOW_UP", status: "TODO",
            labels: ["candidate", "call"], watcherIds: [], relatedType: "CANDIDATE", relatedId: cand.id,
            assignedToId: me.id, createdById: me.id,
            title: `Call back ${cand.name}${job ? ` (${job.title})` : ""}`,
            description: `${call.nextAction ? call.nextAction.replace(/_/g, " ").toLowerCase() + " — " : ""}${remarks}`.slice(0, 500),
            dueDate: call.followUpDate, priority: nextAction === "CALL_BACK" ? "HIGH" : "MEDIUM", linkedApplicationId: app?.id ?? null,
            completed: false, completedAt: null, createdAt: now,
        });
    }
    callActivities.push(call);

    // Keep the candidate profile current with what was heard on the call
    const changed: string[] = [];
    if (call.currentCtcLpa != null && call.currentCtcLpa !== cand.currentCtcLpa) { cand.currentCtcLpa = call.currentCtcLpa; changed.push(`current CTC ${call.currentCtcLpa} LPA`); }
    if (call.expectedCtcLpa != null && call.expectedCtcLpa !== cand.expectedCtcLpa) { cand.expectedCtcLpa = call.expectedCtcLpa; changed.push(`expected CTC ${call.expectedCtcLpa} LPA`); }
    if (call.noticePeriodDays != null && call.noticePeriodDays !== cand.noticePeriodDays) { cand.noticePeriodDays = call.noticePeriodDays; changed.push(`notice ${call.noticePeriodDays} days`); }
    if (call.currentLocation && call.currentLocation !== cand.location) { cand.location = call.currentLocation; changed.push(`location ${call.currentLocation}`); }
    if (call.skillsAssessed?.length) {
        const have = new Set(cand.skills.map((s) => s.toLowerCase()));
        const added = call.skillsAssessed.filter((s) => !have.has(s.toLowerCase()));
        if (added.length) { cand.skills = [...cand.skills, ...added]; changed.push(`skills +${added.join(", ")}`); }
    }
    if (cand.status === "NEW" && call.callType === "OUTGOING") cand.status = "CONTACTED";
    // A new lead the recruiter has now reached moves to Contacted on that job's pipeline
    if (app && app.stage === "SOURCED" && connected) {
        app.stage = "CONTACTED";
        app.updatedAt = now;
        changed.push("pipeline stage → contacted");
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "STAGE_MOVED", entity: "Application", entityId: app.id,
            detail: `${cand.name}: SOURCED → CONTACTED (connected call)`,
        });
    }
    cand.updatedAt = now;

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "CANDIDATE_CALLED", entity: "Candidate", entityId: cand.id,
        detail: `${call.callType.toLowerCase()} call — ${callStatus.replace(/_/g, " ").toLowerCase()} (${purpose.replace(/_/g, " ").toLowerCase()})${changed.length ? `; updated ${changed.join(", ")}` : ""}`,
    });
    return NextResponse.json(enrich(call), { status: 201 });
}
