import { NextResponse } from "next/server";
import { payrollRecords, fnfPayments, employees, addAudit } from "@/lib/mock/data";
import { bankPaymentFile, disbursePayroll, form16, payFnf, statutorySummary } from "@/lib/mock/finance";
import { bad, body, csvResponse, requireFinance, respond } from "@/lib/mock/fin/http";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET: cycles · ?export=bank|register&month= · ?view=statutory&month= · ?view=form16&employeeId=&fy=
export async function GET(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const url = new URL(request.url);
    const month = url.searchParams.get("month");
    const exp = url.searchParams.get("export");
    const view = url.searchParams.get("view");

    if (exp === "bank") {
        if (!MONTH.test(month ?? "")) return bad("month must be YYYY-MM");
        return csvResponse(bankPaymentFile(me.orgId, month!).csv, `salary-bank-file-${month}.csv`);
    }
    if (exp === "register") {
        if (!MONTH.test(month ?? "")) return bad("month must be YYYY-MM");
        const recs = payrollRecords.filter((p) => p.orgId === me.orgId && p.month === month);
        const rows = [["Code", "Name", "Department", "Basic", "HRA", "Allowances", "LOP", "Gross", "PF", "ESI", "PT", "TDS", "Net", "Employer PF", "Employer ESI", "Status"],
            ...recs.map((p) => [p.employeeCode, p.employeeName, p.department, p.basicSalary, p.hra, p.allowances, p.lopAmount ?? 0, p.basicSalary + p.hra + p.allowances - (p.lopAmount ?? 0), p.pf ?? 0, p.esi ?? 0, p.pt ?? 0, p.tax, p.netSalary, p.employerPf ?? 0, p.employerEsi ?? 0, p.onHold ? "ON HOLD" : p.status])];
        return csvResponse(rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"), `salary-register-${month}.csv`);
    }
    if (view === "statutory") {
        if (!MONTH.test(month ?? "")) return bad("month must be YYYY-MM");
        return NextResponse.json(statutorySummary(me.orgId, month!));
    }
    if (view === "form16") {
        const emp = employees.find((e) => e.id === url.searchParams.get("employeeId") && e.orgId === me.orgId);
        if (!emp) return bad("Employee not found", 404);
        return NextResponse.json(form16(me.orgId, emp.id, url.searchParams.get("fy") || ""));
    }

    const org = payrollRecords.filter((p) => p.orgId === me.orgId);
    const months = Array.from(new Set(org.map((p) => p.month))).sort().reverse();
    const cycles = months.map((m) => {
        const recs = org.filter((p) => p.month === m);
        const sum = (f: (p: (typeof recs)[number]) => number) => recs.reduce((s, p) => s + f(p), 0);
        return {
            month: m, employees: recs.length,
            gross: sum((p) => p.basicSalary + p.hra + p.allowances + p.bonuses + p.overtime - (p.lopAmount ?? 0)),
            statutory: sum((p) => (p.pf ?? 0) + (p.esi ?? 0) + (p.pt ?? 0)), tax: sum((p) => p.tax), net: sum((p) => p.netSalary),
            employerCost: sum((p) => (p.employerPf ?? 0) + (p.employerEsi ?? 0)),
            draft: recs.filter((p) => p.status === "DRAFT").length, processed: recs.filter((p) => p.status === "PROCESSED" && !p.onHold).length,
            onHold: recs.filter((p) => p.onHold && p.status !== "PAID").length, paid: recs.filter((p) => p.status === "PAID").length,
            paidOn: recs.find((p) => p.paymentDate)?.paymentDate ?? null,
            missingBank: MONTH.test(m) ? bankPaymentFile(me.orgId, m).missingBankDetails : [],
        };
    });
    return NextResponse.json({
        cycles,
        records: month ? org.filter((p) => p.month === month) : [],
        fnf: fnfPayments.filter((f) => f.orgId === me.orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        employees: employees.filter((e) => e.orgId === me.orgId).map((e) => ({ id: e.id, name: e.name, code: e.employeeId })),
    });
}

// PATCH: disburse a month · hold / release one salary · pay an F&F settlement
export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);

    if (b.action === "hold" || b.action === "release") {
        const rec = payrollRecords.find((p) => p.id === b.id && p.orgId === me.orgId);
        if (!rec) return bad("Payroll record not found", 404);
        if (rec.status === "PAID") return bad("Salary already paid", 409);
        if (b.action === "hold" && !String(b.reason ?? "").trim()) return bad("A reason is required to hold a salary");
        rec.onHold = b.action === "hold";
        rec.holdReason = rec.onHold ? String(b.reason).trim() : null;
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: rec.onHold ? "SALARY_HELD" : "SALARY_RELEASED", entity: "Payroll", entityId: rec.id, detail: `${rec.employeeName} ${rec.month}${rec.holdReason ? ` — ${rec.holdReason}` : ""}` });
        return NextResponse.json(rec);
    }
    if (b.action === "pay_fnf") return respond(payFnf(me, b.id, b.reference));

    if (!MONTH.test(b.month ?? "")) return bad("month must be YYYY-MM");
    const r = disbursePayroll(me, b.month, b.paymentMethod);
    if (r.error) return bad(r.error, r.status);
    return NextResponse.json({ month: b.month, paid: r.paid, total: r.total, held: r.held });
}
