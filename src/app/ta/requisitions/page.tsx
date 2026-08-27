"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, MapPin, IndianRupee, Users, Flame } from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";

export default function TaRequisitionsPage() {
    const [filter, setFilter] = useState("ACTIVE");

    const { data: jobs, isLoading } = useQuery({
        queryKey: ["ta-jobs"],
        queryFn: async () => (await fetch("/api/admin/jobs")).json(),
        refetchInterval: 30000,
    });

    const all = Array.isArray(jobs) ? jobs : [];
    const filtered = filter === "ACTIVE"
        ? all.filter((j: any) => ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status))
        : all;

    return (
        <div className="space-y-6">
            <PageHeader title="Requisitions" subtitle="Open positions from clients — your sourcing targets" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Active" value={all.filter((j: any) => ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status)).length} icon={Briefcase} tone="primary" />
                <StatCard label="Urgent" value={all.filter((j: any) => j.priority === "URGENT" && !["FULFILLED", "CLOSED", "CANCELLED"].includes(j.status)).length} icon={Flame} tone="red" />
                <StatCard label="Interviewing" value={all.filter((j: any) => j.status === "INTERVIEWING").length} icon={Users} tone="purple" />
                <StatCard label="Fulfilled (MTD)" value={all.filter((j: any) => j.status === "FULFILLED").length} icon={IndianRupee} tone="emerald" />
            </div>

            <div className="flex gap-2">
                {["ACTIVE", "ALL"].map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white border border-neutral-200 text-neutral-500"}`}>
                        {f === "ACTIVE" ? "Active only" : "All"}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-neutral-100" />)}</div>
            ) : filtered.length === 0 ? (
                <SectionCard><EmptyState icon={Briefcase} message="No requisitions in this view." /></SectionCard>
            ) : (
                <div className="space-y-3">
                    {filtered.map((j: any) => {
                        const progress = Math.round((j.joinedCount / Math.max(j.openings, 1)) * 100);
                        return (
                            <div key={j.id} className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-neutral-900">{j.title}</h3>
                                            <Badge value={j.priority} />
                                            <Badge value={j.status} />
                                        </div>
                                        <p className="text-xs text-neutral-500 mt-1 flex items-center gap-3 flex-wrap">
                                            <span className="font-bold text-primary">{j.clientName}</span>
                                            <span className="flex items-center gap-1"><MapPin size={12} /> {j.location}</span>
                                            <span className="flex items-center gap-1"><IndianRupee size={12} /> {j.salaryMinLpa}–{j.salaryMaxLpa} LPA</span>
                                        </p>
                                        {j.skills?.length > 0 && (
                                            <div className="flex gap-1.5 flex-wrap mt-2">
                                                {j.skills.map((s: string) => <span key={s} className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md text-[10px] font-semibold">{s}</span>)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0 space-y-1">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Filled</p>
                                        <p className="text-lg font-extrabold text-neutral-900">{j.filled}/{j.openings}</p>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-3 gap-3">
                                    <div className="bg-neutral-50 rounded-xl px-3 py-2 border border-neutral-100">
                                        <p className="text-[9px] font-bold text-neutral-400 uppercase">In Pipeline</p>
                                        <p className="text-sm font-extrabold text-blue-600">{j.inPipeline}</p>
                                    </div>
                                    <div className="bg-neutral-50 rounded-xl px-3 py-2 border border-neutral-100">
                                        <p className="text-[9px] font-bold text-neutral-400 uppercase">Joined</p>
                                        <p className="text-sm font-extrabold text-emerald-600">{j.joinedCount}</p>
                                    </div>
                                    <div className="bg-neutral-50 rounded-xl px-3 py-2 border border-neutral-100">
                                        <p className="text-[9px] font-bold text-neutral-400 uppercase">Days Open</p>
                                        <p className="text-sm font-extrabold text-neutral-700">{j.daysOpen}</p>
                                    </div>
                                </div>

                                <div className="mt-3 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-primary to-emerald-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
