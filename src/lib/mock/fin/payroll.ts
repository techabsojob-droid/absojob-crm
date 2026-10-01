// ─── Payroll statutory engine (India): PF, ESI, PT, TDS; disbursement & outputs ─────

import type { Employee, PayrollRecord, User } from "@/lib/types";
import { addAudit, addNotification, employees, leaveRequests, payrollRecords } from "../data";
import { notifyRoles } from "../pipeline";
import { fyOf, fyRange, periodLockError, settingsFor, today } from "./core";
import { declarationFor, payrollTaxFor, taxProjection } from "../ess";

/** Annual income tax (incl. 4% cess) under the new / old regime, after standard deduction and 87A rebate. */
export function annualTax(annualGross: number, regime: "NEW" | "OLD"): number {
    if (regime === "NEW") {
        const taxable = Math.max(0, annualGross - 75000);
        if (taxable <= 1200000) return 0; // 87A rebate
        const slabs: [number, number][] = [[400000, 0], [800000, 5], [1200000, 10], [1600000, 15], [2000000, 20], [2400000, 25], [Infinity, 30]];
        let tax = 0, prev = 0;
        for (const [upto, rate] of slabs) {
            if (taxable > prev) tax += (Math.min(taxable, upto) - prev) * (rate / 100);
            prev = upto;
        }
        return Math.round(tax * 1.04);
    }
    const taxable = Math.max(0, annualGross - 50000);
    if (taxable <= 500000) return 0;
    const slabs: [number, number][] = [[250000, 0], [500000, 5], [1000000, 20], [Infinity, 30]];
    let tax = 0, prev = 0;
    for (const [upto, rate] of slabs) {
        if (taxable > prev) tax += (Math.min(taxable, upto) - prev) * (rate / 100);
        prev = upto;
    }
    return Math.round(tax * 1.04);
}

/** Monthly professional tax by state slab. */
export function professionalTax(state: "MH" | "KA" | "NONE", gross: number, month: string): number {
    if (state === "MH") {
        if (gross <= 7500) return 0;
        if (gross <= 10000) return 175;
        return month.endsWith("-02") ? 300 : 200;
    }
    if (state === "KA") return gross >= 25000 ? 200 : 0;
    return 0;
}

function unpaidLeaveDays(userId: string | null | undefined, month: string): number {
    if (!userId) return 0;
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0);
    return leaveRequests
        .filter((l) => l.userId === userId && l.status === "APPROVED" && l.leaveType === "UNPAID")
        .reduce((sum, l) => {
            const from = new Date(Math.max(+new Date(l.fromDate), +start));
            const to = new Date(Math.min(+new Date(l.toDate), +end));
            return sum + (to >= from ? Math.round((+to - +from) / 86400000) + 1 : 0);
        }, 0);
}

/** Computes one month's payroll line for an employee with statutory deductions. */
export function computePayslip(orgId: string, emp: Employee, month: string): Omit<PayrollRecord, "id" | "status"> {
    const s = settingsFor(orgId);
    const cfg = s.payroll;
    const sal = emp.salary!;
    const earnings = sal.basic + sal.hra + sal.allowances;
    const lopDays = unpaidLeaveDays(emp.userId, month);
    const lopAmount = Math.round((earnings / 30) * lopDays);
    const gross = earnings - lopAmount;
    const basicEarned = Math.round(sal.basic * (1 - lopDays / 30));

    const pfWage = Math.min(basicEarned, cfg.pfWageCeiling);
    const pf = cfg.pfEnabled ? Math.round(pfWage * (cfg.pfRatePct / 100)) : 0;
    const employerPf = pf;
    const esiApplies = cfg.esiEnabled && gross <= cfg.esiWageCeiling;
    const esi = esiApplies ? Math.ceil(gross * (cfg.esiEmployeePct / 100)) : 0;
    const employerEsi = esiApplies ? Math.ceil(gross * (cfg.esiEmployerPct / 100)) : 0;
    const pt = professionalTax(cfg.ptState, gross, month);
    // Employee's own tax declaration (regime + deductions) drives TDS; otherwise the org default rule
    const declared = payrollTaxFor(emp, month);
    const tax = declared ? declared.monthly : Math.round(annualTax(earnings * 12 - pf * 12 * (cfg.taxRegime === "OLD" ? 1 : 0), cfg.taxRegime) / 12);
    const deductions = pf + esi + pt + lopAmount;

    return {
        orgId, employeeId: emp.id, employeeName: emp.name, employeeCode: emp.employeeId, department: emp.department, month,
        basicSalary: sal.basic, hra: sal.hra, allowances: sal.allowances, bonuses: 0, overtime: 0,
        deductions, tax, netSalary: Math.max(0, earnings - deductions - tax),
        paymentDate: null, paymentMethod: null, payslipUrl: null,
        pf, esi, pt, lopDays, lopAmount, employerPf, employerEsi, onHold: false, holdReason: null,
    };
}

