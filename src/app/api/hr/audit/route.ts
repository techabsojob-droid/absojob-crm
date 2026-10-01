import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { auditLogs, users } from "@/lib/mock/data";

// GET /api/hr/audit
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = auditLogs
        .filter((l) => l.orgId === me.orgId)
        .map((l) => {
            const user = users.find((u) => u.id === l.actorUserId);
            return {
                ...l,
                actorName: user?.name || "System Admin",
            };
        })
        .slice(0, 150);

    return NextResponse.json(list);
}
