// ─── Payables: incentives, clawbacks, vendors, contractors, F&F, expenses ─────

import type { CommissionLedgerEntry, Expense, PaymentMethod, PlacementRecord, User, Vendor, VendorBill } from "@/lib/types";
import {
    addAudit, addNotification, applications, candidates, commissionLedger, contractAssignments, employees, exitRecords, expenses, fnfPayments,
    agentProfiles, payeeProfiles, payouts, referrals, timesheets, users, vendorBills, vendors,
} from "../data";
import { notifyRoles } from "../pipeline";
import { approversFor } from "../identity";
import { addDays, daysBetween, periodLockError, round2, settingsFor, today } from "./core";

type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = <T>(error: string, status = 409): Result<T> => ({ ok: false, error, status });
const okr = <T>(value: T): Result<T> => ({ ok: true, value });
const METHODS: PaymentMethod[] = ["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD"];

// ─── Incentives (referral + recruiter) with 194H TDS and clawback netting ─────

const INCENTIVE_TYPES = ["REFERRAL_INCENTIVE", "RECRUITER_INCENTIVE"];

export function pendingClawbacks(orgId: string, userId: string) {
    return commissionLedger.filter((l) => l.orgId === orgId && l.userId === userId && l.type === "CLAWBACK" && l.status === "PENDING");
}

export function payIncentives(actor: User, ids: string[], method: PaymentMethod, reference?: string | null): Result<{ paid: number; gross: number; tds: number; recovered: number; net: number }> {
    if (!METHODS.includes(method)) return fail("Select a payment method", 400);
    const entries = ids.map((id) => commissionLedger.find((l) => l.id === id && l.orgId === actor.orgId && INCENTIVE_TYPES.includes(l.type)));
    if (entries.some((e) => !e)) return fail("Incentive not found", 404);
    if (entries.some((e) => !["PENDING", "APPROVED"].includes(e!.status))) return fail("Some incentives are already paid or cancelled");
    const lock = periodLockError(actor.orgId, today());
    if (lock) return fail(lock, 423);
    // External partners are paid only after their KYC is verified
    const unverified = entries.map((e) => agentProfiles.find((p) => p.userId === e!.userId)).find((p) => p && p.kycStatus !== "VERIFIED");
    if (unverified) return fail(`${users.find((u) => u.id === unverified.userId)?.name ?? "Partner"}'s KYC is not verified — payout on hold`, 422);
    const s = settingsFor(actor.orgId);
    const now = new Date().toISOString();
    let gross = 0, tds = 0, recovered = 0, net = 0;

    // One payout per payee: gross − 194H TDS − pending clawbacks
    const byPayee = new Map<string, CommissionLedgerEntry[]>();
    entries.forEach((e) => { const list = byPayee.get(e!.userId!) ?? []; list.push(e!); byPayee.set(e!.userId!, list); });
    byPayee.forEach((list, payeeId) => {
        const g = list.reduce((sum, e) => sum + Math.abs(e.amountInr), 0);
        const t = Math.round(g * (s.commissionTdsPct / 100));
        // Recover pending clawbacks from this payout (fully or partially)
        let room = g - t;
        let rec = 0;
        pendingClawbacks(actor.orgId, payeeId).forEach((c) => {
            if (room <= 0) return;
            const owed = Math.abs(c.amountInr);
            const take = Math.min(owed, room);
            room -= take;
            rec += take;
            if (take >= owed) { c.status = "PAID"; c.paidAt = now; }
            else c.amountInr = -(owed - take); // remainder stays pending
        });
        const n = g - t - rec;
        list.forEach((e) => {
            e.status = "PAID";
            e.paidAt = now;
            e.tdsAmount = Math.round(Math.abs(e.amountInr) * (s.commissionTdsPct / 100));
            if (e.type === "REFERRAL_INCENTIVE" && e.applicationId) {
                const app = applications.find((a) => a.id === e.applicationId);
                const ref = app ? referrals.find((r) => r.agentId === e.userId && r.candidateId === app.candidateId) : undefined;
                if (ref) ref.incentivePaid = true;
            }
        });
        payouts.unshift({
            id: `pay-${crypto.randomUUID().slice(0, 8)}`, orgId: actor.orgId, userId: payeeId, amountInr: n,
            periodLabel: new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }), status: "PAID",
            method: ["BANK_TRANSFER", "UPI", "CHEQUE"].includes(method) ? (method as "BANK_TRANSFER" | "UPI" | "CHEQUE") : "BANK_TRANSFER",
            reference: reference || null, processedAt: now, createdAt: now,
        });
        addNotification({
            orgId: actor.orgId, userId: payeeId, title: "Incentive paid 💸",
            message: `₹${n.toLocaleString("en-IN")} credited (gross ₹${g.toLocaleString("en-IN")}, TDS ₹${t.toLocaleString("en-IN")}${rec ? `, clawback recovered ₹${rec.toLocaleString("en-IN")}` : ""})`,
            link: "/portal/incentives",
        });
        gross += g; tds += t; recovered += rec; net += n;
    });
    addAudit({ orgId: actor.orgId, actorUserId: actor.id, actorRole: actor.role, action: "INCENTIVES_PAID", entity: "CommissionLedgerEntry", entityId: ids.join(","), detail: `${ids.length} incentive(s): gross ₹${gross}, TDS ₹${tds}, recovered ₹${recovered}, net ₹${net}` });
    return okr({ paid: ids.length, gross, tds, recovered, net });
}

