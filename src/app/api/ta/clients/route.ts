import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, candidates, clientCommunications, clients, jobs, tasks, addAudit, nextIds } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { sendEmail } from "@/lib/mock/finance";
import { isJobAssignedTo, isRecruitmentManager } from "@/lib/mock/pipeline";
import { esc } from "@/lib/mock/recruiter";

const TA = ["SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER"] as const;
const OPEN = ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE"];

function myClientIds(me: Parameters<typeof isRecruitmentManager>[0]) {
    if (isRecruitmentManager(me)) return new Set(clients.filter((c) => c.orgId === me.orgId).map((c) => c.id));
    return new Set(jobs.filter((j) => j.orgId === me.orgId && isJobAssignedTo(j.id, me.id)).map((j) => j.clientId));
}

// GET — clients the user recruits for: contacts, open jobs, pipeline, pending CV feedback, communication log
export async function GET() {
    const auth = await requireRole(...TA);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const ids = myClientIds(me);
    const subs = candidates.filter((c) => c.orgId === me.orgId).flatMap((c) => (c.clientSubmissions ?? []).map((s) => ({ ...s, candidateId: c.id, candidateName: c.name })));
    const list = clients.filter((c) => ids.has(c.id)).map((c) => {
        const cJobs = jobs.filter((j) => j.clientId === c.id && (isRecruitmentManager(me) || isJobAssignedTo(j.id, me.id)));
        const jobIds = new Set(cJobs.map((j) => j.id));
        const apps = applications.filter((a) => jobIds.has(a.jobId));
        return {
            id: c.id, companyName: c.companyName, industry: c.industry, status: c.status, website: c.website ?? null,
            contactPerson: c.contactPerson, contactEmail: c.contactEmail, contactPhone: c.contactPhone,
            openJobs: cJobs.filter((j) => OPEN.includes(j.status)).map((j) => ({ id: j.id, title: j.title, openings: j.openings - j.filled, status: j.status })),
            activeCandidates: apps.filter((a) => !["JOINED", "REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)).length,
            joined: apps.filter((a) => a.stage === "JOINED").length,
            awaitingFeedback: subs.filter((s) => s.clientId === c.id && s.status === "PENDING_REVIEW" && jobIds.has(s.jobId)).map((s) => ({ ...s, daysWaiting: Math.floor((Date.now() - +new Date(s.submittedAt)) / 86400000) })),
            communications: clientCommunications.filter((m) => m.clientId === c.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 30),
        };
    });
    return NextResponse.json(list);
}

// POST { clientId, channel, subject, body, jobId?, nextFollowUpDate?, direction?, send? } — log (and optionally email) a client interaction
export async function POST(request: Request) {
    const auth = await requireRole(...TA);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const client = clients.find((c) => c.id === b.clientId && c.orgId === me.orgId);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    if (!myClientIds(me).has(client.id)) return NextResponse.json({ error: "You have no jobs for this client" }, { status: 403 });
    if (!["EMAIL", "PHONE", "MEETING", "WHATSAPP"].includes(b.channel)) return bad("Invalid channel");
    const subject = String(b.subject ?? "").trim();
    const text = String(b.body ?? "").trim();
    if (!subject || !text) return bad("Subject and details are required");
    if (b.jobId && !jobs.some((j) => j.id === b.jobId && j.clientId === client.id)) return bad("Job does not belong to this client");
    if (b.nextFollowUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(b.nextFollowUpDate)) return bad("Invalid follow-up date");
    const direction = b.direction === "INCOMING" ? "INCOMING" : "OUTGOING";

    let emailStatus: string | null = null;
    if (b.channel === "EMAIL" && direction === "OUTGOING" && b.send) {
        const mail = sendEmail(me.orgId, me, { to: [client.contactEmail], replyTo: me.email, subject, relatedType: "Client", relatedId: client.id, html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${esc(text).replace(/\n/g, "<br>")}</div>` });
        if (mail.status === "FAILED") return bad(mail.error ?? "Email could not be sent");
        emailStatus = mail.status;
    }
    const link = b.channel === "WHATSAPP" && direction === "OUTGOING" ? `https://wa.me/${(() => { const n = String(client.contactPhone ?? "").replace(/\D/g, ""); return n.length === 10 ? `91${n}` : n; })()}?text=${encodeURIComponent(text)}` : null;

    const rec = { id: `ccm-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, clientId: client.id, channel: b.channel, direction: direction as "INCOMING" | "OUTGOING", subject: subject.slice(0, 200), body: text.slice(0, 5000), jobId: b.jobId || null, nextFollowUpDate: b.nextFollowUpDate || null, byUserId: me.id, byName: me.name, createdAt: new Date().toISOString() };
    clientCommunications.push(rec);
    if (b.nextFollowUpDate) tasks.push({ id: nextIds.task(), orgId: me.orgId, assignedToId: me.id, createdById: me.id, title: `Follow up with ${client.companyName}`, description: subject, dueDate: b.nextFollowUpDate, priority: "MEDIUM", linkedApplicationId: null, completed: false, completedAt: null, createdAt: rec.createdAt });
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "CLIENT_CONTACTED", entity: "Client", entityId: client.id, detail: `${rec.channel}: ${rec.subject}` });
    return NextResponse.json({ communication: rec, emailStatus, link }, { status: 201 });
}
