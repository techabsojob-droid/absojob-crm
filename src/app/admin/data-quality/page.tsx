"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Search, CheckCircle2, AlertTriangle, Layers, FileText, ChevronRight, Merge, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import type { DataQualityIssue } from "@/lib/types";

export default function DataQualityPage() {
    const qc = useQueryClient();
    const [q, setQ] = useState("");
    const [selectedIssue, setSelectedIssue] = useState<DataQualityIssue | null>(null);

    const { data: issues = [], isLoading } = useQuery<DataQualityIssue[]>({
        queryKey: ["admin-data-quality", q],
        queryFn: async () => {
            const res = await fetch(`/api/admin/data-quality?q=${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error();
            return res.json();
        },
    });

    const actionMutation = useMutation({
        mutationFn: async ({ id, action }: { id: string; action: "RESOLVE" | "IGNORE" }) => {
            const res = await fetch("/api/admin/data-quality", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.action === "RESOLVE" ? "Issue resolved & record merged" : "Flag ignored");
            qc.invalidateQueries({ queryKey: ["admin-data-quality"] });
            setSelectedIssue(null);
        },
        onError: () => toast.error("Action failed"),
    });

    const duplicates = issues.filter((i) => i.type.includes("DUPLICATE"));
    const missingDocs = issues.filter((i) => i.type.includes("MISSING"));
    const incomplete = issues.filter((i) => i.type.includes("INCOMPLETE"));

    return (
        <div className="space-y-6">
            <PageHeader
                title="Data Quality & Duplicate Detection Center"
                subtitle="Ensure high-integrity CRM data: deduplication of candidates & clients, missing resume audits, and profile integrity"
            />

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Flags" value={issues.length} icon={Sparkles} tone={issues.length > 0 ? "amber" : "emerald"} hint="anomalies detected" />
                <StatCard label="Duplicate Records" value={duplicates.length} icon={Merge} tone="red" hint="candidates & clients" />
                <StatCard label="Missing Resumes" value={missingDocs.length} icon={FileText} tone="blue" hint="active pipeline candidates" />
                <StatCard label="Incomplete Data" value={incomplete.length} icon={Layers} tone="purple" hint="missing CTC or notice" />
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search anomalies by title, candidate, or client..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-16 rounded-2xl" />
                    ))}
                </div>
            ) : issues.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={CheckCircle2} message="Database is clean. No duplicates or data anomalies detected." />
                </SectionCard>
            ) : (
                <div className="space-y-3">
                    {issues.map((iss) => (
                        <div
                            key={iss.id}
                            className="p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-neutral-200 transition-all"
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge value={iss.severity} label={iss.severity} />
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                        {iss.type.replace("_", " ")}
                                    </span>
                                </div>
                                <h4 className="text-xs font-bold text-neutral-900">{iss.title}</h4>
                                <p className="text-[11px] text-neutral-600 leading-relaxed max-w-2xl">{iss.details}</p>
                                <p className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded w-fit mt-1">
                                    💡 Recommended: {iss.suggestedAction}
                                </p>
                            </div>
                            <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                                <button
                                    onClick={() => actionMutation.mutate({ id: iss.id, action: "RESOLVE" })}
                                    className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary/95 flex items-center gap-1"
                                >
                                    <Merge size={14} /> Merge & Fix
                                </button>
                                <button
                                    onClick={() => actionMutation.mutate({ id: iss.id, action: "IGNORE" })}
                                    className="px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200"
                                >
                                    Ignore
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
