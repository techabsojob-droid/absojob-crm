import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { jobs, applications, users, nextIds, commissionLedger } from "@/lib/mock/data";
import { getClientsFromDb, createClientInDb, logAudit } from "@/lib/supabase/db";
import type { Client, ClientStatus } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const dbClients = await getClientsFromDb(me.orgId);

    let list = dbClients.map((c) => {
        const clientJobs = jobs.filter((j) => j.clientId === c.id);
        const clientApps = applications.filter((a) => clientJobs.some((j) => j.id === a.jobId));
        const activeJobsCount = clientJobs.filter((j) => ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status)).length;
        const totalOpenings = clientJobs.reduce((acc, j) => acc + (j.openings || 1), 0);
        const placementsCount = clientApps.filter((a) => a.stage === "JOINED").length;
        const pipelineCount = clientApps.filter((a) => !["JOINED", "REJECTED", "BACKED_OUT"].includes(a.stage)).length;

        // Health check: Needs attention if active job with 0 candidates in pipeline, or status paused
        let healthState: "HEALTHY" | "NEEDS_ATTENTION" | "INACTIVE" = "HEALTHY";
        let healthReason = "Account active with steady operational velocity";

        if (c.status === "PAUSED" || c.status === "CHURNED") {
            healthState = "INACTIVE";
            healthReason = "Client account paused/inactive";
        } else if (activeJobsCount > 0 && pipelineCount === 0) {
            healthState = "NEEDS_ATTENTION";
            healthReason = "Active requisitions have zero candidates in screening";
        } else if (c.status === "ONBOARDING") {
            healthState = "NEEDS_ATTENTION";
            healthReason = "Service agreement pending contract signature";
        }

        // Mock financial status if user is super admin
        const clientInvoices = commissionLedger.filter((l) => l.clientId === c.id);
        const outstandingAmount = clientInvoices
            .filter((inv) => inv.status === "PENDING" || inv.status === "APPROVED")
            .reduce((sum, inv) => sum + inv.amountInr, 0);

        return {
            ...c,
            accountManagerName: users.find((u) => u.id === c.accountManagerId)?.name ?? "Aarav Mehta",
            openJobs: activeJobsCount,
            totalJobs: clientJobs.length,
            totalOpenings,
            placements: placementsCount,
            inPipeline: pipelineCount,
            lastActivity: "2 hours ago",
            healthState,
            healthReason,
            outstandingAmount,
            paymentStatus: outstandingAmount > 0 ? "PAYMENT_DUE" : "SETTLED",
            tags: c.industry === "Healthcare" ? ["Healthcare", "High Priority"] : c.industry === "Fintech" ? ["Fintech", "Enterprise"] : ["Technology"],
        };
    });

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const statusFilter = url.searchParams.get("status");
    const industryFilter = url.searchParams.get("industry");

    if (q) {
        list = list.filter((c) =>
            c.companyName.toLowerCase().includes(q) ||
            c.contactPerson.toLowerCase().includes(q) ||
            c.contactEmail.toLowerCase().includes(q) ||
            c.industry.toLowerCase().includes(q) ||
            c.accountManagerName.toLowerCase().includes(q) ||
            (c.address ?? "").toLowerCase().includes(q)
        );
    }

    if (statusFilter && statusFilter !== "ALL") {
        list = list.filter((c) => c.status === statusFilter);
    }

    if (industryFilter && industryFilter !== "ALL") {
        list = list.filter((c) => c.industry === industryFilter);
    }

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.companyName || !body.contactPerson || !body.contactEmail) {
        return NextResponse.json({ error: "companyName, contactPerson, contactEmail required" }, { status: 400 });
    }

    const client: Client = {
        id: nextIds.client(),
        orgId: me.orgId,
        companyName: body.companyName,
        industry: body.industry ?? "Other",
        website: body.website ?? null,
        contactPerson: body.contactPerson,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone ?? "",
        address: body.address ?? null,
        status: (body.status as ClientStatus) ?? "ONBOARDING",
        agreementUrl: null,
        commissionRate: Number(body.commissionRate) || 8.33,
        creditDays: Number(body.creditDays) || 30,
        accountManagerId: body.accountManagerId || me.id,
        estimatedValue: body.estimatedValue ?? "₹25L",
        notes: body.notes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const saved = await createClientInDb(client);

    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "CLIENT_CREATED",
        entity: "Client",
        entityId: saved.id,
        detail: `Onboarded ${saved.companyName}`,
    });

    return NextResponse.json(saved, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, status, commissionRate, creditDays, accountManagerId, notes, address, contactPerson, contactEmail, contactPhone } = await request.json();
    const dbClients = await getClientsFromDb(me.orgId);
    const client = dbClients.find((c) => c.id === id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    if (status) client.status = status as ClientStatus;
    if (commissionRate !== undefined) client.commissionRate = Number(commissionRate);
    if (creditDays !== undefined) client.creditDays = Number(creditDays);
    if (accountManagerId !== undefined) client.accountManagerId = accountManagerId;
    if (notes !== undefined) client.notes = notes;
    if (address !== undefined) client.address = address;
    if (contactPerson !== undefined) client.contactPerson = contactPerson;
    if (contactEmail !== undefined) client.contactEmail = contactEmail;
    if (contactPhone !== undefined) client.contactPhone = contactPhone;
    client.updatedAt = new Date().toISOString();

    if (status) {
        await logAudit({
            orgId: me.orgId,
            actorUserId: me.id,
            actorRole: me.role,
            action: "CLIENT_STATUS_CHANGED",
            entity: "Client",
            entityId: client.id,
            detail: `${client.companyName} status → ${status}`,
        });
    }

    return NextResponse.json(client);
}