/**
 * A placement fell through inside the client's guarantee window:
 * unpaid incentives are cancelled, paid ones become a clawback recovered from the next payout.
 */
export function handlePlacementFallThrough(actor: User, p: PlacementRecord) {
    const inGuarantee = !p.guaranteeEndDate || today() <= p.guaranteeEndDate;
    if (!inGuarantee) return { cancelled: 0, clawbacks: 0 };
    const app = applications.find((a) => a.candidateId === p.candidateId && a.jobId === p.jobId && a.orgId === p.orgId);
    const related = commissionLedger.filter((l) =>
        l.orgId === p.orgId && INCENTIVE_TYPES.includes(l.type) &&
        ((l.placementId && l.placementId === p.id) || (app && l.applicationId === app.id))
    );
    let cancelled = 0, clawbacks = 0;
    related.forEach((l) => {
        if (["PENDING", "APPROVED"].includes(l.status)) { l.status = "CANCELLED"; cancelled++; return; }
        if (l.status !== "PAID") return;
        if (commissionLedger.some((c) => c.type === "CLAWBACK" && c.invoiceNumber === `clawback:${l.id}`)) return;
        commissionLedger.unshift({
            id: `led-${crypto.randomUUID().slice(0, 8)}`, orgId: p.orgId, userId: l.userId, clientId: p.clientId, applicationId: l.applicationId,
            type: "CLAWBACK", amountInr: -Math.abs(l.amountInr), status: "PENDING",
            description: `Clawback — ${p.candidateName} left ${p.clientName} within guarantee (${l.description})`,
            invoiceNumber: `clawback:${l.id}`, dueDate: null, paidAt: null, placementId: p.id, createdAt: new Date().toISOString(),
        });
        clawbacks++;
        if (l.userId) addNotification({ orgId: p.orgId, userId: l.userId, title: "Incentive clawback", message: `₹${Math.abs(l.amountInr).toLocaleString("en-IN")} will be recovered from your next payout — ${p.candidateName} left within the guarantee period`, link: "/portal/incentives" });
    });
    if (cancelled || clawbacks) {
        addAudit({ orgId: p.orgId, actorUserId: actor.id, actorRole: actor.role, action: "INCENTIVE_CLAWBACK", entity: "Placement", entityId: p.id, detail: `${p.candidateName}: ${cancelled} cancelled, ${clawbacks} clawback(s)` });
    }
    return { cancelled, clawbacks };
}

