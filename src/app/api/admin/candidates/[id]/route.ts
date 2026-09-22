import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, applications, interviews, jobs, clients, users, referrals } from "@/lib/mock/data";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id } = await params;
    const candidate = candidates.find((c) => c.id === id && (me.role === "SUPER_ADMIN" || c.orgId === me.orgId));
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    // All applications for this candidate
    const candApps = applications.filter((a) => a.candidateId === id);

    const enrichedApps = candApps.map((app) => {
        const job = jobs.find((j) => j.id === app.jobId);
        const client = job ? clients.find((c) => c.id === job.clientId) : undefined;
        const recruiter = users.find((u) => u.id === app.recruiterId);
        const appInterviews = interviews.filter((i) => i.applicationId === app.id);

        return {
            ...app,
            jobTitle: job?.title ?? "—",
            jobDepartment: job?.department ?? "—",
            jobLocation: job?.location ?? "—",
            jobEmploymentType: job?.employmentType ?? "—",
            salaryMinLpa: job?.salaryMinLpa ?? 0,
            salaryMaxLpa: job?.salaryMaxLpa ?? 0,
            clientName: client?.companyName ?? "—",
            clientIndustry: client?.industry ?? "—",
            recruiterName: recruiter?.name ?? "—",
            recruiterRole: recruiter?.role ?? "—",
            interviews: appInterviews.map((i) => ({
                ...i,
                recruiterName: users.find((u) => u.id === i.createdBy)?.name ?? "—",
            })),
        };
    });

    // Referral info if any
    const referral = referrals.find((r) => r.candidateId === id);
    const referredByUser = candidate.referredByUserId
        ? users.find((u) => u.id === candidate.referredByUserId)
        : undefined;
    const referralJob = referral?.jobId ? jobs.find((j) => j.id === referral.jobId) : undefined;

    // Build full interview list across all applications
    const allInterviews = enrichedApps.flatMap((a) =>
        a.interviews.map((i) => ({
            ...i,
            jobTitle: a.jobTitle,
            clientName: a.clientName,
            applicationStage: a.stage,
        }))
    );

    // Timeline events — reconstruct full journey
    const timeline: { date: string; type: string; title: string; detail: string; icon: string }[] = [];

    // Added to system
    timeline.push({
        date: candidate.createdAt,
        type: "ADDED",
        title: "Added to Database",
        detail: sourceLabel(candidate.source, referredByUser?.name),
        icon: "USER_PLUS",
    });

    // Each application event
    candApps.forEach((app) => {
        const job = jobs.find((j) => j.id === app.jobId);
        const client = job ? clients.find((c) => c.id === job.clientId) : undefined;
        const label = `${job?.title ?? "Position"} @ ${client?.companyName ?? "Company"}`;

        timeline.push({
            date: app.createdAt,
            type: "APPLIED",
            title: `Added to Pipeline`,
            detail: label,
            icon: "BRIEFCASE",
        });

        // Stage moves (approximate via updatedAt)
        if (!["SOURCED", "REJECTED", "BACKED_OUT"].includes(app.stage)) {
            timeline.push({
                date: app.updatedAt,
                type: "STAGE_MOVE",
                title: `Stage: ${app.stage.replaceAll("_", " ")}`,
                detail: label,
                icon: "ARROW_RIGHT",
            });
        }
        if (app.stage === "JOINED" && app.actualJoinDate) {
            timeline.push({
                date: app.actualJoinDate,
                type: "JOINED",
                title: "Candidate Joined",
                detail: `${label} — Placed successfully`,
                icon: "CHECK_CIRCLE",
            });
        }
        if (app.stage === "REJECTED") {
            timeline.push({
                date: app.updatedAt,
                type: "REJECTED",
                title: "Application Rejected",
                detail: app.rejectionReason ?? label,
                icon: "X_CIRCLE",
            });
        }
    });

    // Interview events
    allInterviews.forEach((i) => {
        timeline.push({
            date: i.scheduledAt,
            type: "INTERVIEW",
            title: `Interview: ${i.round.replaceAll("_", " ")}`,
            detail: `${i.interviewerName} · ${i.mode} · ${i.status}${i.score ? ` · Score ${i.score}/10` : ""}`,
            icon: "CALENDAR",
        });
    });

    // Sort timeline newest first
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Stats summary
    const totalInterviews = allInterviews.length;
    const completedInterviews = allInterviews.filter((i) => i.status === "COMPLETED").length;
    const avgScore = completedInterviews > 0
        ? Math.round(
            (allInterviews
                .filter((i) => i.score != null)
                .reduce((s, i) => s + (i.score ?? 0), 0) /
                allInterviews.filter((i) => i.score != null).length) * 10
        ) / 10
        : null;

    const activeApp = candApps.find((a) => !["REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage));
    const activeJob = activeApp ? jobs.find((j) => j.id === activeApp.jobId) : undefined;
    const activeClient = activeJob ? clients.find((c) => c.id === activeJob.clientId) : undefined;

    return NextResponse.json({
        candidate,
        referredByUser: referredByUser
            ? { id: referredByUser.id, name: referredByUser.name, role: referredByUser.role, email: referredByUser.email }
            : null,
        referral: referral
            ? { ...referral, jobTitle: referralJob?.title ?? null }
            : null,
        applications: enrichedApps,
        allInterviews,
        timeline,
        stats: {
            totalApplications: candApps.length,
            activeApplications: candApps.filter((a) => !["REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)).length,
            totalInterviews,
            completedInterviews,
            avgInterviewScore: avgScore,
            currentStage: activeApp?.stage ?? null,
            activeJobTitle: activeJob?.title ?? null,
            activeClientName: activeClient?.companyName ?? null,
            daysInSystem: Math.floor((Date.now() - new Date(candidate.createdAt).getTime()) / 86400000),
        },
    });
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id } = await params;
    const candidate = candidates.find((c) => c.id === id && (me.role === "SUPER_ADMIN" || c.orgId === me.orgId));
    if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const allowed = [
        "name", "email", "alternateEmail", "phone", "alternatePhone", "whatsappNumber",
        "gender", "dateOfBirth", "nationality", "maritalStatus",
        "currentCity", "currentState", "currentCountry", "permanentAddress", "pinCode",
        "location", "currentCompany", "currentDesignation", "previousCompany",
        "totalExperienceYears", "relevantExperienceYears", "industry", "functionalArea",
        "employmentType", "seniorityLevel", "status", "tags",
        "currentCtcLpa", "expectedCtcLpa", "noticePeriodDays",
        "skills", "primarySkills", "secondarySkills", "detailedSkills", "certifications",
        "bio", "headline", "workExperience", "education",
        "preferences", "compensationDetails", "availabilityDetails",
        "documents", "communications", "notes", "screeningEvaluation",
        "referenceChecks", "compliance", "ownership",
        "linkedinUrl", "githubUrl", "portfolioUrl", "websiteUrl",
        "rating", "blacklisted", "blacklistReason", "resumeUrl", "profileCompletionScore",
    ];
    allowed.forEach((k) => {
        if (body[k] !== undefined) (candidate as any)[k] = body[k];
    });

    // Append new note or communication if submitted
    if (body.newNote) {
        if (!candidate.notes) candidate.notes = [];
        candidate.notes.unshift({
            id: `not-${Date.now()}`,
            category: body.newNote.category || "General",
            text: body.newNote.text,
            authorName: me.name,
            isPrivate: Boolean(body.newNote.isPrivate),
            createdAt: new Date().toISOString(),
        });
    }

    if (body.newCommunication) {
        if (!candidate.communications) candidate.communications = [];
        candidate.communications.unshift({
            id: `comm-${Date.now()}`,
            type: body.newCommunication.type || "PHONE",
            direction: body.newCommunication.direction || "OUTGOING",
            subject: body.newCommunication.subject,
            message: body.newCommunication.message,
            outcome: body.newCommunication.outcome || "Connected",
            nextFollowUpDate: body.newCommunication.nextFollowUpDate,
            createdByName: me.name,
            createdAt: new Date().toISOString(),
        });
    }

    candidate.updatedAt = new Date().toISOString();

    return NextResponse.json(candidate);
}

function sourceLabel(source: string, referrerName?: string | null): string {
    const map: Record<string, string> = {
        AGENT_REFERRAL: referrerName ? `Referred by ${referrerName}` : "Agent Referral",
        JOB_PORTAL: "Job Portal (Naukri / Indeed)",
        LINKEDIN: "LinkedIn Sourcing",
        WALK_IN: "Walk-In",
        DATABASE: "Bulk Database Import",
        CAMPUS: "Campus Hiring",
        OTHER: "Other Source",
    };
    return map[source] ?? source;
}
