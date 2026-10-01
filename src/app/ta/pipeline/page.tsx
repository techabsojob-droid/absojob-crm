"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    GitBranch, ChevronLeft, ChevronRight, UserPlus, Sparkles,
    Search, Filter, Download, Plus, LayoutGrid, Table as TableIcon,
    Calendar, Clock, CheckCircle2, AlertTriangle, ArrowRight,
    MapPin, IndianRupee, Users, Building2, Eye, X, Phone, Mail,
    Briefcase, FileText, Check, SlidersHorizontal, GripVertical
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell, StatCard } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { canTransition, type ApplicationStage } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

const STAGES = [
    "SOURCED",
    "SCREENING",
    "INTERVIEW_SCHEDULED",
    "TECH_ROUND",
    "CLIENT_ROUND",
    "HR_ROUND",
    "OFFER_SENT",
    "OFFER_ACCEPTED",
    "ONBOARDING",
] as const;

// Kanban columns: the main flow plus a parking column for candidates on hold
const COLUMNS = [...STAGES, "ON_HOLD"] as const;

const can = (from: string, to: string) => canTransition(from as ApplicationStage, to as ApplicationStage);

export default function TaPipelinePage() {
    const qc = useQueryClient();

    // Views & Filters
    const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
    const [searchQuery, setSearchQuery] = useState("");
    const [jobFilter, setJobFilter] = useState("ALL");
    const [stageFilter, setStageFilter] = useState("ALL");
    const [agingFilter, setAgingFilter] = useState("ALL");
    const [mineOnly, setMineOnly] = useState(false);

    // Drag and Drop State for Real Kanban Board
    const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
    const [activeDropStage, setActiveDropStage] = useState<string | null>(null);

    // Modals & Drawers
    const [previewApp, setPreviewApp] = useState<any>(null);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkTargetStage, setBulkTargetStage] = useState<string>("SCREENING");
    const [reasonAction, setReasonAction] = useState<{ app: any; stage: "REJECTED" | "ON_HOLD" } | null>(null);
    const [offerFor, setOfferFor] = useState<any>(null);
    const [offerForm, setOfferForm] = useState({ offeredCtcLpa: "", joiningDate: "", expiryDate: "" });
    const { user } = useAuth();
    const isManager = user?.role === "SUPER_ADMIN" || user?.role === "TA_MANAGER";
    const { data: teamMembers } = useQuery<{ users: { id: string; name: string }[] }>({
        queryKey: ["team-members"],
        queryFn: () => api("/api/admin/team-members"),
        enabled: isManager,
    });
    const [reasonText, setReasonText] = useState("");

    // Add Candidate form
    const [addForm, setAddForm] = useState({
        candidateId: "",
        jobId: "",
        screeningNotes: "",
        fitScore: "85",
    });

    // Fetch applications
    const { data: apps, isLoading } = useQuery({
        queryKey: ["pipeline", mineOnly],
        queryFn: async () => {
            const res = await fetch(`/api/ta/applications${mineOnly ? "?mine=1" : ""}`);
            if (!res.ok) throw new Error("Failed to fetch pipeline");
            return res.json();
        },
        refetchInterval: 20000,
    });

    // Fetch jobs for filter & add candidate
    const { data: jobs } = useQuery({
        queryKey: ["ta-jobs-filter"],
        queryFn: async () => {
            const res = await fetch("/api/admin/jobs");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Fetch all candidates for the Add Modal
    const { data: allCandidates } = useQuery({
        queryKey: ["admin-candidates-pool"],
        queryFn: async () => {
            const res = await fetch("/api/admin/candidates");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Mutations
    const moveMutation = useMutation({
        mutationFn: async ({ id, stage, rejectionReason, holdReason }: { id: string; stage: string; rejectionReason?: string; holdReason?: string }) => {
            const res = await fetch("/api/ta/applications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, stage, rejectionReason, holdReason }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not move candidate");
            return res.json();
        },
        onSuccess: (updated, vars) => {
            toast.success(`Candidate moved to ${vars.stage.replace(/_/g, " ")}`);
            setPreviewApp((p: any) => (p && p.id === updated.id ? { ...p, ...updated } : p));
            setReasonAction(null);
            setReasonText("");
            qc.invalidateQueries({ queryKey: ["pipeline"] });
            qc.invalidateQueries({ queryKey: ["ta-dashboard"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const bulkMoveMutation = useMutation({
        mutationFn: async ({ ids, stage }: { ids: string[]; stage: string }) => {
            const results = await Promise.all(
                ids.map((id) =>
                    fetch("/api/ta/applications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id, stage }),
                    }).then(async (res) => (res.ok ? null : (await res.json().catch(() => ({}))).error || "Failed"))
                )
            );
            return { moved: results.filter((r) => r === null).length, errors: results.filter((r): r is string => r !== null) };
        },
        onSuccess: ({ moved, errors }) => {
            if (moved > 0) toast.success(`Moved ${moved} candidate(s) to ${bulkTargetStage.replace(/_/g, " ")}`);
            if (errors.length > 0) toast.error(`${errors.length} could not be moved: ${errors[0]}`);
            setSelectedIds([]);
            setBulkMoveModalOpen(false);
            qc.invalidateQueries({ queryKey: ["pipeline"] });
        },
        onError: () => toast.error("Failed to move candidates"),
    });

    const addCandidateMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/ta/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to add candidate");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Candidate added to pipeline (SOURCED)!");
            setAddModalOpen(false);
            setAddForm({ candidateId: "", jobId: "", screeningNotes: "", fitScore: "85" });
            qc.invalidateQueries({ queryKey: ["pipeline"] });
            qc.invalidateQueries({ queryKey: ["ta-dashboard"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    // Offer: release (→ OFFER_SENT) and record the candidate's response
    const offerMutation = useMutation({
        mutationFn: (args: { candidateId: string; body: Record<string, unknown> }) => api(`/api/admin/candidates/${args.candidateId}`, "PATCH", args.body),
        onSuccess: (_d, args) => {
            const r = (args.body.offerResponse as { response?: string } | undefined)?.response;
            toast.success(args.body.newOffer ? "Offer released — candidate moved to OFFER SENT" : r === "ACCEPTED" ? "Offer accepted — you can start onboarding" : r === "DECLINED" ? "Offer declined — candidate marked backed out" : "Offer updated");
            setOfferFor(null);
            setOfferForm({ offeredCtcLpa: "", joiningDate: "", expiryDate: "" });
            qc.invalidateQueries({ queryKey: ["pipeline"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const respondToOffer = (a: any, response: "ACCEPTED" | "DECLINED") => {
        if (!a.openOfferId) {
            // Older applications without an offer record
            if (response === "ACCEPTED") moveMutation.mutate({ id: a.id, stage: "OFFER_ACCEPTED" });
            else setReasonAction({ app: a, stage: "REJECTED" });
            return;
        }
        const reason = response === "DECLINED" ? window.prompt("Why did the candidate decline?") : "";
        if (response === "DECLINED" && !reason) return;
        offerMutation.mutate({ candidateId: a.candidateId, body: { offerResponse: { offerId: a.openOfferId, response, reason } } });
    };
    const openOffer = (a: any) => {
        setOfferFor(a);
        setOfferForm({ offeredCtcLpa: String(a.expectedCtcLpa || ""), joiningDate: "", expiryDate: "" });
    };

    const startOnboardingMutation = useMutation({
        mutationFn: async (app: any) => {
            const res = await fetch("/api/hr/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidateId: app.candidateId,
                    jobId: app.jobId,
                    applicationId: app.id,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to start onboarding");
            }
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["pipeline"] });
            toast.success("Candidate transferred to HRMIS Onboarding!");
        },
        onError: (err: any) => {
            toast.error(err.message || "Could not start onboarding");
        },
    });

    const rawList = Array.isArray(apps) ? apps.filter((a: any) => !["JOINED", "REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)) : [];
    const jobList = Array.isArray(jobs) ? jobs : [];
    const candidatePool = Array.isArray(allCandidates) ? allCandidates : [];

    // Filtered Applications
    const filteredApps = useMemo(() => {
        let list = [...rawList];

        if (jobFilter !== "ALL") {
            list = list.filter((a) => a.jobId === jobFilter);
        }

        if (stageFilter !== "ALL") {
            list = list.filter((a) => a.stage === stageFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (a) =>
                    a.candidateName?.toLowerCase().includes(q) ||
                    a.jobTitle?.toLowerCase().includes(q) ||
                    a.candidateEmail?.toLowerCase().includes(q) ||
                    a.clientName?.toLowerCase().includes(q) ||
                    (a.skills && a.skills.some((s: string) => s.toLowerCase().includes(q)))
            );
        }

        if (agingFilter === "FRESH") {
            list = list.filter((a) => {
                const days = Math.floor((Date.now() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);
                return days <= 3;
            });
        } else if (agingFilter === "AGING") {
            list = list.filter((a) => {
                const days = Math.floor((Date.now() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);
                return days > 3 && days <= 7;
            });
        } else if (agingFilter === "STUCK") {
            list = list.filter((a) => {
                const days = Math.floor((Date.now() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);
                return days > 7;
            });
        }

        return list;
    }, [rawList, jobFilter, stageFilter, searchQuery, agingFilter]);

    // KPI Metrics
    const metrics = useMemo(() => {
        const total = rawList.length;
        const interviewing = rawList.filter((a) => ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND"].includes(a.stage)).length;
        const offers = rawList.filter((a) => ["OFFER_SENT", "OFFER_ACCEPTED"].includes(a.stage)).length;
        const agingStuck = rawList.filter((a) => {
            const days = Math.floor((Date.now() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);
            return days > 7;
        }).length;

        return { total, interviewing, offers, agingStuck };
    }, [rawList]);

    // Export CSV
    const exportCsv = () => {
        const dataToExport = selectedIds.length > 0 ? rawList.filter((a) => selectedIds.includes(a.id)) : filteredApps;
        if (dataToExport.length === 0) {
            toast.error("No candidates to export");
            return;
        }

        const headers = ["Candidate Name", "Job Title", "Client", "Stage", "Fit Score", "Experience (Yrs)", "Expected CTC LPA", "Next Interview", "Status"];
        const rows = dataToExport.map((a) => [
            `"${a.candidateName?.replace(/"/g, '""')}"`,
            `"${a.jobTitle?.replace(/"/g, '""')}"`,
            `"${a.clientName?.replace(/"/g, '""')}"`,
            a.stage,
            `${a.fitScore}%`,
            a.totalExperienceYears,
            a.expectedCtcLpa,
            a.nextInterview ? new Date(a.nextInterview).toLocaleDateString("en-IN") : "None",
            "ACTIVE",
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `AbsoJob_Pipeline_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${dataToExport.length} pipeline candidates to CSV.`);
    };

    return (
        <div className="space-y-6 pb-16 max-w-[1700px] mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Hiring Execution
                        </span>
                        <span className="text-xs text-neutral-400 font-bold">Recruitment Pipeline</span>
                    </div>
                    <h1 className="text-2xl font-black text-neutral-900 mt-0.5">Candidate Pipeline</h1>
                    <p className="text-xs text-neutral-500 font-medium">
                        Track candidate movement across active hiring stages, SLAs, and interview rounds.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={() => exportCsv()}
                        className="px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                        <Download size={14} /> Export
                    </button>
                    <button
                        onClick={() => setAddModalOpen(true)}
                        className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all hover:scale-[1.02]"
                    >
                        <Plus size={15} /> + Add Candidate
                    </button>
                </div>
            </div>

            {/* Pipeline KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    label="Active in Pipeline"
                    value={metrics.total}
                    icon={GitBranch}
                    tone="primary"
                    hint="Candidates currently moving"
                />
                <StatCard
                    label="In Active Interviews"
                    value={metrics.interviewing}
                    icon={Calendar}
                    tone="blue"
                    hint="Tech & Client evaluations"
                />
                <StatCard
                    label="Offers in Flight"
                    value={metrics.offers}
                    icon={CheckCircle2}
                    tone="emerald"
                    hint="Sent or accepted offers"
                />
                <StatCard
                    label="Aging > 7 Days"
                    value={metrics.agingStuck}
                    icon={Clock}
                    tone={metrics.agingStuck > 5 ? "red" : "amber"}
                    hint="Needs recruiter follow-up"
                />
            </div>

            {/* Filter Controls Bar */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search candidate, job, email, skills…"
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
                        {/* Job Filter */}
                        <select
                            value={jobFilter}
                            onChange={(e) => setJobFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer max-w-[200px] truncate"
                        >
                            <option value="ALL">All Requisitions ({rawList.length})</option>
                            {jobList.map((j: any) => (
                                <option key={j.id} value={j.id}>{j.title}</option>
                            ))}
                        </select>

                        {/* Stage Filter */}
                        <select
                            value={stageFilter}
                            onChange={(e) => setStageFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer"
                        >
                            <option value="ALL">All Stages</option>
                            {COLUMNS.map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                            ))}
                        </select>

                        {/* Aging Filter */}
                        <select
                            value={agingFilter}
                            onChange={(e) => setAgingFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer"
                        >
                            <option value="ALL">All Ages</option>
                            <option value="FRESH">Fresh (≤ 3d)</option>
                            <option value="AGING">Aging (4–7d)</option>
                            <option value="STUCK">Stuck (&gt; 7d)</option>
                        </select>

                        {/* Mine only toggle */}
                        <button
                            onClick={() => setMineOnly(!mineOnly)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${mineOnly
                                ? "bg-primary text-white border-primary"
                                : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                                }`}
                        >
                            {mineOnly ? "Showing: My Candidates" : "All Recruiters"}
                        </button>

                        {/* View Switcher */}
                        <div className="flex items-center bg-neutral-100 p-0.5 rounded-xl border border-neutral-200/60">
                            <button
                                onClick={() => setViewMode("kanban")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${viewMode === "kanban" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"}`}
                            >
                                <LayoutGrid size={13} /> Kanban
                            </button>
                            <button
                                onClick={() => setViewMode("table")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${viewMode === "table" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"}`}
                            >
                                <TableIcon size={13} /> Table
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bulk Action Bar (when rows selected) */}
            {selectedIds.length > 0 && (
                <div className="bg-primary/95 text-white px-4 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-lg animate-fade-in">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-black text-xs">
                            {selectedIds.length}
                        </span>
                        <span className="text-xs font-bold">
                            {selectedIds.length} candidate{selectedIds.length > 1 ? "s" : ""} selected
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setBulkMoveModalOpen(true)}
                            className="px-3 py-1.5 bg-white text-primary hover:bg-neutral-50 rounded-xl text-xs font-bold transition-colors"
                        >
                            Move Stage
                        </button>
                        <button
                            onClick={() => exportCsv()}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                            Export Selected
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white"
                            title="Clear selection"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content: Kanban or Table */}
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {STAGES.map((s) => (
                        <SkeletonPulse key={s} className="h-72 rounded-2xl" />
                    ))}
                </div>
            ) : filteredApps.length === 0 ? (
                <SectionCard>
                    <EmptyState
                        icon={GitBranch}
                        message="No candidates found in the pipeline for this filter."
                        action={
                            <button
                                onClick={() => {
                                    setJobFilter("ALL");
                                    setStageFilter("ALL");
                                    setAgingFilter("ALL");
                                    setSearchQuery("");
                                }}
                                className="mt-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
                            >
                                Clear All Filters
                            </button>
                        }
                    />
                </SectionCard>
            ) : viewMode === "kanban" ? (
                /* Real Interactive Drag & Drop Kanban View */
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-10 gap-3 items-start overflow-x-auto pb-4">
                    {COLUMNS.map((stage) => {
                        const stageApps = filteredApps.filter((a: any) => a.stage === stage);
                        const stageIdx = (STAGES as readonly string[]).indexOf(stage);
                        const isColumnOver = activeDropStage === stage;

                        return (
                            <div
                                key={stage}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                    if (activeDropStage !== stage) setActiveDropStage(stage);
                                }}
                                onDragEnter={(e) => {
                                    e.preventDefault();
                                    setActiveDropStage(stage);
                                }}
                                onDragLeave={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                        setActiveDropStage((curr) => (curr === stage ? null : curr));
                                    }
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setActiveDropStage(null);
                                    setDraggedAppId(null);
                                    try {
                                        const raw = e.dataTransfer.getData("application/json");
                                        if (!raw) return;
                                        const { id, sourceStage } = JSON.parse(raw);
                                        if (sourceStage === stage) return;
                                        if (stage === "OFFER_SENT") {
                                            const app = rawList.find((x: any) => x.id === id);
                                            if (app) openOffer(app);
                                            return;
                                        }
                                        if (stage === "ON_HOLD") {
                                            const app = rawList.find((x: any) => x.id === id);
                                            if (app) setReasonAction({ app, stage: "ON_HOLD" });
                                            return;
                                        }
                                        moveMutation.mutate({ id, stage });
                                    } catch (err) {
                                        console.error("Drop error:", err);
                                    }
                                }}
                                className={`rounded-2xl p-2.5 min-h-[380px] flex flex-col justify-between transition-all duration-150 ${
                                    isColumnOver
                                        ? "bg-emerald-50/70 border-2 border-dashed border-emerald-500 ring-4 ring-emerald-500/10 shadow-lg scale-[1.01]"
                                        : "bg-neutral-50/90 border border-neutral-200/60"
                                }`}
                            >
                                <div>
                                    {/* Stage Column Header */}
                                    <div className="flex items-center justify-between px-1 mb-2.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 leading-tight">
                                            {stage.replace(/_/g, " ")}
                                        </span>
                                        <span className={`text-[10px] font-black rounded-md px-1.5 py-0.5 border ${
                                            isColumnOver
                                                ? "bg-emerald-600 text-white border-emerald-600"
                                                : "bg-white border-neutral-200 text-neutral-700"
                                        }`}>
                                            {stageApps.length}
                                        </span>
                                    </div>

                                    {/* Drop Feedback Badge */}
                                    {isColumnOver && (
                                        <div className="py-2 px-2.5 bg-emerald-100/90 border border-emerald-300 rounded-xl text-center text-[10px] font-black text-emerald-800 animate-pulse mb-2.5 flex items-center justify-center gap-1.5">
                                            <Sparkles size={11} /> Drop to move to {stage.replace(/_/g, " ")}
                                        </div>
                                    )}

                                    {/* Empty Column Drop Target */}
                                    {stageApps.length === 0 && (
                                        <div className={`h-36 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-[11px] font-medium p-3 text-center transition-all ${
                                            isColumnOver
                                                ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold"
                                                : "border-neutral-200/80 text-neutral-400"
                                        }`}>
                                            <GitBranch size={16} className="mb-1 opacity-50" />
                                            <span>No candidates</span>
                                            <span className="text-[10px] opacity-70">Drag & drop here</span>
                                        </div>
                                    )}

                                    {/* Stage Cards */}
                                    <div className="space-y-2.5">
                                        {stageApps.map((a: any) => {
                                            const daysInStage = Math.floor((Date.now() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);
                                            const isAging = daysInStage > 3 && daysInStage <= 7;
                                            const isStuck = daysInStage > 7;
                                            const isBeingDragged = draggedAppId === a.id;

                                            return (
                                                <div
                                                    key={a.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData("application/json", JSON.stringify({ id: a.id, sourceStage: a.stage }));
                                                        e.dataTransfer.effectAllowed = "move";
                                                        setDraggedAppId(a.id);
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggedAppId(null);
                                                        setActiveDropStage(null);
                                                    }}
                                                    className={`bg-white rounded-xl p-3 border shadow-xs transition-all space-y-2 group/card relative cursor-grab active:cursor-grabbing select-none ${
                                                        isBeingDragged
                                                            ? "opacity-35 scale-95 border-dashed border-primary ring-2 ring-primary/40 shadow-none"
                                                            : "border-neutral-200/70 hover:shadow-md hover:border-neutral-300"
                                                    }`}
                                                >
                                                    {/* Top Row: Grip Handle, Candidate Name & Fit Score */}
                                                    <div className="flex items-start justify-between gap-1.5">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <GripVertical size={13} className="text-neutral-300 group-hover/card:text-neutral-500 shrink-0 cursor-grab active:cursor-grabbing" />
                                                            <button
                                                                onClick={() => setPreviewApp(a)}
                                                                className="font-bold text-[13px] text-neutral-900 hover:text-primary transition-colors text-left leading-tight truncate"
                                                            >
                                                                {a.candidateName}
                                                            </button>
                                                        </div>
                                                        <span
                                                            className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${a.fitScore >= 85
                                                                ? "bg-emerald-100 text-emerald-800"
                                                                : a.fitScore >= 70
                                                                    ? "bg-blue-100 text-blue-800"
                                                                    : "bg-neutral-100 text-neutral-600"
                                                            }`}
                                                        >
                                                            {a.fitScore}%
                                                        </span>
                                                    </div>

                                                    {/* Job Title & Client */}
                                                    <div className="text-[10px] text-neutral-500 space-y-0.5 pl-4.5">
                                                        <p className="font-semibold text-neutral-700 line-clamp-1">{a.jobTitle}</p>
                                                        <p className="text-neutral-400 font-medium truncate">{a.clientName || "Direct"}</p>
                                                    </div>

                                                    {/* CTC & Exp */}
                                                    <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-50 pl-4.5">
                                                        <span><strong>{a.totalExperienceYears}y</strong> exp</span>
                                                        <span>exp ₹{a.expectedCtcLpa}L</span>
                                                    </div>

                                                    {/* Aging Badge & Interview Pill */}
                                                    <div className="flex items-center justify-between gap-1 pt-0.5 text-[9px] flex-wrap pl-4.5">
                                                        <span
                                                            className={`font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${isStuck
                                                                ? "bg-red-50 text-red-700 border border-red-200"
                                                                : isAging
                                                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                                    : "bg-neutral-50 text-neutral-500 border border-neutral-200"
                                                            }`}
                                                        >
                                                            <Clock size={9} /> {daysInStage}d in stage
                                                        </span>

                                                        {a.nextInterview && (
                                                            <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 truncate max-w-[90px]">
                                                                📅 {new Date(a.nextInterview).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {a.stage === "ON_HOLD" && a.holdReason && (
                                                        <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 truncate" title={a.holdReason}>
                                                            On hold: {a.holdReason}
                                                        </p>
                                                    )}

                                                    {/* Stage Movement Controls */}
                                                    {a.stage === "ON_HOLD" ? (
                                                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
                                                        <button
                                                            onClick={() => setPreviewApp(a)}
                                                            className="text-[9px] font-bold text-primary hover:underline"
                                                        >
                                                            Details
                                                        </button>
                                                        <button
                                                            disabled={moveMutation.isPending}
                                                            onClick={() => moveMutation.mutate({ id: a.id, stage: a.stageBeforeHold || "SCREENING" })}
                                                            className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-bold hover:bg-primary hover:text-white disabled:opacity-40"
                                                        >
                                                            Resume → {(a.stageBeforeHold || "SCREENING").replace(/_/g, " ")}
                                                        </button>
                                                    </div>
                                                    ) : (
                                                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
                                                        <button
                                                            disabled={stageIdx <= 0 || !can(a.stage, STAGES[stageIdx - 1]) || moveMutation.isPending}
                                                            onClick={() => moveMutation.mutate({ id: a.id, stage: STAGES[stageIdx - 1] })}
                                                            className="p-1 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-800 disabled:opacity-20 transition-colors"
                                                            title="Move back"
                                                        >
                                                            <ChevronLeft size={13} />
                                                        </button>

                                                        <button
                                                            onClick={() => setPreviewApp(a)}
                                                            className="text-[9px] font-bold text-primary hover:underline"
                                                        >
                                                            Details
                                                        </button>

                                                        <button
                                                            disabled={stageIdx === STAGES.length - 1 || !can(a.stage, STAGES[stageIdx + 1]) || moveMutation.isPending}
                                                            onClick={() => moveMutation.mutate({ id: a.id, stage: STAGES[stageIdx + 1] })}
                                                            className="p-1 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-white disabled:opacity-20 transition-colors"
                                                            title="Advance stage"
                                                        >
                                                            <ChevronRight size={13} />
                                                        </button>
                                                    </div>
                                                    )}

                                                    {/* Hold / Reject */}
                                                    {(can(a.stage, "ON_HOLD") || can(a.stage, "REJECTED")) && (
                                                        <div className="flex gap-1">
                                                            {can(a.stage, "ON_HOLD") && (
                                                                <button
                                                                    onClick={() => setReasonAction({ app: a, stage: "ON_HOLD" })}
                                                                    className="flex-1 py-1 rounded-md border border-amber-200 text-amber-700 text-[9px] font-bold hover:bg-amber-50"
                                                                >
                                                                    Hold
                                                                </button>
                                                            )}
                                                            {can(a.stage, "REJECTED") && (
                                                                <button
                                                                    onClick={() => setReasonAction({ app: a, stage: "REJECTED" })}
                                                                    className="flex-1 py-1 rounded-md border border-rose-200 text-rose-700 text-[9px] font-bold hover:bg-rose-50"
                                                                >
                                                                    Reject
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Offer controls */}
                                                    {can(a.stage, "OFFER_SENT") && a.stage !== "ON_HOLD" && (
                                                        <button onClick={() => openOffer(a)} className="w-full mt-1 py-1 px-2 rounded-lg border border-primary/30 text-primary text-[10px] font-bold hover:bg-primary/5">
                                                            Release Offer
                                                        </button>
                                                    )}
                                                    {a.stage === "OFFER_SENT" && (
                                                        <div className="mt-1 space-y-1">
                                                            {a.openOfferCtcLpa != null && <p className="text-[9px] text-neutral-500 text-center">Offer ₹{a.openOfferCtcLpa} LPA{a.openOfferStatus === "NEGOTIATION" ? " · negotiating" : ""}</p>}
                                                            <div className="flex gap-1">
                                                                <button disabled={offerMutation.isPending} onClick={() => respondToOffer(a, "ACCEPTED")} className="flex-1 py-1 rounded-md bg-emerald-600 text-white text-[9px] font-bold">Accepted</button>
                                                                <button disabled={offerMutation.isPending} onClick={() => respondToOffer(a, "DECLINED")} className="flex-1 py-1 rounded-md border border-rose-200 text-rose-700 text-[9px] font-bold">Declined</button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Special Onboarding Handoff — only after the candidate accepted the offer */}
                                                    {a.stage === "OFFER_ACCEPTED" && (
                                                        <button
                                                            onClick={() => startOnboardingMutation.mutate(a)}
                                                            disabled={startOnboardingMutation.isPending}
                                                            className="w-full mt-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs transition-colors"
                                                        >
                                                            <UserPlus size={11} /> Start Onboarding
                                                        </button>
                                                    )}

                                                    {a.stage === "ONBOARDING" && (
                                                        <span className="w-full mt-1 py-1.5 px-2 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                                                            Handed over to HR onboarding
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Table View */
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[1000px]">
                            <thead>
                                <tr className="bg-neutral-50/80 border-b border-neutral-200/70 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="py-3 px-4 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredApps.length && filteredApps.length > 0}
                                            onChange={() => {
                                                if (selectedIds.length === filteredApps.length) setSelectedIds([]);
                                                else setSelectedIds(filteredApps.map((a) => a.id));
                                            }}
                                            className="rounded accent-primary cursor-pointer"
                                        />
                                    </th>
                                    <th className="py-3 px-3">Candidate</th>
                                    <th className="py-3 px-3">Requisition & Client</th>
                                    <th className="py-3 px-3">Stage</th>
                                    <th className="py-3 px-3">Fit Score</th>
                                    <th className="py-3 px-3">Exp / CTC</th>
                                    <th className="py-3 px-3">Days in Stage</th>
                                    <th className="py-3 px-3">Next Interview</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {filteredApps.map((a: any) => {
                                    const isSelected = selectedIds.includes(a.id);
                                    const daysInStage = Math.floor((Date.now() - new Date(a.updatedAt || a.createdAt).getTime()) / 86400000);
                                    const isAging = daysInStage > 3 && daysInStage <= 7;
                                    const isStuck = daysInStage > 7;

                                    return (
                                        <tr key={a.id} className={`hover:bg-neutral-50/60 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        setSelectedIds((prev) =>
                                                            prev.includes(a.id) ? prev.filter((i) => i !== a.id) : [...prev, a.id]
                                                        );
                                                    }}
                                                    className="rounded accent-primary cursor-pointer"
                                                />
                                            </td>
                                            <td className="py-3 px-3 font-bold text-neutral-900">
                                                <button
                                                    onClick={() => setPreviewApp(a)}
                                                    className="hover:text-primary text-left font-bold"
                                                >
                                                    {a.candidateName}
                                                </button>
                                                <p className="text-[10px] text-neutral-400 font-normal">{a.candidateEmail}</p>
                                            </td>
                                            <td className="py-3 px-3">
                                                <p className="font-semibold text-neutral-800 line-clamp-1">{a.jobTitle}</p>
                                                <p className="text-[10px] text-neutral-400">{a.clientName || "Direct"}</p>
                                            </td>
                                            <td className="py-3 px-3">
                                                <Badge value={a.stage} />
                                            </td>
                                            <td className="py-3 px-3 font-extrabold text-primary">
                                                {a.fitScore}%
                                            </td>
                                            <td className="py-3 px-3 text-neutral-600">
                                                {a.totalExperienceYears}y · ₹{a.expectedCtcLpa}L
                                            </td>
                                            <td className="py-3 px-3">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isStuck
                                                        ? "bg-red-50 text-red-700"
                                                        : isAging
                                                            ? "bg-amber-50 text-amber-700"
                                                            : "bg-neutral-100 text-neutral-600"
                                                        }`}
                                                >
                                                    {daysInStage} days
                                                </span>
                                            </td>
                                            <td className="py-3 px-3">
                                                {a.nextInterview ? (
                                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                                        {new Date(a.nextInterview).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                                    </span>
                                                ) : (
                                                    <span className="text-neutral-400 text-[10px]">None</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => setPreviewApp(a)}
                                                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700"
                                                        title="Quick preview"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <Link
                                                        href={`/ta/candidates/${a.candidateId}`}
                                                        className="px-2.5 py-1 bg-neutral-100 hover:bg-primary hover:text-white rounded-lg text-[11px] font-bold transition-colors"
                                                    >
                                                        360° Profile
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Quick Preview Drawer for Application */}
            {previewApp && (
                <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
                    <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
                        <div className="space-y-5">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-100">
                                <div>
                                    <h2 className="text-lg font-black text-neutral-900">{previewApp.candidateName}</h2>
                                    <p className="text-xs text-neutral-500 font-medium">{previewApp.jobTitle}</p>
                                    <p className="text-xs font-bold text-primary mt-0.5">{previewApp.clientName || "Direct"}</p>
                                </div>
                                <button
                                    onClick={() => setPreviewApp(null)}
                                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Stage & Fit Score */}
                            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">Current Stage</span>
                                    <Badge value={previewApp.stage} />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">Match Score</span>
                                    <span className="text-base font-black text-primary">{previewApp.fitScore}%</span>
                                </div>
                            </div>

                            {/* Candidate Snapshot */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Total Experience</p>
                                    <p className="font-extrabold text-neutral-900 mt-0.5">{previewApp.totalExperienceYears} Years</p>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Notice Period</p>
                                    <p className="font-extrabold text-neutral-900 mt-0.5">{previewApp.noticePeriodDays != null ? `${previewApp.noticePeriodDays} Days` : "—"}</p>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Current CTC</p>
                                    <p className="font-extrabold text-neutral-900 mt-0.5">{previewApp.currentCtcLpa ? `₹${previewApp.currentCtcLpa} LPA` : "—"}</p>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Expected CTC</p>
                                    <p className="font-extrabold text-neutral-900 mt-0.5">{previewApp.expectedCtcLpa ? `₹${previewApp.expectedCtcLpa} LPA` : "—"}</p>
                                </div>
                            </div>

                            {/* Contact Details */}
                            <div className="space-y-2 text-xs text-neutral-600 bg-neutral-50 p-3.5 rounded-xl border border-neutral-100">
                                <div className="flex items-center gap-2">
                                    <Mail size={13} className="text-neutral-400" />
                                    <span>{previewApp.candidateEmail || "—"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone size={13} className="text-neutral-400" />
                                    <span>{previewApp.candidatePhone || "—"}</span>
                                </div>
                            </div>

                            {/* Stage Movement Action in Drawer */}
                            <div className="space-y-2 pt-2 border-t border-neutral-100">
                                <label className="text-xs font-bold text-neutral-700">Move Candidate to Next Stage</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={previewApp.stage}
                                        onChange={(e) => {
                                            const newStage = e.target.value;
                                            if (newStage === "OFFER_SENT") return openOffer(previewApp);
                                            if (newStage === "REJECTED" || newStage === "ON_HOLD") return setReasonAction({ app: previewApp, stage: newStage });
                                            moveMutation.mutate({ id: previewApp.id, stage: newStage });
                                        }}
                                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800"
                                    >
                                        <option value={previewApp.stage}>{previewApp.stage.replace(/_/g, " ")} (current)</option>
                                        {[...STAGES, "ON_HOLD", "REJECTED", "BACKED_OUT"]
                                            .filter((s) => s !== "ONBOARDING" && can(previewApp.stage, s))
                                            .map((s) => (
                                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                                            ))}
                                    </select>
                                </div>
                                <p className="text-[10px] text-neutral-400">Only valid next stages are listed. Onboarding starts from the card after the offer is accepted.</p>
                            </div>

                            {/* Owner recruiter */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-neutral-700">Owner recruiter</label>
                                {isManager ? (
                                    <select
                                        value={previewApp.recruiterId}
                                        onChange={(e) => api("/api/ta/applications", "PATCH", { id: previewApp.id, recruiterId: e.target.value })
                                            .then((updated: any) => {
                                                toast.success("Candidate reassigned — recruiter notified");
                                                setPreviewApp({ ...previewApp, ...updated, recruiterName: teamMembers?.users.find((u) => u.id === e.target.value)?.name });
                                                qc.invalidateQueries({ queryKey: ["pipeline"] });
                                            })
                                            .catch((err: Error) => toast.error(err.message))}
                                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800"
                                    >
                                        {!teamMembers?.users.some((u) => u.id === previewApp.recruiterId) && <option value={previewApp.recruiterId}>{previewApp.recruiterName ?? "Current owner"}</option>}
                                        {(teamMembers?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                ) : (
                                    <p className="text-xs font-semibold text-neutral-800">{previewApp.recruiterName ?? "—"}</p>
                                )}
                                {previewApp.referredBy && <p className="text-[11px] text-neutral-500">Referred by {previewApp.referredBy}</p>}
                            </div>
                        </div>

                        {/* Drawer Bottom Actions */}
                        <div className="pt-4 border-t border-neutral-100 space-y-2">
                            <Link
                                href={`/ta/interviews?candidate=${previewApp.candidateId}`}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                            >
                                <Calendar size={14} /> Schedule Interview
                            </Link>
                            <Link
                                href={`/ta/candidates/${previewApp.candidateId}`}
                                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                            >
                                <ArrowRight size={14} /> Open 360° Candidate Profile
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add Candidate to Pipeline */}
            {addModalOpen && (
                <ModalShell
                    title="Add Candidate to Pipeline"
                    onClose={() => setAddModalOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!addForm.candidateId || !addForm.jobId) {
                                toast.error("Please select both a candidate and a requisition");
                                return;
                            }
                            addCandidateMutation.mutate({
                                candidateId: addForm.candidateId,
                                jobId: addForm.jobId,
                                screeningNotes: addForm.screeningNotes,
                                fitScore: parseInt(addForm.fitScore) || 85,
                            });
                        }}
                        className="space-y-4"
                    >
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Select Candidate *</label>
                            <select
                                required
                                value={addForm.candidateId}
                                onChange={(e) => setAddForm({ ...addForm, candidateId: e.target.value })}
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            >
                                <option value="">Select Candidate from Pool</option>
                                {candidatePool.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.currentDesignation || c.location || "Profile"} · {c.totalExperienceYears}y exp)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Target Requisition *</label>
                            <select
                                required
                                value={addForm.jobId}
                                onChange={(e) => setAddForm({ ...addForm, jobId: e.target.value })}
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            >
                                <option value="">Select Active Requisition</option>
                                {jobList.map((j: any) => (
                                    <option key={j.id} value={j.id}>
                                        {j.title} ({j.clientName} · {j.openings} openings)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Estimated Match / Fit Score (0-100%)</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={addForm.fitScore}
                                onChange={(e) => setAddForm({ ...addForm, fitScore: e.target.value })}
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Initial Sourcing / Screening Notes</label>
                            <textarea
                                rows={3}
                                value={addForm.screeningNotes}
                                onChange={(e) => setAddForm({ ...addForm, screeningNotes: e.target.value })}
                                placeholder="Candidate availability, key match points, recruiter observations…"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setAddModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={addCandidateMutation.isPending}
                                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                            >
                                {addCandidateMutation.isPending ? "Adding…" : "Add to Pipeline"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* Modal: Bulk Move */}
            {bulkMoveModalOpen && (
                <ModalShell
                    title="Bulk Move Candidates"
                    onClose={() => setBulkMoveModalOpen(false)}
                >
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-neutral-700">Target Stage</label>
                            <select
                                value={bulkTargetStage}
                                onChange={(e) => setBulkTargetStage(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-bold"
                            >
                                {STAGES.map((s) => (
                                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setBulkMoveModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={bulkMoveMutation.isPending}
                                onClick={() => bulkMoveMutation.mutate({ ids: selectedIds, stage: bulkTargetStage })}
                                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                                {bulkMoveMutation.isPending ? "Moving…" : "Apply Stage Movement"}
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* Modal: Release Offer */}
            {offerFor && (
                <ModalShell title={`Release offer — ${offerFor.candidateName}`} onClose={() => setOfferFor(null)}>
                    <form
                        className="space-y-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            offerMutation.mutate({
                                candidateId: offerFor.candidateId,
                                body: { newOffer: { applicationId: offerFor.id, offeredCtcLpa: Number(offerForm.offeredCtcLpa), joiningDate: offerForm.joiningDate, expiryDate: offerForm.expiryDate } },
                            });
                        }}
                    >
                        <p className="text-xs text-neutral-500">{offerFor.jobTitle}{offerFor.clientName ? ` · ${offerFor.clientName}` : ""} · expects ₹{offerFor.expectedCtcLpa || "—"} LPA</p>
                        <label className="block text-xs font-bold text-neutral-700">Offered CTC (LPA) *
                            <input required type="number" min="0.5" step="0.5" value={offerForm.offeredCtcLpa} onChange={(e) => setOfferForm({ ...offerForm, offeredCtcLpa: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm" />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block text-xs font-bold text-neutral-700">Joining date
                                <input type="date" value={offerForm.joiningDate} onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm" />
                            </label>
                            <label className="block text-xs font-bold text-neutral-700">Valid until
                                <input type="date" value={offerForm.expiryDate} onChange={(e) => setOfferForm({ ...offerForm, expiryDate: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm" />
                            </label>
                        </div>
                        <button disabled={offerMutation.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Release Offer</button>
                    </form>
                </ModalShell>
            )}

            {/* Modal: Reject / Hold reason */}
            {reasonAction && (
                <ModalShell
                    title={reasonAction.stage === "REJECTED" ? `Reject ${reasonAction.app.candidateName}` : `Put ${reasonAction.app.candidateName} on hold`}
                    onClose={() => { setReasonAction(null); setReasonText(""); }}
                >
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!reasonText.trim()) return;
                            moveMutation.mutate({
                                id: reasonAction.app.id,
                                stage: reasonAction.stage,
                                ...(reasonAction.stage === "REJECTED" ? { rejectionReason: reasonText.trim() } : { holdReason: reasonText.trim() }),
                            });
                        }}
                    >
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-neutral-700">
                                {reasonAction.stage === "REJECTED" ? "Rejection reason *" : "Hold reason *"}
                            </label>
                            <textarea
                                required
                                autoFocus
                                rows={3}
                                value={reasonText}
                                onChange={(e) => setReasonText(e.target.value)}
                                placeholder={reasonAction.stage === "REJECTED" ? "e.g. Skills mismatch after technical round" : "e.g. Client paused hiring until next month"}
                                className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => { setReasonAction(null); setReasonText(""); }}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={moveMutation.isPending || !reasonText.trim()}
                                className={`px-4 py-2 text-white rounded-xl text-xs font-bold disabled:opacity-50 ${reasonAction.stage === "REJECTED" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}`}
                            >
                                {moveMutation.isPending ? "Saving…" : reasonAction.stage === "REJECTED" ? "Reject Candidate" : "Put On Hold"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
