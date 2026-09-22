import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    referrals, candidates, jobs, clients, users, addAudit, addNotification, nextIds,
} from "@/lib/mock/data";

export async function GET() {
    const auth = await requireRole("AGENT", "EMPLOYEE", "SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    // Agents see their own; super admin sees all org referrals
    const list = referrals
        .filter((r) => r.orgId === me.orgId && (me.role === "AGENT" || me.role === "EMPLOYEE" ? r.agentId === me.id : true))
        .map((r) => {
            const cand = candidates.find((c) => c.id === r.candidateId);
            const job = r.jobId ? jobs.find((j) => j.id === r.jobId) : undefined;
            return {
                ...r,
                candidateName: cand?.name ?? "—",
                candidateEmail: cand?.email ?? "",
                candidatePhone: cand?.phone ?? "",
                currentCompany: cand?.currentCompany ?? null,
                totalExperienceYears: cand?.totalExperienceYears ?? 0,
                skills: cand?.skills ?? [],
                jobTitle: job?.title ?? null,
                clientName: job ? clients.find((c) => c.id === job.clientId)?.companyName ?? null : null,
                agentName: users.find((u) => u.id === r.agentId)?.name ?? "—",
            };
        })
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const stats = {
        total: list.length,
        shortlisted: list.filter((r) => ["SHORTLISTED", "HIRED"].includes(r.status)).length,
        hired: list.filter((r) => r.status === "HIRED").length,
        earned: list.filter((r) => r.incentivePaid).reduce((s, r) => s + r.incentiveAmount, 0),
        pending: list.filter((r) => r.status === "HIRED" && !r.incentivePaid).reduce((s, r) => s + r.incentiveAmount, 0),
    };

    return NextResponse.json({ referrals: list, stats });
}

// Submit a new referral (creates candidate if new, links to optional job)
export async function POST(request: Request) {
    const auth = await requireRole("AGENT", "EMPLOYEE");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.name || !body.email || !body.phone) {
        return NextResponse.json({ error: "name, email and phone are required" }, { status: 400 });
    }

    let candidate = candidates.find(
        (c) => c.orgId === me.orgId && c.email.toLowerCase() === String(body.email).toLowerCase()
    );
    let isNew = false;
    if (!candidate) {
        isNew = true;
        candidate = {
            id: nextIds.candidate(),
            candidateCode: `CAN-${Math.floor(1000 + Math.random() * 9000)}`,
            orgId: me.orgId,
            status: "NEW" as const,
            tags: ["Referral", "Pending Review"],
            name: body.name,
            email: body.email,
            phone: body.phone,
            currentCompany: body.currentCompany ?? null,
            currentDesignation: body.currentDesignation ?? null,
            totalExperienceYears: Number(body.totalExperienceYears) || 0,
            relevantExperienceYears: Number(body.relevantExperienceYears) || 0,
            currentCtcLpa: Number(body.currentCtcLpa) || 0,
            expectedCtcLpa: Number(body.expectedCtcLpa) || 0,
            noticePeriodDays: Number(body.noticePeriodDays) || 30,
            location: body.location ?? "",
            skills: String(body.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
            resumeUrl: null,
            rating: 3,
            source: "AGENT_REFERRAL",
            referredByUserId: me.id,
            blacklisted: false,
            blacklistReason: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        candidates.push(candidate);
    } else if (candidate.blacklisted) {
        return NextResponse.json({ error: "This candidate is blacklisted and cannot be referred." }, { status: 409 });
    }

    // duplicate referral guard — same candidate already referred by this agent
    const dupRef = referrals.find((r) => r.agentId === me.id && r.candidateId === candidate!.id);
    if (dupRef) {
        return NextResponse.json({ error: "You have already referred this candidate.", referralId: dupRef.id }, { status: 409 });
    }

    const referral = {
        id: nextIds.referral(),
        orgId: me.orgId,
        agentId: me.id,
        candidateId: candidate.id,
        jobId: body.jobId || null,
        status: "SUBMITTED" as const,
        incentiveAmount: 0,
        incentivePaid: false,
        reviewNotes: isNew ? null : `Existing database candidate re-referred.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    referrals.push(referral);

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "REFERRAL_SUBMITTED", entity: "Referral", entityId: referral.id,
        detail: `${me.name} referred ${candidate.name}`,
    });

    // notify TAs
    for (const ta of users.filter((u) => u.orgId === me.orgId && u.role.startsWith("TA_") && u.status === "ACTIVE")) {
        addNotification({
            orgId: me.orgId,
            userId: ta.id,
            title: "New referral to review",
            message: `${me.name} referred ${candidate.name}${referral.jobId ? ` for ${jobs.find((j) => j.id === referral.jobId)?.title}` : ""}`,
            link: "/ta/candidates",
        });
    }
    addNotification({
        orgId: me.orgId,
        userId: me.id,
        title: "Referral submitted ✅",
        message: `${candidate.name} is now under review. You will be notified on status change.`,
        link: "/portal/referrals",
    });

    return NextResponse.json(referral, { status: 201 });
}
