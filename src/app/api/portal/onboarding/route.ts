import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { documents, onboardingRecords, storedFiles, users, addAudit, addNotification } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { bad, body } from "@/lib/mock/fin/http";
import type { DocumentCategory } from "@/lib/types";

function myRecord(userId: string) {
    const emp = employeeForUser(userId);
    if (!emp) return { emp, rec: undefined };
    const rec = onboardingRecords.find((o) => o.createdEmployeeId === emp.id) ?? onboardingRecords.find((o) => o.orgId === emp.orgId && o.candidateEmail.toLowerCase() === emp.email.toLowerCase());
    return { emp, rec };
}

// GET — my joining checklist (new joiners)
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const { rec } = myRecord(auth.user.id);
    if (!rec) return NextResponse.json({ onboarding: null });
    return NextResponse.json({
        onboarding: {
            id: rec.id, position: rec.position, department: rec.department, status: rec.status, progressPercent: rec.progressPercent, expectedJoiningDate: rec.expectedJoiningDate,
            hrName: users.find((u) => u.id === rec.assignedHrId)?.name ?? null,
            checklist: rec.checklist.map((c) => ({ ...c, submittedUrl: c.submittedFileId ? `/api/files/${c.submittedFileId}` : null })),
        },
    });
}

// POST { itemId, fileId } — submit the document for a checklist item (HR verifies and ticks it)
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { emp, rec } = myRecord(me.id);
    if (!emp || !rec) return bad("No onboarding checklist found", 404);
    const b = await body(request);
    const item = rec.checklist.find((c) => c.id === b.itemId);
    if (!item) return bad("Checklist item not found", 404);
    if (item.completed) return bad("Already completed", 409);
    const file = storedFiles.find((f) => f.id === b.fileId && f.ownerUserId === me.id);
    if (!file) return bad("Upload the document first");
    item.submittedFileId = file.id;
    item.submittedAt = new Date().toISOString();
    const category: DocumentCategory = /pan|aadhaar|identity|passport/i.test(`${item.title} ${item.requiredDoc ?? ""}`) ? "IDENTITY" : /address/i.test(item.title) ? "ADDRESS" : /bank|cheque/i.test(`${item.title} ${item.requiredDoc ?? ""}`) ? "BANK_DOC" : "EMPLOYMENT";
    documents.push({ id: `doc-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, employeeId: emp.id, employeeName: emp.name, title: `${item.title} — ${file.name}`, category, fileUrl: `/api/files/${file.id}`, fileSize: `${Math.ceil(file.size / 1024)} KB`, status: "PENDING", uploadedAt: item.submittedAt, uploadedByName: emp.name, version: 1 });
    if (rec.assignedHrId) addNotification({ orgId: me.orgId, userId: rec.assignedHrId, title: "Joining document submitted", message: `${emp.name}: ${item.title}`, link: "/hr/documents" });
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "ONBOARDING_DOC_SUBMITTED", entity: "Onboarding", entityId: rec.id, detail: `${emp.name}: ${item.title}` });
    return NextResponse.json({ success: true });
}
