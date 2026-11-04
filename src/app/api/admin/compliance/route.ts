import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { complianceItems, auditLogs, candidates } from "@/lib/mock/data";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    if (url.searchParams.get("summary") === "1") {
        // Share of active candidates who gave data-processing consent (DPDP)
        const pool = candidates.filter((c) => c.orgId === me.orgId && !c.archived);
        const consented = pool.filter((c) => c.compliance?.dataProcessingConsent).length;
        return NextResponse.json({ candidates: pool.length, consented, consentRate: pool.length ? Math.round((consented / pool.length) * 1000) / 10 : null });
    }
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const severity = url.searchParams.get("severity");

    let list = complianceItems.filter((c) => c.orgId === me.orgId);

    if (q) {
        list = list.filter(
            (c) =>
                c.title.toLowerCase().includes(q) ||
                c.entityName.toLowerCase().includes(q) ||
                c.detail.toLowerCase().includes(q)
        );
    }

    if (severity && severity !== "ALL") {
        list = list.filter((c) => c.severity === severity);
    }

    return NextResponse.json(list);
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, status, detail } = await request.json();
    const item = complianceItems.find((c) => c.id === id && c.orgId === me.orgId);
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    if (status) item.status = status;
    if (detail) item.detail = detail;
    item.lastUpdated = new Date().toISOString();

    auditLogs.unshift({
        id: `aud-${Date.now().toString().slice(-4)}`,
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: `COMPLIANCE_STATUS_${status}`,
        entity: "ComplianceItem",
        entityId: item.id,
        detail: `${me.name} updated compliance case ${item.id} (${item.title}) to ${status}`,
        createdAt: new Date().toISOString(),
    });

    return NextResponse.json(item);
}
