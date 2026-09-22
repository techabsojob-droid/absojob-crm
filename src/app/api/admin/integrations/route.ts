import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { integrationServices, auditLogs } from "@/lib/mock/data";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = integrationServices.filter((s) => s.orgId === me.orgId);
    return NextResponse.json(list);
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, status } = await request.json();
    const item = integrationServices.find((s) => s.id === id && s.orgId === me.orgId);
    if (!item) return NextResponse.json({ error: "Service not found" }, { status: 404 });

    item.status = status;
    item.lastSyncAt = new Date().toISOString();

    auditLogs.unshift({
        id: `aud-${Date.now().toString().slice(-4)}`,
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: `INTEGRATION_STATE_${status}`,
        entity: "IntegrationService",
        entityId: item.id,
        detail: `${me.name} toggled integration ${item.name} to ${status}`,
        createdAt: new Date().toISOString(),
    });

    return NextResponse.json(item);
}
