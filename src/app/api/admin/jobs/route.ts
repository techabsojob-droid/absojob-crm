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

    const dbJobs = await getJobsFromDb(me.orgId);

    let list = dbJobs.map((j) => ({
        ...j,
        clientName: clients.find((c) => c.id === j.clientId)?.companyName ?? "—",
        requestedByName: users.find((u) => u.id === j.requestedById)?.name ?? null,
        approvedByName: users.find((u) => u.id === j.approvedById)?.name ?? null,
        assignedTaDetails: (j.assignedTas || []).map((id) => ({ id, name: users.find((u) => u.id === id)?.name ?? id })),
        inPipeline: applications.filter((a) => a.jobId === j.id && !["JOINED", "REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)).length,
        joinedCount: applications.filter((a) => a.jobId === j.id && a.stage === "JOINED").length,
        daysOpen: Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000),
    }));

    if (status) list = list.filter((j) => j.status === status);

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
    const job: JobRequisition = {
        id: nextIds.job(),
        orgId: me.orgId,
        clientId: body.clientId,
        title: body.title,
        department: body.department ?? "General",
        location: body.location ?? "",
        employmentType: body.employmentType ?? "FULL_TIME",
        priority: body.priority ?? "MEDIUM",
        openings: Number(body.openings) || 1,
        filled: 0,
        salaryMinLpa: Number(body.salaryMinLpa) || 0,
        salaryMaxLpa: Number(body.salaryMaxLpa) || 0,
        experienceMinYears: Number(body.experienceMinYears) || 0,
        experienceMaxYears: Number(body.experienceMaxYears) || 0,
        skills: Array.isArray(body.skills) ? body.skills : String(body.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        description: body.description ?? "",
        status: isElevated ? "APPROVED" : "PENDING_APPROVAL",
        requestedById: me.id,
        approvedById: isElevated ? me.id : null,
        assignedTas: Array.isArray(body.assignedTas) ? body.assignedTas : [],
        targetCloseDate: body.targetCloseDate ?? null,
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