export function generatePayroll(actor: User, month: string) {
    const eligible = employees.filter((e) => e.orgId === actor.orgId && e.status !== "EXITED" && e.salary && e.joiningDate <= `${month}-31`);
    const skipped = employees.filter((e) => e.orgId === actor.orgId && e.status !== "EXITED" && !e.salary).map((e) => e.name);
    let created = 0;
    for (const emp of eligible) {
        if (payrollRecords.some((p) => p.orgId === actor.orgId && p.employeeId === emp.id && p.month === month)) continue;
        payrollRecords.unshift({ id: `prl-${crypto.randomUUID().slice(0, 8)}`, status: "DRAFT", ...computePayslip(actor.orgId, emp, month) });
        created++;
    }
    return { created, skipped };
}

/** Finance releases a processed cycle (records on hold are skipped). */
export function disbursePayroll(actor: User, month: string, method = "BANK_TRANSFER"): { error?: string; status?: number; paid?: number; total?: number; held?: number } {
    const lock = periodLockError(actor.orgId, today());
    if (lock) return { error: lock, status: 423 };
    const cycle = payrollRecords.filter((p) => p.orgId === actor.orgId && p.month === month && p.status === "PROCESSED");
    const ready = cycle.filter((p) => !p.onHold);
    if (!ready.length) return { error: cycle.length ? "All processed salaries for this month are on hold" : "No processed payroll to disburse for this month", status: 409 };
    const day = today();
    ready.forEach((p) => {
        p.status = "PAID";
        p.paymentDate = day;
        p.paymentMethod = method;
        const emp = employees.find((e) => e.id === p.employeeId);
        if (emp?.userId) addNotification({ orgId: actor.orgId, userId: emp.userId, title: "Salary credited 💰", message: `Your ${month} salary of ₹${p.netSalary.toLocaleString("en-IN")} has been paid. Payslip is ready.`, link: "/portal/payslips" });
    });
    const total = ready.reduce((s, p) => s + p.netSalary, 0);
    const held = cycle.length - ready.length;
    addAudit({ orgId: actor.orgId, actorUserId: actor.id, actorRole: actor.role, action: "PAYROLL_DISBURSED", entity: "Payroll", entityId: month, detail: `${ready.length} salaries paid for ${month}, total ₹${total}${held ? `, ${held} on hold` : ""}` });
    notifyRoles(actor.orgId, ["HR_ADMIN"], { title: "Payroll disbursed", message: `${month}: ${ready.length} salaries, ₹${total.toLocaleString("en-IN")}${held ? ` (${held} on hold)` : ""}`, link: "/hr/payroll" });
    return { paid: ready.length, total, held };
}

/** NEFT/RTGS bulk-upload file for the bank (CSV). */
export function bankPaymentFile(orgId: string, month: string) {
    const s = settingsFor(orgId);
    const debitAc = (s.bankAccounts.find((b) => b.name.toLowerCase().includes("payroll")) ?? s.bankAccounts.find((b) => b.isDefault))?.accountNumber ?? s.bankAccountNumber;
    const rows = payrollRecords
        .filter((p) => p.orgId === orgId && p.month === month && ["PROCESSED", "PAID"].includes(p.status) && !p.onHold)
        .map((p) => {
            const emp = employees.find((e) => e.id === p.employeeId);
            const b = emp?.bankDetails;
            return {
                code: p.employeeCode, name: b?.accountName || p.employeeName, account: b?.accountNumber || "", ifsc: b?.ifscCode || "",
                amount: p.netSalary, mode: p.netSalary >= 200000 ? "RTGS" : "NEFT", missing: !b?.accountNumber || !b?.ifscCode,
            };
        });
    const header = ["Payment Type", "Debit Account", "Beneficiary Name", "Beneficiary Account", "IFSC", "Amount", "Narration", "Employee Code"];
    const csv = [header, ...rows.map((r) => [r.mode, debitAc, r.name, r.account, r.ifsc, r.amount.toFixed(2), `SALARY ${month}`, r.code])]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    return { csv, rows, missingBankDetails: rows.filter((r) => r.missing).map((r) => r.name) };
}

