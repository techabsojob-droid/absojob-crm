"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, Search, Plus, Building2, Phone, Mail, ChevronRight, CheckCircle2, ArrowRight, UserPlus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import type { ClientLead, ClientLeadStage } from "@/lib/types";

const STAGES: ClientLeadStage[] = ["NEW", "CONTACTED", "QUALIFIED", "MEETING", "PROPOSAL", "NEGOTIATION", "CONVERTED", "LOST"];

export default function ClientLeadsPage() {
    const qc = useQueryClient();
    const [q, setQ] = useState("");
    const [stageFilter, setStageFilter] = useState("ALL");
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedLead, setSelectedLead] = useState<ClientLead | null>(null);

    const [form, setForm] = useState({
        companyName: "",
        contactPerson: "",
        email: "",
        phone: "",
        industry: "IT & Software",
        location: "Mumbai",
        leadSource: "OUTBOUND",
        expectedPositions: "5",
        expectedAnnualValueLpa: "15",
        priority: "HIGH",
        notes: "",
    });

    const { data: leads = [], isLoading } = useQuery<ClientLead[]>({
        queryKey: ["admin-client-leads", q, stageFilter],
        queryFn: async () => {
            const res = await fetch(`/api/admin/client-leads?q=${encodeURIComponent(q)}&stage=${stageFilter}`);
            if (!res.ok) throw new Error();
            return res.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/client-leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: () => {
            toast.success("Lead created successfully.");
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-client-leads"] });
        },
        onError: () => toast.error("Failed to add lead"),
    });

    const patchMutation = useMutation({
        mutationFn: async ({ id, stage, convertToClient }: { id: string; stage?: string; convertToClient?: boolean }) => {
            const res = await fetch("/api/admin/client-leads", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, stage, convertToClient }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: (data) => {
            if (data.stage === "CONVERTED") {
                toast.success("Lead converted to active Client Account!");
                qc.invalidateQueries({ queryKey: ["clients"] });
            } else {
                toast.success("Lead pipeline updated.");
            }
            qc.invalidateQueries({ queryKey: ["admin-client-leads"] });
            setSelectedLead(null);
        },
        onError: () => toast.error("Action failed"),
    });

    const activePipeline = leads.filter((l) => !["CONVERTED", "LOST"].includes(l.stage));
    const convertedCount = leads.filter((l) => l.stage === "CONVERTED").length;
    const industryCounts = leads.reduce<Record<string, number>>((m, l) => { if (l.industry) m[l.industry] = (m[l.industry] ?? 0) + 1; return m; }, {});
    const topIndustries = Object.entries(industryCounts).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k]) => k);
    const totalPipelineValue = activePipeline.reduce((acc, l) => acc + (l.expectedAnnualValueLpa || 0), 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Client Acquisition & Leads Pipeline"
                subtitle="Track prospective enterprise hiring accounts from first outreach to commercial contract signing"
                action={
                    <button
                        onClick={() => setCreateOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:bg-primary/95 transition-all"
                    >
                        <Plus size={16} /> New Client Lead
                    </button>
                }
            />

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Active Leads" value={activePipeline.length} icon={Building2} tone="primary" hint="prospects in negotiation" />
                <StatCard label="Pipeline Value" value={`₹${totalPipelineValue}L`} icon={UserCheck} tone="blue" hint="estimated annual billing" />
                <StatCard label="Converted Accounts" value={convertedCount} icon={CheckCircle2} tone="emerald" hint="active billing clients" />
                <StatCard label="Top Industries" value={topIndustries.join(" & ") || "—"} icon={Building2} tone="purple" hint={topIndustries.length ? `${industryCounts[topIndustries[0]]} lead(s) in ${topIndustries[0]}` : "no leads yet"} />
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-100 shadow-sm">
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search company, contact, industry..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                    {["ALL", "QUALIFIED", "MEETING", "PROPOSAL", "NEGOTIATION", "CONVERTED"].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStageFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                stageFilter === s
                                    ? "bg-primary text-white shadow-sm"
                                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Leads Table */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-16 rounded-2xl" />
                    ))}
                </div>
            ) : leads.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={Building2} message="No leads found matching current stage or search." />
                </SectionCard>
            ) : (
                <SectionCard>
                    <div className="overflow-x-auto -m-5">
                        <table className="w-full text-xs min-w-[850px]">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                                    <th className="px-5 py-3.5">Company & Industry</th>
                                    <th className="px-3 py-3.5">Contact Person</th>
                                    <th className="px-3 py-3.5">Source & Account Rep</th>
                                    <th className="px-3 py-3.5">Expected Mandates</th>
                                    <th className="px-3 py-3.5">Estimated Value</th>
                                    <th className="px-3 py-3.5">Pipeline Stage</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {leads.map((l) => (
                                    <tr key={l.id} className="hover:bg-neutral-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <p className="font-bold text-neutral-900 text-xs">{l.companyName}</p>
                                            <p className="text-[10px] text-neutral-500">{l.industry} · {l.location}</p>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <p className="font-semibold text-neutral-900">{l.contactPerson}</p>
                                            <p className="text-[10px] text-neutral-400">{l.email} · {l.phone}</p>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="font-medium text-neutral-700">{l.assignedToName}</span>
                                            <p className="text-[10px] text-neutral-400 font-semibold">{l.leadSource}</p>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="font-bold text-neutral-800">{l.expectedPositions} roles</span>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="font-bold text-emerald-600">₹{l.expectedAnnualValueLpa}L / yr</span>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <Badge
                                                value={l.stage}
                                                label={l.stage}
                                            />
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {l.stage !== "CONVERTED" && (
                                                    <button
                                                        onClick={() => patchMutation.mutate({ id: l.id, convertToClient: true })}
                                                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 border border-emerald-200"
                                                    >
                                                        Convert to Client
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedLead(l)}
                                                    className="px-2.5 py-1 text-[11px] font-bold text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200"
                                                >
                                                    Move Stage
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Stage Change Modal */}
            {selectedLead && (
                <ModalShell
                    title={`Update Lead: ${selectedLead.companyName}`}
                    onClose={() => setSelectedLead(null)}
                >
                    <div className="space-y-4">
                        <p className="text-xs text-neutral-600 leading-relaxed">
                            {selectedLead.notes || "No notes entered."}
                        </p>
                        <div>
                            <label className="text-xs font-bold text-neutral-700 mb-2 block">Select Pipeline Stage</label>
                            <div className="grid grid-cols-2 gap-2">
                                {STAGES.map((stg) => (
                                    <button
                                        key={stg}
                                        onClick={() => patchMutation.mutate({ id: selectedLead.id, stage: stg })}
                                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                                            selectedLead.stage === stg
                                                ? "bg-primary text-white border-primary shadow-sm"
                                                : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                                        }`}
                                    >
                                        {stg}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* Create Lead Modal */}
            {createOpen && (
                <ModalShell
                    title="Add Prospective Client Lead"
                    onClose={() => setCreateOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            createMutation.mutate();
                        }}
                        className="space-y-3"
                    >
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Company Name</label>
                            <input
                                required
                                value={form.companyName}
                                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                placeholder="e.g. Acme Health Corp"
                                className="w-full mt-1 p-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Contact Person</label>
                                <input
                                    required
                                    value={form.contactPerson}
                                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                                    placeholder="HR Lead / Director"
                                    className="w-full mt-1 p-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="contact@company.com"
                                    className="w-full mt-1 p-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Phone</label>
                                <input
                                    required
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="+91 98..."
                                    className="w-full mt-1 p-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Industry</label>
                                <input
                                    value={form.industry}
                                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                                    className="w-full mt-1 p-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Expected Openings</label>
                                <input
                                    type="number"
                                    value={form.expectedPositions}
                                    onChange={(e) => setForm({ ...form, expectedPositions: e.target.value })}
                                    className="w-full mt-1 p-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Estimated Value (LPA)</label>
                                <input
                                    type="number"
                                    value={form.expectedAnnualValueLpa}
                                    onChange={(e) => setForm({ ...form, expectedAnnualValueLpa: e.target.value })}
                                    className="w-full mt-1 p-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Notes / Requirements</label>
                            <textarea
                                rows={3}
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                placeholder="Key hiring requirements, tech stack, hiring timelines..."
                                className="w-full mt-1 p-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setCreateOpen(false)}
                                className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-xl font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary/95"
                            >
                                {createMutation.isPending ? "Saving..." : "Create Lead"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
