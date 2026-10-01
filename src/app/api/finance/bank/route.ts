import { NextResponse } from "next/server";
import { bankStatementLines, addAudit } from "@/lib/mock/data";
import { autoMatch, bankTransactions, bankAccountName, reconciliationSummary, settingsFor } from "@/lib/mock/finance";
import { bad, body, requireFinance } from "@/lib/mock/fin/http";

export async function GET(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const s = settingsFor(me.orgId);
    const bankAccountId = new URL(request.url).searchParams.get("bankAccountId") || s.bankAccounts.find((b) => b.isDefault)?.id || s.bankAccounts[0]?.id;
    if (!bankAccountId) return NextResponse.json({ accounts: [], summary: null });
    return NextResponse.json({ accounts: s.bankAccounts, bankAccountId, summary: reconciliationSummary(me.orgId, bankAccountId) });
}

// POST: import statement lines (parsed CSV rows) then auto-match
export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const s = settingsFor(me.orgId);
    if (!s.bankAccounts.some((x) => x.id === b.bankAccountId)) return bad("Select a bank account");
    const rows = Array.isArray(b.lines) ? b.lines : [];
    if (!rows.length) return bad("No statement lines to import");
    let imported = 0, skipped = 0;
    for (const r of rows) {
        const date = String(r.date ?? "").slice(0, 10);
        const debit = Math.abs(Number(String(r.debit ?? "0").replace(/,/g, "")) || 0);
        const credit = Math.abs(Number(String(r.credit ?? "0").replace(/,/g, "")) || 0);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (!debit && !credit)) { skipped++; continue; }
        const dup = bankStatementLines.some((l) => l.bankAccountId === b.bankAccountId && l.date === date && l.debit === debit && l.credit === credit && l.description === String(r.description ?? ""));
        if (dup) { skipped++; continue; }
        bankStatementLines.push({ id: `bsl-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, bankAccountId: b.bankAccountId, date, description: String(r.description ?? "").slice(0, 200), reference: r.reference ? String(r.reference) : null, debit, credit, matchedType: null, matchedId: null, importedAt: new Date().toISOString() });
        imported++;
    }
    const matched = autoMatch(me.orgId);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "BANK_STATEMENT_IMPORTED", entity: "BankAccount", entityId: b.bankAccountId, detail: `${imported} line(s) imported, ${skipped} skipped, ${matched} auto-matched` });
    return NextResponse.json({ imported, skipped, matched }, { status: 201 });
}

// PATCH: manual match / unmatch · re-run auto-match
export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    if (b.action === "auto") return NextResponse.json({ matched: autoMatch(me.orgId) });
    const line = bankStatementLines.find((l) => l.id === b.lineId && l.orgId === me.orgId);
    if (!line) return bad("Statement line not found", 404);
    if (b.action === "unmatch") { line.matchedId = null; line.matchedType = null; return NextResponse.json(line); }
    if (b.action === "match") {
        const account = bankAccountName(me.orgId, line.bankAccountId);
        const t = bankTransactions(me.orgId, account).find((x) => x.key === b.key);
        if (!t) return bad("Book transaction not found", 404);
        if (bankStatementLines.some((l) => l.matchedId === t.key && l.id !== line.id)) return bad("That transaction is already matched", 409);
        if (Math.abs(t.amount - (line.credit - line.debit)) > 1) return bad(`Amounts differ (book ₹${t.amount} vs bank ₹${line.credit - line.debit})`);
        line.matchedId = t.key;
        line.matchedType = t.amount >= 0 ? "RECEIPT" : "PAYMENT";
        return NextResponse.json(line);
    }
    return bad("Unknown action");
}
