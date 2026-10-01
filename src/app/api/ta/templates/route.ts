import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, messageTemplates, addAudit } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { isRecruitmentManager } from "@/lib/mock/pipeline";
import { renderTemplate, varsFor } from "@/lib/mock/recruiter";

const TA = ["SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER"] as const;

// GET [?candidateId&applicationId&clientId] — templates, rendered for that context when given
export async function GET(request: Request) {
    const auth = await requireRole(...TA);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const sp = new URL(request.url).searchParams;
    const cand = sp.get("candidateId") ? candidates.find((c) => c.id === sp.get("candidateId") && c.orgId === me.orgId) : null;
    const vars = varsFor(me, cand, sp.get("applicationId"), sp.get("clientId"));
    const list = messageTemplates.filter((t) => t.orgId === me.orgId).map((t) => ({
        ...t,
        renderedSubject: t.subject ? renderTemplate(t.subject, vars) : null,
        renderedBody: renderTemplate(t.body, vars),
    }));
    return NextResponse.json(list);
}

// POST { name, channel, audience, subject?, body } — create a template
export async function POST(request: Request) {
    const auth = await requireRole(...TA);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const name = String(b.name ?? "").trim();
    const text = String(b.body ?? "").trim();
    if (!name || !text) return bad("Name and message are required");
    if (!["EMAIL", "WHATSAPP", "SMS"].includes(b.channel)) return bad("Invalid channel");
    if (!["CANDIDATE", "CLIENT"].includes(b.audience)) return bad("Invalid audience");
    if (b.channel === "EMAIL" && !String(b.subject ?? "").trim()) return bad("Email templates need a subject");
    if (text.length > 4000) return bad("Message is too long");
    const t = { id: `tpl-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, name: name.slice(0, 80), channel: b.channel, audience: b.audience, subject: b.channel === "EMAIL" ? String(b.subject).trim().slice(0, 200) : null, body: text, createdByName: me.name, createdAt: new Date().toISOString() };
    messageTemplates.push(t);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "TEMPLATE_CREATED", entity: "MessageTemplate", entityId: t.id, detail: t.name });
    return NextResponse.json(t, { status: 201 });
}

// DELETE ?id= — creator or manager
export async function DELETE(request: Request) {
    const auth = await requireRole(...TA);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const id = new URL(request.url).searchParams.get("id") ?? (await body(request)).id;
    const i = messageTemplates.findIndex((t) => t.id === id && t.orgId === me.orgId);
    if (i < 0) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    if (!isRecruitmentManager(me) && messageTemplates[i].createdByName !== me.name) return NextResponse.json({ error: "Only the creator or a TA manager can delete this template" }, { status: 403 });
    const [t] = messageTemplates.splice(i, 1);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "TEMPLATE_DELETED", entity: "MessageTemplate", entityId: t.id, detail: t.name });
    return NextResponse.json({ success: true });
}
