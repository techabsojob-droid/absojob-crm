"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Printer, Download, Mail } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { api } from "@/lib/api";
import { btn, money, useAct } from "@/components/finance/kit";
import { FileText } from "lucide-react";

interface Statement { client: { id: string; name: string; gstin?: string | null; billingAddress?: string | null }; company: string; opening: number; closing: number; lines: { date: string; type: string; ref: string; description: string; debit: number; credit: number; balance: number }[] }

function Content() {
    const params = useSearchParams();
    const [clientId, setClientId] = useState(params.get("clientId") ?? "");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const { data: clients = [] } = useQuery<{ id: string; companyName: string }[]>({ queryKey: ["finance-clients"], queryFn: () => api("/api/finance/clients") });
    const { data, isLoading } = useQuery<Statement>({ queryKey: ["statement", clientId, from, to], queryFn: () => api(`/api/finance/statement?clientId=${clientId}&from=${from}&to=${to}`), enabled: !!clientId });
    const email = useAct<{ to: string[]; status: string }>("/api/finance/statement", "POST", [], (r) => `Statement emailed to ${r.to.join(", ") || "—"} (${r.status.toLowerCase()})`);

    return (
        <div className="space-y-6">
            <PageHeader title="Statement of Account" subtitle="Running balance of invoices, notes, receipts and write-offs for a client" />
            <div className="flex flex-wrap items-center gap-2 print:hidden">
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="px-3 py-2 rounded-xl border border-neutral-200 text-sm"><option value="">Select client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 rounded-xl border border-neutral-200 text-sm" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 rounded-xl border border-neutral-200 text-sm" />
                {clientId && <>
                    <a href={`/api/finance/statement?clientId=${clientId}&from=${from}&to=${to}&format=csv`} className={`${btn.ghost} flex items-center gap-1`}><Download size={13} /> CSV</a>
                    <button onClick={() => window.print()} className={`${btn.ghost} flex items-center gap-1`}><Printer size={13} /> Print</button>
                    <button onClick={() => email.mutate({ clientId })} className={`${btn.primary} flex items-center gap-1`}><Mail size={13} /> Email to client</button>
                </>}
            </div>
            {!clientId ? <SectionCard><EmptyState icon={FileText} message="Choose a client to see their statement." /></SectionCard> : isLoading || !data ? <SkeletonPulse className="h-64 w-full" /> : (
                <SectionCard title={`${data.client.name}${data.client.gstin ? ` · ${data.client.gstin}` : ""}`} subtitle={`${data.company} · opening ${money(data.opening)} · closing ${money(data.closing)}`}>
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Date</th><th>Type</th><th>Reference</th><th>Details</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
                        <tbody className="divide-y divide-neutral-100">
                            <tr><td className="py-2" colSpan={6}>Opening balance</td><td className="text-right font-mono">{money(data.opening)}</td></tr>
                            {data.lines.map((l, i) => <tr key={i}><td className="py-2">{l.date}</td><td>{l.type}</td><td className="font-mono text-xs">{l.ref}</td><td className="text-xs text-neutral-600 max-w-xs truncate">{l.description}</td><td className="text-right font-mono">{l.debit ? money(l.debit) : ""}</td><td className="text-right font-mono">{l.credit ? money(l.credit) : ""}</td><td className="text-right font-mono font-bold">{money(l.balance)}</td></tr>)}
                            <tr className="font-bold border-t-2 border-neutral-300"><td className="py-2" colSpan={6}>Closing balance (amount due)</td><td className="text-right font-mono">{money(data.closing)}</td></tr>
                        </tbody>
                    </table>
                </SectionCard>
            )}
        </div>
    );
}

export default function StatementPage() {
    return <Suspense fallback={<SkeletonPulse className="h-64 w-full" />}><Content /></Suspense>;
}
