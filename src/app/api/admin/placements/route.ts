import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { placements, candidates, clients, jobs, users, addAudit } from "@/lib/mock/data";
import { notifyRoles } from "@/lib/mock/pipeline";
import { billingOf, handlePlacementFallThrough } from "@/lib/mock/finance";
import type { PlacementRecord } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const status = url.searchParams.get("status");

    let list = placements.filter((p) => p.orgId === me.orgId);

    if (q) {
        list = list.filter(
            (p) =>
                p.candidateName.toLowerCase().includes(q) ||
                p.clientName.toLowerCase().includes(q) ||
                p.jobTitle.toLowerCase().includes(q) ||
                p.recruiterName.toLowerCase().includes(q)
        );
    }

    if (status && status !== "ALL") {
        list = list.filter((p) => p.joiningStatus === status);
    }

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const candidate = candidates.find((c) => c.id === body.candidateId && c.orgId === me.orgId);
        const job = jobs.find((j) => j.id === body.jobId && j.orgId === me.orgId);
        if (!candidate || !job) {
            return NextResponse.json({ error: "Candidate and job must exist in your organization" }, { status: 400 });
        }
        const client = clients.find((cl) => cl.id === job.clientId && cl.orgId === me.orgId);
        if (placements.some((p) => p.orgId === me.orgId && p.candidateId === candidate.id && p.jobId === job.id)) {
            return NextResponse.json({ error: "A placement already exists for this candidate and job" }, { status: 409 });
        }

        const newPlacement: PlacementRecord = {
            id: `plc-${crypto.randomUUID().slice(0, 8)}`,
            orgId: me.orgId,
            candidateId: candidate.id,
            candidateName: candidate.name,
            clientId: job.clientId,
            clientName: client?.companyName ?? "—",
            jobId: job.id,
            jobTitle: job.title,
            recruiterId: me.id,
            recruiterName: me.name,
            accountManagerName: users.find((u) => u.id === client?.accountManagerId)?.name,
            placementDate: new Date().toISOString().split("T")[0],
            offeredPosition: body.offeredPosition ?? job?.title ?? "Position",
            offeredSalaryLpa: Number(body.offeredSalaryLpa) || 12,
            joiningDate: body.joiningDate ?? new Date().toISOString().split("T")[0],
            joiningStatus: body.joiningStatus ?? "JOINING_PENDING",
            revenueInr: Number(body.revenueInr) || Math.round((Number(body.offeredSalaryLpa) || 12) * 100000 * 0.0833),
            invoiceId: null,
            invoiceNumber: null,
            guaranteePeriodDays: client ? billingOf(client).guaranteeDays : 90,
            guaranteeEndDate: new Date(new Date(body.joiningDate ?? Date.now()).getTime() + (client ? billingOf(client).guaranteeDays : 90) * 86400000).toISOString().split("T")[0],
            replacementStatus: "NO_REPLACEMENT",
            notes: body.notes ?? null,
            createdAt: new Date().toISOString(),
        };

        placements.unshift(newPlacement);
        return NextResponse.json(newPlacement, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create placement" }, { status: 400 });
    }
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, joiningStatus, replacementStatus, notes } = await request.json();
    const item = placements.find((p) => p.id === id && p.orgId === me.orgId);
    if (!item) return NextResponse.json({ error: "Placement not found" }, { status: 404 });

    const before = `${item.joiningStatus}/${item.replacementStatus}`;
    if (joiningStatus) item.joiningStatus = joiningStatus;
    if (replacementStatus) item.replacementStatus = replacementStatus;
    if (notes !== undefined) item.notes = notes;

    // A billed placement that falls through inside the guarantee window needs a credit note
    const fellThrough = ["NO_SHOW", "CANCELLED"].includes(item.joiningStatus) || item.replacementStatus === "REPLACEMENT_REQUESTED";
    if (fellThrough && before !== `${item.joiningStatus}/${item.replacementStatus}`) {
        handlePlacementFallThrough(me, item);
    }
    if ((item.invoiceId || item.invoiceNumber) && fellThrough && before !== `${item.joiningStatus}/${item.replacementStatus}`) {
        notifyRoles(me.orgId, ["FINANCE_ADMIN"], {
            title: "Billed placement at risk",
            message: `${item.candidateName} @ ${item.clientName} is ${item.joiningStatus === "JOINED" ? "being replaced" : item.joiningStatus.toLowerCase().replace("_", " ")} — review invoice ${item.invoiceNumber} for a credit note`,
            link: "/finance/billing",
        });
    }
    // Newly joined and not yet billed → Finance bills it
    if (joiningStatus === "JOINED" && !item.invoiceId && !item.invoiceNumber) {
        notifyRoles(me.orgId, ["FINANCE_ADMIN"], { title: "Placement ready to bill", message: `${item.candidateName} joined ${item.jobTitle} (${item.clientName})`, link: "/finance/billing" });
    }
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "PLACEMENT_UPDATED", entity: "Placement", entityId: item.id, detail: `${item.candidateName}: ${before} → ${item.joiningStatus}/${item.replacementStatus}` });

    return NextResponse.json(item);
}
