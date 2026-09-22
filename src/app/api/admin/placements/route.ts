import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { placements, candidates, clients, jobs } from "@/lib/mock/data";
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
        const candidate = candidates.find((c) => c.id === body.candidateId);
        const client = clients.find((cl) => cl.id === body.clientId);
        const job = jobs.find((j) => j.id === body.jobId);

        const newPlacement: PlacementRecord = {
            id: `plc-${Date.now().toString().slice(-4)}`,
            orgId: me.orgId,
            candidateId: body.candidateId,
            candidateName: candidate?.name ?? body.candidateName ?? "Candidate",
            clientId: body.clientId,
            clientName: client?.companyName ?? body.clientName ?? "Client",
            jobId: body.jobId,
            jobTitle: job?.title ?? body.jobTitle ?? "Position",
            recruiterId: me.id,
            recruiterName: me.name,
            accountManagerName: "Neha Kulkarni",
            placementDate: new Date().toISOString().split("T")[0],
            offeredPosition: body.offeredPosition ?? job?.title ?? "Position",
            offeredSalaryLpa: Number(body.offeredSalaryLpa) || 12,
            joiningDate: body.joiningDate ?? new Date().toISOString().split("T")[0],
            joiningStatus: body.joiningStatus ?? "JOINING_PENDING",
            revenueInr: Number(body.revenueInr) || Math.round((Number(body.offeredSalaryLpa) || 12) * 100000 * 0.0833),
            invoiceId: null,
            invoiceNumber: null,
            guaranteePeriodDays: Number(body.guaranteePeriodDays) || 90,
            guaranteeEndDate: body.guaranteeEndDate ?? new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
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

    if (joiningStatus) item.joiningStatus = joiningStatus;
    if (replacementStatus) item.replacementStatus = replacementStatus;
    if (notes !== undefined) item.notes = notes;

    return NextResponse.json(item);
}
