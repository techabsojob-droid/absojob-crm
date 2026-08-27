import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { jobs, clients, applications, candidates, interviews, tasks, users, ACTIVE_STAGES } from "@/lib/mock/data";

export async function GET() {
    const auth = await requireRole("TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const orgApps = applications.filter((a) => a.orgId === me.orgId);
    const myApps = orgApps.filter((a) => a.recruiterId === me.id);
    const myJobs = jobs.filter(
        (j) => j.orgId === me.orgId && (j.assignedTas.includes(me.id) || me.role === "TA_MANAGER")
    );
    const myTasks = tasks.filter((t) => t.assignedToId === me.id && !t.completed);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

    const upcomingInterviews = interviews
        .filter((i) => {
            if (i.orgId !== me.orgId || i.status !== "SCHEDULED") return false;
            const app = orgApps.find((a) => a.id === i.applicationId);
            return app && (app.recruiterId === me.id || me.role === "TA_MANAGER");
        })
        .filter((i) => new Date(i.scheduledAt) >= todayStart)
        .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
        .slice(0, 6)
        .map((i) => {
            const app = orgApps.find((a) => a.id === i.applicationId)!;
            const cand = candidates.find((c) => c.id === app.candidateId);
            const job = myJobs.find((j) => j.id === app.jobId);
            return {
                ...i,
                candidateName: cand?.name ?? "—",
                jobTitle: job?.title ?? "—",
                clientName: job ? clients.find((cl) => cl.id === job.clientId)?.companyName : null,
            };
        });

    const pipeline = ACTIVE_STAGES.map((stage) => ({
        stage,
        count: myApps.filter((a) => a.stage === stage).length,
    }));

    return NextResponse.json({
        kpis: {
            myRequisitions: myJobs.filter((j) => ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status)).length,
            openPositions: myJobs.reduce((s, j) => s + Math.max(0, j.openings - j.filled), 0),
            inPipeline: myApps.filter((a) => ACTIVE_STAGES.includes(a.stage)).length,
            joinedTotal: myApps.filter((a) => a.stage === "JOINED").length,
            pendingTasks: myTasks.length,
            interviewsToday: upcomingInterviews.filter((i) => new Date(i.scheduledAt) < todayEnd).length,
        },
        pipeline,
        urgentRequisitions: myJobs
            .filter((j) => ["APPROVED", "SOURCING", "INTERVIEWING"].includes(j.status))
            .sort((a, b) => Number(b.priority === "URGENT") - Number(a.priority === "URGENT"))
            .slice(0, 5)
            .map((j) => ({
                id: j.id,
                title: j.title,
                priority: j.priority,
                openings: j.openings,
                filled: j.filled,
                clientName: clients.find((c) => c.id === j.clientId)?.companyName ?? "—",
                inPipeline: orgApps.filter((a) => a.jobId === j.id && ACTIVE_STAGES.includes(a.stage)).length,
            })),
        upcomingInterviews,
        myTasks: myTasks.slice(0, 5).map((t) => ({ ...t, createdByName: users.find((u) => u.id === t.createdById)?.name ?? "—" })),
    });
}
