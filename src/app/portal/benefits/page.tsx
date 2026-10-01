"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HeartHandshake, Plus, Trash2 } from "lucide-react";
import { PageHeader, SectionCard, Badge, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, inputCls, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Dep { name: string; relation: string; dob?: string }
interface Benefit { id: string; title: string; category: string; provider: string; coverageAmount: string; description: string; allowsDependents: boolean; enrollment: { status: string; dependents: Dep[]; updatedAt: string } | null }
const RELATIONS = ["Spouse", "Child", "Father", "Mother", "Father-in-law", "Mother-in-law"];

export default function BenefitsPage() {
    const { data, isLoading } = useQuery<Benefit[]>({ queryKey: ["my-benefits"], queryFn: () => api("/api/portal/benefits") });
    const act = useAct<{ status: string }>("/api/portal/benefits", "POST", ["my-benefits"], (r) => r.status === "ENROLLED" ? "Enrolled — HR has been informed" : "Opted out");
    const [sel, setSel] = useState<Benefit | null>(null);
    const [deps, setDeps] = useState<Dep[]>([]);
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    return (
        <div className="space-y-6 max-w-4xl">
            <PageHeader title="My Benefits" subtitle="Insurance, wellness and allowances — enrol yourself and your dependents" />
            {data.length === 0 ? <SectionCard><EmptyState icon={HeartHandshake} message="No benefits are offered right now." /></SectionCard> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.map((b) => {
                        const enrolled = b.enrollment?.status === "ENROLLED";
                        return (
                            <SectionCard key={b.id} title={b.title} subtitle={`${b.provider} · ${b.coverageAmount}`} action={enrolled ? <Badge value="VERIFIED" label="Enrolled" /> : <Badge value={b.category} />}>
                                <p className="text-xs text-neutral-600">{b.description}</p>
                                {enrolled && b.enrollment!.dependents.length > 0 && <p className="text-[11px] text-neutral-500 mt-2">Covered: {b.enrollment!.dependents.map((d) => `${d.name} (${d.relation})`).join(", ")}</p>}
                                <div className="flex gap-2 mt-3">
                                    {!enrolled && <button onClick={() => { setSel(b); setDeps([]); }} className={btn.primary}>Enrol</button>}
                                    {enrolled && b.allowsDependents && <button onClick={() => { setSel(b); setDeps(b.enrollment!.dependents); }} className={btn.ghost}>Edit dependents</button>}
                                    {enrolled && <button disabled={act.isPending} onClick={() => { if (window.confirm(`Opt out of ${b.title}?`)) act.mutate({ benefitId: b.id, action: "opt_out" }); }} className={btn.danger}>Opt out</button>}
                                </div>
                            </SectionCard>
                        );
                    })}
                </div>
            )}
            <ModalShell open={!!sel} onClose={() => setSel(null)} title={sel ? `Enrol — ${sel.title}` : ""}>
                {sel && (
                    <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); act.mutate({ benefitId: sel.id, action: "enroll", dependents: deps }, { onSuccess: () => setSel(null) }); }}>
                        {sel.allowsDependents ? (
                            <>
                                <p className="text-xs text-neutral-500">Add family members to cover (up to 6).</p>
                                {deps.map((d, i) => (
                                    <div key={i} className="grid grid-cols-[1fr_120px_110px_28px] gap-2">
                                        <input required placeholder="Name" value={d.name} onChange={(e) => setDeps(deps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inputCls} />
                                        <select value={d.relation} onChange={(e) => setDeps(deps.map((x, j) => (j === i ? { ...x, relation: e.target.value } : x)))} className={inputCls} aria-label="Relation">{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select>
                                        <input type="date" value={d.dob ?? ""} onChange={(e) => setDeps(deps.map((x, j) => (j === i ? { ...x, dob: e.target.value } : x)))} className={inputCls} aria-label="Date of birth" />
                                        <button type="button" onClick={() => setDeps(deps.filter((_, j) => j !== i))} className="text-rose-600" aria-label="Remove"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                {deps.length < 6 && <button type="button" onClick={() => setDeps([...deps, { name: "", relation: "Spouse" }])} className={`${btn.ghost} flex items-center gap-1`}><Plus size={12} /> Add dependent</button>}
                            </>
                        ) : <p className="text-xs text-neutral-600">Confirm your enrolment in {sel.title}.</p>}
                        <button disabled={act.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Confirm enrolment</button>
                    </form>
                )}
            </ModalShell>
        </div>
    );
}
