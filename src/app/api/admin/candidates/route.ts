import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, applications, jobs, clients, users } from "@/lib/mock/data";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const stage = url.searchParams.get("stage");

    let list = candidates.filter((c) => c.orgId === me.orgId).map((c) => {
        const apps = applications.filter((a) => a.candidateId === c.id);
        const activeApp = apps.find((a) => !["REJECTED", "BACKED_OUT"].includes(a.stage));
        const job = activeApp ? jobs.find((j) => j.id === activeApp.jobId) : undefined;
        const client = job ? clients.find((cl) => cl.id === job.clientId) : undefined;
        return {
            ...c,
            referredByName: users.find((u) => u.id === c.referredByUserId)?.name ?? null,
            currentStage: activeApp?.stage ?? null,
            jobId: activeApp?.jobId ?? null,
            jobTitle: job?.title ?? null,
            clientName: client?.companyName ?? null,
            applicationCount: apps.length,
        };
    });

    if (q) {
        list = list.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                c.skills.some((s) => s.toLowerCase().includes(q)) ||
                (c.currentCompany ?? "").toLowerCase().includes(q)
        );
    }
    if (stage) list = list.filter((c) => c.currentStage === stage);

    return NextResponse.json(list);
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, blacklisted, blacklistReason } = await request.json();
    const candidate = candidates.find((c) => c.id === id && c.orgId === me.orgId);
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    candidate.blacklisted = Boolean(blacklisted);
    candidate.blacklistReason = blacklisted ? blacklistReason ?? null : null;
    candidate.updatedAt = new Date().toISOString();

    return NextResponse.json(candidate);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { nextIds } = await import("@/lib/mock/data");

    const body = await request.json();
    const exists = candidates.find(
        (c) => c.orgId === me.orgId && c.email.toLowerCase() === String(body.email ?? "").toLowerCase()
    );
    if (exists) return NextResponse.json({ error: "Candidate already exists in database", candidateId: exists.id }, { status: 409 });

    const candidate = {
        id: nextIds.candidate(),
        candidateCode: `CAN-${Math.floor(1000 + Math.random() * 9000)}`,
        orgId: me.orgId,
        status: "NEW" as const,
        tags: ["New Lead"],
        name: body.name,
        email: body.email,
        phone: body.phone ?? "",
        currentCompany: body.currentCompany ?? null,
        currentDesignation: body.currentDesignation ?? null,
        totalExperienceYears: Number(body.totalExperienceYears) || 0,
        relevantExperienceYears: Number(body.relevantExperienceYears) || 0,
        currentCtcLpa: Number(body.currentCtcLpa) || 0,
        expectedCtcLpa: Number(body.expectedCtcLpa) || 0,
        noticePeriodDays: Number(body.noticePeriodDays) || 30,
        location: body.location ?? "",
        skills: Array.isArray(body.skills) ? body.skills : String(body.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        resumeUrl: null,
        rating: 3,
        source: "DATABASE" as const,
        referredByUserId: null,
        blacklisted: false,
        blacklistReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    candidates.push(candidate);

    return NextResponse.json(candidate, { status: 201 });
}
