// ─── Receivables: invoices, receipts, notes, dunning, recurring, credit hold ─────

import type { BillingMilestone, Currency, Invoice, InvoiceKind, InvoiceLineItem, InvoiceStatus, PaymentMethod, PlacementRecord, Receipt, User } from "@/lib/types";
import {
    addAudit, addNotification, applications, candidates, clients, commissionLedger, expenses, invoices, jobs, placements,
    receipts, recurringInvoices, timesheets, contractAssignments, users,
} from "../data";
import { notifyRoles } from "../pipeline";
import {
    addDays, billingOf, clientById, daysBetween, defaultBankAccountId, feeForCtc, fyOf, gstFor, nextDocNumber, periodLockError,
    round2, sendEmail, settingsFor, today,
} from "./core";

type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = <T>(error: string, status = 409): Result<T> => ({ ok: false, error, status });
const okr = <T>(value: T): Result<T> => ({ ok: true, value });

// ─── Amount helpers ──────────────────────────────────────────

export const inrOf = (inv: Pick<Invoice, "fxRate">, amount: number) => Math.round(amount * (inv.fxRate || 1));
export const balanceDue = (inv: Invoice) => Math.max(0, round2(inv.total - inv.amountPaid - inv.writtenOff));
const OPEN: InvoiceStatus[] = ["SENT", "PARTIALLY_PAID", "OVERDUE"];
export const isOpen = (inv: Invoice) => inv.kind !== "CREDIT_NOTE" && OPEN.includes(inv.status);

/** Derives status from payments / due date (OVERDUE is always computed, never stale). */
export function refreshStatus(inv: Invoice): InvoiceStatus {
    if (["CANCELLED", "DRAFT", "PENDING_APPROVAL", "WRITTEN_OFF"].includes(inv.status)) return inv.status;
    if (inv.kind === "CREDIT_NOTE") return (inv.status = "PAID");
    if (balanceDue(inv) === 0) inv.status = inv.writtenOff > 0 && inv.amountPaid < inv.total ? "WRITTEN_OFF" : "PAID";
    else if (inv.dueDate < today()) inv.status = "OVERDUE";
    else inv.status = inv.amountPaid > 0 ? "PARTIALLY_PAID" : "SENT";
    return inv.status;
}

export function daysOverdue(inv: Invoice): number {
    if (!isOpen(inv)) return 0;
    return Math.max(0, daysBetween(inv.dueDate, today()));
}

export function agingBucket(inv: Invoice): "CURRENT" | "1-30" | "31-60" | "61-90" | "90+" {
    const d = daysOverdue(inv);
    if (d === 0) return "CURRENT";
    if (d <= 30) return "1-30";
    if (d <= 60) return "31-60";
    if (d <= 90) return "61-90";
    return "90+";
}

/** Mirror in the commission ledger so admin dashboards keep matching finance. */
export function syncLedger(inv: Invoice) {
    if (inv.kind === "INVOICE" && inv.milestone && ["TIMESHEET", "REBILL"].includes(inv.milestone)) return; // not placement commission
    if (["DRAFT", "PENDING_APPROVAL"].includes(inv.status) && !inv.ledgerId) return;
    const status = inv.status === "PAID" ? "PAID" : ["CANCELLED", "WRITTEN_OFF"].includes(inv.status) ? "CANCELLED" : inv.status === "DRAFT" || inv.status === "PENDING_APPROVAL" ? "PENDING" : "APPROVED";
    const amount = inrOf(inv, inv.kind === "CREDIT_NOTE" ? -inv.subtotal : inv.subtotal);
    let entry = inv.ledgerId ? commissionLedger.find((l) => l.id === inv.ledgerId) : undefined;
    if (!entry) {
        entry = {
            id: `led-${crypto.randomUUID().slice(0, 8)}`, orgId: inv.orgId, userId: null, clientId: inv.clientId, applicationId: inv.applicationId ?? null,
            type: inv.kind === "CREDIT_NOTE" ? "ADJUSTMENT" : "PLACEMENT_COMMISSION", amountInr: amount, status,
            description: inv.lineItems.map((l) => l.description).join("; ").slice(0, 200), invoiceNumber: inv.invoiceNumber,
            dueDate: inv.dueDate, paidAt: inv.paidAt ?? null, placementId: inv.placementId ?? null, createdAt: inv.createdAt,
        };
        commissionLedger.unshift(entry);
        inv.ledgerId = entry.id;
    } else {
        entry.amountInr = amount;
        entry.status = status;
        entry.dueDate = inv.dueDate;
        entry.paidAt = inv.paidAt ?? null;
    }
}

// ─── Invoice email ───────────────────────────────────────────

