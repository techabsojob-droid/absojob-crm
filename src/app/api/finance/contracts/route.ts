import { NextResponse } from "next/server";
import { contractAssignments, timesheets, addAudit } from "@/lib/mock/data";
import { clientById, payContractors, periodLockError } from "@/lib/mock/finance";
import { bad, body, requireFinance, respond } from "@/lib/mock/fin/http";
import type { ContractAssignment } from "@/lib/types";

// Contract staffing: assignments (bill rate vs pay rate), monthly timesheets, margin
export async function GET() {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const asg = contractAssignments.filter((a) => a.orgId === me.orgId);
    const ts = timesheets.filter((t) => t.orgId === me.orgId);
    return NextResponse.json({
        assignments: asg.map((a) => {
            const mine = ts.filter((t) => t.assignmentId === a.id);
            return { ...a, marginPct: a.billRate ? Math.round(((a.billRate - a.payRate) / a.billRate) * 1000) / 10 : 0, billedToDate: mine.filter((t) => t.status === "INVOICED").reduce((s, t) => s + t.billAmount, 0) };
        }),
        timesheets: ts.map((t) => ({ ...t, assignment: asg.find((a) => a.id === t.assignmentId) ?? null })).sort((a, b) => b.month.localeCompare(a.month)),
    });
}

// POST: { type: "assignment" } or { type: "timesheet" }
export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    if (b.type === "assignment") {
        const client = clientById(me.orgId, b.clientId);
        if (!client) return bad("Select a client");
        const billRate = Number(b.billRate), payRate = Number(b.payRate);
        if (!String(b.workerName ?? "").trim() || !String(b.role ?? "").trim()) return bad("Worker and role are required");
        if (!(billRate > 0) || !(payRate > 0)) return bad("Bill and pay rates must be positive");
        if (payRate > billRate) return bad("Pay rate is above the bill rate (negative margin)");
        if (!["DAILY", "HOURLY", "MONTHLY"].includes(b.rateType)) return bad("Select a rate type");
        const a: ContractAssignment = {
            id: `ctr-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, clientId: client.id, clientName: client.companyName, workerName: String(b.workerName).trim(),
            workerEmail: b.workerEmail || null, candidateId: b.candidateId || null, role: String(b.role).trim(), rateType: b.rateType, billRate, payRate,
            startDate: b.startDate || new Date().toISOString().split("T")[0], endDate: b.endDate || null, status: "ACTIVE", recruiterId: b.recruiterId || null,
            createdByName: me.name, createdAt: new Date().toISOString(),
        };
        contractAssignments.unshift(a);
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "CONTRACT_ASSIGNMENT_CREATED", entity: "ContractAssignment", entityId: a.id, detail: `${a.workerName} @ ${a.clientName}: bill ₹${billRate} / pay ₹${payRate} ${a.rateType}` });
        return NextResponse.json(a, { status: 201 });
    }
    if (b.type === "timesheet") {
        const a = contractAssignments.find((x) => x.id === b.assignmentId && x.orgId === me.orgId);
        if (!a) return bad("Assignment not found", 404);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month ?? "")) return bad("month must be YYYY-MM");
        const units = Number(b.units);
        const max = a.rateType === "DAILY" ? 31 : a.rateType === "HOURLY" ? 744 : 1;
        if (!(units > 0) || units > max) return bad(`Units must be between 0 and ${max}`);
        if (`${b.month}-31` < a.startDate || (a.endDate && `${b.month}-01` > a.endDate)) return bad("Month is outside the assignment period");
        const lock = periodLockError(me.orgId, `${b.month}-28`);
        if (lock) return bad(lock, 423);
        if (timesheets.some((t) => t.assignmentId === a.id && t.month === b.month && t.status !== "REJECTED")) return bad("A timesheet for this month already exists", 409);
        const t = {
            id: `ts-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, assignmentId: a.id, month: b.month, units,
            status: "SUBMITTED" as const, billAmount: Math.round(units * a.billRate), payAmount: Math.round(units * a.payRate),
            invoiceId: null, contractorPaid: false, approvedByName: null, submittedByName: b.submittedByName || me.name, createdAt: new Date().toISOString(),
        };
        timesheets.unshift(t);
        return NextResponse.json(t, { status: 201 });
    }
    return bad("type must be assignment or timesheet");
}

// PATCH: approve / reject timesheet · end assignment · pay contractors (batch)
export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    if (b.action === "pay_contractors") return respond(payContractors(me, Array.isArray(b.ids) ? b.ids : [], b.reference));
    if (b.action === "end_assignment") {
        const a = contractAssignments.find((x) => x.id === b.id && x.orgId === me.orgId);
        if (!a) return bad("Assignment not found", 404);
        a.status = "ENDED";
        a.endDate = b.endDate || new Date().toISOString().split("T")[0];
        return NextResponse.json(a);
    }
    const t = timesheets.find((x) => x.id === b.id && x.orgId === me.orgId);
    if (!t) return bad("Timesheet not found", 404);
    if (b.action === "approve" || b.action === "reject") {
        if (t.status !== "SUBMITTED") return bad(`Timesheet is ${t.status.toLowerCase()}`, 409);
        if (b.action === "reject" && !String(b.reason ?? "").trim()) return bad("A reason is required");
        t.status = b.action === "approve" ? "APPROVED" : "REJECTED";
        t.approvedByName = b.approvedByName || me.name;
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `TIMESHEET_${t.status}`, entity: "Timesheet", entityId: t.id, detail: `${t.month}: ${t.units} units${b.reason ? ` — ${b.reason}` : ""}` });
        return NextResponse.json(t);
    }
    return bad("Unknown action");
}
