import { NextResponse } from "next/server";
import { receipts } from "@/lib/mock/data";
import { applyAdvance, recordReceipt } from "@/lib/mock/finance";
import { body, requireFinance, respond } from "@/lib/mock/fin/http";

export async function GET(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const clientId = new URL(request.url).searchParams.get("clientId");
    const list = receipts.filter((r) => r.orgId === me.orgId && (!clientId || clientId === "ALL" || r.clientId === clientId));
    return NextResponse.json(list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
}

// POST: record a client payment (auto-allocates oldest-first unless allocations are given)
export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const b = await body(request);
    return respond(recordReceipt(auth.user, { clientId: b.clientId, amount: b.amount, tdsAmount: b.tdsAmount, date: b.date, method: b.method, reference: b.reference, bankAccountId: b.bankAccountId, allocations: b.allocations }), true);
}

// PATCH: apply an on-account advance to an invoice
export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const b = await body(request);
    return respond(applyAdvance(auth.user, b.receiptId, b.invoiceId, b.amount));
}
