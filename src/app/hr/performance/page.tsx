"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { Award, TrendingUp, Target, Star, CheckCircle2, Search, Filter, AlertCircle } from "lucide-react";

interface Goal {
    id: string;
    title: string;
    description: string;
    progress: number;
    weightage: number;
}

interface PerformanceReview {
    id: string;
    employeeId: string;
    employeeName: string;
    department: string;
    reviewCycle: string;
    goals: Goal[];
    managerFeedback?: string | null;
    employeeFeedback?: string | null;
    rating?: number | null;
    status: "GOALS_SET" | "SELF_REVIEW" | "MANAGER_REVIEW" | "COMPLETED";
    promotionRecommended: boolean;
    incrementPercent?: number | null;
    updatedAt: string;
}

export default function HRPerformancePage() {
    const [cycle, setCycle] = useState("ALL");
    const [search, setSearch] = useState("");

    const { data: reviews = [], isLoading } = useQuery<PerformanceReview[]>({
        queryKey: ["hr-performance", cycle, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (cycle !== "ALL") params.set("cycle", cycle);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/performance?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch performance reviews");
            return res.json();
        },
    });

    const completedCount = reviews.filter((r) => r.status === "COMPLETED").length;
    const inProgressCount = reviews.filter((r) => r.status !== "COMPLETED").length;
    const avgRating =
        reviews.filter((r) => r.rating).length > 0
            ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.filter((r) => r.rating).length).toFixed(1)
            : "—";

    return (
        <div className="space-y-6">
            <PageHeader
                title="Performance Management & Reviews"
                subtitle="Track employee goal achievements, review cycles, manager feedback, and performance ratings."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Reviews" value={reviews.length} icon={Award} tone="primary" hint="Active review cycles" />
                <StatCard label="Completed" value={completedCount} icon={CheckCircle2} tone="emerald" hint="Finalized appraisals" />
                <StatCard label="In Progress" value={inProgressCount} icon={TrendingUp} tone="amber" hint="Self / Manager review" />
                <StatCard label="Average Rating" value={avgRating} icon={Star} tone="purple" hint="Out of 5.0 stars" />
            </div>

            {/* Controls */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <Filter size={16} className="text-neutral-500" />
                            <select
                                value={cycle}
                                onChange={(e) => setCycle(e.target.value)}
                                className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                            >
                                <option value="ALL">All Review Cycles</option>
                                <option value="H1 2026">H1 2026</option>
                                <option value="H2 2025">H2 2025</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search employee or dept..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Performance Review Cards Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-4">
                            <SkeletonPulse className="h-6 w-1/2" />
                            <SkeletonPulse className="h-4 w-1/3" />
                            <SkeletonPulse className="h-20 w-full" />
                        </div>
                    ))}
                </div>
            ) : reviews.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={AlertCircle} message="No performance reviews found matching your search." />
                </SectionCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {reviews.map((rev) => {
                        const avgProgress =
                            rev.goals.length > 0
                                ? Math.round(rev.goals.reduce((acc, g) => acc + g.progress, 0) / rev.goals.length)
                                : 0;

                        return (
                            <div key={rev.id} className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-6 space-y-5">
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-extrabold flex items-center justify-center text-base">
                                            {rev.employeeName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-neutral-900 text-lg">{rev.employeeName}</h3>
                                            <p className="text-xs text-neutral-500 font-medium">
                                                {rev.department} • Cycle: {rev.reviewCycle}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge value={rev.status} />
                                </div>

                                {/* Goals Progress Bar */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-neutral-600 flex items-center gap-1">
                                            <Target size={14} className="text-primary" /> Overall Goals Achievement
                                        </span>
                                        <span className="text-primary font-extrabold">{avgProgress}%</span>
                                    </div>
                                    <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${avgProgress}%` }} />
                                    </div>
                                </div>

                                {/* Goals List */}
                                <div className="space-y-2.5 pt-1">
                                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Key Objectives ({rev.goals.length})</p>
                                    <div className="space-y-2">
                                        {rev.goals.map((g) => (
                                            <div key={g.id} className="bg-neutral-50 p-3 rounded-xl flex items-center justify-between text-xs">
                                                <div>
                                                    <span className="font-bold text-neutral-800">{g.title}</span>
                                                    <p className="text-[11px] text-neutral-500">{g.description}</p>
                                                </div>
                                                <span className="font-extrabold text-neutral-700 bg-white px-2 py-1 rounded-lg border border-neutral-200">
                                                    {g.progress}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Feedback & Rating */}
                                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs text-neutral-400 font-medium">Performance Rating</span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            {rev.rating ? (
                                                Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={16}
                                                        className={i < rev.rating! ? "text-amber-400 fill-amber-400" : "text-neutral-200"}
                                                    />
                                                ))
                                            ) : (
                                                <span className="text-xs text-neutral-400 font-semibold italic">Rating Pending</span>
                                            )}
                                        </div>
                                    </div>
                                    {rev.incrementPercent && (
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                                Recommended Increment: +{rev.incrementPercent}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
