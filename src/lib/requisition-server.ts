// ─── Requisition create / update from the wizard (server) ─────
import { NextResponse } from "next/server";
import type { JobAssignmentRecord, JobOpeningItem, JobRequisition, User } from "@/lib/types";
import { approvals, organizationSettingsSeed, users, nextIds } from "@/lib/mock/data";
import { createApproval, isRecruitmentManager, notifyJobAssignment } from "@/lib/mock/pipeline";
import { creditStatusOf } from "@/lib/mock/fin/receivables";
import { createJobInDb, getJobsFromDb, logAudit, updateJobInDb } from "@/lib/supabase/db";
import { nextRequisitionCode } from "@/lib/fit";
import { rememberLocality } from "@/lib/geo/india";
import { approvalModeOf, findDuplicate, parseRequisition } from "@/lib/requisition";

export type WizardIntent = "draft" | "submit" | "save";
const CLOSED = ["CLOSED", "CANCELLED", "FULFILLED"];
const DAY = 86400000;

const invalid = (fieldErrors: Record<string, string>) =>
    NextResponse.json({ error: `Please fix ${Object.keys(fieldErrors).length === 1 ? "the highlighted field" : `${Object.keys(fieldErrors).length} highlighted fields`}`, fieldErrors }, { status: 422 });

/** Does this user's submission need a team lead's approval? (configurable per org) */
export function needsApproval(me: User) {
    const mode = approvalModeOf(organizationSettingsSeed[me.orgId]);
    return mode === "ALL" || (mode === "RECRUITERS_ONLY" && !isRecruitmentManager(me));
}

const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
const slaDaysFor = (closeDate: string | null | undefined) => (closeDate ? Math.max(1, Math.ceil((+new Date(`${closeDate}T23:59:59+05:30`) - Date.now()) / DAY)) : 30);

function openApproval(job: JobRequisition, me: User) {
    createApproval({
        orgId: me.orgId, requester: me, type: "JOB_REQUISITION",
        title: `New requisition: ${job.requisitionCode} ${job.title}`, priority: job.priority,
        relatedRecordType: "JOB", relatedRecordId: job.id, relatedRecordName: job.title,
        description: `${job.openings} opening(s) · ${job.location || "location TBD"} · ₹${job.salaryMinLpa}-${job.salaryMaxLpa} LPA`,
        requestedById: me.id,
    }, ["TA_MANAGER", "SUPER_ADMIN"]);
}

function assignmentRecords(primaryId: string | null | undefined, secondary: string[], me: User, at: string): JobAssignmentRecord[] {
    const out: JobAssignmentRecord[] = [];
    if (primaryId) out.push({ id: `asg-${crypto.randomUUID().slice(0, 8)}`, recruiterId: primaryId, recruiterName: nameOf(primaryId), role: "PRIMARY_RECRUITER", assignedById: me.id, assignedByName: me.name, assignedAt: at, active: true });
    for (const id of secondary.filter((x) => x !== primaryId)) {
        out.push({ id: `asg-${crypto.randomUUID().slice(0, 8)}`, recruiterId: id, recruiterName: nameOf(id), role: "SECONDARY_RECRUITER", assignedById: me.id, assignedByName: me.name, assignedAt: at, active: true });
    }
    return out;
}

