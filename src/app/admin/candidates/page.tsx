"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, Star, Building2, Briefcase, Ban } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function AdminCandidatesPage() {
    const qc = useQueryClient();
    const [q, setQ] = useState("");
    const [stageFilter, setStageFilter] = useState("ALL");
    const [addOpen, setAddOpen] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", phone: "", currentCompany: "", skills: "", totalExperienceYears: "", expectedCtcLpa: "" });

    const { data: candidates, isLoading } = useQuery({
        queryKey: ["admin-candidates", q],
        queryFn: async () => {
            const res = await fetch(`/api/admin/candidates?q=${encodeURIComponent(q)}`);
            return res.json();
        },
        refetchInterval: 30000,
    });

    const blacklistMutation = useMutation({
        mutationFn: async ({ id, blacklisted }: { id: string; blacklisted: boolean }) => {
            const res = await fetch("/api/admin/candidates", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, blacklisted, blacklistReason: "Manual blacklist by admin" }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.blacklisted ? "Candidate blacklisted." : "Candidate restored.");
            qc.invalidateQueries({ queryKey: ["admin-candidates"] });
        },
        onError: () => toast.error("Action failed"),
    });

    const addMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/candidates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Candidate added to database.");
            setAddOpen(false);
            setForm({ name: "", email: "", phone: "", currentCompany: "", skills: "", totalExperienceYears: "", expectedCtcLpa: "" });
            qc.invalidateQueries({ queryKey: ["admin-candidates"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const list = Array.isArray(candidates) ? candidates : [];
    const filtered = stageFilter === "ALL" ? list
        : stageFilter === "NONE" ? list.filter((c: any) => !c.currentStage)
        : list.filter((c: any) => c.currentStage === stageFilter);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Candidate Database"
                subtitle="Every candidate ever sourced — pipeline status, sources & ratings"
                action={
                    <button onClick={() => setAddOpen(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2">
                        <Users size={16} /> Add Candidate
                    </button>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Candidates" value={list.length} icon={Users} tone="primary" />
                <StatCard label="In Pipeline" value={list.filter((c: any) => c.currentStage && !["REJECTED", "BACKED_OUT"].includes(c.currentStage)).length} icon={Briefcase} tone="blue" />
                <StatCard label="Agent Referrals" value={list.filter((c: any) => c.source === "AGENT_REFERRAL").length} icon={Star} tone="emerald" hint={`${list.filter((c: any) => c.source === "LINKEDIN").length} via LinkedIn`} />
                <StatCard label="Blacklisted" value={list.filter((c: any) => c.blacklisted).length} icon={Ban} tone="red" />
            </div>

            {/* Search + filters */}
            <div className="flex gap-3 flex-wrap items-center">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, skill, company…"
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white" />
                </div>
                <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 bg-white outline-none focus:border-primary">
                    <option value="ALL">All stages</option>
                    {["SOURCED", "SCREENING", "INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT", "JOINED", "REJECTED"].map((s) => (
                        <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
                    ))}
                    <option value="NONE">Not in pipeline</option>
                </select>
            </div>

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : filtered.length === 0 ? (
                <SectionCard><EmptyState icon={Users} message="No candidates match your filters." /></SectionCard>
            ) : (
                <SectionCard>
                    <div className="overflow-x-auto -m-5">
                        <table className="w-full text-sm min-w-[820px]">
                            <thead>
                                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                                    <th className="px-5 py-3">Candidate</th>
                                    <th className="px-3 py-3">Experience</th>
                                    <th className="px-3 py-3">CTC (cur → exp)</th>
                                    <th className="px-3 py-3">Current Stage</th>
                                    <th className="px-3 py-3">Source</th>
                                    <th className="px-3 py-3">Rating</th>
                                    <th className="px-3 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {filtered.map((c: any) => (
                                    <tr key={c.id} className="hover:bg-neutral-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <p className="font-bold text-neutral-900 flex items-center gap-1.5">{c.name}
                                                {c.blacklisted && <Badge value="BLACKLISTED" label="Blacklisted" />}</p>
                                            <p className="text-xs text-neutral-400">{c.currentCompany ?? "—"} · {c.skills.slice(0, 3).join(", ")}</p>
                                        </td>
                                        <td className="px-3 py-3.5 text-neutral-600 font-medium">{c.totalExperienceYears} yrs</td>
                                        <td className="px-3 py-3.5 text-neutral-600 font-medium">{c.currentCtcLpa} → <span className="text-primary font-bold">{c.expectedCtcLpa} LPA</span></td>
                                        <td className="px-3 py-3.5 space-y-1">
                                            {c.currentStage ? <Badge value={c.currentStage} /> : <span className="text-xs text-neutral-400">Not in pipeline</span>}
                                            {c.jobTitle && <p className="text-[10px] text-neutral-400">{c.jobTitle}{c.clientName ? ` · ${c.clientName}` : ""}</p>}
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <Badge value={c.source} label={c.source === "AGENT_REFERRAL" && c.referredByName ? `Ref: ${c.referredByName}` : c.source.replaceAll("_", " ")} />
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="text-amber-500 text-xs tracking-tight">{"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}</span>
                                        </td>
                                        <td className="px-3 py-3.5 text-right">
                                            {!c.blacklisted && (
                                                <button onClick={() => blacklistMutation.mutate({ id: c.id, blacklisted: true })}
                                                    className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors">
                                                    Blacklist
                                                </button>
                                            )}
                                            {c.blacklisted && (
                                                <button onClick={() => blacklistMutation.mutate({ id: c.id, blacklisted: false })}
                                                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 hover:bg-emerald-50 rounded-lg transition-colors">
                                                    Restore
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Add candidate modal */}
            <ModalShell open={addOpen} onClose={() => setAddOpen(false)} title="Add Candidate to Database" wide>
                <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name *</span>
                            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email *</span>
                            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Phone</span>
                            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Company</span>
                            <input value={form.currentCompany} onChange={(e) => setForm({ ...form, currentCompany: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Experience (yrs)</span>
                            <input type="number" value={form.totalExperienceYears} onChange={(e) => setForm({ ...form, totalExperienceYears: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Expected CTC (LPA)</span>
                            <input type="number" value={form.expectedCtcLpa} onChange={(e) => setForm({ ...form, expectedCtcLpa: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                    </div>
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Skills</span>
                        <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, Node.js, SQL" className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                    <button disabled={addMutation.isPending} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25">
                        {addMutation.isPending ? "Adding..." : "Add Candidate"}
                    </button>
                </form>
            </ModalShell>

            <p className="text-[11px] text-neutral-400 flex items-center gap-1"><Building2 size={11} /> Duplicate detection & blacklist enforcement active on referrals.</p>
        </div>
    );
}
