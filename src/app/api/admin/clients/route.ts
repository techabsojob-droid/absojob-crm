import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { clients, jobs, applications, users, addAudit, nextIds } from "@/lib/mock/data";
import type { Client, ClientStatus } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = clients
        .filter((c) => c.orgId === me.orgId)
        .map((c) => {
            const clientJobs = jobs.filter((j) => j.clientId === c.id);
            return {
                ...c,
                accountManagerName: users.find((u) => u.id === c.accountManagerId)?.name ?? "—",
                openJobs: clientJobs.filter((j) => ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status)).length,
                totalJobs: clientJobs.length,
                placements: applications.filter((a) => clientJobs.some((j) => j.id === a.jobId) && a.stage === "JOINED").length,
            };
        });

    // ?status= filter
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");
    return NextResponse.json(statusFilter ? list.filter((c) => c.status === statusFilter) : list);
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
        status: "ONBOARDING",
        agreementUrl: null,
        commissionRate: Number(body.commissionRate) || 8.33,
        creditDays: Number(body.creditDays) || 30,
        accountManagerId: me.id,
        estimatedValue: body.estimatedValue ?? "—",
        notes: body.notes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    clients.push(client);

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "CLIENT_CREATED", entity: "Client", entityId: client.id,
        detail: `Onboarded ${client.companyName}`,
    });

    return NextResponse.json(client, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, status, commissionRate, creditDays, accountManagerId, notes } = await request.json();
    const client = clients.find((c) => c.id === id && c.orgId === me.orgId);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    if (status) client.status = status as ClientStatus;
    if (commissionRate !== undefined) client.commissionRate = Number(commissionRate);
    if (creditDays !== undefined) client.creditDays = Number(creditDays);
    if (accountManagerId !== undefined) client.accountManagerId = accountManagerId;
    if (notes !== undefined) client.notes = notes;
    client.updatedAt = new Date().toISOString();

    if (status) {
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "CLIENT_STATUS_CHANGED", entity: "Client", entityId: client.id,
            detail: `${client.companyName} status → ${status}`,
        });
    }

    return NextResponse.json(client);
}
