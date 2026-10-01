import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, applications, jobs, clients, users, addAudit, addNotification } from "@/lib/mock/data";
import { nextCandidateCode } from "@/lib/fit";

const ELEVATED_ROLES = ["SUPER_ADMIN", "TA_MANAGER"];

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
    const stage = url.searchParams.get("stage");
    const source = url.searchParams.get("source");
    const status = url.searchParams.get("status");
    const blacklisted = url.searchParams.get("blacklisted");
    const minExp = url.searchParams.get("minExp");
    const maxExp = url.searchParams.get("maxExp");
    const maxCtc = url.searchParams.get("maxCtc");
    const maxNotice = url.searchParams.get("maxNotice");
    const location = (url.searchParams.get("location") ?? "").toLowerCase().trim();
    const skill = (url.searchParams.get("skill") ?? "").toLowerCase().trim();
    const recruiterId = url.searchParams.get("recruiterId");
    const filterPreset = url.searchParams.get("preset");

    let list = candidates.filter((c) => c.orgId === me.orgId).map((c) => {
        const apps = applications.filter((a) => a.candidateId === c.id && a.orgId === me.orgId);
        const activeApp = apps.find((a) => !["REJECTED", "BACKED_OUT"].includes(a.stage));
        const job = activeApp ? jobs.find((j) => j.id === activeApp.jobId) : undefined;
        const client = job ? clients.find((cl) => cl.id === job.clientId) : undefined;
        const assignedRecruiter = users.find((u) => u.id === (c.ownership?.assignedRecruiterId || activeApp?.recruiterId));

        return {
            ...c,
            referredByName: users.find((u) => u.id === c.referredByUserId)?.name ?? null,
            currentStage: activeApp?.stage ?? null,
            jobId: activeApp?.jobId ?? null,
            jobTitle: job?.title ?? null,
            clientId: client?.id ?? null,
            clientName: client?.companyName ?? null,
            applicationCount: apps.length,
            assignedRecruiterName: assignedRecruiter?.name ?? c.ownership?.assignedRecruiterName ?? "Unassigned",
            lastActivity: c.updatedAt || c.createdAt,
            nextFollowUp: c.communications?.[0]?.nextFollowUpDate || null,
        };
    });

    // Multi-Keyword & Fuzzy Search across all dimensions
    if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        list = list.filter((c) => {
            const searchableText = [
                c.name,
                c.email,
                c.phone,
                c.candidateCode,
                c.location,
                c.currentCompany ?? "",
                c.currentDesignation ?? "",
                c.previousCompany ?? "",
                c.headline ?? "",
                c.jobTitle ?? "",
                c.clientName ?? "",
                c.assignedRecruiterName ?? "",
                ...(c.skills || []),
                ...(c.tags || []),
                ...(c.primarySkills || []),
            ].join(" ").toLowerCase();

            return tokens.every((token) => searchableText.includes(token));
        });
    }

    // Filter Preset Shortcuts (Saved Views)
    if (filterPreset) {
        if (filterPreset === "urgent") {
            list = list.filter((c) => c.tags?.includes("Immediate Joiner") || c.noticePeriodDays <= 15);
        } else if (filterPreset === "available_immediately") {
            list = list.filter((c) => c.noticePeriodDays <= 15 || c.status === "AVAILABLE");
        } else if (filterPreset === "high_priority") {
            list = list.filter((c) => c.tags?.includes("High Priority") || c.rating >= 4);
        } else if (filterPreset === "followup_due") {
            list = list.filter((c) => c.nextFollowUp != null);
        } else if (filterPreset === "in_pipeline") {
            list = list.filter((c) => c.currentStage && !["REJECTED", "BACKED_OUT"].includes(c.currentStage));
        } else if (filterPreset === "blacklisted") {
            list = list.filter((c) => c.blacklisted);
        }
    }

    if (stage) {
        if (stage === "NONE") list = list.filter((c) => !c.currentStage);
        else if (stage !== "ALL") list = list.filter((c) => c.currentStage === stage);
    }
    if (source && source !== "ALL") list = list.filter((c) => c.source === source);
    if (status && status !== "ALL") list = list.filter((c) => c.status === status);
    if (blacklisted === "true") list = list.filter((c) => c.blacklisted);
    if (blacklisted === "false") list = list.filter((c) => !c.blacklisted);
    if (minExp) list = list.filter((c) => c.totalExperienceYears >= Number(minExp));
    if (maxExp) list = list.filter((c) => c.totalExperienceYears <= Number(maxExp));
    if (maxCtc) list = list.filter((c) => c.expectedCtcLpa <= Number(maxCtc));
    if (maxNotice) list = list.filter((c) => c.noticePeriodDays <= Number(maxNotice));
    if (location) list = list.filter((c) => (c.location || "").toLowerCase().includes(location));
    if (skill) list = list.filter((c) => c.skills?.some((s) => s.toLowerCase().includes(skill)));
    if (recruiterId && recruiterId !== "ALL") {
        list = list.filter((c) => c.ownership?.assignedRecruiterId === recruiterId);
    }

    return NextResponse.json(list);
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();

    // 1. Bulk Action Handler
    if (body.bulkAction && Array.isArray(body.candidateIds)) {
        const { bulkAction, candidateIds, payload } = body;
        if (["BLACKLIST", "RESTORE", "ASSIGN_RECRUITER"].includes(bulkAction) && !ELEVATED_ROLES.includes(me.role)) {
            return NextResponse.json({ error: "Only Super Admin or TA Manager can perform this action" }, { status: 403 });
        }
        const assignee = bulkAction === "ASSIGN_RECRUITER"
            ? users.find((u) => u.id === payload?.recruiterId && u.orgId === me.orgId && u.status === "ACTIVE")
            : undefined;
        if (bulkAction === "ASSIGN_RECRUITER" && !assignee) {
            return NextResponse.json({ error: "Recruiter not found in your organization" }, { status: 400 });
        }
        const targetCandidates = candidates.filter(
            (c) => candidateIds.includes(c.id) && c.orgId === me.orgId
        );

        let updatedCount = 0;
        targetCandidates.forEach((c) => {
            if (bulkAction === "BLACKLIST") {
                c.blacklisted = true;
                c.blacklistReason = payload?.reason || "Bulk blacklisted by admin";
            } else if (bulkAction === "RESTORE") {
                c.blacklisted = false;
                c.blacklistReason = null;
            } else if (bulkAction === "STATUS_CHANGE") {
                if (payload?.status) c.status = payload.status;
            } else if (bulkAction === "ADD_TAG") {
                if (payload?.tag && !c.tags?.includes(payload.tag)) {
                    c.tags = [...(c.tags || []), payload.tag];
                }
            } else if (bulkAction === "REMOVE_TAG") {
                if (payload?.tag) {
                    c.tags = (c.tags || []).filter((t) => t !== payload.tag);
                }
            } else if (bulkAction === "ASSIGN_RECRUITER") {
                if (assignee) {
                    c.ownership = {
                        ...(c.ownership || { taManagerName: "Amit Joshi", recruitmentTeam: "Enterprise Squad" }),
                        assignedRecruiterId: assignee.id,
                        assignedRecruiterName: assignee.name,
                        assignedAt: new Date().toISOString(),
                    };
                    // Ownership drives the pipeline: move the candidate's open applications too
                    applications
                        .filter((a) => a.candidateId === c.id && a.orgId === me.orgId && !["JOINED", "REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage))
                        .forEach((a) => { a.recruiterId = assignee.id; a.updatedAt = new Date().toISOString(); });
                }
            }
            c.updatedAt = new Date().toISOString();
            updatedCount++;
        });

        if (assignee && updatedCount > 0 && assignee.id !== me.id) {
            addNotification({
                orgId: me.orgId, userId: assignee.id,
                title: "Candidates assigned to you",
                message: `${me.name} assigned ${updatedCount} candidate(s) to you`,
                link: "/ta/pipeline",
            });
        }
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: `CANDIDATE_BULK_${bulkAction}`, entity: "Candidate", entityId: targetCandidates.map((c) => c.id).join(","),
            detail: `${bulkAction} applied to ${updatedCount} candidate(s)`,
        });

        return NextResponse.json({ success: true, updatedCount });
    }

    // 2. Candidate Merge Action
    if (body.mergeAction) {
        if (!ELEVATED_ROLES.includes(me.role)) {
            return NextResponse.json({ error: "Only Super Admin or TA Manager can merge candidates" }, { status: 403 });
        }
        const { primaryCandidateId, secondaryCandidateId } = body;
        if (primaryCandidateId === secondaryCandidateId) {
            return NextResponse.json({ error: "Cannot merge a candidate with itself" }, { status: 400 });
        }
        const primary = candidates.find((c) => c.id === primaryCandidateId && c.orgId === me.orgId);
        const secondary = candidates.find((c) => c.id === secondaryCandidateId && c.orgId === me.orgId);

        if (!primary || !secondary) {
            return NextResponse.json({ error: "One or both candidates not found" }, { status: 404 });
        }

        // Merge skills without duplicates
        const mergedSkills = Array.from(new Set([...(primary.skills || []), ...(secondary.skills || [])]));
        const mergedTags = Array.from(new Set([...(primary.tags || []), ...(secondary.tags || []), "Merged Profile"]));

        primary.skills = mergedSkills;
        primary.tags = mergedTags;
        if (!primary.alternatePhone && secondary.phone && secondary.phone !== primary.phone) {
            primary.alternatePhone = secondary.phone;
        }
        if (!primary.alternateEmail && secondary.email && secondary.email !== primary.email) {
            primary.alternateEmail = secondary.email;
        }
        if (!primary.resumeUrl && secondary.resumeUrl) primary.resumeUrl = secondary.resumeUrl;

        // Reassign applications from secondary to primary
        applications.forEach((app) => {
            if (app.candidateId === secondary.id && app.orgId === me.orgId) {
                app.candidateId = primary.id;
            }
        });

        // Mark secondary candidate as archived merged
        secondary.status = "ARCHIVED";
        secondary.tags = [...(secondary.tags || []), "Merged Duplicate"];
        secondary.updatedAt = new Date().toISOString();
        primary.updatedAt = new Date().toISOString();

        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "CANDIDATE_MERGED", entity: "Candidate", entityId: primary.id,
            detail: `Merged ${secondary.name} (${secondary.id}) into ${primary.name} (${primary.id})`,
        });

        return NextResponse.json({ success: true, primaryCandidate: primary });
    }

    // 3. Single Candidate Status / Blacklist Update
    if (!ELEVATED_ROLES.includes(me.role)) {
        return NextResponse.json({ error: "Only Super Admin or TA Manager can blacklist candidates" }, { status: 403 });
    }
    const { id, blacklisted, blacklistReason } = body;
    const candidate = candidates.find((c) => c.id === id && c.orgId === me.orgId);
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    candidate.blacklisted = Boolean(blacklisted);
    candidate.blacklistReason = blacklisted ? blacklistReason ?? "Administrative Blacklist" : null;
    candidate.updatedAt = new Date().toISOString();

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: candidate.blacklisted ? "CANDIDATE_BLACKLISTED" : "CANDIDATE_RESTORED", entity: "Candidate", entityId: candidate.id,
        detail: `${candidate.name}${candidate.blacklisted ? `: ${candidate.blacklistReason}` : ""}`,
    });

    return NextResponse.json(candidate);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { nextIds } = await import("@/lib/mock/data");

    const body = await request.json();

    // Duplicate Check Pre-flight
    if (body.checkDuplicate) {
        const email = String(body.email || "").toLowerCase().trim();
        const phone = String(body.phone || "").replace(/[^0-9]/g, "");

        const dup = candidates.find((c) => {
            if (c.orgId !== me.orgId) return false;
            const matchEmail = email && c.email.toLowerCase() === email;
            const cleanCandPhone = c.phone ? c.phone.replace(/[^0-9]/g, "") : "";
            const matchPhone = phone && cleanCandPhone && (cleanCandPhone.endsWith(phone) || phone.endsWith(cleanCandPhone));
            return matchEmail || matchPhone;
        });

        if (dup) {
            return NextResponse.json({
                isDuplicate: true,
                duplicateCandidate: {
                    id: dup.id,
                    name: dup.name,
                    candidateCode: dup.candidateCode,
                    email: dup.email,
                    phone: dup.phone,
                    currentCompany: dup.currentCompany,
                    currentDesignation: dup.currentDesignation,
                }
            });
        }
        return NextResponse.json({ isDuplicate: false });
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Valid name and email are required" }, { status: 400 });
    }

    const exists = candidates.find(
        (c) => c.orgId === me.orgId && c.email.toLowerCase() === email.toLowerCase()
    );
    if (exists && !body.ignoreDuplicate) {
        return NextResponse.json({ error: "Candidate already exists in database with this email", candidateId: exists.id }, { status: 409 });
    }

    const candidate = {
        id: nextIds.candidate(),
        candidateCode: nextCandidateCode(candidates, me.orgId),
        orgId: me.orgId,
        status: "NEW" as const,
        tags: ["New Lead", ...(body.immediateJoiner ? ["Immediate Joiner"] : [])],
        name,
        email,
        phone: body.phone ?? "",
        whatsappNumber: body.whatsappNumber ?? body.phone ?? "",
        currentCompany: body.currentCompany ?? null,
        currentDesignation: body.currentDesignation ?? null,
        previousCompany: body.previousCompany ?? null,
        totalExperienceYears: Number(body.totalExperienceYears) || 0,
        relevantExperienceYears: Number(body.relevantExperienceYears) || Number(body.totalExperienceYears) || 0,
        currentCtcLpa: Number(body.currentCtcLpa) || 0,
        expectedCtcLpa: Number(body.expectedCtcLpa) || 0,
        noticePeriodDays: Number(body.noticePeriodDays) || 30,
        location: body.location ?? "",
        headline: body.headline ?? `${body.currentDesignation || "Professional"} at ${body.currentCompany || "Company"}`,
        bio: body.bio ?? null,
        skills: Array.isArray(body.skills) ? body.skills : String(body.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        primarySkills: Array.isArray(body.skills) ? body.skills.slice(0, 3) : String(body.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 3),
        resumeUrl: body.resumeUrl ?? null,
        rating: Number(body.rating) || 3,
        source: (body.source || "DATABASE") as any,
        referredByUserId: body.referredByUserId || null,
        blacklisted: false,
        blacklistReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    candidates.push(candidate as any);

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "CANDIDATE_CREATED", entity: "Candidate", entityId: candidate.id,
        detail: `${candidate.name} added (source: ${candidate.source})`,
    });

    return NextResponse.json(candidate, { status: 201 });
}
