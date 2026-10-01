import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, candidates, clients, jobs, addAudit, addNotification } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { sendEmail } from "@/lib/mock/finance";
import { canWorkOnApplication, isRecruitmentManager } from "@/lib/mock/pipeline";
import { esc, resumeFileOf } from "@/lib/mock/recruiter";
import type { CandidateClientSubmission } from "@/lib/types";

const TA = ["SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET [?status=] — CVs shared with clients (recruiters: their own / their applications)
export async function GET(request: Request) {
    const auth = await requireRole(...TA);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const status = new URL(request.url).searchParams.get("status");
    const list = candidates.filter((c) => c.orgId === me.orgId).flatMap((c) => (c.clientSubmissions ?? []).map((s) => {
        const app = s.applicationId ? applications.find((a) => a.id === s.applicationId) : undefined;
        return { ...s, candidateId: c.id, candidateName: c.name, applicationStage: app?.stage ?? null, mine: s.submittedBy === me.name || (app ? app.recruiterId === me.id : false), daysWaiting: Math.floor((Date.now() - +new Date(s.submittedAt)) / 86400000) };
    }))
        .filter((s) => isRecruitmentManager(me) || s.mine)
        .filter((s) => !status || status === "ALL" || s.status === status)
        .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt));
    return NextResponse.json(list);
}

// POST { applicationId, note?, cc?: string[], attachResume?: boolean } — email the candidate profile to the client contact
export async function POST(request: Request) {
    const auth = await requireRole(...TA);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const app = applications.find((a) => a.id === b.applicationId && a.orgId === me.orgId);
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (!canWorkOnApplication(me, app)) return NextResponse.json({ error: "This application is not assigned to you" }, { status: 403 });
    if (["REJECTED", "BACKED_OUT", "BLACKLISTED", "JOINED"].includes(app.stage)) return bad(`Application is ${app.stage.replace(/_/g, " ").toLowerCase()}`);
    const cand = candidates.find((c) => c.id === app.candidateId)!;
    const job = jobs.find((j) => j.id === app.jobId);
    const client = job ? clients.find((c) => c.id === job.clientId) : undefined;
    if (!job || !client) return bad("Job or client not found");
    if (!EMAIL_RE.test(client.contactEmail ?? "")) return bad(`${client.companyName} has no valid contact email — update the client record first`);
    const cc = (Array.isArray(b.cc) ? b.cc : []).map((x: unknown) => String(x).trim()).filter(Boolean);
    if (cc.some((x: string) => !EMAIL_RE.test(x))) return bad("Invalid CC email");
    if ((cand.clientSubmissions ?? []).some((s) => s.applicationId === app.id && s.status !== "REJECTED")) return NextResponse.json({ error: "This profile has already been shared with the client for this job" }, { status: 409 });

    const resume = b.attachResume === false ? null : resumeFileOf(cand);
    const note = String(b.note ?? "").trim().slice(0, 2000);
    const rows: [string, string][] = [
        ["Candidate", cand.name],
        ["Current role", [cand.currentDesignation, cand.currentCompany].filter(Boolean).join(" at ") || "—"],
        ["Experience", `${cand.totalExperienceYears} yrs (relevant ${cand.relevantExperienceYears} yrs)`],
        ["Current / expected CTC", `${cand.currentCtcLpa} / ${cand.expectedCtcLpa} LPA`],
        ["Notice period", `${cand.noticePeriodDays} days`],
        ["Location", cand.location || cand.currentCity || "—"],
        ["Key skills", (cand.primarySkills?.length ? cand.primarySkills : cand.skills).slice(0, 10).join(", ") || "—"],
    ];
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">
<p>Dear ${esc(client.contactPerson)},</p>
<p>Please find below the profile of a candidate for <b>${esc(job.title)}</b>.</p>
${note ? `<p>${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
<table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">${rows.map(([k, v]) => `<tr><td style="border:1px solid #ddd;color:#555">${esc(k)}</td><td style="border:1px solid #ddd"><b>${esc(v)}</b></td></tr>`).join("")}</table>
<p>${resume ? "The resume is attached." : "Resume available on request."} Kindly share your feedback or interview slots.</p>
<p>Regards,<br>${esc(me.name)}<br>${esc(me.email)} · ${esc(me.phone)}</p></div>`;

    const mail = sendEmail(me.orgId, me, {
        to: [client.contactEmail], cc, replyTo: me.email, subject: `Profile for ${job.title}: ${cand.name}`, html,
        relatedType: "Application", relatedId: app.id,
        attachments: resume ? [{ filename: resume.name, content: resume.dataBase64 }] : undefined,
    });
    if (mail.status === "FAILED") return bad(mail.error ?? "Email could not be sent");

    const sub: CandidateClientSubmission = {
        id: `sub-${crypto.randomUUID().slice(0, 8)}`, jobId: job.id, jobTitle: job.title, clientId: client.id, clientName: client.companyName,
        submittedBy: me.name, submittedAt: new Date().toISOString(), status: "PENDING_REVIEW", applicationId: app.id, emailedTo: [client.contactEmail, ...cc],
    };
    cand.clientSubmissions = [sub, ...(cand.clientSubmissions ?? [])];
    cand.updatedAt = sub.submittedAt;
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "CV_SUBMITTED_TO_CLIENT", entity: "Application", entityId: app.id, detail: `${cand.name} → ${client.companyName} (${job.title})${resume ? " with resume" : ""}` });
    return NextResponse.json({ submission: sub, emailStatus: mail.status, resumeAttached: !!resume }, { status: 201 });
}

