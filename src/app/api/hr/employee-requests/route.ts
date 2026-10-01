import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { employeeRequests, wfhRequests, attendanceCorrections, attendance, storedFiles, addAudit } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { decideEmployeeRequest } from "@/lib/mock/ess";
import { notifyRoles } from "@/lib/mock/pipeline";
import type { EmployeeRequest, EmployeeRequestType } from "@/lib/types";

const TYPES: EmployeeRequestType[] = ["LEAVE", "ATTENDANCE_CORRECTION", "WFH", "SALARY_CERTIFICATE", "EXPERIENCE_LETTER", "ADDRESS_CHANGE", "BANK_CHANGE", "NAME_CHANGE", "ID_CARD", "IT_SUPPORT", "GRIEVANCE", "OTHER"];
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const isHR = (role: string) => role === "SUPER_ADMIN" || role === "HR_ADMIN";

// GET /api/hr/employee-requests — HR sees all; everyone else sees only their own
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const employeeId = url.searchParams.get("employeeId");
    const mine = url.searchParams.get("mine") === "1";

    let list = employeeRequests.filter((r) => r.orgId === me.orgId);

    if (!isHR(me.role) || mine) {
        const emp = employeeForUser(me.id);
        list = emp ? list.filter((r) => r.employeeId === emp.id) : [];
    } else if (employeeId) {
        list = list.filter((r) => r.employeeId === employeeId);
    }

    if (type && type !== "ALL") list = list.filter((r) => r.type === type);
    if (status && status !== "ALL") list = list.filter((r) => r.status === status);

    return NextResponse.json(list);
}

