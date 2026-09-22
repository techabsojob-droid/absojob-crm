import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { getClientsFromDb, getJobsFromDb, logAudit } from "@/lib/supabase/db";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    users,
    candidates as mockCandidates,
    applications as mockApplications,
    interviews as mockInterviews,
    placements as mockPlacements,
    commissionLedger,
    tasks as mockTasks,
    auditLogs
} from "@/lib/mock/data";

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

    // 3. Applications & Candidates
    let clientApplications = mockApplications
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
                offeredCtcLpa: cand?.expectedCtcLpa ?? 14,
                appliedAt: a.createdAt,
            };
        });

    // 4. Interviews for this client
    const clientInterviews = mockInterviews
        .filter((iv) => {
            const app = mockApplications.find((a) => a.id === iv.applicationId);
            return app && clientJobIds.includes(app.jobId);
        })
        .map((iv) => {
            const app = mockApplications.find((a) => a.id === iv.applicationId);
            const cand = mockCandidates.find((c) => c.id === app?.candidateId);
            const job = clientJobs.find((j) => j.id === app?.jobId);
            return {
                ...iv,
                candidateName: cand?.name || "Candidate",
                jobTitle: job?.title || "Position",
            };
        });

    // 5. Placements for this client
    const clientPlacements = mockPlacements.filter((p) => p.clientId === clientId);

    // 6. Invoices & Billing
    const clientLedger = commissionLedger.filter((l) => l.clientId === clientId);
    let invoices: any[] = clientLedger.map((inv, idx) => ({
        id: inv.invoiceNumber || `INV-2026-0${idx + 1}`,
        companyId: clientId,
        jobId: inv.applicationId || "job-101",
        jobTitle: inv.description,
        candidateName: "Placed Candidate",
        amount: inv.amountInr,
        tax: Math.round(inv.amountInr * 0.18),
        total: Math.round(inv.amountInr * 1.18),
        status: inv.status === "PAID" ? "PAID" : "PENDING",
        issueDate: inv.createdAt,
        dueDate: inv.dueDate || new Date(Date.now() + 15 * 86400000).toISOString(),
        paidAt: inv.paidAt,
    }));

    if (invoices.length === 0 && clientPlacements.length > 0) {
        invoices = clientPlacements.map((p, idx) => ({
            id: p.invoiceNumber || `INV-2026-0${idx + 1}`,
            companyId: clientId,
            jobId: p.jobId,
            jobTitle: p.jobTitle,
            candidateName: p.candidateName,
            amount: p.revenueInr,
            tax: Math.round(p.revenueInr * 0.18),
            total: Math.round(p.revenueInr * 1.18),
            status: idx === 0 ? "PAID" : "PENDING",
            issueDate: p.placementDate,
            dueDate: new Date(Date.now() + 20 * 86400000).toISOString(),
            paidAt: idx === 0 ? p.placementDate : null,
        }));
    }

    // 7. Contacts (Primary + Additional Contacts)
    const contacts = [
        {
            id: "cnt-1",
            name: client.contactPerson,
            jobTitle: "VP of People Operations & HR",
            department: "Human Resources",
            email: client.contactEmail,
            phone: client.contactPhone || "+91 98200 44551",
            whatsapp: client.contactPhone || "+91 98200 44551",
            isPrimary: true,
            isBillingContact: true,
            isHiringContact: true,
            status: "ACTIVE",
        },
        {
            id: "cnt-2",
            name: "Rajesh Kulkarni",
            jobTitle: "Director of Engineering / Hiring Manager",
            department: "Engineering",
            email: `rajesh.k@${client.website?.replace(/^https?:\/\//, "") || "company.com"}`,
            phone: "+91 98199 88771",
            whatsapp: "+91 98199 88771",
            isPrimary: false,
            isBillingContact: false,
            isHiringContact: true,
            status: "ACTIVE",
        },
    ];

    // 8. Documents
    const documents = [
        {
            id: "cdoc-1",
            name: `${client.companyName} — Master Services Agreement (MSA)`,
            type: "MSA",
            version: 1.2,
            uploadedBy: "Aarav Mehta",
            uploadDate: "2026-03-15",
            expiryDate: "2027-03-15",
            status: "ACTIVE",
            fileUrl: "/docs/msa-signed.pdf",
            fileSize: "1.4 MB",
        },
        {
            id: "cdoc-2",
            name: "Non-Disclosure Agreement (NDA)",
            type: "NDA",
            version: 1.0,
            uploadedBy: "Neha Kulkarni",
            uploadDate: "2026-03-10",
            expiryDate: "2029-03-10",
            status: "ACTIVE",
            fileUrl: "/docs/nda-signed.pdf",
            fileSize: "820 KB",
        },
        {
            id: "cdoc-3",
            name: "Signed Commercial Fee Rate Card (8.33% CTC)",
            type: "RATE_CARD",
            version: 1.0,
            uploadedBy: "Aarav Mehta",
            uploadDate: "2026-03-15",
            expiryDate: null,
            status: "ACTIVE",
            fileUrl: "/docs/rate-card.pdf",
            fileSize: "450 KB",
        },
    ];

    // 9. Communication History
    const communications = [
        {
            id: "comm-1",
            type: "PHONE",
            subject: "Quarterly hiring roadmap & senior backend requirements",
            summary: "Discussed 3 upcoming vacancies in payments engineering pod. Agreed on 25-day turnaround.",
            outcome: "Requirements Finalized",
            date: "2026-09-20",
            userName: "Neha Kulkarni",
            contactName: client.contactPerson,
        },
        {
            id: "comm-2",
            type: "EMAIL",
            subject: "Shortlisted candidates submitted for DevOps role",
            summary: "Dispatched 4 pre-screened profiles with anonymized compensation matrix.",
            outcome: "Interview Feedback Expected",
            date: "2026-09-18",
            userName: "Rahul Sharma",
            contactName: "Rajesh Kulkarni",
        },
    ];

    // 10. Notes & Activity
    const notes = [
        {
            id: "cnote-1",
            category: "General",
            text: "Client prefers weekend virtual interview drives. Turnaround SLA on technical test feedback is 48 hours.",
            authorName: "Neha Kulkarni",
            createdAt: "2026-08-10",
        },
        {
            id: "cnote-2",
            category: "Finance",
            text: "Standard payment terms 30 days. Accounts payable requires GST invoice hardcopy via courier.",
            authorName: "Aarav Mehta",
            createdAt: "2026-07-22",
        }
    ];

    // 11. Follow-up Tasks for this client
    const tasks = mockTasks.filter((t) => t.title.toLowerCase().includes(client.companyName.toLowerCase()) || t.linkedApplicationId);

    // 12. Metrics & Health logic
    const totalIncome = invoices
        .filter((inv) => inv.status === "PAID")
        .reduce((sum, inv) => sum + inv.total, 0);

    const pendingReceivables = invoices
        .filter((inv) => inv.status === "PENDING")
        .reduce((sum, inv) => sum + inv.total, 0);

    const activeJobs = clientJobs.filter((j) =>
        ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status)
    );

    const accountManager = users.find((u) => u.id === client!.accountManagerId);

    return NextResponse.json({
        client: {
            ...client,
            accountManagerName: accountManager?.name ?? "Aarav Mehta",
            accountManagerEmail: accountManager?.email ?? "admin@absojob.com",
            accountManagerPhone: accountManager?.phone ?? "+91 98200 11223",
        },
        stats: {
            totalJobs: clientJobs.length,
            openJobs: activeJobs.length,
            totalOpenings: clientJobs.reduce((s, j) => s + (j.openings || 1), 0),
            placements: clientPlacements.length || clientApplications.filter((a) => a.stage === "JOINED").length,
            inPipeline: clientApplications.filter((a) => !["JOINED", "REJECTED"].includes(a.stage)).length,
            totalIncome,
            pendingReceivables,
            totalInvoiced: totalIncome + pendingReceivables,
            interviewCount: clientInterviews.length,
        },
        jobs: clientJobs.map((j) => ({
            ...j,
            inPipeline: clientApplications.filter((a) => a.jobId === j.id && !["JOINED", "REJECTED"].includes(a.stage)).length,
            placements: clientPlacements.filter((p) => p.jobId === j.id).length,
        })),
        candidates: clientApplications,
        interviews: clientInterviews,
        placements: clientPlacements,
        invoices,
        contacts,
        documents,
        communications,
        notes,
        tasks,
    });
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clientId: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { clientId } = await params;

    const body = await request.json();
    const dbClients = await getClientsFromDb(me.orgId);
    const client = dbClients.find((c) => c.id === clientId);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    if (body.status) client.status = body.status;
    if (body.companyName) client.companyName = body.companyName;
    if (body.industry) client.industry = body.industry;
    if (body.contactPerson) client.contactPerson = body.contactPerson;
    if (body.contactEmail) client.contactEmail = body.contactEmail;
    if (body.contactPhone) client.contactPhone = body.contactPhone;
    if (body.address) client.address = body.address;
    if (body.website) client.website = body.website;
    if (body.commissionRate !== undefined) client.commissionRate = Number(body.commissionRate);
    if (body.creditDays !== undefined) client.creditDays = Number(body.creditDays);
    if (body.accountManagerId) client.accountManagerId = body.accountManagerId;
    if (body.notes !== undefined) client.notes = body.notes;
    client.updatedAt = new Date().toISOString();

    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "CLIENT_UPDATED",
        entity: "Client",
        entityId: client.id,
        detail: `${me.name} updated details for client ${client.companyName}`,
    });

    return NextResponse.json(client);
}
