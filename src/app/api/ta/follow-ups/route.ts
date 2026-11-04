import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, callActivities, candidates, externalCalls, jobs, tasks, users } from "@/lib/mock/data";
import { isRecruitmentManager } from "@/lib/mock/pipeline";

const today = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};

// GET ?scope=mine|team&days=14 — open candidate follow-ups (overdue, today, upcoming) plus recently completed ones.
// Recruiters always see their own; team leads may pass scope=team.
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const q = new URL(request.url).searchParams;
    const team = q.get("scope") === "team" && isRecruitmentManager(me);
    const days = Math.min(90, Math.max(1, Number(q.get("days")) || 14));

    const t0 = today();
    const horizon = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    // Candidate follow-ups plus call-backs from outside-data calls (people not in the database yet)
    const followUps = tasks.filter((t) =>
        t.orgId === me.orgId && t.type === "FOLLOW_UP" && !!t.relatedId
        && (t.relatedType === "CANDIDATE" || (t.labels ?? []).includes("external-call"))
        && (team || t.assignedToId === me.id));

    const view = (t: (typeof tasks)[number]) => {
        if (t.relatedType !== "CANDIDATE") {
            const x = externalCalls.find((c) => c.id === t.relatedId);
            const job = x?.jobId ? jobs.find((j) => j.id === x.jobId) : undefined;
            return {
                id: t.id, key: t.key ?? null, title: t.title, description: t.description ?? null, dueDate: t.dueDate ?? null,
                status: t.status ?? (t.completed ? "DONE" : "TODO"), completed: t.completed, completedAt: t.completedAt ?? null,
                external: true, candidateId: x?.convertedCandidateId ?? null, candidateName: x?.personName ?? "—", candidatePhone: x?.phone ?? null,
                jobTitle: job?.title ?? null, applicationId: null,
                assigneeName: users.find((u) => u.id === t.assignedToId)?.name ?? "—",
                lastCall: x ? { calledAt: x.calledAt, callStatus: x.callStatus, nextAction: x.nextAction ?? null, remarks: x.remarks.slice(0, 160) } : null,
            };
        }
        const cand = candidates.find((c) => c.id === t.relatedId);
        const app = t.linkedApplicationId ? applications.find((a) => a.id === t.linkedApplicationId) : undefined;
        const job = app ? jobs.find((j) => j.id === app.jobId) : undefined;
        const lastCall = callActivities
            .filter((c) => c.candidateId === t.relatedId && c.orgId === me.orgId)
            .sort((a, b) => +new Date(b.calledAt) - +new Date(a.calledAt))[0];
        return {
            id: t.id, key: t.key ?? null, title: t.title, description: t.description ?? null, dueDate: t.dueDate ?? null,
            status: t.status ?? (t.completed ? "DONE" : "TODO"), completed: t.completed, completedAt: t.completedAt ?? null,
            external: false, candidateId: t.relatedId, candidateName: cand?.name ?? "—", candidatePhone: cand?.phone ?? null,
            jobTitle: job?.title ?? null, applicationId: app?.id ?? null,
            assigneeName: users.find((u) => u.id === t.assignedToId)?.name ?? "—",
            lastCall: lastCall ? { calledAt: lastCall.calledAt, callStatus: lastCall.callStatus, nextAction: lastCall.nextAction ?? null, remarks: lastCall.remarks.slice(0, 160) } : null,
        };
    };

    const open = followUps.filter((t) => !t.completed && t.dueDate).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
    const overdue = open.filter((t) => t.dueDate! < t0).map(view);
    const dueToday = open.filter((t) => t.dueDate === t0).map(view);
    const upcoming = open.filter((t) => t.dueDate! > t0 && t.dueDate! <= horizon).map(view);
    const completed = followUps
        .filter((t) => t.completed && t.completedAt)
        .sort((a, b) => +new Date(b.completedAt!) - +new Date(a.completedAt!))
        .slice(0, 10)
        .map(view);

    return NextResponse.json({ scope: team ? "team" : "mine", today: t0, overdue, dueToday, upcoming, completed });
}