function invoiceEmailHtml(inv: Invoice, heading: string, extra = "") {
    const s = settingsFor(inv.orgId);
    const money = (n: number) => `${inv.currency} ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    return `<div style="font-family:Arial,sans-serif;color:#111">
<p>${heading}</p>
<table style="border-collapse:collapse;margin:12px 0">
<tr><td style="padding:4px 12px 4px 0">Invoice</td><td><b>${inv.invoiceNumber}</b></td></tr>
<tr><td style="padding:4px 12px 4px 0">Date</td><td>${inv.issueDate}</td></tr>
<tr><td style="padding:4px 12px 4px 0">Due</td><td>${inv.dueDate}</td></tr>
<tr><td style="padding:4px 12px 4px 0">Amount</td><td><b>${money(inv.total)}</b></td></tr>
<tr><td style="padding:4px 12px 4px 0">Balance due</td><td><b>${money(balanceDue(inv))}</b></td></tr>
</table>${extra}
<p>Bank: ${s.bankName} · A/c ${s.bankAccountNumber} · IFSC ${s.bankIfsc}</p>
<p>View / download: ${process.env.APP_URL ?? ""}/finance/invoices/${inv.id}/print</p>
<p>Regards,<br/>${s.companyLegalName || "Accounts"} · GSTIN ${s.companyGstin}</p></div>`;
}

function recipientsFor(inv: Invoice) {
    const c = clientById(inv.orgId, inv.clientId);
    return c ? billingOf(c).billingEmails : [];
}

// ─── Create / approve / send ─────────────────────────────────

export interface NewInvoiceInput {
    clientId: string;
    lineItems: InvoiceLineItem[];
    kind?: InvoiceKind;
    milestone?: BillingMilestone;
    placementIds?: string[];
    applicationId?: string | null;
    timesheetIds?: string[];
    expenseIds?: string[];
    recurringId?: string | null;
    creditNoteForId?: string | null;
    issueDate?: string;
    dueDate?: string;
    discount?: number;
    fxRate?: number;
    notes?: string | null;
    send?: boolean;
    irn?: string | null;
}

export function createInvoice(actor: User, input: NewInvoiceInput): Result<Invoice> {
    const client = clientById(actor.orgId, input.clientId);
    if (!client) return fail("Select a valid client", 400);
    const s = settingsFor(actor.orgId);
    const b = billingOf(client);
    const issueDate = input.issueDate || today();
    const lock = periodLockError(actor.orgId, issueDate);
    if (lock) return fail(lock, 423);
    const kind = input.kind ?? "INVOICE";

    const lines = input.lineItems
        .filter((l) => String(l.description ?? "").trim() && Number(l.amount) > 0)
        .map((l) => ({ ...l, description: String(l.description).trim(), amount: round2(Number(l.amount)), sacCode: l.sacCode || s.sacCode }));
    if (!lines.length) return fail("Add at least one line item with an amount", 400);
    const gross = round2(lines.reduce((sum, l) => sum + l.amount, 0));
    const discount = Math.min(gross, Math.max(0, round2(Number(input.discount) || 0)));
    const subtotal = round2(gross - discount);
    const gst = gstFor(actor.orgId, client, subtotal);
    const exact = subtotal + gst.taxAmount;
    const total = b.currency === "INR" ? Math.round(exact) : round2(exact);
    const currency: Currency = b.currency;
    const fxRate = currency === "INR" ? 1 : Math.max(0.0001, Number(input.fxRate) || 0);
    if (currency !== "INR" && !input.fxRate) return fail(`Enter the ${currency}→INR exchange rate for this invoice`, 400);
    const dueDate = input.dueDate || addDays(issueDate, client.creditDays || s.defaultCreditDays);
    if (dueDate < issueDate) return fail("Due date cannot be before issue date", 400);

    const prefix = kind === "CREDIT_NOTE" ? s.creditNotePrefix : kind === "DEBIT_NOTE" ? s.debitNotePrefix : s.invoicePrefix;
    const now = new Date().toISOString();
    const firstPlacement = input.placementIds?.length ? placements.find((p) => p.id === input.placementIds![0]) : undefined;
    const needsApproval = kind !== "CREDIT_NOTE" && !!input.send && Math.round(total * fxRate) > s.invoiceApprovalThresholdInr && actor.role !== "SUPER_ADMIN";

    const inv: Invoice = {
        id: `inv-${crypto.randomUUID().slice(0, 8)}`,
        orgId: actor.orgId,
        invoiceNumber: nextDocNumber(actor.orgId, prefix, issueDate),
        financialYear: fyOf(issueDate),
        kind,
        clientId: client.id,
        clientName: client.companyName,
        clientGstin: b.gstin ?? null,
        placeOfSupply: gst.placeOfSupply,
        placementId: firstPlacement?.id ?? null,
        placementIds: input.placementIds ?? [],
        applicationId: input.applicationId ?? null,
        candidateName: firstPlacement?.candidateName ?? null,
        jobTitle: firstPlacement?.jobTitle ?? null,
        milestone: input.milestone ?? "MANUAL",
        creditNoteForId: input.creditNoteForId ?? null,
        recurringId: input.recurringId ?? null,
        lineItems: lines,
        currency,
        fxRate,
        discount,
        subtotal,
        taxRate: gst.taxRate,
        tax: gst.tax,
        taxAmount: gst.taxAmount,
        roundOff: round2(total - exact),
        total,
        amountPaid: 0,
        writtenOff: 0,
        status: kind === "CREDIT_NOTE" ? "PAID" : needsApproval ? "PENDING_APPROVAL" : input.send ? "SENT" : "DRAFT",
        issueDate,
        dueDate,
        sentAt: input.send && !needsApproval ? now : null,
        paidAt: null,
        payments: [],
        reminders: [],
        approvedByName: null,
        irn: input.irn ?? null,
        ledgerId: null,
        notes: input.notes ?? null,
        createdById: actor.id,
        createdByName: actor.name,
        createdAt: now,
        updatedAt: now,
    };
    invoices.unshift(inv);

    // Link what was billed so nothing is billed twice
    (input.placementIds ?? []).forEach((pid) => {
        const p = placements.find((x) => x.id === pid);
        if (p && inv.milestone !== "ON_OFFER") { p.invoiceId = inv.id; p.invoiceNumber = inv.invoiceNumber; }
    });
    (input.timesheetIds ?? []).forEach((tid) => {
        const t = timesheets.find((x) => x.id === tid);
        if (t) { t.status = "INVOICED"; t.invoiceId = inv.id; }
    });
    (input.expenseIds ?? []).forEach((eid) => {
        const e = expenses.find((x) => x.id === eid);
        if (e) e.rebilledInvoiceId = inv.id;
    });

    refreshStatus(inv);
    syncLedger(inv);
    addAudit({
        orgId: actor.orgId, actorUserId: actor.id, actorRole: actor.role,
        action: `${kind}_CREATED`, entity: "Invoice", entityId: inv.id,
        detail: `${inv.invoiceNumber} · ${inv.clientName} · ${inv.currency} ${inv.total} (${inv.status})`,
    });
    if (inv.status === "PENDING_APPROVAL") {
        notifyRoles(actor.orgId, ["SUPER_ADMIN", "FINANCE_ADMIN"], { title: "Invoice needs approval", message: `${inv.invoiceNumber} · ${inv.clientName} · ₹${inrOf(inv, inv.total).toLocaleString("en-IN")} (above approval limit)`, link: `/finance/invoices?id=${inv.id}` });
    }
    if (inv.status === "SENT" || inv.status === "OVERDUE") emailInvoice(actor, inv);
    return okr(inv);
}

export function emailInvoice(actor: User, inv: Invoice, heading?: string, stage = "SENT") {
    const to = recipientsFor(inv);
    const kindLabel = inv.kind === "CREDIT_NOTE" ? "credit note" : inv.kind === "DEBIT_NOTE" ? "debit note" : "invoice";
    sendEmail(inv.orgId, actor, {
        to,
        subject: stage === "SENT" ? `${kindLabel[0].toUpperCase()}${kindLabel.slice(1)} ${inv.invoiceNumber} from ${settingsFor(inv.orgId).companyLegalName || "AbsoJob"}` : `Payment reminder: ${inv.invoiceNumber} (${inv.currency} ${balanceDue(inv).toLocaleString("en-IN")} due ${inv.dueDate})`,
        html: invoiceEmailHtml(inv, heading ?? `Please find our ${kindLabel} ${inv.invoiceNumber} below.`),
        relatedType: "Invoice", relatedId: inv.id,
    });
    return to;
}

export function approveInvoice(actor: User, inv: Invoice): Result<Invoice> {
    if (inv.status !== "PENDING_APPROVAL") return fail("Invoice is not awaiting approval");
    if (inv.createdById === actor.id && actor.role !== "SUPER_ADMIN") return fail("A different person must approve (maker-checker)", 403);
    inv.status = "SENT";
    inv.sentAt = new Date().toISOString();
    inv.approvedByName = actor.name;
    refreshStatus(inv);
    syncLedger(inv);
    emailInvoice(actor, inv);
    const maker = users.find((u) => u.id === inv.createdById);
    if (maker) addNotification({ orgId: inv.orgId, userId: maker.id, title: "Invoice approved & sent", message: `${inv.invoiceNumber} approved by ${actor.name}`, link: `/finance/invoices?id=${inv.id}` });
    return okr(inv);
}

export function sendDraft(actor: User, inv: Invoice): Result<Invoice> {
    if (inv.status !== "DRAFT") return fail("Only drafts can be sent");
    const lock = periodLockError(inv.orgId, inv.issueDate);
    if (lock) return fail(lock, 423);
    const s = settingsFor(inv.orgId);
    if (inrOf(inv, inv.total) > s.invoiceApprovalThresholdInr && actor.role !== "SUPER_ADMIN") {
        inv.status = "PENDING_APPROVAL";
        notifyRoles(inv.orgId, ["SUPER_ADMIN", "FINANCE_ADMIN"], { title: "Invoice needs approval", message: `${inv.invoiceNumber} · ${inv.clientName} · ₹${inrOf(inv, inv.total).toLocaleString("en-IN")}`, link: `/finance/invoices?id=${inv.id}` });
        return okr(inv);
    }
    inv.status = "SENT";
    inv.sentAt = new Date().toISOString();
    refreshStatus(inv);
    syncLedger(inv);
    emailInvoice(actor, inv);
    return okr(inv);
}

// ─── Credit / debit notes, write-off, cancel ─────────────────

export function issueNote(actor: User, inv: Invoice, kind: "CREDIT_NOTE" | "DEBIT_NOTE", amount: number | undefined, reason: string, date?: string): Result<Invoice> {
    if (inv.kind !== "INVOICE" || ["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(inv.status)) return fail("Notes can only be issued against sent invoices");
    if (!reason.trim()) return fail("A reason is required", 400);
    const credited = invoices.filter((c) => c.creditNoteForId === inv.id && c.kind === "CREDIT_NOTE" && c.status !== "CANCELLED").reduce((s, c) => s + c.subtotal, 0);
    const max = round2(inv.subtotal - credited);
    const amt = round2(Number(amount) || (kind === "CREDIT_NOTE" ? max : 0));
    if (amt <= 0) return fail("Enter a positive amount", 400);
    if (kind === "CREDIT_NOTE" && amt > max) return fail(`Credit can be at most ${inv.currency} ${max}`, 400);
    const r = createInvoice(actor, {
        clientId: inv.clientId, kind, creditNoteForId: inv.id, milestone: inv.milestone, applicationId: inv.applicationId,
        lineItems: [{ description: `${kind === "CREDIT_NOTE" ? "Credit" : "Additional charge"} against ${inv.invoiceNumber}: ${reason}`, amount: amt }],
        issueDate: date, fxRate: inv.fxRate, send: kind === "DEBIT_NOTE", notes: reason,
    });
    if (!r.ok) return r;
    const note = r.value;
    if (kind === "CREDIT_NOTE") {
        note.amountPaid = note.total;
        note.paidAt = note.issueDate;
        // Credit reduces what is still owed on the original invoice
        inv.amountPaid = Math.min(inv.total, round2(inv.amountPaid + note.total));
        if (balanceDue(inv) === 0 && !inv.paidAt) inv.paidAt = note.issueDate;
        refreshStatus(inv);
        syncLedger(inv);
        syncLedger(note);
        emailInvoice(actor, note, `We have issued credit note ${note.invoiceNumber} against ${inv.invoiceNumber}.`);
    }
    return okr(note);
}

export function writeOff(actor: User, inv: Invoice, reason: string): Result<Invoice> {
    if (!isOpen(inv)) return fail("Only open invoices can be written off");
    if (!reason.trim()) return fail("A reason is required", 400);
    if (actor.role !== "SUPER_ADMIN") return fail("Bad-debt write-offs need Super Admin", 403);
    inv.writtenOff = balanceDue(inv);
    inv.status = "WRITTEN_OFF";
    inv.notes = `${inv.notes ? inv.notes + "\n" : ""}Written off (${inv.writtenOff}): ${reason}`;
    syncLedger(inv);
    return okr(inv);
}

export function cancelInvoice(actor: User, inv: Invoice, reason: string): Result<Invoice> {
    if (inv.amountPaid > 0) return fail("Invoice has payments — issue a credit note instead");
    if (inv.status === "CANCELLED") return fail("Already cancelled");
    if (!reason.trim()) return fail("A reason is required", 400);
    const lock = periodLockError(inv.orgId, inv.issueDate);
    if (lock) return fail(lock, 423);
    inv.status = "CANCELLED";
    inv.notes = `${inv.notes ? inv.notes + "\n" : ""}Cancelled: ${reason}`;
    placements.filter((p) => p.invoiceId === inv.id).forEach((p) => { p.invoiceId = null; p.invoiceNumber = null; });
    timesheets.filter((t) => t.invoiceId === inv.id).forEach((t) => { t.status = "APPROVED"; t.invoiceId = null; });
    expenses.filter((e) => e.rebilledInvoiceId === inv.id).forEach((e) => { e.rebilledInvoiceId = null; });
    syncLedger(inv);
    return okr(inv);
}

// ─── Receipts (client payments) with allocation & advances ───

export interface ReceiptInput {
    clientId: string;
    amount: number;
    tdsAmount?: number;
    date?: string;
    method: PaymentMethod;
    reference?: string | null;
    bankAccountId?: string | null;
    allocations?: { invoiceId: string; amount: number; tds?: number }[];
}

export function recordReceipt(actor: User, input: ReceiptInput): Result<Receipt> {
    const client = clientById(actor.orgId, input.clientId);
    if (!client) return fail("Client not found", 404);
    const amount = round2(Number(input.amount) || 0);
    const tds = round2(Number(input.tdsAmount) || 0);
    if (amount < 0 || tds < 0 || amount + tds <= 0) return fail("Enter the amount received", 400);
    if (!["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD"].includes(input.method)) return fail("Select a payment method", 400);
    const date = input.date || today();
    if (date > today()) return fail("Receipt date cannot be in the future", 400);
    const lock = periodLockError(actor.orgId, date);
    if (lock) return fail(lock, 423);

    // Default allocation: oldest open invoices first
    let allocs = (input.allocations ?? []).filter((a) => Number(a.amount) > 0 || Number(a.tds) > 0);
    if (!allocs.length) {
        let left = amount + tds;
        allocs = invoices
            .filter((i) => i.orgId === actor.orgId && i.clientId === client.id && isOpen(i))
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((i) => {
                const take = Math.min(left, inrOf(i, balanceDue(i)));
                left = round2(left - take);
                return { invoiceId: i.id, amount: take, tds: 0 };
            })
            .filter((a) => a.amount > 0);
        // put the client's TDS on the first allocation
        if (tds && allocs.length) { allocs[0].tds = Math.min(tds, allocs[0].amount); allocs[0].amount = round2(allocs[0].amount - allocs[0].tds); }
    }
    const allocatedCash = round2(allocs.reduce((s, a) => s + Number(a.amount || 0), 0));
    const allocatedTds = round2(allocs.reduce((s, a) => s + Number(a.tds || 0), 0));
    if (allocatedCash > amount + 0.01) return fail("Allocated cash exceeds the amount received", 400);
    if (allocatedTds > tds + 0.01) return fail("Allocated TDS exceeds TDS entered", 400);
    for (const a of allocs) {
        const inv = invoices.find((i) => i.id === a.invoiceId && i.orgId === actor.orgId && i.clientId === client.id);
        if (!inv || !isOpen(inv)) return fail("Allocation to an invoice that is not open for this client", 400);
        if (Number(a.amount || 0) + Number(a.tds || 0) > inrOf(inv, balanceDue(inv)) + 0.01) return fail(`Allocation exceeds balance on ${inv.invoiceNumber}`, 400);
    }

    const now = new Date().toISOString();
    const rc: Receipt = {
        id: `rcpt-${crypto.randomUUID().slice(0, 8)}`,
        orgId: actor.orgId,
        receiptNumber: nextDocNumber(actor.orgId, settingsFor(actor.orgId).receiptPrefix, date),
        clientId: client.id,
        clientName: client.companyName,
        date,
        amount,
        tdsAmount: tds,
        method: input.method,
        reference: input.reference || null,
        bankAccountId: input.bankAccountId || defaultBankAccountId(actor.orgId),
        allocations: [],
        unapplied: round2(amount - allocatedCash),
        reconciled: false,
        recordedByName: actor.name,
        createdAt: now,
    };
    receipts.unshift(rc);
    allocs.forEach((a) => applyToInvoice(actor, rc, a.invoiceId, Number(a.amount || 0), Number(a.tds || 0)));

    addAudit({ orgId: actor.orgId, actorUserId: actor.id, actorRole: actor.role, action: "RECEIPT_RECORDED", entity: "Receipt", entityId: rc.id, detail: `${rc.receiptNumber} · ${client.companyName} · ₹${amount}${tds ? ` + TDS ₹${tds}` : ""}${rc.unapplied ? ` · ₹${rc.unapplied} on account` : ""}` });
    if (client.accountManagerId && client.accountManagerId !== actor.id) {
        addNotification({ orgId: actor.orgId, userId: client.accountManagerId, title: "Client payment received", message: `${client.companyName}: ₹${(amount + tds).toLocaleString("en-IN")} (${rc.receiptNumber})`, link: null });
    }
    refreshCreditHolds(actor.orgId, actor);
    return okr(rc);
}

/** Apply cash/TDS (INR) from a receipt to one invoice. */
function applyToInvoice(actor: User, rc: Receipt, invoiceId: string, cashInr: number, tdsInr: number) {
    const inv = invoices.find((i) => i.id === invoiceId)!;
    const inCur = (n: number) => round2(n / (inv.fxRate || 1));
    inv.amountPaid = Math.min(inv.total, round2(inv.amountPaid + inCur(cashInr + tdsInr)));
    inv.payments.push({ id: `pmt-${crypto.randomUUID().slice(0, 8)}`, receiptId: rc.id, amount: cashInr, tdsAmount: tdsInr, date: rc.date, method: rc.method, reference: rc.reference, recordedByName: actor.name, recordedAt: new Date().toISOString() });
    const existing = rc.allocations.find((x) => x.invoiceId === inv.id);
    if (existing) { existing.amount = round2(existing.amount + cashInr); existing.tds = round2(existing.tds + tdsInr); }
    else rc.allocations.push({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, amount: cashInr, tds: tdsInr });
    if (balanceDue(inv) === 0) inv.paidAt = rc.date;
    inv.updatedAt = new Date().toISOString();
    refreshStatus(inv);
    syncLedger(inv);
    if (inv.status === "PAID") onInvoicePaid(actor, inv);
}

/** Use a client's on-account (advance) balance against an invoice. */
export function applyAdvance(actor: User, receiptId: string, invoiceId: string, amount: number): Result<Receipt> {
    const rc = receipts.find((r) => r.id === receiptId && r.orgId === actor.orgId);
    if (!rc) return fail("Receipt not found", 404);
    const inv = invoices.find((i) => i.id === invoiceId && i.orgId === actor.orgId && i.clientId === rc.clientId);
    if (!inv || !isOpen(inv)) return fail("Invoice is not open for this client", 400);
    const amt = round2(Math.min(Number(amount) || rc.unapplied, rc.unapplied, inrOf(inv, balanceDue(inv))));
    if (amt <= 0) return fail("Nothing to apply", 400);
    rc.unapplied = round2(rc.unapplied - amt);
    applyToInvoice(actor, rc, inv.id, amt, 0);
    return okr(rc);
}

/** When a placement invoice is fully collected, book the recruiter's incentive (once). */
function onInvoicePaid(actor: User, inv: Invoice) {
    const s = settingsFor(inv.orgId);
    if (!s.recruiterIncentivePct || !["FULL", "ON_JOINING", "ON_OFFER"].includes(inv.milestone ?? "")) return;
    const ids = inv.placementIds?.length ? inv.placementIds : inv.placementId ? [inv.placementId] : [];
    const recruiterFromApp = inv.applicationId ? applications.find((a) => a.id === inv.applicationId)?.recruiterId : undefined;
    const targets = ids.length
        ? ids.map((pid) => placements.find((p) => p.id === pid)).filter(Boolean).map((p) => ({ recruiterId: p!.recruiterId, placementId: p!.id, share: 1 / ids.length }))
        : recruiterFromApp ? [{ recruiterId: recruiterFromApp, placementId: null as string | null, share: 1 }] : [];
    targets.forEach((t) => {
        const key = `${inv.invoiceNumber}#${t.placementId ?? "app"}`;
        if (commissionLedger.some((l) => l.type === "RECRUITER_INCENTIVE" && l.invoiceNumber === key)) return;
        const amount = Math.round(inrOf(inv, inv.subtotal) * t.share * (s.recruiterIncentivePct / 100));
        if (amount <= 0) return;
        commissionLedger.unshift({
            id: `led-${crypto.randomUUID().slice(0, 8)}`, orgId: inv.orgId, userId: t.recruiterId, clientId: inv.clientId, applicationId: inv.applicationId ?? null,
            type: "RECRUITER_INCENTIVE", amountInr: amount, status: "PENDING", description: `Recruiter incentive ${s.recruiterIncentivePct}% — ${inv.clientName} ${inv.invoiceNumber}`,
            invoiceNumber: key, dueDate: addDays(today(), 30), paidAt: null, placementId: t.placementId, createdAt: new Date().toISOString(),
        });
        addNotification({ orgId: inv.orgId, userId: t.recruiterId, title: "Incentive earned 🎯", message: `₹${amount.toLocaleString("en-IN")} — ${inv.clientName} paid ${inv.invoiceNumber}`, link: "/portal/incentives" });
    });
    void actor;
}

