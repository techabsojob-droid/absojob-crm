"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Handshake, ShieldCheck, ShieldAlert, Users, Trophy, FileText } from "lucide-react";
import { PageHeader, StatCard, SectionCard, Badge, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, inputCls, money, Tabs, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Stats { total: number; shortlisted: number; hired: number; rejected: number; conversion: number; earned: number; paid: number; pending: number; clawback: number; potential: number }
interface Partner { userId: string; name: string; email: string; phone: string; status: string; joinedAt: string; city: string; kycStatus: string; kycNote: string | null; pan: string | null; idProofUrl: string | null; specialization: string[]; experienceYears: number; sourcingChannels: string[]; agreementAcceptedAt: string | null; verifiedByName: string | null; verifiedAt: string | null; payee: { bankName: string | null; account: string | null; ifsc: string | null; upiId: string | null } | null; stats: Stats }

export default function PartnersPage() {
    const { data, isLoading } = useQuery<Partner[]>({ queryKey: ["ta-partners"], queryFn: () => api("/api/ta/partners") });
    const [tab, setTab] = useState<"kyc" | "all">("kyc");
    const [sel, setSel] = useState<Partner | null>(null);
    const [note, setNote] = useState("");
    const act = useAct<{ status: string; kycStatus: string }>("/api/ta/partners", "PATCH", ["ta-partners"], (r) => `Partner ${r.status.toLowerCase()} · KYC ${r.kycStatus.toLowerCase()}`);

    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const queue = data.filter((p) => p.kycStatus !== "VERIFIED" || p.status === "INVITED");
    const active = data.filter((p) => p.status === "ACTIVE");
    const list = tab === "kyc" ? queue : data;
    const run = (action: string) => sel && act.mutate({ userId: sel.userId, action, note }, { onSuccess: () => { setSel(null); setNote(""); } });

    return (
        <div className="space-y-6">
            <PageHeader title="Recruitment Partners" subtitle="External recruiters and agents — verify KYC, activate accounts and track who brings hires" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Active partners" value={active.length} icon={Users} tone="blue" />
                <StatCard label="KYC to review" value={queue.filter((p) => p.kycStatus === "PENDING").length} icon={ShieldAlert} tone={queue.length ? "amber" : "emerald"} />
                <StatCard label="Hires via partners" value={data.reduce((s, p) => s + p.stats.hired, 0)} icon={Trophy} tone="emerald" hint={`${data.reduce((s, p) => s + p.stats.total, 0)} referrals`} />
                <StatCard label="Partner incentives" value={money(data.reduce((s, p) => s + p.stats.earned, 0))} icon={Handshake} tone="purple" hint={`${money(data.reduce((s, p) => s + p.stats.pending, 0))} pending`} />
            </div>
            <Tabs tabs={[{ id: "kyc", label: `Verification queue (${queue.length})` }, { id: "all", label: `All partners (${data.length})` }]} value={tab} onChange={setTab} />
            <SectionCard>
                {list.length === 0 ? <EmptyState icon={ShieldCheck} message="Nothing to verify." /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-[11px] text-neutral-500 uppercase"><th className="py-2">Partner</th><th>Account</th><th>KYC</th><th className="text-right">Referrals</th><th className="text-right">Hired</th><th className="text-right">Conversion</th><th className="text-right">Earned</th><th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {list.map((p) => (
                                    <tr key={p.userId}>
                                        <td className="py-2.5"><p className="font-semibold">{p.name}</p><p className="text-[11px] text-neutral-400">{p.city} · {p.specialization.join(", ") || "—"}</p></td>
                                        <td><Badge value={p.status} /></td>
                                        <td><Badge value={p.kycStatus} />{p.kycNote && <p className="text-[11px] text-rose-600 max-w-[180px] truncate" title={p.kycNote}>{p.kycNote}</p>}</td>
                                        <td className="text-right font-mono">{p.stats.total}</td>
                                        <td className="text-right font-mono">{p.stats.hired}</td>
                                        <td className="text-right font-mono">{p.stats.conversion}%</td>
                                        <td className="text-right font-mono">{money(p.stats.earned)}</td>
                                        <td className="text-right"><button onClick={() => setSel(p)} className={btn.soft}>Review</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            {sel && (
                <ModalShell onClose={() => setSel(null)} title={sel.name} wide>
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            {[
                                ["Email", sel.email], ["Phone", sel.phone], ["City", sel.city], ["Experience", `${sel.experienceYears} yrs`],
                                ["Specialisation", sel.specialization.join(", ") || "—"], ["Sourcing channels", sel.sourcingChannels.join(", ") || "—"],
                                ["PAN", sel.pan ?? "Not provided"], ["Agreement accepted", sel.agreementAcceptedAt?.slice(0, 10) ?? "—"],
                                ["Payout", sel.payee ? [sel.payee.bankName, sel.payee.account, sel.payee.ifsc].filter(Boolean).join(" · ") || sel.payee.upiId || "—" : "Not set"], ["UPI", sel.payee?.upiId ?? "—"],
                                ["Verified", sel.verifiedAt ? `${sel.verifiedByName} · ${sel.verifiedAt.slice(0, 10)}` : "—"], ["Registered", sel.joinedAt.slice(0, 10)],
                            ].map(([k, v]) => <div key={k}><p className="text-neutral-400 font-bold">{k}</p><p className="font-semibold text-neutral-800 break-words">{v}</p></div>)}
                        </div>
                        {sel.idProofUrl ? <a href={sel.idProofUrl} target="_blank" rel="noopener" className={`${btn.ghost} inline-flex items-center gap-1`}><FileText size={12} /> View ID proof</a> : <p className="text-xs text-amber-700">No ID proof uploaded</p>}
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            {[["Referrals", sel.stats.total], ["Shortlisted", sel.stats.shortlisted], ["Hired", sel.stats.hired], ["Rejected", sel.stats.rejected]].map(([k, v]) => <div key={k} className="rounded-xl bg-neutral-50 p-2"><p className="text-lg font-extrabold">{v}</p><p className="text-neutral-500">{k}</p></div>)}
                        </div>
                        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to partner (required to reject or suspend)" className={inputCls} />
                        <div className="flex flex-wrap gap-2">
                            {sel.kycStatus !== "VERIFIED" && <button disabled={act.isPending} onClick={() => run("VERIFY")} className={btn.good}>Verify KYC{sel.status === "INVITED" ? " & activate" : ""}</button>}
                            {sel.kycStatus !== "REJECTED" && <button disabled={act.isPending || !note.trim()} onClick={() => run("REJECT")} className={btn.danger}>Reject KYC</button>}
                            {sel.status === "ACTIVE" && <button disabled={act.isPending || !note.trim()} onClick={() => run("SUSPEND")} className={btn.danger}>Suspend</button>}
                            {sel.status === "SUSPENDED" && <button disabled={act.isPending} onClick={() => run("REACTIVATE")} className={btn.primary}>Reactivate</button>}
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
