"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Award, Clock, IndianRupee } from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";

export default function PortalIncentivesPage() {
    const { data: ledger, isLoading } = useQuery({
        queryKey: ["incentives"],
        queryFn: async () => (await fetch("/api/portal/incentives")).json(),
        refetchInterval: 30000,
    });

    const entries = Array.isArray(ledger) ? ledger : [];
    const earned = entries.filter((e: any) => e.type === "CREDIT");
    const paidOut = entries.filter((e: any) => e.status === "PAID");
    const pending = entries.filter((e: any) => e.status !== "PAID");

    return (
        <div className="space-y-6">
            <PageHeader title="My Incentives" subtitle="Commission ledger — every rupee you've earned, tracked transparently" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Lifetime Earned" value={inr(earned.reduce((s: number, e: any) => s + e.amount, 0))} icon={IndianRupee} tone="primary" />
                <StatCard label="Paid Out" value={inr(paidOut.reduce((s: number, e: any) => s + e.amount, 0))} icon={Wallet} tone="emerald" />
                <StatCard label="Pending" value={inr(pending.reduce((s: number, e: any) => s + e.amount, 0))} icon={Clock} tone={pending.length ? "amber" : "blue"} hint={`${pending.length} credit(s)`} />
                <StatCard label="Credits" value={earned.length} icon={TrendingUp} tone="purple" />
            </div>

            {/* How it works */}
            <SectionCard title="How incentives work">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-neutral-600">
                    <div className="p-4 bg-primary/[0.04] border border-primary/10 rounded-xl">
                        <p className="font-extrabold text-neutral-900 mb-1 flex items-center gap-2"><Award size={14} className="text-primary" /> 1. Candidate joins</p>
                        Your referral clears notice period & completes 15 days.
                    </div>
                    <div className="p-4 bg-primary/[0.04] border border-primary/10 rounded-xl">
                        <p className="font-extrabold text-neutral-900 mb-1 flex items-center gap-2"><Award size={14} className="text-primary" /> 2. Credit posted</p>
                        Incentive (typically ₹10k–₹25k) credited to your ledger.
                    </div>
                    <div className="p-4 bg-primary/[0.04] border border-primary/10 rounded-xl">
                        <p className="font-extrabold text-neutral-900 mb-1 flex items-center gap-2"><Award size={14} className="text-primary" /> 3. Payout</p>
                        Finance processes payouts in the next monthly cycle.
                    </div>
                </div>
            </SectionCard>

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : entries.length === 0 ? (
                <SectionCard><EmptyState icon={Wallet} message="No incentive activity yet. Refer someone to get started!" /></SectionCard>
            ) : (
                <SectionCard title={`Ledger (${entries.length})`}>
                    <div className="divide-y divide-neutral-50 -mx-5 px-5">
                        {entries.map((e: any) => (
                            <div key={e.id} className="py-3.5 flex items-center justify-between gap-4 flex-wrap">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-neutral-900">{e.description}</p>
                                    <p className="text-[11px] text-neutral-400">{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{e.paidOn ? ` · paid ${new Date(e.paidOn).toLocaleDateString("en-IN")}` : ""}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-sm font-extrabold ${e.type === "CREDIT" ? "text-emerald-600" : "text-red-500"}`}>
                                        {e.type === "CREDIT" ? "+" : "−"}{inr(Math.abs(e.amount))}
                                    </span>
                                    <Badge value={e.status === "PAID" ? "PAID" : e.status === "APPROVED" ? "APPROVED" : "PENDING"} />
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
        </div>
    );
}
