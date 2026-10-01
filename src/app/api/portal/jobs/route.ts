import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { jobs, clients, referrals } from "@/lib/mock/data";
import { referralIncentiveFor } from "@/lib/mock/pipeline";

const OPEN = ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE"];

// Open requisitions anyone can refer candidates for (no internal notes, fees or budgets beyond the advertised range)
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = jobs
        .filter((j) => j.orgId === me.orgId && OPEN.includes(j.status) && j.filled < j.openings)
        .map((j) => ({
            id: j.id,
            title: j.title,
            clientName: clients.find((c) => c.id === j.clientId)?.companyName ?? null,
            industry: clients.find((c) => c.id === j.clientId)?.industry ?? null,
            location: j.location,
            workMode: j.workMode ?? null,
            department: j.department,
            employmentType: j.employmentType,
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
