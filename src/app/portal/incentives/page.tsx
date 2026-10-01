"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Clock, IndianRupee, Hourglass, Receipt, AlertTriangle, Download, Undo2 } from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { money } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Entry { id: string; description: string; type: "CREDIT" | "DEBIT"; kind: string; tdsAmount: number; amount: number; status: string; date: string; paidOn: string | null }
interface Data {
    entries: Entry[];
    summary: { earned: number; paid: number; pending: number; tds: number; clawback: number; netPaid: number; potential: number; hired: number; shortlisted: number };
    tiers: { label: string; amount: number }[];
    payoutReady: boolean;
    blockers: string[];
    tdsNote: string;
}

export default function PortalIncentivesPage() {
    const { data, isLoading } = useQuery<Data>({ queryKey: ["portal-incentives"], queryFn: () => api("/api/portal/incentives?summary=1"), refetchInterval: 30000 });
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const s = data.summary;

    return (
        <div className="space-y-6">
            <PageHeader title="My Earnings" subtitle="Every incentive, TDS deduction, clawback and payout — tracked transparently"
                action={<a href="/api/portal/incentives?format=csv" className="px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-bold text-xs flex items-center gap-1.5 hover:bg-neutral-50"><Download size={14} /> Statement (CSV)</a>} />

            {!data.payoutReady && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
                    <AlertTriangle size={18} className="shrink-0" />
                    <div><p className="font-bold">Payouts on hold</p><ul className="list-disc ml-4 text-xs mt-1">{data.blockers.map((b) => <li key={b}>{b}</li>)}</ul><Link href="/portal/profile?tab=payouts" className="text-xs font-bold underline mt-1 inline-block">Update payout details →</Link></div>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard label="Total earned" value={money(s.earned)} icon={IndianRupee} tone="primary" hint={`${s.hired} joining(s)`} />
                <StatCard label="Paid (gross)" value={money(s.paid)} icon={Wallet} tone="emerald" />
                <StatCard label="TDS deducted" value={money(s.tds)} icon={Receipt} tone="blue" hint="Sec 194H — claim in your ITR" />
                <StatCard label="Net received" value={money(s.netPaid)} icon={Wallet} tone="emerald" />
                <StatCard label="Pending" value={money(s.pending)} icon={Clock} tone={s.pending ? "amber" : "blue"} />
                <StatCard label="Clawbacks" value={money(s.clawback)} icon={Undo2} tone={s.clawback ? "amber" : "blue"} hint="Recovered from next payout" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard title="Ledger" className="lg:col-span-2">
                    {data.entries.length === 0 ? <EmptyState icon={Wallet} message="No incentives yet — they are booked when your referred candidate joins." /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-[11px] text-neutral-500 uppercase"><th className="py-2">Date</th><th>Description</th><th className="text-right">Amount</th><th className="text-right">TDS</th><th>Status</th></tr></thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {data.entries.map((e) => (
                                        <tr key={e.id}>
                                            <td className="py-2.5 text-xs text-neutral-500 whitespace-nowrap">{e.date.slice(0, 10)}</td>
                                            <td className="text-xs">{e.description}{e.paidOn && <span className="block text-neutral-400">paid {e.paidOn.slice(0, 10)}</span>}</td>
                                            <td className={`text-right font-mono font-bold ${e.type === "DEBIT" ? "text-rose-600" : ""}`}>{e.type === "DEBIT" ? "−" : ""}{money(e.amount)}</td>
                                            <td className="text-right font-mono text-xs">{e.tdsAmount ? money(e.tdsAmount) : "—"}</td>
                                            <td><Badge value={e.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
                <div className="space-y-6">
                    <SectionCard title="Pipeline potential" subtitle="If your shortlisted candidates join">
                        <p className="text-3xl font-extrabold text-[#2a78d6] flex items-center gap-2"><Hourglass size={22} />{money(s.potential)}</p>
                        <p className="text-xs text-neutral-500 mt-1">{s.shortlisted} candidate(s) in interviews or offer stage</p>
                    </SectionCard>
                    <SectionCard title="Commission structure" subtitle="Per successful joining, by offered CTC">
                        <ul className="divide-y divide-neutral-100 text-sm">{data.tiers.map((t) => <li key={t.label} className="py-2 flex justify-between"><span className="text-neutral-600">{t.label}</span><span className="font-bold">{money(t.amount)}</span></li>)}</ul>
                        <p className="text-[11px] text-neutral-400 mt-3">Paid within 30 days of joining after KYC verification. {data.tdsNote} If the candidate leaves within the client&apos;s guarantee period the incentive is recovered from your next payout.</p>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
