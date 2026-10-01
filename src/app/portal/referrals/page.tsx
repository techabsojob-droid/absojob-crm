"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Gift, Plus, Send, Trophy, TrendingUp, MessageSquare, Hourglass } from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { money } from "@/components/finance/kit";
import ReferralForm from "@/components/portal/ReferralForm";
import { api } from "@/lib/api";

interface Ref { id: string; status: string; createdAt: string; candidateName: string; candidateEmail: string; currentCompany: string | null; totalExperienceYears: number; jobTitle: string | null; clientName: string | null; stage: string | null; incentiveAmount: number; incentivePaid: boolean; messages: number; reviewNotes?: string | null }
interface Data { referrals: Ref[]; stats: { total: number; shortlisted: number; hired: number; earned: number; pending: number; conversion: number; potential: number } }

const FILTERS = ["ALL", "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "HIRED", "REJECTED"];

export default function PortalReferralsPage() {
    const { data, isLoading } = useQuery<Data>({ queryKey: ["portal-referrals"], queryFn: () => api("/api/portal/referrals"), refetchInterval: 30000 });
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("ALL");
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const s = data.stats;
    const list = data.referrals.filter((r) => filter === "ALL" || r.status === filter);

    return (
        <div className="space-y-6">
            <PageHeader title="My Referrals" subtitle="Track every candidate you referred — interviews, offers, joining and incentive"
                action={<button onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-1.5"><Plus size={14} /> Refer a candidate</button>} />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="Referred" value={s.total} icon={Send} tone="blue" />
                <StatCard label="Shortlisted+" value={s.shortlisted} icon={TrendingUp} tone="purple" />
                <StatCard label="Joined" value={s.hired} icon={Trophy} tone="emerald" hint={`${s.conversion}% conversion`} />
                <StatCard label="Pipeline potential" value={money(s.potential)} icon={Hourglass} tone="amber" hint="If shortlisted candidates join" />
                <StatCard label="Earned" value={money(s.earned)} icon={Gift} tone="primary" hint={`${money(s.pending)} pending`} href="/portal/incentives" />
            </div>
            <div className="flex flex-wrap gap-1.5">{FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${filter === f ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>{f.replace("_", " ")}{f !== "ALL" ? ` (${data.referrals.filter((r) => r.status === f).length})` : ""}</button>)}</div>
            <SectionCard>
                {list.length === 0 ? <EmptyState icon={Gift} message={data.referrals.length ? "No referrals in this state." : "You haven't referred anyone yet. Browse Open Jobs to get started."} action={<Link href="/portal/jobs" className="text-xs font-bold text-primary">Browse open jobs →</Link>} /> : (
                    <ul className="divide-y divide-neutral-100">
                        {list.map((r) => (
                            <li key={r.id}>
                                <Link href={`/portal/referrals/${r.id}`} className="py-3.5 flex items-center justify-between gap-4 text-sm hover:bg-neutral-50 -mx-2 px-2 rounded-xl">
                                    <div className="min-w-0">
                                        <p className="font-bold text-neutral-900">{r.candidateName}</p>
                                        <p className="text-xs text-neutral-500 truncate">{r.jobTitle ? `${r.jobTitle}${r.clientName ? ` · ${r.clientName}` : ""}` : "General referral"} · referred {r.createdAt.slice(0, 10)}</p>
                                        {r.status === "REJECTED" && r.reviewNotes && <p className="text-[11px] text-rose-600 truncate">{r.reviewNotes}</p>}
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {r.messages > 0 && <span className="text-[11px] text-neutral-400 flex items-center gap-1"><MessageSquare size={11} />{r.messages}</span>}
                                        {r.stage && r.status !== "REJECTED" && <span className="text-[11px] text-neutral-500 hidden sm:inline">{r.stage.replace(/_/g, " ").toLowerCase()}</span>}
                                        {r.status === "HIRED" && <span className="text-xs font-bold text-emerald-700">{money(r.incentiveAmount)}{r.incentivePaid ? " paid" : ""}</span>}
                                        <Badge value={r.status} />
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
            <ReferralForm open={open} onClose={() => setOpen(false)} />
        </div>
    );
}
