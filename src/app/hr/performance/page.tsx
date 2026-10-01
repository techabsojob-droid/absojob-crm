"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api, useEmployeeOptions } from "@/lib/api";
import ManagerReviewModal from "@/components/hr/ManagerReviewModal";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    Award, TrendingUp, Target, Star, CheckCircle2, Search, Filter,
    AlertCircle, Flag, RefreshCw, MessageSquare, Heart, Plus
} from "lucide-react";


function useHrReference() {
    return useQuery<Record<string, any[]>>({
        queryKey: ["hr-reference", "goals,reviewCycles"],
        queryFn: async () => (await fetch("/api/hr/reference?keys=goals,reviewCycles")).json(),
        staleTime: 60_000,
    });
}

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

function PerformanceContent() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");

    const [activeTab, setActiveTab] = useState<"DASHBOARD" | "GOALS" | "CYCLES" | "APPRAISALS" | "FEEDBACK">("DASHBOARD");
    const [cycle, setCycle] = useState("ALL");
    const [search, setSearch] = useState("");
    const qc = useQueryClient();
    const { data: employeeOptions = [] } = useEmployeeOptions();
    const [newOpen, setNewOpen] = useState(false);
    const [newForm, setNewForm] = useState({ employeeId: "", reviewCycle: "", goals: "" });
    const [reviewing, setReviewing] = useState<PerformanceReview | null>(null);
    const act = useMutation({
        mutationFn: (args: { method: "POST" | "PATCH"; body: Record<string, unknown> }) => api("/api/hr/performance", args.method, args.body),
        onSuccess: (_d, args) => {
            toast.success(args.method === "POST" ? "Review started — employee notified" : "Review completed");
            setNewOpen(false);
            setReviewing(null);
            setNewForm({ employeeId: "", reviewCycle: "", goals: "" });
            qc.invalidateQueries({ queryKey: ["hr-performance"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    useEffect(() => {
        if (tabParam === "goals") setActiveTab("GOALS");
        else if (tabParam === "cycles") setActiveTab("CYCLES");
        else if (tabParam === "appraisals") setActiveTab("APPRAISALS");
        else if (tabParam === "feedback") setActiveTab("FEEDBACK");
    }, [tabParam]);

    const { data: ref } = useHrReference();
    const mockGoals: any[] = ref?.goals ?? [];
    const mockReviewCycles: any[] = ref?.reviewCycles ?? [];

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
                title="Performance & Talent Development"
                subtitle="Track employee goal achievements, review cycles, manager feedback, and performance ratings."
                action={
                    <button onClick={() => setNewOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2">
                        <Plus size={15} /> Start Review
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Reviews" value={reviews.length} icon={Target} tone="primary" hint="Active review cycles" />
                <StatCard label="Completed Reviews" value={completedCount} icon={CheckCircle2} tone="emerald" hint="Cycles finalized" />
                <StatCard label="In Progress" value={inProgressCount} icon={TrendingUp} tone="blue" hint="Manager/Self review phase" />
                <StatCard label="Average Rating" value={avgRating !== "—" ? `${avgRating} / 5.0` : "—"} icon={Star} tone="amber" hint="Organization performance avg" />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
                {(
                    [
                        { id: "DASHBOARD", label: "Review Dashboard" },
                        { id: "GOALS", label: `Goals & OKRs (${mockGoals.length})` },
                        { id: "CYCLES", label: `Review Cycles (${mockReviewCycles.length})` },
                        { id: "APPRAISALS", label: "Staff Appraisals" },
                        { id: "FEEDBACK", label: "360 Feedback & Recognition" },
                    ] as const
                ).map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                            activeTab === t.id
                                ? "bg-primary text-white shadow-xs"
                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: DASHBOARD (Existing Preserved) */}
            {activeTab === "DASHBOARD" && (
                <div className="space-y-6">
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
                                        {Array.from(new Set(reviews.map((r) => r.reviewCycle).concat(cycle !== "ALL" ? [cycle] : []))).map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="relative w-full md:w-64">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Search employee or department..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <SectionCard key={i}>
                                    <SkeletonPulse className="h-40 w-full" />
                                </SectionCard>
                            ))
                        ) : reviews.length === 0 ? (
                            <div className="col-span-2">
                                <EmptyState icon={AlertCircle} message="No performance reviews found for the selected criteria." />
                            </div>
                        ) : (
                            reviews.map((r) => (
                                <SectionCard key={r.id}>
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="font-bold text-neutral-900 text-sm">{r.employeeName}</h4>
                                                <p className="text-xs text-neutral-500">{r.department} • Cycle: {r.reviewCycle}</p>
                                            </div>
                                            <Badge value={r.status} />
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Key Goals</p>
                                            {r.goals.map((g) => (
                                                <div key={g.id} className="space-y-1">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-medium text-neutral-700 truncate">{g.title}</span>
                                                        <span className="font-bold text-primary">{g.progress}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${g.progress}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                                                <Award size={15} className="text-amber-500" />
                                                <span>Rating: {r.rating ? `${r.rating} / 5.0` : "Pending Rating"}</span>
                                            </div>
                                            {r.promotionRecommended && (
                                                <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                                                    Promotion Recommended
                                                </span>
                                            )}
                                            {r.status !== "COMPLETED" && (
                                                <button onClick={() => setReviewing(r)} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary hover:text-white">
                                                    {r.status === "MANAGER_REVIEW" ? "Give manager review" : "Review now"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </SectionCard>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: GOALS / OKRs (Section 25) */}
            {activeTab === "GOALS" && (
                <SectionCard title="Quarterly Strategic Goals & OKRs">
                    <div className="space-y-4">
                        {mockGoals.map((g) => (
                            <div key={g.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-sm text-neutral-900">{g.title}</h4>
                                            <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-neutral-100 text-neutral-700">
                                                {g.type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-500 mt-0.5">{g.description}</p>
                                    </div>
                                    <Badge value={g.status} />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold text-neutral-600">
                                        <span>Target: {g.startDate} to {g.endDate}</span>
                                        <span className="text-primary font-bold">{g.progress}% Complete</span>
                                    </div>
                                    <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${g.progress}%` }} />
                                    </div>
                                </div>

                                <div className="text-[11px] text-neutral-400 pt-1 flex items-center justify-between border-t border-neutral-100">
                                    <span>Owner: <strong className="text-neutral-700">{g.ownerName}</strong> ({g.department})</span>
                                    <span>Weightage: {g.weight}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* TAB 3: REVIEW CYCLES (Section 26) */}
            {activeTab === "CYCLES" && (
                <SectionCard title="Configured Review Cycles">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {mockReviewCycles.map((rc) => (
                            <div key={rc.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                                <div className="flex items-start justify-between">
                                    <h4 className="font-bold text-sm text-neutral-900">{rc.title}</h4>
                                    <Badge value={rc.status} />
                                </div>
                                <div className="text-xs text-neutral-600 space-y-1">
                                    <p>• Period: {rc.period}</p>
                                    <p>• Submission Deadline: {rc.deadline}</p>
                                    <p>• Participants: {rc.participantsCount} Staff</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* TAB 4: APPRAISALS (Section 27) */}
            {activeTab === "APPRAISALS" && (
                <SectionCard title="Appraisal Ratings & Increment Proposals">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Department</th>
                                    <th className="py-3 px-2">Performance Score</th>
                                    <th className="py-3 px-2">Increment Recommendation</th>
                                    <th className="py-3 px-2">Promotion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {reviews.map((r) => (
                                    <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3 px-2 font-bold text-neutral-900">{r.employeeName}</td>
                                        <td className="py-3 px-2 text-neutral-600">{r.department}</td>
                                        <td className="py-3 px-2 font-bold text-amber-700">
                                            {r.rating ? `⭐ ${r.rating} / 5.0` : "Pending Assessment"}
                                        </td>
                                        <td className="py-3 px-2 font-bold text-emerald-700">
                                            {r.incrementPercent ? `+${r.incrementPercent}%` : "—"}
                                        </td>
                                        <td className="py-3 px-2">
                                            {r.promotionRecommended ? (
                                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-xs">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="text-neutral-400 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* TAB 5: FEEDBACK (Section 28) */}
            {activeTab === "FEEDBACK" && (
                <SectionCard title="360 Peer Feedback & Recognition">
                    <div className="space-y-3">
                        <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-neutral-900">Rahul Sharma ➔ Neha Kulkarni</span>
                                <span className="px-2 py-0.5 rounded bg-pink-100 text-pink-700 font-bold text-[10px] flex items-center gap-1">
                                    <Heart size={10} /> Spot Recognition
                                </span>
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed">
                                &quot;Incredible turnaround closing the Lead DevOps mandate in 5 days. High energy and great candidate briefing!&quot;
                            </p>
                            <span className="text-[10px] text-neutral-400 block">Submitted 3 days ago</span>
                        </div>
                    </div>
                </SectionCard>
            )}

            <ModalShell open={newOpen} onClose={() => setNewOpen(false)} title="Start Performance Review">
                <form
                    className="space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        act.mutate({ method: "POST", body: { employeeId: newForm.employeeId, reviewCycle: newForm.reviewCycle, goals: newForm.goals.split("\n").map((g) => g.trim()).filter(Boolean) } });
                    }}
                >
                    <select required value={newForm.employeeId} onChange={(e) => setNewForm({ ...newForm, employeeId: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm">
                        <option value="">Select employee</option>
                        {employeeOptions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.department}</option>)}
                    </select>
                    <input required placeholder="Review cycle (e.g. 2026-H2)" value={newForm.reviewCycle} onChange={(e) => setNewForm({ ...newForm, reviewCycle: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm" />
                    <textarea required rows={4} placeholder={"Goals — one per line"} value={newForm.goals} onChange={(e) => setNewForm({ ...newForm, goals: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm" />
                    <button disabled={act.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Start Review</button>
                </form>
            </ModalShell>

            <ManagerReviewModal review={reviewing} onClose={() => setReviewing(null)} pending={act.isPending} onSubmit={(body) => act.mutate({ method: "PATCH", body })} />
        </div>
    );
}

export default function HRPerformancePage() {
    return (
        <Suspense fallback={<SkeletonPulse className="h-96 w-full" />}>
            <PerformanceContent />
        </Suspense>
    );
}
