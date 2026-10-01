"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, Plus, Trash2 } from "lucide-react";
import { PageHeader, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, inputCls, money, Tabs, useAct } from "@/components/finance/kit";

type View = "trial" | "pnl" | "balance" | "journal" | "ledger";
interface TB { rows: { account: string; type: string; debit: number; credit: number; balance: number }[]; totalDebit: number; totalCredit: number }
interface PnL { income: { account: string; amount: number }[]; expense: { account: string; amount: number }[]; totalIncome: number; totalExpense: number; netProfit: number }
interface BS { asOf: string; assets: { account: string; amount: number }[]; liabilities: { account: string; amount: number }[]; equity: { account: string; amount: number }[]; totalAssets: number; totalLiabilitiesAndEquity: number; balanced: boolean }
interface JE { key: string; date: string; source: string; ref: string; narration: string; lines: { account: string; debit: number; credit: number }[] }

export default function AccountingPage() {
    const [view, setView] = useState<View>("trial");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [account, setAccount] = useState("Accounts Receivable");
    const [jOpen, setJOpen] = useState(false);
    const [j, setJ] = useState({ date: "", narration: "", lines: [{ account: "", debit: "", credit: "" }, { account: "", debit: "", credit: "" }] });
    const qs = `from=${from}&to=${to}`;
    const { data: accounts } = useQuery<{ chart: { name: string; type: string }[]; banks: string[] }>({ queryKey: ["coa"], queryFn: () => api("/api/finance/accounting?view=accounts") });
    const { data, isLoading } = useQuery({ queryKey: ["accounting", view, from, to, account], queryFn: () => api(`/api/finance/accounting?view=${view}&${qs}&account=${encodeURIComponent(account)}`) });
    const post = useAct("/api/finance/accounting", "POST", ["accounting"], "Journal posted");
    const names = [...(accounts?.banks ?? []), ...(accounts?.chart.map((a) => a.name) ?? [])];
    const dr = j.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0), cr = j.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

    return (
        <div className="space-y-6">
            <PageHeader title="Books & Ledger" subtitle="Double-entry general ledger auto-posted from invoices, receipts, payroll, bills, expenses, incentives and contractor pay"
                action={<div className="flex gap-2">
                    <a href={`/api/finance/accounting?export=tally&${qs}`} className={`${btn.ghost} inline-flex items-center gap-1`}><Download size={13} /> Tally XML</a>
                    <a href={`/api/finance/accounting?export=zoho&${qs}`} className={`${btn.ghost} inline-flex items-center gap-1`}><Download size={13} /> Zoho CSV</a>
                    <button onClick={() => setJOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"><Plus size={15} /> Journal entry</button>
                </div>} />
            <div className="flex flex-wrap items-center gap-2">
                <Tabs tabs={[{ id: "trial", label: "Trial balance" }, { id: "pnl", label: "Profit & loss" }, { id: "balance", label: "Balance sheet" }, { id: "journal", label: "Day book" }, { id: "ledger", label: "Account ledger" }]} value={view} onChange={setView} />
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border border-neutral-200 text-xs" title="From (default: FY start)" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-neutral-200 text-xs" title="To (default: today)" />
                {view === "ledger" && <select value={account} onChange={(e) => setAccount(e.target.value)} className="px-2 py-1.5 rounded-lg border border-neutral-200 text-xs">{names.map((n) => <option key={n}>{n}</option>)}</select>}
            </div>

            {isLoading || !data ? <SectionCard><p className="text-sm text-neutral-400">Loading…</p></SectionCard> : <>
                {view === "trial" && (() => { const t = data as TB; return (
                    <SectionCard title={`Trial balance ${Math.abs(t.totalDebit - t.totalCredit) < 1 ? "✓ balanced" : "⚠ out of balance"}`}>
                        <table className="w-full text-sm"><thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Account</th><th>Type</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">{t.rows.map((r) => <tr key={r.account}><td className="py-2"><button onClick={() => { setAccount(r.account); setView("ledger"); }} className="hover:text-primary">{r.account}</button></td><td className="text-xs text-neutral-500">{r.type}</td><td className="text-right font-mono">{r.balance > 0 ? money(r.balance) : ""}</td><td className="text-right font-mono">{r.balance < 0 ? money(-r.balance) : ""}</td></tr>)}
                                <tr className="font-bold border-t-2 border-neutral-300"><td className="py-2">Total</td><td /><td className="text-right font-mono">{money(t.rows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0))}</td><td className="text-right font-mono">{money(-t.rows.filter((r) => r.balance < 0).reduce((s, r) => s + r.balance, 0))}</td></tr></tbody></table>
                    </SectionCard>); })()}
                {view === "pnl" && (() => { const p = data as PnL; return (
                    <SectionCard title={`Profit & loss · net ${money(p.netProfit)}`}>
                        <div className="grid md:grid-cols-2 gap-6 text-sm">
                            <div><p className="font-bold mb-1">Income</p>{p.income.map((r) => <div key={r.account} className="flex justify-between py-1 border-b border-neutral-100"><span>{r.account}</span><span className="font-mono">{money(r.amount)}</span></div>)}<div className="flex justify-between py-1 font-bold"><span>Total income</span><span className="font-mono">{money(p.totalIncome)}</span></div></div>
                            <div><p className="font-bold mb-1">Expenses</p>{p.expense.map((r) => <div key={r.account} className="flex justify-between py-1 border-b border-neutral-100"><span>{r.account}</span><span className="font-mono">{money(r.amount)}</span></div>)}<div className="flex justify-between py-1 font-bold"><span>Total expenses</span><span className="font-mono">{money(p.totalExpense)}</span></div></div>
                        </div>
                        <p className={`mt-3 text-base font-extrabold ${p.netProfit < 0 ? "text-red-600" : "text-emerald-700"}`}>Net {p.netProfit < 0 ? "loss" : "profit"}: {money(Math.abs(p.netProfit))}</p>
                    </SectionCard>); })()}
                {view === "balance" && (() => { const b = data as BS; const col = (title: string, rows: { account: string; amount: number }[]) => <div><p className="font-bold mb-1">{title}</p>{rows.map((r) => <div key={r.account} className="flex justify-between py-1 border-b border-neutral-100"><span>{r.account}</span><span className="font-mono">{money(r.amount)}</span></div>)}</div>; return (
                    <SectionCard title={`Balance sheet as of ${b.asOf} ${b.balanced ? "✓" : "⚠"}`}>
                        <div className="grid md:grid-cols-2 gap-6 text-sm">
                            <div>{col("Assets", b.assets)}<div className="flex justify-between py-2 font-bold"><span>Total assets</span><span className="font-mono">{money(b.totalAssets)}</span></div></div>
                            <div>{col("Liabilities", b.liabilities)}<div className="h-3" />{col("Equity", b.equity)}<div className="flex justify-between py-2 font-bold"><span>Total liabilities & equity</span><span className="font-mono">{money(b.totalLiabilitiesAndEquity)}</span></div></div>
                        </div>
                    </SectionCard>); })()}
                {view === "journal" && (() => { const list = data as JE[]; return (
                    <SectionCard title={`Day book (${list.length})`}>
                        {list.length === 0 ? <EmptyState icon={BookOpen} message="No entries in this period." /> : <div className="space-y-3 text-sm">{list.map((e) => (
                            <div key={e.key} className="border border-neutral-200 rounded-xl p-3">
                                <p className="text-xs"><b>{e.date}</b> · {e.source.replace("_", " ")} · {e.ref} — <span className="text-neutral-500">{e.narration}</span></p>
                                {e.lines.map((l, i) => <div key={i} className="flex text-xs py-0.5"><span className={`flex-1 ${l.credit ? "pl-6" : ""}`}>{l.account}</span><span className="w-28 text-right font-mono">{l.debit ? money(l.debit) : ""}</span><span className="w-28 text-right font-mono">{l.credit ? money(l.credit) : ""}</span></div>)}
                            </div>
                        ))}</div>}
                    </SectionCard>); })()}
                {view === "ledger" && (() => { const rows = data as { date: string; ref: string; narration: string; debit: number; credit: number; balance: number }[]; return (
                    <SectionCard title={account}>
                        {rows.length === 0 ? <EmptyState icon={BookOpen} message="No movements." /> : <table className="w-full text-sm"><thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Date</th><th>Ref</th><th>Narration</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">{rows.map((r, i) => <tr key={i}><td className="py-1.5">{r.date}</td><td className="text-xs font-mono">{r.ref}</td><td className="text-xs text-neutral-600 max-w-xs truncate">{r.narration}</td><td className="text-right font-mono">{r.debit ? money(r.debit) : ""}</td><td className="text-right font-mono">{r.credit ? money(r.credit) : ""}</td><td className="text-right font-mono font-bold">{money(r.balance)}</td></tr>)}</tbody></table>}
                    </SectionCard>); })()}
            </>}

            <ModalShell open={jOpen} onClose={() => setJOpen(false)} title="Manual journal entry" wide>
                <form className="space-y-2 text-sm" onSubmit={(e) => { e.preventDefault(); post.mutate({ date: j.date || undefined, narration: j.narration, lines: j.lines.map((l) => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) }, { onSuccess: () => { setJOpen(false); setJ({ date: "", narration: "", lines: [{ account: "", debit: "", credit: "" }, { account: "", debit: "", credit: "" }] }); } }); }}>
                    <div className="grid grid-cols-3 gap-2"><input type="date" value={j.date} onChange={(e) => setJ({ ...j, date: e.target.value })} className={inputCls} /><input required placeholder="Narration (e.g. Bank charges Sept)" value={j.narration} onChange={(e) => setJ({ ...j, narration: e.target.value })} className={`${inputCls} col-span-2`} /></div>
                    {j.lines.map((l, i) => (
                        <div key={i} className="flex gap-2">
                            <select required value={l.account} onChange={(e) => setJ({ ...j, lines: j.lines.map((x, k) => (k === i ? { ...x, account: e.target.value } : x)) })} className={inputCls}><option value="">Account</option>{names.map((n) => <option key={n}>{n}</option>)}</select>
                            <input type="number" min="0" step="0.01" placeholder="Debit" value={l.debit} onChange={(e) => setJ({ ...j, lines: j.lines.map((x, k) => (k === i ? { ...x, debit: e.target.value, credit: e.target.value ? "" : x.credit } : x)) })} className={`${inputCls} w-32`} />
                            <input type="number" min="0" step="0.01" placeholder="Credit" value={l.credit} onChange={(e) => setJ({ ...j, lines: j.lines.map((x, k) => (k === i ? { ...x, credit: e.target.value, debit: e.target.value ? "" : x.debit } : x)) })} className={`${inputCls} w-32`} />
                            {j.lines.length > 2 && <button type="button" onClick={() => setJ({ ...j, lines: j.lines.filter((_, k) => k !== i) })} className="text-neutral-400 hover:text-rose-600" aria-label="Remove line"><Trash2 size={15} /></button>}
                        </div>
                    ))}
                    <div className="flex justify-between items-center"><button type="button" onClick={() => setJ({ ...j, lines: [...j.lines, { account: "", debit: "", credit: "" }] })} className="text-xs font-bold text-primary">+ Line</button><span className={`text-xs font-bold ${Math.abs(dr - cr) < 0.005 ? "text-emerald-700" : "text-rose-600"}`}>Dr {money(dr)} · Cr {money(cr)}</span></div>
                    <button disabled={post.isPending || Math.abs(dr - cr) >= 0.005 || dr === 0} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Post journal</button>
                </form>
            </ModalShell>
        </div>
    );
}
