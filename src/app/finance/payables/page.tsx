"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, History, UserCog } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, StatCard, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, inputCls, money, Tabs, useAct } from "@/components/finance/kit";

interface Inc { id: string; type: string; userId: string; amount: number; tdsPreview: number; status: string; description: string; payeeName: string; payeeRole: string | null; candidateName: string | null; createdAt: string; paidAt?: string | null; tdsAmount?: number; hasBankDetails: boolean; pendingClawback: number }
interface Payee { userId: string; name: string; role?: string; pan?: string | null; bankName?: string | null; bankAccountNumber?: string | null; bankIfsc?: string | null; upiId?: string | null }
interface Data { tdsPct: number; incentives: Inc[]; payouts: { id: string; payeeName: string; amountInr: number; periodLabel: string; status: string; method: string; reference?: string | null }[]; payees: Payee[] }

export default function PayablesPage() {
    const { data } = useQuery<Data>({ queryKey: ["finance-payables"], queryFn: () => api("/api/finance/payables") });
    const [tab, setTab] = useState<"open" | "clawbacks" | "history" | "payees">("open");
    const [picked, setPicked] = useState<string[]>([]);
    const [payee, setPayee] = useState<Payee | null>(null);
    const keys = ["finance-payables", "finance-dashboard"];
    const act = useAct<{ net?: number; tds?: number; recovered?: number }>("/api/finance/payables", "PATCH", keys, (r) => r.net !== undefined ? `Paid ${money(r.net)} net (TDS ${money(r.tds)}${r.recovered ? `, clawback ${money(r.recovered)}` : ""})` : "Updated");
    const saveProfile = useAct("/api/finance/payables", "PUT", keys, "Payee profile saved");
    const inc = data?.incentives ?? [];
    const open = inc.filter((i) => i.type !== "CLAWBACK" && ["PENDING", "APPROVED"].includes(i.status));
    const claw = inc.filter((i) => i.type === "CLAWBACK");
    const pickedRows = open.filter((i) => picked.includes(i.id));
    const gross = pickedRows.reduce((s, i) => s + i.amount, 0);

    return (
        <div className="space-y-6">
            <PageHeader title="Incentives & Payouts" subtitle={`Referral incentives (on joining) and recruiter incentives (on collection). ${data?.tdsPct ?? 2}% TDS u/s 194H is deducted and pending clawbacks are recovered automatically.`} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Awaiting approval" value={money(open.filter((i) => i.status === "PENDING").reduce((s, i) => s + i.amount, 0))} icon={Wallet} tone="amber" />
                <StatCard label="Approved, unpaid" value={money(open.filter((i) => i.status === "APPROVED").reduce((s, i) => s + i.amount, 0))} icon={Wallet} tone="blue" />
                <StatCard label="Clawbacks to recover" value={money(claw.filter((c) => c.status === "PENDING").reduce((s, c) => s + c.amount, 0))} icon={Wallet} tone="purple" />
                <StatCard label="Paid (all time)" value={money(inc.filter((i) => i.status === "PAID" && i.type !== "CLAWBACK").reduce((s, i) => s + i.amount, 0))} icon={Wallet} tone="emerald" />
            </div>
            <Tabs tabs={[{ id: "open", label: `Open (${open.length})` }, { id: "clawbacks", label: `Clawbacks (${claw.length})` }, { id: "history", label: "Payout history" }, { id: "payees", label: "Payee bank & PAN" }]} value={tab} onChange={setTab} />

            {tab === "open" && (
                <SectionCard title="Open incentives" action={picked.length > 0 && (
                    <button onClick={() => { const reference = window.prompt(`Pay ${picked.length} item(s): gross ${money(gross)}, TDS ≈ ${money(Math.round(gross * (data!.tdsPct / 100)))}. Payment reference (UTR/UPI):`); if (reference !== null) act.mutate({ action: "pay", ids: picked, method: "BANK_TRANSFER", reference }, { onSuccess: () => setPicked([]) }); }} className={btn.good}>Pay selected ({money(gross)})</button>
                )}>
                    {open.length === 0 ? <EmptyState icon={Wallet} message="No incentives waiting." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">
                            {open.map((i) => (
                                <li key={i.id} className="py-3 flex items-center gap-3">
                                    <input type="checkbox" checked={picked.includes(i.id)} onChange={() => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))} aria-label="Select for payout" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold">{i.payeeName} · <span className="font-mono">{money(i.amount)}</span> <span className="text-[11px] font-normal text-neutral-500">TDS {money(i.tdsPreview)} · net {money(i.amount - i.tdsPreview - Math.min(i.pendingClawback, i.amount - i.tdsPreview))}</span></p>
                                        <p className="text-[11px] text-neutral-500"><Badge value={i.type} label={i.type === "RECRUITER_INCENTIVE" ? "Recruiter" : "Referral"} /> {i.description}{!i.hasBankDetails && <span className="text-amber-700 font-bold"> · no bank details</span>}{i.pendingClawback > 0 && <span className="text-rose-700 font-bold"> · clawback {money(i.pendingClawback)} will be recovered</span>}</p>
                                    </div>
                                    <Badge value={i.status} />
                                    {i.status === "PENDING" && <button onClick={() => act.mutate({ action: "approve", ids: [i.id] })} className={btn.soft}>Approve</button>}
                                    <button onClick={() => { const reason = window.prompt("Why cancel this incentive?"); if (reason) act.mutate({ action: "cancel", ids: [i.id], reason }); }} className={btn.ghost}>Cancel</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}
            {tab === "clawbacks" && (
                <SectionCard title="Clawbacks" subtitle="Created when a placement falls through inside the client guarantee; recovered from the payee's next payout">
                    {claw.length === 0 ? <EmptyState icon={Wallet} message="No clawbacks." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">{claw.map((c) => <li key={c.id} className="py-2.5 flex justify-between gap-3"><span><b>{c.payeeName}</b> · {c.description}</span><span className="flex items-center gap-2 font-mono">{money(c.amount)} <Badge value={c.status === "PAID" ? "PAID" : "PENDING"} label={c.status === "PAID" ? "Recovered" : "To recover"} /></span></li>)}</ul>
                    )}
                </SectionCard>
            )}
            {tab === "history" && (
                <SectionCard title="Payout history">
                    {!data?.payouts.length ? <EmptyState icon={History} message="No payouts yet." /> : (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Payee</th><th>Period</th><th>Method</th><th>Reference</th><th className="text-right">Net paid</th><th>Status</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">{data.payouts.map((p) => <tr key={p.id}><td className="py-2.5 font-semibold">{p.payeeName}</td><td>{p.periodLabel}</td><td>{p.method.replace("_", " ")}</td><td className="text-neutral-500">{p.reference ?? "—"}</td><td className="text-right font-mono">{money(p.amountInr)}</td><td><Badge value={p.status} /></td></tr>)}</tbody>
                        </table>
                    )}
                </SectionCard>
            )}
            {tab === "payees" && (
                <SectionCard title="Payees">
                    {!data?.payees.length ? <EmptyState icon={UserCog} message="No payees yet." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">{data.payees.map((p) => <li key={p.userId} className="py-2.5 flex items-center justify-between"><span><b>{p.name}</b> <span className="text-[11px] text-neutral-500">{p.role?.replace("_", " ")} · PAN {p.pan || "—"} · {p.bankAccountNumber ? `${p.bankName} ${p.bankAccountNumber.slice(-4).padStart(8, "•")}` : p.upiId || "no bank/UPI"}</span></span><button onClick={() => setPayee(p)} className={btn.ghost}>Edit</button></li>)}</ul>
                    )}
                </SectionCard>
            )}

            <ModalShell open={!!payee} onClose={() => setPayee(null)} title={payee ? `${payee.name} — payout details` : ""}>
                {payee && (
                    <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); saveProfile.mutate({ userId: payee.userId, ...Object.fromEntries(f.entries()) }, { onSuccess: () => setPayee(null) }); }}>
                        <input name="pan" defaultValue={payee.pan ?? ""} placeholder="PAN" className={inputCls} />
                        <input name="upiId" defaultValue={payee.upiId ?? ""} placeholder="UPI ID" className={inputCls} />
                        <input name="bankName" defaultValue={payee.bankName ?? ""} placeholder="Bank" className={inputCls} />
                        <input name="bankAccountNumber" defaultValue={payee.bankAccountNumber ?? ""} placeholder="Account number" className={inputCls} />
                        <input name="bankIfsc" defaultValue={payee.bankIfsc ?? ""} placeholder="IFSC" className={inputCls} />
                        <p className="col-span-2 text-[11px] text-neutral-400">Without a PAN, TDS u/s 206AA applies at 20% — collect it before paying.</p>
                        <button disabled={saveProfile.isPending} className="col-span-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save</button>
                    </form>
                )}
            </ModalShell>
        </div>
    );
}