// ─── Statement of account ────────────────────────────────────

export function statementOf(orgId: string, clientId: string, from?: string, to?: string) {
    const start = from || "0000-00-00";
    const end = to || "9999-12-31";
    type Row = { date: string; type: string; ref: string; description: string; debit: number; credit: number };
    const rows: Row[] = [];
    invoices
        .filter((i) => i.orgId === orgId && i.clientId === clientId && !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(i.status))
        .forEach((i) => {
            if (i.kind === "CREDIT_NOTE") rows.push({ date: i.issueDate, type: "Credit note", ref: i.invoiceNumber, description: i.lineItems[0]?.description ?? "", debit: 0, credit: inrOf(i, i.total) });
            else rows.push({ date: i.issueDate, type: i.kind === "DEBIT_NOTE" ? "Debit note" : "Invoice", ref: i.invoiceNumber, description: i.lineItems.map((l) => l.description).join("; ").slice(0, 120), debit: inrOf(i, i.total), credit: 0 });
            if (i.writtenOff) rows.push({ date: i.updatedAt.slice(0, 10), type: "Write-off", ref: i.invoiceNumber, description: "Bad debt written off", debit: 0, credit: inrOf(i, i.writtenOff) });
        });
    receipts
        .filter((r) => r.orgId === orgId && r.clientId === clientId)
        .forEach((r) => rows.push({ date: r.date, type: "Receipt", ref: r.receiptNumber, description: `${r.method.replace("_", " ")}${r.reference ? ` · ${r.reference}` : ""}${r.tdsAmount ? ` (incl. TDS ₹${r.tdsAmount})` : ""}`, debit: 0, credit: round2(r.amount + r.tdsAmount) }));
    rows.sort((a, b) => a.date.localeCompare(b.date) || (a.debit ? -1 : 1));
    let opening = 0;
    rows.filter((r) => r.date < start).forEach((r) => { opening = round2(opening + r.debit - r.credit); });
    let bal = opening;
    const lines = rows.filter((r) => r.date >= start && r.date <= end).map((r) => { bal = round2(bal + r.debit - r.credit); return { ...r, balance: bal }; });
    return { opening, closing: bal, lines };
}

