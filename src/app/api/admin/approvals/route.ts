import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { approvals, jobs, auditLogs, addNotification } from "@/lib/mock/data";
import { notifyJobAssignment } from "@/lib/mock/pipeline";
import type { ApprovalRequest } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");

    // Each role sees the approval types it can act on (plus anything it requested)
    const visibleTypes: Record<string, string[] | "*"> = {
        SUPER_ADMIN: "*",
        TA_MANAGER: ["JOB_REQUISITION", "OFFER_APPROVAL", "CANDIDATE_EXCEPTION"],
        HR_ADMIN: ["SALARY_EXCEPTION", "USER_ACCESS", "EXPENSE_APPROVAL"],
    };
    const types = visibleTypes[me.role] ?? [];
    let list = approvals.filter((a) => a.orgId === me.orgId && (types === "*" || types.includes(a.type) || a.requestedById === me.id));

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

// Which approval types each role may decide
const DECIDERS: Record<string, string[]> = {
    SUPER_ADMIN: ["*"],
    TA_MANAGER: ["JOB_REQUISITION", "OFFER_APPROVAL", "CANDIDATE_EXCEPTION"],
    HR_ADMIN: ["SALARY_EXCEPTION", "USER_ACCESS", "EXPENSE_APPROVAL"],
};

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, action, reviewComment } = await request.json(); // action: "APPROVE" | "REJECT" | "REQUEST_CHANGES"
    const item = approvals.find((a) => a.id === id && a.orgId === me.orgId);
    if (!item) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

    const allowed = DECIDERS[me.role] ?? [];
    if (!allowed.includes("*") && !allowed.includes(item.type)) {
        return NextResponse.json({ error: "You are not allowed to decide this type of approval" }, { status: 403 });
    }
    if (item.status !== "PENDING" && item.status !== "CHANGES_REQUESTED") {
        return NextResponse.json({ error: `Already ${item.status.toLowerCase()}` }, { status: 409 });
    }
    if (item.requestedById === me.id && me.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "You cannot approve your own request" }, { status: 403 });
    }
    if (!["APPROVE", "REJECT", "REQUEST_CHANGES"].includes(action)) {
        return NextResponse.json({ error: "action must be APPROVE, REJECT or REQUEST_CHANGES" }, { status: 400 });
    }
    if (action !== "APPROVE" && !String(reviewComment ?? "").trim()) {
        return NextResponse.json({ error: "A comment is required when rejecting or requesting changes" }, { status: 400 });
    }

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
                notifyJobAssignment(job, [], me);
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
        id: `aud-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: `APPROVAL_${item.status}`,
        entity: "ApprovalRequest",
        entityId: item.id,
        detail: `${me.name} marked ${item.title} as ${item.status}. Comment: ${reviewComment || "None"}`,
        createdAt: new Date().toISOString(),
    });

    if (item.requestedById !== me.id) {
        addNotification({
            orgId: me.orgId, userId: item.requestedById,
            title: item.status === "APPROVED" ? "Request approved" : item.status === "REJECTED" ? "Request rejected" : "Changes requested",
            message: `${item.title} — ${me.name}${reviewComment ? `: ${reviewComment}` : ""}`,
            link: item.relatedRecordType === "JOB" ? `/ta/requisitions/${item.relatedRecordId}` : null,
        });
    }

    return NextResponse.json(item);
}
