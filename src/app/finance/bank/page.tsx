"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Landmark, Upload } from "lucide-react";
import { PageHeader, SectionCard, EmptyState, StatCard } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, money, parseStatementCsv, useAct } from "@/components/finance/kit";

interface Line { id: string; date: string; description: string; reference?: string | null; debit: number; credit: number; matchedId?: string | null }
interface Txn { key: string; date: string; ref: string; narration: string; amount: number }
interface Data { accounts: { id: string; name: string }[]; bankAccountId: string; summary: { account: string; statementLines: Line[]; unmatchedBook: Txn[]; bookBalance: number; statementNet: number; matched: number; unmatched: number } | null }

export default function BankRecPage() {
    const [bankId, setBankId] = useState("");
    const [selLine, setSelLine] = useState<string | null>(null);
    const { data } = useQuery<Data>({ queryKey: ["finance-bank", bankId], queryFn: () => api(`/api/finance/bank${bankId ? `?bankAccountId=${bankId}` : ""}`) });
    const keys = ["finance-bank", "finance-receipts"];
    const imp = useAct<{ imported: number; skipped: number; matched: number }>("/api/finance/bank", "POST", keys, (r) => `${r.imported} imported, ${r.skipped} skipped, ${r.matched} auto-matched`);
    const act = useAct<{ matched?: number }>("/api/finance/bank", "PATCH", keys, (r) => (r.matched !== undefined ? `${r.matched} matched` : "Updated"));
    const s = data?.summary;
    const account = bankId || data?.bankAccountId || "";

    return (
        <div className="space-y-6">
            <PageHeader title="Bank Reconciliation" subtitle="Import the bank statement (CSV: date, description, reference, debit, credit) and match it to receipts and payments in the books"
                action={<div className="flex gap-2 items-center">
                    <select value={account} onChange={(e) => setBankId(e.target.value)} className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold">{data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                    <label className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2 cursor-pointer"><Upload size={14} /> Import CSV
                        <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const lines = parseStatementCsv(await f.text()); if (!lines.length) return toast.error("No rows found — check the CSV header"); imp.mutate({ bankAccountId: account, lines }); e.target.value = ""; }} />
                    </label>
                    <button onClick={() => act.mutate({ action: "auto" })} className={btn.ghost}>Auto-match</button>
                </div>} />
            {!s ? <SectionCard><EmptyState icon={Landmark} message="Add a bank account in Finance Settings." /></SectionCard> : <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Balance as per books" value={money(s.bookBalance)} icon={Landmark} tone="primary" />
                    <StatCard label="Statement net (imported)" value={money(s.statementNet)} icon={Landmark} tone="blue" />
                    <StatCard label="Matched lines" value={s.matched} icon={Landmark} tone="emerald" />
                    <StatCard label="Unmatched lines" value={s.unmatched} icon={Landmark} tone={s.unmatched ? "amber" : "emerald"} />
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                    <SectionCard title="Bank statement" subtitle="Select an unmatched line, then pick the book entry on the right">
                        {s.statementLines.length === 0 ? <EmptyState icon={Upload} message="Import a statement to begin." /> : (
                            <ul className="divide-y divide-neutral-100 text-sm max-h-[520px] overflow-y-auto">
                                {s.statementLines.map((l) => (
                                    <li key={l.id} onClick={() => !l.matchedId && setSelLine(l.id)} className={`py-2 px-2 rounded-lg flex justify-between gap-2 ${l.matchedId ? "opacity-60" : "cursor-pointer hover:bg-neutral-50"} ${selLine === l.id ? "bg-primary/10" : ""}`}>
                                        <span className="min-w-0"><span className="text-xs text-neutral-500">{l.date}</span> <span className="truncate">{l.description}</span>{l.reference && <span className="text-[11px] text-neutral-400"> · {l.reference}</span>}</span>
                                        <span className="flex items-center gap-2 shrink-0"><span className={`font-mono ${l.credit ? "text-emerald-700" : "text-red-600"}`}>{l.credit ? `+${money(l.credit)}` : `−${money(l.debit)}`}</span>{l.matchedId ? <button onClick={(e) => { e.stopPropagation(); act.mutate({ action: "unmatch", lineId: l.id }); }} className="text-[11px] text-neutral-500 underline">unmatch</button> : <span className="text-[11px] text-amber-700 font-bold">open</span>}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                    <SectionCard title="Unreconciled book entries" subtitle={selLine ? "Click an entry to match it to the selected statement line" : "Select a statement line first"}>
                        {s.unmatchedBook.length === 0 ? <EmptyState icon={Landmark} message="Everything in the books is reconciled." /> : (
                            <ul className="divide-y divide-neutral-100 text-sm max-h-[520px] overflow-y-auto">
                                {s.unmatchedBook.map((t) => (
                                    <li key={t.key} onClick={() => selLine && act.mutate({ action: "match", lineId: selLine, key: t.key }, { onSuccess: () => setSelLine(null) })} className={`py-2 px-2 rounded-lg flex justify-between gap-2 ${selLine ? "cursor-pointer hover:bg-emerald-50" : ""}`}>
                                        <span className="min-w-0"><span className="text-xs text-neutral-500">{t.date}</span> <span className="truncate">{t.narration}</span></span>
                                        <span className={`font-mono shrink-0 ${t.amount >= 0 ? "text-emerald-700" : "text-red-600"}`}>{t.amount >= 0 ? "+" : "−"}{money(Math.abs(t.amount))}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                </div>
            </>}
        </div>
    );
}
