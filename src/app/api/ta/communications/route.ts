import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, candidates, emailOutbox, tasks, addAudit, nextIds } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { sendEmail } from "@/lib/mock/finance";
import { canWorkOnApplication } from "@/lib/mock/pipeline";
import { esc } from "@/lib/mock/recruiter";
import type { CandidateCommunicationLog } from "@/lib/types";

const OUTCOMES: CandidateCommunicationLog["outcome"][] = ["Connected", "No Answer", "Interested", "Not Interested", "Call Back", "Interview Confirmed", "Documents Pending", "Salary Discussion", "Offer Discussion"];
const CHANNELS = ["EMAIL", "WHATSAPP", "SMS", "PHONE", "MEETING"] as const;

// GET ?candidateId= — communication history (+ emails sent to the candidate)
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const cand = candidates.find((c) => c.id === new URL(request.url).searchParams.get("candidateId") && c.orgId === me.orgId);
    if (!cand) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    const emails = emailOutbox.filter((m) => m.orgId === me.orgId && m.relatedType === "Candidate" && m.relatedId === cand.id).map((m) => ({ id: m.id, subject: m.subject, status: m.status, to: m.to, createdAt: m.createdAt, sentByName: m.sentByName }));
    return NextResponse.json({ communications: cand.communications ?? [], emails, doNotContact: !!cand.doNotContact, doNotContactReason: cand.doNotContactReason ?? null });
}

// POST { candidateId, channel, subject?, message, applicationId?, outcome?, direction?, nextFollowUpDate? }
// EMAIL is sent (outbox / Resend); WHATSAPP & SMS return a deep link the recruiter opens; PHONE/MEETING are logged.
// A follow-up date creates a task for the recruiter.
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const cand = candidates.find((c) => c.id === b.candidateId && c.orgId === me.orgId);
    if (!cand) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    if (!CHANNELS.includes(b.channel)) return bad("Invalid channel");
    const message = String(b.message ?? "").trim();
    if (!message) return bad("Message is required");
    if (message.length > 5000) return bad("Message is too long");
    const outgoing = (b.direction ?? "OUTGOING") === "OUTGOING";
    if (outgoing && ["EMAIL", "WHATSAPP", "SMS"].includes(b.channel) && (cand.doNotContact || cand.blacklisted)) {
        return NextResponse.json({ error: `Candidate is marked do-not-contact${cand.doNotContactReason ? `: ${cand.doNotContactReason}` : ""}` }, { status: 409 });
    }
    const app = b.applicationId ? applications.find((a) => a.id === b.applicationId && a.candidateId === cand.id) : undefined;
    if (b.applicationId && !app) return bad("Application does not belong to this candidate");
    if (app && !canWorkOnApplication(me, app)) return NextResponse.json({ error: "This application is not assigned to you" }, { status: 403 });
    if (b.nextFollowUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(b.nextFollowUpDate)) return bad("Invalid follow-up date");
    const outcome = OUTCOMES.includes(b.outcome) ? b.outcome : "Connected";
    const subject = String(b.subject ?? "").trim() || (b.channel === "PHONE" ? "Call" : b.channel === "MEETING" ? "Meeting" : `${b.channel[0]}${b.channel.slice(1).toLowerCase()} message`);

    let link: string | null = null;
    let emailStatus: string | null = null;
    if (outgoing && b.channel === "EMAIL") {
        if (!cand.email) return bad("Candidate has no email address");
        const mail = sendEmail(me.orgId, me, {
            to: [cand.email], subject, replyTo: me.email, relatedType: "Candidate", relatedId: cand.id,
            html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${esc(message).replace(/\n/g, "<br>")}</div>`,
        });
        emailStatus = mail.status;
        if (mail.status === "FAILED") return bad(mail.error ?? "Email could not be sent");
    }
    if (outgoing && (b.channel === "WHATSAPP" || b.channel === "SMS")) {
        const num = String(cand.whatsappNumber || cand.phone || "").replace(/\D/g, "");
        if (num.length < 10) return bad("Candidate has no valid mobile number");
        const intl = num.length === 10 ? `91${num}` : num;
        link = b.channel === "WHATSAPP" ? `https://wa.me/${intl}?text=${encodeURIComponent(message)}` : `sms:+${intl}?body=${encodeURIComponent(message)}`;
    }

    const log: CandidateCommunicationLog = {
        id: `comm-${crypto.randomUUID().slice(0, 8)}`,
        type: b.channel === "SMS" ? "WHATSAPP" : b.channel,
        direction: outgoing ? "OUTGOING" : "INCOMING",
        subject: b.channel === "SMS" ? `SMS: ${subject}` : subject,
        message, outcome, nextFollowUpDate: b.nextFollowUpDate || undefined,
        createdByName: me.name, createdAt: new Date().toISOString(),
    };
    cand.communications = [log, ...(cand.communications ?? [])];
    cand.updatedAt = log.createdAt;
    if (cand.status === "NEW" && outgoing) cand.status = "CONTACTED";

    let taskId: string | null = null;
    if (b.nextFollowUpDate) {
        taskId = nextIds.task();
        tasks.push({ id: taskId, orgId: me.orgId, assignedToId: me.id, createdById: me.id, title: `Follow up with ${cand.name}`, description: `${subject} — ${outcome}`, dueDate: b.nextFollowUpDate, priority: "MEDIUM", linkedApplicationId: app?.id ?? null, completed: false, completedAt: null, createdAt: log.createdAt });
    }
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "CANDIDATE_CONTACTED", entity: "Candidate", entityId: cand.id, detail: `${log.type} ${log.direction.toLowerCase()} — ${subject} (${outcome})` });
    return NextResponse.json({ log, link, emailStatus, taskId }, { status: 201 });
}
