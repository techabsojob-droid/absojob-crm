import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, candidates } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { CLOSED_STAGES } from "@/lib/types";
import { extractResumeText, parseResumeText, ResumeParseError, RESUME_MAX_BYTES } from "@/lib/resume/parse";

export const runtime = "nodejs";

const lastTen = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);

// POST { name, mimeType, dataBase64, jobId? } → fields read from the resume + any existing candidate with the same email / phone.
// The file is only read here; it is stored when the recruiter saves the candidate. Resume text is never stored or returned.
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);

    const data = String(b.dataBase64 ?? "").replace(/^data:[^;]+;base64,/, "");
    if (!b.name || !data) return bad("Choose a resume file");
    if (Math.floor((data.length * 3) / 4) > RESUME_MAX_BYTES) return bad("Resume is larger than 5 MB");

    let text: string;
    let pages: number | null;
    try {
        ({ text, pages } = await extractResumeText(Buffer.from(data, "base64"), String(b.mimeType ?? "")));
    } catch (e) {
        if (e instanceof ResumeParseError) return bad(e.message, 422);
        console.error("[resume] extraction failed:", e instanceof Error ? e.message : e);
        return bad("Could not read this resume. Please fill in the details manually.", 422);
    }
    if (text.replace(/\s/g, "").length < 40) {
        return bad("No readable text found — this looks like a scanned image. Please fill in the details manually.", 422);
    }

    const fields = parseResumeText(text);

    // Possible duplicates in this workspace (same email or same 10-digit phone)
    const phone10 = lastTen(fields.phone);
    const matches = candidates
        .filter((c) => c.orgId === me.orgId && !c.archived)
        .filter((c) => (fields.email && c.email?.toLowerCase() === fields.email) || (phone10.length === 10 && lastTen(c.phone) === phone10))
        .slice(0, 3)
        .map((c) => {
            const apps = applications.filter((a) => a.candidateId === c.id && a.orgId === me.orgId);
            return {
                id: c.id, candidateCode: c.candidateCode, name: c.name, email: c.email, phone: c.phone,
                currentCompany: c.currentCompany ?? null, currentDesignation: c.currentDesignation ?? null,
                matchedOn: [fields.email && c.email?.toLowerCase() === fields.email ? "email" : null, phone10.length === 10 && lastTen(c.phone) === phone10 ? "phone" : null].filter(Boolean),
                inThisJob: !!b.jobId && apps.some((a) => a.jobId === b.jobId && !CLOSED_STAGES.includes(a.stage)),
                activeApplications: apps.filter((a) => !CLOSED_STAGES.includes(a.stage) && a.stage !== "JOINED").length,
            };
        });

    // Form fields the parser could not find, so the UI can flag them for manual entry
    const missing = (["name", "email", "phone", "location", "currentCompany", "currentDesignation", "totalExperienceYears", "relevantExperienceYears", "noticePeriodDays", "currentCtcLpa", "expectedCtcLpa", "highestQualification", "linkedinUrl"] as const)
        .filter((k) => fields[k] === null || fields[k] === "")
        .concat(fields.skills.length ? [] : ["skills" as never]);

    return NextResponse.json({ fields, missing, matches, pages });
}
