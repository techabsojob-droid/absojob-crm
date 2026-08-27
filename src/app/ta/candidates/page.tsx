"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, Plus, Star, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function TaCandidatesPage() {
    const qc = useQueryClient();
    const [q, setQ] = useState("");
    const [addToPipelineOpen, setAddToPipelineOpen] = useState(false);
    const [selected, setSelected] = useState<any>(null);
    const [form, setForm] = useState({ jobId: "", screeningNotes: "" });

    const { data: candidates, isLoading } = useQuery({
        queryKey: ["ta-candidates", q],
        queryFn: async () => {
            const res = await fetch(`/api/admin/candidates?q=${encodeURIComponent(q)}`);
            return res.json();
        },
    });

    const { data: jobs } = useQuery({
        queryKey: ["ta-jobs-active"],
        queryFn: async () => (await fetch("/api/admin/jobs?status=SOURCING")).json().catch(() => null),
    });

    const addToPipeline = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/ta/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ candidateId: selected.id, jobId: form.jobId, screeningNotes: form.screeningNotes }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Candidate pushed to pipeline (stage: SOURCED).");
            setAddToPipelineOpen(false);
            setSelected(null);
            setForm({ jobId: "", screeningNotes: "" });
            qc.invalidateQueries({ queryKey: ["pipeline"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const list = Array.isArray(candidates) ? candidates.filter((c: any) => !c.blacklisted) : [];

    return (
        <div className="space-y-6">
            <PageHeader title="Candidate Search" subtitle="Search the shared database & push profiles into requisition pipelines" />

            <div className="relative max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, skill, company…"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white" />
            </div>

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : list.length === 0 ? (
                <SectionCard><EmptyState icon={Users} message="No candidates found." /></SectionCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {list.map((c: any) => (
                        <div key={c.id} className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs hover:shadow-md transition-shadow space-y-2.5">
                            <div className="flex items-start justify-between">
                                <div className="min-w-0">
                                    <h3 className="font-bold text-neutral-900 text-sm truncate">{c.name}</h3>
                                    <p className="text-[11px] text-neutral-400">{c.currentCompany ?? "—"} · {c.totalExperienceYears} yrs</p>
                                </div>
                                <span className="text-amber-400 text-xs shrink-0">{"★".repeat(c.rating)}</span>
                            </div>

                            <div className="flex flex-wrap gap-1">
                                {c.skills.slice(0, 4).map((s: string) => (
                                    <span key={s} className="px-1.5 py-0.5 bg-primary/5 text-primary rounded text-[9px] font-bold">{s}</span>
                                ))}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-50">
                                <span>₹{c.currentCtcLpa}L → <strong className="text-neutral-700">₹{c.expectedCtcLpa}L</strong></span>
                                <span>Notice {c.noticePeriodDays}d</span>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                                {c.currentStage ? (
                                    <div className="space-y-1 min-w-0">
                                        <Badge value={c.currentStage} />
                                        <p className="text-[9px] text-neutral-400 truncate">{c.jobTitle}</p>
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-neutral-400">Not in pipeline</span>
                                )}
                                {!c.currentStage && (
                                    <button
                                        onClick={() => { setSelected(c); setAddToPipelineOpen(true); }}
                                        disabled={!Array.isArray(jobs) || jobs.length === 0}
                                        className="px-3 py-1.5 bg-primary text-white rounded-lg text-[11px] font-bold hover:bg-primary-dark transition-colors flex items-center gap-1 shadow-sm disabled:opacity-40"
                                    >
                                        <Plus size={12} /> Pipeline
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Push-to-pipeline modal */}
            <ModalShell open={addToPipelineOpen && selected} onClose={() => { setAddToPipelineOpen(false); setSelected(null); }} title={`Add ${selected?.name ?? ""} to Pipeline`}>
                <form onSubmit={(e) => { e.preventDefault(); addToPipeline.mutate(); }} className="space-y-4">
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Requisition *</span>
                        <select required value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white">
                            <option value="">Select requisition…</option>
                            {(Array.isArray(jobs) ? jobs : []).map((j: any) => (
                                <option key={j.id} value={j.id}>{j.title} — {j.clientName}</option>
                            ))}
                        </select></label>
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Screening Notes</span>
                        <textarea rows={3} value={form.screeningNotes} onChange={(e) => setForm({ ...form, screeningNotes: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none resize-none"
                            placeholder="Initial screening observations…" /></label>
                    <button disabled={addToPipeline.isPending}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25 flex items-center justify-center gap-2">
                        <Briefcase size={15} /> {addToPipeline.isPending ? "Adding..." : "Push to Pipeline"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
