import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { payrollRecords, addAudit } from "@/lib/mock/data";
import { disbursePayroll, generatePayroll, periodLockError } from "@/lib/mock/finance";
import { notifyRoles } from "@/lib/mock/pipeline";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET: list payroll records filtered by month and query (+ cycle summary)
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const month = url.searchParams.get("month");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = payrollRecords.filter((p) => p.orgId === me.orgId);

    if (month && month !== "ALL") {
        list = list.filter((p) => p.month === month);
    }
    if (q) {
        list = list.filter((p) => p.employeeName.toLowerCase().includes(q) || p.employeeCode.toLowerCase().includes(q));
    }

    return NextResponse.json(list);
}

// POST: generate the draft payroll for a month (statutory PF / ESI / PT / TDS + unpaid leave)
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { month } = await request.json();
    if (!MONTH_RE.test(month ?? "")) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
    const lock = periodLockError(me.orgId, `${month}-28`);
    if (lock) return NextResponse.json({ error: lock }, { status: 423 });

    const { created, skipped } = generatePayroll(me, month);
    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "PAYROLL_GENERATED", entity: "Payroll", entityId: month,
        detail: `Draft payroll for ${month}: ${created} record(s) created${skipped.length ? `; missing salary: ${skipped.join(", ")}` : ""}`,
    });
    return NextResponse.json({ month, created, skipped }, { status: 201 });
}

// PATCH: advance a payroll cycle (DRAFT → PROCESSED → PAID) or adjust one record
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();

    // Single-record adjustment while still a draft
    if (body.id) {
        const rec = payrollRecords.find((p) => p.id === body.id && p.orgId === me.orgId);
        if (!rec) return NextResponse.json({ error: "Payroll record not found" }, { status: 404 });
        if (rec.status !== "DRAFT") return NextResponse.json({ error: "Only draft records can be adjusted" }, { status: 409 });
        const before = rec.netSalary;
        (["bonuses", "overtime", "deductions", "tax"] as const).forEach((k) => {
            if (body[k] !== undefined) rec[k] = Math.max(0, Number(body[k]) || 0);
        });
        rec.netSalary = Math.max(0, rec.basicSalary + rec.hra + rec.allowances + rec.bonuses + rec.overtime - rec.deductions - rec.tax);
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "PAYROLL_ADJUSTED", entity: "Payroll", entityId: rec.id,
            detail: `${rec.employeeName} ${rec.month}: net ${before} → ${rec.netSalary}`,
        });
        return NextResponse.json(rec);
    }

    const { month, action } = body;
    if (!MONTH_RE.test(month ?? "")) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
    const cycle = payrollRecords.filter((p) => p.orgId === me.orgId && p.month === month);
    if (!cycle.length) return NextResponse.json({ error: "Generate the draft payroll for this month first" }, { status: 422 });

    if (action === "process") {
        const drafts = cycle.filter((p) => p.status === "DRAFT");
        if (!drafts.length) return NextResponse.json({ error: "No draft records to process" }, { status: 409 });
        drafts.forEach((p) => { p.status = "PROCESSED"; });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "PAYROLL_PROCESSED", entity: "Payroll", entityId: month, detail: `${drafts.length} record(s) locked for ${month}` });
        const total = drafts.reduce((s, p) => s + p.netSalary, 0);
        notifyRoles(me.orgId, ["FINANCE_ADMIN"], { title: "Payroll ready for disbursement", message: `${month}: ${drafts.length} salaries, ₹${total.toLocaleString("en-IN")}`, link: "/finance/payroll" });
        return NextResponse.json({ month, processed: drafts.length });
    }

    if (action === "pay") {
        // Segregation of duties: HR prepares payroll, Finance releases the money
        if (me.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Payroll is disbursed by Finance. It has been sent to the Finance team." }, { status: 403 });
        }
        const r = disbursePayroll(me, month, body.paymentMethod);
        if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ month, paid: r.paid, total: r.total });
    }

    return NextResponse.json({ error: "action must be process or pay" }, { status: 400 });
}
