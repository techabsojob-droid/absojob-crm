import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { getJobsFromDb, getClientsFromDb, updateJobInDb, logAudit } from "@/lib/supabase/db";
import {
    users,
    clients,
    candidates as mockCandidates,
    applications as mockApplications,
    interviews as mockInterviews,
    placements as mockPlacements,
    commissionLedger,
    tasks as mockTasks,
    auditLogs
} from "@/lib/mock/data";
import type { JobRequisition, JobStatus } from "@/lib/types";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id: jobId } = await params;

    const dbJobs = await getJobsFromDb(me.orgId);
    let job = dbJobs.find((j) => j.id === jobId);

    if (!job) {
        return NextResponse.json({ error: "Job requisition not found" }, { status: 404 });
    }

    const client = clients.find((c) => c.id === job.clientId) || null;
    const reqUser = users.find((u) => u.id === job.requestedById) || null;
    const appUser = users.find((u) => u.id === job.approvedById) || null;
    const primaryRec = users.find((u) => u.id === job.primaryRecruiterId) || (job.assignedTas?.[0] ? users.find((u) => u.id === job.assignedTas[0]) : null);
    const taMgr = users.find((u) => u.id === job.taManagerId) || null;
    const acctMgr = users.find((u) => u.id === (job.accountManagerId || client?.accountManagerId)) || null;

    // Applications & Candidate Pipeline for this job
    const jobApps = mockApplications.filter((a) => a.jobId === jobId);
    const populatedApps = jobApps.map((a) => {
        const candidate = mockCandidates.find((c) => c.id === a.candidateId);
        const recruiter = users.find((u) => u.id === a.recruiterId);
        const appInterviews = mockInterviews.filter((i) => i.applicationId === a.id);
        const daysInStage = Math.floor((Date.now() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);

        return {
            ...a,
            candidateName: candidate?.name ?? "Unknown Candidate",
            candidateEmail: candidate?.email ?? "",
            candidatePhone: candidate?.phone ?? "",
            candidateHeadline: candidate?.headline ?? "",
            candidateTotalExp: candidate?.totalExperienceYears ?? 0,
            candidateNoticeDays: candidate?.noticePeriodDays ?? 30,
            candidateCurrentCompany: candidate?.currentCompany ?? "",
            candidateSource: candidate?.source ?? "DATABASE",
            recruiterName: recruiter?.name ?? "Unassigned",
            interviewsCount: appInterviews.length,
            daysInStage,
            hasPendingFeedback: appInterviews.some((i) => i.status === "COMPLETED" && i.outcome === "PENDING"),
        };
    });

    // Pipeline Stage counts
    const pipelineCounts = {
        SOURCED: populatedApps.filter((a) => a.stage === "SOURCED").length,
        SCREENING: populatedApps.filter((a) => a.stage === "SCREENING").length,
        INTERVIEW_SCHEDULED: populatedApps.filter((a) => ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"].includes(a.stage)).length,
        OFFER_SENT: populatedApps.filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING"].includes(a.stage)).length,
        JOINED: populatedApps.filter((a) => a.stage === "JOINED").length,
        REJECTED: populatedApps.filter((a) => a.stage === "REJECTED").length,
        BACKED_OUT: populatedApps.filter((a) => a.stage === "BACKED_OUT").length,
    };

    // Interviews for this job
    const jobAppIds = new Set(jobApps.map((a) => a.id));
    const populatedInterviews = mockInterviews
        .filter((i) => jobAppIds.has(i.applicationId))
        .map((i) => {
            const app = populatedApps.find((a) => a.id === i.applicationId);
            return {
                ...i,
                candidateId: app?.candidateId,
                candidateName: app?.candidateName ?? "Unknown",
                jobTitle: job.title,
                roundName: i.round.replace(/_/g, " "),
            };
        });

    // Offers & Placements
    const jobOffers = populatedApps
        .filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"].includes(a.stage))
        .map((a) => ({
            id: `off-${a.id}`,
            applicationId: a.id,
            candidateId: a.candidateId,
            candidateName: a.candidateName,
            jobId,
            offeredSalaryLpa: (job.salaryMinLpa + job.salaryMaxLpa) / 2,
            offeredDate: a.createdAt,
            expectedJoiningDate: a.expectedJoinDate || new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
            status: a.stage === "JOINED" ? "JOINED" : (a.stage === "OFFER_ACCEPTED" ? "ACCEPTED" : "SENT"),
            approverName: appUser?.name ?? "Super Admin"
        }));

    const rawPlacements = (mockPlacements || []).filter((p: any) => p.jobId === jobId || jobAppIds.has(p.applicationId));
    const joinedPlacements = populatedApps.filter((a) => a.stage === "JOINED").map((a) => ({
        id: `plc-${a.id}`,
        applicationId: a.id,
        candidateId: a.candidateId,
        candidateName: a.candidateName,
        jobId,
        clientName: client?.companyName ?? "—",
        joiningDate: a.actualJoinDate || a.expectedJoinDate || "2026-08-15",
        status: "JOINED",
        ctcLpa: (job.salaryMinLpa + job.salaryMaxLpa) / 2,
        invoiceNumber: `INV-2026-JOB-${jobId.slice(-3)}`,
        placementFeeInr: Math.round(((job.salaryMinLpa + job.salaryMaxLpa) / 2) * 100000 * 0.0833)
    }));
    const jobPlacements = [...rawPlacements, ...joinedPlacements];

    // Linked Tasks
    const jobTasks = mockTasks.filter(
        (t) => t.linkedApplicationId && jobAppIds.has(t.linkedApplicationId)
    ).map((t) => {
        const app = populatedApps.find((a) => a.id === t.linkedApplicationId);
        const assignee = users.find((u) => u.id === t.assignedToId);
        return {
            ...t,
            candidateName: app?.candidateName,
            assignedToName: assignee?.name ?? "Unassigned"
        };
    });

    // Finance & Invoices
    const jobFinanceLedger = commissionLedger.filter(
        (l) => l.clientId === job.clientId || (l.applicationId && jobAppIds.has(l.applicationId))
    );

    // Recruiters Team working on this job
    const assignedRecruiters = (job.assignedTas || []).map((id) => {
        const recUser = users.find((u) => u.id === id);
        const recApps = populatedApps.filter((a) => a.recruiterId === id);
        return {
            id,
            name: recUser?.name ?? id,
            email: recUser?.email ?? "",
            designation: recUser?.designation ?? "Recruiter",
            avatarUrl: recUser?.avatarUrl ?? null,
            isPrimary: job.primaryRecruiterId === id || job.assignedTas?.[0] === id,
            candidatesCount: recApps.length,
            interviewsCount: populatedInterviews.filter((i) => recApps.some((a) => a.id === i.applicationId)).length,
            offersCount: recApps.filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"].includes(a.stage)).length,
            joinedCount: recApps.filter((a) => a.stage === "JOINED").length,
        };
    });

    // Days open & SLA metrics
    const daysOpen = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000);
    const effectiveSlaDays = job.slaDays || 30;
    const daysRemaining = effectiveSlaDays - daysOpen;
    let calculatedSlaStatus = job.sla?.status || "ON_TRACK";
    if (job.status === "FULFILLED") {
        calculatedSlaStatus = "COMPLETED";
    } else if (daysRemaining < 0) {
        calculatedSlaStatus = "OVERDUE";
    } else if (daysRemaining <= 5) {
        calculatedSlaStatus = "AT_RISK";
    }

    // Attention Bar Alerts (Real Operational Data)
    const alerts: { id: string; type: "WARNING" | "DANGER" | "INFO" | "SUCCESS"; message: string; actionTab: string }[] = [];
    if (job.status === "PENDING_APPROVAL") {
        alerts.push({ id: "alt-appr", type: "WARNING", message: "Job Requisition is pending Super Admin / TA Manager approval.", actionTab: "approvals" });
    }
    if (calculatedSlaStatus === "OVERDUE") {
        alerts.push({ id: "alt-sla-over", type: "DANGER", message: `SLA exceeded by ${Math.abs(daysRemaining)} days (${daysOpen} days open vs ${effectiveSlaDays} target).`, actionTab: "overview" });
    } else if (calculatedSlaStatus === "AT_RISK") {
        alerts.push({ id: "alt-sla-risk", type: "WARNING", message: `SLA warning: Only ${daysRemaining} days remaining to fulfill target.`, actionTab: "overview" });
    }
    const pendingFeedbackCount = populatedInterviews.filter((i) => i.status === "COMPLETED" && i.outcome === "PENDING").length;
    if (pendingFeedbackCount > 0) {
        alerts.push({ id: "alt-fb", type: "WARNING", message: `${pendingFeedbackCount} completed interview(s) awaiting client / panel feedback score.`, actionTab: "interviews" });
    }
    const remainingOpenings = Math.max(0, (job.openings || 1) - (job.filled || 0));
    if (remainingOpenings > 0 && populatedApps.length === 0) {
        alerts.push({ id: "alt-no-cand", type: "DANGER", message: "Zero candidates currently in pipeline for this opening. Sourcing push required.", actionTab: "candidates" });
    }

    // Activity & Audit log
    const jobAudits = auditLogs.filter(
        (a) => a.entityId === jobId || jobAppIds.has(a.entityId)
    );

    return NextResponse.json({
        job: {
            ...job,
            clientName: client?.companyName ?? "—",
            clientIndustry: client?.industry ?? "Technology",
            clientContactPerson: client?.contactPerson ?? "Hiring Lead",
            clientContactEmail: client?.contactEmail ?? "",
            clientContactPhone: client?.contactPhone ?? "",
            clientLocation: client?.address ?? "",
            requestedByName: reqUser?.name ?? null,
            approvedByName: appUser?.name ?? null,
            primaryRecruiterName: primaryRec?.name ?? "Unassigned",
            taManagerName: taMgr?.name ?? null,
            accountManagerName: acctMgr?.name ?? null,
            daysOpen,
            slaDays: effectiveSlaDays,
            daysRemaining,
            calculatedSlaStatus,
            remainingOpenings,
        },
        pipelineCounts,
        candidates: populatedApps,
        interviews: populatedInterviews,
        offers: jobOffers,
        placements: jobPlacements,
        tasks: jobTasks,
        finance: jobFinanceLedger,
        recruiters: assignedRecruiters,
        alerts,
        auditLogs: jobAudits,
    });
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id: jobId } = await params;

    const body = await request.json();
    const { action, ...updates } = body;

    const dbJobs = await getJobsFromDb(me.orgId);
    const existing = dbJobs.find((j) => j.id === jobId);
    if (!existing) {
        return NextResponse.json({ error: "Job requisition not found" }, { status: 404 });
    }

    if (action === "approve") {
        updates.status = "APPROVED";
        updates.approvedById = me.id;
    } else if (action === "hold") {
        updates.status = "ON_HOLD";
        updates.statusReason = body.reason || "Temporarily on hold by request";
        updates.holdResumeDate = body.resumeDate || null;
    } else if (action === "close") {
        updates.status = "CLOSED";
        updates.closureReason = body.closureReason || "Positions filled or mandate completed";
    } else if (action === "cancel") {
        updates.status = "CANCELLED";
        updates.cancelReason = body.cancelReason || "Cancelled by client";
    }

    // If requirements or openings were modified, record a version
    if (
        (updates.openings && updates.openings !== existing.openings) ||
        (updates.salaryMinLpa && updates.salaryMinLpa !== existing.salaryMinLpa) ||
        (updates.salaryMaxLpa && updates.salaryMaxLpa !== existing.salaryMaxLpa) ||
        (updates.skills && JSON.stringify(updates.skills) !== JSON.stringify(existing.skills))
    ) {
        const nextVersion = (existing.requirementVersions?.length || 1) + 1;
        const newVersionRecord = {
            version: nextVersion,
            openings: Number(updates.openings ?? existing.openings),
            salaryMinLpa: Number(updates.salaryMinLpa ?? existing.salaryMinLpa),
            salaryMaxLpa: Number(updates.salaryMaxLpa ?? existing.salaryMaxLpa),
            experienceMinYears: Number(updates.experienceMinYears ?? existing.experienceMinYears),
            experienceMaxYears: Number(updates.experienceMaxYears ?? existing.experienceMaxYears),
            skills: Array.isArray(updates.skills) ? updates.skills : existing.skills,
            location: updates.location ?? existing.location,
            workMode: updates.workMode ?? existing.workMode,
            changedById: me.id,
            changedByName: me.name,
            changedAt: new Date().toISOString(),
            changeSummary: body.changeSummary || `Requisition updated to version ${nextVersion}`
        };
        updates.requirementVersions = [...(existing.requirementVersions || []), newVersionRecord];
    }

    // Recruiter assignment change
    if (updates.primaryRecruiterId && updates.primaryRecruiterId !== existing.primaryRecruiterId) {
        const recUser = users.find((u) => u.id === updates.primaryRecruiterId);
        const asgRecord = {
            id: `asg-${Date.now()}`,
            recruiterId: updates.primaryRecruiterId,
            recruiterName: recUser?.name ?? updates.primaryRecruiterId,
            role: "PRIMARY_RECRUITER" as const,
            assignedById: me.id,
            assignedByName: me.name,
            assignedAt: new Date().toISOString(),
            active: true
        };
        updates.assignmentHistory = [...(existing.assignmentHistory || []), asgRecord];
        if (!updates.assignedTas) {
            updates.assignedTas = Array.from(new Set([...(existing.assignedTas || []), updates.primaryRecruiterId]));
        }
    }

    const success = await updateJobInDb(jobId, me.orgId, updates);
    if (!success) return NextResponse.json({ error: "Failed to update job" }, { status: 500 });

    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: action === "approve" ? "JOB_APPROVED" : (action === "close" ? "JOB_CLOSED" : "JOB_UPDATED"),
        entity: "JobRequisition",
        entityId: jobId,
        detail: body.changeSummary || `Updated job ${existing.title} (${action || 'edit'})`,
    });

    return NextResponse.json({ success: true });
}