// ─── Dunning (payment reminders) ─────────────────────────────

/** Sends due-soon / overdue reminders per the configured schedule. Idempotent per stage. */
export function runReminders(orgId: string, actor: Pick<User, "name" | "id" | "role"> = { id: "system", name: "Accounts (automatic)", role: "FINANCE_ADMIN" }) {
    const s = settingsFor(orgId);
    const t = today();
    let sent = 0;
    invoices.filter((i) => i.orgId === orgId && i.kind !== "CREDIT_NOTE").forEach((inv) => {
        refreshStatus(inv);
        if (!isOpen(inv)) return;
        for (const d of [...s.reminderDays].sort((a, b) => b - a)) {
            if (daysBetween(inv.dueDate, t) < d) continue;
            const stage = d < 0 ? `DUE_IN_${-d}` : d === 0 ? "DUE_TODAY" : `OVERDUE_${d}`;
            if (inv.reminders.some((r) => r.stage === stage)) break;
            const to = emailInvoice(actor as User, inv, d < 0 ? `A friendly reminder that invoice ${inv.invoiceNumber} is due on ${inv.dueDate}.` : `Invoice ${inv.invoiceNumber} is ${daysOverdue(inv)} day(s) overdue. Please arrange payment.`, "REMINDER");
            inv.reminders.push({ at: new Date().toISOString(), stage, sentTo: to.join(", "), byName: actor.name });
            sent++;
            const am = clientById(orgId, inv.clientId)?.accountManagerId;
            if (d > 0 && am) addNotification({ orgId, userId: am, title: "Client invoice overdue", message: `${inv.clientName} ${inv.invoiceNumber} — ${daysOverdue(inv)}d overdue`, link: null });
            break; // one reminder per run per invoice
        }
    });
    return sent;
}

