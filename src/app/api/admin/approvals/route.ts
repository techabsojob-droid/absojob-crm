import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { approvals, jobs, auditLogs } from "@/lib/mock/data";
import type { ApprovalRequest } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");

    let list = approvals.filter((a) => a.orgId === me.orgId);

    if (q) {
        list = list.filter(
            (a) =>
                a.title.toLowerCase().includes(q) ||
                a.requestedByName.toLowerCase().includes(q) ||
                a.relatedRecordName.toLowerCase().includes(q)
        );
    }

    if (type && type !== "ALL") list = list.filter((a) => a.type === type);
    if (status && status !== "ALL") list = list.filter((a) => a.status === status);

    return NextResponse.json(list);
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, action, reviewComment } = await request.json(); // action: "APPROVE" | "REJECT" | "REQUEST_CHANGES"
    const item = approvals.find((a) => a.id === id && a.orgId === me.orgId);
    if (!item) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

    item.reviewedById = me.id;
    item.reviewedByName = me.name;
    item.reviewedAt = new Date().toISOString();
    item.reviewComment = reviewComment || null;

    if (action === "APPROVE") {
        item.status = "APPROVED";
        // If it's a job requisition approval, approve the underlying job
        if (item.type === "JOB_REQUISITION" && item.relatedRecordType === "JOB") {
            const job = jobs.find((j) => j.id === item.relatedRecordId);
            if (job) {
                job.status = "APPROVED";
                job.approvedById = me.id;
                job.updatedAt = new Date().toISOString();
            }
        }
    } else if (action === "REJECT") {
        item.status = "REJECTED";
        if (item.type === "JOB_REQUISITION" && item.relatedRecordType === "JOB") {
            const job = jobs.find((j) => j.id === item.relatedRecordId);
            if (job) {
                job.status = "CANCELLED";
                job.updatedAt = new Date().toISOString();
            }
        }
    } else if (action === "REQUEST_CHANGES") {
        item.status = "CHANGES_REQUESTED";
    }

    // Add immutable audit log
    auditLogs.unshift({
        id: `aud-${Date.now().toString().slice(-4)}`,
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: `APPROVAL_${item.status}`,
        entity: "ApprovalRequest",
        entityId: item.id,
        detail: `${me.name} marked ${item.title} as ${item.status}. Comment: ${reviewComment || "None"}`,
        createdAt: new Date().toISOString(),
    });

    return NextResponse.json(item);
}
