import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { commissionLedger } from "@/lib/mock/data";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "AGENT", "EMPLOYEE");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const myLedger = commissionLedger
        .filter((l) => l.orgId === me.orgId && l.userId === me.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const entries = myLedger.map((l) => ({
        id: l.id,
        description: l.description,
        // PAYOUT rows are money leaving your pocket → show as debit
        type: l.type === "PAYOUT" ? "DEBIT" : "CREDIT",
        amount: Math.abs(l.amountInr),
        status: l.status,
        date: l.createdAt,
        paidOn: l.paidAt ?? null,
    }));

    return NextResponse.json(entries);
}