export function sendManualReminder(actor: User, inv: Invoice): Result<Invoice> {
    if (!isOpen(inv)) return fail("Invoice is not open");
    const to = emailInvoice(actor, inv, `Reminder: invoice ${inv.invoiceNumber} has a balance of ${inv.currency} ${balanceDue(inv).toLocaleString("en-IN")}.`, "REMINDER");
    inv.reminders.push({ at: new Date().toISOString(), stage: "MANUAL", sentTo: to.join(", "), byName: actor.name });
    return okr(inv);
}

// ─── Recurring invoices ──────────────────────────────────────

export function runRecurring(orgId: string, actor?: User) {
    const t = today();
    const system = actor ?? ({ id: "system", orgId, name: "Recurring billing", role: "FINANCE_ADMIN" } as User);
    let created = 0;
    recurringInvoices.filter((r) => r.orgId === orgId && r.active).forEach((r) => {
        let guard = 0;
        while (r.nextDate <= t && (!r.endDate || r.nextDate <= r.endDate) && guard++ < 12) {
            const res = createInvoice(system, {
                clientId: r.clientId, milestone: "RETAINER", recurringId: r.id, issueDate: r.nextDate, send: r.autoSend,
                lineItems: [{ description: `${r.description} — ${new Date(r.nextDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`, amount: r.amount }],
            });
            if (!res.ok) break;
            created++;
            const d = new Date(r.nextDate);
            d.setMonth(d.getMonth() + (r.frequency === "QUARTERLY" ? 3 : 1));
            r.nextDate = d.toISOString().split("T")[0];
        }
        if (r.endDate && r.nextDate > r.endDate) r.active = false;
    });
    if (created) notifyRoles(orgId, ["FINANCE_ADMIN"], { title: "Recurring invoices generated", message: `${created} retainer invoice(s) created`, link: "/finance/invoices" });
    return created;
}

