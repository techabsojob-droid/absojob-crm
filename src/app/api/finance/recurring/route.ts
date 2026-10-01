import { NextResponse } from "next/server";
import { recurringInvoices, addAudit } from "@/lib/mock/data";
import { clientById, runRecurring, today } from "@/lib/mock/finance";
import { bad, body, requireFinance } from "@/lib/mock/fin/http";

export async function GET() {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    return NextResponse.json(recurringInvoices.filter((r) => r.orgId === me.orgId).map((r) => ({ ...r, clientName: clientById(me.orgId, r.clientId)?.companyName ?? "—" })));
}

export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    if (!clientById(me.orgId, b.clientId)) return bad("Select a client");
    const amount = Number(b.amount);
    if (!String(b.description ?? "").trim() || !(amount > 0)) return bad("Description and a positive amount are required");
    if (!["MONTHLY", "QUARTERLY"].includes(b.frequency ?? "MONTHLY")) return bad("Invalid frequency");
    const nextDate = b.nextDate || today();
    if (b.endDate && b.endDate < nextDate) return bad("End date is before the first invoice date");
    const rec = {
        id: `rec-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, clientId: b.clientId, description: String(b.description).trim(), amount,
        frequency: (b.frequency ?? "MONTHLY") as "MONTHLY" | "QUARTERLY", nextDate, endDate: b.endDate || null, autoSend: !!b.autoSend, active: true,
        createdByName: me.name, createdAt: new Date().toISOString(),
    };
    recurringInvoices.unshift(rec);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "RECURRING_INVOICE_CREATED", entity: "RecurringInvoice", entityId: rec.id, detail: `${rec.description} ₹${amount} ${rec.frequency}` });
    const generated = runRecurring(me.orgId, me);
    return NextResponse.json({ ...rec, generated }, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const r = recurringInvoices.find((x) => x.id === b.id && x.orgId === me.orgId);
    if (!r) return bad("Schedule not found", 404);
    if (b.active !== undefined) r.active = !!b.active;
    if (b.amount !== undefined) { if (!(Number(b.amount) > 0)) return bad("Amount must be positive"); r.amount = Number(b.amount); }
    if (b.autoSend !== undefined) r.autoSend = !!b.autoSend;
    if (b.endDate !== undefined) r.endDate = b.endDate || null;
    return NextResponse.json(r);
}
