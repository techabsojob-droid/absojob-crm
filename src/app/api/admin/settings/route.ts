import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { organizationSettingsSeed, organizations, users } from "@/lib/mock/data";
import { logAudit } from "@/lib/supabase/db";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const settings = organizationSettingsSeed[me.orgId] || organizationSettingsSeed["org-1"];
    const org = organizations.find((o) => o.id === me.orgId);

    return NextResponse.json({
        settings: {
            ...settings,
            plan: org?.plan || "GROWTH",
            slug: org?.slug || "absojob"
        },
        userCount: users.filter(u => u.orgId === me.orgId).length,
        userRole: me.role
    });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const current = organizationSettingsSeed[me.orgId] || organizationSettingsSeed["org-1"];

    organizationSettingsSeed[me.orgId] = {
        ...current,
        ...body,
        updatedAt: new Date().toISOString()
    };

    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "SETTINGS_UPDATED",
        entity: "OrganizationSettings",
        entityId: me.orgId,
        detail: body.changeSummary || "Updated agency configuration parameters",
    });

    return NextResponse.json({
        success: true,
        settings: organizationSettingsSeed[me.orgId]
    });
}
