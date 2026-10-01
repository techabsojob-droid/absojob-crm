import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { workflows, addAudit } from "@/lib/mock/data";

// GET /api/hr/workflows
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = workflows.filter((w) => w.orgId === me.orgId);
    return NextResponse.json(list);
}

// POST /api/hr/workflows
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const { name, trigger, condition, approvalRole, action } = body;

        const newWf = {
            id: `wf-${workflows.length + 1}`,
            orgId: me.orgId,
            name,
            trigger,
            condition,
            approvalRole: approvalRole || "HR_ADMIN",
            action,
            active: true,
        };

        workflows.unshift(newWf);

        addAudit({
            orgId: me.orgId,
            actorUserId: me.id,
            actorRole: me.role,
            action: "WORKFLOW_CREATED" as any,
            entity: "Workflow" as any,
            entityId: newWf.id,
            detail: `Created workflow automation rule: ${name}`,
        });

        return NextResponse.json(newWf, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create workflow" }, { status: 500 });
    }
}

// PATCH /api/hr/workflows
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const { id, active } = await request.json();
        const wf = workflows.find((w) => w.id === id && w.orgId === me.orgId);
        if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

        if (active !== undefined) wf.active = active;

        return NextResponse.json(wf);
    } catch {
        return NextResponse.json({ error: "Failed to update workflow" }, { status: 500 });
    }
}
