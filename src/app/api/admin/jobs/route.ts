import { NextResponse } from "next/server";
import { createRequisition } from "@/lib/requisition-server";
import { requireRole } from "@/lib/mock/server";
import { clients, users, applications, nextIds } from "@/lib/mock/data";
import { getJobsFromDb, createJobInDb, updateJobInDb, deleteJobFromDb, logAudit } from "@/lib/supabase/db";
import { creditStatusOf } from "@/lib/mock/finance";
import { createApproval, isRecruitmentManager, notifyJobAssignment, resolveApprovalsFor, validRecruiters } from "@/lib/mock/pipeline";
import { nextRequisitionCode } from "@/lib/fit";
import type { JobRequisition, JobLevel, ShiftTiming } from "@/lib/types";

const CLOSED_STATUSES = ["FULFILLED", "CLOSED", "CANCELLED"];
const JOB_LEVELS: JobLevel[] = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER", "DIRECTOR"];
const SHIFTS: ShiftTiming[] = ["DAY", "NIGHT", "ROTATIONAL", "FLEXIBLE"];
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const list = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((s) => String(s).trim()).filter(Boolean);

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const clientId = url.searchParams.get("clientId");
    const recruiterId = url.searchParams.get("recruiterId");
    const q = url.searchParams.get("q")?.toLowerCase();
    const slaRisk = url.searchParams.get("slaRisk"); // "NEAR", "OVER", "ALL"

    const dbJobs = await getJobsFromDb(me.orgId);
    // Recruiters see requisitions assigned to them (or that they requested); managers see all
    const scoped = (isRecruitmentManager(me)
        ? dbJobs
        : dbJobs.filter((j) => j.primaryRecruiterId === me.id || (j.assignedTas || []).includes(me.id) || j.requestedById === me.id))
        // A draft is private to its author until it is submitted
        .filter((j) => j.status !== "DRAFT" || j.requestedById === me.id);

    const manager = isRecruitmentManager(me);
    let rows = scoped.map((j) => {
        const client = clients.find((c) => c.id === j.clientId);
        const reqUser = users.find((u) => u.id === j.requestedById);
        const appUser = users.find((u) => u.id === j.approvedById);
        const primaryRec = users.find((u) => u.id === j.primaryRecruiterId);
        const taMgr = users.find((u) => u.id === j.taManagerId);
        const daysOpen = Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000);

        const jobApps = applications.filter((a) => a.jobId === j.id);
        const inPipeline = jobApps.filter((a) => !["JOINED", "REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "BLACKLISTED"].includes(a.stage)).length;
        const joinedCount = jobApps.filter((a) => a.stage === "JOINED").length;
        const interviewCount = jobApps.filter((a) => ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"].includes(a.stage)).length;
        const offerCount = jobApps.filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING"].includes(a.stage)).length;

        const effectiveSlaDays = j.slaDays || 30;
        const daysRemaining = effectiveSlaDays - daysOpen;
        let calculatedSlaStatus = j.sla?.status || "ON_TRACK";
        if (j.status === "FULFILLED") {
            calculatedSlaStatus = "COMPLETED";
        } else if (daysRemaining < 0) {
            calculatedSlaStatus = "OVERDUE";
        } else if (daysRemaining <= 5) {
            calculatedSlaStatus = "AT_RISK";
        } else {
            calculatedSlaStatus = "ON_TRACK";
        }

        // Filled = candidates who actually joined (rejected / withdrawn never count)
        const filledOpenings = Math.min(j.openings || 0, Math.max(j.filled || 0, joinedCount));
        const remainingOpenings = Math.max(0, (j.openings || 1) - filledOpenings);

        return {
            ...j,
            internalNotes: manager ? j.internalNotes ?? null : undefined,
            listed: j.published !== false,
            clientName: client?.companyName ?? "—",
            clientIndustry: client?.industry ?? "",
            requestedByName: reqUser?.name ?? null,
            approvedByName: appUser?.name ?? null,
            primaryRecruiterName: primaryRec?.name ?? (j.assignedTas?.[0] ? users.find((u) => u.id === j.assignedTas[0])?.name : null),
            taManagerName: taMgr?.name ?? null,
            assignedTaDetails: (j.assignedTas || []).map((id) => ({ id, name: users.find((u) => u.id === id)?.name ?? id })),
            filled: filledOpenings,
            filledOpenings,
            canEdit: !["CLOSED", "CANCELLED", "FULFILLED"].includes(j.status) && (manager || (j.requestedById === me.id && ["DRAFT", "PENDING_APPROVAL"].includes(j.status))),
            inPipeline,
            joinedCount,
            interviewCount,
            offerCount,
            totalCandidates: jobApps.length,
            remainingOpenings,
            daysOpen,
            slaDays: effectiveSlaDays,
            daysRemaining,
            calculatedSlaStatus,
        };
    });

    if (status && status !== "ALL") rows = rows.filter((j) => j.status === status);
    if (priority && priority !== "ALL") rows = rows.filter((j) => j.priority === priority);
    if (clientId && clientId !== "ALL") rows = rows.filter((j) => j.clientId === clientId);
    if (recruiterId && recruiterId !== "ALL") {
        rows = rows.filter((j) => j.assignedTas?.includes(recruiterId) || j.primaryRecruiterId === recruiterId);
    }
    if (slaRisk === "NEAR") {
        rows = rows.filter((j) => j.calculatedSlaStatus === "AT_RISK");
    } else if (slaRisk === "OVER") {
        rows = rows.filter((j) => j.calculatedSlaStatus === "OVERDUE");
    }

    if (q) {
        rows = rows.filter((j) =>
            j.title.toLowerCase().includes(q) ||
            j.id.toLowerCase().includes(q) ||
            j.clientName.toLowerCase().includes(q) ||
            (j.department && j.department.toLowerCase().includes(q)) ||
            (j.location && j.location.toLowerCase().includes(q)) ||
            (j.requisitionCode && j.requisitionCode.toLowerCase().includes(q)) ||
            (j.skills && j.skills.some((s) => s.toLowerCase().includes(q)))
        );
    }

    return NextResponse.json(rows);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER", "AGENT");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    // The requisition wizard (draft / submit) has its own full validation and workflow
    if (body.intent === "draft" || body.intent === "submit") {
        if (me.role === "AGENT") return NextResponse.json({ error: "Partners raise requisitions through referrals" }, { status: 403 });
        return createRequisition(me, body);
    }
    if (!body.clientId || !body.title) {
        return NextResponse.json({ error: "clientId and title are required" }, { status: 400 });
    }

    const isElevated = ["SUPER_ADMIN", "TA_MANAGER"].includes(me.role);
    const numOpenings = Math.max(1, Math.floor(Number(body.openings) || 1));
    if (!clients.some((c) => c.id === body.clientId && c.orgId === me.orgId)) {
        return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
    const credit = creditStatusOf(me.orgId, body.clientId);
    if (credit.onHold && me.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: `Client is on credit hold (${credit.reasons.join("; ")}). Finance must clear it before new requisitions.` }, { status: 423 });
    }
    const requestedTeam: string[] = Array.isArray(body.assignedTas) ? body.assignedTas : [];
    const teamIds = Array.from(new Set([...requestedTeam, ...(body.primaryRecruiterId ? [body.primaryRecruiterId] : [])]));
    if (teamIds.length && !isElevated) {
        return NextResponse.json({ error: "Only Super Admin or TA Manager can assign recruiters" }, { status: 403 });
    }
    const { invalid } = validRecruiters(me.orgId, teamIds);
    if (invalid.length) return NextResponse.json({ error: `Recruiter(s) not found: ${invalid.join(", ")}` }, { status: 400 });
    // Non-managers can only raise a request; status is always decided by approval
    if (!isElevated) delete body.status;
    else if (body.status && !["APPROVED", "SOURCING", "ON_HOLD", "DRAFT"].includes(body.status)) {
        return NextResponse.json({ error: "A new requisition can only start as Open, On Hold or Draft" }, { status: 400 });
    }
    const minExp = Number(body.experienceMinYears) || 0, maxExp = Number(body.experienceMaxYears) || 0;
    const minCtc = Number(body.salaryMinLpa) || 0, maxCtc = Number(body.salaryMaxLpa) || 0;
    if (maxExp && minExp > maxExp) return NextResponse.json({ error: "Min experience cannot be more than max experience" }, { status: 400 });
    if (maxCtc && minCtc > maxCtc) return NextResponse.json({ error: "Min CTC cannot be more than max CTC" }, { status: 400 });
    if (body.vacancyType === "REPLACEMENT" && !String(body.replacementFor ?? "").trim()) {
        return NextResponse.json({ error: "Name the employee being replaced" }, { status: 400 });
    }

    // Same client + title + location still open → probably a duplicate requirement
    const orgJobs = await getJobsFromDb(me.orgId);
    const duplicate = orgJobs.find((j) =>
        j.clientId === body.clientId && norm(j.title) === norm(body.title) && norm(j.location) === norm(body.location) && !CLOSED_STATUSES.includes(j.status));
    if (duplicate && !body.allowDuplicate) {
        return NextResponse.json({
            error: `Possible duplicate: ${duplicate.requisitionCode ?? duplicate.id} "${duplicate.title}" for this client and location is still ${duplicate.status.replace(/_/g, " ").toLowerCase()}.`,
            duplicate: { id: duplicate.id, requisitionCode: duplicate.requisitionCode ?? null, title: duplicate.title, status: duplicate.status, openings: duplicate.openings, filled: duplicate.filled },
        }, { status: 409 });
    }
    const initialOpenings = Array.from({ length: numOpenings }).map((_, i) => ({
        id: `opn-${Date.now()}-${i + 1}`,
        openingNumber: i + 1,
        status: "OPEN" as const,
        notes: "Initialized with requisition"
    }));

    const job: JobRequisition = {
        id: nextIds.job(),
        requisitionCode: nextRequisitionCode(orgJobs, me.orgId),
        orgId: me.orgId,
        clientId: body.clientId,
        title: body.title,
        department: body.department ?? "General",
        location: body.location ?? "",
        workMode: body.workMode ?? "HYBRID",
        city: body.city ?? "",
        country: body.country ?? "India",
        employmentType: body.employmentType ?? "FULL_TIME",
        jobLevel: JOB_LEVELS.includes(body.jobLevel) ? body.jobLevel : undefined,
        vacancyType: body.vacancyType === "REPLACEMENT" ? "REPLACEMENT" : "NEW_HIRING",
        replacementFor: body.vacancyType === "REPLACEMENT" ? String(body.replacementFor).trim() : null,
        shiftTiming: SHIFTS.includes(body.shiftTiming) ? body.shiftTiming : "DAY",
        joiningPreference: body.joiningPreference ?? "",
        hiringManagerName: String(body.hiringManagerName ?? "").trim() || null,
        interviewRounds: list(body.interviewRounds),
        internalNotes: isElevated ? String(body.internalNotes ?? "").trim() || null : null,
        // Team lead publishes it to the job listing once sourcing should open up
        published: false,
        publishedAt: null,
        publishedById: null,
        priority: body.priority ?? "MEDIUM",
        priorityReason: body.priorityReason ?? "",
        openings: numOpenings,
        filled: 0,
        salaryMinLpa: minCtc,
        salaryMaxLpa: maxCtc,
        salaryCurrency: body.salaryCurrency ?? "INR",
        fixedSalaryLpa: body.fixedSalaryLpa ? Number(body.fixedSalaryLpa) : undefined,
        variableSalaryLpa: body.variableSalaryLpa ? Number(body.variableSalaryLpa) : undefined,
        bonusDetails: body.bonusDetails ?? "",
        benefits: body.benefits ?? "",
        experienceMinYears: minExp,
        experienceMaxYears: maxExp,
        skills: list(body.skills),
        preferredSkills: Array.isArray(body.preferredSkills) ? body.preferredSkills : String(body.preferredSkills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        education: body.education ?? "",
        certifications: Array.isArray(body.certifications) ? body.certifications : String(body.certifications ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        noticePeriodPreference: body.noticePeriodPreference ?? "",
        description: body.description ?? "",
        aboutCompany: body.aboutCompany ?? "",
        responsibilities: body.responsibilities ?? "",
        status: body.status || (isElevated ? "APPROVED" : "PENDING_APPROVAL"),
        requestedById: me.id,
        approvedById: isElevated ? me.id : null,
        // Requester is on the team of their own request so they can see it
        assignedTas: isElevated ? teamIds : [me.id],
        primaryRecruiterId: body.primaryRecruiterId ?? null,
        taManagerId: body.taManagerId ?? null,
        accountManagerId: body.accountManagerId ?? null,
        targetCloseDate: body.targetCloseDate ?? null,
        targetJoiningDate: body.targetJoiningDate ?? null,
        slaDays: Number(body.slaDays) || 30,
        sla: {
            slaDays: Number(body.slaDays) || 30,
            slaStartDate: new Date().toISOString(),
            status: "ON_TRACK"
        },
        tags: Array.isArray(body.tags) ? body.tags : String(body.tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        openingsList: initialOpenings,
        requirementVersions: [
            {
                version: 1,
                openings: numOpenings,
                salaryMinLpa: Number(body.salaryMinLpa) || 0,
                salaryMaxLpa: Number(body.salaryMaxLpa) || 0,
                experienceMinYears: Number(body.experienceMinYears) || 0,
                experienceMaxYears: Number(body.experienceMaxYears) || 0,
                skills: Array.isArray(body.skills) ? body.skills : String(body.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
                location: body.location ?? "",
                workMode: body.workMode ?? "HYBRID",
                changedById: me.id,
                changedByName: me.name,
                changedAt: new Date().toISOString(),
                changeSummary: "Initial requisition created"
            }
        ],
        assignmentHistory: body.primaryRecruiterId ? [
            {
                id: `asg-${Date.now()}`,
                recruiterId: body.primaryRecruiterId,
                recruiterName: users.find((u) => u.id === body.primaryRecruiterId)?.name ?? body.primaryRecruiterId,
                role: "PRIMARY_RECRUITER",
                assignedById: me.id,
                assignedByName: me.name,
                assignedAt: new Date().toISOString(),
                active: true
            }
        ] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const saved = await createJobInDb(job);

    if (saved.status === "PENDING_APPROVAL") {
        createApproval({
            orgId: me.orgId,
            requester: me,
            type: "JOB_REQUISITION",
            title: `New requisition: ${saved.title}`,
            priority: saved.priority,
            relatedRecordType: "JOB",
            relatedRecordId: saved.id,
            relatedRecordName: saved.title,
            description: `${saved.openings} opening(s) · ${saved.location || "location TBD"} · ₹${saved.salaryMinLpa}-${saved.salaryMaxLpa} LPA`,
            requestedById: me.id,
        }, ["TA_MANAGER", "SUPER_ADMIN"]);
    } else {
        notifyJobAssignment(saved, [], me);
    }

    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: isElevated ? "JOB_CREATED" : "JOB_REQUESTED",
        entity: "JobRequisition",
        entityId: saved.id,
        detail: `${saved.requisitionCode} ${saved.title} (${saved.openings} opening(s))${duplicate ? ` — created despite possible duplicate ${duplicate.requisitionCode ?? duplicate.id}` : ""}`,
    });

    return NextResponse.json(saved, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { id, action, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    delete updates.filled;
    delete updates.requirementVersions;
    delete updates.assignmentHistory;

    if (action === "approve") {
        updates.status = "APPROVED";
        updates.approvedById = me.id;
    }
    const before = (await getJobsFromDb(me.orgId)).find((j) => j.id === id);
    if (!before) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const newTeam = [...(updates.assignedTas || []), ...(updates.primaryRecruiterId ? [updates.primaryRecruiterId] : [])];
    const { invalid } = validRecruiters(me.orgId, newTeam);
    if (invalid.length) return NextResponse.json({ error: `Recruiter(s) not found: ${invalid.join(", ")}` }, { status: 400 });
    const prevTeam = [...(before.assignedTas || []), ...(before.primaryRecruiterId ? [before.primaryRecruiterId] : [])];

    if (updates.skills && typeof updates.skills === "string") {
        updates.skills = updates.skills.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    const success = await updateJobInDb(id, me.orgId, updates);
    if (!success) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const after = (await getJobsFromDb(me.orgId)).find((j) => j.id === id);
    if (after) {
        if (updates.status === "APPROVED") resolveApprovalsFor(id, "APPROVED", me);
        if (updates.status === "CANCELLED") resolveApprovalsFor(id, "REJECTED", me, updates.cancelReason);
        notifyJobAssignment(after, prevTeam, me);
    }

    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: action === "approve" ? "JOB_APPROVED" : "JOB_UPDATED",
        entity: "JobRequisition",
        entityId: id,
        detail: `Updated requisition ${id}`,
    });

    return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Job ID is required" }, { status: 400 });

    const linkedApps = applications.filter((a) => a.jobId === id && a.orgId === me.orgId).length;
    if (linkedApps > 0) {
        return NextResponse.json(
            { error: `This requisition has ${linkedApps} candidate application(s). Close or cancel it instead of deleting.` },
            { status: 409 }
        );
    }

    const success = await deleteJobFromDb(id, me.orgId);
    if (!success) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "JOB_DELETED",
        entity: "JobRequisition",
        entityId: id,
        detail: `Deleted requisition ${id}`,
    });

    return NextResponse.json({ success: true });
}
