import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { attendanceCorrections, employeeRequests, wfhRequests, addAudit } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { LETTER_TYPES } from "@/lib/mock/ess";
import { bad, body } from "@/lib/mock/fin/http";

// GET — every request I raised (HR requests, WFH, attendance corrections) in one list
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const emp = employeeForUser(auth.user.id);
    if (!emp) return NextResponse.json([]);
    const list = [
        ...employeeRequests.filter((r) => r.employeeId === emp.id).map((r) => ({
            id: r.id, kind: "REQUEST" as const, type: r.type, title: r.type.replace(/_/g, " "), description: r.description, status: r.status, requestedAt: r.requestedAt,
            reviewedByName: r.reviewedByName ?? null, comments: r.comments ?? null, attachmentUrl: r.attachmentFileId ? `/api/files/${r.attachmentFileId}` : null,
            letterUrl: r.status === "APPROVED" && LETTER_TYPES.includes(r.type) ? `/portal/letters/${r.id}` : null, payload: r.payload ?? null,
        })),
        ...wfhRequests.filter((w) => w.employeeId === emp.id).map((w) => ({
            id: w.id, kind: "WFH" as const, type: "WFH", title: `Work from home · ${w.days} day(s)`, description: `${w.startDate} → ${w.endDate} — ${w.reason}`, status: w.status,
            requestedAt: `${w.startDate}T00:00:00.000Z`, reviewedByName: w.reviewedByName ?? null, comments: null, attachmentUrl: null, letterUrl: null, payload: null,
        })),
        ...attendanceCorrections.filter((c) => c.employeeId === emp.id).map((c) => ({
            id: c.id, kind: "CORRECTION" as const, type: "ATTENDANCE_CORRECTION", title: `Attendance correction · ${c.date}`, description: `${c.requestedCheckIn} – ${c.requestedCheckOut} — ${c.reason}`, status: c.status,
            requestedAt: `${c.date}T00:00:00.000Z`, reviewedByName: c.reviewedByName ?? null, comments: null, attachmentUrl: null, letterUrl: null, payload: null,
        })),
    ].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return NextResponse.json(list);
}

// PATCH { id, kind, action: "withdraw" } — withdraw my pending request
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    const b = await body(request);
    if (b.action !== "withdraw") return bad("Unsupported action");
    const rec = b.kind === "WFH" ? wfhRequests.find((w) => w.id === b.id) : b.kind === "CORRECTION" ? attendanceCorrections.find((c) => c.id === b.id) : employeeRequests.find((r) => r.id === b.id);
    if (!rec || !emp || rec.employeeId !== emp.id) return bad("Request not found", 404);
    if (!["PENDING", "IN_REVIEW"].includes(rec.status)) return bad(`Request is already ${rec.status.toLowerCase()}`, 409);
    if (b.kind === "WFH" || b.kind === "CORRECTION") {
        // These queues have no WITHDRAWN state — remove the pending entry
        const list = (b.kind === "WFH" ? wfhRequests : attendanceCorrections) as { id: string }[];
        list.splice(list.findIndex((x) => x.id === rec.id), 1);
    } else rec.status = "WITHDRAWN";
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "REQUEST_WITHDRAWN", entity: "EmployeeRequest", entityId: rec.id, detail: `${emp.name} withdrew ${b.kind ?? "request"}` });
    return NextResponse.json({ success: true });
}
