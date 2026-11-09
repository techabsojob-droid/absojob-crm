"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronRight, FileText, Loader2, Pencil, Save, Send } from "lucide-react";
import { ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import type { JobRequisition } from "@/lib/types";
import {
    BILLING_TYPES, CONTRACT_TYPES, DEFAULT_INTERVIEW_ROUNDS, EMPLOYMENT_TYPES, HIRING_REASONS, JOB_CATEGORIES, JOINING_TIMELINES, NOTICE_PERIODS,
    PRIORITIES, QUALIFICATIONS, REQUISITION_TYPES, SALARY_TYPES, WORK_MODES, optLabel, requisitionStatusLabel, salaryUnit, toLpa,
} from "@/lib/requisition-options";
import { Combobox, Field, inputCls, RichText, RichTextEditor, RoundsEditor, Section, TagInput, textareaCls, Toggle, type Option } from "./controls";
import { EMPTY_LOCATION, IndiaLocationPicker, locationSummary, type LocationValue } from "./IndiaLocationPicker";

// ─── Types ────────────────────────────────────────────────────
interface Contact { name: string; email: string; phone: string; source: string }
interface Options {
    isManager: boolean; needsApproval: boolean; me: { id: string; name: string; role: string };
    clients: { id: string; name: string; industry: string; status: string; assignable?: boolean; creditHold: boolean; creditReasons: string[]; contacts: Contact[]; defaults: { billingType: string; placementFeePct: number | null; replacementGuaranteeDays: number | null } }[];
    departments: string[]; recruiterTeams: string[];
    recruiters: { id: string; name: string; role: string; designation: string | null; department: string | null }[];
    managers: { id: string; name: string; role: string }[];
    skillSuggestions: string[]; certificationSuggestions: string[]; hiringManagers: string[];
}
type Office = { building: string; floor: string; street: string; landmark: string };
type F = LocationValue & {
    title: string; clientId: string; clientRequisitionId: string; department: string; jobCategory: string; employmentType: string; requisitionType: string; replacementFor: string;
    openings: string; priority: string;
    experienceMinYears: string; experienceMaxYears: string; salaryType: string; salaryAmountMin: string; salaryAmountMax: string; noticePeriodPreference: string; joiningPreference: string;
    skills: string[]; preferredSkills: string[]; minimumQualification: string; preferredQualification: string; certifications: string[];
    descriptionHtml: string; responsibilitiesHtml: string; additionalRequirements: string;
    workMode: string; officeAddress: Office; remoteLocationPreference: string; relocationRequired: boolean; travelRequired: boolean;
    primaryRecruiterId: string; assignedTas: string[]; hiringManagerName: string; accountManagerId: string; recruiterTeam: string;
    targetCloseDate: string; targetJoiningDate: string; interviewRounds: string[]; hiringReason: string; internalNotes: string;
    clientContactName: string; clientContactEmail: string; clientContactPhone: string; billingType: string; placementFeePct: string; contractType: string;
    replacementGuaranteeDays: string; commercialNotes: string;
};
type Errors = Partial<Record<keyof F | "officeAddress", string>>;

const EMPTY: F = {
    ...EMPTY_LOCATION,
    title: "", clientId: "", clientRequisitionId: "", department: "", jobCategory: "", employmentType: "FULL_TIME", requisitionType: "NEW_POSITION", replacementFor: "",
    openings: "1", priority: "MEDIUM",
    experienceMinYears: "", experienceMaxYears: "", salaryType: "ANNUAL_CTC", salaryAmountMin: "", salaryAmountMax: "", noticePeriodPreference: "", joiningPreference: "",
    skills: [], preferredSkills: [], minimumQualification: "", preferredQualification: "", certifications: [], descriptionHtml: "", responsibilitiesHtml: "", additionalRequirements: "",
    workMode: "ONSITE", officeAddress: { building: "", floor: "", street: "", landmark: "" }, remoteLocationPreference: "", relocationRequired: false, travelRequired: false,
    primaryRecruiterId: "", assignedTas: [], hiringManagerName: "", accountManagerId: "", recruiterTeam: "", targetCloseDate: "", targetJoiningDate: "",
    interviewRounds: [], hiringReason: "", internalNotes: "",
    clientContactName: "", clientContactEmail: "", clientContactPhone: "", billingType: "", placementFeePct: "", contractType: "", replacementGuaranteeDays: "", commercialNotes: "",
};

const STEPS = [
    { key: "basic", title: "Basic Information", short: "Basics" },
    { key: "requirements", title: "Job Requirements", short: "Requirements" },
    { key: "location", title: "Location & Work Arrangement", short: "Location" },
    { key: "hiring", title: "Hiring & Assignment", short: "Hiring" },
    { key: "commercial", title: "Commercial Details", short: "Commercial" },
    { key: "review", title: "Review & Submit", short: "Review" },
] as const;
const STEP_FIELDS: (keyof F | "officeAddress")[][] = [
    ["title", "clientId", "clientRequisitionId", "department", "jobCategory", "employmentType", "requisitionType", "replacementFor", "openings", "priority"],
    ["experienceMinYears", "experienceMaxYears", "salaryType", "salaryAmountMin", "salaryAmountMax", "noticePeriodPreference", "joiningPreference", "skills", "preferredSkills", "minimumQualification", "preferredQualification", "certifications", "descriptionHtml", "responsibilitiesHtml", "additionalRequirements"],
    ["workMode", "locationStateCode", "locationDistrictId", "locationCityId", "locationLocality", "locationPincode", "officeAddress", "remoteLocationPreference"],
    ["primaryRecruiterId", "assignedTas", "hiringManagerName", "accountManagerId", "recruiterTeam", "targetCloseDate", "targetJoiningDate", "interviewRounds", "hiringReason", "internalNotes"],
    ["clientContactName", "clientContactEmail", "clientContactPhone", "billingType", "placementFeePct", "contractType", "replacementGuaranteeDays", "commercialNotes"],
    [],
];

const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(s);
const isIndianPhone = (s: string) => { const d = s.replace(/[\s\-().]/g, ""); return /^(\+91|91|0)?[6-9]\d{9}$/.test(d) || /^0\d{2,4}\d{6,8}$/.test(d); };
const textOf = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plainToHtml = (s: string) => s.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
const s = (v: unknown) => (v == null ? "" : String(v));

/** Client-side mirror of the server rules, for instant inline messages. The server re-checks everything. */
function validate(f: F, step: number, opts: { strict: boolean; isManager: boolean; existingClose?: string | null; creditHold?: boolean }): Errors {
    const e: Errors = {};
    const req = (k: keyof F, ok: boolean, msg: string) => { if (opts.strict && !ok) e[k] = msg; };
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    if (step === 0) {
        if (!f.title.trim()) e.title = "Job title is required";
        if (!f.clientId) e.clientId = "Select a client";
        else if (opts.creditHold) e.clientId = "This client is on credit hold — finance must clear it first";
        req("department", !!f.department.trim(), "Department is required");
        req("jobCategory", !!f.jobCategory, "Job category is required");
        req("employmentType", !!f.employmentType, "Employment type is required");
        req("requisitionType", !!f.requisitionType, "Requisition type is required");
        if ((f.requisitionType === "REPLACEMENT" || f.requisitionType === "BACKFILL")) req("replacementFor", !!f.replacementFor.trim(), "Name the employee being replaced");
        const o = num(f.openings);
        if (o === null) req("openings", false, "Number of openings is required");
        else if (!Number.isInteger(o) || o < 1 || o > 500) e.openings = "Openings must be a whole number between 1 and 500";
        req("priority", !!f.priority, "Priority is required");
    }
    if (step === 1) {
        const mn = num(f.experienceMinYears), mx = num(f.experienceMaxYears);
        if (mn === null) req("experienceMinYears", false, "Minimum experience is required"); else if (mn < 0 || mn > 50) e.experienceMinYears = "0–50 years";
        if (mx === null) req("experienceMaxYears", false, "Maximum experience is required"); else if (mx < 0 || mx > 50) e.experienceMaxYears = "0–50 years";
        if (mn !== null && mx !== null && mn > mx) e.experienceMaxYears = "Maximum experience must be at least the minimum";
        const a = num(f.salaryAmountMin), b = num(f.salaryAmountMax);
        if (a === null) req("salaryAmountMin", false, "Minimum salary is required"); else if (a <= 0) e.salaryAmountMin = "Enter a positive amount";
        if (b === null) req("salaryAmountMax", false, "Maximum salary is required"); else if (b <= 0) e.salaryAmountMax = "Enter a positive amount";
        if (f.salaryType === "ANNUAL_CTC" && ((a ?? 0) > 500 || (b ?? 0) > 500)) e.salaryAmountMax = "Annual CTC is in lakhs (LPA) — e.g. 12.5";
        if (a !== null && b !== null && a > b) e.salaryAmountMax = "Maximum salary must be at least the minimum";
        req("salaryType", !!f.salaryType, "Salary type is required");
        req("skills", f.skills.length > 0, "Add at least one primary skill");
        req("descriptionHtml", textOf(f.descriptionHtml).length >= 30, "Write a job description (at least a few lines)");
    }
    if (step === 2) {
        req("workMode", !!f.workMode, "Work mode is required");
        const area = f.workMode !== "REMOTE";
        const place = f.workMode === "ONSITE" || f.workMode === "HYBRID";
        if (area) {
            req("locationStateCode", !!f.locationStateCode, "State / UT is required");
            req("locationDistrictId", !!f.locationDistrictId, "District is required");
            req("locationCityId", !!f.locationCityId, "City / taluka is required");
        }
        if (place) {
            req("locationLocality", !!f.locationLocality.trim(), "Locality is required for office-based work");
            req("locationPincode", !!f.locationPincode, "PIN code is required for office-based work");
        }
        if (f.locationPincode && !/^[1-9]\d{5}$/.test(f.locationPincode)) e.locationPincode = "PIN code must be exactly 6 digits";
        if (f.workMode === "ONSITE" && opts.strict && !f.officeAddress.building.trim() && !f.officeAddress.street.trim()) e.officeAddress = "Add the office building or street for Work From Office";
    }
    if (step === 3) {
        if (opts.isManager) req("primaryRecruiterId", !!f.primaryRecruiterId, "Assign a recruiter");
        req("targetCloseDate", !!f.targetCloseDate, "Target closure date is required");
        if (f.targetCloseDate && f.targetCloseDate < todayIst() && f.targetCloseDate !== opts.existingClose) e.targetCloseDate = "Target closure date cannot be in the past";
        if (f.targetJoiningDate && f.targetJoiningDate < todayIst()) e.targetJoiningDate = "Expected joining date cannot be in the past";
        req("hiringReason", !!f.hiringReason, "Hiring reason is required");
    }
    if (step === 4) {
        if (f.clientContactEmail && !isEmail(f.clientContactEmail)) e.clientContactEmail = "Enter a valid email address";
        if (f.clientContactPhone && !isIndianPhone(f.clientContactPhone)) e.clientContactPhone = "Enter a valid Indian phone number";
        const fee = num(f.placementFeePct);
        if (fee !== null && (fee < 0 || fee > 100)) e.placementFeePct = "0–100%";
        const g = num(f.replacementGuaranteeDays);
        if (g !== null && (!Number.isInteger(g) || g < 0 || g > 365)) e.replacementGuaranteeDays = "0–365 days";
    }
    return e;
}

// Job from the API → form state
function fromJob(j: Partial<JobRequisition>, duplicate: boolean): F {
    const future = (d: unknown) => (typeof d === "string" && d >= todayIst() ? d : "");
    const office = (j.officeAddress ?? {}) as Partial<Office>;
    return {
        ...EMPTY,
        title: s(j.title), clientId: s(j.clientId), clientRequisitionId: duplicate ? "" : s(j.clientRequisitionId), department: s(j.department), jobCategory: s(j.jobCategory),
        employmentType: s(j.employmentType) || "FULL_TIME", requisitionType: s(j.requisitionType) || (j.vacancyType === "REPLACEMENT" ? "REPLACEMENT" : "NEW_POSITION"),
        replacementFor: s(j.replacementFor), openings: s(j.openings || 1), priority: s(j.priority) || "MEDIUM",
        experienceMinYears: s(j.experienceMinYears), experienceMaxYears: s(j.experienceMaxYears), salaryType: s(j.salaryType) || "ANNUAL_CTC",
        salaryAmountMin: s(j.salaryAmountMin ?? j.salaryMinLpa), salaryAmountMax: s(j.salaryAmountMax ?? j.salaryMaxLpa),
        noticePeriodPreference: (NOTICE_PERIODS as readonly string[]).includes(j.noticePeriodPreference ?? "") ? j.noticePeriodPreference! : "",
        joiningPreference: (JOINING_TIMELINES as readonly string[]).includes(j.joiningPreference ?? "") ? j.joiningPreference! : "",
        skills: j.skills ?? [], preferredSkills: j.preferredSkills ?? [],
        minimumQualification: (QUALIFICATIONS as readonly string[]).includes(j.minimumQualification ?? j.education ?? "") ? (j.minimumQualification ?? j.education)! : "",
        preferredQualification: s(j.preferredQualification || ((QUALIFICATIONS as readonly string[]).includes(j.education ?? "") ? "" : j.education)),
        certifications: j.certifications ?? [],
        descriptionHtml: j.descriptionHtml || (j.description ? plainToHtml(j.description) : ""),
        responsibilitiesHtml: j.responsibilitiesHtml || (j.responsibilities ? plainToHtml(j.responsibilities) : ""),
        additionalRequirements: s(j.additionalRequirements),
        workMode: (["ONSITE", "WFH", "HYBRID", "REMOTE"] as string[]).includes(j.workMode ?? "") ? j.workMode! : "ONSITE",
        locationStateCode: s(j.locationStateCode), locationStateName: s(j.locationState), locationDistrictId: s(j.locationDistrictId), locationDistrictName: s(j.locationDistrict),
        locationCityId: s(j.locationCityId), locationCityName: j.locationCityId ? s(j.city) : "", locationLocality: s(j.locationLocality), locationPincode: s(j.locationPincode),
        officeAddress: { building: s(office.building), floor: s(office.floor), street: s(office.street), landmark: s(office.landmark) },
        remoteLocationPreference: s(j.remoteLocationPreference), relocationRequired: !!j.relocationRequired, travelRequired: !!j.travelRequired,
        primaryRecruiterId: s(j.primaryRecruiterId), assignedTas: (j.assignedTas ?? []).filter((x) => x !== j.primaryRecruiterId),
        hiringManagerName: s(j.hiringManagerName), accountManagerId: s(j.accountManagerId), recruiterTeam: s(j.recruiterTeam),
        targetCloseDate: duplicate ? future(j.targetCloseDate) : s(j.targetCloseDate), targetJoiningDate: duplicate ? future(j.targetJoiningDate) : s(j.targetJoiningDate),
        interviewRounds: j.interviewRounds ?? [], hiringReason: s(j.hiringReason), internalNotes: s(j.internalNotes),
        clientContactName: s(j.clientContactName), clientContactEmail: s(j.clientContactEmail), clientContactPhone: s(j.clientContactPhone),
        billingType: s(j.billingType), placementFeePct: s(j.placementFeePct), contractType: s(j.contractType), replacementGuaranteeDays: s(j.replacementGuaranteeDays), commercialNotes: s(j.commercialNotes),
    };
}

const strOpts = (list: readonly string[]): Option[] => list.map((x) => ({ value: x, label: x }));

// ─── Wizard ───────────────────────────────────────────────────
export default function RequisitionWizard({ jobId, duplicateOf }: { jobId?: string; duplicateOf?: string }) {
    const router = useRouter();
    const qc = useQueryClient();
    const editing = !!jobId;
    const options = useQuery<Options>({ queryKey: ["requisition-options"], queryFn: () => api("/api/ta/requisition-options") });
    const sourceId = jobId ?? duplicateOf;
    const source = useQuery<{ job: Partial<JobRequisition>; canEdit: boolean }>({ queryKey: ["job-360", sourceId], queryFn: () => api(`/api/admin/jobs/${sourceId}`), enabled: !!sourceId });

    const [f, setF] = useState<F>(EMPTY);
    const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    const [visited, setVisited] = useState(0);
    const [errors, setErrors] = useState<Errors>({});
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState<null | "draft" | "submit" | "save">(null);
    const [duplicate, setDuplicate] = useState<null | { id: string; requisitionCode: string | null; title: string; status: string; openings: number; filled: number; intent: "draft" | "submit" | "save" }>(null);
    const savedOk = useRef(false);

    // Load the requisition being edited / duplicated (once)
    if (source.data?.job && loadedFrom !== sourceId) {
        setLoadedFrom(sourceId!);
        setF(fromJob(source.data.job, !!duplicateOf));
    }
    const job = editing ? source.data?.job : undefined;
    const status = job?.status as string | undefined;
    const isDraft = !editing || status === "DRAFT";
    const o = options.data;
    const isManager = !!o?.isManager;
    const client = o?.clients.find((c) => c.id === f.clientId);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const h = (e: BeforeUnloadEvent) => { if (dirty && !savedOk.current) { e.preventDefault(); e.returnValue = ""; } };
        window.addEventListener("beforeunload", h);
        return () => window.removeEventListener("beforeunload", h);
    }, [dirty]);

    const set = <K extends keyof F>(k: K, v: F[K]) => { setF((p) => ({ ...p, [k]: v })); setDirty(true); setErrors((e) => ({ ...e, [k]: undefined })); };
    const bind = (k: keyof F) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never) });
    const vctx = { isManager, existingClose: job?.targetCloseDate ?? null, creditHold: client?.creditHold && o?.me.role !== "SUPER_ADMIN" };

    const go = (to: number) => {
        // Moving forward checks the current step's format and required fields; going back never blocks
        if (to > step) {
            const e = validate(f, step, { strict: true, ...vctx });
            if (Object.keys(e).length) { setErrors(e); toast.error("Please fix the highlighted fields"); return; }
        }
        setStep(to);
        setVisited((v) => Math.max(v, to));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const payload = (intent: "draft" | "submit" | "save", allowDuplicate = false) => ({
        intent, allowDuplicate,
        ...f,
        assignedTas: f.primaryRecruiterId ? [f.primaryRecruiterId, ...f.assignedTas.filter((x) => x !== f.primaryRecruiterId)] : f.assignedTas,
        relocationRequired: f.relocationRequired, travelRequired: f.travelRequired,
    });

    async function save(intent: "draft" | "submit" | "save", allowDuplicate = false) {
        // Drafts need only title + client; submit / save checks every step
        const all: Errors = {};
        for (let i = 0; i < 5; i++) Object.assign(all, validate(f, i, { strict: intent !== "draft", ...vctx }));
        if (intent === "draft") for (const k of Object.keys(all) as (keyof Errors)[]) if (/required|Add at least|Write a job|Assign a/.test(all[k] ?? "") && k !== "title" && k !== "clientId") delete all[k];
        if (Object.keys(all).length) {
            setErrors(all);
            const first = STEP_FIELDS.findIndex((fs) => fs.some((k) => all[k]));
            if (first >= 0) setStep(first);
            toast.error("Please fix the highlighted fields");
            return;
        }
        setSaving(intent);
        try {
            const res = await fetch(editing ? `/api/admin/jobs/${jobId}` : "/api/admin/jobs", {
                method: editing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload(intent, allowDuplicate)),
            });
            const d = await res.json().catch(() => ({}));
            if (res.status === 409 && d.duplicate) { setDuplicate({ ...d.duplicate, intent }); return; }
            if (res.status === 422 && d.fieldErrors) {
                setErrors(d.fieldErrors);
                const first = STEP_FIELDS.findIndex((fs) => fs.some((k) => d.fieldErrors[k]));
                if (first >= 0) setStep(first);
                toast.error(d.error ?? "Please fix the highlighted fields");
                return;
            }
            if (!res.ok) throw new Error(d.error ?? "Could not save the requisition");
            for (const w of d.warnings ?? []) toast.warning(w);
            savedOk.current = true;
            setDirty(false);
            ["ta-jobs", "job-360", "ta-dashboard", "sidebar-badges", "approvals"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
            if (intent === "draft") {
                toast.success(`Draft saved · ${d.requisitionCode}`);
                if (!editing) router.replace(`/ta/requisitions/${d.id}/edit`);
                savedOk.current = false;
                return;
            }
            toast.success(d.status === "PENDING_APPROVAL" ? `${d.requisitionCode} submitted for approval` : intent === "save" ? `${d.requisitionCode} updated` : `${d.requisitionCode} created and open for recruitment`);
            router.push(`/ta/requisitions/${d.id}`);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setSaving(null);
        }
    }

    const cancel = () => {
        if (dirty && !window.confirm("Discard your unsaved changes?")) return;
        savedOk.current = true;
        router.push(editing ? `/ta/requisitions/${jobId}` : "/ta/requisitions");
    };

    // ── Loading / access states ──
    if (options.isLoading || (sourceId && source.isLoading)) {
        return <div className="flex items-center justify-center py-32 text-neutral-400"><Loader2 className="animate-spin" /></div>;
    }
    if (options.isError) return <p className="text-sm text-red-600 py-20 text-center">{(options.error as Error).message}</p>;
    if (sourceId && source.isError) return <p className="text-sm text-red-600 py-20 text-center">{(source.error as Error).message}</p>;
    if (editing && source.data && !source.data.canEdit) {
        return (
            <div className="max-w-lg mx-auto py-24 text-center space-y-3">
                <p className="text-sm text-neutral-600">You can&apos;t edit this requisition{status ? ` (${requisitionStatusLabel(status).toLowerCase()})` : ""}. Only team leads edit live requisitions; recruiters can edit their own drafts.</p>
                <Link href={`/ta/requisitions/${jobId}`} className="text-sm font-semibold text-primary hover:underline">Back to requisition</Link>
            </div>
        );
    }

    const submitLabel = editing && !isDraft ? "Save changes" : o?.needsApproval ? "Submit for Approval" : "Create Requisition";
    const recruiterOpts: Option[] = (o?.recruiters ?? []).map((r) => ({ value: r.id, label: r.name, hint: [r.role === "TA_MANAGER" ? "Team lead" : "Recruiter", r.department].filter(Boolean).join(" · ") }));
    const contactOpts: Option[] = (client?.contacts ?? []).filter((c) => c.name).map((c) => ({ value: c.name, label: c.name, hint: [c.email, c.source].filter(Boolean).join(" · ") }));
    const unit = salaryUnit(f.salaryType);
    const lpaHint = (v: string) => (f.salaryType !== "ANNUAL_CTC" && Number(v) > 0 ? `≈ ${toLpa(Number(v), f.salaryType)} LPA` : undefined);
    const loc: LocationValue = f;

    return (
        <div className="max-w-5xl mx-auto pb-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <Link href={editing ? `/ta/requisitions/${jobId}` : "/ta/requisitions"} onClick={(e) => { if (dirty && !window.confirm("Discard your unsaved changes?")) e.preventDefault(); else savedOk.current = true; }} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-800">
                        <ArrowLeft size={13} /> {editing ? "Back to requisition" : "Job Listing"}
                    </Link>
                    <h1 className="text-2xl font-bold text-neutral-900 mt-1">
                        {editing ? `Edit ${job?.requisitionCode ?? "requisition"}` : duplicateOf ? "Duplicate requisition" : "Create New Requisition"}
                    </h1>
                    <p className="text-sm text-neutral-500 mt-0.5">
                        {editing ? <>Status: <b className="text-neutral-700">{requisitionStatusLabel(status ?? "")}</b>{job?.statusReason && status === "DRAFT" ? <> · <span className="text-amber-700">{job.statusReason}</span></> : null}</>
                            : o?.needsApproval ? "Your team lead approves the requisition before recruitment starts." : "The requisition ID is generated when you save."}
                    </p>
                </div>
                {dirty && <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg shrink-0">Unsaved changes</span>}
            </div>

            {/* Progress */}
            <nav aria-label="Steps" className="mb-6">
                <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
                    {STEPS.map((st, i) => {
                        const hasErr = STEP_FIELDS[i].some((k) => errors[k]);
                        const done = i < step || (i <= visited && i !== step);
                        return (
                            <li key={st.key} className="flex items-center gap-1 sm:gap-2 shrink-0">
                                <button type="button" onClick={() => (i <= visited || i < step ? go(i) : go(i))} disabled={i > visited + 1}
                                    aria-current={i === step ? "step" : undefined}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed ${i === step ? "bg-primary text-white shadow-sm shadow-primary/20" : hasErr ? "bg-red-50 text-red-700" : done ? "bg-primary/8 text-primary hover:bg-primary/12" : "text-neutral-400"}`}>
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === step ? "bg-white/20" : hasErr ? "bg-red-100" : done ? "bg-primary/15" : "bg-neutral-100"}`}>
                                        {hasErr ? "!" : done && i !== step ? <Check size={11} /> : i + 1}
                                    </span>
                                    <span className="hidden md:inline">{st.title}</span>
                                    <span className="md:hidden">{st.short}</span>
                                </button>
                                {i < STEPS.length - 1 && <ChevronRight size={14} className="text-neutral-300" />}
                            </li>
                        );
                    })}
                </ol>
                <div className="h-1 bg-neutral-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
            </nav>

            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 sm:p-7 space-y-8">
                {step === 0 && (
                    <>
                        <Section title="Basic Information" description="What the role is and who it's for.">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Job Title" required error={errors.title} htmlFor="title" className="sm:col-span-2">
                                    <input id="title" maxLength={120} {...bind("title")} placeholder="e.g. Senior Java Developer" className={inputCls(errors.title)} />
                                </Field>
                                <Field label="Requisition ID" hint="Generated by the system when saved">
                                    <input disabled value={job?.requisitionCode ?? "REQ-YYYY-NNNN (auto)"} className={inputCls()} />
                                </Field>
                                <Field label="Requisition Status" hint="Managed by the approval workflow">
                                    <input disabled value={editing ? requisitionStatusLabel(status ?? "") : "Draft"} className={inputCls()} />
                                </Field>
                                <Field label="Client" required error={errors.clientId} htmlFor="client" hint={client?.creditHold ? `Credit hold: ${client.creditReasons.join("; ")}` : undefined}>
                                    <Combobox id="client" value={f.clientId} error={errors.clientId} placeholder="Search client"
                                        options={(o?.clients ?? []).filter((c) => c.assignable !== false || c.id === f.clientId).map((c) => ({ value: c.id, label: c.name, hint: [c.industry, c.creditHold ? "credit hold" : c.status !== "ACTIVE" ? c.status.toLowerCase() : ""].filter(Boolean).join(" · ") }))}
                                        onChange={(v) => {
                                            const c = o?.clients.find((x) => x.id === v);
                                            setF((p) => ({
                                                ...p, clientId: v,
                                                // Prefill commercials and contact from the client's record when still empty
                                                billingType: p.billingType || c?.defaults.billingType || "",
                                                placementFeePct: p.placementFeePct || s(c?.defaults.placementFeePct),
                                                replacementGuaranteeDays: p.replacementGuaranteeDays || s(c?.defaults.replacementGuaranteeDays),
                                                ...(p.clientId !== v ? { clientContactName: c?.contacts[0]?.name ?? "", clientContactEmail: c?.contacts[0]?.email ?? "", clientContactPhone: c?.contacts[0]?.phone ?? "" } : {}),
                                            }));
                                            setDirty(true);
                                            setErrors((e) => ({ ...e, clientId: undefined }));
                                        }} />
                                </Field>
                                <Field label="Client Requisition ID" hint="The client's own reference, if they gave one">
                                    <input maxLength={60} {...bind("clientRequisitionId")} placeholder="e.g. TN-ENG-2026-114" className={inputCls()} />
                                </Field>
                                <Field label="Department" required error={errors.department} htmlFor="dept">
                                    <Combobox id="dept" value={f.department} options={strOpts(o?.departments ?? [])} allowCustom placeholder="Search or add department" error={errors.department} onChange={(v) => set("department", v)} />
                                </Field>
                                <Field label="Job Category" required error={errors.jobCategory} htmlFor="cat">
                                    <select id="cat" {...bind("jobCategory")} className={inputCls(errors.jobCategory)}><option value="">Select category</option>{JOB_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                                </Field>
                                <Field label="Employment Type" required error={errors.employmentType}>
                                    <select {...bind("employmentType")} className={inputCls(errors.employmentType)}>{EMPLOYMENT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                                </Field>
                                <Field label="Requisition Type" required error={errors.requisitionType}>
                                    <select {...bind("requisitionType")} className={inputCls(errors.requisitionType)}>{REQUISITION_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                                </Field>
                                {(f.requisitionType === "REPLACEMENT" || f.requisitionType === "BACKFILL") && (
                                    <Field label="Replacement For" required error={errors.replacementFor} className="sm:col-span-2">
                                        <input maxLength={120} {...bind("replacementFor")} placeholder="Employee who is leaving or left" className={inputCls(errors.replacementFor)} />
                                    </Field>
                                )}
                                <Field label="Number of Openings" required error={errors.openings} hint={job?.filled ? `${job.filled} already filled` : undefined}>
                                    <input type="number" min={Math.max(1, job?.filled ?? 0)} max={500} step={1} {...bind("openings")} className={inputCls(errors.openings)} />
                                </Field>
                                <Field label="Priority" required error={errors.priority}>
                                    <select {...bind("priority")} className={inputCls(errors.priority)}>{PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                                </Field>
                            </div>
                        </Section>
                    </>
                )}

                {step === 1 && (
                    <>
                        <Section title="Experience & Compensation" description="Salary is in Indian Rupees.">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Minimum Experience (years)" required error={errors.experienceMinYears}><input type="number" min={0} max={50} step={0.5} {...bind("experienceMinYears")} className={inputCls(errors.experienceMinYears)} /></Field>
                                <Field label="Maximum Experience (years)" required error={errors.experienceMaxYears}><input type="number" min={0} max={50} step={0.5} {...bind("experienceMaxYears")} className={inputCls(errors.experienceMaxYears)} /></Field>
                                <Field label="Salary Type" required error={errors.salaryType}>
                                    <select {...bind("salaryType")} className={inputCls(errors.salaryType)}>{SALARY_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                                </Field>
                                <Field label="Salary Currency" hint="All salaries are in INR"><input disabled value="INR (₹)" className={inputCls()} /></Field>
                                <Field label={`Minimum Salary (${unit})`} required error={errors.salaryAmountMin} hint={lpaHint(f.salaryAmountMin)}><input type="number" min={0} step="any" {...bind("salaryAmountMin")} className={inputCls(errors.salaryAmountMin)} /></Field>
                                <Field label={`Maximum Salary (${unit})`} required error={errors.salaryAmountMax} hint={lpaHint(f.salaryAmountMax)}><input type="number" min={0} step="any" {...bind("salaryAmountMax")} className={inputCls(errors.salaryAmountMax)} /></Field>
                                <Field label="Notice Period">
                                    <select {...bind("noticePeriodPreference")} className={inputCls()}><option value="">No preference</option>{NOTICE_PERIODS.map((x) => <option key={x}>{x}</option>)}</select>
                                </Field>
                                <Field label="Preferred Joining Timeline">
                                    <select {...bind("joiningPreference")} className={inputCls()}><option value="">No preference</option>{JOINING_TIMELINES.map((x) => <option key={x}>{x}</option>)}</select>
                                </Field>
                            </div>
                        </Section>
                        <Section title="Skills & Qualifications">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Primary Skills" required error={errors.skills} hint="Search or type a skill and press Enter" className="sm:col-span-2">
                                    <TagInput value={f.skills} onChange={(v) => set("skills", v)} suggestions={(o?.skillSuggestions ?? []).filter((x) => !f.preferredSkills.some((y) => y.toLowerCase() === x.toLowerCase()))} placeholder="e.g. Java, Spring Boot" error={errors.skills} />
                                </Field>
                                <Field label="Secondary Skills" className="sm:col-span-2">
                                    <TagInput value={f.preferredSkills} onChange={(v) => set("preferredSkills", v.filter((x) => !f.skills.some((y) => y.toLowerCase() === x.toLowerCase())))} suggestions={(o?.skillSuggestions ?? []).filter((x) => !f.skills.some((y) => y.toLowerCase() === x.toLowerCase()))} placeholder="Nice-to-have skills" />
                                </Field>
                                <Field label="Minimum Qualification">
                                    <Combobox value={f.minimumQualification} options={strOpts(QUALIFICATIONS)} placeholder="Search qualification" onChange={(v) => set("minimumQualification", v)} error={errors.minimumQualification} />
                                </Field>
                                <Field label="Preferred Qualification"><input maxLength={200} {...bind("preferredQualification")} placeholder="e.g. B.Tech in Computer Science" className={inputCls()} /></Field>
                                <Field label="Required Certifications" className="sm:col-span-2">
                                    <TagInput value={f.certifications} onChange={(v) => set("certifications", v)} suggestions={o?.certificationSuggestions ?? []} max={20} placeholder="e.g. AWS Solutions Architect" />
                                </Field>
                                <Field label="Job Description" required error={errors.descriptionHtml} className="sm:col-span-2">
                                    <RichTextEditor value={f.descriptionHtml} onChange={(v) => set("descriptionHtml", v)} error={errors.descriptionHtml} placeholder="About the role, team and what success looks like…" minHeight={180} />
                                </Field>
                                <Field label="Key Responsibilities" className="sm:col-span-2">
                                    <RichTextEditor value={f.responsibilitiesHtml} onChange={(v) => set("responsibilitiesHtml", v)} placeholder="Use a bulleted list for day-to-day responsibilities" minHeight={120} />
                                </Field>
                                <Field label="Additional Requirements" className="sm:col-span-2">
                                    <textarea maxLength={2000} {...bind("additionalRequirements")} placeholder="Shift, background verification, languages, etc." className={textareaCls()} />
                                </Field>
                            </div>
                        </Section>
                    </>
                )}

                {step === 2 && (
                    <>
                        <Section title="Work Arrangement">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" role="radiogroup" aria-label="Work mode">
                                {WORK_MODES.map(([k, l]) => (
                                    <button key={k} type="button" role="radio" aria-checked={f.workMode === k} onClick={() => set("workMode", k)}
                                        className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${f.workMode === k ? "border-primary bg-primary/5 text-primary" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}>{l}</button>
                                ))}
                            </div>
                            <p className="text-xs text-neutral-500">
                                {f.workMode === "ONSITE" ? "Work From Office needs the precise office location and address." : f.workMode === "HYBRID" ? "Hybrid needs the office location; the address is optional." : f.workMode === "WFH" ? "Work From Home needs the city; the office address is optional." : "Remote roles can add an optional location preference."}
                            </p>
                        </Section>
                        <Section title={f.workMode === "REMOTE" ? "Base Location (optional)" : "Office Location"} description="India only — start with the quick search or pick State → District → City → Locality.">
                            <IndiaLocationPicker value={loc} onChange={(v) => { setF((p) => ({ ...p, ...v })); setDirty(true); setErrors((e) => ({ ...e, locationStateCode: undefined, locationDistrictId: undefined, locationCityId: undefined, locationLocality: undefined, locationPincode: undefined })); }}
                                errors={errors} required={{ area: f.workMode !== "REMOTE", place: f.workMode === "ONSITE" || f.workMode === "HYBRID" }} />
                            {job && !job.locationCityId && job.location && <p className="text-xs text-amber-700">Previously saved as “{job.location}”. Select the precise location to update it.</p>}
                        </Section>
                        {f.workMode !== "REMOTE" && (
                            <Section title="Office / Work Address" description={f.workMode === "ONSITE" ? "Building or street is required for Work From Office." : "Optional"}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(["building", "floor", "street", "landmark"] as const).map((k) => (
                                        <Field key={k} label={{ building: "Building / Office Name", floor: "Floor / Unit", street: "Street / Road", landmark: "Landmark" }[k]} required={f.workMode === "ONSITE" && (k === "building")}
                                            error={k === "building" ? errors.officeAddress : undefined}>
                                            <input maxLength={k === "street" ? 160 : 120} value={f.officeAddress[k]} onChange={(e) => { set("officeAddress", { ...f.officeAddress, [k]: e.target.value }); setErrors((x) => ({ ...x, officeAddress: undefined })); }}
                                                placeholder={{ building: "e.g. Tech Park Tower B", floor: "e.g. 5th Floor, Unit 502", street: "e.g. Hinjawadi Phase 1 Road", landmark: "e.g. Near Wipro Circle" }[k]} className={inputCls(k === "building" ? errors.officeAddress : null)} />
                                        </Field>
                                    ))}
                                </div>
                                {(f.officeAddress.building || f.officeAddress.street || f.locationLocality) && (
                                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100 text-sm text-neutral-700">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Address preview</p>
                                        {[f.officeAddress.building, f.officeAddress.floor].filter(Boolean).join(", ") && <p>{[f.officeAddress.building, f.officeAddress.floor].filter(Boolean).join(", ")}</p>}
                                        {f.officeAddress.street && <p>{f.officeAddress.street}</p>}
                                        {f.officeAddress.landmark && <p>{f.officeAddress.landmark}</p>}
                                        <p>{locationSummary(loc)}</p>
                                    </div>
                                )}
                            </Section>
                        )}
                        {f.workMode === "REMOTE" && (
                            <Field label="Employee location preference" hint="e.g. Anywhere in India, or within IST working hours">
                                <input maxLength={120} {...bind("remoteLocationPreference")} className={inputCls()} />
                            </Field>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Toggle checked={f.relocationRequired} onChange={(v) => set("relocationRequired", v)} label="Relocation required" hint="The candidate must move to the job location" />
                            <Toggle checked={f.travelRequired} onChange={(v) => set("travelRequired", v)} label="Travel required" hint="The role involves travel" />
                        </div>
                        {locationSummary(loc) && <p className="text-sm text-neutral-700 flex items-center gap-1.5"><b>Location:</b> {locationSummary(loc)}</p>}
                    </>
                )}

                {step === 3 && (
                    <Section title="Hiring & Assignment" description={isManager ? undefined : "Your team lead assigns recruiters when approving the requisition."}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Assigned Recruiter" required={isManager} error={errors.primaryRecruiterId}>
                                <Combobox value={f.primaryRecruiterId} options={recruiterOpts} disabled={!isManager} placeholder={isManager ? "Search recruiter" : "Assigned by your team lead"} error={errors.primaryRecruiterId}
                                    onChange={(v) => { set("primaryRecruiterId", v); set("assignedTas", f.assignedTas.filter((x) => x !== v)); }} />
                            </Field>
                            <Field label="Secondary Recruiters">
                                <TagInput value={f.assignedTas} disabled={!isManager} onChange={(v) => set("assignedTas", v.filter((x) => x !== f.primaryRecruiterId))} allowCustom={false}
                                    suggestions={recruiterOpts.filter((r) => r.value !== f.primaryRecruiterId)} labelOf={(id) => o?.recruiters.find((r) => r.id === id)?.name ?? id} placeholder={isManager ? "Add recruiters" : "—"} />
                            </Field>
                            <Field label="Hiring Manager" hint="The person at the client who decides on the hire">
                                <Combobox value={f.hiringManagerName} allowCustom placeholder="Search or type a name"
                                    options={[...contactOpts, ...(o?.hiringManagers ?? []).filter((n) => !contactOpts.some((c) => c.value === n)).map((n) => ({ value: n, label: n }))]}
                                    onChange={(v) => set("hiringManagerName", v)} />
                            </Field>
                            <Field label="Account Manager" error={errors.accountManagerId}>
                                <Combobox value={f.accountManagerId} options={[{ value: "", label: "None" }, ...(o?.managers ?? []).map((m) => ({ value: m.id, label: m.name, hint: m.role === "SUPER_ADMIN" ? "Admin" : "Team lead" }))]} placeholder="Search" onChange={(v) => set("accountManagerId", v)} />
                            </Field>
                            <Field label="Recruiter Team">
                                <Combobox value={f.recruiterTeam} options={strOpts(o?.recruiterTeams ?? [])} allowCustom placeholder="Search or add team" onChange={(v) => set("recruiterTeam", v)} />
                            </Field>
                            <Field label="Hiring Reason" required error={errors.hiringReason}>
                                <select {...bind("hiringReason")} className={inputCls(errors.hiringReason)}><option value="">Select reason</option>{HIRING_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                            </Field>
                            <Field label="Target Closure Date" required error={errors.targetCloseDate}><input type="date" min={todayIst()} {...bind("targetCloseDate")} className={inputCls(errors.targetCloseDate)} /></Field>
                            <Field label="Expected Joining Date" error={errors.targetJoiningDate}><input type="date" min={f.targetCloseDate || todayIst()} {...bind("targetJoiningDate")} className={inputCls(errors.targetJoiningDate)} /></Field>
                            <Field label="Interview Process" hint="Add, rename, reorder or remove rounds" className="sm:col-span-2">
                                <RoundsEditor value={f.interviewRounds} onChange={(v) => set("interviewRounds", v)} presets={DEFAULT_INTERVIEW_ROUNDS} />
                            </Field>
                            {isManager && (
                                <Field label="Internal Notes" hint="Visible to team leads only" className="sm:col-span-2">
                                    <textarea maxLength={3000} {...bind("internalNotes")} className={textareaCls()} />
                                </Field>
                            )}
                        </div>
                    </Section>
                )}

                {step === 4 && (
                    <Section title="Client & Commercial Details" description={client ? `Contacts come from ${client.name}'s record — choose one or type a new contact.` : "Select a client in Basic Information to see its contacts."}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Client Contact Person" className="sm:col-span-2">
                                <Combobox value={f.clientContactName} allowCustom options={contactOpts} placeholder={client ? "Search client contacts" : "Select a client first"} disabled={!client}
                                    onChange={(v, opt) => {
                                        const c = opt ? client?.contacts.find((x) => x.name === v) : undefined;
                                        setF((p) => ({ ...p, clientContactName: v, ...(c ? { clientContactEmail: c.email || p.clientContactEmail, clientContactPhone: c.phone || p.clientContactPhone } : {}) }));
                                        setDirty(true);
                                    }} />
                            </Field>
                            <Field label="Client HR Email" error={errors.clientContactEmail}><input type="email" maxLength={160} {...bind("clientContactEmail")} placeholder="hr@client.com" className={inputCls(errors.clientContactEmail)} /></Field>
                            <Field label="Client HR Phone" error={errors.clientContactPhone}><input type="tel" maxLength={20} {...bind("clientContactPhone")} placeholder="+91 98765 43210" className={inputCls(errors.clientContactPhone)} /></Field>
                            <Field label="Billing Type"><select {...bind("billingType")} className={inputCls()}><option value="">Not set</option>{BILLING_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                            <Field label="Placement Fee (%)" error={errors.placementFeePct} hint={client?.defaults.placementFeePct != null ? `Client's standard fee: ${client.defaults.placementFeePct}%` : undefined}>
                                <input type="number" min={0} max={100} step={0.01} {...bind("placementFeePct")} className={inputCls(errors.placementFeePct)} />
                            </Field>
                            <Field label="Contract Type"><select {...bind("contractType")} className={inputCls()}><option value="">Not set</option>{CONTRACT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                            <Field label="Replacement Guarantee (days)" error={errors.replacementGuaranteeDays}><input type="number" min={0} max={365} step={1} {...bind("replacementGuaranteeDays")} className={inputCls(errors.replacementGuaranteeDays)} /></Field>
                            <Field label="Commercial Notes" className="sm:col-span-2"><textarea maxLength={2000} {...bind("commercialNotes")} className={textareaCls()} /></Field>
                        </div>
                    </Section>
                )}

                {step === 5 && <Review f={f} o={o} clientName={client?.name ?? ""} jump={(i) => setStep(i)} errors={errors} />}
            </div>

            {/* Sticky actions */}
            <div className="sticky bottom-3 z-20 mt-5 rounded-2xl bg-white/95 backdrop-blur border border-neutral-200 shadow-[0_8px_24px_rgba(16,24,40,0.08)]">
                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={cancel} className="h-10 px-4 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100">Cancel</button>
                        {isDraft && (
                            <button type="button" disabled={!!saving} onClick={() => save("draft")} className="h-10 px-4 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 flex items-center gap-1.5">
                                {saving === "draft" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save as Draft
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {step > 0 && <button type="button" onClick={() => go(step - 1)} className="h-10 px-4 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5"><ArrowLeft size={14} /> Previous</button>}
                        {step < STEPS.length - 1 ? (
                            <button type="button" onClick={() => go(step + 1)} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm shadow-primary/20 hover:bg-primary-dark flex items-center gap-1.5">Next <ArrowRight size={14} /></button>
                        ) : (
                            <button type="button" disabled={!!saving} onClick={() => save(editing && !isDraft ? "save" : "submit")} className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm shadow-primary/20 hover:bg-primary-dark disabled:opacity-50 flex items-center gap-1.5">
                                {saving && saving !== "draft" ? <Loader2 size={14} className="animate-spin" /> : editing && !isDraft ? <Save size={14} /> : <Send size={14} />} {submitLabel}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {duplicate && (
                <ModalShell title="Possible duplicate requisition" onClose={() => setDuplicate(null)}>
                    <div className="space-y-4 text-sm">
                        <p className="flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <span><Link href={`/ta/requisitions/${duplicate.id}`} target="_blank" className="font-bold underline">{duplicate.requisitionCode ?? duplicate.id} · {duplicate.title}</Link> is already {requisitionStatusLabel(duplicate.status).toLowerCase()} for this client and location ({duplicate.filled}/{duplicate.openings} filled). Consider increasing its openings instead.</span>
                        </p>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setDuplicate(null)} className="h-10 px-4 rounded-xl border border-neutral-200 font-semibold text-neutral-700">Go back</button>
                            <button type="button" onClick={() => { const d = duplicate; setDuplicate(null); save(d.intent, true); }} className="h-10 px-4 rounded-xl bg-amber-600 text-white font-semibold">Continue anyway</button>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}

// ─── Review step ──────────────────────────────────────────────
function Review({ f, o, clientName, jump, errors }: { f: F; o?: Options; clientName: string; jump: (i: number) => void; errors: Errors }) {
    const userName = (id: string) => o?.recruiters.find((r) => r.id === id)?.name ?? o?.managers.find((m) => m.id === id)?.name ?? "";
    const salary = f.salaryAmountMin || f.salaryAmountMax ? `${f.salaryAmountMin || "—"} – ${f.salaryAmountMax || "—"} ${salaryUnit(f.salaryType)}${f.salaryType !== "ANNUAL_CTC" ? ` (≈ ${toLpa(Number(f.salaryAmountMin) || 0, f.salaryType)}–${toLpa(Number(f.salaryAmountMax) || 0, f.salaryType)} LPA)` : ""}` : "";
    const address = [f.officeAddress.building, f.officeAddress.floor, f.officeAddress.street, f.officeAddress.landmark].filter(Boolean).join(", ");
    const blocks: { title: string; step: number; rows: [string, React.ReactNode][] }[] = [
        { title: "Basic Information", step: 0, rows: [
            ["Job title", f.title], ["Client", clientName], ["Client requisition ID", f.clientRequisitionId], ["Department", f.department], ["Job category", optLabel(JOB_CATEGORIES, f.jobCategory)],
            ["Employment type", optLabel(EMPLOYMENT_TYPES, f.employmentType)], ["Requisition type", optLabel(REQUISITION_TYPES, f.requisitionType)], ["Replacement for", f.replacementFor],
            ["Openings", f.openings], ["Priority", optLabel(PRIORITIES, f.priority)],
        ] },
        { title: "Job Requirements", step: 1, rows: [
            ["Primary skills", f.skills.join(", ")], ["Secondary skills", f.preferredSkills.join(", ")], ["Minimum qualification", f.minimumQualification], ["Preferred qualification", f.preferredQualification],
            ["Certifications", f.certifications.join(", ")], ["Job description", f.descriptionHtml ? <RichText html={f.descriptionHtml} /> : ""], ["Key responsibilities", f.responsibilitiesHtml ? <RichText html={f.responsibilitiesHtml} /> : ""],
            ["Additional requirements", f.additionalRequirements],
        ] },
        { title: "Experience & Compensation", step: 1, rows: [
            ["Experience", f.experienceMinYears || f.experienceMaxYears ? `${f.experienceMinYears || 0} – ${f.experienceMaxYears || "—"} years` : ""], ["Salary", salary],
            ["Salary type", optLabel(SALARY_TYPES, f.salaryType)], ["Notice period", f.noticePeriodPreference], ["Joining timeline", f.joiningPreference],
        ] },
        { title: "Location Details", step: 2, rows: [
            ["Work mode", optLabel(WORK_MODES, f.workMode)], ["Location", locationSummary(f)], ["Office address", address], ["Remote preference", f.workMode === "REMOTE" ? f.remoteLocationPreference : ""],
            ["Relocation required", f.relocationRequired ? "Yes" : "No"], ["Travel required", f.travelRequired ? "Yes" : "No"],
        ] },
        { title: "Hiring & Assignment", step: 3, rows: [
            ["Assigned recruiter", userName(f.primaryRecruiterId) || (o?.isManager ? "" : "Assigned on approval")], ["Secondary recruiters", f.assignedTas.map(userName).filter(Boolean).join(", ")],
            ["Hiring manager", f.hiringManagerName], ["Account manager", userName(f.accountManagerId)], ["Recruiter team", f.recruiterTeam], ["Hiring reason", optLabel(HIRING_REASONS, f.hiringReason)],
            ["Target closure date", f.targetCloseDate], ["Expected joining date", f.targetJoiningDate],
            ["Interview process", f.interviewRounds.length ? <ol className="list-decimal pl-4">{f.interviewRounds.map((r, i) => <li key={i}>{r}</li>)}</ol> : ""],
            ...(o?.isManager ? [["Internal notes", f.internalNotes] as [string, React.ReactNode]] : []),
        ] },
        { title: "Commercial Details", step: 4, rows: [
            ["Client contact", f.clientContactName], ["Client HR email", f.clientContactEmail], ["Client HR phone", f.clientContactPhone], ["Billing type", optLabel(BILLING_TYPES, f.billingType)],
            ["Placement fee", f.placementFeePct ? `${f.placementFeePct}%` : ""], ["Contract type", optLabel(CONTRACT_TYPES, f.contractType)],
            ["Replacement guarantee", f.replacementGuaranteeDays ? `${f.replacementGuaranteeDays} days` : ""], ["Commercial notes", f.commercialNotes],
        ] },
    ];
    const errCount = Object.values(errors).filter(Boolean).length;
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-[15px] font-bold text-neutral-900 flex items-center gap-2"><FileText size={16} className="text-primary" /> Review & Submit</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Check everything before submitting. Use Edit to change a section.</p>
                {errCount > 0 && <p className="mt-2 text-xs font-semibold text-red-600">{errCount} field(s) need attention — see the highlighted steps.</p>}
            </div>
            {blocks.map((b) => (
                <div key={b.title} className="rounded-xl border border-neutral-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50/80 border-b border-neutral-100">
                        <p className="text-sm font-bold text-neutral-800">{b.title}</p>
                        <button type="button" onClick={() => jump(b.step)} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"><Pencil size={12} /> Edit</button>
                    </div>
                    <dl className="divide-y divide-neutral-100">
                        {b.rows.filter(([, v]) => v !== "" && v != null).map(([k, v]) => (
                            <div key={k} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 px-4 py-2.5 text-sm">
                                <dt className="text-neutral-500">{k}</dt>
                                <dd className="text-neutral-800 min-w-0 break-words">{v}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            ))}
        </div>
    );
}
