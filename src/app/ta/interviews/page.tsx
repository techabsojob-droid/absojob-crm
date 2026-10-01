"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    CalendarClock, Video, Phone, MapPin, Plus, CheckCircle2,
    XCircle, Clock, Search, Filter, AlertTriangle, ShieldAlert,
    ExternalLink, Calendar, Check, X, User, Briefcase, Building2,
    Download, RefreshCw, Send, Star, ArrowRight, Eye, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";

const ROUNDS = [
    { id: "SCREENING_CALL", label: "Initial Screening" },
    { id: "TECH_1", label: "Technical Round 1" },
    { id: "TECH_2", label: "Technical Round 2" },
    { id: "CLIENT_ROUND", label: "Client Round" },
    { id: "HR_ROUND", label: "HR / Culture Fit" },
    { id: "FINAL", label: "Final / Leadership" },
] as const;

export default function TaInterviewsPage() {
    const qc = useQueryClient();

    // Tab & Filter states
    const [activeTab, setActiveTab] = useState<"today" | "upcoming" | "pending_feedback" | "conflicts" | "completed" | "all">("upcoming");
    const [searchQuery, setSearchQuery] = useState("");
    const [roundFilter, setRoundFilter] = useState("ALL");
    const [modeFilter, setModeFilter] = useState("ALL");

    // Modals
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [selectedInterview, setSelectedInterview] = useState<any>(null);

    // Schedule form
    const [scheduleForm, setScheduleForm] = useState({
        applicationId: "",
        round: "SCREENING_CALL",
        mode: "VIDEO",
        scheduledAt: "",
        durationMins: "45",
        interviewerName: "Client Engineering Panel",
        interviewerUserId: "",
        meetingLink: "",
    });
    const { data: staff } = useQuery<{ users: { id: string; name: string; designation: string | null }[] }>({
        queryKey: ["staff-members"],
        queryFn: async () => (await fetch("/api/admin/team-members?scope=staff")).json(),
    });

    // Feedback Scorecard form
    const [feedbackForm, setFeedbackForm] = useState({
        outcome: "HIRE" as "STRONG_HIRE" | "HIRE" | "MAYBE" | "NO_HIRE",
        score: "8",
        techRating: "8",
        commRating: "8",
        feedback: "",
    });

    // Reschedule form
    const [rescheduleForm, setRescheduleForm] = useState({
        scheduledAt: "",
        reason: "",
    });

    // Fetch Interviews
    const { data: interviews, isLoading } = useQuery({
        queryKey: ["ta-interviews-all"],
        queryFn: async () => {
            const res = await fetch("/api/ta/interviews");
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to fetch interviews");
            return res.json();
        },
        refetchInterval: 20000,
    });

    // Fetch Active Pipeline Applications for Scheduling
    const { data: pipelineApps } = useQuery({
        queryKey: ["pipeline-schedule-candidates"],
        queryFn: async () => {
            const res = await fetch("/api/ta/applications");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Schedule Mutation
    const scheduleMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/ta/interviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...scheduleForm,
                    durationMins: Number(scheduleForm.durationMins),
                    meetingLink: scheduleForm.meetingLink.trim() || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to schedule interview");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Interview scheduled & meeting link generated! 📅");
            setScheduleOpen(false);
            setScheduleForm({
                applicationId: "",
                round: "SCREENING_CALL",
                mode: "VIDEO",
                scheduledAt: "",
                durationMins: "45",
                interviewerName: "Client Engineering Panel",
                interviewerUserId: "",
                meetingLink: "",
            });
            qc.invalidateQueries({ queryKey: ["ta-interviews-all"] });
            qc.invalidateQueries({ queryKey: ["pipeline"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Feedback Mutation
    const feedbackMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/ta/interviews", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedInterview.id,
                    status: "COMPLETED",
                    outcome: feedbackForm.outcome,
                    score: Number(feedbackForm.score),
                    feedback: `[Tech: ${feedbackForm.techRating}/10, Comm: ${feedbackForm.commRating}/10] ${feedbackForm.feedback}`,
                }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to save feedback");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Scorecard feedback recorded successfully! 🎯");
            setFeedbackOpen(false);
            setSelectedInterview(null);
            qc.invalidateQueries({ queryKey: ["ta-interviews-all"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Reschedule Mutation
    const rescheduleMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/ta/interviews", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedInterview.id,
                    status: "RESCHEDULED",
                    scheduledAt: rescheduleForm.scheduledAt,
                }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to reschedule");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Interview rescheduled and participants updated! 🔄");
            setRescheduleOpen(false);
            setSelectedInterview(null);
            qc.invalidateQueries({ queryKey: ["ta-interviews-all"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Mark Cancelled
    const cancelMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/ta/interviews", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: "CANCELLED" }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to cancel interview");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Interview cancelled.");
            qc.invalidateQueries({ queryKey: ["ta-interviews-all"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const allList = Array.isArray(interviews) ? interviews : [];
    const activePipeline = Array.isArray(pipelineApps)
        ? pipelineApps.filter((a: any) => !["JOINED", "REJECTED", "BACKED_OUT"].includes(a.stage))
        : [];

    // Conflict Detection during Scheduling
    const scheduleConflict = useMemo(() => {
        if (!scheduleForm.scheduledAt || !scheduleForm.interviewerName) return null;
        const targetTime = new Date(scheduleForm.scheduledAt).getTime();
        const durationMs = (parseInt(scheduleForm.durationMins) || 45) * 60 * 1000;

        return allList.find((i: any) => {
            if (i.status === "CANCELLED" || i.status === "COMPLETED") return false;
            if (i.interviewerName?.toLowerCase() !== scheduleForm.interviewerName.toLowerCase()) return false;
            const existingTime = new Date(i.scheduledAt).getTime();
            const existingDuration = (i.durationMins || 45) * 60 * 1000;
            // Overlap check
            return targetTime < existingTime + existingDuration && targetTime + durationMs > existingTime;
        });
    }, [scheduleForm.scheduledAt, scheduleForm.interviewerName, scheduleForm.durationMins, allList]);

    // KPI Metrics
    const metrics = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfToday = startOfToday + 86400000;

        const today = allList.filter((i: any) => {
            const t = new Date(i.scheduledAt).getTime();
            return t >= startOfToday && t < endOfToday && !["CANCELLED"].includes(i.status);
        }).length;

        const upcoming = allList.filter((i: any) => {
            const t = new Date(i.scheduledAt).getTime();
            return t >= now.getTime() && ["SCHEDULED", "RESCHEDULED"].includes(i.status);
        }).length;

        const pendingFeedback = allList.filter((i: any) => {
            const t = new Date(i.scheduledAt).getTime();
            return t < now.getTime() && i.status === "SCHEDULED" && !i.score;
        }).length;

        const completed = allList.filter((i: any) => i.status === "COMPLETED").length;
        const conflictsRescheduled = allList.filter((i: any) => i.status === "RESCHEDULED").length;

        return { today, upcoming, pendingFeedback, completed, conflictsRescheduled };
    }, [allList]);

    // Filtered by Active Tab & Search
    const filteredList = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfToday = startOfToday + 86400000;

        let list = [...allList];

        if (activeTab === "today") {
            list = list.filter((i) => {
                const t = new Date(i.scheduledAt).getTime();
                return t >= startOfToday && t < endOfToday;
            });
        } else if (activeTab === "upcoming") {
            list = list.filter((i) => ["SCHEDULED", "RESCHEDULED"].includes(i.status) && new Date(i.scheduledAt).getTime() >= now.getTime());
        } else if (activeTab === "pending_feedback") {
            list = list.filter((i) => new Date(i.scheduledAt).getTime() < now.getTime() && i.status === "SCHEDULED" && !i.score);
        } else if (activeTab === "conflicts") {
            list = list.filter((i) => i.status === "RESCHEDULED");
        } else if (activeTab === "completed") {
            list = list.filter((i) => ["COMPLETED", "NO_SHOW"].includes(i.status));
        }

        if (roundFilter !== "ALL") {
            list = list.filter((i) => i.round === roundFilter);
        }

        if (modeFilter !== "ALL") {
            list = list.filter((i) => i.mode === modeFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (i) =>
                    i.candidateName?.toLowerCase().includes(q) ||
                    i.jobTitle?.toLowerCase().includes(q) ||
                    i.interviewerName?.toLowerCase().includes(q) ||
                    i.clientName?.toLowerCase().includes(q)
            );
        }

        return list;
    }, [allList, activeTab, roundFilter, modeFilter, searchQuery]);

    // Export CSV
    const exportCsv = () => {
        if (filteredList.length === 0) {
            toast.error("No interviews to export");
            return;
        }

        const headers = ["Interview ID", "Candidate", "Requisition", "Client", "Round", "Interviewer", "Date & Time", "Mode", "Status", "Score", "Feedback"];
        const rows = filteredList.map((i) => [
            i.id,
            `"${i.candidateName?.replace(/"/g, '""')}"`,
            `"${i.jobTitle?.replace(/"/g, '""')}"`,
            `"${i.clientName || ""}"`,
            i.round,
            `"${i.interviewerName?.replace(/"/g, '""')}"`,
            new Date(i.scheduledAt).toLocaleString("en-IN"),
            i.mode,
            i.status,
            i.score || "",
            `"${(i.feedback || "")?.replace(/"/g, '""')}"`,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `AbsoJob_Interviews_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${filteredList.length} interviews to CSV.`);
    };

    return (
        <div className="space-y-6 pb-16 max-w-[1700px] mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Evaluations
                        </span>
                        <span className="text-xs text-neutral-400 font-bold">Interview Operations Center</span>
                    </div>
                    <h1 className="text-2xl font-black text-neutral-900 mt-0.5">Interviews</h1>
                    <p className="text-xs text-neutral-500 font-medium">
                        Schedule rounds, track scorecard feedback, resolve calendar conflicts, and monitor interview SLAs.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={exportCsv}
                        className="px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                        <Download size={14} /> Export
                    </button>
                    <button
                        onClick={() => setScheduleOpen(true)}
                        className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all hover:scale-[1.02]"
                    >
                        <Plus size={15} /> + Schedule Interview
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard
                    label="Scheduled Today"
                    value={metrics.today}
                    icon={CalendarClock}
                    tone="blue"
                    hint="Happening today"
                />
                <StatCard
                    label="Upcoming Rounds"
                    value={metrics.upcoming}
                    icon={Calendar}
                    tone="primary"
                    hint="Future evaluations"
                />
                <StatCard
                    label="Feedback Pending"
                    value={metrics.pendingFeedback}
                    icon={Clock}
                    tone={metrics.pendingFeedback > 3 ? "red" : "amber"}
                    hint="Scorecard overdue"
                />
                <StatCard
                    label="Completed Rounds"
                    value={metrics.completed}
                    icon={CheckCircle2}
                    tone="emerald"
                    hint="Evaluated & scored"
                />
                <StatCard
                    label="Rescheduled"
                    value={metrics.conflictsRescheduled}
                    icon={AlertTriangle}
                    tone="purple"
                    hint="Time modifications"
                />
            </div>

            {/* Filter Bar & Tabs */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search candidate, job, interviewer, client…"
                            className="w-full pl-9 pr-8 py-2 bg-neutral-50/80 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white focus:border-primary outline-none transition-all placeholder:text-neutral-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Round */}
                        <select
                            value={roundFilter}
                            onChange={(e) => setRoundFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer"
                        >
                            <option value="ALL">All Rounds</option>
                            {ROUNDS.map((r) => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>

                        {/* Mode */}
                        <select
                            value={modeFilter}
                            onChange={(e) => setModeFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer"
                        >
                            <option value="ALL">All Modes</option>
                            <option value="VIDEO">Video Call</option>
                            <option value="PHONE">Phone Screen</option>
                            <option value="IN_PERSON">In-Office</option>
                        </select>
                    </div>
                </div>

                {/* View Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-neutral-100">
                    {[
                        { id: "today", label: `Today (${metrics.today})` },
                        { id: "upcoming", label: `Upcoming (${metrics.upcoming})` },
                        { id: "pending_feedback", label: `Pending Feedback (${metrics.pendingFeedback})` },
                        { id: "conflicts", label: `Rescheduled (${metrics.conflictsRescheduled})` },
                        { id: "completed", label: `Completed (${metrics.completed})` },
                        { id: "all", label: `All (${allList.length})` },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${activeTab === t.id
                                ? "bg-primary text-white shadow-xs"
                                : "bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 text-neutral-600"
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Interview Cards List */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-neutral-100" />
                    ))}
                </div>
            ) : filteredList.length === 0 ? (
                <SectionCard>
                    <EmptyState
                        icon={CalendarClock}
                        message="No interviews found in this view."
                        action={
                            <button
                                onClick={() => setScheduleOpen(true)}
                                className="mt-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
                            >
                                Schedule Round
                            </button>
                        }
                    />
                </SectionCard>
            ) : (
                <div className="space-y-3">
                    {filteredList.map((inv: any) => {
                        const dt = new Date(inv.scheduledAt);
                        const isPast = dt.getTime() < Date.now();
                        const isPendingFeedback = isPast && inv.status === "SCHEDULED" && !inv.score;

                        return (
                            <div
                                key={inv.id}
                                className={`bg-white p-5 rounded-2xl border transition-all ${isPendingFeedback
                                    ? "border-amber-300 bg-amber-50/20"
                                    : "border-neutral-200/80 hover:border-neutral-300 shadow-xs"
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    {/* Left: Date & Time Box */}
                                    <div className="flex items-start gap-4">
                                        <div className="text-center px-3.5 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 shrink-0">
                                            <p className="text-[10px] font-black uppercase text-primary tracking-wider">
                                                {dt.toLocaleDateString("en-IN", { month: "short" })}
                                            </p>
                                            <p className="text-xl font-black text-neutral-900 leading-none my-0.5">
                                                {dt.getDate()}
                                            </p>
                                            <p className="text-[10px] font-semibold text-neutral-400">
                                                {dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                            </p>
                                        </div>

                                        {/* Middle Details */}
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-neutral-900 text-sm">{inv.candidateName}</h3>
                                                <span className="text-neutral-300">·</span>
                                                <span className="font-semibold text-neutral-600 text-xs">{inv.jobTitle}</span>
                                                <Badge value={inv.status} />
                                                <span className="px-2 py-0.5 bg-primary/10 text-primary font-bold rounded text-[10px]">
                                                    {inv.round.replace(/_/g, " ")}
                                                </span>
                                            </div>

                                            <p className="text-xs text-neutral-500 flex items-center gap-3 flex-wrap">
                                                <span className="font-bold text-primary flex items-center gap-1">
                                                    <Building2 size={12} /> {inv.clientName || "Direct"}
                                                </span>
                                                <span>·</span>
                                                <span className="flex items-center gap-1 font-medium text-neutral-600">
                                                    <User size={12} /> Panel: <strong>{inv.interviewerName || "Client Team"}</strong>
                                                </span>
                                                <span>·</span>
                                                <span className="flex items-center gap-1 text-neutral-500">
                                                    <Clock size={12} /> {inv.durationMins || 45} mins ({inv.mode})
                                                </span>
                                            </p>

                                            {/* Meeting Link */}
                                            {inv.meetingLink && inv.status !== "CANCELLED" && (
                                                <div className="pt-1">
                                                    <a
                                                        href={inv.meetingLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                                                    >
                                                        <Video size={12} /> Join Google Meet <ExternalLink size={10} />
                                                    </a>
                                                </div>
                                            )}

                                            {/* Scorecard Feedback Summary */}
                                            {inv.score && (
                                                <div className="mt-2 p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 text-xs space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-neutral-800">Recommendation:</span>
                                                        <span className="font-black text-primary">{inv.outcome?.replace(/_/g, " ")}</span>
                                                        <span className="text-neutral-400">·</span>
                                                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                            Score: {inv.score}/10
                                                        </span>
                                                    </div>
                                                    {inv.feedback && (
                                                        <p className="text-neutral-600 text-[11px] italic">"{inv.feedback}"</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Actions */}
                                    <div className="flex items-center gap-2 self-start">
                                        {/* Submit Feedback if pending */}
                                        {inv.status !== "COMPLETED" && inv.status !== "CANCELLED" && (
                                            <button
                                                onClick={() => {
                                                    setSelectedInterview(inv);
                                                    setFeedbackOpen(true);
                                                }}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                                            >
                                                <CheckCircle2 size={13} /> Record Feedback
                                            </button>
                                        )}

                                        {/* Reschedule */}
                                        {inv.status !== "COMPLETED" && inv.status !== "CANCELLED" && (
                                            <button
                                                onClick={() => {
                                                    setSelectedInterview(inv);
                                                    setRescheduleOpen(true);
                                                }}
                                                className="px-3 py-1.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl text-xs font-bold transition-colors"
                                            >
                                                Reschedule
                                            </button>
                                        )}

                                        {/* Cancel Interview */}
                                        {inv.status !== "COMPLETED" && inv.status !== "CANCELLED" && (
                                            <button
                                                onClick={() => cancelMutation.mutate(inv.id)}
                                                disabled={cancelMutation.isPending}
                                                className="p-1.5 border border-neutral-200 hover:bg-red-50 hover:border-red-200 text-neutral-400 hover:text-red-600 rounded-xl transition-colors"
                                                title="Cancel interview"
                                            >
                                                <X size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Schedule Interview with Live Conflict Check */}
            {scheduleOpen && (
                <ModalShell
                    title="Schedule Evaluation Round"
                    onClose={() => setScheduleOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!scheduleForm.applicationId || !scheduleForm.scheduledAt) {
                                toast.error("Please fill candidate and scheduled date/time");
                                return;
                            }
                            scheduleMutation.mutate();
                        }}
                        className="space-y-4"
                    >
                        {/* Conflict Warning Banner */}
                        {scheduleConflict && (
                            <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <ShieldAlert size={15} className="text-red-600" />
                                    <span>Scheduling Conflict Detected!</span>
                                </div>
                                <p>
                                    Interviewer <strong>{scheduleForm.interviewerName}</strong> is already booked for another interview ({scheduleConflict.candidateName} · {new Date(scheduleConflict.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}).
                                </p>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Select Candidate & Requisition *</label>
                            <select
                                required
                                value={scheduleForm.applicationId}
                                onChange={(e) => setScheduleForm({ ...scheduleForm, applicationId: e.target.value })}
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            >
                                <option value="">Select Candidate in Pipeline</option>
                                {activePipeline.map((a: any) => (
                                    <option key={a.id} value={a.id}>
                                        {a.candidateName} — {a.jobTitle} ({a.stage})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Interview Round *</label>
                                <select
                                    value={scheduleForm.round}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, round: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    {ROUNDS.map((r) => (
                                        <option key={r.id} value={r.id}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Evaluation Mode</label>
                                <select
                                    value={scheduleForm.mode}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, mode: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    <option value="VIDEO">Google Meet (Video)</option>
                                    <option value="PHONE">Phone Screen</option>
                                    <option value="IN_PERSON">In-Office Round</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Date & Time *</label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={scheduleForm.scheduledAt}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Duration (Minutes)</label>
                                <select
                                    value={scheduleForm.durationMins}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, durationMins: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    <option value="30">30 Minutes</option>
                                    <option value="45">45 Minutes</option>
                                    <option value="60">60 Minutes</option>
                                    <option value="90">90 Minutes</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Internal interviewer (gets notified &amp; submits feedback)</label>
                            <select
                                value={scheduleForm.interviewerUserId}
                                onChange={(e) => {
                                    const u = staff?.users.find((x) => x.id === e.target.value);
                                    setScheduleForm({ ...scheduleForm, interviewerUserId: e.target.value, interviewerName: u ? u.name : scheduleForm.interviewerName });
                                }}
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                            >
                                <option value="">None — external / client panel</option>
                                {(staff?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}{u.designation ? ` · ${u.designation}` : ""}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Interviewer Panel / Name</label>
                            <input
                                type="text"
                                value={scheduleForm.interviewerName}
                                onChange={(e) => setScheduleForm({ ...scheduleForm, interviewerName: e.target.value })}
                                placeholder="e.g. Anand Sharma (VP Engineering)"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Custom Meeting Link (Optional)</label>
                            <input
                                type="url"
                                value={scheduleForm.meetingLink}
                                onChange={(e) => setScheduleForm({ ...scheduleForm, meetingLink: e.target.value })}
                                placeholder="Auto-generates Google Meet if left blank"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setScheduleOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={scheduleMutation.isPending}
                                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                            >
                                {scheduleMutation.isPending ? "Scheduling…" : "Confirm & Schedule"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* Modal: Scorecard & Feedback */}
            {feedbackOpen && selectedInterview && (
                <ModalShell
                    title="Interview Scorecard & Feedback"
                    onClose={() => setFeedbackOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            feedbackMutation.mutate();
                        }}
                        className="space-y-4"
                    >
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Overall Hiring Recommendation *</label>
                            <select
                                value={feedbackForm.outcome}
                                onChange={(e) => setFeedbackForm({ ...feedbackForm, outcome: e.target.value as any })}
                                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-bold"
                            >
                                <option value="STRONG_HIRE">Strong Hire (High Priority Advance)</option>
                                <option value="HIRE">Hire (Meets Criteria)</option>
                                <option value="MAYBE">Maybe / Hold (Secondary Evaluation)</option>
                                <option value="NO_HIRE">No Hire (Reject from pipeline)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Technical (1-10)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={feedbackForm.techRating}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, techRating: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Communication</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={feedbackForm.commRating}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, commRating: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Overall Score</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={feedbackForm.score}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, score: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-primary"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Evaluator Notes & Observations</label>
                            <textarea
                                rows={4}
                                required
                                value={feedbackForm.feedback}
                                onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                                placeholder="Candidate strengths, coding challenge performance, red flags…"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setFeedbackOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={feedbackMutation.isPending}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
                            >
                                {feedbackMutation.isPending ? "Submitting…" : "Submit Scorecard"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* Modal: Reschedule */}
            {rescheduleOpen && selectedInterview && (
                <ModalShell
                    title="Reschedule Interview"
                    onClose={() => setRescheduleOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!rescheduleForm.scheduledAt) {
                                toast.error("Please select a new date and time");
                                return;
                            }
                            rescheduleMutation.mutate();
                        }}
                        className="space-y-4"
                    >
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">New Scheduled Date & Time *</label>
                            <input
                                type="datetime-local"
                                required
                                value={rescheduleForm.scheduledAt}
                                onChange={(e) => setRescheduleForm({ ...rescheduleForm, scheduledAt: e.target.value })}
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Reason for Rescheduling</label>
                            <textarea
                                rows={2}
                                value={rescheduleForm.reason}
                                onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                                placeholder="Candidate request / panel availability conflict…"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setRescheduleOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={rescheduleMutation.isPending}
                                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
                            >
                                {rescheduleMutation.isPending ? "Rescheduling…" : "Confirm Reschedule"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
