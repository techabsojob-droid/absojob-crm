"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";

const STAGES = [
    "SOURCED", "SCREENING", "INTERVIEW_SCHEDULED", "TECH_ROUND",
    "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT",
] as const;

export default function TaPipelinePage() {
    const qc = useQueryClient();
    const [jobFilter, setJobFilter] = useState("ALL");
    const [mineOnly, setMineOnly] = useState(false);

    const { data: apps, isLoading } = useQuery({
        queryKey: ["pipeline", mineOnly],
        queryFn: async () => {
            const res = await fetch(`/api/ta/applications${mineOnly ? "?mine=1" : ""}`);
            return res.json();
        },
        refetchInterval: 20000,
    });

    const { data: jobs } = useQuery({
        queryKey: ["ta-jobs-filter"],
        queryFn: async () => (await fetch("/api/admin/jobs?status=SOURCING")).json().catch(() => null),
    });

    const moveMutation = useMutation({
        mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
            const res = await fetch("/api/ta/applications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, stage }),
            });
            if (!res.ok) throw new Error("Move failed");
            return res.json();
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline"] }),
        onError: () => toast.error("Could not move candidate"),
    });

    const list = Array.isArray(apps) ? apps.filter((a: any) => !["JOINED", "REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)) : [];
    const filtered = jobFilter === "ALL" ? list : list.filter((a: any) => a.jobId === jobFilter);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Sourcing Pipeline"
                subtitle="Drag candidates across stages — click arrows to move"
                action={
                    <button onClick={() => setMineOnly(!mineOnly)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${mineOnly ? "bg-primary text-white border-primary" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"}`}>
                        {mineOnly ? "Showing: My candidates" : "Showing: All"}
                    </button>
                }
            />

            {/* Job filter */}
            <div className="flex gap-2 flex-wrap">
                <button onClick={() => setJobFilter("ALL")}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${jobFilter === "ALL" ? "bg-primary text-white" : "bg-white border border-neutral-200 text-neutral-500"}`}>
                    All jobs
                </button>
                {(Array.isArray(jobs) ? jobs : []).slice(0, 6).map((j: any) => (
                    <button key={j.id} onClick={() => setJobFilter(j.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors truncate max-w-[220px] ${jobFilter === j.id ? "bg-primary text-white" : "bg-white border border-neutral-200 text-neutral-500"}`}>
                        {j.title}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">{STAGES.map((s) => <SkeletonPulse key={s} className="h-64 rounded-2xl" />)}</div>
            ) : filtered.length === 0 ? (
                <SectionCard><EmptyState icon={GitBranch} message="Pipeline is empty. Source candidates from the Candidates tab." /></SectionCard>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 items-start overflow-x-auto pb-2">
                    {STAGES.map((stage) => {
                        const stageApps = filtered.filter((a: any) => a.stage === stage);
                        return (
                            <div key={stage} className="bg-neutral-50/80 border border-neutral-100 rounded-2xl p-2.5 min-h-[280px]">
                                <div className="flex items-center justify-between px-1 mb-2.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 leading-tight">{stage.replaceAll("_", " ")}</span>
                                    <span className="text-[10px] font-black bg-white border border-neutral-200 rounded-md px-1.5 py-0.5 text-neutral-600">{stageApps.length}</span>
                                </div>

                                <div className="space-y-2">
                                    {stageApps.map((a: any) => {
                                        const stageIdx = STAGES.indexOf(stage as typeof STAGES[number]);
                                        return (
                                            <div key={a.id} className="bg-white rounded-xl p-3 border border-neutral-100 shadow-xs space-y-2 group/card">
                                                <div className="flex items-start justify-between gap-1.5">
                                                    <p className="font-bold text-[13px] text-neutral-900 leading-tight">{a.candidateName}</p>
                                                    <Badge value={a.fitScore >= 85 ? "URGENT" : a.fitScore >= 70 ? "HIGH" : "MEDIUM"} label={`${a.fitScore}%`} />
                                                </div>
                                                <p className="text-[10px] text-neutral-400 leading-snug line-clamp-2">{a.jobTitle}</p>
                                                <p className="text-[10px] text-neutral-500"><strong>{a.totalExperienceYears}y exp</strong> · exp CTC ₹{a.expectedCtcLpa}L</p>
                                                {a.nextInterview && (
                                                    <p className="text-[9px] font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 inline-block">
                                                        📅 {new Date(a.nextInterview).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                                    </p>
                                                )}
                                                <div className="flex items-center justify-between pt-1 opacity-60 group-hover/card:opacity-100 transition-opacity">
                                                    <button
                                                        disabled={stageIdx === 0 || moveMutation.isPending}
                                                        onClick={() => moveMutation.mutate({ id: a.id, stage: STAGES[stageIdx - 1] })}
                                                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-800 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                                                        title="Move back"
                                                    >
                                                        <ChevronLeft size={14} />
                                                    </button>
                                                    <span className="text-[9px] text-neutral-300 uppercase font-bold tracking-wider">move</span>
                                                    <button
                                                        disabled={stageIdx === STAGES.length - 1 || moveMutation.isPending}
                                                        onClick={() => moveMutation.mutate({ id: a.id, stage: STAGES[stageIdx + 1] })}
                                                        className="p-1.5 rounded-lg bg-primary/5 text-primary hover:bg-primary hover:text-white disabled:opacity-20 disabled:hover:bg-primary/5 transition-colors"
                                                        title="Advance"
                                                    >
                                                        <ChevronRight size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
