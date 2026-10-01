import { NextResponse } from "next/server";
import { clients, users, placements, addAudit } from "@/lib/mock/data";
import { balanceDue, billingOf, creditStatusOf, CURRENCIES, financeSnapshot, GSTIN_RE, inrOf, PAN_RE, refreshCreditHolds } from "@/lib/mock/finance";
import { bad, body, requireFinance } from "@/lib/mock/fin/http";

// Client billing profiles: GST registration, fee model, terms, balances, credit status
export async function GET() {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    refreshCreditHolds(me.orgId);
    const snap = financeSnapshot(me.orgId);
    return NextResponse.json(
        clients.filter((c) => c.orgId === me.orgId).map((c) => {
            const inv = snap.live.filter((i) => i.clientId === c.id);
            const cn = snap.credits.filter((i) => i.clientId === c.id);
            const credit = creditStatusOf(me.orgId, c.id);
            return {
                id: c.id, companyName: c.companyName, status: c.status, contactPerson: c.contactPerson, contactEmail: c.contactEmail,
                commissionRate: c.commissionRate, creditDays: c.creditDays, billing: billingOf(c), creditHold: !!c.creditHold, creditReasons: credit.reasons,
                accountManagerName: users.find((u) => u.id === c.accountManagerId)?.name ?? null,
                invoices: inv.length,
                billed: inv.reduce((s, i) => s + inrOf(i, i.subtotal), 0) - cn.reduce((s, i) => s + inrOf(i, i.subtotal), 0),
                collected: inv.reduce((s, i) => s + inrOf(i, i.amountPaid), 0),
                outstanding: inv.reduce((s, i) => s + inrOf(i, balanceDue(i)), 0),
                overdue: inv.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + inrOf(i, balanceDue(i)), 0),
                placements: placements.filter((p) => p.clientId === c.id).length,
                unbilled: snap.toBill.filter((p) => p.clientId === c.id).length,
            };
        }).sort((a, b) => b.outstanding - a.outstanding)
    );
}

// PATCH: billing terms & profile (validated)
export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const c = clients.find((x) => x.id === b.id && x.orgId === me.orgId);
    if (!c) return bad("Client not found", 404);
    const p = billingOf(c);
    const changes: string[] = [];

    if (b.commissionRate !== undefined) {
        const r = Number(b.commissionRate);
        if (!(r > 0 && r <= 50)) return bad("Commission must be between 0 and 50%");
        c.commissionRate = r; p.feePercent = r; changes.push(`commission ${r}%`);
    }
    if (b.creditDays !== undefined) {
        const d = Math.floor(Number(b.creditDays));
        if (!(d >= 0 && d <= 180)) return bad("Credit days must be 0–180");
        c.creditDays = d; changes.push(`credit ${d}d`);
    }
    if (b.gstin !== undefined) {
        const g = String(b.gstin || "").toUpperCase().trim();
        if (g && !GSTIN_RE.test(g)) return bad("GSTIN format is invalid (e.g. 27AABCA1234F1Z5)");
        p.gstin = g || null;
        if (g) { p.stateCode = g.slice(0, 2); p.pan = g.slice(2, 12); }
        changes.push(`GSTIN ${g || "removed"}`);
    }
    if (b.pan !== undefined) {
        const v = String(b.pan || "").toUpperCase().trim();
        if (v && !PAN_RE.test(v)) return bad("PAN format is invalid");
        p.pan = v || null;
    }
    if (b.stateCode !== undefined) { if (!/^\d{2}$/.test(String(b.stateCode))) return bad("State code must be 2 digits"); p.stateCode = String(b.stateCode); }
    if (b.country !== undefined) p.country = String(b.country || "India");
    if (b.currency !== undefined) { if (!CURRENCIES.includes(b.currency)) return bad("Unsupported currency"); p.currency = b.currency; }
    if (b.billingAddress !== undefined) p.billingAddress = String(b.billingAddress || "");
    if (b.billingEmails !== undefined) {
        const list = (Array.isArray(b.billingEmails) ? b.billingEmails : String(b.billingEmails).split(",")).map((x: string) => x.trim()).filter(Boolean);
        if (list.some((x: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) return bad("One of the billing emails is invalid");
        p.billingEmails = list;
    }
    if (b.feeModel !== undefined) { if (!["PERCENT", "FLAT", "SLAB"].includes(b.feeModel)) return bad("Invalid fee model"); p.feeModel = b.feeModel; }
    if (b.flatFee !== undefined) p.flatFee = Number(b.flatFee) || null;
    if (b.feeSlabs !== undefined) {
        const slabs = (Array.isArray(b.feeSlabs) ? b.feeSlabs : []).map((s: { uptoLpa: number; percent: number }) => ({ uptoLpa: Number(s.uptoLpa), percent: Number(s.percent) }));
        if (slabs.some((s: { uptoLpa: number; percent: number }) => !(s.uptoLpa > 0) || !(s.percent > 0 && s.percent <= 50))) return bad("Each slab needs a CTC ceiling and a 0–50% rate");
        p.feeSlabs = slabs;
    }
    if (p.feeModel === "FLAT" && !p.flatFee) return bad("Enter the flat fee");
    if (p.feeModel === "SLAB" && !p.feeSlabs?.length) return bad("Add at least one fee slab");
    if (b.splitOnOfferPct !== undefined) { const v = Number(b.splitOnOfferPct); if (!(v >= 0 && v < 100)) return bad("Offer split must be 0–99%"); p.splitOnOfferPct = v; }
    if (b.guaranteeDays !== undefined) { const v = Math.floor(Number(b.guaranteeDays)); if (!(v >= 0 && v <= 365)) return bad("Guarantee must be 0–365 days"); p.guaranteeDays = v; }
    if (b.creditLimit !== undefined) p.creditLimit = Number(b.creditLimit) > 0 ? Number(b.creditLimit) : null;

    c.billing = p;
    c.updatedAt = new Date().toISOString();
    refreshCreditHolds(me.orgId);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "CLIENT_BILLING_UPDATED", entity: "Client", entityId: c.id, detail: `${c.companyName}: ${changes.join(", ") || "billing profile updated"}` });
    return NextResponse.json({ ...c, billing: billingOf(c) });
}