// ── Create ──
export async function createRequisition(me: User, body: Record<string, unknown>) {
    const intent: WizardIntent = body.intent === "draft" ? "draft" : "submit";
    const manager = isRecruitmentManager(me);
    const { errors, warnings, values: v, location } = parseRequisition(body, { me, manager, strict: intent !== "draft" });
    if (Object.keys(errors).length) return invalid(errors);

    const credit = creditStatusOf(me.orgId, v.clientId!);
    if (credit.onHold && me.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: `Client is on credit hold (${credit.reasons.join("; ")}). Finance must clear it before new requisitions.` }, { status: 423 });
    }
    const orgJobs = await getJobsFromDb(me.orgId);
    const duplicate = intent === "submit" ? findDuplicate(orgJobs, v) : undefined;
    if (duplicate && !body.allowDuplicate) {
        return NextResponse.json({
            error: `Possible duplicate: ${duplicate.requisitionCode ?? duplicate.id} "${duplicate.title}" for this client and location is still ${duplicate.status.replace(/_/g, " ").toLowerCase()}.`,
            duplicate: { id: duplicate.id, requisitionCode: duplicate.requisitionCode ?? null, title: duplicate.title, status: duplicate.status, openings: duplicate.openings, filled: duplicate.filled },
        }, { status: 409 });
    }

    const now = new Date().toISOString();
    const approval = intent === "submit" && needsApproval(me);
    const status = intent === "draft" ? "DRAFT" : approval ? "PENDING_APPROVAL" : "APPROVED";
    const openings = v.openings ?? 1;
    const primary = manager ? v.primaryRecruiterId ?? null : null;
    const team = manager ? v.assignedTas ?? [] : [];

    const job: JobRequisition = {
        // Defaults for fields older screens expect, then everything the wizard sent
        department: "General", location: "", employmentType: "FULL_TIME", priority: "MEDIUM", salaryMinLpa: 0, salaryMaxLpa: 0,
        experienceMinYears: 0, experienceMaxYears: 0, skills: [], description: "",
        ...v,
        id: nextIds.job(),
        // Codes are computed from the org's current list and assigned in the same synchronous step as the insert
        requisitionCode: nextRequisitionCode(orgJobs, me.orgId),
        orgId: me.orgId,
        clientId: v.clientId!,
        title: v.title!,
        openings,
        filled: 0,
        status,
        requestedById: me.id,
        approvedById: status === "APPROVED" ? me.id : null,
        approvedAt: status === "APPROVED" ? now : null,
        submittedAt: intent === "submit" ? now : null,
        primaryRecruiterId: primary,
        // The requester is on the team of their own request so they can see it
        assignedTas: manager ? team : [me.id],
        published: false, publishedAt: null, publishedById: null,
        slaDays: slaDaysFor(v.targetCloseDate),
        sla: { slaDays: slaDaysFor(v.targetCloseDate), slaStartDate: now, status: "ON_TRACK" },
        openingsList: Array.from({ length: openings }, (_, i): JobOpeningItem => ({ id: `opn-${crypto.randomUUID().slice(0, 8)}`, openingNumber: i + 1, status: "OPEN", notes: "Initialized with requisition" })),
        requirementVersions: [{
            version: 1, openings, salaryMinLpa: v.salaryMinLpa ?? 0, salaryMaxLpa: v.salaryMaxLpa ?? 0,
            experienceMinYears: v.experienceMinYears ?? 0, experienceMaxYears: v.experienceMaxYears ?? 0, skills: v.skills ?? [],
            location: v.location ?? "", workMode: v.workMode, changedById: me.id, changedByName: me.name, changedAt: now, changeSummary: "Initial requisition created",
        }],
        assignmentHistory: assignmentRecords(primary, team, me, now),
        updatedById: me.id,
        createdAt: now,
        updatedAt: now,
    };
    const saved = await createJobInDb(job);
    rememberLocality(me.orgId, me.id, location);

    if (saved.status === "PENDING_APPROVAL") openApproval(saved, me);
    else if (saved.status === "APPROVED") notifyJobAssignment(saved, [], me);

    await logAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: status === "DRAFT" ? "JOB_DRAFTED" : status === "PENDING_APPROVAL" ? "JOB_REQUESTED" : "JOB_CREATED",
        entity: "JobRequisition", entityId: saved.id,
        detail: `${saved.requisitionCode} ${saved.title} (${saved.openings} opening(s)) — ${status.replace(/_/g, " ").toLowerCase()}${duplicate ? ` despite possible duplicate ${duplicate.requisitionCode ?? duplicate.id}` : ""}`,
    });
    return NextResponse.json({ ...saved, warnings }, { status: 201 });
}

// Fields worth naming in the change history
const TRACKED: (keyof JobRequisition)[] = [
    "title", "clientId", "clientRequisitionId", "department", "jobCategory", "employmentType", "requisitionType", "replacementFor", "openings", "priority",
    "experienceMinYears", "experienceMaxYears", "salaryType", "salaryAmountMin", "salaryAmountMax", "noticePeriodPreference", "joiningPreference",
    "skills", "preferredSkills", "minimumQualification", "preferredQualification", "certifications", "description", "responsibilities", "additionalRequirements",
    "workMode", "locationStateCode", "locationDistrictId", "locationCityId", "locationLocality", "locationPincode", "officeAddress", "remoteLocationPreference",
    "relocationRequired", "travelRequired", "primaryRecruiterId", "assignedTas", "hiringManagerName", "accountManagerId", "recruiterTeam",
    "targetCloseDate", "targetJoiningDate", "interviewRounds", "hiringReason", "internalNotes",
    "clientContactName", "clientContactEmail", "clientContactPhone", "billingType", "placementFeePct", "contractType", "replacementGuaranteeDays", "commercialNotes",
];
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null) || ((a ?? "") === "" && (b ?? "") === "");

