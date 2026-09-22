"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Search, CheckCircle2, Clock, AlertTriangle, FileText, ChevronRight, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import type { ComplianceItem } from "@/lib/types";

export default function CompliancePage() {
    const qc = useQueryClient();
    const [q, setQ] = useState("");
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [selectedItem, setSelectedItem] = useState<ComplianceItem | null>(null);

    const { data: items = [], isLoading } = useQuery<ComplianceItem[]>({
        queryKey: ["admin-compliance", q, severityFilter],
        queryFn: async () => {
            const res = await fetch(`/api/admin/compliance?q=${encodeURIComponent(q)}&severity=${severityFilter}`);
            if (!res.ok) throw new Error();
            return res.json();
        },
    });

    const patchMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const res = await fetch("/api/admin/compliance", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: () => {
            toast.success("Compliance status updated & logged.");
            qc.invalidateQueries({ queryKey: ["admin-compliance"] });
            setSelectedItem(null);
        },
        onError: () => toast.error("Update failed"),
    });

    const criticalCount = items.filter((c) => c.severity === "CRITICAL" && c.status !== "RESOLVED").length;
    const warningCount = items.filter((c) => c.severity === "WARNING" && c.status !== "RESOLVED").length;
    const openCount = items.filter((c) => c.status === "OPEN").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Compliance & Regulatory Governance"
                subtitle="Data privacy (DPDP Act), candidate consent verification, document expiries & statutory audit adherence"
            />

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Critical Flags" value={criticalCount} icon={ShieldAlert} tone={criticalCount > 0 ? "red" : "emerald"} hint="immediate statutory breach risk" />
                <StatCard label="Warning Flags" value={warningCount} icon={AlertTriangle} tone="amber" hint="document expiries (<15d)" />
                <StatCard label="Open Actions" value={openCount} icon={Clock} tone="primary" hint="audit items pending review" />
                <StatCard label="Consent Compliance" value="98.4%" icon={CheckCircle2} tone="emerald" hint="verified candidate consents" />
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-100 shadow-sm">
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search compliance issues..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    {["ALL", "CRITICAL", "WARNING", "PENDING"].map((s) => (
                        <button
                            key={s}
                            onClick={() => setSeverityFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                severityFilter === s
                                    ? "bg-primary text-white shadow-sm"
                                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Compliance Table */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-16 rounded-2xl" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={CheckCircle2} message="All compliance checkpoints are fully adhered to." />
                </SectionCard>
            ) : (
                <SectionCard>
                    <div className="overflow-x-auto -m-5">
                        <table className="w-full text-xs min-w-[800px]">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                                    <th className="px-5 py-3.5">Severity</th>
                                    <th className="px-3 py-3.5">Category & Title</th>
                                    <th className="px-3 py-3.5">Related Entity</th>
                                    <th className="px-3 py-3.5">Due By</th>
                                    <th className="px-3 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {items.map((c) => (
                                    <tr key={c.id} className="hover:bg-neutral-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <Badge value={c.severity} label={c.severity} />
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <p className="font-bold text-neutral-900 text-xs">{c.title}</p>
                                            <p className="text-[11px] text-neutral-500">{c.detail}</p>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="font-semibold text-neutral-800">{c.entityName}</span>
                                            <span className="text-[10px] text-neutral-400 block font-medium">{c.entityType} ({c.entityId})</span>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="font-medium text-neutral-700">{c.dueDate}</span>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <Badge value={c.status} label={c.status} />
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {c.status !== "RESOLVED" && (
                                                    <button
                                                        onClick={() => patchMutation.mutate({ id: c.id, status: "RESOLVED" })}
                                                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 border border-emerald-200"
                                                    >
                                                        Mark Resolved
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedItem(c)}
                                                    className="px-2.5 py-1 text-[11px] font-bold text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200"
                                                >
                                                    Audit
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

            {/* Audit Modal */}
            {selectedItem && (
                <ModalShell
                    title={`Compliance Audit: ${selectedItem.title}`}
                    onClose={() => setSelectedItem(null)}
                >
                    <div className="space-y-4">
                        <div className="p-3 bg-neutral-50 rounded-xl space-y-1.5 text-xs text-neutral-600">
                            <p><strong>Entity:</strong> {selectedItem.entityName} ({selectedItem.entityType})</p>
                            <p><strong>Requirement:</strong> {selectedItem.detail}</p>
                            <p><strong>Statutory Due Date:</strong> {selectedItem.dueDate}</p>
                            <p><strong>Last Logged:</strong> {selectedItem.lastUpdated}</p>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => patchMutation.mutate({ id: selectedItem.id, status: "IGNORED" })}
                                className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                            >
                                Dismiss / Risk Accepted
                            </button>
                            <button
                                onClick={() => patchMutation.mutate({ id: selectedItem.id, status: "RESOLVED" })}
                                className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary/95"
                            >
                                Confirm Rectification
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
