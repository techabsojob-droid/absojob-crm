import { NextResponse } from "next/server";
import { budgets } from "@/lib/mock/data";
import { budgetVsActual } from "@/lib/mock/finance";
import { bad, body, requireFinance } from "@/lib/mock/fin/http";

export async function GET(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const month = new URL(request.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
    return NextResponse.json({ month, rows: budgetVsActual(auth.user.orgId, month) });
}

// POST: set / update a budget line (category = REVENUE or an expense category)
export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month ?? "")) return bad("month must be YYYY-MM");
    const amount = Number(b.amount);
    if (!(amount >= 0)) return bad("Amount must be zero or more");
    if (!String(b.category ?? "").trim()) return bad("Category is required");
    const existing = budgets.find((x) => x.orgId === me.orgId && x.month === b.month && x.category === b.category);
    if (existing) existing.amount = amount;
    else budgets.push({ id: `bud-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, month: b.month, category: String(b.category), amount });
    return NextResponse.json({ month: b.month, rows: budgetVsActual(me.orgId, b.month) }, { status: 201 });
}