// ─── Credit control ──────────────────────────────────────────

export function creditStatusOf(orgId: string, clientId: string) {
    const c = clientById(orgId, clientId);
    const s = settingsFor(orgId);
    const open = invoices.filter((i) => i.orgId === orgId && i.clientId === clientId && isOpen(i));
    const outstanding = open.reduce((sum, i) => sum + inrOf(i, balanceDue(i)), 0);
    const maxOverdue = open.reduce((m, i) => Math.max(m, daysOverdue(i)), 0);
    const limit = c ? billingOf(c).creditLimit ?? null : null;
    const reasons: string[] = [];
    if (limit && outstanding > limit) reasons.push(`outstanding ₹${outstanding.toLocaleString("en-IN")} exceeds credit limit ₹${limit.toLocaleString("en-IN")}`);
    if (maxOverdue > s.creditHoldOverdueDays) reasons.push(`invoice overdue by ${maxOverdue} days`);
    return { outstanding, maxOverdue, limit, onHold: reasons.length > 0, reasons };
}

/** Flags clients on credit hold and tells recruitment when it changes. */
export function refreshCreditHolds(orgId: string, actor?: Pick<User, "id">) {
    clients.filter((c) => c.orgId === orgId).forEach((c) => {
        const st = creditStatusOf(orgId, c.id);
        if (!!c.creditHold === st.onHold) return;
        c.creditHold = st.onHold;
        notifyRoles(orgId, ["TA_MANAGER", "SUPER_ADMIN"], {
            title: st.onHold ? "Client on credit hold" : "Credit hold released",
            message: st.onHold ? `${c.companyName}: ${st.reasons.join("; ")}. New requisitions are blocked until cleared.` : `${c.companyName} can take new requisitions again`,
            link: null,
        });
        void actor;
    });
}

