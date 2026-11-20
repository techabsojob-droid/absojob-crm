import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { organizationSettingsSeed, organizations, users } from "@/lib/mock/data";
import { logAudit } from "@/lib/supabase/db";
import { POLICY_LIMITS } from "@/lib/security";
import { settingsFor } from "@/lib/mock/fin/core";
import { STAGE_ORDER, stageLabel } from "@/lib/types";

/** Settings › Pipeline lists every stage the app actually uses, with its saved SLA hours. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- settings are free-form JSON
function pipelineStagesFor(saved: any[] | undefined) {
    const list = Array.isArray(saved) ? saved : [];
    return STAGE_ORDER.map((code, i) => {
        const cfg = list.find((s) => s.code === code);
        return {
            id: cfg?.id ?? `stg-${code.toLowerCase()}`,
            name: stageLabel(code),
            code,
            order: i + 1,
            color: cfg?.color ?? "#64748b",
            active: cfg?.active !== false,
            requiresReason: !!cfg?.requiresReason,
            requiresFeedback: !!cfg?.requiresFeedback,
            slaHours: Number(cfg?.slaHours) || 0,
        };
    });
}

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const settings = organizationSettingsSeed[me.orgId] || organizationSettingsSeed["org-1"];
    const org = organizations.find((o) => o.id === me.orgId);

    return NextResponse.json({
        settings: {
            ...settings,
            pipelineStages: pipelineStagesFor(settings.pipelineStages),
            plan: org?.plan || "GROWTH",
            slug: org?.slug || "absojob"
        },
        userCount: users.filter(u => u.orgId === me.orgId).length,
        userRole: me.role
    });
}

// Ranges the app can safely act on
const NUMERIC: Record<string, readonly [number, number]> = {
    defaultSlaDays: [1, 365],
    candidateSubmissionSlaDays: [0, 60],
    interviewFeedbackSlaHours: [0, 720],
    gracePeriodMinutes: [0, 240],
    defaultCommissionRate: [0, 100],
    defaultCreditPeriodDays: [0, 180],
    taxGstRatePercent: [0, 28],
    minPasswordLength: POLICY_LIMITS.minPasswordLength,
    sessionTimeoutMinutes: POLICY_LIMITS.sessionTimeoutMinutes,
    failedLoginLockoutAttempts: POLICY_LIMITS.failedLoginLockoutAttempts,
};

// Fields only the server writes
const SERVER_ONLY = ["orgId", "updatedAt", "sessionsRevokedAt", "plan", "slug"];

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const current = organizationSettingsSeed[me.orgId] || organizationSettingsSeed["org-1"];
    const now = new Date().toISOString();

    // Danger zone: sign out everyone except Super Admins
    if (body.action === "FLUSH_SESSIONS") {
        organizationSettingsSeed[me.orgId] = { ...current, sessionsRevokedAt: now, updatedAt: now };
        const affected = users.filter((u) => u.orgId === me.orgId && u.status === "ACTIVE" && u.role !== "SUPER_ADMIN").length;
        await logAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "SESSIONS_FLUSHED", entity: "OrganizationSettings", entityId: me.orgId, detail: `Signed out all non-Super-Admin sessions (${affected} active accounts)` });
        return NextResponse.json({ success: true, affected, settings: organizationSettingsSeed[me.orgId] });
    }

    const { changeSummary, action: _action, ...patch } = body;
    void _action;
    for (const k of SERVER_ONLY) delete patch[k];

    for (const [k, [min, max]] of Object.entries(NUMERIC)) {
        if (patch[k] === undefined) continue;
        const v = Number(patch[k]);
        if (!Number.isFinite(v) || v < min || v > max) {
            return NextResponse.json({ error: `${k} must be between ${min} and ${max}` }, { status: 400 });
        }
        patch[k] = v;
    }
    if (patch.mfaEnforcement !== undefined && !["OPTIONAL", "ADMINS_ONLY", "ALL_USERS"].includes(String(patch.mfaEnforcement))) {
        return NextResponse.json({ error: "Invalid MFA policy" }, { status: 400 });
    }
    if (patch.maintenanceMode !== undefined) patch.maintenanceMode = patch.maintenanceMode === true;
    if (Array.isArray(patch.pipelineStages)) {
        // Only SLA hours and on/off are configurable; the stages themselves are fixed by the pipeline
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const incoming = patch.pipelineStages as any[];
        patch.pipelineStages = pipelineStagesFor(current.pipelineStages).map((s) => {
            const n = incoming.find((x) => x?.code === s.code);
            const hours = Number(n?.slaHours);
            return n ? { ...s, slaHours: Number.isFinite(hours) && hours >= 0 && hours <= 8760 ? Math.round(hours) : s.slaHours, active: n.active !== false } : s;
        });
    }

    organizationSettingsSeed[me.orgId] = { ...current, ...patch, updatedAt: now };
    const next = organizationSettingsSeed[me.orgId];

    // One source of truth: Finance uses the same GST rate and credit period
    const fin = settingsFor(me.orgId);
    if (patch.taxGstRatePercent !== undefined) fin.gstRate = next.taxGstRatePercent;
    if (patch.defaultCreditPeriodDays !== undefined) fin.defaultCreditDays = next.defaultCreditPeriodDays;

    const changed = Object.keys(patch).filter((k) => JSON.stringify(current[k]) !== JSON.stringify(next[k]));
    const maintenanceChanged = changed.includes("maintenanceMode");
    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: maintenanceChanged ? (next.maintenanceMode ? "MAINTENANCE_ON" : "MAINTENANCE_OFF") : "SETTINGS_UPDATED",
        entity: "OrganizationSettings",
        entityId: me.orgId,
        detail: String(changeSummary || "") || (changed.length ? `Updated ${changed.join(", ")}` : "No changes"),
    });

    return NextResponse.json({
        success: true,
        settings: { ...next, pipelineStages: pipelineStagesFor(next.pipelineStages) }
    });
}