// PATCH { candidateId, submissionId, status, clientFeedback?, rejectionReason? } — record the client's response
export async function PATCH(request: Request) {
    const auth = await requireRole(...TA);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const cand = candidates.find((c) => c.id === b.candidateId && c.orgId === me.orgId);
    const sub = cand?.clientSubmissions?.find((s) => s.id === b.submissionId);
    if (!cand || !sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    const app = sub.applicationId ? applications.find((a) => a.id === sub.applicationId) : undefined;
    if (!isRecruitmentManager(me) && sub.submittedBy !== me.name && !(app && canWorkOnApplication(me, app))) return NextResponse.json({ error: "Not your submission" }, { status: 403 });
    if (!["SHORTLISTED", "REJECTED", "INTERVIEW_REQUESTED", "PENDING_REVIEW"].includes(b.status)) return bad("Invalid status");
    if (b.status === "REJECTED" && !String(b.rejectionReason ?? "").trim()) return bad("Add the client's rejection reason");
    sub.status = b.status;
    sub.clientFeedback = String(b.clientFeedback ?? sub.clientFeedback ?? "").trim().slice(0, 2000) || undefined;
    sub.rejectionReason = b.status === "REJECTED" ? String(b.rejectionReason).trim().slice(0, 500) : undefined;
    sub.responseDate = new Date().toISOString();
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "CLIENT_FEEDBACK_RECORDED", entity: "Candidate", entityId: cand.id, detail: `${sub.clientName} on ${cand.name}: ${sub.status}${sub.rejectionReason ? ` — ${sub.rejectionReason}` : ""}` });
    if (app && app.recruiterId !== me.id) {
        addNotification({ orgId: me.orgId, userId: app.recruiterId, title: "Client feedback received", message: `${sub.clientName}: ${cand.name} — ${sub.status.replace(/_/g, " ").toLowerCase()}`, link: `/ta/candidates/${cand.id}` });
    }
    return NextResponse.json({ ...sub, nextStep: b.status === "INTERVIEW_REQUESTED" ? "Schedule the client interview from the pipeline" : b.status === "REJECTED" ? "Move the application to Rejected in the pipeline if the client's decision is final" : null });
}
