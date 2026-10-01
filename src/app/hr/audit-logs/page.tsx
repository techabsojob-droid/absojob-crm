"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    ScrollText, Search, Filter, ShieldCheck, Clock,
    User, ArrowRight, CheckCircle2
} from "lucide-react";

interface AuditLogItem {
    id: string;
    actorUserId: string;
    actorRole: string;
    actorName?: string;
    action: string;
    entity: string;
    entityId: string;
    detail: string;
    createdAt: string;
}

export default function HRAuditLogsPage() {
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("ALL");

    const { data: logs = [], isLoading } = useQuery<AuditLogItem[]>({
        queryKey: ["hr-audit-logs"],
        queryFn: async () => {
            const res = await fetch("/api/hr/audit");
            if (!res.ok) throw new Error("Failed to fetch audit logs");
            return res.json();
        },
    });

    const filtered = logs.filter((l) => {
        if (actionFilter !== "ALL" && !l.action.includes(actionFilter)) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            l.action.toLowerCase().includes(q) ||
            l.entity.toLowerCase().includes(q) ||
            l.detail.toLowerCase().includes(q) ||
            (l.actorName && l.actorName.toLowerCase().includes(q))
        );
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="HR Compliance & Immutable Audit Trail"
                subtitle="Complete tamper-evident event log recording sensitive compensation changes, promotions, leave decisions, and administrative actions."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Total Logged Events" value={logs.length} icon={ScrollText} tone="primary" hint="Security recorded actions" />
                <StatCard label="Salary & Life-Cycle Events" value={logs.filter((l) => l.action.includes("SALARY") || l.action.includes("PROMOTION") || l.action.includes("TRANSFER")).length} icon={ShieldCheck} tone="purple" hint="High compliance sensitivity" />
                <StatCard label="Approval Decisions" value={logs.filter((l) => l.action.includes("APPROVAL") || l.action.includes("CONFIRMED")).length} icon={CheckCircle2} tone="emerald" hint="Managerial authorisations" />
            </div>

            {/* Filter Bar */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="px-3 py-2 bg-neutral-100 text-xs font-bold text-neutral-700 rounded-xl border border-neutral-200 focus:outline-none"
                        >
                            <option value="ALL">All Event Types</option>
                            <option value="SALARY">Salary Revisions</option>
                            <option value="PROMOTION">Promotions</option>
                            <option value="TRANSFER">Transfers</option>
                            <option value="APPROVAL">Approvals</option>
                            <option value="REQUEST">Requests</option>
                            <option value="TASK">Task Actions</option>
                        </select>
                    </div>

                    <div className="relative w-full md:w-72">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search by actor, detail, entity..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-neutral-100 rounded-xl text-xs font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Audit Timeline List */}
            <SectionCard title={`Audit Events (${filtered.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-8 h-8 rounded-full" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-32" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState icon={ScrollText} message="No audit log entries matching your filters." />
                ) : (
                    <div className="divide-y divide-neutral-100">
                        {filtered.map((log) => (
                            <div
                                key={log.id}
                                className="py-3.5 px-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-neutral-50 rounded-xl transition-colors"
                            >
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-700 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                        <ShieldCheck size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs text-neutral-900 font-mono">
                                                {log.action}
                                            </span>
                                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-neutral-100 text-neutral-600">
                                                {log.entity}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                                            {log.detail}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1 text-[11px] text-neutral-400">
                                            <span className="font-semibold text-neutral-700 flex items-center gap-1">
                                                <User size={11} /> {log.actorName || log.actorRole}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={11} /> {new Date(log.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