// ─── Billing queue ───────────────────────────────────────────

export interface BillableItem {
    key: string;
    type: "PLACEMENT" | "OFFER_MILESTONE" | "TIMESHEET" | "REBILL_EXPENSE";
    clientId: string;
    clientName: string;
    description: string;
    amount: number; // INR, pre-tax
    basis: string;
    date: string;
    placementId?: string;
    applicationId?: string;
    timesheetId?: string;
    expenseId?: string;
    recruiterName?: string;
}

function offerCtcFor(appId: string) {
    const app = applications.find((a) => a.id === appId);
    const cand = app ? candidates.find((c) => c.id === app.candidateId) : undefined;
    const offer = cand?.offers?.find((o) => o.applicationId === appId && o.status === "ACCEPTED");
    return { app, cand, ctc: offer?.offeredCtcLpa ?? cand?.expectedCtcLpa ?? 0 };
}

/** Amount of a placement already billed at the offer milestone (for split billing). */
function offerBilledFor(p: PlacementRecord): number {
    return invoices
        .filter((i) => i.orgId === p.orgId && i.milestone === "ON_OFFER" && i.kind === "INVOICE" && i.status !== "CANCELLED" && i.applicationId)
        .filter((i) => {
            const app = applications.find((a) => a.id === i.applicationId);
            return app && app.candidateId === p.candidateId && app.jobId === p.jobId;
        })
        .reduce((s, i) => s + inrOf(i, i.subtotal), 0);
}

export function placementFee(p: PlacementRecord) {
    const client = clientById(p.orgId, p.clientId);
    return feeForCtc(client, p.offeredSalaryLpa);
}

