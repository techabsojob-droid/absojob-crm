// ─── Finance core: settings, dates, tax, numbering, email, files ─────

import type { Client, ClientBillingProfile, Currency, FinanceSettings, User } from "@/lib/types";
import { clients, emailOutbox, financeSettings, invoices, receipts, storedFiles, users } from "../data";

export const isFinance = (u: Pick<User, "role">) => u.role === "SUPER_ADMIN" || u.role === "FINANCE_ADMIN";

export const today = () => new Date().toISOString().split("T")[0];
export const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().split("T")[0];
export const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Indian financial year label for a date, e.g. 2026-09-29 → "2026-27". */
export function fyOf(date: string): string {
    const d = new Date(date);
    const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}
export function fyRange(fy: string): { from: string; to: string } {
    const y = Number(fy.slice(0, 4));
    return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
}

const DEFAULTS = (orgId: string): FinanceSettings => ({
    orgId, gstRate: 18, companyStateCode: "27", sacCode: "998512",
    invoicePrefix: "INV/", creditNotePrefix: "CN/", debitNotePrefix: "DN/", receiptPrefix: "RCPT/", defaultCreditDays: 30,
    companyLegalName: "", companyAddress: "", companyGstin: "", companyPan: "", lutNumber: "",
    bankName: "", bankAccountNumber: "", bankIfsc: "", bankAccounts: [],
    reimbursementLimitInr: 25000, invoiceApprovalThresholdInr: 500000, vendorPaymentApprovalThresholdInr: 100000,
    reminderDays: [-3, 7, 15, 30], expenseCategoryLimits: {}, commissionTdsPct: 2, recruiterIncentivePct: 5,
    guaranteeDaysDefault: 90, creditHoldOverdueDays: 60, lockedUntil: null, eInvoiceEnabled: false,
    payroll: { pfEnabled: true, pfRatePct: 12, pfWageCeiling: 15000, esiEnabled: true, esiEmployeePct: 0.75, esiEmployerPct: 3.25, esiWageCeiling: 21000, ptState: "MH", taxRegime: "NEW" },
});

export function settingsFor(orgId: string): FinanceSettings {
    let s = financeSettings.find((x) => x.orgId === orgId);
    if (!s) {
        s = DEFAULTS(orgId);
        financeSettings.push(s);
    }
    return s;
}

export function defaultBankAccountId(orgId: string): string | null {
    const s = settingsFor(orgId);
    return (s.bankAccounts.find((b) => b.isDefault) ?? s.bankAccounts[0])?.id ?? null;
}

/** Period close: nothing dated on/before the lock date may be created or changed. */
export function periodLockError(orgId: string, date: string | null | undefined): string | null {
    const lock = settingsFor(orgId).lockedUntil;
    if (lock && date && date.slice(0, 10) <= lock) return `Books are closed up to ${lock}. Use a date after the lock or ask the Super Admin to reopen the period.`;
    return null;
}

// ─── Client billing profile ──────────────────────────────────

export function billingOf(client: Client): ClientBillingProfile {
    const s = settingsFor(client.orgId);
    return {
        gstin: null, pan: null, billingAddress: client.address ?? null, stateCode: s.companyStateCode, country: "India", currency: "INR",
        billingEmails: [client.contactEmail].filter(Boolean), feeModel: "PERCENT", feePercent: client.commissionRate, flatFee: null, feeSlabs: [],
        splitOnOfferPct: 0, guaranteeDays: s.guaranteeDaysDefault, creditLimit: null,
        ...(client.billing ?? {}),
    };
}

export function clientById(orgId: string, id: string | null | undefined) {
    return clients.find((c) => c.id === id && c.orgId === orgId);
}

/** Placement fee per the client's fee model (percent / flat / CTC slab). */
export function feeForCtc(client: Client | undefined, ctcLpa: number): { fee: number; basis: string } {
    if (!client) return { fee: Math.round(ctcLpa * 100000 * 0.0833), basis: "8.33% of CTC" };
    const b = billingOf(client);
    if (b.feeModel === "FLAT" && b.flatFee) return { fee: Math.round(b.flatFee), basis: "flat fee" };
    if (b.feeModel === "SLAB" && b.feeSlabs?.length) {
        const slab = [...b.feeSlabs].sort((x, y) => x.uptoLpa - y.uptoLpa).find((x) => ctcLpa <= x.uptoLpa) ?? b.feeSlabs[b.feeSlabs.length - 1];
        return { fee: Math.round(ctcLpa * 100000 * (slab.percent / 100)), basis: `${slab.percent}% (CTC slab ≤ ₹${slab.uptoLpa}L)` };
    }
    const pct = b.feePercent ?? client.commissionRate ?? 8.33;
    return { fee: Math.round(ctcLpa * 100000 * (pct / 100)), basis: `${pct}% of CTC` };
}

