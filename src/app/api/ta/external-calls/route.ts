import { NextResponse } from "next/server";
import { nextTaskKey } from "@/lib/tasks";
import { requireRole } from "@/lib/mock/server";
import { candidates, clients, externalCalls, jobs, tasks, users, addAudit, nextIds } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { isRecruitmentManager } from "@/lib/mock/pipeline";
import { csvDownload } from "@/lib/csv";
import { CALL_INTERESTS, CALL_PURPOSES, CALL_STATUSES, EXTERNAL_SOURCES as SOURCES, isEmail, istDay, lastTen, list, num, parseCall, pick, text } from "@/lib/calls";
import type { ExternalCallLog } from "@/lib/types";

const label = (s: string | null | undefined) => (s ? s.replace(/_/g, " ").toLowerCase() : "");

function enrich(c: ExternalCallLog) {
    const job = c.jobId ? jobs.find((j) => j.id === c.jobId) : undefined;
    const converted = c.convertedCandidateId ? candidates.find((x) => x.id === c.convertedCandidateId) : undefined;
    return {
        ...c,
        recruiterName: users.find((u) => u.id === c.recruiterId)?.name ?? "—",
        jobTitle: job?.title ?? null,
        clientName: job ? clients.find((cl) => cl.id === job.clientId)?.companyName ?? null : null,
        convertedCandidateName: converted?.name ?? null,
    };
}

/** A database candidate with this phone / email, if any (outside-data calls are for people who are not in the database). */
function databaseMatch(orgId: string, phone: string | null, email: string | null) {
    const p10 = lastTen(phone);
    const e = (email ?? "").toLowerCase();
    const c = candidates.find((x) => x.orgId === orgId && !x.archived && ((p10.length === 10 && lastTen(x.phone) === p10) || (e && x.email?.toLowerCase() === e)));
    return c ? { id: c.id, name: c.name, candidateCode: c.candidateCode, phone: c.phone, email: c.email } : null;
}

