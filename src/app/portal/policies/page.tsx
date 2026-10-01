"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, FileText } from "lucide-react";
import { PageHeader, SectionCard, Badge, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Policy { id: string; title: string; category: string; version: string; effectiveDate: string; summary: string; acknowledged: boolean; acknowledgedAt: string | null; documentUrl: string | null }

export default function PoliciesPage() {
    const { data, isLoading } = useQuery<{ policies: Policy[]; pending: number }>({ queryKey: ["my-policies"], queryFn: () => api("/api/portal/policies") });
    const ack = useAct("/api/portal/policies", "POST", ["my-policies", "portal-dashboard"], "Acknowledged — thank you");
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    return (
        <div className="space-y-6 max-w-4xl">
            <PageHeader title="Company Policies" subtitle={data.pending ? `${data.pending} polic${data.pending > 1 ? "ies need" : "y needs"} your acknowledgement` : "You are up to date with every policy"} />
            {data.policies.length === 0 ? <SectionCard><EmptyState icon={BookOpen} message="No policies published yet." /></SectionCard> : data.policies.map((p) => (
                <SectionCard key={p.id} title={p.title} subtitle={`${p.category.replace(/_/g, " ").toLowerCase()} · ${p.version} · effective ${p.effectiveDate}`}
                    action={p.acknowledged ? <span className="text-xs font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 size={14} /> Acknowledged</span> : <Badge value="PENDING" label="Action needed" />}>
                    <p className="text-sm text-neutral-700 whitespace-pre-line">{p.summary}</p>
                    <div className="flex items-center gap-3 mt-4">
                        {p.documentUrl && <a href={p.documentUrl} target="_blank" rel="noopener" className={`${btn.ghost} flex items-center gap-1`}><FileText size={12} /> Full document</a>}
                        {p.acknowledged ? <span className="text-[11px] text-neutral-400">on {p.acknowledgedAt?.slice(0, 10)}</span> : <button disabled={ack.isPending} onClick={() => ack.mutate({ policyId: p.id })} className={btn.primary}>I have read and agree</button>}
                    </div>
                </SectionCard>
            ))}
        </div>
    );
}
