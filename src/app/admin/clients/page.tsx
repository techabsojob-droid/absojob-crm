"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Globe, Mail, Phone, Briefcase, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function ClientsPage() {
    const qc = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [form, setForm] = useState({ companyName: "", industry: "", website: "", contactPerson: "", contactEmail: "", contactPhone: "", commissionRate: "8.33", creditDays: "30" });

    const { data: clients, isLoading } = useQuery({
        queryKey: ["clients"],
        queryFn: async () => (await fetch("/api/admin/clients")).json(),
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Client onboarded — agreement flow started.");
            setModalOpen(false);
            setForm({ companyName: "", industry: "", website: "", contactPerson: "", contactEmail: "", contactPhone: "", commissionRate: "8.33", creditDays: "30" });
            qc.invalidateQueries({ queryKey: ["clients"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const filtered = Array.isArray(clients) ? (statusFilter === "ALL" ? clients : clients.filter((c: any) => c.status === statusFilter)) : [];
    const counts = ["ACTIVE", "ONBOARDING", "PROSPECT", "PAUSED"];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Clients"
                subtitle="Companies whose positions we fill — accounts, terms & performance"
                action={
                    <button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2">
                        <Plus size={16} /> Onboard Client
                    </button>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Active" value={filtered.filter((c: any) => c.status === "ACTIVE").length} icon={Building2} tone="emerald" />
                <StatCard label="Onboarding" value={clients?.filter?.((c: any) => c.status === "ONBOARDING").length ?? 0} icon={UserCheck} tone="amber" />
                <StatCard label="Prospects" value={clients?.filter?.((c: any) => c.status === "PROSPECT").length ?? 0} icon={Globe} tone="blue" />
                <StatCard label="Paused / Churned" value={clients?.filter?.((c: any) => ["PAUSED", "CHURNED"].includes(c.status)).length ?? 0} icon={Briefcase} tone="red" />
            </div>

            {/* Filter chips */}
            <div className="flex gap-2">
                {["ALL", ...counts].map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${statusFilter === s ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white border border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}
                    >
                        {s.replaceAll("_", " ")}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 bg-white rounded-2xl animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
                <SectionCard><EmptyState icon={Building2} message="No clients in this view." /></SectionCard>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filtered.map((c: any) => (
                        <div key={c.id} className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:shadow-md transition-shadow space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-11 h-11 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black shrink-0">
                                        {c.companyName.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-neutral-900 truncate">{c.companyName}</h3>
                                        <p className="text-xs text-neutral-400">{c.industry}</p>
                                    </div>
                                </div>
                                <Badge value={c.status} />
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center py-2 bg-neutral-50 rounded-xl border border-neutral-100">
                                <div><p className="text-lg font-extrabold text-neutral-900">{c.openJobs}</p><p className="text-[9px] font-bold text-neutral-400 uppercase">Open Jobs</p></div>
                                <div className="border-x border-neutral-200"><p className="text-lg font-extrabold text-neutral-900">{c.placements}</p><p className="text-[9px] font-bold text-neutral-400 uppercase">Placements</p></div>
                                <div><p className="text-lg font-extrabold text-neutral-900">{c.commissionRate}%</p><p className="text-[9px] font-bold text-neutral-400 uppercase">Commission</p></div>
                            </div>

                            <div className="space-y-1.5 text-xs text-neutral-500">
                                <p className="flex items-center gap-2"><UserCheck size={13} className="text-neutral-400" /> AM: <span className="font-semibold text-neutral-700">{c.accountManagerName}</span></p>
                                <p className="flex items-center gap-2"><Mail size={13} className="text-neutral-400" /> {c.contactPerson} · {c.contactEmail}</p>
                                <p className="flex items-center gap-2"><Phone size={13} className="text-neutral-400" /> {c.contactPhone}</p>
                            </div>

                            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                                <span>Payment terms: <strong className="text-neutral-600">{c.creditDays} days</strong></span>
                                <span>Est. value: <strong className="text-neutral-600">{c.estimatedValue}</strong></span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Onboard modal */}
            <ModalShell open={modalOpen} onClose={() => setModalOpen(false)} title="Onboard New Client" wide>
                <form
                    onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
                    className="space-y-4"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Company Name *</span>
                            <input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Industry</span>
                            <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" placeholder="IT Services" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact Person *</span>
                            <input required value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact Email *</span>
                            <input required type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Phone</span>
                            <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Website</span>
                            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Commission %</span>
                            <input type="number" step="0.01" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Credit Days</span>
                            <input type="number" value={form.creditDays} onChange={(e) => setForm({ ...form, creditDays: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                    </div>
                    <button disabled={createMutation.isPending} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25">
                        {createMutation.isPending ? "Onboarding..." : "Create Client"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
