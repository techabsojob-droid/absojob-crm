"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingUp, Clock, HandCoins, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";

export default function FinancePage() {
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["finance"],
        queryFn: async () => (await fetch("/api/admin/finance")).json(),
        refetchInterval: 30000,
    });

    const patchMutation = useMutation({
        mutationFn: async ({ id, action }: { id: string; action: string }) => {
            const res = await fetch("/api/admin/finance", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.action === "approve" ? "Entry approved." : "Marked as paid.");
            qc.invalidateQueries({ queryKey: ["finance"] });
        },
        onError: () => toast.error("Action failed"),
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-56 bg-neutral-200/60 rounded-xl animate-pulse" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-neutral-100" />)}</div>
            </div>
        );
    }

    const s = data.summary;

    return (
        <div className="space-y-6">
            <PageHeader title="Finance & Payouts" subtitle="Placement billing, receivables and referral incentive payouts" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Collected" value={inr(s.totalCollected)} icon={TrendingUp} tone="emerald" hint="placement commissions" />
                <StatCard label="Receivables" value={inr(s.totalReceivable)} icon={Clock} tone="amber" hint="pending from clients" />
                <StatCard label="Incentives Paid" value={inr(s.incentivesPaid)} icon={HandCoins} tone="primary" hint="to agents" />
                <StatCard label="Incentives Pending" value={inr(s.incentivesPending)} icon={Wallet} tone="blue" hint="approved, awaiting payout" />
            </div>

            {/* Ledger */}
            <SectionCard title="Commission Ledger" subtitle="Every billing entry, credit note & incentive">
                {data.ledger.length === 0 ? (
                    <EmptyState icon={FileText} message="No ledger entries yet." />
                ) : (
                    <div className="overflow-x-auto -m-5">
                        <table className="w-full text-sm min-w-[820px]">
                            <thead>
                                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                                    <th className="px-5 py-3">Description</th>
                                    <th className="px-3 py-3">Type</th>
                                    <th className="px-3 py-3">Party</th>
                                    <th className="px-3 py-3">Amount</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {data.ledger.map((l: any) => (
                                    <tr key={l.id} className="hover:bg-neutral-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <p className="font-semibold text-neutral-800">{l.description}</p>
                                            <p className="text-xs text-neutral-400">{l.invoiceNumber ?? "—"}{l.dueDate ? ` · due ${new Date(l.dueDate).toLocaleDateString("en-IN")}` : ""}</p>
                                        </td>
                                        <td className="px-3 py-3.5"><span className="text-xs font-semibold text-neutral-600">{l.type.replaceAll("_", " ")}</span></td>
                                        <td className="px-3 py-3.5 text-neutral-600 font-medium">{l.clientName ?? l.userName ?? "—"}</td>
                                        <td className={`px-3 py-3.5 font-extrabold ${l.amountInr < 0 ? "text-red-500" : "text-neutral-900"}`}>{inr(l.amountInr)}</td>
                                        <td className="px-3 py-3.5"><Badge value={l.status === "APPROVED" && l.type !== "REFERRAL_INCENTIVE" ? "APPROVED_LEDGER" : l.status} label={l.status} /></td>
                                        <td className="px-3 py-3.5 text-right space-x-2 whitespace-nowrap">
                                            {["PENDING", "APPROVED"].includes(l.status) && (
                                                <>
                                                    {l.status === "PENDING" && (
                                                        <button onClick={() => patchMutation.mutate({ id: l.id, action: "approve" })} disabled={patchMutation.isPending}
                                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40">Approve</button>
                                                    )}
                                                    <button onClick={() => patchMutation.mutate({ id: l.id, action: "mark_paid" })} disabled={patchMutation.isPending}
                                                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40">Mark Paid</button>
                                                </>
                                            )}
                                            {l.status === "PAID" && <span className="text-xs text-neutral-300">settled</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            {/* Agent payouts */}
            <SectionCard title="Agent Payouts" subtitle="Referral incentive disbursement history">
                <div className="space-y-2.5">
                    {data.payouts.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-100 flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-primary/10 text-primary rounded-full font-bold text-xs flex items-center justify-center">
                                    {p.userName.split(" ").map((n: string) => n[0]).join("")}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-neutral-900">{p.userName}</p>
                                    <p className="text-[11px] text-neutral-400">{p.periodLabel} · {p.method.replaceAll("_", " ")}{p.reference ? ` · ${p.reference}` : ""}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-extrabold text-neutral-900">{inr(p.amountInr)}</span>
                                <Badge value={p.status} />
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
}
