import { NextResponse } from "next/server";
import { invoices, placements } from "@/lib/mock/data";
import { billItems, billingQueue, placementFee, billingOf, clientById } from "@/lib/mock/finance";
import { bad, body, requireFinance, respond } from "@/lib/mock/fin/http";

// GET: everything billable (joined placements, offer milestones, timesheets, re-billable expenses)
// plus billed placements that fell through inside the guarantee window
export async function GET() {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const org = placements.filter((p) => p.orgId === me.orgId);
    return NextResponse.json({
        items: billingQueue(me.orgId).map((i) => {
            const c = clientById(me.orgId, i.clientId);
            return { ...i, currency: c ? billingOf(c).currency : "INR", creditHold: !!c?.creditHold };
        }),
        atRisk: org
            .filter((p) => (p.invoiceId || p.invoiceNumber) && (["NO_SHOW", "CANCELLED"].includes(p.joiningStatus) || ["REPLACEMENT_REQUESTED", "REPLACEMENT_IN_PROGRESS"].includes(p.replacementStatus)))
            .map((p) => ({ ...p, fee: placementFee(p).fee, invoice: invoices.find((i) => i.id === p.invoiceId || i.invoiceNumber === p.invoiceNumber) ?? null })),
        pendingJoin: org.filter((p) => p.joiningStatus === "JOINING_PENDING").map((p) => ({ ...p, fee: placementFee(p).fee })),
    });
}

// POST: bill one or more queue items (same client) on one invoice
export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const b = await body(request);
    if (!Array.isArray(b.keys) || !b.keys.length) return bad("Select at least one item to bill");
    return respond(billItems(auth.user, b.keys, { send: !!b.send, fxRate: b.fxRate, overrides: b.overrides }), true);
}
