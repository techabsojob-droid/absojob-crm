import { NextResponse } from "next/server";
import { addAudit } from "@/lib/mock/data";
import { GSTIN_RE, IFSC_RE, PAN_RE, settingsFor } from "@/lib/mock/finance";
import { bad, body, requireFinance } from "@/lib/mock/fin/http";
import type { BankAccount } from "@/lib/types";

export async function GET() {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    return NextResponse.json(settingsFor(auth.user.orgId));
}

export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const s = settingsFor(me.orgId);
    const changed: string[] = [];
    const num = (k: string, min: number, max: number) => {
        if (b[k] === undefined) return null;
        const v = Number(b[k]);
        if (!(v >= min && v <= max)) return `${k} must be between ${min} and ${max}`;
        if ((s as unknown as Record<string, number>)[k] !== v) { (s as unknown as Record<string, number>)[k] = v; changed.push(k); }
        return null;
    };
    for (const [k, min, max] of [["gstRate", 0, 28], ["defaultCreditDays", 0, 180], ["reimbursementLimitInr", 0, 1e7], ["invoiceApprovalThresholdInr", 0, 1e9], ["vendorPaymentApprovalThresholdInr", 0, 1e9], ["commissionTdsPct", 0, 20], ["recruiterIncentivePct", 0, 50], ["guaranteeDaysDefault", 0, 365], ["creditHoldOverdueDays", 1, 365]] as const) {
        const err = num(k, min, max);
        if (err) return bad(err);
    }
    if (b.companyGstin && !GSTIN_RE.test(String(b.companyGstin).toUpperCase())) return bad("Company GSTIN format is invalid");
    if (b.companyPan && !PAN_RE.test(String(b.companyPan).toUpperCase())) return bad("Company PAN format is invalid");
    if (b.bankIfsc && !IFSC_RE.test(String(b.bankIfsc).toUpperCase())) return bad("IFSC format is invalid");
    if (b.companyStateCode !== undefined && !/^\d{2}$/.test(String(b.companyStateCode))) return bad("State code must be 2 digits");
    for (const k of ["invoicePrefix", "creditNotePrefix", "debitNotePrefix", "receiptPrefix", "companyLegalName", "companyAddress", "companyGstin", "companyPan", "lutNumber", "bankName", "bankAccountNumber", "bankIfsc", "companyStateCode", "sacCode"] as const) {
        if (b[k] !== undefined && String(b[k]) !== s[k]) { s[k] = ["companyGstin", "companyPan", "bankIfsc"].includes(k) ? String(b[k]).toUpperCase().trim() : String(b[k]).trim(); changed.push(k); }
    }
    if (b.eInvoiceEnabled !== undefined) { s.eInvoiceEnabled = !!b.eInvoiceEnabled; changed.push("eInvoiceEnabled"); }
    if (b.reminderDays !== undefined) {
        const days = (Array.isArray(b.reminderDays) ? b.reminderDays : String(b.reminderDays).split(",")).map((x: string | number) => Number(x)).filter((x: number) => Number.isFinite(x) && x >= -30 && x <= 180);
        s.reminderDays = Array.from(new Set(days as number[])).sort((a, b) => a - b);
        changed.push("reminderDays");
    }
    if (b.expenseCategoryLimits !== undefined && typeof b.expenseCategoryLimits === "object") { s.expenseCategoryLimits = b.expenseCategoryLimits; changed.push("expenseCategoryLimits"); }
    if (b.payroll !== undefined) {
        const p = b.payroll;
        if (p.ptState && !["MH", "KA", "NONE"].includes(p.ptState)) return bad("Unsupported PT state");
        if (p.taxRegime && !["NEW", "OLD"].includes(p.taxRegime)) return bad("Tax regime must be NEW or OLD");
        s.payroll = { ...s.payroll, ...p };
        changed.push("payroll");
    }
    if (b.bankAccounts !== undefined) {
        const list: BankAccount[] = (Array.isArray(b.bankAccounts) ? b.bankAccounts : []).map((a: BankAccount, i: number) => ({ id: a.id || `bank-${crypto.randomUUID().slice(0, 6)}`, name: String(a.name || `Account ${i + 1}`), bankName: String(a.bankName || ""), accountNumber: String(a.accountNumber || ""), ifsc: String(a.ifsc || "").toUpperCase(), openingBalance: Number(a.openingBalance) || 0, isDefault: !!a.isDefault }));
        if (list.some((a) => a.ifsc && !IFSC_RE.test(a.ifsc))) return bad("One of the bank IFSC codes is invalid");
        if (list.length && !list.some((a) => a.isDefault)) list[0].isDefault = true;
        s.bankAccounts = list;
        changed.push("bankAccounts");
    }
    // Period close: finance can lock forward; only the Super Admin can reopen an earlier period
    if (b.lockedUntil !== undefined) {
        const next = b.lockedUntil || null;
        if (next && !/^\d{4}-\d{2}-\d{2}$/.test(next)) return bad("Lock date must be YYYY-MM-DD");
        if (next && next > new Date().toISOString().split("T")[0]) return bad("Cannot lock a future date");
        if ((!next || (s.lockedUntil && next < s.lockedUntil)) && me.role !== "SUPER_ADMIN") return bad("Only the Super Admin can reopen a closed period", 403);
        s.lockedUntil = next;
        changed.push(`lockedUntil=${next ?? "open"}`);
    }
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "FINANCE_SETTINGS_UPDATED", entity: "FinanceSettings", entityId: me.orgId, detail: changed.join(", ") || "no changes" });
    return NextResponse.json(s);
}
