import { NextResponse } from "next/server";
import { invoices, expenses, placements } from "@/lib/mock/data";
import { cashFlow, collectionForecast, dso, financeSnapshot, fyBounds, gstr1, gstr1Csv, inrOf, profitAndLoss, recruiterProfitability, tdsReport, budgetVsActual } from "@/lib/mock/finance";
import { bad, csvResponse, requireFinance } from "@/lib/mock/fin/http";

// GET ?type=summary (default) | gstr1&month | tds | forecast · ?export=gstr1&month
export async function GET(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const url = new URL(request.url);
    const fy = fyBounds();
    const from = url.searchParams.get("from") || fy.from;
    const to = url.searchParams.get("to") || new Date().toISOString().split("T")[0];
    const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    if (url.searchParams.get("export") === "gstr1") return csvResponse(gstr1Csv(me.orgId, month), `GSTR1-${month}.csv`);

    switch (url.searchParams.get("type")) {
        case "gstr1": return NextResponse.json(gstr1(me.orgId, month));
        case "tds": return NextResponse.json(tdsReport(me.orgId, from, to));
        case "forecast": return NextResponse.json(collectionForecast(me.orgId));
        case "budget": return NextResponse.json(budgetVsActual(me.orgId, month));
        case "summary":
        case null: break;
        default: return bad("Unknown report type");
    }

    const inRange = (d?: string | null) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
    const snap = financeSnapshot(me.orgId);
    const inv = snap.live.filter((i) => inRange(i.issueDate));
    const cn = snap.credits.filter((i) => inRange(i.issueDate));
    const byClient = new Map<string, { clientName: string; revenue: number; invoices: number }>();
    inv.forEach((i) => { const c = byClient.get(i.clientId) ?? { clientName: i.clientName, revenue: 0, invoices: 0 }; c.revenue += inrOf(i, i.subtotal); c.invoices++; byClient.set(i.clientId, c); });
    cn.forEach((i) => { const c = byClient.get(i.clientId); if (c) c.revenue -= inrOf(i, i.subtotal); });
    const byStream: Record<string, number> = {};
    inv.forEach((i) => { const k = i.milestone === "TIMESHEET" ? "Contract staffing" : i.milestone === "RETAINER" ? "Retainers" : i.milestone === "REBILL" ? "Re-billed expenses" : "Permanent placements"; byStream[k] = (byStream[k] ?? 0) + inrOf(i, i.subtotal); });
    const expenseByCategory: Record<string, number> = {};
    expenses.filter((e) => e.orgId === me.orgId && e.status === "PAID" && inRange(e.paidAt)).forEach((e) => { expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount - (e.gstAmount || 0); });

    return NextResponse.json({
        range: { from, to },
        pnl: profitAndLoss(me.orgId, from, to),
        byClient: Array.from(byClient.values()).sort((a, b) => b.revenue - a.revenue),
        byStream,
        recruiters: recruiterProfitability(me.orgId, from, to),
        expenseByCategory,
        cashflow: cashFlow(me.orgId, from, to),
        dso: dso(me.orgId),
        placementsInRange: placements.filter((p) => p.orgId === me.orgId && inRange(p.placementDate)).length,
        invoicesInRange: invoices.filter((i) => i.orgId === me.orgId && inRange(i.issueDate)).length,
    });
}
