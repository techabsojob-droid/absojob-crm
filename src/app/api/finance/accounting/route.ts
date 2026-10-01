import { NextResponse } from "next/server";
import { manualJournals, addAudit } from "@/lib/mock/data";
import { accountLedger, balanceSheet, buildJournal, CHART_OF_ACCOUNTS, fyBounds, periodLockError, profitAndLoss, tallyXml, trialBalance, zohoJournalCsv, cashFlow, settingsFor } from "@/lib/mock/finance";
import { bad, body, csvResponse, requireFinance } from "@/lib/mock/fin/http";

// GET ?view=trial|pnl|balance|journal|ledger|cashflow|accounts · ?export=tally|zoho
export async function GET(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const url = new URL(request.url);
    const fy = fyBounds();
    const from = url.searchParams.get("from") || fy.from;
    const to = url.searchParams.get("to") || new Date().toISOString().split("T")[0];
    const exp = url.searchParams.get("export");
    if (exp === "tally") return csvResponse(tallyXml(me.orgId, from, to), `tally-vouchers-${from}-${to}.xml`, "application/xml");
    if (exp === "zoho") return csvResponse(zohoJournalCsv(me.orgId, from, to), `zoho-journals-${from}-${to}.csv`);

    switch (url.searchParams.get("view")) {
        case "pnl": return NextResponse.json({ from, to, ...profitAndLoss(me.orgId, from, to) });
        case "balance": return NextResponse.json(balanceSheet(me.orgId, to));
        case "journal": return NextResponse.json(buildJournal(me.orgId).filter((e) => e.date >= from && e.date <= to).reverse().slice(0, 500));
        case "ledger": return NextResponse.json(accountLedger(me.orgId, url.searchParams.get("account") || "Accounts Receivable", from, to));
        case "cashflow": return NextResponse.json(cashFlow(me.orgId, from, to));
        case "accounts": return NextResponse.json({ chart: CHART_OF_ACCOUNTS, banks: settingsFor(me.orgId).bankAccounts.map((b) => `Bank - ${b.name}`) });
        default: return NextResponse.json({ from, to, ...trialBalance(me.orgId, to) });
    }
}

// POST: manual journal entry (must balance; respects period lock)
export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const date = b.date || new Date().toISOString().split("T")[0];
    const lock = periodLockError(me.orgId, date);
    if (lock) return bad(lock, 423);
    if (!String(b.narration ?? "").trim()) return bad("Narration is required");
    const valid = new Set([...CHART_OF_ACCOUNTS.map((a) => a.name), ...settingsFor(me.orgId).bankAccounts.map((x) => `Bank - ${x.name}`)]);
    const lines = (Array.isArray(b.lines) ? b.lines : []).map((l: { account: string; debit?: number; credit?: number; memo?: string }) => ({ account: String(l.account), debit: Math.round((Number(l.debit) || 0) * 100) / 100, credit: Math.round((Number(l.credit) || 0) * 100) / 100, memo: l.memo }))
        .filter((l: { debit: number; credit: number }) => l.debit || l.credit);
    if (lines.length < 2) return bad("A journal needs at least two lines");
    if (lines.some((l: { account: string; debit: number; credit: number }) => !valid.has(l.account) || (l.debit && l.credit) || l.debit < 0 || l.credit < 0)) return bad("Each line needs a valid account and either a debit or a credit");
    const dr = lines.reduce((s: number, l: { debit: number }) => s + l.debit, 0), cr = lines.reduce((s: number, l: { credit: number }) => s + l.credit, 0);
    if (Math.abs(dr - cr) > 0.005) return bad(`Debits (${dr}) must equal credits (${cr})`);
    const j = { id: `mj-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, date, narration: String(b.narration).trim(), lines, createdByName: me.name, createdAt: new Date().toISOString() };
    manualJournals.unshift(j);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "JOURNAL_POSTED", entity: "ManualJournal", entityId: j.id, detail: `${date}: ${j.narration} (₹${dr})` });
    return NextResponse.json(j, { status: 201 });
}
