"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Download, FileSpreadsheet } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, inputCls, money, Tabs, useAct } from "@/components/finance/kit";

interface Cycle { month: string; employees: number; gross: number; statutory: number; tax: number; net: number; employerCost: number; draft: number; processed: number; onHold: number; paid: number; paidOn: string | null; missingBank: string[] }
interface Rec { id: string; employeeName: string; employeeCode: string; department: string; netSalary: number; status: string; pf?: number; esi?: number; pt?: number; tax: number; onHold?: boolean; holdReason?: string | null; lopDays?: number }
interface Fnf { id: string; employeeName: string; amount: number; status: string; paidAt?: string | null; reference?: string | null; createdAt: string }
interface Stat { month: string; pf: { employee: number; employer: number; total: number; dueDate: string }; esi: { employee: number; employer: number; total: number; dueDate: string }; pt: { total: number; dueDate: string }; tds: { total: number; dueDate: string }; lines: { employeeCode: string; employeeName: string; gross: number; pf: number; esi: number; pt: number; tds: number; net: number }[] }
interface F16 { fy: string; employer: { name: string; pan: string; tan: string }; employee: { name: string; code: string; pan: string; designation: string }; regime: string; months: { month: string; gross: number; tds: number }[]; grossSalary: number; standardDeduction: number; professionalTax: number; taxableIncome: number; tdsDeducted: number }

