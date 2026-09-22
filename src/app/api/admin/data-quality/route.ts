import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { dataQualityIssues, auditLogs } from "@/lib/mock/data";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const type = url.searchParams.get("type");

    let list = dataQualityIssues.filter((d) => d.orgId === me.orgId);

    if (q) {
        list = list.filter(
            (d) =>
                d.title.toLowerCase().includes(q) ||
                d.entityName.toLowerCase().includes(q) ||
                d.details.toLowerCase().includes(q)
        );
    }

    if (type && type !== "ALL") list = list.filter((d) => d.type === type);

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, action } = await request.json(); // action: "RESOLVE" | "IGNORE"
    const idx = dataQualityIssues.findIndex((d) => d.id === id && d.orgId === me.orgId);
    if (idx === -1) return NextResponse.json({ error: "Record not found" }, { status: 404 });

    const removed = dataQualityIssues.splice(idx, 1)[0];

    auditLogs.unshift({
        id: `aud-${Date.now().toString().slice(-4)}`,
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: `DATA_QUALITY_${action}`,
        entity: "DataQualityIssue",
        entityId: id,
        detail: `${me.name} performed ${action} on data quality issue: ${removed.title}`,
        createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, removed });
}
