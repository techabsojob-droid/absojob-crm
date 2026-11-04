import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { getJobsFromDb, getClientsFromDb, updateJobInDb, logAudit } from "@/lib/supabase/db";
import { isRecruitmentManager, notifyJobAssignment, resolveApprovalsFor, validRecruiters } from "@/lib/mock/pipeline";
import {
    users,
    clients,
    candidates as mockCandidates,
    applications as mockApplications,
    interviews as mockInterviews,
    placements as mockPlacements,
    commissionLedger,
    tasks as mockTasks,
    auditLogs,
    callActivities,
    storedFiles,
} from "@/lib/mock/data";
import { fileUrl } from "@/lib/mock/finance";
import type { JobLevel, JobRequisition, ShiftTiming } from "@/lib/types";
import { pipelineMetrics } from "@/lib/metrics";
import { approvalHistory, updateRequisition } from "@/lib/requisition-server";

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
    if (!isRecruitmentManager(me) && !(job.primaryRecruiterId === me.id || (job.assignedTas || []).includes(me.id) || job.requestedById === me.id)) {
        return NextResponse.json({ error: "This requisition is not assigned to you" }, { status: 403 });
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
        const appCalls = callActivities.filter((c) => c.applicationId === a.id).sort((x, y) => +new Date(y.calledAt) - +new Date(x.calledAt));
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
            candidateLocation: candidate?.location ?? candidate?.currentCity ?? "",
            candidateCurrentCtc: candidate?.currentCtcLpa ?? 0,
            candidateExpectedCtc: candidate?.expectedCtcLpa ?? 0,
            candidateSkills: candidate?.skills ?? [],
            candidateResumeUrl: candidate?.resumeUrl ?? candidate?.documents?.find((d) => d.type === "RESUME")?.fileUrl ?? null,
            callsCount: appCalls.length,
            lastCall: appCalls[0] ? { calledAt: appCalls[0].calledAt, callStatus: appCalls[0].callStatus, candidateInterest: appCalls[0].candidateInterest ?? null, nextAction: appCalls[0].nextAction ?? null, followUpDate: appCalls[0].followUpDate ?? null } : null,
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

    // Requisition pipeline summary (current stage of every linked candidate)
    const at = (...st: string[]) => populatedApps.filter((a) => st.includes(a.stage)).length;
    const appIdSet = new Set(jobApps.map((a) => a.id));
    const submittedToClient = new Set(mockCandidates.flatMap((c) => (c.clientSubmissions ?? []).filter((s) => (s.applicationId && appIdSet.has(s.applicationId)) || s.jobId === jobId).map((s) => s.applicationId ?? `${c.id}:${s.jobId}`))).size;
    const joinedCount = at("JOINED");
    const requisitionStats = {
        totalCandidates: populatedApps.length,
        sourced: at("SOURCED", "CONTACTED"),
        screening: at("SCREENING"),
        submittedToClient,
        shortlisted: at("SHORTLISTED"),
        shortlistedOrBeyond: at("SHORTLISTED", "INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", "INTERVIEW_COMPLETED", "SELECTED", "OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"),
        interviewScheduled: at("INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"),
        interviewCompleted: at("INTERVIEW_COMPLETED"),
        selected: at("SELECTED"),
        offered: at("OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING"),
        joined: joinedCount,
        rejected: at("REJECTED"),
        onHold: at("ON_HOLD"),
        withdrawn: at("BACKED_OUT", "WITHDRAWN", "NOT_INTERESTED"),
    };
    // Filled = candidates who actually joined (rejected / withdrawn never count)
    const filledOpenings = Math.min(job.openings || 0, Math.max(job.filled || 0, joinedCount));

    // Interviews for this job
    const jobAppIds = new Set(jobApps.map((a) => a.id));
    const jobMetrics = pipelineMetrics(jobApps, mockInterviews, mockCandidates);
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
    // Offers: real offer records first; stage-only applications show without invented numbers
    const jobOffers = populatedApps
        .filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"].includes(a.stage))
        .map((a) => {
            const cand = mockCandidates.find((c) => c.id === a.candidateId);
            const offer = cand?.offers?.find((o) => (o.applicationId ? o.applicationId === a.id : o.jobId === jobId) && o.status !== "WITHDRAWN");
            return {
                id: offer?.id ?? `off-${a.id}`,
                applicationId: a.id,
                candidateId: a.candidateId,
                candidateName: a.candidateName,
                jobId,
                offeredSalaryLpa: offer?.offeredCtcLpa ?? null,
                offeredDate: offer?.offeredDate ?? null,
                expectedJoiningDate: offer?.joiningDate || a.expectedJoinDate || null,
                status: a.stage === "JOINED" ? "JOINED" : (a.stage === "OFFER_ACCEPTED" || a.stage === "ONBOARDING" ? "ACCEPTED" : offer?.status ?? "SENT"),
                approverName: appUser?.name ?? null,
            };
        });

    // Placements: stored records, plus joined applications that predate automatic placement creation
    const rawPlacements = (mockPlacements || []).filter((p) => p.orgId === me.orgId && p.jobId === jobId);
    const placedCandidateIds = new Set(rawPlacements.map((p) => p.candidateId));
    const joinedPlacements = populatedApps
        .filter((a) => a.stage === "JOINED" && !placedCandidateIds.has(a.candidateId))
        .map((a) => ({
            id: `plc-${a.id}`,
            applicationId: a.id,
            candidateId: a.candidateId,
            candidateName: a.candidateName,
            jobId,
            clientName: client?.companyName ?? "—",
            joiningDate: a.actualJoinDate || a.expectedJoinDate || null,
            status: "JOINED",
            ctcLpa: null,
            invoiceNumber: null,
            placementFeeInr: null,
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

    const manager = isRecruitmentManager(me);
    const canEdit = !["CLOSED", "CANCELLED", "FULFILLED"].includes(job.status) && (manager || (job.requestedById === me.id && ["DRAFT", "PENDING_APPROVAL"].includes(job.status)));
    return NextResponse.json({
        canManage: manager,
        canEdit,
        requisitionStats,
        approvalHistory: approvalHistory(me.orgId, job.id),
        createdByName: reqUser?.name ?? null,
        updatedByName: users.find((u) => u.id === job.updatedById)?.name ?? null,
        job: {
            ...job,
            internalNotes: manager ? job.internalNotes ?? null : undefined,
            listed: job.published !== false,
            clientName: client?.companyName ?? "—",
            clientIndustry: client?.industry ?? "Technology",
            // The requisition's own client contact wins over the client's default contact
            clientContactPerson: job.clientContactName || client?.contactPerson || "Hiring Lead",
            clientContactEmail: job.clientContactEmail || client?.contactEmail || "",
            clientContactPhone: job.clientContactPhone || client?.contactPhone || "",
            clientLocation: client?.address ?? "",
            requestedByName: reqUser?.name ?? null,
            approvedByName: appUser?.name ?? null,
            primaryRecruiterName: primaryRec?.name ?? "Unassigned",
            publishedByName: users.find((u) => u.id === job.publishedById)?.name ?? null,
            taManagerName: taMgr?.name ?? null,
            accountManagerName: acctMgr?.name ?? null,
            daysOpen,
            timeToFirstInterviewDays: jobMetrics.avgDaysToFirstInterview,
            timeToOfferDays: jobMetrics.avgDaysToOffer,
            slaDays: effectiveSlaDays,
            daysRemaining,
            calculatedSlaStatus,
            filled: filledOpenings,
            filledOpenings,
            remainingOpenings: Math.max(0, (job.openings || 0) - filledOpenings),
            secondaryRecruiters: (job.assignedTas ?? []).filter((id) => id !== job.primaryRecruiterId).map((id) => ({ id, name: users.find((u) => u.id === id)?.name ?? id })),
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

// Fields a team lead may edit directly; everything else (filled, history, org) is server-owned
const EDITABLE: (keyof JobRequisition)[] = [
    "title", "department", "location", "workMode", "city", "employmentType", "jobLevel", "vacancyType", "replacementFor", "shiftTiming",
    "joiningPreference", "hiringManagerName", "interviewRounds", "internalNotes", "priority", "priorityReason", "openings",
    "salaryMinLpa", "salaryMaxLpa", "experienceMinYears", "experienceMaxYears", "skills", "preferredSkills", "education",
    "noticePeriodPreference", "description", "responsibilities", "targetCloseDate", "targetJoiningDate", "slaDays",
    "primaryRecruiterId", "assignedTas", "taManagerId", "accountManagerId", "status", "tags",
];
const OPEN_STATUSES = ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE", "JOINING"];
const JOB_LEVELS: JobLevel[] = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER", "DIRECTOR"];
const SHIFTS: ShiftTiming[] = ["DAY", "NIGHT", "ROTATIONAL", "FLEXIBLE"];
const toList = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((s) => String(s).trim()).filter(Boolean);

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    // Assigning recruiters, holding, publishing and editing the specification are team-lead (TA Manager) decisions
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id: jobId } = await params;

    const body = await request.json();
    const { action } = body;

    const dbJobs = await getJobsFromDb(me.orgId);
    const existing = dbJobs.find((j) => j.id === jobId);
    if (!existing) {
        return NextResponse.json({ error: "Job requisition not found" }, { status: 404 });
    }

    const updates: Record<string, any> = {};
    for (const k of EDITABLE) if (body[k] !== undefined) updates[k] = body[k];
    for (const k of ["skills", "preferredSkills", "interviewRounds", "tags"]) if (updates[k] !== undefined) updates[k] = toList(updates[k]);
    if (updates.jobLevel !== undefined && !JOB_LEVELS.includes(updates.jobLevel)) delete updates.jobLevel;
    if (updates.shiftTiming !== undefined && !SHIFTS.includes(updates.shiftTiming)) delete updates.shiftTiming;
    if (updates.vacancyType !== undefined && updates.vacancyType !== "REPLACEMENT") { updates.vacancyType = "NEW_HIRING"; updates.replacementFor = null; }
    if (updates.openings !== undefined) {
        const n = Math.floor(Number(updates.openings));
        if (!(n >= 1)) return NextResponse.json({ error: "Openings must be at least 1" }, { status: 400 });
        if (n < (existing.filled || 0)) return NextResponse.json({ error: `${existing.filled} position(s) are already filled — openings cannot go below that` }, { status: 400 });
        updates.openings = n;
    }
    const minExp = Number(updates.experienceMinYears ?? existing.experienceMinYears), maxExp = Number(updates.experienceMaxYears ?? existing.experienceMaxYears);
    if (maxExp && minExp > maxExp) return NextResponse.json({ error: "Min experience cannot be more than max experience" }, { status: 400 });
    const minCtc = Number(updates.salaryMinLpa ?? existing.salaryMinLpa), maxCtc = Number(updates.salaryMaxLpa ?? existing.salaryMaxLpa);
    if (maxCtc && minCtc > maxCtc) return NextResponse.json({ error: "Min CTC cannot be more than max CTC" }, { status: 400 });

    if (action === "approve") {
        if (existing.status !== "PENDING_APPROVAL" && existing.status !== "DRAFT") return NextResponse.json({ error: "Only a pending requisition can be approved" }, { status: 422 });
        if (existing.requestedById === me.id && me.role !== "SUPER_ADMIN") return NextResponse.json({ error: "You cannot approve your own requisition" }, { status: 403 });
        updates.status = "APPROVED";
        updates.approvedById = me.id;
        updates.approvedAt = new Date().toISOString();
    } else if (action === "hold") {
        const reason = String(body.reason ?? "").trim();
        if (!reason) return NextResponse.json({ error: "A reason is required to put a requisition on hold" }, { status: 400 });
        if (["FULFILLED", "CLOSED", "CANCELLED"].includes(existing.status)) return NextResponse.json({ error: `Requisition is already ${existing.status.toLowerCase()}` }, { status: 422 });
        updates.status = "ON_HOLD";
        updates.statusReason = reason;
        updates.holdResumeDate = body.resumeDate || null;
    } else if (action === "resume") {
        if (existing.status !== "ON_HOLD") return NextResponse.json({ error: "Requisition is not on hold" }, { status: 422 });
        updates.status = "SOURCING";
        updates.statusReason = String(body.reason ?? "").trim() || "Sourcing resumed";
        updates.holdResumeDate = null;
    } else if (action === "close") {
        updates.status = "CLOSED";
        updates.closureReason = String(body.closureReason ?? "").trim() || "Positions filled or mandate completed";
        updates.closedAt = new Date().toISOString();
    } else if (action === "cancel") {
        updates.status = "CANCELLED";
        updates.cancelReason = String(body.cancelReason ?? "").trim() || "Cancelled by client";
        updates.closedAt = new Date().toISOString();
    } else if (action === "publish") {
        if (!OPEN_STATUSES.includes(existing.status)) {
            return NextResponse.json({ error: `Only open requisitions can be listed (this one is ${existing.status.replace(/_/g, " ").toLowerCase()})` }, { status: 422 });
        }
        updates.published = true;
        updates.publishedAt = new Date().toISOString();
        updates.publishedById = me.id;
    } else if (action === "unpublish") {
        updates.published = false;
    } else if (action === "addDocument") {
        // File already uploaded through /api/files; attach it to the requisition
        const f = storedFiles.find((x) => x.id === body.fileId && x.orgId === me.orgId);
        if (!f) return NextResponse.json({ error: "Uploaded file not found" }, { status: 404 });
        const DOC_TYPES = ["JD", "CLIENT_REQUIREMENT", "RATE_CARD", "SOW", "CONTRACT", "INTERVIEW_GUIDE", "OTHER"] as const;
        const type = (DOC_TYPES as readonly string[]).includes(body.documentType) ? body.documentType : "OTHER";
        const sameName = (existing.documents ?? []).filter((d) => d.name === f.name);
        updates.documents = [...(existing.documents ?? []), {
            id: `jdoc-${crypto.randomUUID().slice(0, 8)}`, name: f.name, type, fileUrl: fileUrl(f.id), fileSizeKb: Math.ceil(f.size / 1024),
            version: sameName.length + 1, uploadedById: me.id, uploadedByName: me.name, uploadedAt: new Date().toISOString(), status: "ACTIVE",
        }];
    } else if (action === "archiveDocument") {
        if (!(existing.documents ?? []).some((d) => d.id === body.documentId)) return NextResponse.json({ error: "Document not found" }, { status: 404 });
        updates.documents = (existing.documents ?? []).map((d) => (d.id === body.documentId ? { ...d, status: "ARCHIVED" } : d));
    } else if (action) {
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    // A requisition that stops being open comes off the job listing
    if (updates.status && !OPEN_STATUSES.includes(updates.status)) updates.published = false;

    // If requirements or openings were modified, record a version
    const changedSpec = (["openings", "salaryMinLpa", "salaryMaxLpa", "experienceMinYears", "experienceMaxYears", "location", "workMode"] as const)
        .some((k) => updates[k] !== undefined && String(updates[k]) !== String(existing[k] ?? ""))
        || (updates.skills && JSON.stringify(updates.skills) !== JSON.stringify(existing.skills));
    if (changedSpec) {
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
        // Keep the per-seat list in step with a changed headcount
        if (updates.openings !== undefined && updates.openings !== existing.openings) {
            const seats = [...(existing.openingsList || [])];
            const open = seats.filter((o) => o.status !== "CANCELLED");
            for (let i = open.length; i < updates.openings; i++) {
                seats.push({ id: `opn-${Date.now()}-${i + 1}`, openingNumber: seats.length + 1, status: "OPEN", notes: `Added in version ${nextVersion}` });
            }
            let surplus = open.length - updates.openings;
            for (let i = seats.length - 1; i >= 0 && surplus > 0; i--) {
                if (seats[i].status === "OPEN") { seats[i] = { ...seats[i], status: "CANCELLED", notes: `Removed in version ${nextVersion}` }; surplus--; }
            }
            updates.openingsList = seats;
        }
    }

    // Recruiter assignment change
    if (updates.primaryRecruiterId && updates.primaryRecruiterId !== existing.primaryRecruiterId) {
        const recUser = users.find((u) => u.id === updates.primaryRecruiterId);
        const now = new Date().toISOString();
        const asgRecord = {
            id: `asg-${Date.now()}`,
            recruiterId: updates.primaryRecruiterId,
            recruiterName: recUser?.name ?? updates.primaryRecruiterId,
            role: "PRIMARY_RECRUITER" as const,
            assignedById: me.id,
            assignedByName: me.name,
            assignedAt: now,
            active: true
        };
        updates.assignmentHistory = [
            ...(existing.assignmentHistory || []).map((h) => h.role === "PRIMARY_RECRUITER" && h.active ? { ...h, active: false, unassignedAt: now, unassignedReason: `Replaced by ${asgRecord.recruiterName}` } : h),
            asgRecord,
        ];
        if (!updates.assignedTas) {
            updates.assignedTas = Array.from(new Set([...(existing.assignedTas || []), updates.primaryRecruiterId]));
        }
    }

    const newTeam = [...(updates.assignedTas || []), ...(updates.primaryRecruiterId ? [updates.primaryRecruiterId] : [])];
    const { invalid } = validRecruiters(me.orgId, newTeam);
    if (invalid.length) return NextResponse.json({ error: `Recruiter(s) not found: ${invalid.join(", ")}` }, { status: 400 });
    const prevTeam = [...(existing.assignedTas || []), ...(existing.primaryRecruiterId ? [existing.primaryRecruiterId] : [])];

    const success = await updateJobInDb(jobId, me.orgId, updates);
    if (!success) return NextResponse.json({ error: "Failed to update job" }, { status: 500 });

    const after = (await getJobsFromDb(me.orgId)).find((j) => j.id === jobId);
    if (after) {
        if (action === "approve") resolveApprovalsFor(jobId, "APPROVED", me);
        if (action === "cancel") resolveApprovalsFor(jobId, "REJECTED", me, updates.cancelReason);
        notifyJobAssignment(after, prevTeam, me);
    }

    const auditAction: Record<string, string> = { approve: "JOB_APPROVED", close: "JOB_CLOSED", hold: "JOB_ON_HOLD", resume: "JOB_RESUMED", publish: "JOB_PUBLISHED", unpublish: "JOB_UNPUBLISHED" };
    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: auditAction[action] ?? (updates.primaryRecruiterId && updates.primaryRecruiterId !== existing.primaryRecruiterId ? "JOB_RECRUITER_ASSIGNED" : "JOB_UPDATED"),
        entity: "JobRequisition",
        entityId: jobId,
        detail: action === "hold" ? `On hold: ${updates.statusReason}${updates.holdResumeDate ? ` (resume ${updates.holdResumeDate})` : ""}`
            : body.changeSummary || `Updated job ${existing.title} (${action || "edit"})`,
    });

    return NextResponse.json({ success: true });
}

// PUT — full update from the requisition wizard: { intent: "save" | "draft" | "submit", ...fields }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const existing = (await getJobsFromDb(me.orgId)).find((j) => j.id === id);
    if (!existing) return NextResponse.json({ error: "Job requisition not found" }, { status: 404 });
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
    return updateRequisition(me, existing, body);
}
