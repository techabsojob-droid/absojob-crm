import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { documents, employees, addAudit, addNotification } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { notifyRoles } from "@/lib/mock/pipeline";
import type { DocumentCategory, DocumentRecord } from "@/lib/types";

const CATEGORIES: DocumentCategory[] = ["IDENTITY", "ADDRESS", "OFFER_LETTER", "APPOINTMENT_LETTER", "EXPERIENCE_LETTER", "SALARY_CERTIFICATE", "BANK_DOC", "EMPLOYMENT", "RESUME", "POLICY"];
const isHR = (role: string) => role === "SUPER_ADMIN" || role === "HR_ADMIN";

// GET: HR sees the vault; everyone else sees their own documents + company policies
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const employeeId = url.searchParams.get("employeeId");
    const q = url.searchParams.get("q")?.toLowerCase();
    const mine = url.searchParams.get("mine") === "1";

    let list = documents.filter((d) => d.orgId === me.orgId);
    if (!isHR(me.role) || mine) {
        const emp = employeeForUser(me.id);
        list = list.filter((d) => d.category === "POLICY" || (emp && d.employeeId === emp.id));
    } else if (employeeId) {
        list = list.filter((d) => d.employeeId === employeeId);
    }
    if (category && category !== "ALL") list = list.filter((d) => d.category === category);
    if (status && status !== "ALL") list = list.filter((d) => d.status === status);
    if (q) {
        list = list.filter((d) => d.title.toLowerCase().includes(q) || (d.employeeName && d.employeeName.toLowerCase().includes(q)));
    }
    return NextResponse.json(list);
}

// POST: HR adds a document for any employee (or a company policy); staff upload their own
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const fileUrl = String(body.fileUrl ?? "").trim();
    if (!title || !fileUrl || !CATEGORIES.includes(body.category)) {
        return NextResponse.json({ error: "title, category and file link are required" }, { status: 400 });
    }
    if (body.category === "POLICY" && !isHR(me.role)) {
        return NextResponse.json({ error: "Only HR can publish company policies" }, { status: 403 });
    }

    let emp = undefined as (typeof employees)[number] | undefined;
    if (body.category !== "POLICY") {
        emp = isHR(me.role) && body.employeeId
            ? employees.find((e) => e.id === body.employeeId && e.orgId === me.orgId)
            : employeeForUser(me.id);
        if (!emp) return NextResponse.json({ error: isHR(me.role) ? "Select the employee" : "No employee profile linked to your account" }, { status: 400 });
    }

    // Replacing a document keeps a version number; the previous file is superseded
    const previous = documents.filter((d) => d.orgId === me.orgId && d.employeeId === (emp?.id ?? null) && d.category === body.category && d.title.toLowerCase() === title.toLowerCase());
    const doc: DocumentRecord = {
        id: `doc-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        employeeId: emp?.id ?? null,
        employeeName: emp?.name ?? null,
        title,
        category: body.category,
        fileUrl,
        fileSize: body.fileSize || undefined,
        // HR-issued documents are verified on upload; self-uploads wait for HR
        status: isHR(me.role) ? "VERIFIED" : "PENDING",
        expiryDate: body.expiryDate || null,
        uploadedAt: new Date().toISOString(),
        uploadedByName: me.name,
        version: previous.length + 1,
    };
    documents.unshift(doc);

    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "DOCUMENT_UPLOADED", entity: "Document", entityId: doc.id, detail: `${doc.title} (${doc.category}) v${doc.version}${emp ? ` for ${emp.name}` : ""}` });
    if (isHR(me.role) && emp?.userId && emp.userId !== me.id) {
        addNotification({ orgId: me.orgId, userId: emp.userId, title: "New document issued", message: `${doc.title} is available in My Documents`, link: "/portal/profile?tab=documents" });
    } else if (!isHR(me.role)) {
        notifyRoles(me.orgId, ["HR_ADMIN"], { title: "Document awaiting verification", message: `${emp?.name}: ${doc.title}`, link: "/hr/documents" });
    }
    return NextResponse.json(doc, { status: 201 });
}

// PATCH: HR verifies or rejects a document
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, action, reason, expiryDate } = await request.json();
    const doc = documents.find((d) => d.id === id && d.orgId === me.orgId);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (!["verify", "reject"].includes(action)) return NextResponse.json({ error: "action must be verify or reject" }, { status: 400 });
    if (action === "reject" && !String(reason ?? "").trim()) return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });

    doc.status = action === "verify" ? "VERIFIED" : "REJECTED";
    doc.reviewedByName = me.name;
    doc.rejectionReason = action === "reject" ? String(reason).trim() : null;
    if (expiryDate !== undefined) doc.expiryDate = expiryDate || null;

    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: action === "verify" ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED", entity: "Document", entityId: doc.id, detail: `${doc.title}${doc.employeeName ? ` (${doc.employeeName})` : ""}${reason ? ` — ${reason}` : ""}` });
    const emp = doc.employeeId ? employees.find((e) => e.id === doc.employeeId) : undefined;
    if (emp?.userId) {
        addNotification({
            orgId: me.orgId, userId: emp.userId,
            title: action === "verify" ? "Document verified" : "Document rejected — please re-upload",
            message: `${doc.title}${reason ? `: ${reason}` : ""}`,
            link: "/portal/profile?tab=documents",
        });
    }
    return NextResponse.json(doc);
}
