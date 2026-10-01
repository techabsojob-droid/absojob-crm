"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Timer, Plus } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell, StatCard } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, inputCls, money, Tabs, useAct } from "@/components/finance/kit";

interface Asg { id: string; clientId: string; clientName: string; workerName: string; role: string; rateType: string; billRate: number; payRate: number; startDate: string; endDate?: string | null; status: string; marginPct: number; billedToDate: number }
interface Ts { id: string; assignmentId: string; month: string; units: number; status: string; billAmount: number; payAmount: number; invoiceId?: string | null; contractorPaid: boolean; approvedByName?: string | null; assignment: Asg | null }

export default function ContractsPage() {
    const [tab, setTab] = useState<"timesheets" | "assignments">("timesheets");
    const [asgOpen, setAsgOpen] = useState(false);
    const [tsOpen, setTsOpen] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);
    const [a, setA] = useState({ clientId: "", workerName: "", workerEmail: "", role: "", rateType: "DAILY", billRate: "", payRate: "", startDate: "" });
    const [t, setT] = useState({ assignmentId: "", month: "", units: "" });
    const { data } = useQuery<{ assignments: Asg[]; timesheets: Ts[] }>({ queryKey: ["finance-contracts"], queryFn: () => api("/api/finance/contracts") });
    const { data: clients = [] } = useQuery<{ id: string; companyName: string }[]>({ queryKey: ["finance-clients"], queryFn: () => api("/api/finance/clients") });
    const keys = ["finance-contracts", "finance-billing", "finance-dashboard"];
    const post = useAct("/api/finance/contracts", "POST", keys, "Saved");
    const patch = useAct("/api/finance/contracts", "PATCH", keys, "Updated");
    const asg = data?.assignments ?? [];
    const ts = data?.timesheets ?? [];
    const payable = ts.filter((x) => ["APPROVED", "INVOICED"].includes(x.status) && !x.contractorPaid);
    const active = asg.filter((x) => x.status === "ACTIVE");

    return (
        <div className="space-y-6">
            <PageHeader title="Contract Staffing" subtitle="Contractors placed at clients: bill rate vs pay rate, monthly timesheets → client invoice (Billing Queue) → contractor pay" action={<div className="flex gap-2"><button onClick={() => setTsOpen(true)} className={btn.ghost}>Log timesheet</button><button onClick={() => setAsgOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"><Plus size={15} /> New assignment</button></div>} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Active contractors" value={active.length} icon={Timer} tone="primary" />
                <StatCard label="Monthly run-rate (bill)" value={money(active.reduce((s, x) => s + (x.rateType === "MONTHLY" ? x.billRate : x.rateType === "DAILY" ? x.billRate * 21 : x.billRate * 168), 0))} icon={Timer} tone="blue" hint="Assuming 21 days / 168 hrs" />
                <StatCard label="Awaiting approval" value={ts.filter((x) => x.status === "SUBMITTED").length} icon={Timer} tone="amber" />
                <StatCard label="Contractor pay due" value={money(payable.reduce((s, x) => s + x.payAmount, 0))} icon={Timer} tone="purple" />
            </div>
            <Tabs tabs={[{ id: "timesheets", label: `Timesheets (${ts.length})` }, { id: "assignments", label: `Assignments (${asg.length})` }]} value={tab} onChange={setTab} />

            {tab === "timesheets" && (
                <SectionCard title="Timesheets" action={picked.length > 0 && <button onClick={() => { const reference = window.prompt("Payment reference for contractor payout"); if (reference !== null) patch.mutate({ action: "pay_contractors", ids: picked, reference }, { onSuccess: () => setPicked([]) }); }} className={btn.good}>Pay {picked.length} contractor(s)</button>}>
                    {ts.length === 0 ? <EmptyState icon={Timer} message="No timesheets." /> : (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th /><th className="py-2">Contractor · client</th><th>Month</th><th>Units</th><th className="text-right">Bill</th><th className="text-right">Pay</th><th className="text-right">Margin</th><th>Status</th><th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {ts.map((x) => (
                                    <tr key={x.id}>
                                        <td>{["APPROVED", "INVOICED"].includes(x.status) && !x.contractorPaid && <input type="checkbox" checked={picked.includes(x.id)} onChange={() => setPicked((p) => (p.includes(x.id) ? p.filter((i) => i !== x.id) : [...p, x.id]))} aria-label="Select for payout" />}</td>
                                        <td className="py-2.5"><span className="font-semibold">{x.assignment?.workerName}</span><span className="block text-[11px] text-neutral-500">{x.assignment?.role} · {x.assignment?.clientName}</span></td>
                                        <td>{x.month}</td>
                                        <td>{x.units} {x.assignment?.rateType === "HOURLY" ? "hrs" : x.assignment?.rateType === "DAILY" ? "days" : "mo"}</td>
                                        <td className="text-right font-mono">{money(x.billAmount)}</td>
                                        <td className="text-right font-mono">{money(x.payAmount)}</td>
                                        <td className="text-right font-mono">{money(x.billAmount - x.payAmount)}</td>
                                        <td><Badge value={x.status} />{x.contractorPaid && <span className="block text-[10px] text-emerald-700 font-bold">contractor paid</span>}</td>
                                        <td className="text-right whitespace-nowrap space-x-1">
                                            {x.status === "SUBMITTED" && <>
                                                <button onClick={() => { const by = window.prompt("Approved by (client manager name)", ""); patch.mutate({ id: x.id, action: "approve", approvedByName: by || undefined }); }} className={btn.good}>Approve</button>
                                                <button onClick={() => { const reason = window.prompt("Reason for rejecting"); if (reason) patch.mutate({ id: x.id, action: "reject", reason }); }} className={btn.danger}>Reject</button>
                                            </>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <p className="text-[11px] text-neutral-400 mt-2">Approved timesheets appear in the Billing Queue to invoice the client.</p>
                </SectionCard>
            )}
            {tab === "assignments" && (
                <SectionCard title="Assignments">
                    {asg.length === 0 ? <EmptyState icon={Timer} message="No contract assignments." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">
                            {asg.map((x) => (
                                <li key={x.id} className="py-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold">{x.workerName} · {x.role} @ {x.clientName}</p>
                                        <p className="text-[11px] text-neutral-500">Bill {money(x.billRate)} / pay {money(x.payRate)} per {x.rateType.toLowerCase().replace("ly", "").replace("dai", "day")} · margin {x.marginPct}% · {x.startDate} → {x.endDate ?? "ongoing"} · billed {money(x.billedToDate)}</p>
                                    </div>
                                    <div className="flex items-center gap-2"><Badge value={x.status} />{x.status === "ACTIVE" && <button onClick={() => { if (window.confirm(`End ${x.workerName}'s assignment today?`)) patch.mutate({ id: x.id, action: "end_assignment" }); }} className={btn.ghost}>End</button>}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            <ModalShell open={asgOpen} onClose={() => setAsgOpen(false)} title="New contract assignment">
                <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); post.mutate({ type: "assignment", ...a, billRate: Number(a.billRate), payRate: Number(a.payRate), startDate: a.startDate || undefined }, { onSuccess: () => setAsgOpen(false) }); }}>
                    <select required value={a.clientId} onChange={(e) => setA({ ...a, clientId: e.target.value })} className={`${inputCls} col-span-2`}><option value="">Client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>
                    <input required placeholder="Contractor name" value={a.workerName} onChange={(e) => setA({ ...a, workerName: e.target.value })} className={inputCls} />
                    <input placeholder="Contractor email" value={a.workerEmail} onChange={(e) => setA({ ...a, workerEmail: e.target.value })} className={inputCls} />
                    <input required placeholder="Role" value={a.role} onChange={(e) => setA({ ...a, role: e.target.value })} className={inputCls} />
                    <select value={a.rateType} onChange={(e) => setA({ ...a, rateType: e.target.value })} className={inputCls}><option value="DAILY">Per day</option><option value="HOURLY">Per hour</option><option value="MONTHLY">Per month</option></select>
                    <input required type="number" min="1" placeholder="Bill rate (client)" value={a.billRate} onChange={(e) => setA({ ...a, billRate: e.target.value })} className={inputCls} />
                    <input required type="number" min="1" placeholder="Pay rate (contractor)" value={a.payRate} onChange={(e) => setA({ ...a, payRate: e.target.value })} className={inputCls} />
                    <label className="text-xs font-bold text-neutral-500 col-span-2">Start date<input type="date" value={a.startDate} onChange={(e) => setA({ ...a, startDate: e.target.value })} className={inputCls} /></label>
                    <button disabled={post.isPending} className="col-span-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Create assignment</button>
                </form>
            </ModalShell>
            <ModalShell open={tsOpen} onClose={() => setTsOpen(false)} title="Log timesheet">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); post.mutate({ type: "timesheet", ...t, units: Number(t.units) }, { onSuccess: () => setTsOpen(false) }); }}>
                    <select required value={t.assignmentId} onChange={(e) => setT({ ...t, assignmentId: e.target.value })} className={inputCls}><option value="">Assignment</option>{active.map((x) => <option key={x.id} value={x.id}>{x.workerName} @ {x.clientName} ({x.rateType.toLowerCase()})</option>)}</select>
                    <input required type="month" value={t.month} onChange={(e) => setT({ ...t, month: e.target.value })} className={inputCls} />
                    <input required type="number" min="0.5" step="0.5" placeholder="Days / hours / months worked" value={t.units} onChange={(e) => setT({ ...t, units: e.target.value })} className={inputCls} />
                    <button disabled={post.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit timesheet</button>
                </form>
            </ModalShell>
        </div>
    );
}
