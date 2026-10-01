import { NextResponse } from "next/server";
import { commissionLedger, payouts, payeeProfiles, users, addAudit, addNotification } from "@/lib/mock/data";
import { candidateNameForApp, IFSC_RE, PAN_RE, payIncentives, payeeProfileOf, pendingClawbacks, settingsFor } from "@/lib/mock/finance";
import { bad, body, requireFinance, respond } from "@/lib/mock/fin/http";

const TYPES = ["REFERRAL_INCENTIVE", "RECRUITER_INCENTIVE", "CLAWBACK"];

// Incentives (referral + recruiter), clawbacks, payout history and payee bank/PAN profiles
export async function GET() {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const tdsPct = settingsFor(me.orgId).commissionTdsPct;
    const incentives = commissionLedger
        .filter((l) => l.orgId === me.orgId && TYPES.includes(l.type))
        .map((l) => {
            const profile = l.userId ? payeeProfileOf(l.userId) : null;
            const gross = Math.abs(l.amountInr);
            return {
                ...l, amount: gross, tdsPreview: l.type === "CLAWBACK" ? 0 : Math.round(gross * (tdsPct / 100)),
                payeeName: users.find((u) => u.id === l.userId)?.name ?? "—", payeeRole: users.find((u) => u.id === l.userId)?.role ?? null,
                candidateName: candidateNameForApp(l.applicationId), hasBankDetails: !!(profile?.bankAccountNumber || profile?.upiId),
                pendingClawback: l.userId ? pendingClawbacks(me.orgId, l.userId).reduce((s, c) => s + Math.abs(c.amountInr), 0) : 0,
            };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const payeeIds = Array.from(new Set(incentives.map((i) => i.userId).filter(Boolean))) as string[];
    return NextResponse.json({
        tdsPct,
        incentives,
        payouts: payouts.filter((p) => p.orgId === me.orgId).map((p) => ({ ...p, payeeName: users.find((u) => u.id === p.userId)?.name ?? "—" })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        payees: payeeIds.map((id) => ({ userId: id, name: users.find((u) => u.id === id)?.name ?? "—", role: users.find((u) => u.id === id)?.role, ...(payeeProfileOf(id) ?? {}) })),
    });
}

// PATCH: approve | pay (batch, 194H TDS, clawback netting) | cancel
export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const ids: string[] = Array.isArray(b.ids) ? b.ids : b.id ? [b.id] : [];
    if (!ids.length) return bad("Select at least one incentive");

    if (b.action === "pay") return respond(payIncentives(me, ids, b.method ?? "BANK_TRANSFER", b.reference));
    const entries = ids.map((id) => commissionLedger.find((l) => l.id === id && l.orgId === me.orgId && TYPES.includes(l.type)));
    if (entries.some((e) => !e)) return bad("Incentive not found", 404);
    if (b.action === "approve") {
        if (entries.some((e) => e!.status !== "PENDING")) return bad("Only pending incentives can be approved", 409);
        entries.forEach((e) => { e!.status = "APPROVED"; if (e!.userId) addNotification({ orgId: me.orgId, userId: e!.userId, title: "Incentive approved", message: `₹${Math.abs(e!.amountInr).toLocaleString("en-IN")} — ${e!.description}`, link: "/portal/incentives" }); });
    } else if (b.action === "cancel") {
        if (entries.some((e) => e!.status === "PAID")) return bad("Paid items cannot be cancelled", 409);
        if (!String(b.reason ?? "").trim()) return bad("A reason is required");
        entries.forEach((e) => { e!.status = "CANCELLED"; });
    } else return bad("action must be approve, pay or cancel");
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `INCENTIVE_${String(b.action).toUpperCase()}`, entity: "CommissionLedgerEntry", entityId: ids.join(","), detail: `${ids.length} item(s)${b.reason ? ` — ${b.reason}` : ""}` });
    return NextResponse.json({ updated: ids.length });
}

// PUT: payee bank / PAN profile (for payouts and 194H)
export async function PUT(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const u = users.find((x) => x.id === b.userId && x.orgId === me.orgId);
    if (!u) return bad("Payee not found", 404);
    const pan = String(b.pan ?? "").toUpperCase().trim();
    const ifsc = String(b.bankIfsc ?? "").toUpperCase().trim();
    if (pan && !PAN_RE.test(pan)) return bad("PAN format is invalid");
    if (ifsc && !IFSC_RE.test(ifsc)) return bad("IFSC format is invalid");
    let p = payeeProfiles.find((x) => x.userId === u.id);
    if (!p) { p = { userId: u.id }; payeeProfiles.push(p); }
    Object.assign(p, { pan: pan || null, bankName: b.bankName || null, bankAccountNumber: b.bankAccountNumber || null, bankIfsc: ifsc || null, upiId: b.upiId || null });
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "PAYEE_PROFILE_UPDATED", entity: "User", entityId: u.id, detail: `${u.name}: bank/PAN updated` });
    return NextResponse.json(p);
}