export default function FinancePayrollPage() {
    const [tab, setTab] = useState<"cycles" | "statutory" | "fnf" | "form16">("cycles");
    const [month, setMonth] = useState<string | null>(null);
    const [statMonth, setStatMonth] = useState(new Date().toISOString().slice(0, 7));
    const [f16, setF16] = useState({ employeeId: "", fy: "" });
    const { data } = useQuery<{ cycles: Cycle[]; records: Rec[]; fnf: Fnf[]; employees: { id: string; name: string; code: string }[] }>({ queryKey: ["finance-payroll", month], queryFn: () => api(`/api/finance/payroll${month ? `?month=${month}` : ""}`) });
    const { data: stat } = useQuery<Stat>({ queryKey: ["finance-statutory", statMonth], queryFn: () => api(`/api/finance/payroll?view=statutory&month=${statMonth}`), enabled: tab === "statutory" });
    const { data: form16 } = useQuery<F16>({ queryKey: ["form16", f16.employeeId, f16.fy], queryFn: () => api(`/api/finance/payroll?view=form16&employeeId=${f16.employeeId}&fy=${f16.fy}`), enabled: !!f16.employeeId && /^\d{4}-\d{2}$/.test(f16.fy) });
    const keys = ["finance-payroll", "finance-dashboard"];
    const act = useAct<{ paid?: number; total?: number; held?: number }>("/api/finance/payroll", "PATCH", keys, (r) => r.paid !== undefined ? `${r.paid} salaries disbursed (${money(r.total)})${r.held ? `, ${r.held} on hold` : ""}` : "Updated");

    return (
        <div className="space-y-6">
            <PageHeader title="Payroll Disbursement" subtitle="HR generates & locks payroll (PF, ESI, PT, TDS computed); Finance releases salaries, files the bank upload and pays statutory dues" />
            <Tabs tabs={[{ id: "cycles", label: "Cycles" }, { id: "statutory", label: "PF / ESI / PT / TDS" }, { id: "fnf", label: `Full & Final (${data?.fnf.filter((f) => f.status === "PENDING").length ?? 0})` }, { id: "form16", label: "Form 16" }]} value={tab} onChange={setTab} />

            {tab === "cycles" && <>
                <SectionCard title="Payroll cycles">
                    {!data?.cycles.length ? <EmptyState icon={Banknote} message="No payroll generated yet." /> : (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Month</th><th>Staff</th><th className="text-right">Gross</th><th className="text-right">PF/ESI/PT</th><th className="text-right">TDS</th><th className="text-right">Net</th><th>State</th><th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {data.cycles.map((c) => (
                                    <tr key={c.month} className={month === c.month ? "bg-primary/5" : ""}>
                                        <td className="py-3 font-bold"><button onClick={() => setMonth(month === c.month ? null : c.month)} className="hover:text-primary underline decoration-dotted">{c.month}</button></td>
                                        <td>{c.employees}</td>
                                        <td className="text-right font-mono">{money(c.gross)}</td>
                                        <td className="text-right font-mono text-red-600">−{money(c.statutory)}</td>
                                        <td className="text-right font-mono text-red-600">−{money(c.tax)}</td>
                                        <td className="text-right font-mono font-bold">{money(c.net)}</td>
                                        <td className="space-x-1 text-[11px]">
                                            {c.draft > 0 && <Badge value="DRAFT" label={`${c.draft} with HR`} />}
                                            {c.processed > 0 && <Badge value="PROCESSED" label={`${c.processed} ready`} />}
                                            {c.onHold > 0 && <Badge value="ON_HOLD" label={`${c.onHold} held`} />}
                                            {c.paid > 0 && <Badge value="PAID" label={`${c.paid} paid`} />}
                                            {c.missingBank.length > 0 && <span className="block text-amber-700 font-bold">No bank details: {c.missingBank.join(", ")}</span>}
                                        </td>
                                        <td className="text-right whitespace-nowrap space-x-1">
                                            <a href={`/api/finance/payroll?export=bank&month=${c.month}`} className={`${btn.ghost} inline-flex items-center gap-1`} title="NEFT/RTGS bulk upload file"><Download size={12} /> Bank file</a>
                                            <a href={`/api/finance/payroll?export=register&month=${c.month}`} className={`${btn.ghost} inline-flex items-center gap-1`}><FileSpreadsheet size={12} /> Register</a>
                                            {c.processed > 0 && <button disabled={act.isPending} onClick={() => { if (window.confirm(`Disburse ${c.processed} salaries for ${c.month}?`)) act.mutate({ month: c.month }); }} className={btn.good}>Disburse</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </SectionCard>
                {month && (
                    <SectionCard title={`Salaries — ${month}`}>
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Employee</th><th className="text-right">PF</th><th className="text-right">ESI</th><th className="text-right">PT</th><th className="text-right">TDS</th><th className="text-right">Net</th><th>Status</th><th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {(data?.records ?? []).map((r) => (
                                    <tr key={r.id}>
                                        <td className="py-2">{r.employeeName} <span className="text-neutral-400 text-xs">{r.employeeCode}{r.lopDays ? ` · LOP ${r.lopDays}d` : ""}</span>{r.holdReason && <span className="block text-[11px] text-amber-700">Held: {r.holdReason}</span>}</td>
                                        <td className="text-right font-mono">{money(r.pf)}</td><td className="text-right font-mono">{money(r.esi)}</td><td className="text-right font-mono">{money(r.pt)}</td><td className="text-right font-mono">{money(r.tax)}</td>
                                        <td className="text-right font-mono font-bold">{money(r.netSalary)}</td>
                                        <td><Badge value={r.onHold && r.status !== "PAID" ? "ON_HOLD" : r.status} /></td>
                                        <td className="text-right">{r.status !== "PAID" && (r.onHold ? <button onClick={() => act.mutate({ id: r.id, action: "release" })} className={btn.ghost}>Release</button> : <button onClick={() => { const reason = window.prompt("Why hold this salary?"); if (reason) act.mutate({ id: r.id, action: "hold", reason }); }} className={btn.ghost}>Hold</button>)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </SectionCard>
                )}
            </>}

            {tab === "statutory" && (
                <SectionCard title="Statutory liabilities" action={<input type="month" value={statMonth} onChange={(e) => setStatMonth(e.target.value)} className="px-2 py-1 rounded-lg border border-neutral-200 text-xs" />}>
                    {!stat ? null : stat.lines.length === 0 ? <EmptyState icon={Banknote} message="No processed payroll for this month." /> : <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                            {[["PF (EPFO ECR)", stat.pf.total, stat.pf.dueDate, `emp ${money(stat.pf.employee)} + er ${money(stat.pf.employer)}`], ["ESIC", stat.esi.total, stat.esi.dueDate, `emp ${money(stat.esi.employee)} + er ${money(stat.esi.employer)}`], ["Professional tax", stat.pt.total, stat.pt.dueDate, ""], ["TDS 192 (salary)", stat.tds.total, stat.tds.dueDate, "Challan 281"]].map(([l, v, d, h]) => (
                                <div key={String(l)} className="p-3 rounded-xl border border-neutral-200"><p className="text-[11px] font-bold uppercase text-neutral-400">{l}</p><p className="text-lg font-extrabold font-mono">{money(Number(v))}</p><p className="text-[11px] text-neutral-500">due {d}{h ? ` · ${h}` : ""}</p></div>
                            ))}
                        </div>
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Employee</th><th className="text-right">Gross</th><th className="text-right">PF</th><th className="text-right">ESI</th><th className="text-right">PT</th><th className="text-right">TDS</th><th className="text-right">Net</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">{stat.lines.map((l) => <tr key={l.employeeCode}><td className="py-2">{l.employeeName} <span className="text-xs text-neutral-400">{l.employeeCode}</span></td><td className="text-right font-mono">{money(l.gross)}</td><td className="text-right font-mono">{money(l.pf)}</td><td className="text-right font-mono">{money(l.esi)}</td><td className="text-right font-mono">{money(l.pt)}</td><td className="text-right font-mono">{money(l.tds)}</td><td className="text-right font-mono font-bold">{money(l.net)}</td></tr>)}</tbody>
                        </table>
                    </>}
                </SectionCard>
            )}

            {tab === "fnf" && (
                <SectionCard title="Full & final settlements" subtitle="HR finalises the amount at exit; Finance releases it, then HR can complete the exit">
                    {!data?.fnf.length ? <EmptyState icon={Banknote} message="No F&F settlements." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">{data.fnf.map((f) => <li key={f.id} className="py-3 flex items-center justify-between"><span><b>{f.employeeName}</b> <span className="text-[11px] text-neutral-500">queued {f.createdAt.slice(0, 10)}{f.reference ? ` · ref ${f.reference}` : ""}</span></span><span className="flex items-center gap-2"><span className="font-mono">{money(f.amount)}</span><Badge value={f.status} />{f.status === "PENDING" && <button onClick={() => { const reference = window.prompt("Payment reference"); if (reference !== null) act.mutate({ action: "pay_fnf", id: f.id, reference }); }} className={btn.good}>Pay</button>}</span></li>)}</ul>
                    )}
                </SectionCard>
            )}

            {tab === "form16" && (
                <SectionCard title="Form 16 (Part B summary)">
                    <div className="flex gap-2 mb-4">
                        <select value={f16.employeeId} onChange={(e) => setF16({ ...f16, employeeId: e.target.value })} className={inputCls}><option value="">Employee</option>{data?.employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.code}</option>)}</select>
                        <input placeholder="FY e.g. 2026-27" value={f16.fy} onChange={(e) => setF16({ ...f16, fy: e.target.value })} className={`${inputCls} w-40`} />
                    </div>
                    {form16 && (
                        <div className="text-sm space-y-3">
                            <p><b>{form16.employer.name}</b> · PAN {form16.employer.pan} · TAN {form16.employer.tan}</p>
                            <p>Employee: <b>{form16.employee.name}</b> ({form16.employee.code}) · PAN {form16.employee.pan} · {form16.employee.designation} · regime {form16.regime}</p>
                            <table className="w-72"><tbody>
                                <tr><td>Gross salary</td><td className="text-right font-mono">{money(form16.grossSalary)}</td></tr>
                                <tr><td>Standard deduction</td><td className="text-right font-mono">−{money(form16.standardDeduction)}</td></tr>
                                <tr><td>Professional tax</td><td className="text-right font-mono">{money(form16.professionalTax)}</td></tr>
                                <tr className="font-bold"><td>Taxable income</td><td className="text-right font-mono">{money(form16.taxableIncome)}</td></tr>
                                <tr className="font-bold"><td>TDS deducted</td><td className="text-right font-mono">{money(form16.tdsDeducted)}</td></tr>
                            </tbody></table>
                            <p className="text-[11px] text-neutral-500">{form16.months.length} month(s) paid in FY {form16.fy}. Part A is downloaded from TRACES.</p>
                            <button onClick={() => window.print()} className={btn.ghost}>Print</button>
                        </div>
                    )}
                </SectionCard>
            )}
        </div>
    );
}