/**
 * GET
 *   ?phone=…&email=…   lookup before logging: database match + earlier outside calls to this number (whole team)
 *   (default)          call log: { items, stats, recruiters }  &scope=mine|team &from= &to= &status= &interest= &purpose= &source= &recruiterId= &q= &converted=yes|no
 *   &format=csv        same filters as a CSV download
 */
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const q = new URL(request.url).searchParams;

    if (q.has("phone") || q.has("email")) {
        const p10 = lastTen(q.get("phone"));
        const email = (q.get("email") ?? "").trim().toLowerCase();
        if (p10.length < 10 && !isEmail(email)) return NextResponse.json({ inDatabase: null, previous: [] });
        const previous = externalCalls
            .filter((c) => c.orgId === me.orgId && ((p10.length === 10 && lastTen(c.phone) === p10) || (email && c.email?.toLowerCase() === email)))
            .sort((a, b) => +new Date(b.calledAt) - +new Date(a.calledAt))
            .slice(0, 20)
            .map(enrich);
        return NextResponse.json({ inDatabase: databaseMatch(me.orgId, q.get("phone"), email || null), previous });
    }

    const team = isRecruitmentManager(me) && q.get("scope") === "team";
    const date = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
    const from = date(q.get("from"));
    const to = date(q.get("to"));
    if (from && to && from > to) return bad("'From' date must be before 'To' date");
    const status = pick(CALL_STATUSES, q.get("status"));
    const interest = pick(CALL_INTERESTS, q.get("interest"));
    const purpose = pick(CALL_PURPOSES, q.get("purpose"));
    const source = pick(SOURCES, q.get("source"));
    const recruiterId = team ? q.get("recruiterId") : null;
    const converted = q.get("converted");
    const search = (q.get("q") ?? "").trim().toLowerCase();
    const digits = search.replace(/\D/g, "");

    const rows = externalCalls
        .filter((c) => c.orgId === me.orgId)
        .filter((c) => (team ? true : c.recruiterId === me.id))
        .filter((c) => !recruiterId || c.recruiterId === recruiterId)
        .filter((c) => !from || istDay(c.calledAt) >= from)
        .filter((c) => !to || istDay(c.calledAt) <= to)
        .filter((c) => !status || c.callStatus === status)
        .filter((c) => !interest || c.candidateInterest === interest)
        .filter((c) => !purpose || c.purpose === purpose)
        .filter((c) => !source || c.source === source)
        .filter((c) => converted !== "yes" || !!c.convertedCandidateId)
        .filter((c) => converted !== "no" || !c.convertedCandidateId)
        .map(enrich)
        .filter((c) => !search
            || c.personName.toLowerCase().includes(search)
            || (digits.length >= 4 && c.phone.replace(/\D/g, "").includes(digits))
            || (c.email ?? "").toLowerCase().includes(search)
            || (c.currentCompany ?? "").toLowerCase().includes(search)
            || (c.jobTitle ?? "").toLowerCase().includes(search)
            || (c.callOutcome ?? "").toLowerCase().includes(search))
        .sort((a, b) => +new Date(b.calledAt) - +new Date(a.calledAt));

    if (q.get("format") === "csv") {
        return csvDownload(rows.map((c) => ({
            "Call date & time": new Date(c.calledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            Name: c.personName, Phone: c.phone, Email: c.email ?? "", Source: label(c.source), "Source detail": c.sourceDetail ?? "",
            "Current company": c.currentCompany ?? "", Designation: c.currentDesignation ?? "", "Experience (yrs)": c.totalExperienceYears ?? "", Skills: c.skills ?? [],
            Job: c.jobTitle ?? "", Client: c.clientName ?? "", Recruiter: c.recruiterName,
            Type: label(c.callType), Status: label(c.callStatus), Purpose: label(c.purpose), "Duration (min)": c.durationMins ?? "", Interest: label(c.candidateInterest),
            Communication: label(c.communicationRating), Technical: label(c.technicalRating), Attitude: label(c.attitudeRating), Overall: label(c.overallRating), "Role fit": label(c.roleFit),
            "Skills assessed": c.skillsAssessed ?? [], Strengths: c.strengths ?? "", Concerns: c.concerns ?? "", "Screening feedback": c.screeningFeedback ?? "",
            "Reason for job change": c.reasonForJobChange ?? "", "Current CTC (LPA)": c.currentCtcLpa ?? "", "Expected CTC (LPA)": c.expectedCtcLpa ?? "", "Notice (days)": c.noticePeriodDays ?? "",
            "Offer in hand": c.offerInHand == null ? "" : c.offerInHand ? "Yes" : "No", "Offer CTC (LPA)": c.offerInHandCtcLpa ?? "", "Willing to relocate": label(c.willingToRelocate),
            "Current location": c.currentLocation ?? "", "Interview availability": c.interviewAvailability ?? "",
            Outcome: c.callOutcome ?? "", Remarks: c.remarks, "Next action": label(c.nextAction), "Follow-up date": c.followUpDate ?? "",
            "Added to database": c.convertedCandidateName ?? "",
        })), `outside-calls-${from ?? "all"}-${to ?? "today"}.csv`);
    }

    const connected = rows.filter((c) => c.callStatus === "CONNECTED");
    const talk = connected.map((c) => c.durationMins ?? 0).filter((m) => m > 0);
    const today = istDay(new Date().toISOString());
    const openFollowUps = tasks.filter((t) => !t.completed && rows.some((c) => c.followUpTaskId === t.id));
    const stats = {
        total: rows.length,
        people: new Set(rows.map((c) => lastTen(c.phone))).size,
        connected: connected.length,
        connectRatePct: rows.length ? Math.round((connected.length / rows.length) * 100) : null,
        avgTalkMins: talk.length ? Math.round((talk.reduce((s, m) => s + m, 0) / talk.length) * 10) / 10 : null,
        interested: connected.filter((c) => c.candidateInterest === "INTERESTED").length,
        // Interested people not yet added to the database — the conversion queue
        toAdd: new Set(connected.filter((c) => c.candidateInterest === "INTERESTED" && !c.convertedCandidateId).map((c) => lastTen(c.phone))).size,
        addedToDatabase: new Set(rows.filter((c) => c.convertedCandidateId).map((c) => c.convertedCandidateId)).size,
        followUpsOpen: openFollowUps.length,
        followUpsOverdue: openFollowUps.filter((t) => t.dueDate && t.dueDate < today).length,
        bySource: SOURCES.map((s) => ({ source: s, count: rows.filter((c) => c.source === s).length })).filter((x) => x.count),
    };
    const recruiters = team
        ? users.filter((u) => u.orgId === me.orgId && (u.role === "TA_RECRUITER" || u.role === "TA_MANAGER") && u.status !== "EXITED").map((u) => ({ id: u.id, name: u.name }))
        : [];
    return NextResponse.json({ scope: team ? "team" : "mine", items: rows.slice(0, 500), truncated: rows.length > 500, stats, recruiters });
}

