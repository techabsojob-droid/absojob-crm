import { NextResponse } from "next/server";
import { nextTaskKey } from "@/lib/tasks";
import { requireRole } from "@/lib/mock/server";
import { applications, candidates, clientCommunications, clients, jobs, tasks, users, addAudit, nextIds } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { sendEmail } from "@/lib/mock/finance";
import { accessibleClientIds, canAccessJob, hasOrgWideRecruitmentAccess, isRecruitmentManager, mappedClientIds } from "@/lib/mock/pipeline";
import { istNow } from "@/lib/mock/ess";
import { countEvents, kpiEvents } from "@/lib/mock/kpi";
import { esc } from "@/lib/mock/recruiter";

const TA = ["SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER"] as const;
const OPEN = ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE"];

/**
 * "My Clients": a TA Manager gets the clients mapped to them (Super Admin: all); a recruiter
 * gets the clients of requisitions assigned to them (and clients they account-manage).
 */
function myClientIds(me: Parameters<typeof isRecruitmentManager>[0]) {
    return me.role === "TA_MANAGER" || hasOrgWideRecruitmentAccess(me) ? mappedClientIds(me) : accessibleClientIds(me);
}

const FUNNEL: { key: string; label: string; stages: string[] }[] = [
    { key: "sourcing", label: "Sourcing", stages: ["SOURCED", "CONTACTED", "SCREENING"] },
    { key: "shortlisted", label: "Shortlisted", stages: ["SHORTLISTED"] },
    { key: "interview", label: "Interviewing", stages: ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", "INTERVIEW_COMPLETED"] },
    { key: "selected", label: "Selected", stages: ["SELECTED"] },
    { key: "offer", label: "Offer", stages: ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING"] },
    { key: "joined", label: "Joined", stages: ["JOINED"] },
];
const CLOSED_APP = ["JOINED", "REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "BLACKLISTED"];

// GET — clients the user recruits for: contacts, requisitions, recruiters, candidate progress,
// performance, pending CV feedback and communication log
export async function GET() {
    const auth = await requireRole(...TA);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const ids = myClientIds(me);
    const subs = candidates.filter((c) => c.orgId === me.orgId).flatMap((c) => (c.clientSubmissions ?? []).map((s) => ({ ...s, candidateId: c.id, candidateName: c.name })));
    const today = istNow().date;
    const monthStart = `${today.slice(0, 7)}-01`;
    const events = kpiEvents(me.orgId);
    const nameOf = (id: string | null | undefined) => (id ? users.find((u) => u.id === id)?.name ?? null : null);
    const list = clients.filter((c) => ids.has(c.id)).map((c) => {
        const cJobs = jobs.filter((j) => j.clientId === c.id && canAccessJob(me, j) && (j.status !== "DRAFT" || j.requestedById === me.id));
        const jobIds = new Set(cJobs.map((j) => j.id));
        const apps = applications.filter((a) => jobIds.has(a.jobId));
        const recruiterIds = [...new Set(cJobs.flatMap((j) => [j.primaryRecruiterId, ...(j.assignedTas ?? [])]).filter(Boolean) as string[])];
        const cEvents = events.filter((e) => e.jobId && jobIds.has(e.jobId));
        const totalOpenings = cJobs.filter((j) => !["CANCELLED", "DRAFT"].includes(j.status)).reduce((s, j) => s + (j.openings || 0), 0);
        const filled = cJobs.reduce((s, j) => s + Math.min(j.openings || 0, Math.max(j.filled || 0, apps.filter((a) => a.jobId === j.id && a.stage === "JOINED").length)), 0);
        return {
            id: c.id, companyName: c.companyName, industry: c.industry, status: c.status, website: c.website ?? null,
            contactPerson: c.contactPerson, contactEmail: c.contactEmail, contactPhone: c.contactPhone,
            accountManagerName: nameOf(c.accountManagerId),
            mappedToMe: c.accountManagerId === me.id || (c.taManagerIds ?? []).includes(me.id),
            openJobs: cJobs.filter((j) => OPEN.includes(j.status)).map((j) => ({ id: j.id, title: j.title, openings: j.openings - j.filled, status: j.status })),
            requisitions: cJobs.map((j) => {
                const ja = apps.filter((a) => a.jobId === j.id);
                return {
                    id: j.id, code: j.requisitionCode ?? null, title: j.title, status: j.status, priority: j.priority, location: j.location,
                    openings: j.openings, filled: Math.min(j.openings || 0, Math.max(j.filled || 0, ja.filter((a) => a.stage === "JOINED").length)),
                    primaryRecruiterName: nameOf(j.primaryRecruiterId ?? j.assignedTas?.[0]),
                    recruiters: [...new Set([j.primaryRecruiterId, ...(j.assignedTas ?? [])].filter(Boolean) as string[])].map((id) => ({ id, name: nameOf(id) ?? id })),
                    inPipeline: ja.filter((a) => !CLOSED_APP.includes(a.stage)).length,
                    createdAt: j.createdAt, targetCloseDate: j.targetCloseDate ?? null,
                };
            }).sort((a, b) => Number(OPEN.includes(b.status)) - Number(OPEN.includes(a.status)) || b.createdAt.localeCompare(a.createdAt)),
            recruiters: recruiterIds.map((id) => ({
                id, name: nameOf(id) ?? id,
                requisitions: cJobs.filter((j) => j.primaryRecruiterId === id || (j.assignedTas ?? []).includes(id)).length,
                activeCandidates: apps.filter((a) => a.recruiterId === id && !CLOSED_APP.includes(a.stage)).length,
                joined: apps.filter((a) => a.recruiterId === id && a.stage === "JOINED").length,
            })),
            funnel: FUNNEL.map((f) => ({ key: f.key, label: f.label, count: apps.filter((a) => f.stages.includes(a.stage)).length })),
            performance: {
                totalOpenings, filled, fillRatePct: totalOpenings ? Math.round((filled / totalOpenings) * 100) : null,
                thisMonth: countEvents(cEvents.filter((e) => e.day >= monthStart && e.day <= today)),
                allTime: countEvents(cEvents),
                pendingFeedback: subs.filter((s) => s.clientId === c.id && s.status === "PENDING_REVIEW" && jobIds.has(s.jobId)).length,
            },
            activeCandidates: apps.filter((a) => !CLOSED_APP.includes(a.stage)).length,
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
    if (!myClientIds(me).has(client.id)) return NextResponse.json({ error: "This client is not assigned to you" }, { status: 403 });
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
    if (b.nextFollowUpDate) tasks.push({ id: nextIds.task(), orgId: me.orgId, key: nextTaskKey(tasks, me.orgId), type: "FOLLOW_UP", status: "TODO", labels: ["client"], watcherIds: [], relatedType: "CLIENT", relatedId: client.id, assignedToId: me.id, createdById: me.id, title: `Follow up with ${client.companyName}`, description: subject, dueDate: b.nextFollowUpDate, priority: "MEDIUM", linkedApplicationId: null, completed: false, completedAt: null, createdAt: rec.createdAt });
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "CLIENT_CONTACTED", entity: "Client", entityId: client.id, detail: `${rec.channel}: ${rec.subject}` });
    return NextResponse.json({ communication: rec, emailStatus, link }, { status: 201 });
}
