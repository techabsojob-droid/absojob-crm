import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { auditLogs, users } from "@/lib/mock/data";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const logs = auditLogs
        .filter((l) => l.orgId === me.orgId)
        .map((l) => ({
            ...l,
            actorName: users.find((u) => u.id === l.actorUserId)?.name ?? "System",
        }))
        .slice(0, 100);

    return NextResponse.json(logs);
}