// POST — log a call to someone who is not in the candidate database. Every call is its own row.
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);

    // The person
    const personName = text(b.personName, 120);
    if (!personName) return bad("Name of the person called is required");
    const phoneDigits = String(b.phone ?? "").replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) return bad("Enter a valid phone number (10 digits, optional country code)");
    const phone = text(b.phone, 20)!;
    const email = text(b.email, 160)?.toLowerCase() ?? null;
    if (email && !isEmail(email)) return bad("Enter a valid email address");
    const source = pick(SOURCES, b.source);
    if (!source) return bad("Select where this contact came from");
    const totalExperienceYears = num(b.totalExperienceYears);
    if (totalExperienceYears !== null && totalExperienceYears > 60) return bad("Total experience looks wrong");
    const job = b.jobId ? jobs.find((j) => j.id === b.jobId && j.orgId === me.orgId) : undefined;
    if (b.jobId && !job) return bad("Job not found");

    // Database candidates are logged from their profile so the history stays in one place
    const match = databaseMatch(me.orgId, phone, email);
    if (match) {
        return NextResponse.json({ error: `${match.name} (${match.candidateCode}) is already in the candidate database — log this call as a database call.`, inDatabase: match }, { status: 409 });
    }

    const parsed = parseCall(b);
    if (!parsed.ok) return bad(parsed.error);
    const now = new Date().toISOString();
    const row: ExternalCallLog = {
        id: nextIds.externalCall(),
        orgId: me.orgId,
        recruiterId: me.id,
        personName,
        phone,
        email,
        source,
        sourceDetail: text(b.sourceDetail, 200),
        currentCompany: text(b.currentCompany, 160),
        currentDesignation: text(b.currentDesignation, 120),
        totalExperienceYears,
        skills: list(b.skills),
        jobId: job?.id ?? null,
        ...parsed.call,
        followUpTaskId: null,
        convertedCandidateId: null,
        convertedAt: null,
        createdAt: now,
    };

    if (row.followUpDate) {
        row.followUpTaskId = nextIds.task();
        tasks.push({
            id: row.followUpTaskId, orgId: me.orgId, key: nextTaskKey(tasks, me.orgId), type: "FOLLOW_UP", status: "TODO",
            labels: ["external-call", "call"], watcherIds: [], relatedType: null, relatedId: row.id,
            assignedToId: me.id, createdById: me.id,
            title: `Call back ${personName} (${phone})${job ? ` — ${job.title}` : ""}`,
            description: `${row.nextAction ? row.nextAction.replace(/_/g, " ").toLowerCase() + " — " : ""}${row.remarks}`.slice(0, 500),
            dueDate: row.followUpDate, priority: row.nextAction === "CALL_BACK" ? "HIGH" : "MEDIUM", linkedApplicationId: null,
            completed: false, completedAt: null, createdAt: now,
        });
    }
    externalCalls.push(row);
    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "EXTERNAL_CALL_LOGGED", entity: "ExternalCall", entityId: row.id,
        detail: `${row.callType.toLowerCase()} call to ${personName} (${label(source)}) — ${label(row.callStatus)}`,
    });
    return NextResponse.json(enrich(row), { status: 201 });
}
