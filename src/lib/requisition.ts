// ─── Requisition validation (server) ──────────────────────────
// One parser for the requisition wizard, used on create and on edit. Drafts only need
// a title and client (anything else entered must still be well-formed); submitting
// checks every required field, the location hierarchy and the work-mode rules.

import type { JobRequisition, User } from "@/lib/types";
import { clients, users } from "@/lib/mock/data";
import { validRecruiters } from "@/lib/mock/pipeline";
import { validateLocation, type WorkModeValue } from "@/lib/geo/india";
import {
    BILLING_TYPES, CONTRACT_TYPES, EMPLOYMENT_TYPES, HIRING_REASONS, JOB_CATEGORIES, JOINING_TIMELINES, LEGACY_EMPLOYMENT_TYPES, NOTICE_PERIODS,
    PRIORITIES, QUALIFICATIONS, REQUISITION_TYPES, SALARY_TYPES, WORK_MODES, keys, toLpa,
} from "@/lib/requisition-options";

// ── Rich text ──
const ALLOWED = new Set(["p", "br", "strong", "em", "u", "h3", "h4", "ul", "ol", "li"]);
const RENAME: Record<string, string> = { b: "strong", i: "em", div: "p", h1: "h3", h2: "h3", h5: "h4", h6: "h4" };

/** Keeps only basic formatting tags (no attributes, scripts or styles). */
export function sanitizeHtml(input: unknown, max = 20000): string {
    let s = String(input ?? "").slice(0, max * 2);
    s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|iframe|object|embed|svg|math|template)[\s\S]*?<\/\1\s*>/gi, "").replace(/<(script|style|iframe|object|embed)[^>]*>/gi, "");
    s = s.replace(/<\s*(\/?)\s*([a-z0-9]+)[^>]*?(\/?)\s*>/gi, (_m, close: string, tag: string) => {
        const t = RENAME[tag.toLowerCase()] ?? tag.toLowerCase();
        if (!ALLOWED.has(t)) return "";
        if (t === "br") return "<br>";
        return `<${close ? "/" : ""}${t}>`;
    });
    // Any stray "<" left is text, not markup
    s = s.replace(/<(?!\/?(p|br|strong|em|u|h3|h4|ul|ol|li)>)/g, "&lt;");
    s = s.replace(/(<p>\s*(<br>)?\s*<\/p>\s*)+$/g, "").trim();
    return s.slice(0, max);
}

/** Plain-text version for search, emails and older screens. */
export function htmlToText(html: string): string {
    return html
        .replace(/<li>/g, "• ").replace(/<\/(p|h3|h4|li)>|<br>/g, "\n").replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
        .replace(/\n{3,}/g, "\n\n").trim();
}

// ── Field helpers ──
type Errors = Record<string, string>;
const str = (v: unknown, max: number) => { const s = String(v ?? "").replace(/\s+/g, " ").trim(); return s ? s.slice(0, max) : null; };
const longStr = (v: unknown, max: number) => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : NaN);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (list.includes(v as T) ? (v as T) : null);
const tags = (v: unknown, max: number, each = 40) => {
    const raw = Array.isArray(v) ? v : String(v ?? "").split(",");
    const out: string[] = [];
    for (const x of raw) {
        const t = String(x).replace(/\s+/g, " ").trim().slice(0, each);
        if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    }
    return out.slice(0, max);
};
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(s);
/** Indian mobile (+91 optional) or landline with STD code. */
export const isIndianPhone = (s: string) => {
    const d = s.replace(/[\s\-().]/g, "");
    return /^(\+91|91|0)?[6-9]\d{9}$/.test(d) || /^0\d{2,4}\d{6,8}$/.test(d);
};
const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type RequisitionValues = Partial<JobRequisition>;

/**
 * Validates the wizard body. `strict` = submitting / creating (all required fields);
 * otherwise a draft (title + client; everything given must still be valid).
 */
