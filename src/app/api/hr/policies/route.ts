import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { hrPolicies, addAudit } from "@/lib/mock/data";

// GET /api/hr/policies
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER", "EMPLOYEE", "AGENT");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = hrPolicies.filter((p) => p.orgId === me.orgId);
    return NextResponse.json(list);
}

// POST /api/hr/policies
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const { title, category, summary, version = "v1.0", effectiveDate } = body;

        const newPol = {
            id: `pol-${hrPolicies.length + 1}`,
            orgId: me.orgId,
            title,
            category,
            version,
            effectiveDate: effectiveDate || new Date().toISOString().split("T")[0],
            acknowledgementCount: 0,
            summary,
            status: "PUBLISHED" as const,
        };

        hrPolicies.unshift(newPol);

        addAudit({
            orgId: me.orgId,
            actorUserId: me.id,
            actorRole: me.role,
            action: "POLICY_PUBLISHED" as any,
            entity: "Policy" as any,
            entityId: newPol.id,
            detail: `Published organization policy: ${title} (${version})`,
        });

        return NextResponse.json(newPol, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to publish policy" }, { status: 500 });
    }
}
