"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, TrendingDown, Landmark, Percent, Clock } from "lucide-react";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { HorizontalBars } from "@/components/finance/Charts";
import { btn, downloadText, money, toCsv, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Report {
    range: { from: string; to: string };
    pnl: { income: { account: string; amount: number }[]; expense: { account: string; amount: number }[]; totalIncome: number; totalExpense: number; netProfit: number };
    byClient: { clientName: string; revenue: number; invoices: number }[];
    byStream: Record<string, number>;
    recruiters: { recruiterId: string; name: string; revenue: number; placements: number; salaryCost: number; contribution: number; roi: number | null }[];
    expenseByCategory: Record<string, number>;
    cashflow: { month: string; inflow: number; outflow: number; net: number; bySource: Record<string, number> }[];
    dso: number;
}
interface BudgetRow { id: string; category: string; amount: number; actual: number; variance: number; pct: number }

export default function FinanceReportsPage() {
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [bMonth, setBMonth] = useState(new Date().toISOString().slice(0, 7));
    const { data, isLoading } = useQuery<Report>({ queryKey: ["finance-reports", from, to], queryFn: () => api(`/api/finance/reports?from=${from}&to=${to}`) });
    const { data: budget } = useQuery<{ rows: BudgetRow[] }>({ queryKey: ["finance-budget", bMonth], queryFn: () => api(`/api/finance/budgets?month=${bMonth}`) });
    const setBudget = useAct("/api/finance/budgets", "POST", ["finance-budget", "finance-dashboard"], "Budget saved");
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const p = data.pnl;
    const margin = p.totalIncome ? Math.round((p.netProfit / p.totalIncome) * 1000) / 10 : 0;

    return (
        <div className="space-y-6">
            <PageHeader title="Reports & Budget" subtitle={`${data.range.from} → ${data.range.to} (default: current financial year) · from the general ledger`}
                action={<div className="flex items-center gap-2 text-xs">
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border border-neutral-200" />
                    <span>to</span>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-neutral-200" />
                    <button onClick={() => downloadText(toCsv([["Section", "Account", "Amount"], ...p.income.map((r) => ["Income", r.account, r.amount]), ...p.expense.map((r) => ["Expense", r.account, r.amount]), ["", "Net profit", p.netProfit]]), `pnl-${data.range.from}-${data.range.to}.csv`)} className={`${btn.ghost} inline-flex items-center gap-1`}><Download size={13} /> P&L CSV</button>
                </div>} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Income" value={money(p.totalIncome)} icon={TrendingUp} tone="primary" />
                <StatCard label="Expenses" value={money(p.totalExpense)} icon={TrendingDown} tone="amber" />
                <StatCard label="Net profit" value={money(p.netProfit)} icon={Landmark} tone={p.netProfit >= 0 ? "emerald" : "amber"} hint={`${margin}% margin`} />
                <StatCard label="DSO" value={`${data.dso} days`} icon={Clock} tone="blue" hint="Days sales outstanding (90-day)" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <SectionCard title="Revenue by stream">
                    {Object.keys(data.byStream).length === 0 ? <EmptyState icon={TrendingUp} message="No revenue in range." /> : <HorizontalBars label="Revenue" data={Object.entries(data.byStream).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)} />}
                </SectionCard>
                <SectionCard title="Revenue by client" action={<button onClick={() => downloadText(toCsv([["Client", "Revenue", "Invoices"], ...data.byClient.map((c) => [c.clientName, c.revenue, c.invoices])]), "revenue-by-client.csv")} className="text-xs font-bold text-primary">CSV</button>}>
                    {data.byClient.length === 0 ? <EmptyState icon={TrendingUp} message="No revenue in range." /> : <HorizontalBars label="Revenue" data={data.byClient.slice(0, 8).map((c) => ({ name: c.clientName, value: c.revenue }))} />}
                </SectionCard>
            </div>

            <SectionCard title="Recruiter profitability" subtitle="Placement revenue invoiced vs recruiter salary cost (incl. employer PF/ESI) in range">
                {data.recruiters.length === 0 ? <EmptyState icon={Percent} message="No placement invoices in range." /> : (
                    <table className="w-full text-sm"><thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Recruiter</th><th>Placements</th><th className="text-right">Revenue</th><th className="text-right">Salary cost</th><th className="text-right">Contribution</th><th className="text-right">ROI</th></tr></thead>
                        <tbody className="divide-y divide-neutral-100">{data.recruiters.map((r) => <tr key={r.recruiterId}><td className="py-2 font-semibold">{r.name}</td><td>{r.placements}</td><td className="text-right font-mono">{money(r.revenue)}</td><td className="text-right font-mono">{money(r.salaryCost)}</td><td className={`text-right font-mono font-bold ${r.contribution < 0 ? "text-red-600" : ""}`}>{money(r.contribution)}</td><td className="text-right">{r.roi !== null ? `${r.roi}×` : "—"}</td></tr>)}</tbody></table>
                )}
            </SectionCard>

            <SectionCard title="Cash flow" subtitle="Money in and out of bank accounts by month">
                {data.cashflow.length === 0 ? <EmptyState icon={Landmark} message="No bank movements in range." /> : (
                    <table className="w-full text-sm"><thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Month</th><th className="text-right">Inflow</th><th className="text-right">Outflow</th><th className="text-right">Net</th><th>Biggest movements</th></tr></thead>
                        <tbody className="divide-y divide-neutral-100">{data.cashflow.map((c) => <tr key={c.month}><td className="py-2 font-semibold">{c.month}</td><td className="text-right font-mono text-emerald-700">{money(c.inflow)}</td><td className="text-right font-mono text-red-600">{money(c.outflow)}</td><td className={`text-right font-mono font-bold ${c.net < 0 ? "text-red-600" : ""}`}>{money(c.net)}</td><td className="text-[11px] text-neutral-500">{Object.entries(c.bySource).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).map(([k, v]) => `${k.replace("_", " ").toLowerCase()} ${money(v)}`).join(" · ")}</td></tr>)}</tbody></table>
                )}
            </SectionCard>

            <SectionCard title="Budget vs actual" action={<input type="month" value={bMonth} onChange={(e) => setBMonth(e.target.value)} className="px-2 py-1 rounded-lg border border-neutral-200 text-xs" />}>
                <table className="w-full text-sm"><thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Category</th><th className="text-right">Budget</th><th className="text-right">Actual</th><th className="text-right">Variance</th><th /></tr></thead>
                    <tbody className="divide-y divide-neutral-100">
                        {(budget?.rows ?? []).map((b) => <tr key={b.id}><td className="py-2">{b.category.replace("_", " ")}</td><td className="text-right font-mono">{money(b.amount)}</td><td className="text-right font-mono">{money(b.actual)}</td><td className={`text-right font-mono ${b.category !== "REVENUE" && b.variance > 0 ? "text-red-600 font-bold" : b.category === "REVENUE" && b.variance < 0 ? "text-amber-700" : "text-emerald-700"}`}>{b.variance > 0 ? "+" : ""}{money(b.variance)}</td><td className="text-right"><button onClick={() => { const v = window.prompt(`Budget for ${b.category} in ${bMonth}`, String(b.amount)); if (v !== null) setBudget.mutate({ month: bMonth, category: b.category, amount: Number(v) }); }} className={btn.ghost}>Edit</button></td></tr>)}
                    </tbody></table>
                <button onClick={() => { const category = window.prompt("Category (REVENUE, TRAVEL, MARKETING, JOB_BOARDS, SOFTWARE, OFFICE, RENT, MEALS, TRAINING, UTILITIES, OTHER)")?.toUpperCase().trim(); if (!category) return; const amount = window.prompt("Budget amount (₹)"); if (amount) setBudget.mutate({ month: bMonth, category, amount: Number(amount) }); }} className="mt-3 text-xs font-bold text-primary">+ Add budget line</button>
            </SectionCard>
        </div>
    );
}
