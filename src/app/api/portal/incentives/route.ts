import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { agentProfiles, commissionLedger, payeeProfiles } from "@/lib/mock/data";
import { csvResponse } from "@/lib/mock/fin/http";
import { agentStats } from "@/lib/mock/recruiter";

const TIERS = [
    { label: "Offered CTC below 5 LPA", amount: 5000 },
    { label: "5 – 10 LPA", amount: 10000 },
    { label: "10 – 20 LPA", amount: 15000 },
    { label: "20 LPA and above", amount: 25000 },
];

// GET — my incentive ledger. ?summary=1 adds totals, commission tiers and payout readiness; ?format=csv downloads a statement.
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const sp = new URL(request.url).searchParams;

    const myLedger = commissionLedger
        .filter((l) => l.orgId === me.orgId && l.userId === me.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const entries = myLedger.map((l) => ({
        id: l.id,
        description: l.description,
        // PAYOUT rows are money leaving your pocket → show as debit
        type: l.type === "PAYOUT" || l.type === "CLAWBACK" ? "DEBIT" : "CREDIT",
        kind: l.type,
        tdsAmount: l.tdsAmount ?? 0,
        amount: Math.abs(l.amountInr),
        status: l.status,
        date: l.createdAt,
        paidOn: l.paidAt ?? null,
    }));

    if (sp.get("format") === "csv") {
        const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const rows = [["Date", "Description", "Type", "Status", "Gross (INR)", "TDS (INR)", "Net (INR)", "Paid on"].join(",")];
        entries.forEach((e) => {
            const sign = e.type === "DEBIT" ? -1 : 1;
            rows.push([e.date.slice(0, 10), q(e.description), e.kind, e.status, sign * e.amount, e.tdsAmount, sign * e.amount - e.tdsAmount, e.paidOn?.slice(0, 10) ?? ""].join(","));
        });
        return csvResponse(rows.join("\n"), `incentive-statement-${me.name.replace(/\W+/g, "-").toLowerCase()}.csv`);
    }
    if (!sp.get("summary")) return NextResponse.json(entries);

    const kyc = agentProfiles.find((p) => p.userId === me.id);
    const pay = payeeProfiles.find((p) => p.userId === me.id);
    const blockers: string[] = [];
    if (kyc && kyc.kycStatus !== "VERIFIED") blockers.push(kyc.kycStatus === "REJECTED" ? `KYC rejected: ${kyc.kycNote ?? "update your details"}` : "KYC verification pending");
    if (!pay?.pan) blockers.push("PAN missing — payouts attract 20% TDS without PAN");
    if (!pay?.bankAccountNumber && !pay?.upiId) blockers.push("Add a bank account or UPI ID");
    return NextResponse.json({ entries, summary: agentStats(me.id), tiers: TIERS, payoutReady: blockers.length === 0, blockers, tdsNote: "TDS under section 194H (commission) is deducted at payout." });
}