export function billingQueue(orgId: string): BillableItem[] {
    const items: BillableItem[] = [];
    // 1. Joined placements not yet billed (net of any offer-milestone invoice)
    placements.filter((p) => p.orgId === orgId && p.joiningStatus === "JOINED" && !p.invoiceId && !p.invoiceNumber).forEach((p) => {
        const { fee, basis } = placementFee(p);
        const already = offerBilledFor(p);
        const amount = Math.max(0, fee - already);
        if (amount <= 0) return;
        items.push({
            key: `plc:${p.id}`, type: "PLACEMENT", clientId: p.clientId, clientName: p.clientName, placementId: p.id, recruiterName: p.recruiterName,
            description: `Placement fee — ${p.candidateName}, ${p.jobTitle} (₹${p.offeredSalaryLpa} LPA, ${basis})${already ? `, balance after ₹${already.toLocaleString("en-IN")} billed on offer` : ""}, joined ${p.joiningDate}`,
            amount, basis: already ? "joining balance" : basis, date: p.joiningDate,
        });
    });
    // 2. Split billing: accepted offers for clients billed partly on offer
    applications.filter((a) => a.orgId === orgId && ["OFFER_ACCEPTED", "ONBOARDING", "JOINED"].includes(a.stage)).forEach((a) => {
        const job = jobs.find((j) => j.id === a.jobId);
        const client = job ? clientById(orgId, job.clientId) : undefined;
        if (!client) return;
        const pct = billingOf(client).splitOnOfferPct;
        if (!pct) return;
        if (invoices.some((i) => i.applicationId === a.id && i.milestone === "ON_OFFER" && i.status !== "CANCELLED")) return;
        if (a.stage === "JOINED" && placements.some((p) => p.candidateId === a.candidateId && p.jobId === a.jobId && (p.invoiceId || p.invoiceNumber))) return;
        const { cand, ctc } = offerCtcFor(a.id);
        if (!ctc) return;
        const { fee, basis } = feeForCtc(client, ctc);
        items.push({
            key: `offer:${a.id}`, type: "OFFER_MILESTONE", clientId: client.id, clientName: client.companyName, applicationId: a.id,
            recruiterName: users.find((u) => u.id === a.recruiterId)?.name,
            description: `Offer milestone ${pct}% — ${cand?.name ?? "candidate"}, ${job?.title} (₹${ctc} LPA, ${basis})`,
            amount: Math.round(fee * (pct / 100)), basis: `${pct}% on offer acceptance`, date: a.updatedAt.slice(0, 10),
        });
    });
    // 3. Approved contract timesheets
    timesheets.filter((t) => t.orgId === orgId && t.status === "APPROVED" && !t.invoiceId).forEach((t) => {
        const asg = contractAssignments.find((x) => x.id === t.assignmentId);
        if (!asg) return;
        items.push({
            key: `ts:${t.id}`, type: "TIMESHEET", clientId: asg.clientId, clientName: asg.clientName, timesheetId: t.id,
            description: `Contract staffing — ${asg.workerName}, ${asg.role} · ${t.month} · ${t.units} ${asg.rateType === "HOURLY" ? "hrs" : asg.rateType === "DAILY" ? "days" : "month"} × ₹${asg.billRate.toLocaleString("en-IN")}`,
            amount: t.billAmount, basis: "timesheet", date: `${t.month}-28`,
        });
    });
    // 4. Billable expenses to re-bill
    expenses.filter((e) => e.orgId === orgId && e.billable && e.clientId && ["APPROVED", "PAID"].includes(e.status) && !e.rebilledInvoiceId).forEach((e) => {
        const c = clientById(orgId, e.clientId);
        if (!c) return;
        items.push({
            key: `exp:${e.id}`, type: "REBILL_EXPENSE", clientId: c.id, clientName: c.companyName, expenseId: e.id,
            description: `Reimbursable expense — ${e.description} (${e.expenseDate})`, amount: round2(e.amount - (e.gstAmount || 0)), basis: "at cost", date: e.expenseDate,
        });
    });
    return items.sort((a, b) => a.clientName.localeCompare(b.clientName) || a.date.localeCompare(b.date));
}

/** Bill one or many queue items of the same client on a single invoice. */
export function billItems(actor: User, keys: string[], opts: { send?: boolean; fxRate?: number; overrides?: Record<string, number> } = {}): Result<Invoice> {
    const queue = billingQueue(actor.orgId);
    const picked = keys.map((k) => queue.find((q) => q.key === k)).filter(Boolean) as BillableItem[];
    if (!picked.length || picked.length !== keys.length) return fail("Some items are no longer billable — refresh the queue", 409);
    const clientIds = new Set(picked.map((p) => p.clientId));
    if (clientIds.size > 1) return fail("Select items of one client per invoice", 400);
    const offers = picked.filter((p) => p.type === "OFFER_MILESTONE");
    const milestone: BillingMilestone = picked.every((p) => p.type === "TIMESHEET") ? "TIMESHEET"
        : picked.every((p) => p.type === "REBILL_EXPENSE") ? "REBILL"
        : offers.length === picked.length ? "ON_OFFER"
        : picked.some((p) => p.basis === "joining balance") ? "ON_JOINING" : "FULL";
    const client = clientById(actor.orgId, picked[0].clientId)!;
    const fx = billingOf(client).currency === "INR" ? 1 : Number(opts.fxRate) || 0;
    return createInvoice(actor, {
        clientId: picked[0].clientId,
        milestone,
        applicationId: offers[0]?.applicationId ?? null,
        placementIds: picked.filter((p) => p.placementId).map((p) => p.placementId!),
        timesheetIds: picked.filter((p) => p.timesheetId).map((p) => p.timesheetId!),
        expenseIds: picked.filter((p) => p.expenseId).map((p) => p.expenseId!),
        fxRate: fx || undefined,
        send: opts.send,
        lineItems: picked.map((p) => ({
            description: p.description,
            amount: fx && fx !== 1 ? round2((opts.overrides?.[p.key] ?? p.amount) / fx) : opts.overrides?.[p.key] ?? p.amount,
            placementId: p.placementId ?? null, timesheetId: p.timesheetId ?? null, expenseId: p.expenseId ?? null,
        })),
    });
}

export type { Result };
