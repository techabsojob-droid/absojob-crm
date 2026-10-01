import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { clientLeads, clients } from "@/lib/mock/data";
import { addAudit } from "@/lib/mock/data";
import type { ClientLead, Client } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const stage = url.searchParams.get("stage");

    let list = clientLeads.filter((l) => l.orgId === me.orgId);

    if (q) {
        list = list.filter(
            (l) =>
                l.companyName.toLowerCase().includes(q) ||
                l.contactPerson.toLowerCase().includes(q) ||
                l.email.toLowerCase().includes(q) ||
                l.industry.toLowerCase().includes(q)
        );
    }

    if (stage && stage !== "ALL") {
        list = list.filter((l) => l.stage === stage);
    }

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const newLead: ClientLead = {
            id: `lead-${Date.now().toString().slice(-4)}`,
            orgId: me.orgId,
            companyName: body.companyName,
            contactPerson: body.contactPerson,
            email: body.email,
            phone: body.phone,
            industry: body.industry || "Technology",
            location: body.location || "Mumbai",
            leadSource: body.leadSource || "OUTBOUND",
            assignedToName: body.assignedToName || me.name,
            assignedToId: body.assignedToId || me.id,
            stage: body.stage || "NEW",
            expectedPositions: Number(body.expectedPositions) || 5,
            expectedAnnualValueLpa: Number(body.expectedAnnualValueLpa) || 20,
            priority: body.priority || "MEDIUM",
            nextFollowUpDate: body.nextFollowUpDate || new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
            notes: body.notes || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        clientLeads.unshift(newLead);
        return NextResponse.json(newLead, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create lead" }, { status: 400 });
    }
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, stage, notes, nextFollowUpDate, priority, convertToClient } = await request.json();
    const item = clientLeads.find((l) => l.id === id && l.orgId === me.orgId);
    if (!item) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    if (stage) item.stage = stage;
    if (notes !== undefined) item.notes = notes;
    if (nextFollowUpDate) item.nextFollowUpDate = nextFollowUpDate;
    if (priority) item.priority = priority;

    // Convert Lead to Client if requested
    if (convertToClient || stage === "CONVERTED") {
        item.stage = "CONVERTED";
        if (!item.convertedClientId) {
            const newClient: Client = {
                id: `cl-${Date.now().toString().slice(-4)}`,
                orgId: me.orgId,
                companyName: item.companyName,
                industry: item.industry,
                website: (item as { website?: string | null }).website ?? null,
                contactPerson: item.contactPerson,
                contactEmail: item.email,
                contactPhone: item.phone,
                address: item.location,
                status: "ACTIVE",
                agreementUrl: null,
                commissionRate: 8.33,
                creditDays: 30,
                accountManagerId: me.id,
                estimatedValue: `₹${item.expectedAnnualValueLpa}L`,
                notes: `Converted from lead ${item.id}. ${item.notes}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            clients.unshift(newClient);
            item.convertedClientId = newClient.id;
            addAudit({
                orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
                action: "CLIENT_LEAD_CONVERTED", entity: "Client", entityId: newClient.id,
                detail: `${item.companyName} converted from lead ${item.id}`,
            });
        }
    }

    item.updatedAt = new Date().toISOString();
    return NextResponse.json(item);
}
