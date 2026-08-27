"use client";

import { useQuery } from "@tanstack/react-query";
import { Briefcase, Users, UserCheck, CalendarClock, CheckSquare, Flame, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";

export default function TaDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ["ta-dashboard"],
        queryFn: async () => (await fetch("/api/ta/dashboard")).json(),
        refetchInterval: 30000,
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-64" />
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonPulse key={i} className="h-24 rounded-2xl" />)}
                </div>
                <SkeletonPulse className="h-64 rounded-2xl" />
            </div>
        );
    }

    const k = data.kpis;
    const maxStage = Math.max(...data.pipeline.map((p: any) => p.count), 1);

    return (
        <div className="space-y-6">
            <PageHeader title="My Desk" subtitle="Requisitions, pipeline & interviews assigned to you" />

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="My Requisitions" value={k.myRequisitions} icon={Briefcase} tone="primary" hint={`${k.openPositions} open positions`} />
                <StatCard label="In Pipeline" value={k.inPipeline} icon={Users} tone="purple" hint="active candidates" />
                <StatCard label="Total Joined" value={k.joinedTotal} icon={UserCheck} tone="emerald" hint="placements closed" />
                <StatCard label="Interviews Today" value={k.interviewsToday} icon={CalendarClock} tone={k.interviewsToday ? "amber" : "blue"} />
                <StatCard label="Pending Tasks" value={k.pendingTasks} icon={CheckSquare} tone={k.pendingTasks > 5 ? "red" : "blue"} />
                <StatCard label="Conversion" value={`${Math.round((k.joinedTotal / Math.max(k.inPipeline + k.joinedTotal, 1)) * 100)}%`} icon={Flame} tone="emerald" hint="pipeline → join" />
            </div>

            {/* Pipeline snapshot */}
            <SectionCard
                title="My Pipeline Snapshot"
                subtitle="Candidates per stage"
                action={<Link href="/ta/pipeline" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">Open pipeline <ArrowRight size={12} /></Link>}
            >
                <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                    {data.pipeline.map((p: any) => (
                        <div key={p.stage} className={`rounded-xl p-3 text-center border ${p.count > 0 ? "bg-primary/[0.04] border-primary/20" : "bg-neutral-50 border-neutral-100"}`}>
                            <p className={`text-xl font-extrabold ${p.count > 0 ? "text-neutral-900" : "text-neutral-300"}`}>{p.count}</p>
                            <p className="text-[9px] font-bold text-neutral-400 uppercase leading-tight mt-1">{p.stage.replaceAll("_", " ")}</p>
                            <div className="h-1 mt-2 bg-neutral-200/60 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(p.count / maxStage) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming interviews */}
                <SectionCard
                    title="Upcoming Interviews"
                    action={<Link href="/ta/interviews" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">All <ArrowRight size={12} /></Link>}
                >
                    {data.upcomingInterviews.length === 0 ? (
                        <EmptyState icon={CalendarClock} message="No scheduled interviews." />
                    ) : (
                        <div className="divide-y divide-neutral-50 -mx-5 px-5">
                            {data.upcomingInterviews.map((i: any) => {
                                const dt = new Date(i.scheduledAt);
                                const isToday = dt.toDateString() === new Date().toDateString();
                                return (
                                    <div key={i.id} className="py-3.5 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-neutral-900">{i.candidateName}</p>
                                            <p className="text-xs text-neutral-400 truncate">{i.jobTitle} · {i.round.replaceAll("_", " ")}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${isToday ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                                                {isToday ? "Today" : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {dt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>

                {/* Urgent requisitions */}
                <SectionCard
                    title="Priority Requisitions"
                    action={<Link href="/ta/requisitions" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">All <ArrowRight size={12} /></Link>}
                >
                    {data.urgentRequisitions.length === 0 ? (
                        <EmptyState icon={Briefcase} message="No active requisitions assigned." />
                    ) : (
                        <div className="space-y-3">
                            {data.urgentRequisitions.map((j: any) => (
                                <div key={j.id} className="flex items-center justify-between gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900 truncate flex items-center gap-2">
                                            {j.title} <Badge value={j.priority} />
                                        </p>
                                        <p className="text-xs text-neutral-400">{j.clientName} · {j.filled}/{j.openings} filled · {j.inPipeline} in pipeline</p>
                                    </div>
                                    <div className="w-16 h-1.5 bg-neutral-200 rounded-full overflow-hidden shrink-0">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(j.filled / Math.max(j.openings, 1)) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* My tasks */}
            <SectionCard title="My Pending Tasks" action={<Link href="/ta/tasks" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">All tasks <ArrowRight size={12} /></Link>}>
                {data.myTasks.length === 0 ? (
                    <EmptyState icon={CheckSquare} message="All caught up! No pending tasks." />
                ) : (
                    <div className="space-y-2.5">
                        {data.myTasks.map((t: any) => (
                            <div key={t.id} className="flex items-start justify-between gap-3 p-3.5 bg-white border border-neutral-100 rounded-xl">
                                <div>
                                    <p className="text-sm font-bold text-neutral-800">{t.title}</p>
                                    <p className="text-[11px] text-neutral-400 mt-0.5">by {t.createdByName}{t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString("en-IN")}` : ""}</p>
                                </div>
                                <Badge value={t.priority} />
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
