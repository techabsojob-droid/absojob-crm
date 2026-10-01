import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { commissionLedger, payouts, clients, users, applications, referrals, addAudit, addNotification } from "@/lib/mock/data";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const ledger = commissionLedger
        .filter((l) => l.orgId === me.orgId)
        .map((l) => ({
            ...l,
            clientName: l.clientId ? clients.find((c) => c.id === l.clientId)?.companyName ?? null : null,
            userName: l.userId ? users.find((u) => u.id === l.userId)?.name ?? null : null,
        }));

    const orgPayouts = payouts
        .filter((p) => p.orgId === me.orgId)
        .map((p) => ({ ...p, userName: users.find((u) => u.id === p.userId)?.name ?? "—" }));

    const receivables = ledger.filter((l) => l.type === "PLACEMENT_COMMISSION" && ["PENDING", "APPROVED"].includes(l.status));
    const totalReceivable = receivables.reduce((s, l) => s + l.amountInr, 0);
    const totalCollected = ledger
        .filter((l) => l.type === "PLACEMENT_COMMISSION" && l.status === "PAID")
        .reduce((s, l) => s + l.amountInr, 0);
    const incentivesPaid = ledger
        .filter((l) => l.type === "REFERRAL_INCENTIVE" && l.status === "PAID")
        .reduce((s, l) => s + Math.abs(l.amountInr), 0);
    const incentivesPending = ledger
        .filter((l) => l.type === "REFERRAL_INCENTIVE" && ["APPROVED", "PENDING"].includes(l.status))
        .reduce((s, l) => s + Math.abs(l.amountInr), 0);

    return NextResponse.json({
        summary: { totalReceivable, totalCollected, incentivesPaid, incentivesPending },
        ledger,
        payouts: orgPayouts,
    });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, action } = await request.json();
    const entry = commissionLedger.find((l) => l.id === id && l.orgId === me.orgId);
    if (!entry) return NextResponse.json({ error: "Ledger entry not found" }, { status: 404 });

    if (!["approve", "mark_paid"].includes(action)) {
        return NextResponse.json({ error: "action must be approve or mark_paid" }, { status: 400 });
    }
    if (action === "approve" && entry.status !== "PENDING") {
        return NextResponse.json({ error: `Entry is already ${entry.status.toLowerCase()}` }, { status: 409 });
    }
    if (action === "mark_paid" && !["APPROVED", "PENDING"].includes(entry.status)) {
        return NextResponse.json({ error: `Entry is already ${entry.status.toLowerCase()}` }, { status: 409 });
    }

    if (action === "approve") {
        entry.status = "APPROVED";
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "LEDGER_APPROVED", entity: "CommissionLedgerEntry", entityId: entry.id,
            detail: `${entry.description} (₹${Math.abs(entry.amountInr).toLocaleString("en-IN")})`,
        });
    } else if (action === "mark_paid") {
        entry.status = "PAID";
        entry.paidAt = new Date().toISOString();
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "PAYMENT_MARKED_PAID", entity: "CommissionLedgerEntry", entityId: entry.id,
            detail: `₹${Math.abs(entry.amountInr).toLocaleString("en-IN")} — ${entry.description}`,
        });
    }

    // Keep the agent's referral and wallet in step with the ledger
    if (entry.type === "REFERRAL_INCENTIVE" && entry.userId) {
        if (action === "mark_paid" && entry.applicationId) {
            const app = applications.find((a) => a.id === entry.applicationId);
            const ref = app ? referrals.find((r) => r.agentId === entry.userId && r.candidateId === app.candidateId) : undefined;
            if (ref) ref.incentivePaid = true;
        }
        addNotification({
            orgId: me.orgId, userId: entry.userId,
            title: action === "mark_paid" ? "Incentive paid 💸" : "Incentive approved",
            message: `₹${Math.abs(entry.amountInr).toLocaleString("en-IN")} — ${entry.description}`,
            link: "/portal/incentives",
        });
    }

    return NextResponse.json(entry);
}
