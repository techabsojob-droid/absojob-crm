"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, AlertTriangle, Receipt, Wallet, Banknote, CreditCard, TrendingUp, Landmark, Clock, ShieldCheck, Store, Timer } from "lucide-react";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { BilledCollectedChart, HorizontalBars } from "@/components/finance/Charts";
import { money } from "@/components/finance/kit";
import { api } from "@/lib/api";
import { MyWork } from "@/components/tasks/TaskWidgets";

interface Dash {
    kpis: Record<string, number>;
    bankBalances: { account: string; balance: number }[];
    aging: Record<string, number>;
    trend: { month: string; billed: number; collected: number }[];
    forecast: { overdue: number; weeks: { label: string; from: string; to: string; amount: number }[] };
    budget: { id: string; category: string; amount: number; actual: number; pct: number }[];
    topOutstanding: { clientName: string; outstanding: number }[];
    overdueInvoices: { id: string; invoiceNumber: string; clientName: string; balance: number; daysOverdue: number }[];
    toBill: { key: string; type: string; clientName: string; description: string; amount: number }[];
}

export default function FinanceDashboard() {
    const { data, isLoading } = useQuery<Dash>({ queryKey: ["finance-dashboard"], queryFn: () => api<Dash>("/api/finance/dashboard"), refetchInterval: 30000 });
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const k = data.kpis;

    return (
        <div className="space-y-6">
            <PageHeader title="Finance Overview" subtitle="Cash, receivables and payables across placements, contract staffing, payroll and expenses" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Cash in bank (books)" value={money(k.cash)} icon={Landmark} tone="primary" hint={data.bankBalances.map((b) => `${b.account.replace("Bank - ", "")}: ${money(b.balance)}`).join(" · ")} href="/finance/bank" />
                <StatCard label="Outstanding receivables" value={money(k.outstanding)} icon={IndianRupee} tone="blue" hint={`DSO ${k.dso} days`} href="/finance/invoices" />
                <StatCard label="Overdue" value={money(k.overdueAmount)} icon={AlertTriangle} tone={k.overdueCount ? "amber" : "emerald"} hint={`${k.overdueCount} invoice(s)`} href="/finance/invoices?status=OVERDUE" />
                <StatCard label="Collected this month" value={money(k.collectedThisMonth)} icon={TrendingUp} tone="emerald" hint={`Billed ${money(k.billedThisMonth)}`} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="To bill" value={money(k.toBillAmount)} icon={Receipt} tone={k.toBillCount ? "amber" : "blue"} hint={`${k.toBillCount} item(s) in billing queue`} href="/finance/billing" />
                <StatCard label="Awaiting approval" value={k.pendingApprovalCount} icon={ShieldCheck} tone={k.pendingApprovalCount ? "amber" : "blue"} hint="Invoices & vendor bills (maker-checker)" href="/finance/invoices?status=PENDING_APPROVAL" />
                <StatCard label="Vendor bills due" value={money(k.payablesDue)} icon={Store} tone={k.payablesOverdue ? "amber" : "blue"} hint={`${k.payablesOverdue} overdue`} href="/finance/vendors" />
                <StatCard label="Payroll to disburse" value={money(k.payrollAwaitingAmount)} icon={Banknote} tone={k.payrollAwaitingCount ? "amber" : "blue"} hint={`${k.payrollAwaitingCount} salaries · F&F ${money(k.fnfPending)}`} href="/finance/payroll" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Incentives due" value={money(k.incentivesDue)} icon={Wallet} tone="purple" hint="Referral + recruiter" href="/finance/payables" />
                <StatCard label="Contractors to pay" value={money(k.contractorsToPay)} icon={Timer} tone="purple" href="/finance/contracts" />
                <StatCard label="Expense claims" value={`${k.expensesPending} pending`} icon={CreditCard} tone="primary" hint={`${money(k.expensesToPay)} approved, unpaid`} href="/finance/expenses" />
                <StatCard label="GST output (issued)" value={money(k.gstOutput)} icon={Clock} tone="blue" href="/finance/tax" />
            </div>

            <MyWork limit={4} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard title="Billed vs collected" subtitle="Last 6 months" className="lg:col-span-2">
                    <BilledCollectedChart data={data.trend} />
                </SectionCard>
                <SectionCard title="Receivables aging" subtitle="Balance due by days overdue">
                    <HorizontalBars label="Balance due" data={Object.entries(data.aging).map(([name, value]) => ({ name: name === "CURRENT" ? "Not yet due" : `${name} days`, value }))} />
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard title="Collection forecast" subtitle="Open invoices by due week">
                    <ul className="text-sm divide-y divide-neutral-100">
                        <li className="py-2 flex justify-between text-rose-700"><span>Already overdue</span><span className="font-mono font-bold">{money(data.forecast.overdue)}</span></li>
                        {data.forecast.weeks.map((w) => <li key={w.label} className="py-2 flex justify-between"><span>{w.label} <span className="text-[11px] text-neutral-400">{w.from.slice(5)}–{w.to.slice(5)}</span></span><span className="font-mono">{money(w.amount)}</span></li>)}
                    </ul>
                </SectionCard>
                <SectionCard title="Overdue invoices" action={<Link href="/finance/invoices?status=OVERDUE" className="text-xs font-bold text-primary">View all</Link>}>
                    {data.overdueInvoices.length === 0 ? <EmptyState icon={AlertTriangle} message="Nothing overdue 🎉" /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">
                            {data.overdueInvoices.map((i) => (
                                <li key={i.id} className="py-2.5 flex justify-between gap-3">
                                    <Link href={`/finance/invoices?id=${i.id}`} className="hover:text-primary"><span className="font-semibold">{i.invoiceNumber}</span><span className="block text-[11px] text-neutral-500">{i.clientName}</span></Link>
                                    <span className="text-right"><span className="font-mono font-bold">{money(i.balance)}</span><span className="block text-[11px] text-rose-600">{i.daysOverdue}d overdue</span></span>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
                <SectionCard title="Budget this month" action={<Link href="/finance/reports" className="text-xs font-bold text-primary">Manage</Link>}>
                    {data.budget.length === 0 ? <EmptyState icon={TrendingUp} message="No budget set for this month." /> : (
                        <ul className="space-y-2.5 text-sm">
                            {data.budget.map((b) => (
                                <li key={b.id}>
                                    <div className="flex justify-between text-xs"><span className="font-semibold">{b.category.replace("_", " ")}</span><span className="font-mono">{money(b.actual)} / {money(b.amount)}</span></div>
                                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden mt-1"><div className={`h-full rounded-full ${b.category === "REVENUE" ? "bg-[#2a78d6]" : b.pct > 100 ? "bg-rose-500" : "bg-[#2a78d6]"}`} style={{ width: `${Math.min(100, b.pct)}%` }} /></div>
                                    <span className={`text-[11px] ${b.category !== "REVENUE" && b.pct > 100 ? "text-rose-600 font-bold" : "text-neutral-400"}`}>{b.pct}%{b.category !== "REVENUE" && b.pct > 100 ? " — over budget" : ""}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title="Ready to bill" action={<Link href="/finance/billing" className="text-xs font-bold text-primary">Billing queue</Link>}>
                    {data.toBill.length === 0 ? <EmptyState icon={Receipt} message="Nothing waiting to be billed." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">
                            {data.toBill.map((p) => (
                                <li key={p.key} className="py-2.5 flex justify-between gap-3">
                                    <span className="min-w-0"><span className="font-semibold">{p.clientName}</span><span className="block text-[11px] text-neutral-500 truncate">{p.description}</span></span>
                                    <span className="font-mono font-bold shrink-0">{money(p.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
                <SectionCard title="Largest outstanding clients" action={<Link href="/finance/clients" className="text-xs font-bold text-primary">Client billing</Link>}>
                    {data.topOutstanding.length === 0 ? <EmptyState icon={Landmark} message="No outstanding balances." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">
                            {data.topOutstanding.map((c) => <li key={c.clientName} className="py-2.5 flex justify-between"><span className="font-semibold">{c.clientName}</span><span className="font-mono font-bold">{money(c.outstanding)}</span></li>)}
                        </ul>
                    )}
                </SectionCard>
            </div>
        </div>
    );
}