// ─── Vendors & bills (accounts payable) ──────────────────────

export function tdsRateFor(vendor: Vendor): number {
    switch (vendor.tdsSection) {
        case "194C": return vendor.pan && vendor.pan[3] === "C" ? 2 : 1; // company vs individual/HUF
        case "194J": return 10;
        case "194I": return 10;
        default: return 0;
    }
}

export function createVendorBill(actor: User, input: { vendorId: string; billNumber: string; billDate: string; dueDate?: string; description: string; amount: number; gstAmount?: number; recurring?: boolean; fileId?: string | null; category?: Vendor["category"] }): Result<VendorBill> {
    const v = vendors.find((x) => x.id === input.vendorId && x.orgId === actor.orgId && x.active);
    if (!v) return fail("Vendor not found", 404);
    const amount = round2(Number(input.amount) || 0);
    if (amount <= 0 || !String(input.billNumber ?? "").trim() || !String(input.description ?? "").trim()) return fail("Bill number, description and amount are required", 400);
    if (vendorBills.some((b) => b.orgId === actor.orgId && b.vendorId === v.id && b.billNumber.toLowerCase() === input.billNumber.trim().toLowerCase() && b.status !== "CANCELLED")) {
        return fail("This vendor bill number is already recorded (duplicate)", 409);
    }
    const billDate = input.billDate || today();
    const lock = periodLockError(actor.orgId, billDate);
    if (lock) return fail(lock, 423);
    const gst = round2(Math.max(0, Number(input.gstAmount) || 0));
    const tds = Math.round(amount * (tdsRateFor(v) / 100));
    const s = settingsFor(actor.orgId);
    const total = round2(amount + gst);
    const bill: VendorBill = {
        id: `vb-${crypto.randomUUID().slice(0, 8)}`, orgId: actor.orgId, vendorId: v.id, vendorName: v.name, billNumber: input.billNumber.trim(),
        billDate, dueDate: input.dueDate || addDays(billDate, v.paymentTermsDays), category: input.category ?? v.category, description: input.description.trim(),
        amount, gstAmount: gst, tdsSection: v.tdsSection ?? "NONE", tdsAmount: tds, total, payable: round2(total - tds), amountPaid: 0, payments: [],
        // maker-checker: large bills need someone else's approval
        status: total > s.vendorPaymentApprovalThresholdInr && actor.role !== "SUPER_ADMIN" ? "PENDING_APPROVAL" : "APPROVED",
        recurring: !!input.recurring, recurringNextDate: input.recurring ? addDays(billDate, 30) : null, fileId: input.fileId ?? null,
        approvedByName: null, createdByName: actor.name, createdAt: new Date().toISOString(),
    };
    if (bill.status === "APPROVED") bill.approvedByName = `${actor.name} (within limit)`;
    vendorBills.unshift(bill);
    addAudit({ orgId: actor.orgId, actorUserId: actor.id, actorRole: actor.role, action: "VENDOR_BILL_CREATED", entity: "VendorBill", entityId: bill.id, detail: `${v.name} ${bill.billNumber} ₹${total} (TDS ${bill.tdsSection} ₹${tds})` });
    if (bill.status === "PENDING_APPROVAL") notifyRoles(actor.orgId, ["SUPER_ADMIN", "FINANCE_ADMIN"], { title: "Vendor bill needs approval", message: `${v.name} ${bill.billNumber} · ₹${total.toLocaleString("en-IN")}`, link: "/finance/vendors" });
    return okr(bill);
}

export function refreshBillStatus(b: VendorBill) {
    if (["CANCELLED", "PENDING_APPROVAL"].includes(b.status)) return b.status;
    if (b.amountPaid >= b.payable - 0.01) b.status = "PAID";
    else if (b.dueDate < today()) b.status = "OVERDUE";
    else b.status = b.amountPaid > 0 ? "PARTIALLY_PAID" : "APPROVED";
    return b.status;
}

