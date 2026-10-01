import { NextResponse } from "next/server";
import { invoices, receipts } from "@/lib/mock/data";
import {
    agingBucket, approveInvoice, balanceDue, cancelInvoice, createInvoice, daysOverdue, inrOf, issueNote, periodLockError, refreshStatus,
    runRecurring, runReminders, sendDraft, sendManualReminder, writeOff, addDays, gstFor, clientById,
} from "@/lib/mock/finance";
import { addAudit } from "@/lib/mock/data";
import { bad, body, requireFinance, respond } from "@/lib/mock/fin/http";

// GET: invoices, credit & debit notes with computed balance / aging
export async function GET(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    runRecurring(me.orgId);
    runReminders(me.orgId);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const clientId = url.searchParams.get("clientId");
    const kind = url.searchParams.get("kind");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = invoices.filter((i) => i.orgId === me.orgId);
    list.forEach(refreshStatus);
    if (status && status !== "ALL") list = list.filter((i) => i.status === status);
    if (clientId && clientId !== "ALL") list = list.filter((i) => i.clientId === clientId);
    if (kind && kind !== "ALL") list = list.filter((i) => i.kind === kind);
    if (q) list = list.filter((i) => i.invoiceNumber.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q) || (i.candidateName ?? "").toLowerCase().includes(q));

    return NextResponse.json(
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((i) => ({
            ...i, balanceDue: balanceDue(i), balanceDueInr: inrOf(i, balanceDue(i)), totalInr: inrOf(i, i.total), daysOverdue: daysOverdue(i), agingBucket: agingBucket(i),
            receipts: receipts.filter((r) => r.allocations.some((a) => a.invoiceId === i.id)).map((r) => r.receiptNumber),
        }))
    );
}

// POST: manual invoice (retainer, advisory, misc.) — placements are billed from the billing queue
export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    return respond(createInvoice(me, {
        clientId: b.clientId, lineItems: Array.isArray(b.lineItems) ? b.lineItems : [], milestone: b.milestone ?? "MANUAL",
        issueDate: b.issueDate, dueDate: b.dueDate, discount: b.discount, fxRate: b.fxRate, notes: b.notes, send: !!b.send, irn: b.irn,
    }), true);
}

// PATCH: send · approve · edit · remind · credit_note · debit_note · write_off · cancel · set_irn
export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const inv = invoices.find((i) => i.id === b.id && i.orgId === me.orgId);
    if (!inv) return bad("Invoice not found", 404);

    switch (b.action) {
        case "send": return respond(sendDraft(me, inv));
        case "approve": return respond(approveInvoice(me, inv));
        case "remind": return respond(sendManualReminder(me, inv));
        case "credit_note":
        case "debit_note": return respond(issueNote(me, inv, b.action === "credit_note" ? "CREDIT_NOTE" : "DEBIT_NOTE", b.amount, String(b.reason ?? ""), b.date), true);
        case "write_off": return respond(writeOff(me, inv, String(b.reason ?? "")));
        case "cancel": return respond(cancelInvoice(me, inv, String(b.reason ?? "")));
        case "set_irn": {
            if (!String(b.irn ?? "").trim()) return bad("IRN is required");
            inv.irn = String(b.irn).trim();
            addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "INVOICE_IRN_SET", entity: "Invoice", entityId: inv.id, detail: `${inv.invoiceNumber}: IRN ${inv.irn}` });
            return NextResponse.json(inv);
        }
        case "edit": {
            if (!["DRAFT", "PENDING_APPROVAL"].includes(inv.status)) return bad("Only drafts can be edited", 409);
            const lock = periodLockError(me.orgId, b.issueDate ?? inv.issueDate);
            if (lock) return bad(lock, 423);
            if (Array.isArray(b.lineItems)) {
                const items = b.lineItems.filter((l: { description?: string; amount?: number }) => String(l.description ?? "").trim() && Number(l.amount) > 0);
                if (!items.length) return bad("Add at least one line item");
                inv.lineItems = items.map((l: { description: string; amount: number }) => ({ description: l.description.trim(), amount: Math.round(Number(l.amount) * 100) / 100, sacCode: inv.lineItems[0]?.sacCode }));
            }
            if (b.discount !== undefined) inv.discount = Math.max(0, Number(b.discount) || 0);
            const gross = inv.lineItems.reduce((s, l) => s + l.amount, 0);
            inv.subtotal = Math.max(0, gross - inv.discount);
            const client = clientById(me.orgId, inv.clientId)!;
            const g = gstFor(me.orgId, client, inv.subtotal);
            inv.tax = g.tax; inv.taxAmount = g.taxAmount; inv.taxRate = g.taxRate;
            const exact = inv.subtotal + g.taxAmount;
            inv.total = inv.currency === "INR" ? Math.round(exact) : exact;
            inv.roundOff = Math.round((inv.total - exact) * 100) / 100;
            if (b.dueDate) {
                if (b.dueDate < inv.issueDate) return bad("Due date cannot be before issue date");
                inv.dueDate = b.dueDate;
            } else if (b.issueDate) inv.dueDate = addDays(b.issueDate, 30);
            if (b.issueDate) inv.issueDate = b.issueDate;
            if (b.notes !== undefined) inv.notes = b.notes;
            inv.updatedAt = new Date().toISOString();
            return NextResponse.json({ ...inv, balanceDue: balanceDue(inv) });
        }
        default:
            return bad("Unknown action");
    }
}