/** PF / ESI / PT / TDS liabilities for a month with challan due dates. */
export function statutorySummary(orgId: string, month: string) {
    const recs = payrollRecords.filter((p) => p.orgId === orgId && p.month === month && p.status !== "DRAFT");
    const sum = (f: (p: PayrollRecord) => number) => recs.reduce((s, p) => s + f(p), 0);
    const [y, m] = month.split("-").map(Number);
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    // Built as a plain string — Date#toISOString would shift the day in IST
    const due = (day: number) => `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(day, new Date(ny, nm, 0).getDate())).padStart(2, "0")}`;
    return {
        month,
        employees: recs.length,
        pf: { employee: sum((p) => p.pf ?? 0), employer: sum((p) => p.employerPf ?? 0), total: sum((p) => (p.pf ?? 0) + (p.employerPf ?? 0)), dueDate: due(15) },
        esi: { employee: sum((p) => p.esi ?? 0), employer: sum((p) => p.employerEsi ?? 0), total: sum((p) => (p.esi ?? 0) + (p.employerEsi ?? 0)), dueDate: due(15) },
        pt: { total: sum((p) => p.pt ?? 0), dueDate: due(30) },
        tds: { section: "192", total: sum((p) => p.tax), dueDate: due(7) },
        lines: recs.map((p) => ({ employeeCode: p.employeeCode, employeeName: p.employeeName, gross: p.basicSalary + p.hra + p.allowances - (p.lopAmount ?? 0), pf: p.pf ?? 0, employerPf: p.employerPf ?? 0, esi: p.esi ?? 0, employerEsi: p.employerEsi ?? 0, pt: p.pt ?? 0, tds: p.tax, net: p.netSalary })),
    };
}

/** Form 16 (Part B style) summary for an employee's financial year. */
export function form16(orgId: string, employeeId: string, fy: string) {
    const { from, to } = fyRange(fy);
    const recs = payrollRecords
        .filter((p) => p.orgId === orgId && p.employeeId === employeeId && p.status === "PAID" && `${p.month}-01` >= from && `${p.month}-01` <= to)
        .sort((a, b) => a.month.localeCompare(b.month));
    const emp = employees.find((e) => e.id === employeeId);
    const s = settingsFor(orgId);
    const gross = recs.reduce((sum, p) => sum + p.basicSalary + p.hra + p.allowances + p.bonuses + p.overtime - (p.lopAmount ?? 0), 0);
    const decl = declarationFor(employeeId, fy);
    const useDecl = !!decl && ["SUBMITTED", "VERIFIED"].includes(decl.status);
    const regime = useDecl ? decl!.regime : s.payroll.taxRegime;
    const stdDeduction = regime === "NEW" ? 75000 : 50000;
    const pt = recs.reduce((sum, p) => sum + (p.pt ?? 0), 0);
    const tds = recs.reduce((sum, p) => sum + p.tax, 0);
    const chapterVIA = useDecl && emp && regime === "OLD" ? taxProjection(emp, "OLD", decl).lines.filter((l) => l.label !== "Professional tax") : [];
    const viaTotal = chapterVIA.reduce((t, l) => t + l.amount, 0);
    return {
        fy, employer: { name: s.companyLegalName, pan: s.companyPan, tan: "MUMA12345B", address: s.companyAddress },
        employee: { name: emp?.name ?? "—", code: emp?.employeeId ?? "—", pan: emp?.bankDetails?.panNumber || "—", designation: emp?.designation ?? "—" },
        regime, declarationStatus: decl?.status ?? null, deductions: chapterVIA,
        months: recs.map((p) => ({ month: p.month, gross: p.basicSalary + p.hra + p.allowances - (p.lopAmount ?? 0), tds: p.tax })),
        grossSalary: gross, standardDeduction: stdDeduction, professionalTax: pt,
        taxableIncome: Math.max(0, gross - stdDeduction - (regime === "OLD" ? pt + viaTotal : 0)),
        tdsDeducted: tds,
    };
}

export { fyOf };
