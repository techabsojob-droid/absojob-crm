import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { clients, users, applications, nextIds } from "@/lib/mock/data";
import { getJobsFromDb, createJobInDb, updateJobInDb, deleteJobFromDb, logAudit } from "@/lib/supabase/db";
import type { JobRequisition, JobStatus } from "@/lib/types";

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

    let list = dbJobs.map((j) => {
        const client = clients.find((c) => c.id === j.clientId);
        const reqUser = users.find((u) => u.id === j.requestedById);
        const appUser = users.find((u) => u.id === j.approvedById);
        const primaryRec = users.find((u) => u.id === j.primaryRecruiterId);
        const taMgr = users.find((u) => u.id === j.taManagerId);
        const daysOpen = Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000);

        const jobApps = applications.filter((a) => a.jobId === j.id);
        const inPipeline = jobApps.filter((a) => !["JOINED", "REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)).length;
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

        const remainingOpenings = Math.max(0, (j.openings || 1) - (j.filled || 0));

        return {
            ...j,
            clientName: client?.companyName ?? "—",
            clientIndustry: client?.industry ?? "",
            requestedByName: reqUser?.name ?? null,
            approvedByName: appUser?.name ?? null,
            primaryRecruiterName: primaryRec?.name ?? (j.assignedTas?.[0] ? users.find((u) => u.id === j.assignedTas[0])?.name : null),
            taManagerName: taMgr?.name ?? null,
            assignedTaDetails: (j.assignedTas || []).map((id) => ({ id, name: users.find((u) => u.id === id)?.name ?? id })),
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

    if (status && status !== "ALL") list = list.filter((j) => j.status === status);
    if (priority && priority !== "ALL") list = list.filter((j) => j.priority === priority);
    if (clientId && clientId !== "ALL") list = list.filter((j) => j.clientId === clientId);
    if (recruiterId && recruiterId !== "ALL") {
        list = list.filter((j) => j.assignedTas?.includes(recruiterId) || j.primaryRecruiterId === recruiterId);
    }
    if (slaRisk === "NEAR") {
        list = list.filter((j) => j.calculatedSlaStatus === "AT_RISK");
    } else if (slaRisk === "OVER") {
        list = list.filter((j) => j.calculatedSlaStatus === "OVERDUE");
    }

    if (q) {
        list = list.filter((j) =>
            j.title.toLowerCase().includes(q) ||
            j.id.toLowerCase().includes(q) ||
            j.clientName.toLowerCase().includes(q) ||
            (j.department && j.department.toLowerCase().includes(q)) ||
            (j.location && j.location.toLowerCase().includes(q)) ||
            (j.skills && j.skills.some((s) => s.toLowerCase().includes(q)))
        );
    }

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER", "AGENT");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.clientId || !body.title) {
        return NextResponse.json({ error: "clientId and title are required" }, { status: 400 });
    }

    const isElevated = ["SUPER_ADMIN", "TA_MANAGER"].includes(me.role);
    const numOpenings = Number(body.openings) || 1;
    const initialOpenings = Array.from({ length: numOpenings }).map((_, i) => ({
        id: `opn-${Date.now()}-${i + 1}`,
        openingNumber: i + 1,
        status: "OPEN" as const,
        notes: "Initialized with requisition"
    }));

    const job: JobRequisition = {
        id: body.id || nextIds.job(),
        orgId: me.orgId,
        clientId: body.clientId,
        title: body.title,
        department: body.department ?? "General",
        location: body.location ?? "",
        workMode: body.workMode ?? "HYBRID",
        city: body.city ?? "",
        country: body.country ?? "India",
        employmentType: body.employmentType ?? "FULL_TIME",
        priority: body.priority ?? "MEDIUM",
        priorityReason: body.priorityReason ?? "",
        openings: numOpenings,
        filled: 0,
        salaryMinLpa: Number(body.salaryMinLpa) || 0,
        salaryMaxLpa: Number(body.salaryMaxLpa) || 0,
        salaryCurrency: body.salaryCurrency ?? "INR",
        fixedSalaryLpa: body.fixedSalaryLpa ? Number(body.fixedSalaryLpa) : undefined,
        variableSalaryLpa: body.variableSalaryLpa ? Number(body.variableSalaryLpa) : undefined,
        bonusDetails: body.bonusDetails ?? "",
        benefits: body.benefits ?? "",
        experienceMinYears: Number(body.experienceMinYears) || 0,
        experienceMaxYears: Number(body.experienceMaxYears) || 0,
        skills: Array.isArray(body.skills) ? body.skills : String(body.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
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
        assignedTas: Array.isArray(body.assignedTas) ? body.assignedTas : (body.primaryRecruiterId ? [body.primaryRecruiterId] : []),
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

    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: isElevated ? "JOB_CREATED" : "JOB_REQUESTED",
        entity: "JobRequisition",
        entityId: saved.id,
        detail: `${saved.title} (${saved.openings} opening(s))`,
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

    if (action === "approve") {
        updates.status = "APPROVED";
        updates.approvedById = me.id;
    }

    if (updates.skills && typeof updates.skills === "string") {
        updates.skills = updates.skills.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    const success = await updateJobInDb(id, me.orgId, updates);
    if (!success) return NextResponse.json({ error: "Job not found" }, { status: 404 });

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
