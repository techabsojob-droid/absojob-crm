// ─── Admin Settings as the single source of truth ─────────────
// Recruitment SLA, commission and GST defaults, and per-stage SLA hours, read from
// Settings (organizationSettingsSeed) so jobs, fees, invoices and the pipeline agree.

import type { ApplicationStage } from "@/lib/types";
import { STAGE_ORDER } from "@/lib/types";
import { organizationSettingsSeed } from "@/lib/mock/data";

/* eslint-disable @typescript-eslint/no-explicit-any -- settings are stored as free-form JSON */
export function orgSettings(orgId: string): Record<string, any> {
    return organizationSettingsSeed[orgId] ?? organizationSettingsSeed[Object.keys(organizationSettingsSeed)[0]] ?? {};
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const num = (v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/** Days a requisition has to close when the job doesn't set its own target. */
export function defaultSlaDays(orgId: string): number {
    return Math.round(num(orgSettings(orgId).defaultSlaDays, 30, 1, 365));
}

export function defaultCommissionRate(orgId: string): number {
    return num(orgSettings(orgId).defaultCommissionRate, 8.33, 0, 100);
}

export function gstRatePercent(orgId: string): number {
    return num(orgSettings(orgId).taxGstRatePercent, 18, 0, 28);
}

export function defaultCreditDays(orgId: string): number {
    return Math.round(num(orgSettings(orgId).defaultCreditPeriodDays, 30, 0, 180));
}

export interface CommissionTerms {
    ratePercent: number;
    guaranteePeriodDays: number;
    replacementWindowDays: number;
    source: string;
}

interface CommissionRule {
    clientType?: string;
    placementType?: string;
    ratePercent?: number;
    guaranteePeriodDays?: number;
    replacementWindowDays?: number;
    effectiveFrom?: string;
}

/**
 * Commission terms from Settings › Finance › Commission rules for a placement type
 * (CONTRACT for contract / temporary roles, PERMANENT otherwise). Rules for all
 * clients apply; the newest effective rule wins. Falls back to the standard rate.
 */
export function commissionTermsFor(orgId: string, employmentType?: string | null): CommissionTerms {
    const s = orgSettings(orgId);
    const placementType = ["CONTRACT", "TEMPORARY", "FREELANCE", "CONSULTANT"].includes(String(employmentType ?? "").toUpperCase())
        ? "CONTRACT" : "PERMANENT";
    const today = new Date().toISOString().slice(0, 10);
    const rules: CommissionRule[] = Array.isArray(s.commissionRules) ? s.commissionRules : [];
    const rule = rules
        .filter((r) => (r.clientType ?? "ALL") === "ALL" && r.placementType === placementType && (!r.effectiveFrom || r.effectiveFrom <= today))
        .sort((a, b) => String(b.effectiveFrom ?? "").localeCompare(String(a.effectiveFrom ?? "")))[0];
    if (rule && Number.isFinite(Number(rule.ratePercent))) {
        return {
            ratePercent: Number(rule.ratePercent),
            guaranteePeriodDays: num(rule.guaranteePeriodDays, 90, 0, 730),
            replacementWindowDays: num(rule.replacementWindowDays, 30, 0, 365),
            source: `${placementType.toLowerCase()} commission rule`,
        };
    }
    return { ratePercent: defaultCommissionRate(orgId), guaranteePeriodDays: 90, replacementWindowDays: 30, source: "standard placement rate" };
}

export interface StageSla {
    code: ApplicationStage;
    slaHours: number;
}

/** Max hours a candidate should sit in each stage (0 = no limit), from Settings › Pipeline. */
export function stageSlaHours(orgId: string): Record<string, number> {
    const s = orgSettings(orgId);
    const list: { code?: string; slaHours?: number; active?: boolean }[] = Array.isArray(s.pipelineStages) ? s.pipelineStages : [];
    const out: Record<string, number> = {};
    for (const code of STAGE_ORDER) {
        const cfg = list.find((x) => x.code === code);
        out[code] = cfg && cfg.active !== false ? Math.round(num(cfg.slaHours, 0, 0, 24 * 365)) : 0;
    }
    out.ON_HOLD = Math.round(num(list.find((x) => x.code === "ON_HOLD")?.slaHours, 0, 0, 24 * 365));
    return out;
}
