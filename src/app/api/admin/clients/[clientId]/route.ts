import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { getClientsFromDb, getJobsFromDb } from "@/lib/supabase/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { users, candidates as mockCandidates, applications as mockApplications } from "@/lib/mock/data";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clientId: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { clientId } = await params;

    const supabase = createAdminClient();

    // 1. Fetch Client Details
    const dbClients = await getClientsFromDb(me.orgId);
    let client = dbClients.find((c) => c.id === clientId);

    if (!client) {
        // Try direct fetch from Supabase
        const { data: directClient } = await supabase
            .from("companies")
            .select("*")
            .eq("id", clientId)
            .single();

        if (directClient) {
            client = {
                id: directClient.id,
                orgId: directClient.org_id,
                companyName: directClient.company_name || directClient.name,
                industry: directClient.industry || "Other",
                website: directClient.website,
                contactPerson: directClient.contact_person || "Contact",
                contactEmail: directClient.contact_email || "",
                contactPhone: directClient.contact_phone || "",
                address: directClient.address || directClient.location,
                status: directClient.status || "ACTIVE",
                agreementUrl: null,
                commissionRate: Number(directClient.commission_rate) || 8.33,
                creditDays: Number(directClient.credit_days) || 30,
                accountManagerId: directClient.account_manager_id,
                estimatedValue: directClient.estimated_value || "—",
                notes: directClient.notes,
                createdAt: directClient.created_at,
                updatedAt: directClient.updated_at || directClient.created_at,
            };
        }
    }

    if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 2. Fetch Jobs for this client
    const allJobs = await getJobsFromDb(me.orgId);
    const clientJobs = allJobs.filter((j) => j.clientId === clientId);
    const clientJobIds = clientJobs.map((j) => j.id);

    // 3. Fetch Applications & Candidates for this client
    let clientApplications: any[] = [];
    try {
        const { data: dbApps } = await supabase
            .from("applications")
            .select("*, candidates(*)")
            .in("job_id", clientJobIds.length > 0 ? clientJobIds : ["none"]);

        if (dbApps && dbApps.length > 0) {
            clientApplications = dbApps.map((a: any) => ({
                id: a.id,
                candidateId: a.candidate_id,
                candidateName: a.candidates?.name || "Candidate",
                candidateEmail: a.candidates?.email || "",
                candidatePhone: a.candidates?.phone || "",
                candidateTitle: a.candidates?.title || a.candidates?.current_designation || "Professional",
                experience: a.candidates?.experience || a.candidates?.total_experience_years || 0,
                skills: a.candidates?.skills || [],
                jobId: a.job_id,
                jobTitle: clientJobs.find((j) => j.id === a.job_id)?.title || "Job Position",
                stage: a.stage || "SOURCED",
                status: a.status || "IN_PROGRESS",
                matchScore: a.match_score || 80,
                offeredCtcLpa: a.offered_ctc_lpa || 12,
                appliedAt: a.applied_at || a.created_at,
            }));
        }
    } catch {
        // Fallback to mock
        clientApplications = mockApplications
            .filter((a) => clientJobIds.includes(a.jobId))
            .map((a) => {
                const cand = mockCandidates.find((c) => c.id === a.candidateId);
                const job = clientJobs.find((j) => j.id === a.jobId);
                return {
                    id: a.id,
                    candidateId: a.candidateId,
                    candidateName: cand?.name || "Candidate",
                    candidateEmail: cand?.email || "",
                    candidatePhone: cand?.phone || "",
                    candidateTitle: cand?.currentDesignation || "Professional",
                    experience: cand?.totalExperienceYears || 0,
                    skills: cand?.skills || [],
                    jobId: a.jobId,
                    jobTitle: job?.title || "Job Position",
                    stage: a.stage,
                    status: "IN_PROGRESS",
                    matchScore: a.fitScore || 85,
                    offeredCtcLpa: cand?.expectedCtcLpa ?? 12,
                    appliedAt: a.createdAt,
                };
            });
    }

    // 4. Fetch Invoices / Finance for this client
    let invoices: any[] = [];
    try {
        const { data: dbInvoices } = await supabase
            .from("invoices")
            .select("*")
            .eq("company_id", clientId);

        if (dbInvoices && dbInvoices.length > 0) {
            invoices = dbInvoices.map((inv: any) => ({
                id: inv.id,
                companyId: inv.company_id,
                jobId: inv.job_id,
                jobTitle: clientJobs.find((j) => j.id === inv.job_id)?.title || "Placement Fee",
                candidateId: inv.candidate_id,
                amount: Number(inv.amount || 0),
                tax: Number(inv.tax || 0),
                total: Number(inv.total || inv.amount || 0),
                status: inv.status || "PAID",
                issueDate: inv.issue_date || inv.created_at,
                dueDate: inv.due_date,
                paidAt: inv.paid_at,
            }));
        }
    } catch {
        invoices = [];
    }

    // If no invoices exist in DB yet, generate sample based on joined placements
    const joinedCandidates = clientApplications.filter((a) => a.stage === "JOINED");
    if (invoices.length === 0 && joinedCandidates.length > 0) {
        invoices = joinedCandidates.map((c, idx) => {
            const annualCtc = (c.offeredCtcLpa || 12) * 100000;
            const commission = Math.round(annualCtc * (client!.commissionRate / 100));
            const tax = Math.round(commission * 0.18);
            return {
                id: `INV-2026-0${idx + 1}`,
                companyId: clientId,
                jobId: c.jobId,
                jobTitle: c.jobTitle,
                candidateId: c.candidateId,
                candidateName: c.candidateName,
                amount: commission,
                tax: tax,
                total: commission + tax,
                status: idx === 0 ? "PAID" : "PENDING",
                issueDate: new Date(Date.now() - (idx + 1) * 86400000 * 10).toISOString(),
                dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
                paidAt: idx === 0 ? new Date().toISOString() : null,
            };
        });
    }

    // 5. Calculate Metrics
    const totalIncome = invoices
        .filter((inv) => inv.status === "PAID")
        .reduce((sum, inv) => sum + inv.total, 0);

    const pendingReceivables = invoices
        .filter((inv) => inv.status === "PENDING")
        .reduce((sum, inv) => sum + inv.total, 0);

    const activeJobs = clientJobs.filter((j) =>
        ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status)
    );

    const placements = clientApplications.filter((a) => a.stage === "JOINED").length;
    const inPipeline = clientApplications.filter(
        (a) => !["JOINED", "REJECTED", "BACKED_OUT"].includes(a.stage)
    ).length;

    const accountManager = users.find((u) => u.id === client!.accountManagerId);

    return NextResponse.json({
        client: {
            ...client,
            accountManagerName: accountManager?.name ?? "—",
            accountManagerEmail: accountManager?.email ?? "—",
            accountManagerPhone: accountManager?.phone ?? "—",
        },
        stats: {
            totalJobs: clientJobs.length,
            openJobs: activeJobs.length,
            totalOpenings: clientJobs.reduce((s, j) => s + (j.openings || 1), 0),
            placements,
            inPipeline,
            totalIncome,
            pendingReceivables,
            totalInvoiced: totalIncome + pendingReceivables,
        },
        jobs: clientJobs.map((j) => ({
            ...j,
            inPipeline: clientApplications.filter((a) => a.jobId === j.id && !["JOINED", "REJECTED"].includes(a.stage)).length,
            placements: clientApplications.filter((a) => a.jobId === j.id && a.stage === "JOINED").length,
        })),
        candidates: clientApplications,
        invoices,
    });
}