export function payVendorBill(actor: User, bill: VendorBill, amount: number, method: PaymentMethod, reference?: string | null, date?: string): Result<VendorBill> {
    if (["PENDING_APPROVAL", "CANCELLED", "PAID"].includes(bill.status)) return fail(`Bill is ${bill.status.toLowerCase().replace("_", " ")}`);
    const due = round2(bill.payable - bill.amountPaid);
    const amt = round2(Number(amount) || due);
    if (amt <= 0 || amt > due + 0.01) return fail(`Payment must be between 1 and ₹${due}`, 400);
    if (!METHODS.includes(method)) return fail("Select a payment method", 400);
    const d = date || today();
    const lock = periodLockError(actor.orgId, d);
    if (lock) return fail(lock, 423);
    bill.payments.push({ id: `vpay-${crypto.randomUUID().slice(0, 8)}`, amount: amt, date: d, method, reference: reference || null, byName: actor.name });
    bill.amountPaid = round2(bill.amountPaid + amt);
    refreshBillStatus(bill);
    addAudit({ orgId: actor.orgId, actorUserId: actor.id, actorRole: actor.role, action: "VENDOR_PAID", entity: "VendorBill", entityId: bill.id, detail: `${bill.vendorName} ${bill.billNumber}: ₹${amt} via ${method}` });
    return okr(bill);
}

/** Generates the next month's copy of recurring vendor bills (e.g. rent). */
export function runRecurringBills(orgId: string) {
    const t = today();
    let created = 0;
    vendorBills.filter((b) => b.orgId === orgId && b.recurring && b.recurringNextDate && b.recurringNextDate <= t && b.status !== "CANCELLED").forEach((b) => {
        const v = vendors.find((x) => x.id === b.vendorId);
        if (!v) return;
        const billDate = b.recurringNextDate!;
        const number = `${b.billNumber.replace(/\/R\d+$/, "")}/R${billDate.slice(0, 7)}`;
        if (!vendorBills.some((x) => x.vendorId === b.vendorId && x.billNumber === number)) {
            const copy: VendorBill = {
                ...b, id: `vb-${crypto.randomUUID().slice(0, 8)}`, billNumber: number, billDate, dueDate: addDays(billDate, v.paymentTermsDays),
                amountPaid: 0, payments: [], status: "APPROVED", recurring: true, recurringNextDate: addDays(billDate, 30),
                approvedByName: "Recurring (auto)", createdByName: "Recurring (auto)", createdAt: new Date().toISOString(),
            };
            vendorBills.unshift(copy);
            created++;
        }
        b.recurring = false; // the newest copy carries the schedule forward
        b.recurringNextDate = null;
    });
    return created;
}

// ─── Contract staffing: contractor pay ───────────────────────

export function payContractors(actor: User, timesheetIds: string[], reference?: string | null): Result<{ paid: number; total: number }> {
    const list = timesheetIds.map((id) => timesheets.find((t) => t.id === id && t.orgId === actor.orgId));
    if (list.some((t) => !t)) return fail("Timesheet not found", 404);
    if (list.some((t) => !["APPROVED", "INVOICED"].includes(t!.status) || t!.contractorPaid)) return fail("Only approved, unpaid timesheets can be paid");
    let total = 0;
    list.forEach((t) => {
        t!.contractorPaid = true;
        total += t!.payAmount;
        const asg = contractAssignments.find((a) => a.id === t!.assignmentId);
        addAudit({ orgId: actor.orgId, actorUserId: actor.id, actorRole: actor.role, action: "CONTRACTOR_PAID", entity: "Timesheet", entityId: t!.id, detail: `${asg?.workerName}: ${t!.month} ₹${t!.payAmount}${reference ? ` · ${reference}` : ""}` });
    });
    return okr({ paid: list.length, total });
}

// ─── Full & final settlement ─────────────────────────────────

