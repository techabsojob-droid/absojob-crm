"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    ShieldCheck, CheckCircle2, XCircle, Clock, Search,
    Filter, AlertCircle, FileText, User, ArrowRight
} from "lucide-react";
import type { UnifiedApprovalItem } from "@/app/api/hr/approvals/route";

export default function HRApprovalsPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
    const [search, setSearch] = useState("");

    const { data: approvals = [], isLoading } = useQuery<UnifiedApprovalItem[]>({
        queryKey: ["hr-approvals-feed", statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/hr/approvals?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch approvals");
            return res.json();
        },
    });

    const actionMutation = useMutation({
        mutationFn: async ({ id, kind, action }: { id: string; kind: string; action: "APPROVE" | "REJECT" }) => {
            const res = await fetch("/api/hr/approvals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, kind, action }),
            });
            if (!res.ok) throw new Error("Failed to process approval");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-approvals-feed"] });
            queryClient.invalidateQueries({ queryKey: ["hr-leave"] });
            queryClient.invalidateQueries({ queryKey: ["hr-employee-requests"] });
            toast.success("Action processed successfully");
        },
        onError: () => {
            toast.error("Failed to process approval action");
        },
    });

    const pendingCount = approvals.filter((a) => a.status === "PENDING").length;

    const filtered = approvals.filter((a) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            a.employeeName.toLowerCase().includes(q) ||
            a.title.toLowerCase().includes(q) ||
            a.department.toLowerCase().includes(q) ||
            a.detail.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Central HR Approval Center"
                subtitle="Consolidated decision inbox for leave applications, attendance corrections, remote work, employee requests, and promotions."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Pending Action" value={pendingCount} icon={Clock} tone="amber" hint="Requires review" />
                <StatCard label="Total Requests" value={approvals.length} icon={ShieldCheck} tone="primary" hint="In current view" />
                <StatCard label="Approved Items" value={approvals.filter((a) => a.status === "APPROVED").length} icon={CheckCircle2} tone="emerald" hint="Completed decisions" />
                <StatCard label="Declined Items" value={approvals.filter((a) => a.status === "REJECTED").length} icon={XCircle} tone="red" hint="Rejected requests" />
            </div>

            {/* Filter Tabs & Search */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setStatusFilter(tab)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                                    statusFilter === tab
                                        ? "bg-primary text-white shadow-xs"
                                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search employee, title..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-neutral-100 rounded-xl text-xs font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Approvals Table */}
            <SectionCard title={`Approval Items (${filtered.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-full" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-28" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState icon={ShieldCheck} message="No pending approval requests in this view." />
                ) : (
                    <div className="divide-y divide-neutral-100">
                        {filtered.map((item) => (
                            <div
                                key={`${item.kind}-${item.id}`}
                                className="py-4 px-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-neutral-50/80 rounded-xl transition-colors"
                            >
                                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                                        {item.employeeName.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-neutral-900">{item.title}</p>
                                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-neutral-100 text-neutral-700">
                                                {item.kind.replace(/_/g, " ")}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2 leading-relaxed">
                                            {item.detail}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-neutral-400">
                                            <span className="font-semibold text-neutral-700">{item.employeeName}</span>
                                            <span>•</span>
                                            <span>{item.department}</span>
                                            <span>•</span>
                                            <span>{new Date(item.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                                    <span
                                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                            item.status === "PENDING"
                                                ? "bg-amber-100 text-amber-800"
                                                : item.status === "APPROVED"
                                                ? "bg-emerald-100 text-emerald-800"
                                                : "bg-red-100 text-red-800"
                                        }`}
                                    >
                                        {item.status}
                                    </span>

                                    {item.status === "PENDING" && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => actionMutation.mutate({ id: item.id, kind: item.kind, action: "APPROVE" })}
                                                disabled={actionMutation.isPending}
                                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => actionMutation.mutate({ id: item.id, kind: item.kind, action: "REJECT" })}
                                                disabled={actionMutation.isPending}
                                                className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs transition-colors"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
