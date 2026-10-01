import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { benefits, addAudit } from "@/lib/mock/data";

// GET /api/hr/benefits
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "EMPLOYEE", "AGENT");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = benefits.filter((b) => b.orgId === me.orgId);
    return NextResponse.json(list);
}

// POST /api/hr/benefits
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const { title, category, provider, coverageAmount, description } = body;

        const newBen = {
            id: `ben-${benefits.length + 1}`,
            orgId: me.orgId,
            title,
            category,
            provider,
            coverageAmount,
            enrolledCount: 0,
            status: "ACTIVE" as const,
            description,
        };

        benefits.push(newBen);

        addAudit({
            orgId: me.orgId,
            actorUserId: me.id,
            actorRole: me.role,
            action: "BENEFIT_ADDED" as any,
            entity: "Benefit" as any,
            entityId: newBen.id,
            detail: `Added new employee benefit: ${title} (${provider})`,
        });

        return NextResponse.json(newBen, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create benefit" }, { status: 500 });
    }
}
