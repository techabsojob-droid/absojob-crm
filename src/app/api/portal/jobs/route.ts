import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { jobs, clients, referrals } from "@/lib/mock/data";
import { referralIncentiveFor } from "@/lib/mock/pipeline";

const OPEN = ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE"];

// Open requisitions a team lead has published to the job listing (no internal notes, fees or budgets beyond the advertised range).
// Requisitions created before publishing existed have no flag and stay listed.
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = jobs
        .filter((j) => j.orgId === me.orgId && j.published !== false && OPEN.includes(j.status) && j.filled < j.openings)
        .map((j) => ({
            id: j.id,
            requisitionCode: j.requisitionCode ?? null,
            title: j.title,
            clientName: clients.find((c) => c.id === j.clientId)?.companyName ?? null,
            industry: clients.find((c) => c.id === j.clientId)?.industry ?? null,
            location: j.location,
            workMode: j.workMode ?? null,
            department: j.department,
            employmentType: j.employmentType,
            jobLevel: j.jobLevel ?? null,
            shiftTiming: j.shiftTiming ?? null,
            experienceMinYears: j.experienceMinYears,
            experienceMaxYears: j.experienceMaxYears,
            salaryMinLpa: j.salaryMinLpa,
            salaryMaxLpa: j.salaryMaxLpa,
            skills: j.skills,
            preferredSkills: j.preferredSkills ?? [],
            education: j.education ?? null,
            noticePeriodPreference: j.noticePeriodPreference ?? null,
            description: j.description,
            responsibilities: j.responsibilities ?? null,
            openings: j.openings - j.filled,
            priority: j.priority,
            postedAt: j.createdAt,
            incentiveEstimate: referralIncentiveFor((j.salaryMinLpa + j.salaryMaxLpa) / 2),
            myReferrals: referrals.filter((r) => r.agentId === me.id && r.jobId === j.id).length,
        }))
        .sort((a, b) => ["URGENT", "HIGH", "MEDIUM", "LOW"].indexOf(a.priority) - ["URGENT", "HIGH", "MEDIUM", "LOW"].indexOf(b.priority) || +new Date(b.postedAt) - +new Date(a.postedAt));
    return NextResponse.json(list);
}
