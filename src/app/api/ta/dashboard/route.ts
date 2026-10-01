import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    jobs, clients, applications, candidates, interviews, tasks, users,
    onboardingRecords, auditLogs, ACTIVE_STAGES, STAGE_ORDER
} from "@/lib/mock/data";
import type { ApplicationStage, JobPriority } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("TA_MANAGER", "TA_RECRUITER", "SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "THIS_MONTH"; // TODAY, THIS_WEEK, THIS_MONTH, LAST_30_DAYS, ALL
    const recruiterId = url.searchParams.get("recruiterId") || "ALL";
    const clientId = url.searchParams.get("clientId") || "ALL";
    const priority = url.searchParams.get("priority") || "ALL";
    const department = url.searchParams.get("department") || "ALL";

    const isManager = me.role === "TA_MANAGER" || me.role === "SUPER_ADMIN";

    // Date calculations
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Monday
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const getPeriodFilterDate = () => {
        if (period === "TODAY") return todayStart;
        if (period === "THIS_WEEK") return weekStart;
        if (period === "THIS_MONTH") return monthStart;
        if (period === "LAST_30_DAYS") return thirtyDaysAgo;
        return null;
    };
    const periodStartDate = getPeriodFilterDate();

    // Base scoping: Org scoping + TA Manager or Recruiter scoping
    let orgJobs = jobs.filter((j) => j.orgId === me.orgId);
    let orgApps = applications.filter((a) => a.orgId === me.orgId);
    const orgInterviews = interviews.filter((i) => i.orgId === me.orgId);
    let orgTasks = tasks.filter((t) => t.orgId === me.orgId);
    const orgOnboarding = onboardingRecords.filter((o) => o.orgId === me.orgId);
    const orgCandidates = candidates.filter((c) => me.role === "SUPER_ADMIN" || c.orgId === me.orgId);

    // Filter by user role if not manager
    if (!isManager) {
        orgJobs = orgJobs.filter((j) => j.assignedTas?.includes(me.id) || j.primaryRecruiterId === me.id);
        orgApps = orgApps.filter((a) => a.recruiterId === me.id);
        orgTasks = orgTasks.filter((t) => t.assignedToId === me.id);
    }

    // Apply Global Dashboard Filters
    if (recruiterId !== "ALL") {
        orgJobs = orgJobs.filter((j) => j.assignedTas?.includes(recruiterId) || j.primaryRecruiterId === recruiterId);
        orgApps = orgApps.filter((a) => a.recruiterId === recruiterId);
    }
    if (clientId !== "ALL") {
        orgJobs = orgJobs.filter((j) => j.clientId === clientId);
        orgApps = orgApps.filter((a) => {
            const j = jobs.find((x) => x.id === a.jobId);
            return j?.clientId === clientId;
        });
    }
    if (priority !== "ALL") {
        orgJobs = orgJobs.filter((j) => j.priority === priority);
    }
    if (department !== "ALL") {
        orgJobs = orgJobs.filter((j) => j.department === department);
    }

    // 1. REQUISITION HEALTH & KPIS
    const openJobStatuses = ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE"];
    const activeJobs = orgJobs.filter((j) => openJobStatuses.includes(j.status));
    const openRequisitionsCount = activeJobs.length;
    const openPositionsCount = activeJobs.reduce((sum, j) => sum + Math.max(0, (j.openings || 1) - (j.filled || 0)), 0);
    const urgentRequisitionsCount = activeJobs.filter((j) => j.priority === "URGENT").length;

    // Aging Requisitions (> 30 days open or SLA breached)
    const enrichedRequisitions = activeJobs.map((j) => {
        const client = clients.find((c) => c.id === j.clientId);
        const daysOpen = Math.max(1, Math.floor((now.getTime() - new Date(j.createdAt).getTime()) / 86400000));
        const effectiveSla = j.slaDays || 30;
        const daysRemaining = effectiveSla - daysOpen;
        const jobApps = orgApps.filter((a) => a.jobId === j.id);
        const inPipe = jobApps.filter((a) => ACTIVE_STAGES.includes(a.stage)).length;
        const remainingOpenings = Math.max(0, (j.openings || 1) - (j.filled || 0));

        let health: "HEALTHY" | "AT_RISK" | "CRITICAL" = "HEALTHY";
        if (daysRemaining < 0 || (j.priority === "URGENT" && inPipe === 0)) {
            health = "CRITICAL";
        } else if (daysRemaining <= 5 || inPipe < remainingOpenings) {
            health = "AT_RISK";
        }

        return {
            id: j.id,
            title: j.title,
            clientId: j.clientId,
            clientName: client?.companyName ?? "—",
            department: j.department ?? "Engineering",
            location: j.location,
            priority: j.priority as JobPriority,
            status: j.status,
            openings: j.openings || 1,
            filled: j.filled || 0,
            remainingOpenings,
            inPipeline: inPipe,
            daysOpen,
            slaDays: effectiveSla,
            daysRemaining,
            health,
            primaryRecruiterName: users.find((u) => u.id === (j.primaryRecruiterId || j.assignedTas?.[0]))?.name ?? "Unassigned",
        };
    });

    const agingRequisitions = [...enrichedRequisitions]
        .filter((r) => r.daysOpen >= 20 || r.daysRemaining <= 7)
        .sort((a, b) => b.daysOpen - a.daysOpen);

    // 2. ACTIVE PIPELINE & STAGE BREAKDOWN
    const activePipelineApps = orgApps.filter((a) => ACTIVE_STAGES.includes(a.stage));
    const inPipelineTotal = activePipelineApps.length;
    const interviewStageCount = activePipelineApps.filter((a) =>
        ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"].includes(a.stage)
    ).length;
    const clientRoundStageCount = activePipelineApps.filter((a) => a.stage === "CLIENT_ROUND").length;
    const offerStageCount = activePipelineApps.filter((a) =>
        ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING"].includes(a.stage)
    ).length;

    // 3. FULL PIPELINE FUNNEL (10 STAGES)
    const funnelStagesList: ApplicationStage[] = [
        "SOURCED",
        "SCREENING",
        "INTERVIEW_SCHEDULED",
        "TECH_ROUND",
        "CLIENT_ROUND",
        "HR_ROUND",
        "OFFER_SENT",
        "OFFER_ACCEPTED",
        "ONBOARDING",
        "JOINED"
    ];

    const funnelCounts = funnelStagesList.map((stage) => {
        return orgApps.filter((a) => {
            if (stage === "JOINED") {
                if (periodStartDate) return a.stage === "JOINED" && new Date(a.updatedAt) >= periodStartDate;
                return a.stage === "JOINED";
            }
            return a.stage === stage;
        }).length;
    });

    // Funnel conversion steps
    const funnel = funnelStagesList.map((stage, idx) => {
        const count = funnelCounts[idx];
        const nextCount = idx < funnelStagesList.length - 1 ? funnelCounts[idx + 1] : 0;
        const conversionPct = count > 0 && idx < funnelStagesList.length - 1
            ? Math.min(100, Math.round((nextCount / count) * 100))
            : null;
        return {
            stage,
            label: stage.replaceAll("_", " "),
            count,
            conversionPct,
        };
    });

    // 4. CANDIDATES STUCK IN PIPELINE (> 3 days in current active stage)
    const stuckCandidates = activePipelineApps.map((a) => {
        const cand = candidates.find((c) => c.id === a.candidateId);
        const job = jobs.find((j) => j.id === a.jobId);
        const recruiter = users.find((u) => u.id === a.recruiterId);
        const updatedTime = new Date(a.updatedAt || a.createdAt).getTime();
        const daysInStage = Math.max(1, Math.floor((now.getTime() - updatedTime) / 86400000));
        return {
            applicationId: a.id,
            candidateId: a.candidateId,
            candidateName: cand?.name ?? "—",
            candidateEmail: cand?.email ?? "",
            jobId: a.jobId,
            jobTitle: job?.title ?? "—",
            clientName: clients.find((c) => c.id === job?.clientId)?.companyName ?? "—",
            stage: a.stage,
            daysInStage,
            recruiterName: recruiter?.name ?? "Unassigned",
            recruiterId: a.recruiterId,
            actionRequired: a.stage === "CLIENT_ROUND"
                ? "Client feedback follow-up"
                : a.stage === "OFFER_SENT"
                    ? "Offer acceptance pending"
                    : a.stage === "TECH_ROUND"
                        ? "Scorecard pending"
                        : "Stage evaluation pending",
        };
    })
    .filter((c) => c.daysInStage >= 3)
    .sort((a, b) => b.daysInStage - a.daysInStage);

    // 5. TODAY'S INTERVIEWS & CONFLICT DETECTION
    const enrichedInterviews = orgInterviews.map((i) => {
        const app = applications.find((a) => a.id === i.applicationId);
        const cand = candidates.find((c) => c.id === app?.candidateId);
        const job = jobs.find((j) => j.id === app?.jobId);
        const client = clients.find((c) => c.id === job?.clientId);
        return {
            ...i,
            candidateName: cand?.name ?? "—",
            candidatePhone: cand?.phone ?? "",
            candidateEmail: cand?.email ?? "",
            jobId: job?.id ?? null,
            jobTitle: job?.title ?? "—",
            clientName: client?.companyName ?? null,
            recruiterId: app?.recruiterId ?? null,
            recruiterName: users.find((u) => u.id === app?.recruiterId)?.name ?? null,
        };
    });

    const todayInterviews = enrichedInterviews
        .filter((i) => {
            const dt = new Date(i.scheduledAt);
            return dt >= todayStart && dt < todayEnd;
        })
        .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));

    // Conflict detection for today's interviews
    const interviewConflicts: Array<{
        interviewId1: string;
        interviewId2: string;
        candidateName: string;
        interviewerName: string;
        time: string;
        reason: string;
    }> = [];

    for (let i = 0; i < todayInterviews.length; i++) {
        for (let j = i + 1; j < todayInterviews.length; j++) {
            const intA = todayInterviews[i];
            const intB = todayInterviews[j];
            if (intA.status === "CANCELLED" || intB.status === "CANCELLED") continue;

            const timeA = new Date(intA.scheduledAt).getTime();
            const endA = timeA + (intA.durationMins || 45) * 60000;
            const timeB = new Date(intB.scheduledAt).getTime();
            const endB = timeB + (intB.durationMins || 45) * 60000;

            const isOverlapping = (timeA < endB) && (timeB < endA);
            if (isOverlapping) {
                if (intA.interviewerName === intB.interviewerName) {
                    interviewConflicts.push({
                        interviewId1: intA.id,
                        interviewId2: intB.id,
                        candidateName: `${intA.candidateName} & ${intB.candidateName}`,
                        interviewerName: intA.interviewerName,
                        time: new Date(intA.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        reason: `Interviewer ${intA.interviewerName} double booked`,
                    });
                } else if (intA.applicationId === intB.applicationId) {
                    interviewConflicts.push({
                        interviewId1: intA.id,
                        interviewId2: intB.id,
                        candidateName: intA.candidateName,
                        interviewerName: `${intA.interviewerName} & ${intB.interviewerName}`,
                        time: new Date(intA.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        reason: `Candidate ${intA.candidateName} scheduled for concurrent rounds`,
                    });
                }
            }
        }
    }

    // 6. PENDING FEEDBACK QUEUE
    const pendingFeedbackInterviews = enrichedInterviews
        .filter((i) => {
            const isCompleted = i.status === "COMPLETED";
            const noFeedback = !i.feedback || i.outcome === "PENDING";
            return isCompleted && noFeedback;
        })
        .map((i) => {
            const interviewTime = new Date(i.scheduledAt).getTime();
            const hoursPending = Math.max(1, Math.round((now.getTime() - interviewTime) / 3600000));
            const isClientRound = i.round === "CLIENT_ROUND";
            let slaStatus: "NORMAL" | "HIGH" | "BREACHED" = "NORMAL";
            if (hoursPending > 48) slaStatus = "BREACHED";
            else if (hoursPending > 18) slaStatus = "HIGH";

            return {
                id: i.id,
                applicationId: i.applicationId,
                candidateName: i.candidateName,
                jobTitle: i.jobTitle,
                clientName: i.clientName,
                round: i.round,
                interviewerName: i.interviewerName,
                scheduledAt: i.scheduledAt,
                hoursPending,
                isClientRound,
                slaStatus,
            };
        })
        .sort((a, b) => b.hoursPending - a.hoursPending);

    const pendingFeedbackCount = pendingFeedbackInterviews.length;
    const clientFeedbackPendingCount = pendingFeedbackInterviews.filter((f) => f.isClientRound).length;
    const internalFeedbackPendingCount = pendingFeedbackInterviews.filter((f) => !f.isClientRound).length;

    // 7. TASKS & WORKLOAD
    const pendingTasksList = orgTasks.filter((t) => !t.completed);
    const tasksDueToday = pendingTasksList.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= todayStart && d < todayEnd;
    }).length;
    const tasksOverdue = pendingTasksList.filter((t) => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < todayStart;
    }).length;
    const tasksUpcoming = pendingTasksList.length - tasksDueToday - tasksOverdue;

    // 8. TOTAL JOINED & ACHIEVED PERCENTAGE
    const totalJoinedPeriod = orgApps.filter((a) => {
        if (a.stage !== "JOINED") return false;
        if (periodStartDate) return new Date(a.updatedAt || a.createdAt) >= periodStartDate;
        return true;
    }).length;
    const joinedTarget = 10;
    const joinedAchievedPct = Math.round((totalJoinedPeriod / joinedTarget) * 100);

    // 9. HIRING CONVERSION
    const totalCandidatesInScope = orgCandidates.length;
    const conversionRate = totalCandidatesInScope > 0
        ? ((totalJoinedPeriod / totalCandidatesInScope) * 100).toFixed(1)
        : "0.0";

    // 10. SLA RISK SUMMARY
    const slaRiskRequisitionsCount = enrichedRequisitions.filter((r) => r.health === "CRITICAL" || r.health === "AT_RISK").length;
    const slaRiskCandidatesCount = stuckCandidates.filter((s) => s.daysInStage >= 5).length;
    const slaRiskTotal = slaRiskRequisitionsCount + slaRiskCandidatesCount;

    // 11. OFFER PIPELINE & AGING
    const offerSentApps = orgApps.filter((a) => a.stage === "OFFER_SENT");
    const offerAcceptedApps = orgApps.filter((a) => a.stage === "OFFER_ACCEPTED" || a.stage === "ONBOARDING");
    const offerAtRiskCount = offerSentApps.filter((a) => {
        const daysSinceSent = Math.floor((now.getTime() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);
        return daysSinceSent >= 4;
    }).length;

    const offerPipeline = {
        total: offerSentApps.length + offerAcceptedApps.length,
        awaitingAcceptance: offerSentApps.length,
        accepted: offerAcceptedApps.length,
        atRisk: offerAtRiskCount,
        offersList: [...offerSentApps, ...offerAcceptedApps].map((a) => {
            const cand = candidates.find((c) => c.id === a.candidateId);
            const job = jobs.find((j) => j.id === a.jobId);
            const client = clients.find((c) => c.id === job?.clientId);
            const daysSinceSent = Math.floor((now.getTime() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);
            return {
                applicationId: a.id,
                candidateId: a.candidateId,
                candidateName: cand?.name ?? "—",
                jobTitle: job?.title ?? "—",
                clientName: client?.companyName ?? "—",
                stage: a.stage,
                expectedCtcLpa: cand?.expectedCtcLpa ?? 0,
                daysSinceSent,
                status: daysSinceSent >= 4 && a.stage === "OFFER_SENT" ? "AT_RISK" : "NORMAL",
            };
        }),
    };

    // 12. JOINING TRACKER & ONBOARDING HANDOFF
    const joiningList = orgApps
        .filter((a) => a.stage === "OFFER_ACCEPTED" || a.stage === "ONBOARDING" || a.stage === "JOINED")
        .map((a) => {
            const cand = candidates.find((c) => c.id === a.candidateId);
            const job = jobs.find((j) => j.id === a.jobId);
            const client = clients.find((c) => c.id === job?.clientId);
            const onb = orgOnboarding.find((o) => o.applicationId === a.id || o.candidateId === a.candidateId);

            const joinDate = a.expectedJoinDate || a.actualJoinDate || (cand?.availabilityDetails?.availableFrom) || dateOnly(14);
            const diffDays = Math.ceil((new Date(joinDate).getTime() - now.getTime()) / 86400000);

            let joinBadge = "Upcoming";
            if (diffDays <= 3 && diffDays >= 0) joinBadge = "Joining in 3 days";
            else if (diffDays <= 7 && diffDays >= 0) joinBadge = "Joining this week";
            else if (diffDays < 0 && a.stage !== "JOINED") joinBadge = "Joining date missed";
            else if (a.stage === "JOINED") joinBadge = "Joined";

            return {
                applicationId: a.id,
                candidateId: a.candidateId,
                candidateName: cand?.name ?? "—",
                jobTitle: job?.title ?? "—",
                clientName: client?.companyName ?? "—",
                joiningDate: joinDate,
                diffDays,
                stage: a.stage,
                joinBadge,
                onboardingStatus: onb?.status ?? "PENDING",
                onboardingProgress: onb?.progressPercent ?? 0,
                hasBlocker: onb ? onb.checklist.some((ck) => !ck.completed && ck.requiredDoc) : false,
            };
        })
        .sort((a, b) => +new Date(a.joiningDate) - +new Date(b.joiningDate));

    // 13. EXECUTIVE ATTENTION PANEL ("Needs Your Attention")
    interface AttentionItem {
        id: string;
        priority: "URGENT" | "HIGH" | "MEDIUM";
        title: string;
        subtitle: string;
        metric?: string;
        actionLabel: string;
        actionHref: string;
        type: "SLA_BREACH" | "INTERVIEW_CONFLICT" | "FEEDBACK_OVERDUE" | "STUCK_CANDIDATE" | "TASK_OVERDUE" | "OFFER_RISK";
    }

    const attentionItems: AttentionItem[] = [];

    // Conflict alerts (URGENT)
    interviewConflicts.forEach((conf, idx) => {
        attentionItems.push({
            id: `att-conf-${idx}`,
            priority: "URGENT",
            type: "INTERVIEW_CONFLICT",
            title: `Interview Conflict: ${conf.reason}`,
            subtitle: `${conf.candidateName} at ${conf.time}`,
            actionLabel: "Resolve Conflict",
            actionHref: "/ta/interviews",
        });
    });

    // Requisition SLA alerts (URGENT / HIGH)
    enrichedRequisitions
        .filter((r) => r.health === "CRITICAL" || r.health === "AT_RISK")
        .forEach((r) => {
            const isBreach = r.daysRemaining < 0;
            attentionItems.push({
                id: `att-req-${r.id}`,
                priority: isBreach ? "URGENT" : "HIGH",
                type: "SLA_BREACH",
                title: `${r.title} (${r.clientName})`,
                subtitle: isBreach
                    ? `SLA breached by ${Math.abs(r.daysRemaining)} days · ${r.inPipeline} candidates in pipeline`
                    : `SLA breach in ${r.daysRemaining} days · ${r.remainingOpenings} openings remaining`,
                metric: `${r.filled}/${r.openings} Filled`,
                actionLabel: "View Requisition",
                actionHref: `/ta/requisitions?id=${r.id}`,
            });
        });

    // Pending client feedback > 18h (HIGH / URGENT)
    pendingFeedbackInterviews
        .filter((f) => f.slaStatus === "BREACHED" || (f.isClientRound && f.hoursPending > 18))
        .forEach((f) => {
            attentionItems.push({
                id: `att-fb-${f.id}`,
                priority: f.slaStatus === "BREACHED" ? "URGENT" : "HIGH",
                type: "FEEDBACK_OVERDUE",
                title: `${f.candidateName} — ${f.round.replaceAll("_", " ")}`,
                subtitle: `${f.clientName || f.interviewerName} feedback pending for ${f.hoursPending} hours`,
                actionLabel: "Request Feedback",
                actionHref: "/ta/interviews",
            });
        });

    // Overdue tasks (HIGH)
    orgTasks
        .filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) < todayStart)
        .slice(0, 3)
        .forEach((t) => {
            attentionItems.push({
                id: `att-tsk-${t.id}`,
                priority: "HIGH",
                type: "TASK_OVERDUE",
                title: t.title,
                subtitle: `Overdue since ${new Date(t.dueDate!).toLocaleDateString("en-IN")}`,
                actionLabel: "Complete Task",
                actionHref: "/ta/tasks",
            });
        });

    // Offer at risk (MEDIUM)
    offerPipeline.offersList
        .filter((o) => o.status === "AT_RISK")
        .forEach((o) => {
            attentionItems.push({
                id: `att-ofr-${o.applicationId}`,
                priority: "MEDIUM",
                type: "OFFER_RISK",
                title: `${o.candidateName} (${o.jobTitle})`,
                subtitle: `Offer sent ${o.daysSinceSent} days ago without acceptance`,
                actionLabel: "Review Candidate",
                actionHref: `/ta/pipeline?jobId=${o.candidateId}`,
            });
        });

    // Candidates stuck > 5 days (MEDIUM)
    stuckCandidates
        .filter((s) => s.daysInStage >= 5)
        .slice(0, 2)
        .forEach((s) => {
            attentionItems.push({
                id: `att-stk-${s.applicationId}`,
                priority: "MEDIUM",
                type: "STUCK_CANDIDATE",
                title: `${s.candidateName} stuck in ${s.stage.replaceAll("_", " ")}`,
                subtitle: `${s.daysInStage} days idle · Owner: ${s.recruiterName}`,
                actionLabel: "Follow Up",
                actionHref: "/ta/pipeline",
            });
        });

    // Sort attention by priority URGENT -> HIGH -> MEDIUM
    const priorityWeight: Record<string, number> = { URGENT: 3, HIGH: 2, MEDIUM: 1 };
    attentionItems.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    // 14. TEAM WORKLOAD MATRIX (Recruiter-wise operational metrics)
    const recruiterUsers = users.filter((u) => u.orgId === me.orgId && (u.role === "TA_RECRUITER" || u.role === "TA_MANAGER"));
    const teamWorkload = recruiterUsers.map((rec) => {
        const assignedJobs = jobs.filter((j) => j.assignedTas?.includes(rec.id) || j.primaryRecruiterId === rec.id);
        const recApps = applications.filter((a) => a.recruiterId === rec.id && a.orgId === me.orgId);
        const activeRecApps = recApps.filter((a) => ACTIVE_STAGES.includes(a.stage));
        const recTasks = tasks.filter((t) => t.assignedToId === rec.id && !t.completed);
        const recOverdue = recTasks.filter((t) => t.dueDate && new Date(t.dueDate) < todayStart).length;
        const recInterviews = enrichedInterviews.filter((i) => i.recruiterId === rec.id && i.status === "SCHEDULED").length;
        const recOffers = recApps.filter((a) => a.stage === "OFFER_SENT" || a.stage === "OFFER_ACCEPTED").length;

        return {
            id: rec.id,
            name: rec.name,
            role: rec.role,
            openingsCount: assignedJobs.reduce((s, j) => s + Math.max(0, (j.openings || 1) - (j.filled || 0)), 0),
            openReqs: assignedJobs.length,
            activeCandidates: activeRecApps.length,
            scheduledInterviews: recInterviews,
            pendingTasks: recTasks.length,
            overdueTasks: recOverdue,
            offers: recOffers,
        };
    });

    // 15. SOURCING CHANNEL PERFORMANCE
    const sources = ["LINKEDIN", "JOB_PORTAL", "DATABASE", "AGENT_REFERRAL", "WALK_IN", "OTHER"] as const;
    const sourcePerformance = sources.map((src) => {
        const srcCandidates = orgCandidates.filter((c) => c.source === src);
        const candIds = new Set(srcCandidates.map((c) => c.id));
        const srcApps = orgApps.filter((a) => candIds.has(a.candidateId));
        const qualified = srcCandidates.filter((c) => c.status === "QUALIFIED" || srcApps.some((a) => a.stage !== "SOURCED")).length;
        const interviewed = srcApps.filter((a) => ["TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT", "OFFER_ACCEPTED", "JOINED"].includes(a.stage)).length;
        const offers = srcApps.filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"].includes(a.stage)).length;
        const joined = srcApps.filter((a) => a.stage === "JOINED").length;

        return {
            source: src,
            label: src.replaceAll("_", " "),
            candidates: srcCandidates.length,
            qualified,
            interviewed,
            offers,
            joined,
            conversionPct: srcCandidates.length > 0 ? Math.round((joined / srcCandidates.length) * 100) : 0,
        };
    });

    // 16. CLIENT HEALTH OVERVIEW
    const clientHealth = clients.filter((c) => c.orgId === me.orgId).map((cl) => {
        const clJobs = jobs.filter((j) => j.clientId === cl.id && openJobStatuses.includes(j.status));
        const clApps = applications.filter((a) => clJobs.some((j) => j.id === a.jobId));
        const clInterviews = enrichedInterviews.filter((i) => i.clientName === cl.companyName && i.status === "SCHEDULED");
        const clOffers = clApps.filter((a) => a.stage === "OFFER_SENT" || a.stage === "OFFER_ACCEPTED").length;
        const clJoins = clApps.filter((a) => a.stage === "JOINED").length;
        const clFeedbackPending = pendingFeedbackInterviews.filter((f) => f.clientName === cl.companyName).length;

        let status: "HEALTHY" | "ATTENTION" | "DELAYED" = "HEALTHY";
        if (clFeedbackPending > 0 || clJobs.some((j) => j.priority === "URGENT" && clApps.length === 0)) {
            status = "DELAYED";
        } else if (clJobs.length > 3 && clApps.length < 5) {
            status = "ATTENTION";
        }

        return {
            id: cl.id,
            companyName: cl.companyName,
            industry: cl.industry,
            openReqs: clJobs.length,
            candidates: clApps.length,
            interviews: clInterviews.length,
            offers: clOffers,
            joins: clJoins,
            pendingFeedback: clFeedbackPending,
            status,
        };
    });

    // 17. RECENT RECRUITMENT ACTIVITY FEED
    const recruitmentActionKeywords = ["JOB", "STAGE", "INTERVIEW", "OFFER", "REFERRAL", "APPLICATION", "CANDIDATE"];
    const recentActivity = auditLogs
        .filter((l) => l.orgId === me.orgId && recruitmentActionKeywords.some((k) => l.action.includes(k) || l.entity.toUpperCase().includes(k)))
        .slice(0, 10)
        .map((l) => ({
            id: l.id,
            action: l.action,
            entity: l.entity,
            entityId: l.entityId,
            detail: l.detail,
            actorName: users.find((u) => u.id === l.actorUserId)?.name ?? "Recruitment Team",
            actorRole: l.actorRole,
            createdAt: l.createdAt,
        }));

    return NextResponse.json({
        user: {
            id: me.id,
            name: me.name,
            email: me.email,
            role: me.role,
        },
        kpis: {
            openRequisitions: openRequisitionsCount,
            openPositions: openPositionsCount,
            urgentRequisitionsCount,
            agingRequisitionsCount: agingRequisitions.length,
            inPipeline: inPipelineTotal,
            pipelineBreakdown: {
                interviews: interviewStageCount,
                clientRounds: clientRoundStageCount,
                offers: offerStageCount,
            },
            joinedTotal: totalJoinedPeriod,
            joinedTarget,
            joinedAchievedPct,
            interviewsToday: todayInterviews.length,
            pendingFeedbackCount,
            clientRoundTodayCount: todayInterviews.filter((i) => i.round === "CLIENT_ROUND").length,
            pendingTasks: pendingTasksList.length,
            tasksDueToday,
            tasksOverdue,
            tasksUpcoming,
            conversionRate,
            slaRiskCount: slaRiskTotal,
            slaRiskBreakdown: {
                requisitions: slaRiskRequisitionsCount,
                candidates: slaRiskCandidatesCount,
            },
            offerPipelineSummary: {
                total: offerPipeline.total,
                awaiting: offerPipeline.awaitingAcceptance,
                accepted: offerPipeline.accepted,
                atRisk: offerPipeline.atRisk,
            },
            feedbackBreakdown: {
                total: pendingFeedbackCount,
                interviewerCount: internalFeedbackPendingCount,
                clientCount: clientFeedbackPendingCount,
            },
        },
        attentionItems,
        pipeline: funnel,
        stuckCandidates,
        todayInterviews,
        interviewConflicts,
        pendingFeedback: pendingFeedbackInterviews,
        priorityRequisitions: enrichedRequisitions
            .sort((a, b) => Number(b.priority === "URGENT") - Number(a.priority === "URGENT") || a.daysRemaining - b.daysRemaining)
            .slice(0, 8),
        agingRequisitions: agingRequisitions.slice(0, 6),
        myTasks: orgTasks
            .filter((t) => !t.completed && (t.assignedToId === me.id || isManager))
            .slice(0, 6)
            .map((t) => ({
                ...t,
                assignedToName: users.find((u) => u.id === t.assignedToId)?.name ?? "Unassigned",
                createdByName: users.find((u) => u.id === t.createdById)?.name ?? "—",
            })),
        teamWorkload,
        offerPipeline,
        joiningTracker: joiningList.slice(0, 6),
        sourcePerformance,
        clientHealth,
        recentActivity,
        meta: {
            timestamp: now.toISOString(),
            appliedPeriod: period,
            appliedRecruiterId: recruiterId,
            appliedClientId: clientId,
        }
    });
}

function dateOnly(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
}