// ── Update (edit, save draft, submit a draft) ──
export async function updateRequisition(me: User, existing: JobRequisition, body: Record<string, unknown>) {
    const manager = isRecruitmentManager(me);
    const intent: WizardIntent = body.intent === "draft" ? "draft" : body.intent === "submit" ? "submit" : "save";
    const ownDraft = existing.requestedById === me.id && ["DRAFT", "PENDING_APPROVAL"].includes(existing.status);
    if (!manager && !ownDraft) return NextResponse.json({ error: "Only a team lead can edit this requisition" }, { status: 403 });
    if (CLOSED.includes(existing.status)) return NextResponse.json({ error: `This requisition is ${existing.status.toLowerCase()} and can no longer be edited` }, { status: 422 });
    if (intent === "draft" && existing.status !== "DRAFT") return NextResponse.json({ error: "Only a draft can be saved as a draft" }, { status: 422 });
    if (intent === "submit" && existing.status !== "DRAFT") return NextResponse.json({ error: "This requisition has already been submitted" }, { status: 422 });

    const { errors, warnings, values: v, location } = parseRequisition(body, { me, manager, strict: intent !== "draft", existing });
    if (Object.keys(errors).length) return invalid(errors);
    if (v.clientId !== existing.clientId) {
        const credit = creditStatusOf(me.orgId, v.clientId!);
        if (credit.onHold && me.role !== "SUPER_ADMIN") return NextResponse.json({ error: `Client is on credit hold (${credit.reasons.join("; ")})` }, { status: 423 });
    }
    if (intent !== "draft" && !body.allowDuplicate) {
        const duplicate = findDuplicate(await getJobsFromDb(me.orgId), v, existing.id);
        if (duplicate) return NextResponse.json({
            error: `Possible duplicate: ${duplicate.requisitionCode ?? duplicate.id} "${duplicate.title}" for this client and location is still ${duplicate.status.replace(/_/g, " ").toLowerCase()}.`,
            duplicate: { id: duplicate.id, requisitionCode: duplicate.requisitionCode ?? null, title: duplicate.title, status: duplicate.status, openings: duplicate.openings, filled: duplicate.filled },
        }, { status: 409 });
    }

    const now = new Date().toISOString();
    const updates: Partial<JobRequisition> = { ...v, updatedById: me.id };
    // Recruiters can't change assignment (parse already blocks new ids); keep what was there
    if (!manager) { delete updates.primaryRecruiterId; delete updates.assignedTas; delete updates.internalNotes; }
    const changed = TRACKED.filter((k) => k in updates && !same(updates[k], existing[k]));

    // Assignment history
    if (manager && (changed.includes("primaryRecruiterId") || changed.includes("assignedTas"))) {
        const before = new Set(existing.assignedTas ?? []);
        const after = new Set(updates.assignedTas ?? []);
        const history = (existing.assignmentHistory ?? []).map((h) => {
            const dropped = h.active && (h.role === "PRIMARY_RECRUITER" ? h.recruiterId !== updates.primaryRecruiterId : !after.has(h.recruiterId));
            return dropped ? { ...h, active: false, unassignedAt: now, unassignedReason: `Changed by ${me.name}` } : h;
        });
        const activePrimary = history.find((h) => h.active && h.role === "PRIMARY_RECRUITER")?.recruiterId;
        const addPrimary = updates.primaryRecruiterId && activePrimary !== updates.primaryRecruiterId ? updates.primaryRecruiterId : null;
        const addSecondary = [...after].filter((id) => id !== updates.primaryRecruiterId && !history.some((h) => h.active && h.recruiterId === id && h.role === "SECONDARY_RECRUITER"));
        updates.assignmentHistory = [...history, ...assignmentRecords(addPrimary, addSecondary, me, now)];
        // Notifies only recruiters who weren't on the team before
        if ([...after].some((id) => !before.has(id)) && !["DRAFT", "PENDING_APPROVAL"].includes(existing.status)) {
            notifyJobAssignment({ ...existing, ...updates } as JobRequisition, [...before, ...(existing.primaryRecruiterId ? [existing.primaryRecruiterId] : [])], me);
        }
    }

    // Requirement version when the spec changes
    const specKeys = ["openings", "salaryMinLpa", "salaryMaxLpa", "experienceMinYears", "experienceMaxYears", "location", "workMode", "skills"] as const;
    if (specKeys.some((k) => k in updates && !same(updates[k], existing[k]))) {
        const nextVersion = (existing.requirementVersions?.length || 1) + 1;
        updates.requirementVersions = [...(existing.requirementVersions ?? []), {
            version: nextVersion, openings: updates.openings ?? existing.openings, salaryMinLpa: updates.salaryMinLpa ?? existing.salaryMinLpa, salaryMaxLpa: updates.salaryMaxLpa ?? existing.salaryMaxLpa,
            experienceMinYears: updates.experienceMinYears ?? existing.experienceMinYears, experienceMaxYears: updates.experienceMaxYears ?? existing.experienceMaxYears,
            skills: updates.skills ?? existing.skills, location: updates.location ?? existing.location, workMode: updates.workMode ?? existing.workMode,
            changedById: me.id, changedByName: me.name, changedAt: now, changeSummary: String(body.changeSummary ?? "").trim().slice(0, 200) || `Updated ${changed.slice(0, 4).join(", ")}`,
        }];
    }
    // Keep the per-seat list in step with headcount (only unfilled seats are removed)
    if (updates.openings !== undefined && updates.openings !== existing.openings) {
        const list = [...(existing.openingsList ?? [])];
        while (list.length < updates.openings) list.push({ id: `opn-${crypto.randomUUID().slice(0, 8)}`, openingNumber: list.length + 1, status: "OPEN", notes: `Added by ${me.name}` });
        while (list.length > updates.openings) {
            const idx = list.map((o) => o.status).lastIndexOf("OPEN");
            if (idx < 0) break;
            list.splice(idx, 1);
        }
        updates.openingsList = list.map((o, i) => ({ ...o, openingNumber: i + 1 }));
    }
    if (updates.targetCloseDate !== existing.targetCloseDate) {
        updates.slaDays = slaDaysFor(updates.targetCloseDate);
        updates.sla = { ...(existing.sla ?? { slaStartDate: existing.createdAt, status: "ON_TRACK" }), slaDays: updates.slaDays };
    }

    // Workflow
    if (intent === "submit") {
        const approval = needsApproval(me);
        updates.status = approval ? "PENDING_APPROVAL" : "APPROVED";
        updates.submittedAt = now;
        updates.statusReason = undefined;
        if (!approval) { updates.approvedById = me.id; updates.approvedAt = now; }
    }

    const ok = await updateJobInDb(existing.id, me.orgId, updates);
    if (!ok) return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    rememberLocality(me.orgId, me.id, location);
    const saved = (await getJobsFromDb(me.orgId)).find((j) => j.id === existing.id)!;
    if (intent === "submit") {
        if (saved.status === "PENDING_APPROVAL") openApproval(saved, me);
        else notifyJobAssignment(saved, [], me);
    }

    await logAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: intent === "submit" ? (saved.status === "PENDING_APPROVAL" ? "JOB_SUBMITTED" : "JOB_CREATED") : intent === "draft" ? "JOB_DRAFT_SAVED" : "JOB_UPDATED",
        entity: "JobRequisition", entityId: saved.id,
        detail: changed.length ? `${saved.requisitionCode}: changed ${changed.map((k) => k.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}` : `${saved.requisitionCode}: ${intent === "submit" ? "submitted" : "saved, no field changes"}`,
    });
    return NextResponse.json({ ...saved, warnings, changed });
}

/** Approval decisions recorded for a requisition, newest first. */
export function approvalHistory(orgId: string, jobId: string) {
    return approvals
        .filter((a) => a.orgId === orgId && a.relatedRecordType === "JOB" && a.relatedRecordId === jobId)
        .map((a) => ({ id: a.id, status: a.status, title: a.title, requestedByName: a.requestedByName, date: a.date, reviewedByName: a.reviewedByName ?? null, reviewedAt: a.reviewedAt ?? null, reviewComment: a.reviewComment ?? null }))
        .sort((x, y) => +new Date(y.reviewedAt ?? y.date) - +new Date(x.reviewedAt ?? x.date));
}
