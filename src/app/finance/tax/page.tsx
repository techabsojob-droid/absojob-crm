"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Scale } from "lucide-react";
import { PageHeader, SectionCard, EmptyState, StatCard } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, money, Tabs } from "@/components/finance/kit";

interface Row { gstin: string; receiver: string; number: string; date: string; value: number; placeOfSupply: string; rate: number; taxable: number; igst: number; cgst: number; sgst: number; noteFor: string }
interface G1 { month: string; b2b: Row[]; b2c: Row[]; exports: Row[]; cdnr: Row[]; summary: { taxable: number; igst: number; cgst: number; sgst: number; outputTax: number; inputTax: number; netPayable: number; dueDate: string } }
interface TDS { receivable: { clientName: string; tds: number; receipts: number }[]; totalReceivable: number; payable: { section: string; payee: string; pan: string; amount: number; tds: number; date: string }[]; bySection: Record<string, number>; totalPayable: number }

export default function TaxPage() {
    const [tab, setTab] = useState<"gst" | "tds">("gst");
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const { data: g } = useQuery<G1>({ queryKey: ["gstr1", month], queryFn: () => api(`/api/finance/reports?type=gstr1&month=${month}`), enabled: tab === "gst" });
    const { data: t } = useQuery<TDS>({ queryKey: ["tds", from, to], queryFn: () => api(`/api/finance/reports?type=tds&from=${from}&to=${to}`), enabled: tab === "tds" });
    const table = (title: string, rows: Row[]) => rows.length > 0 && (
        <SectionCard title={`${title} (${rows.length})`}>
            <table className="w-full text-xs"><thead><tr className="text-left font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">GSTIN</th><th>Party</th><th>No.</th><th>Date</th><th>POS</th><th className="text-right">Taxable</th><th className="text-right">IGST</th><th className="text-right">CGST</th><th className="text-right">SGST</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">{rows.map((r) => <tr key={r.number}><td className="py-1.5 font-mono">{r.gstin || "—"}</td><td>{r.receiver}</td><td className="font-mono">{r.number}{r.noteFor && <span className="block text-neutral-400">vs {r.noteFor}</span>}</td><td>{r.date}</td><td>{r.placeOfSupply}</td><td className="text-right font-mono">{money(r.taxable)}</td><td className="text-right font-mono">{money(r.igst)}</td><td className="text-right font-mono">{money(r.cgst)}</td><td className="text-right font-mono">{money(r.sgst)}</td></tr>)}</tbody></table>
        </SectionCard>
    );

    return (
        <div className="space-y-6">
            <PageHeader title="GST & TDS" subtitle="GSTR-1 outward supplies, GST payable (output − input credit), TDS receivable from clients and TDS payable by section" />
            <Tabs tabs={[{ id: "gst", label: "GST (GSTR-1 / 3B)" }, { id: "tds", label: "TDS" }]} value={tab} onChange={setTab} />
            {tab === "gst" && <>
                <div className="flex items-center gap-2"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 rounded-xl border border-neutral-200 text-sm" /><a href={`/api/finance/reports?export=gstr1&month=${month}`} className={`${btn.ghost} inline-flex items-center gap-1`}><Download size={13} /> GSTR-1 CSV</a></div>
                {g && <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Taxable value" value={money(g.summary.taxable)} icon={Scale} tone="primary" />
                        <StatCard label="Output tax" value={money(g.summary.outputTax)} icon={Scale} tone="blue" hint={`IGST ${money(g.summary.igst)} · CGST ${money(g.summary.cgst)} · SGST ${money(g.summary.sgst)}`} />
                        <StatCard label="Input tax credit" value={money(g.summary.inputTax)} icon={Scale} tone="emerald" hint="Vendor bills + paid expenses" />
                        <StatCard label="Net GST payable (3B)" value={money(g.summary.netPayable)} icon={Scale} tone="amber" hint={`GSTR-1 due ${g.summary.dueDate}`} />
                    </div>
                    {g.b2b.length + g.b2c.length + g.exports.length + g.cdnr.length === 0 && <SectionCard><EmptyState icon={Scale} message="No outward supplies this month." /></SectionCard>}
                    {table("B2B invoices", g.b2b)}{table("B2C invoices", g.b2c)}{table("Exports (zero-rated)", g.exports)}{table("Credit notes (CDNR)", g.cdnr)}
                </>}
            </>}
            {tab === "tds" && <>
                <div className="flex items-center gap-2"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 rounded-xl border border-neutral-200 text-sm" /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 rounded-xl border border-neutral-200 text-sm" /><span className="text-xs text-neutral-400">default: current FY</span></div>
                {t && <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="TDS receivable (26AS)" value={money(t.totalReceivable)} icon={Scale} tone="emerald" hint="Deducted by clients" />
                        <StatCard label="TDS payable" value={money(t.totalPayable)} icon={Scale} tone="amber" hint="Deposit by 7th of next month" />
                        {Object.entries(t.bySection).slice(0, 2).map(([k, v]) => <StatCard key={k} label={`Section ${k}`} value={money(v)} icon={Scale} tone="blue" />)}
                    </div>
                    <SectionCard title="TDS receivable by client" subtitle="Reconcile with Form 26AS and collect Form 16A">
                        {t.receivable.length === 0 ? <EmptyState icon={Scale} message="No TDS deducted by clients in this period." /> : <ul className="divide-y divide-neutral-100 text-sm">{t.receivable.map((r) => <li key={r.clientName} className="py-2 flex justify-between"><span>{r.clientName} <span className="text-xs text-neutral-400">{r.receipts} receipt(s)</span></span><span className="font-mono">{money(r.tds)}</span></li>)}</ul>}
                    </SectionCard>
                    <SectionCard title="TDS deducted by us (payable)">
                        {t.payable.length === 0 ? <EmptyState icon={Scale} message="No TDS deducted in this period." /> : <table className="w-full text-sm"><thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Section</th><th>Deductee</th><th>PAN</th><th>Date</th><th className="text-right">Amount</th><th className="text-right">TDS</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">{t.payable.map((p, i) => <tr key={i}><td className="py-1.5 font-bold">{p.section}</td><td>{p.payee}</td><td className="font-mono text-xs">{p.pan || "—"}</td><td>{p.date}</td><td className="text-right font-mono">{money(p.amount)}</td><td className="text-right font-mono">{money(p.tds)}</td></tr>)}</tbody></table>}
                    </SectionCard>
                </>}
            </>}
        </div>
    );
}
