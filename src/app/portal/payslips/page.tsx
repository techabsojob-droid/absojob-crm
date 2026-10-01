"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Wallet, FileText, Receipt, Landmark } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, StatCard } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { money, Tabs } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Payslip { id: string; month: string; basicSalary: number; hra: number; allowances: number; bonuses: number; overtime: number; deductions: number; tax: number; netSalary: number; status: string; paymentDate?: string | null; onHold?: boolean; pf?: number; lopDays?: number }
interface Salary { structure: { rows: { component: string; monthly: number; annual: number; group: string }[]; grossMonthly: number; grossAnnual: number; ctcAnnual: number } | null; revisions: { id: string; effectiveDate?: string; currentCtc: number; newCtc: number; status?: string }[] }

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export default function MyPayslipsPage() {
    const [tab, setTab] = useState<"slips" | "structure">("slips");
    const { data = [], isLoading } = useQuery<Payslip[]>({ queryKey: ["my-payslips"], queryFn: () => api("/api/portal/payslips") });
    const { data: sal } = useQuery<Salary>({ queryKey: ["my-salary"], queryFn: () => api("/api/portal/salary") });
    const fyStart = (() => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04`; })();
    const ytd = data.filter((p) => p.month >= fyStart);

    return (
        <div className="space-y-6 max-w-5xl">
            <PageHeader title="Payslips & Salary" subtitle="Monthly payslips appear once payroll is processed" action={<Link href="/portal/tax" className="px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-bold flex items-center gap-1.5"><Receipt size={14} /> Tax & Form 16</Link>} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Net pay (this FY)" value={money(ytd.reduce((t, p) => t + p.netSalary, 0))} icon={Wallet} tone="emerald" hint={`${ytd.length} month(s)`} />
                <StatCard label="TDS (this FY)" value={money(ytd.reduce((t, p) => t + p.tax, 0))} icon={Receipt} tone="blue" />
                <StatCard label="PF (this FY)" value={money(ytd.reduce((t, p) => t + (p.pf ?? 0), 0))} icon={Landmark} tone="purple" hint="Employee share" />
                <StatCard label="Annual CTC" value={sal?.structure ? money(sal.structure.ctcAnnual) : "—"} icon={FileText} tone="primary" />
            </div>
            <Tabs tabs={[{ id: "slips", label: `Payslips (${data.length})` }, { id: "structure", label: "Salary structure" }]} value={tab} onChange={setTab} />

            {tab === "slips" && (
                <SectionCard>
                    {isLoading ? <SkeletonPulse className="h-32 w-full" /> : data.length === 0 ? <EmptyState icon={Wallet} message="No payslips yet. They appear after payroll is processed." /> : (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-[11px] font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Month</th><th className="text-right">Gross</th><th className="text-right">Deductions</th><th className="text-right">Net pay</th><th>Status</th><th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {data.map((p) => (
                                    <tr key={p.id}>
                                        <td className="py-3 font-bold">{monthLabel(p.month)}{p.lopDays ? <span className="block text-[10px] text-rose-600 font-bold">{p.lopDays} day(s) LOP</span> : null}</td>
                                        <td className="text-right font-mono">{money(p.basicSalary + p.hra + p.allowances + p.bonuses + p.overtime)}</td>
                                        <td className="text-right font-mono text-rose-600">−{money(p.deductions + p.tax)}</td>
                                        <td className="text-right font-mono font-bold">{money(p.netSalary)}</td>
                                        <td>{p.onHold ? <Badge value="ON_HOLD" label="On hold" /> : <Badge value={p.status} />}{p.paymentDate && <span className="block text-[10px] text-neutral-400">paid {p.paymentDate.slice(0, 10)}</span>}</td>
                                        <td className="text-right"><Link href={`/portal/payslips/${p.id}`} className="text-xs font-bold text-primary">View / download</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </SectionCard>
            )}

            {tab === "structure" && (
                <SectionCard title="Salary structure" subtitle="Annual CTC includes employer PF and gratuity">
                    {!sal?.structure ? <EmptyState icon={FileText} message="Your salary structure has not been set up yet — contact HR." /> : (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-[11px] font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Component</th><th className="text-right">Monthly</th><th className="text-right">Annual</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {sal.structure.rows.map((r) => <tr key={r.component}><td className="py-2.5">{r.component} <span className="text-[10px] text-neutral-400">{r.group}</span></td><td className="text-right font-mono">{money(r.monthly)}</td><td className="text-right font-mono">{money(r.annual)}</td></tr>)}
                                <tr className="font-bold"><td className="py-2.5">Gross salary</td><td className="text-right font-mono">{money(sal.structure.grossMonthly)}</td><td className="text-right font-mono">{money(sal.structure.grossAnnual)}</td></tr>
                                <tr className="font-extrabold bg-emerald-50"><td className="py-2.5 px-1">Cost to company</td><td /><td className="text-right font-mono px-1">{money(sal.structure.ctcAnnual)}</td></tr>
                            </tbody>
                        </table>
                    )}
                    {!!sal?.revisions.length && <div className="mt-4"><p className="text-xs font-bold text-neutral-500 mb-1">Revision history</p>{sal.revisions.map((r) => <p key={r.id} className="text-xs">{r.effectiveDate ?? ""} · {money(r.currentCtc)} → <b>{money(r.newCtc)}</b> {r.status && <Badge value={r.status} />}</p>)}</div>}
                </SectionCard>
            )}
        </div>
    );
}