export function parseRequisition(b: Record<string, unknown>, ctx: { me: User; manager: boolean; strict: boolean; existing?: JobRequisition }) {
    const { me, manager, strict, existing } = ctx;
    const errors: Errors = {};
    const warnings: string[] = [];
    const v: RequisitionValues = {};
    const need = (field: string, ok: boolean, msg: string) => { if (!ok && !errors[field]) errors[field] = msg; };

    // ── Step 1 — basic information ──
    v.title = str(b.title, 120) ?? undefined;
    need("title", !!v.title, "Job title is required");
    const client = clients.find((c) => c.id === b.clientId && c.orgId === me.orgId);
    if (b.clientId && !client) errors.clientId = "Client not found";
    need("clientId", !!client, "Select a client");
    if (client) v.clientId = client.id;
    v.clientRequisitionId = str(b.clientRequisitionId, 60);
    v.department = str(b.department, 80) ?? undefined;
    if (strict) need("department", !!v.department, "Department is required");
    v.jobCategory = oneOf(keys(JOB_CATEGORIES), b.jobCategory) ?? undefined;
    if (b.jobCategory && !v.jobCategory) errors.jobCategory = "Unknown job category";
    if (strict) need("jobCategory", !!v.jobCategory, "Job category is required");
    const empTypes = [...keys(EMPLOYMENT_TYPES), ...LEGACY_EMPLOYMENT_TYPES];
    v.employmentType = oneOf(empTypes, b.employmentType) ?? undefined;
    if (b.employmentType && !v.employmentType) errors.employmentType = "Unknown employment type";
    if (strict) need("employmentType", !!v.employmentType, "Employment type is required");
    v.requisitionType = oneOf(keys(REQUISITION_TYPES), b.requisitionType) ?? undefined;
    if (strict) need("requisitionType", !!v.requisitionType, "Requisition type is required");
    const replacing = v.requisitionType === "REPLACEMENT" || v.requisitionType === "BACKFILL";
    v.vacancyType = replacing ? "REPLACEMENT" : "NEW_HIRING";
    v.replacementFor = replacing ? str(b.replacementFor, 120) : null;
    if (strict && replacing) need("replacementFor", !!v.replacementFor, "Name the employee being replaced");
    const openings = numOrNull(b.openings);
    if (openings !== null && (!Number.isInteger(openings) || openings < 1 || openings > 500)) errors.openings = "Openings must be a whole number between 1 and 500";
    else if (openings !== null) v.openings = openings;
    if (strict) need("openings", openings !== null, "Number of openings is required");
    if (existing && v.openings !== undefined && v.openings < (existing.filled || 0)) errors.openings = `${existing.filled} position(s) are already filled — openings cannot go below that`;
    v.priority = oneOf(keys(PRIORITIES), b.priority) ?? undefined;
    if (strict) need("priority", !!v.priority, "Priority is required");

    // ── Step 2 — requirements ──
    const minExp = numOrNull(b.experienceMinYears), maxExp = numOrNull(b.experienceMaxYears);
    for (const [k, x] of [["experienceMinYears", minExp], ["experienceMaxYears", maxExp]] as const) {
        if (x !== null && (Number.isNaN(x) || x < 0 || x > 50)) errors[k] = "Experience must be between 0 and 50 years";
    }
    if (strict) { need("experienceMinYears", minExp !== null, "Minimum experience is required"); need("experienceMaxYears", maxExp !== null, "Maximum experience is required"); }
    if (minExp !== null && maxExp !== null && !errors.experienceMinYears && minExp > maxExp) errors.experienceMaxYears = "Maximum experience must be at least the minimum";
    if (minExp !== null && !Number.isNaN(minExp)) v.experienceMinYears = minExp;
    if (maxExp !== null && !Number.isNaN(maxExp)) v.experienceMaxYears = maxExp;

    v.salaryType = oneOf(keys(SALARY_TYPES), b.salaryType) ?? undefined;
    if (strict) need("salaryType", !!v.salaryType, "Salary type is required");
    const unit = v.salaryType ?? "ANNUAL_CTC";
    const maxFor = unit === "MONTHLY" ? 5_000_000 : unit === "HOURLY" ? 50_000 : 500;
    const minSal = numOrNull(b.salaryAmountMin), maxSal = numOrNull(b.salaryAmountMax);
    for (const [k, x] of [["salaryAmountMin", minSal], ["salaryAmountMax", maxSal]] as const) {
        if (x !== null && (Number.isNaN(x) || x <= 0 || x > maxFor)) errors[k] = unit === "ANNUAL_CTC" ? "Enter the salary in lakhs per annum (e.g. 12.5)" : "Enter a valid amount in rupees";
    }
    if (strict) { need("salaryAmountMin", minSal !== null, "Minimum salary is required"); need("salaryAmountMax", maxSal !== null, "Maximum salary is required"); }
    if (minSal !== null && maxSal !== null && !errors.salaryAmountMin && !errors.salaryAmountMax && minSal > maxSal) errors.salaryAmountMax = "Maximum salary must be at least the minimum";
    if (minSal !== null && !errors.salaryAmountMin) { v.salaryAmountMin = minSal; v.salaryMinLpa = toLpa(minSal, unit); }
    if (maxSal !== null && !errors.salaryAmountMax) { v.salaryAmountMax = maxSal; v.salaryMaxLpa = toLpa(maxSal, unit); }
    v.salaryCurrency = "INR";
    v.noticePeriodPreference = oneOf(NOTICE_PERIODS, b.noticePeriodPreference) ?? undefined;
    v.joiningPreference = oneOf(JOINING_TIMELINES, b.joiningPreference) ?? undefined;

    v.skills = tags(b.skills, 30);
    if (strict) need("skills", v.skills.length > 0, "Add at least one primary skill");
    const primary = new Set(v.skills.map((s) => s.toLowerCase()));
    v.preferredSkills = tags(b.preferredSkills, 30).filter((s) => !primary.has(s.toLowerCase()));
    v.minimumQualification = oneOf(QUALIFICATIONS, b.minimumQualification);
    if (b.minimumQualification && !v.minimumQualification) errors.minimumQualification = "Pick a qualification from the list";
    v.education = v.minimumQualification ?? undefined;
    v.preferredQualification = str(b.preferredQualification, 200);
    v.certifications = tags(b.certifications, 20, 80);
    v.descriptionHtml = sanitizeHtml(b.descriptionHtml);
    v.description = htmlToText(v.descriptionHtml);
    if (strict) need("descriptionHtml", v.description.length >= 30, "Write a job description (at least a few lines)");
    v.responsibilitiesHtml = sanitizeHtml(b.responsibilitiesHtml) || null;
    v.responsibilities = v.responsibilitiesHtml ? htmlToText(v.responsibilitiesHtml) : undefined;
    v.additionalRequirements = longStr(b.additionalRequirements, 2000);

    // ── Step 3 — location ──
    const workMode = oneOf([...keys(WORK_MODES), "FIELD"] as WorkModeValue[], b.workMode);
    if (strict) need("workMode", !!workMode, "Work mode is required");
    if (workMode) v.workMode = workMode;
    const office = (b.officeAddress && typeof b.officeAddress === "object" ? b.officeAddress : {}) as Record<string, unknown>;
    const officeAddress = { building: str(office.building, 120), floor: str(office.floor, 60), street: str(office.street, 160), landmark: str(office.landmark, 120) };
    const loc = validateLocation(me.orgId, {
        workMode: workMode ?? "REMOTE",
        stateCode: str(b.locationStateCode, 4), districtId: str(b.locationDistrictId, 120), cityId: str(b.locationCityId, 180),
        locality: str(b.locationLocality, 120), pincode: str(b.locationPincode, 10), officeAddress,
    });
    // Drafts keep partial locations; only format / hierarchy problems block them
    const formatOnly = (e: string) => !/is required/.test(e);
    for (const e of strict ? loc.errors : loc.errors.filter(formatOnly)) {
        const field = /PIN/.test(e) ? "locationPincode" : /Locality/.test(e) ? "locationLocality" : /address/.test(e) ? "officeAddress" : /city/i.test(e) ? "locationCityId" : /district/i.test(e) ? "locationDistrictId" : "locationStateCode";
        if (!errors[field]) errors[field] = e;
    }
    warnings.push(...loc.warnings);
    const L = loc.location;
    Object.assign(v, {
        locationStateCode: L.stateCode, locationState: L.stateName, locationDistrictId: L.districtId, locationDistrict: L.districtName,
        locationCityId: L.cityId, city: L.cityName ?? undefined, locationLocality: L.locality, locationPincode: L.pincode,
        officeAddress: Object.values(officeAddress).some(Boolean) ? officeAddress : null,
        country: "India",
        // Older screens read `location`; keep a short human version
        location: workMode === "REMOTE" && !L.cityName ? "Remote" : [L.locality, L.cityName ?? L.districtName ?? L.stateName].filter(Boolean).join(", ") || (workMode === "REMOTE" ? "Remote" : ""),
        remoteLocationPreference: workMode === "REMOTE" ? str(b.remoteLocationPreference, 120) : null,
        relocationRequired: b.relocationRequired === true,
        travelRequired: b.travelRequired === true,
    });

    // ── Step 4 — hiring & assignment ──
    const recruiterIds = [b.primaryRecruiterId, ...(Array.isArray(b.assignedTas) ? b.assignedTas : [])].filter((x): x is string => typeof x === "string" && !!x);
    if (recruiterIds.length && !manager && recruiterIds.some((id) => id !== existing?.primaryRecruiterId && !(existing?.assignedTas ?? []).includes(id))) {
        errors.primaryRecruiterId = "Only a team lead can assign recruiters";
    } else if (recruiterIds.length) {
        const bad = validRecruiters(me.orgId, recruiterIds).invalid;
        if (bad.length) errors.primaryRecruiterId = "Pick recruiters from your team";
    }
    v.primaryRecruiterId = typeof b.primaryRecruiterId === "string" && b.primaryRecruiterId ? b.primaryRecruiterId : null;
    if (strict && manager) need("primaryRecruiterId", !!v.primaryRecruiterId, "Assign a recruiter");
    v.assignedTas = [...new Set([v.primaryRecruiterId, ...(Array.isArray(b.assignedTas) ? b.assignedTas : [])].filter((x): x is string => typeof x === "string" && !!x))];
    v.hiringManagerName = str(b.hiringManagerName, 120);
    if (b.accountManagerId) {
        const am = users.find((u) => u.id === b.accountManagerId && u.orgId === me.orgId && ["SUPER_ADMIN", "TA_MANAGER"].includes(u.role));
        if (!am) errors.accountManagerId = "Account manager must be a team lead or admin";
        else v.accountManagerId = am.id;
    } else v.accountManagerId = null;
    v.recruiterTeam = str(b.recruiterTeam, 80);
    const today = todayIst();
    const closeDate = str(b.targetCloseDate, 10);
    if (closeDate && !DATE_RE.test(closeDate)) errors.targetCloseDate = "Invalid date";
    else if (closeDate && closeDate < today && closeDate !== existing?.targetCloseDate) errors.targetCloseDate = "Target closure date cannot be in the past";
    if (strict) need("targetCloseDate", !!closeDate, "Target closure date is required");
    v.targetCloseDate = closeDate;
    const joinDate = str(b.targetJoiningDate, 10);
    if (joinDate && !DATE_RE.test(joinDate)) errors.targetJoiningDate = "Invalid date";
    else if (joinDate && joinDate < today && joinDate !== existing?.targetJoiningDate) errors.targetJoiningDate = "Expected joining date cannot be in the past";
    v.targetJoiningDate = joinDate;
    v.interviewRounds = tags(b.interviewRounds, 12, 60);
    v.hiringReason = oneOf(keys(HIRING_REASONS), b.hiringReason) ?? undefined;
    if (strict) need("hiringReason", !!v.hiringReason, "Hiring reason is required");
    if (manager) v.internalNotes = longStr(b.internalNotes, 3000);

    // ── Step 5 — client & commercials ──
    v.clientContactName = str(b.clientContactName, 120);
    v.clientContactEmail = str(b.clientContactEmail, 160)?.toLowerCase() ?? null;
    if (v.clientContactEmail && !isEmail(v.clientContactEmail)) errors.clientContactEmail = "Enter a valid email address";
    v.clientContactPhone = str(b.clientContactPhone, 20);
    if (v.clientContactPhone && !isIndianPhone(v.clientContactPhone)) errors.clientContactPhone = "Enter a valid Indian phone number (10-digit mobile or landline with STD code)";
    v.billingType = oneOf(keys(BILLING_TYPES), b.billingType);
    const fee = numOrNull(b.placementFeePct);
    if (fee !== null && (Number.isNaN(fee) || fee < 0 || fee > 100)) errors.placementFeePct = "Placement fee must be between 0 and 100%";
    else v.placementFeePct = fee;
    v.contractType = oneOf(keys(CONTRACT_TYPES), b.contractType);
    const guarantee = numOrNull(b.replacementGuaranteeDays);
    if (guarantee !== null && (Number.isNaN(guarantee) || !Number.isInteger(guarantee) || guarantee < 0 || guarantee > 365)) errors.replacementGuaranteeDays = "Guarantee must be 0–365 days";
    else v.replacementGuaranteeDays = guarantee;
    v.commercialNotes = longStr(b.commercialNotes, 2000);

    return { errors, warnings, values: v, location: L };
}

/** Requisitions that look like the same opening: same client, title and city (or locality) still active. */
export function findDuplicate(list: JobRequisition[], v: RequisitionValues, exceptId?: string) {
    const n = (s: string | null | undefined) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return list.find((j) => j.id !== exceptId && j.clientId === v.clientId && n(j.title) === n(v.title)
        && !["CLOSED", "CANCELLED", "FULFILLED", "DRAFT"].includes(j.status)
        && (v.locationCityId ? j.locationCityId === v.locationCityId || n(j.city) === n(v.city) : n(j.location) === n(v.location)));
}

export type ApprovalMode = "RECRUITERS_ONLY" | "ALL" | "NONE";
export const approvalModeOf = (settings: Record<string, unknown> | undefined): ApprovalMode =>
    (["RECRUITERS_ONLY", "ALL", "NONE"] as const).includes(settings?.requisitionApprovalMode as ApprovalMode) ? (settings!.requisitionApprovalMode as ApprovalMode) : "RECRUITERS_ONLY";