// POST /api/hr/employee-requests — any staff member raises a request for themselves
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json().catch(() => ({}));
    const { type, description, priority = "MEDIUM", attachmentName, attachmentFileId } = body;

    const emp = employeeForUser(me.id);
    if (!emp) {
        return NextResponse.json({ error: "No employee profile is linked to your account. Please contact HR." }, { status: 400 });
    }
    if (!TYPES.includes(type)) return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
    if (type === "LEAVE") return NextResponse.json({ error: "Apply for leave from My Leave" }, { status: 400 });
    if (!String(description ?? "").trim()) return NextResponse.json({ error: "Please describe your request" }, { status: 400 });

    if (attachmentFileId && !storedFiles.some((f) => f.id === attachmentFileId && f.ownerUserId === me.id)) {
        return NextResponse.json({ error: "Attachment not found — upload it again" }, { status: 400 });
    }

    // Changes to identity / pay data are applied by HR on approval, so they need structured values + proof
    let payload: Record<string, string> | null = null;
    if (type === "BANK_CHANGE") {
        const accountNumber = String(body.accountNumber ?? "").replace(/\s/g, "");
        const ifscCode = String(body.ifscCode ?? "").toUpperCase().trim();
        if (!/^\d{9,18}$/.test(accountNumber) || !IFSC.test(ifscCode) || !String(body.bankName ?? "").trim()) {
            return NextResponse.json({ error: "Bank name, a 9–18 digit account number and a valid IFSC are required" }, { status: 400 });
        }
        if (!attachmentFileId) return NextResponse.json({ error: "Attach a cancelled cheque or bank statement" }, { status: 400 });
        payload = { bankName: String(body.bankName).trim(), accountNumber, ifscCode, accountName: String(body.accountName ?? emp.name).trim() };
    }
    if (type === "NAME_CHANGE") {
        const name = String(body.newName ?? "").trim();
        if (name.length < 2) return NextResponse.json({ error: "Enter the new legal name" }, { status: 400 });
        if (!attachmentFileId) return NextResponse.json({ error: "Attach a supporting document (gazette / marriage certificate / updated ID)" }, { status: 400 });
        payload = { name };
    }
    if (type === "ADDRESS_CHANGE" && (body.currentAddress || body.permanentAddress)) {
        payload = { currentAddress: String(body.currentAddress ?? "").trim(), permanentAddress: String(body.permanentAddress ?? "").trim() };
    }

    // Typed requests land in their dedicated HR queues so approval has a real effect
    if (type === "WFH") {
        const { startDate, endDate } = body;
        if (!startDate || !endDate || endDate < startDate) return NextResponse.json({ error: "Valid WFH start and end dates are required" }, { status: 400 });
        if (wfhRequests.some((w) => w.employeeId === emp.id && ["PENDING", "APPROVED"].includes(w.status) && w.startDate <= endDate && w.endDate >= startDate)) {
            return NextResponse.json({ error: "You already have a WFH request for these dates" }, { status: 409 });
        }
        const days = Math.round((+new Date(endDate) - +new Date(startDate)) / 86400000) + 1;
        const rec = {
            id: `wfh-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, employeeId: emp.id, employeeName: emp.name,
            department: emp.department, startDate, endDate, days, reason: description, status: "PENDING" as const, reviewedByName: null,
        };
        wfhRequests.unshift(rec);
        notifyRoles(me.orgId, ["HR_ADMIN"], { title: "WFH request", message: `${emp.name}: ${startDate} → ${endDate}`, link: "/hr/approvals" });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "WFH_REQUESTED", entity: "WfhRecord", entityId: rec.id, detail: `${emp.name}: ${startDate} → ${endDate}` });
        return NextResponse.json(rec, { status: 201 });
    }
    if (type === "ATTENDANCE_CORRECTION") {
        const { date, requestedCheckIn, requestedCheckOut } = body;
        if (!date || !requestedCheckIn || !requestedCheckOut) {
            return NextResponse.json({ error: "Date, check-in and check-out times are required" }, { status: 400 });
        }
        if (date > new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: "You cannot regularise a future date" }, { status: 400 });
        if (requestedCheckOut <= requestedCheckIn) return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
        if (attendanceCorrections.some((c) => c.employeeId === emp.id && c.date === date && c.status === "PENDING")) {
            return NextResponse.json({ error: "A correction for this date is already pending" }, { status: 409 });
        }
        const original = attendance.find((a) => a.userId === me.id && a.date === date);
        const rec = {
            id: `acr-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, employeeId: emp.id, employeeName: emp.name, date,
            originalCheckIn: original?.checkIn ?? null, originalCheckOut: original?.checkOut ?? null,
            requestedCheckIn, requestedCheckOut, reason: description, status: "PENDING" as const, reviewedByName: null,
        };
        attendanceCorrections.unshift(rec);
        notifyRoles(me.orgId, ["HR_ADMIN"], { title: "Attendance correction", message: `${emp.name}: ${date} (${requestedCheckIn}–${requestedCheckOut})`, link: "/hr/approvals" });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "ATTENDANCE_CORRECTION_REQUESTED", entity: "AttendanceCorrection", entityId: rec.id, detail: `${emp.name}: ${date}` });
        return NextResponse.json(rec, { status: 201 });
    }

    const newReq: EmployeeRequest = {
        id: `req-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        type: type as EmployeeRequestType,
        description: String(description).trim(),
        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM",
        status: "PENDING",
        requestedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedByName: null,
        comments: null,
        attachmentName: attachmentName || null,
        attachmentFileId: attachmentFileId || null,
        payload,
        confidential: type === "GRIEVANCE",
    };

    employeeRequests.unshift(newReq);

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "REQUEST_SUBMITTED",
        entity: "EmployeeRequest",
        entityId: newReq.id,
        detail: `${emp.name} submitted ${type}: ${newReq.description.slice(0, 80)}`,
    });

    notifyRoles(me.orgId, ["HR_ADMIN"], {
        title: `New ${type.replace(/_/g, " ").toLowerCase()} request`,
        message: newReq.confidential ? "A confidential grievance was raised." : `${emp.name} raised a request (${newReq.priority} priority).`,
        link: "/hr/requests",
    });

    return NextResponse.json(newReq, { status: 201 });
}

// PATCH /api/hr/employee-requests — HR decides
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, status, comments } = await request.json();
    if (!["APPROVED", "REJECTED", "IN_REVIEW"].includes(status)) {
        return NextResponse.json({ error: "status must be APPROVED, REJECTED or IN_REVIEW" }, { status: 400 });
    }
    const req = employeeRequests.find((r) => r.id === id && r.orgId === me.orgId);
    if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const res = decideEmployeeRequest(me, req, status, comments);
    if (res.error) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(req);
}
