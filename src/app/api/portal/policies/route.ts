import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { documents, hrPolicies, policyAcknowledgements, addAudit } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";

// GET — published policies with my acknowledgement status (a new version needs a fresh acknowledgement)
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const list = hrPolicies.filter((p) => p.orgId === me.orgId && p.status === "PUBLISHED").map((p) => {
        const ack = policyAcknowledgements.find((a) => a.policyId === p.id && a.userId === me.id && a.version === p.version);
        const doc = documents.find((d) => d.orgId === me.orgId && d.category === "POLICY" && d.title.toLowerCase().includes(p.title.split(" ")[0].toLowerCase()));
        return { ...p, acknowledged: !!ack, acknowledgedAt: ack?.acknowledgedAt ?? null, documentUrl: doc?.fileUrl ?? null };
    });
    return NextResponse.json({ policies: list, pending: list.filter((p) => !p.acknowledged).length });
}

// POST { policyId } — acknowledge the current version
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const p = hrPolicies.find((x) => x.id === b.policyId && x.orgId === me.orgId && x.status === "PUBLISHED");
    if (!p) return bad("Policy not found", 404);
    if (policyAcknowledgements.some((a) => a.policyId === p.id && a.userId === me.id && a.version === p.version)) return bad("Already acknowledged", 409);
    policyAcknowledgements.push({ id: `pack-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, policyId: p.id, version: p.version, userId: me.id, acknowledgedAt: new Date().toISOString() });
    p.acknowledgementCount += 1;
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "POLICY_ACKNOWLEDGED", entity: "HrPolicy", entityId: p.id, detail: `${p.title} ${p.version}` });
    return NextResponse.json({ success: true }, { status: 201 });
}
