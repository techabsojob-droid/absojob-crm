import type { Candidate, JobRequisition } from "@/lib/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.]/g, "");

/**
 * How well a candidate matches a requisition, 0–100:
 * skills 60 (share of the job's skills the candidate lists), experience 25, salary 15.
 */
export function fitScore(c: Pick<Candidate, "skills" | "totalExperienceYears" | "expectedCtcLpa">, j: Pick<JobRequisition, "skills" | "experienceMinYears" | "experienceMaxYears" | "salaryMaxLpa">): number {
    const have = new Set((c.skills ?? []).map(norm));
    const want = (j.skills ?? []).map(norm).filter(Boolean);
    const skills = want.length ? want.filter((s) => have.has(s)).length / want.length : 0.5;

    const exp = c.totalExperienceYears ?? 0;
    const min = j.experienceMinYears ?? 0, max = j.experienceMaxYears || Math.max(min, exp);
    const gap = exp < min ? min - exp : exp > max ? exp - max : 0;
    const experience = Math.max(0, 1 - gap / 3); // each year outside the band costs a third

    const budget = j.salaryMaxLpa ?? 0, ask = c.expectedCtcLpa ?? 0;
    const salary = !budget || !ask || ask <= budget ? 1 : Math.max(0, 1 - (ask - budget) / budget);

    return Math.round(skills * 60 + experience * 25 + salary * 15);
}

/** Next sequential candidate code for an org, e.g. CAN-0014. */
export function nextCandidateCode(list: Pick<Candidate, "orgId" | "candidateCode">[], orgId: string): string {
    const max = list
        .filter((c) => c.orgId === orgId)
        .reduce((m, c) => Math.max(m, Number(c.candidateCode?.replace(/\D/g, "")) || 0), 0);
    return `CAN-${String(max + 1).padStart(4, "0")}`;
}

/** Share of the profile fields recruiters rely on that are filled in, 0–100. */
export function profileCompleteness(c: Partial<Candidate>): { score: number; missing: string[] } {
    const checks: [string, boolean][] = [
        ["Email", !!c.email],
        ["Phone", !!c.phone],
        ["Location", !!(c.location || c.currentCity)],
        ["Current company", !!c.currentCompany],
        ["Current designation", !!c.currentDesignation],
        ["At least 3 skills", (c.skills?.length ?? 0) >= 3],
        ["Resume", !!c.resumeUrl],
        ["Education", (c.education?.length ?? 0) > 0],
        ["Work history", (c.workExperience?.length ?? 0) > 0],
        ["LinkedIn", !!c.linkedinUrl],
        ["Expected CTC", (c.expectedCtcLpa ?? 0) > 0],
        ["Notice period", c.noticePeriodDays != null],
    ];
    const missing = checks.filter(([, ok]) => !ok).map(([k]) => k);
    return { score: Math.round(((checks.length - missing.length) / checks.length) * 100), missing };
}