// ─── GST ─────────────────────────────────────────────────────

/** CGST+SGST inside the home state, IGST across states, zero-rated for exports (LUT). */
export function gstFor(orgId: string, client: Client, taxable: number) {
    const s = settingsFor(orgId);
    const b = billingOf(client);
    const isExport = b.country.trim().toLowerCase() !== "india" || b.currency !== "INR";
    if (isExport) return { taxRate: 0, tax: { cgst: 0, sgst: 0, igst: 0, zeroRated: true }, taxAmount: 0, placeOfSupply: "96" };
    const total = round2(taxable * (s.gstRate / 100));
    const intra = (b.stateCode ?? s.companyStateCode) === s.companyStateCode;
    return {
        taxRate: s.gstRate,
        tax: intra ? { cgst: round2(total / 2), sgst: round2(total / 2), igst: 0, zeroRated: false } : { cgst: 0, sgst: 0, igst: total, zeroRated: false },
        taxAmount: total,
        placeOfSupply: b.stateCode ?? s.companyStateCode,
    };
}

export const GST_STATES: Record<string, string> = {
    "01": "Jammu & Kashmir", "03": "Punjab", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar",
    "19": "West Bengal", "23": "Madhya Pradesh", "24": "Gujarat", "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "32": "Kerala",
    "33": "Tamil Nadu", "36": "Telangana", "37": "Andhra Pradesh", "96": "Other country",
};

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ─── Numbering (per financial year) ──────────────────────────

export function nextDocNumber(orgId: string, prefix: string, date: string): string {
    const fy = fyOf(date);
    const base = `${prefix}${fy}/`;
    const pool = prefix === settingsFor(orgId).receiptPrefix ? receipts.map((r) => r.receiptNumber) : invoices.filter((i) => i.orgId === orgId).map((i) => i.invoiceNumber);
    const max = pool.filter((n) => n.startsWith(base)).reduce((m, n) => Math.max(m, Number(n.slice(base.length)) || 0), 0);
    return `${base}${String(max + 1).padStart(3, "0")}`;
}

export const CURRENCIES: Currency[] = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

// ─── Email (outbox + optional Resend delivery) ───────────────

export function sendEmail(orgId: string, actor: Pick<User, "name">, msg: { to: string[]; subject: string; html: string; relatedType?: string; relatedId?: string; cc?: string[]; replyTo?: string; attachments?: { filename: string; content: string }[] }) {
    const to = msg.to.map((t) => t.trim()).filter((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t));
    const record = {
        id: `mail-${crypto.randomUUID().slice(0, 8)}`, orgId, to, subject: msg.subject, html: msg.html,
        relatedType: msg.relatedType ?? null, relatedId: msg.relatedId ?? null,
        attachments: (msg.attachments ?? []).map((a) => a.filename),
        status: (process.env.RESEND_API_KEY ? "QUEUED" : "LOGGED") as "QUEUED" | "LOGGED" | "SENT" | "FAILED",
        providerId: null as string | null, error: to.length ? null : "No valid recipient email", sentByName: actor.name, createdAt: new Date().toISOString(),
    };
    if (!to.length) record.status = "FAILED";
    emailOutbox.unshift(record);
    // Real delivery when a provider key is configured; otherwise the outbox is the record of what would be sent
    if (record.status === "QUEUED" && process.env.RESEND_API_KEY) {
        fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: process.env.MAIL_FROM || "AbsoJob <notifications@absojob.com>", to, subject: msg.subject, html: msg.html, ...(msg.cc?.length ? { cc: msg.cc } : {}), ...(msg.replyTo ? { reply_to: msg.replyTo } : {}), ...(msg.attachments?.length ? { attachments: msg.attachments } : {}) }),
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}));
                record.status = r.ok ? "SENT" : "FAILED";
                record.providerId = (body as { id?: string }).id ?? null;
                if (!r.ok) record.error = JSON.stringify(body).slice(0, 300);
            })
            .catch((e) => { record.status = "FAILED"; record.error = String(e).slice(0, 300); });
    }
    return record;
}

// ─── Files ───────────────────────────────────────────────────

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];

export function fileUrl(id: string) {
    return `/api/files/${id}`;
}

export function findFile(orgId: string, id: string) {
    return storedFiles.find((f) => f.id === id && f.orgId === orgId);
}

export function userName(id: string | null | undefined) {
    return users.find((u) => u.id === id)?.name ?? "—";
}