export function queueFnf(actor: User, exitId: string, amount: number) {
    const ex = exitRecords.find((e) => e.id === exitId);
    if (!ex) return null;
    const existing = fnfPayments.find((f) => f.exitId === exitId && f.status === "PENDING");
    if (existing) { existing.amount = amount; return existing; }
    const f = { id: `fnf-${crypto.randomUUID().slice(0, 8)}`, orgId: ex.orgId, exitId, employeeId: ex.employeeId, employeeName: ex.employeeName, amount, status: "PENDING" as const, paidAt: null, reference: null, createdAt: new Date().toISOString() };
    fnfPayments.unshift(f);
    notifyRoles(ex.orgId, ["FINANCE_ADMIN"], { title: "F&F settlement to pay", message: `${ex.employeeName}: ₹${amount.toLocaleString("en-IN")}`, link: "/finance/payroll" });
    void actor;
    return f;
}

export function payFnf(actor: User, id: string, reference?: string | null): Result<(typeof fnfPayments)[number]> {
    const f = fnfPayments.find((x) => x.id === id && x.orgId === actor.orgId);
    if (!f) return fail("F&F payment not found", 404);
    if (f.status === "PAID") return fail("Already paid");
    f.status = "PAID";
    f.paidAt = new Date().toISOString();
    f.reference = reference || null;
    const ex = exitRecords.find((e) => e.id === f.exitId);
    if (ex) ex.fnfPaid = true;
    notifyRoles(actor.orgId, ["HR_ADMIN"], { title: "F&F paid", message: `${f.employeeName}: ₹${f.amount.toLocaleString("en-IN")} released — exit can be completed`, link: "/hr/exit" });
    const emp = employees.find((e) => e.id === f.employeeId);
    if (emp?.userId) addNotification({ orgId: actor.orgId, userId: emp.userId, title: "Full & final paid", message: `₹${f.amount.toLocaleString("en-IN")} has been credited`, link: null });
    addAudit({ orgId: actor.orgId, actorUserId: actor.id, actorRole: actor.role, action: "FNF_PAID", entity: "FnfPayment", entityId: f.id, detail: `${f.employeeName}: ₹${f.amount}` });
    return okr(f);
}

// ─── Expenses: policy + two-step approval ────────────────────

export function initialExpenseStatus(orgId: string, submitterId: string, isReimbursement: boolean): Expense["status"] {
    if (!isReimbursement) return "PENDING";
    const { managerUserId } = approversFor(submitterId);
    return managerUserId ? "PENDING_MANAGER" : "PENDING";
}

export function policyFlagFor(orgId: string, category: Expense["category"], amount: number): string | null {
    const s = settingsFor(orgId);
    const cap = s.expenseCategoryLimits?.[category];
    if (cap && amount > cap) return `Above ${category.toLowerCase()} policy limit of ₹${cap.toLocaleString("en-IN")}`;
    if (amount > s.reimbursementLimitInr) return `Above reimbursement limit of ₹${s.reimbursementLimitInr.toLocaleString("en-IN")}`;
    return null;
}

/** Reporting manager can approve their direct report's claim (step 1). */
export function canManagerApprove(me: User, e: Expense) {
    return e.status === "PENDING_MANAGER" && approversFor(e.submittedById).managerUserId === me.id;
}

export function expensesAwaitingManager(me: User) {
    return expenses.filter((e) => e.orgId === me.orgId && canManagerApprove(me, e));
}

export function daysToDue(date: string) {
    return daysBetween(today(), date);
}

export function payeeProfileOf(userId: string) {
    return payeeProfiles.find((p) => p.userId === userId) ?? null;
}

export function payeeName(userId: string | null | undefined) {
    return users.find((u) => u.id === userId)?.name ?? "—";
}

export function candidateNameForApp(appId: string | null | undefined) {
    const app = appId ? applications.find((a) => a.id === appId) : undefined;
    return app ? candidates.find((c) => c.id === app.candidateId)?.name ?? null : null;
}


