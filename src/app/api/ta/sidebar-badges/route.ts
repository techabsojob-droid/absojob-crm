import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { jobs, applications, interviews, tasks, candidates, approvals, dataQualityIssues, expenses, payrollRecords } from "@/lib/mock/data";
import { financeSnapshot } from "@/lib/mock/finance";
import { canWorkOnApplication } from "@/lib/mock/pipeline";

export async function GET() {
    const auth = await requireRole("TA_MANAGER", "TA_RECRUITER", "SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const isManager = me.role === "TA_MANAGER" || me.role === "SUPER_ADMIN";

    const orgJobs = jobs.filter((j) => j.orgId === me.orgId && (isManager || j.assignedTas?.includes(me.id) || j.primaryRecruiterId === me.id));
    const orgApps = applications.filter((a) => canWorkOnApplication(me, a));
    const appIds = new Set(orgApps.map((a) => a.id));
    const orgInterviews = interviews.filter((i) => i.orgId === me.orgId && appIds.has(i.applicationId));
    const orgTasks = tasks.filter((t) => t.orgId === me.orgId && (isManager || t.assignedToId === me.id));

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

    // 1. Urgent Requisitions count
    const urgentRequisitions = orgJobs.filter((j) =>
        ["APPROVED", "SOURCING", "INTERVIEWING"].includes(j.status) && j.priority === "URGENT"
    ).length;

    // 2. Pipeline candidates requiring action (stuck > 3 days or client round)
    const pipelineActionNeeded = orgApps.filter((a) => {
        if (["REJECTED", "JOINED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)) return false;
        const daysInStage = Math.floor((now.getTime() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);
        return daysInStage >= 3 || a.stage === "CLIENT_ROUND" || a.stage === "OFFER_SENT";
    }).length;

    // 3. Candidates: new candidates added today
    const candidatesCount = candidates.filter((c) => {
        if (c.orgId !== me.orgId) return false;
        const dt = new Date(c.createdAt);
        return dt >= todayStart && dt < todayEnd;
    }).length;

    // 4. Interviews scheduled for today
    const interviewsToday = orgInterviews.filter((i) => {
        const dt = new Date(i.scheduledAt);
        return dt >= todayStart && dt < todayEnd && ["SCHEDULED", "RESCHEDULED"].includes(i.status);
    }).length;

    // 5. Tasks due today or overdue
    const pendingTasks = orgTasks.filter((t) => !t.completed);
    const tasksDueToday = pendingTasks.filter((t) => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < todayEnd;
    }).length;

    const tasksOverdue = pendingTasks.filter((t) => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < todayStart;
    }).length;

    const approvalTypes: Record<string, string[] | "*"> = {
        SUPER_ADMIN: "*",
        TA_MANAGER: ["JOB_REQUISITION", "OFFER_APPROVAL", "CANDIDATE_EXCEPTION"],
        HR_ADMIN: ["SALARY_EXCEPTION", "USER_ACCESS", "EXPENSE_APPROVAL"],
    };
    const mineTypes = approvalTypes[me.role] ?? [];
    const pendingApprovals = approvals.filter(
        (a) => a.orgId === me.orgId && a.status === "PENDING" && (mineTypes === "*" || mineTypes.includes(a.type))
    ).length;
    const openDataIssues = me.role === "SUPER_ADMIN"
        ? dataQualityIssues.filter((d) => d.orgId === me.orgId).length
        : 0;

    const isFin = me.role === "SUPER_ADMIN" || me.role === "FINANCE_ADMIN";
    const fin = isFin ? financeSnapshot(me.orgId) : null;

    // Real counts only — null hides the badge
    return NextResponse.json({
        overdueInvoices: fin?.overdue.length || null,
        toBill: fin?.toBill.length || null,
        expensesPending: isFin ? expenses.filter((e) => e.orgId === me.orgId && e.status === "PENDING").length || null : null,
        payrollAwaiting: isFin ? new Set(payrollRecords.filter((p) => p.orgId === me.orgId && p.status === "PROCESSED").map((p) => p.month)).size || null : null,
        requisitions: urgentRequisitions || null,
        pipeline: pipelineActionNeeded || null,
        candidates: candidatesCount || null,
        interviews: interviewsToday || null,
        tasks: tasksDueToday || null,
        approvals: pendingApprovals || null,
        dataQuality: openDataIssues || null,
        hasOverdueTasks: tasksOverdue > 0,
        hasSlaBreach: urgentRequisitions > 0,
    });
}
