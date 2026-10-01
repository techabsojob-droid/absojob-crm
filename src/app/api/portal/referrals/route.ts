import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { nextCandidateCode } from "@/lib/fit";
import {
    referrals, candidates, jobs, clients, users, applications, storedFiles, referralMessages, addAudit, addNotification, nextIds,
} from "@/lib/mock/data";
import { fileUrl, MAX_FILE_BYTES } from "@/lib/mock/finance";
import { agentStats } from "@/lib/mock/recruiter";

const RESUME_MIME = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
// A partner "owns" a candidate for this many days after referring them
const OWNERSHIP_DAYS = 90;

export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    // "My Referrals": everyone sees only the referrals they submitted (TA reviews them under /ta/referrals)
    const list = referrals
        .filter((r) => r.orgId === me.orgId && r.agentId === me.id)
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
                stage: applications.find((a) => a.candidateId === r.candidateId && (!r.jobId || a.jobId === r.jobId))?.stage ?? null,
                messages: referralMessages.filter((m) => m.referralId === r.id).length,
                resumeUrl: r.resumeFileId ? fileUrl(r.resumeFileId) : null,
            };
        })
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const s = agentStats(me.id);
    const stats = {
        conversion: s.conversion,
        potential: s.potential,
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
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON, validated field by field below
    let body: Record<string, any>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    body.name = String(body.name ?? "").trim();
    body.email = String(body.email ?? "").trim().toLowerCase();
    body.phone = String(body.phone ?? "").trim();
    if (!body.name || !body.email || !body.phone) {
        return NextResponse.json({ error: "name, email and phone are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return NextResponse.json({ error: "Enter a valid candidate email" }, { status: 400 });
    if (body.phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Enter a valid candidate mobile number" }, { status: 400 });
    // Candidate's consent to be represented is mandatory (DPDP)
    if (!body.consent) return NextResponse.json({ error: "Confirm that the candidate has agreed to be referred" }, { status: 400 });
    for (const k of ["totalExperienceYears", "currentCtcLpa", "expectedCtcLpa", "noticePeriodDays"]) {
        if (body[k] !== undefined && body[k] !== "" && (!Number.isFinite(Number(body[k])) || Number(body[k]) < 0 || Number(body[k]) > 500)) {
            return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
        }
    }
    let resume: { name: string; mimeType: string; data: string; size: number } | null = null;
    if (body.resume?.dataBase64) {
        const data = String(body.resume.dataBase64).replace(/^data:[^;]+;base64,/, "");
        const size = Math.floor((data.length * 3) / 4);
        if (!RESUME_MIME.includes(body.resume.mimeType)) return NextResponse.json({ error: "Resume must be PDF or Word" }, { status: 400 });
        if (size > MAX_FILE_BYTES) return NextResponse.json({ error: "Resume is larger than 5 MB" }, { status: 400 });
        resume = { name: String(body.resume.name ?? "resume.pdf").slice(0, 120), mimeType: body.resume.mimeType, data, size };
    } else if (me.role === "AGENT") {
        return NextResponse.json({ error: "Attach the candidate's resume" }, { status: 400 });
    }

    if (body.jobId && !jobs.some((j) => j.id === body.jobId && j.orgId === me.orgId && !["CLOSED", "CANCELLED", "FULFILLED"].includes(j.status))) {
        return NextResponse.json({ error: "Selected job is not open" }, { status: 400 });
    }

    let candidate = candidates.find(
        (c) => c.orgId === me.orgId && c.email.toLowerCase() === String(body.email).toLowerCase()
    );
    let isNew = false;
    if (!candidate) {
        isNew = true;
        candidate = {
            id: nextIds.candidate(),
            candidateCode: nextCandidateCode(candidates, me.orgId),
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

    // Ownership: another referrer's active claim on this candidate blocks a new referral
    const claim = referrals.find((r) => r.candidateId === candidate!.id && r.agentId !== me.id && r.status !== "REJECTED" && Date.now() - +new Date(r.createdAt) < OWNERSHIP_DAYS * 86400000);
    if (claim) {
        return NextResponse.json({ error: "This candidate was already referred by another partner and is under their ownership." }, { status: 409 });
    }
    if (!isNew && applications.some((a) => a.candidateId === candidate!.id && !["REJECTED", "BACKED_OUT", "JOINED"].includes(a.stage))) {
        return NextResponse.json({ error: "This candidate is already in an active hiring process with us." }, { status: 409 });
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
        candidateConsent: true,
        agentNotes: String(body.agentNotes ?? body.notes ?? "").trim().slice(0, 1000) || null,
        resumeFileId: null as string | null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    if (resume) {
        const fileId = `file-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
        storedFiles.push({ id: fileId, orgId: me.orgId, name: resume.name, mimeType: resume.mimeType, size: resume.size, dataBase64: resume.data, ownerUserId: me.id, purpose: "resume", createdAt: new Date().toISOString() });
        referral.resumeFileId = fileId;
        candidate.documents = [{ id: `cdoc-${crypto.randomUUID().slice(0, 8)}`, name: resume.name, type: "RESUME", fileUrl: fileUrl(fileId), fileSizeKb: Math.ceil(resume.size / 1024), version: Math.max(0, ...(candidate.documents ?? []).filter((d) => d.type === "RESUME").map((d) => d.version)) + 1, uploadedBy: `${me.name} (referral)`, uploadDate: new Date().toISOString(), verified: false }, ...(candidate.documents ?? [])];
        if (!candidate.resumeUrl) candidate.resumeUrl = fileUrl(fileId);
    }
    referrals.push(referral);

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "REFERRAL_SUBMITTED", entity: "Referral", entityId: referral.id,
        detail: `${me.name} referred ${candidate.name}`,
    });

    // Notify TA managers and the recruiters working the referred job
    const refJob = referral.jobId ? jobs.find((j) => j.id === referral.jobId) : undefined;
    const reviewers = new Set<string>(
        users.filter((u) => u.orgId === me.orgId && u.role === "TA_MANAGER" && u.status === "ACTIVE").map((u) => u.id)
    );
    [...(refJob?.assignedTas || []), ...(refJob?.primaryRecruiterId ? [refJob.primaryRecruiterId] : [])].forEach((id) => reviewers.add(id));
    reviewers.delete(me.id);
    reviewers.forEach((userId) => {
        addNotification({
            orgId: me.orgId,
            userId,
            title: "New referral to review",
            message: `${me.name} referred ${candidate!.name}${refJob ? ` for ${refJob.title}` : ""}`,
            link: "/ta/referrals",
        });
    });
    addNotification({
        orgId: me.orgId,
        userId: me.id,
        title: "Referral submitted ✅",
        message: `${candidate.name} is now under review. You will be notified on status change.`,
        link: "/portal/referrals",
    });

    return NextResponse.json(referral, { status: 201 });
}
