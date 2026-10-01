import { NextResponse } from "next/server";
import { invoices, receipts, placements } from "@/lib/mock/data";
import { balanceDue, billingOf, clientById, GST_STATES, inrOf, refreshStatus, settingsFor } from "@/lib/mock/finance";
import { requireFinance } from "@/lib/mock/fin/http";

// Full invoice document for the printable GST invoice / PDF
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const inv = invoices.find((i) => i.id === id && i.orgId === me.orgId);
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    refreshStatus(inv);
    const client = clientById(me.orgId, inv.clientId);
    const s = settingsFor(me.orgId);
    return NextResponse.json({
        invoice: { ...inv, balanceDue: balanceDue(inv), totalInr: inrOf(inv, inv.total) },
        company: { name: s.companyLegalName, address: s.companyAddress, gstin: s.companyGstin, pan: s.companyPan, state: `${s.companyStateCode} - ${GST_STATES[s.companyStateCode] ?? ""}`, lut: s.lutNumber, bankName: s.bankName, bankAccountNumber: s.bankAccountNumber, bankIfsc: s.bankIfsc },
        client: client ? { name: client.companyName, ...billingOf(client), stateName: GST_STATES[billingOf(client).stateCode ?? ""] ?? "" } : null,
        original: inv.creditNoteForId ? invoices.find((x) => x.id === inv.creditNoteForId)?.invoiceNumber ?? null : null,
        notes: invoices.filter((x) => x.creditNoteForId === inv.id).map((x) => ({ id: x.id, number: x.invoiceNumber, kind: x.kind, total: x.total, status: x.status })),
        receipts: receipts.filter((r) => r.allocations.some((a) => a.invoiceId === inv.id)).map((r) => ({ id: r.id, number: r.receiptNumber, date: r.date, method: r.method, reference: r.reference, allocation: r.allocations.find((a) => a.invoiceId === inv.id) })),
        placements: (inv.placementIds ?? []).map((pid) => placements.find((p) => p.id === pid)).filter(Boolean).map((p) => ({ id: p!.id, candidateName: p!.candidateName, jobTitle: p!.jobTitle })),
    });
}
