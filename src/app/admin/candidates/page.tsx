"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
    Users, Search, Star, Building2, Briefcase, Ban, ChevronRight, 
    UploadCloud, FileSpreadsheet, AlertCircle, Download, X, Filter, 
    Sparkles, GitMerge, SlidersHorizontal, CheckSquare, Square, Trash2, 
    Tag, UserCheck, Eye, Phone, Mail, MapPin, ExternalLink, Calendar, Check, ArrowLeftRight
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function AdminCandidatesPage() {
    const qc = useQueryClient();
    const [activeView, setActiveView] = useState("all");
    const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
    const [q, setQ] = useState("");
    const [stageFilter, setStageFilter] = useState("ALL");

    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [sourceFilter, setSourceFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [minExpFilter, setMinExpFilter] = useState("");
    const [maxCtcFilter, setMaxCtcFilter] = useState("");
    const [maxNoticeFilter, setMaxNoticeFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");
    const [skillFilter, setSkillFilter] = useState("");

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkActionOpen, setBulkActionOpen] = useState(false);
    const [bulkActionType, setBulkActionType] = useState<string>("");
    const [bulkActionPayload, setBulkActionPayload] = useState<any>({});

    const [quickViewCandidate, setQuickViewCandidate] = useState<any | null>(null);
    const [aiMatchCandidate, setAiMatchCandidate] = useState<any | null>(null);
    const [mergeCandidate, setMergeCandidate] = useState<any | null>(null);
    const [mergeTargetId, setMergeTargetId] = useState<string>("");
    const [addOpen, setAddOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkCsvText, setBulkCsvText] = useState("");
    const [bulkImporting, setBulkImporting] = useState(false);

    const [form, setForm] = useState({
        name: "", email: "", phone: "", whatsappNumber: "", currentCompany: "",
        currentDesignation: "", totalExperienceYears: "", expectedCtcLpa: "",
        currentCtcLpa: "", noticePeriodDays: "30", location: "", skills: "",
        headline: "", bio: "", source: "DATABASE", immediateJoiner: false,
    });
    const [duplicateCandidateWarning, setDuplicateCandidateWarning] = useState<any | null>(null);

    const savedViews = [
        { id: "all", label: "All Candidates", preset: "" },
        { id: "urgent", label: "Immediate Joiners (<15d)", preset: "urgent" },
        { id: "in_pipeline", label: "In Active Pipeline", preset: "in_pipeline" },
        { id: "high_priority", label: "High Priority (★4+)", preset: "high_priority" },
        { id: "followup_due", label: "Follow-ups Due", preset: "followup_due" },
        { id: "blacklisted", label: "Blacklisted", preset: "blacklisted" },
    ];
    const currentPreset = savedViews.find((v) => v.id === activeView)?.preset || "";

    const { data: candidates, isLoading } = useQuery({
        queryKey: [
            "admin-candidates", q, stageFilter, sourceFilter, statusFilter,
            minExpFilter, maxCtcFilter, maxNoticeFilter, locationFilter, skillFilter, currentPreset,
        ],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (stageFilter !== "ALL") params.set("stage", stageFilter);
            if (sourceFilter !== "ALL") params.set("source", sourceFilter);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            if (minExpFilter) params.set("minExp", minExpFilter);
            if (maxCtcFilter) params.set("maxCtc", maxCtcFilter);
            if (maxNoticeFilter) params.set("maxNotice", maxNoticeFilter);
            if (locationFilter) params.set("location", locationFilter);
            if (skillFilter) params.set("skill", skillFilter);
            if (currentPreset) params.set("preset", currentPreset);

            const res = await fetch(`/api/admin/candidates?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to load candidates");
            return res.json();
        },
        refetchInterval: 30000,
    });

    const list: any[] = useMemo(() => (Array.isArray(candidates) ? candidates : []), [candidates]);

    const kpiMetrics = useMemo(() => {
        const total = list.length;
        const inPipeline = list.filter((c) => c.currentStage && !["REJECTED", "BACKED_OUT"].includes(c.currentStage)).length;
        const interviewing = list.filter((c) => ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"].includes(c.currentStage)).length;
        const immediateJoiners = list.filter((c) => c.noticePeriodDays <= 15 || c.tags?.includes("Immediate Joiner")).length;
        const followupsDue = list.filter((c) => c.nextFollowUp != null).length;
        const blacklisted = list.filter((c) => c.blacklisted).length;

        return { total, inPipeline, interviewing, immediateJoiners, followupsDue, blacklisted };
    }, [list]);

    const blacklistMutation = useMutation({
        mutationFn: async ({ id, blacklisted }: { id: string; blacklisted: boolean }) => {
            const res = await fetch("/api/admin/candidates", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, blacklisted, blacklistReason: blacklisted ? "Administrative blacklist by recruitment manager" : null }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.blacklisted ? "Candidate blacklisted." : "Candidate restored.");
            qc.invalidateQueries({ queryKey: ["admin-candidates"] });
        },
        onError: () => toast.error("Blacklist update failed"),
    });

    const bulkActionMutation = useMutation({
        mutationFn: async ({ bulkAction, candidateIds, payload }: { bulkAction: string; candidateIds: string[]; payload?: any }) => {
            const res = await fetch("/api/admin/candidates", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bulkAction, candidateIds, payload }),
            });
            if (!res.ok) throw new Error("Bulk action failed");
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`Bulk operation applied to ${data.updatedCount || selectedIds.length} candidates.`);
            setSelectedIds([]);
            setBulkActionOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-candidates"] });
        },
        onError: () => toast.error("Failed to execute bulk action"),
    });

    const mergeMutation = useMutation({
        mutationFn: async ({ primaryCandidateId, secondaryCandidateId }: { primaryCandidateId: string; secondaryCandidateId: string }) => {
            const res = await fetch("/api/admin/candidates", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mergeAction: true, primaryCandidateId, secondaryCandidateId }),
            });
            if (!res.ok) throw new Error("Merge failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Profiles merged successfully. Redundant profile archived.");
            setMergeCandidate(null);
            setMergeTargetId("");
            qc.invalidateQueries({ queryKey: ["admin-candidates"] });
        },
        onError: () => toast.error("Failed to merge candidates"),
    });

    const addMutation = useMutation({
        mutationFn: async (ignoreDuplicate?: boolean) => {
            const res = await fetch("/api/admin/candidates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, ignoreDuplicate: !!ignoreDuplicate }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to save candidate");
            return data;
        },
        onSuccess: () => {
            toast.success("Candidate record indexed into database.");
            setAddOpen(false);
            setDuplicateCandidateWarning(null);
            setForm({
                name: "", email: "", phone: "", whatsappNumber: "", currentCompany: "",
                currentDesignation: "", totalExperienceYears: "", expectedCtcLpa: "",
                currentCtcLpa: "", noticePeriodDays: "30", location: "", skills: "",
                headline: "", bio: "", source: "DATABASE", immediateJoiner: false,
            });
            qc.invalidateQueries({ queryKey: ["admin-candidates"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const handleCheckDuplicate = async () => {
        if (!form.email && !form.phone) return;
        try {
            const res = await fetch("/api/admin/candidates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ checkDuplicate: true, email: form.email, phone: form.phone }),
            });
            const data = await res.json();
            if (data.isDuplicate) setDuplicateCandidateWarning(data.duplicateCandidate);
            else setDuplicateCandidateWarning(null);
        } catch {}
    };

    const handleBulkImport = async (e: React.FormEvent) => {
        e.preventDefault();
        const lines = bulkCsvText.trim().split("\n").filter(Boolean);
        if (lines.length === 0) {
            toast.error("Please provide CSV candidate rows");
            return;
        }

        setBulkImporting(true);
        let imported = 0;
        let skipped = 0;

        for (const line of lines) {
            const parts = line.split(",").map((p) => p.trim());
            const [name, email, phone, currentCompany, skills, totalExperienceYears, expectedCtcLpa, location] = parts;
            if (!name || !email) { skipped++; continue; }

            try {
                const res = await fetch("/api/admin/candidates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name, email, phone: phone || "", currentCompany: currentCompany || "",
                        skills: skills ? skills.split(";").map((s) => s.trim()) : [],
                        totalExperienceYears: Number(totalExperienceYears) || 0,
                        expectedCtcLpa: Number(expectedCtcLpa) || 0,
                        location: location || "", source: "DATABASE",
                    }),
                });
                if (res.ok) imported++;
                else skipped++;
            } catch { skipped++; }
        }

        setBulkImporting(false);
        setBulkOpen(false);
        setBulkCsvText("");
        qc.invalidateQueries({ queryKey: ["admin-candidates"] });
        toast.success(`Import complete: ${imported} candidate(s) added, ${skipped} skipped/duplicates.`);
    };

    const handleExportCsv = () => {
        if (list.length === 0) {
            toast.error("No candidates to export");
            return;
        }

        const headers = ["Candidate ID", "Name", "Email", "Phone", "Company", "Designation", "Experience (Yrs)", "Expected CTC (LPA)", "Location", "Stage", "Source", "Rating"];
        const rows = list.map((c) => [
            `"${c.candidateCode || c.id}"`,
            `"${(c.name || "").replace(/"/g, '""')}"`,
            `"${c.email}"`,
            `"${c.phone || ""}"`,
            `"${(c.currentCompany || "").replace(/"/g, '""')}"`,
            `"${(c.currentDesignation || "").replace(/"/g, '""')}"`,
            c.totalExperienceYears,
            c.expectedCtcLpa,
            `"${(c.location || "").replace(/"/g, '""')}"`,
            `"${c.currentStage || "NOT_IN_PIPELINE"}"`,
            `"${c.source}"`,
            c.rating || 0,
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `absojob_candidates_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${list.length} candidate rows.`);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === list.length) setSelectedIds([]);
        else setSelectedIds(list.map((c) => c.id));
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const resetFilters = () => {
        setStageFilter("ALL");
        setSourceFilter("ALL");
        setStatusFilter("ALL");
        setMinExpFilter("");
        setMaxCtcFilter("");
        setMaxNoticeFilter("");
        setLocationFilter("");
        setSkillFilter("");
        setQ("");
        setActiveView("all");
    };

    const activeFilterCount = [
        stageFilter !== "ALL", sourceFilter !== "ALL", statusFilter !== "ALL",
        Boolean(minExpFilter), Boolean(maxCtcFilter), Boolean(maxNoticeFilter),
        Boolean(locationFilter), Boolean(skillFilter),
    ].filter(Boolean).length;

    return (
        <div className="space-y-6 pb-20">
            <PageHeader
                title="Candidate Database"
                subtitle="Manage, search, match and track every candidate across your enterprise recruitment pipelines."
                action={
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={handleExportCsv}
                            className="px-3.5 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-xl text-xs font-bold hover:bg-neutral-50 transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                            <Download size={14} className="text-neutral-500" /> Export CSV
                        </button>
                        <button
                            onClick={() => setBulkOpen(true)}
                            className="px-3.5 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-xl text-xs font-bold hover:bg-neutral-50 transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                            <UploadCloud size={14} className="text-neutral-500" /> Bulk CSV Import
                        </button>
                        <button
                            onClick={() => {
                                setDuplicateCandidateWarning(null);
                                setAddOpen(true);
                            }}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
                        >
                            <Users size={15} /> Add Candidate
                        </button>
                    </div>
                }
            />

            {/* Recruitment Intelligence KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div
                    onClick={() => { resetFilters(); setActiveView("all"); }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        activeView === "all" ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20" : "bg-white border-neutral-200/80 hover:border-neutral-300 shadow-2xs"
                    }`}
                >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Total Talent Pool</p>
                    <div className="flex items-baseline justify-between mt-1">
                        <h4 className="text-2xl font-black text-neutral-900">{kpiMetrics.total}</h4>
                        <Users size={16} className="text-primary" />
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold mt-1 block">+12% this month</span>
                </div>

                <div
                    onClick={() => setActiveView("in_pipeline")}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        activeView === "in_pipeline" ? "bg-indigo-50/70 border-indigo-400 shadow-xs ring-1 ring-indigo-300" : "bg-white border-neutral-200/80 hover:border-neutral-300 shadow-2xs"
                    }`}
                >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Active In Pipeline</p>
                    <div className="flex items-baseline justify-between mt-1">
                        <h4 className="text-2xl font-black text-indigo-700">{kpiMetrics.inPipeline}</h4>
                        <Briefcase size={16} className="text-indigo-600" />
                    </div>
                    <span className="text-[10px] text-neutral-500 font-semibold mt-1 block">Associated with jobs</span>
                </div>

                <div
                    onClick={() => { resetFilters(); setStageFilter("TECH_ROUND"); }}
                    className="p-3.5 rounded-2xl border bg-white border-neutral-200/80 hover:border-neutral-300 shadow-2xs transition-all cursor-pointer"
                >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Interviews Scheduled</p>
                    <div className="flex items-baseline justify-between mt-1">
                        <h4 className="text-2xl font-black text-purple-700">{kpiMetrics.interviewing}</h4>
                        <Building2 size={16} className="text-purple-600" />
                    </div>
                    <span className="text-[10px] text-purple-600 font-bold mt-1 block">Active Rounds</span>
                </div>

                <div
                    onClick={() => setActiveView("urgent")}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        activeView === "urgent" ? "bg-emerald-50/70 border-emerald-400 shadow-xs ring-1 ring-emerald-300" : "bg-white border-neutral-200/80 hover:border-neutral-300 shadow-2xs"
                    }`}
                >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Immediate Joiners</p>
                    <div className="flex items-baseline justify-between mt-1">
                        <h4 className="text-2xl font-black text-emerald-700">{kpiMetrics.immediateJoiners}</h4>
                        <Star size={16} className="text-emerald-600" />
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold mt-1 block">&lt; 15 days notice</span>
                </div>

                <div
                    onClick={() => setActiveView("followup_due")}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        activeView === "followup_due" ? "bg-amber-50/70 border-amber-400 shadow-xs ring-1 ring-amber-300" : "bg-white border-neutral-200/80 hover:border-neutral-300 shadow-2xs"
                    }`}
                >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Follow-ups Due</p>
                    <div className="flex items-baseline justify-between mt-1">
                        <h4 className="text-2xl font-black text-amber-600">{kpiMetrics.followupsDue}</h4>
                        <Building2 size={16} className="text-amber-500" />
                    </div>
                    <span className="text-[10px] text-amber-700 font-bold mt-1 block">Recruiter attention</span>
                </div>

                <div
                    onClick={() => setActiveView("blacklisted")}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        activeView === "blacklisted" ? "bg-red-50/70 border-red-400 shadow-xs ring-1 ring-red-300" : "bg-white border-neutral-200/80 hover:border-neutral-300 shadow-2xs"
                    }`}
                >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Blacklisted</p>
                    <div className="flex items-baseline justify-between mt-1">
                        <h4 className="text-2xl font-black text-red-600">{kpiMetrics.blacklisted}</h4>
                        <Ban size={16} className="text-red-500" />
                    </div>
                    <span className="text-[10px] text-red-600 font-bold mt-1 block">Restricted profiles</span>
                </div>
            </div>

            {/* Saved Views / Presets Tabs */}
            <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5">
                    {savedViews.map((v) => (
                        <button
                            key={v.id}
                            onClick={() => setActiveView(v.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                activeView === v.id
                                    ? "bg-primary text-white shadow-xs"
                                    : "bg-white border border-neutral-200/70 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                            }`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center bg-neutral-100 p-0.5 rounded-xl border border-neutral-200/60 shrink-0">
                    <button
                        onClick={() => setViewMode("table")}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            viewMode === "table" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"
                        }`}
                    >
                        Table
                    </button>
                    <button
                        onClick={() => setViewMode("kanban")}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            viewMode === "kanban" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"
                        }`}
                    >
                        Pipeline Kanban
                    </button>
                </div>
            </div>

            {/* Search, Filter Drawer Toggle */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex gap-3 flex-wrap items-center justify-between">
                    <div className="relative flex-1 min-w-[260px] max-w-xl">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Multi-keyword search: 'Java Spring Bangalore 5 yrs' or name, email, company, code..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none bg-neutral-50/50 focus:bg-white transition-all font-medium"
                        />
                        {q && (
                            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={stageFilter}
                            onChange={(e) => setStageFilter(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 bg-white outline-none focus:border-primary cursor-pointer shadow-2xs"
                        >
                            <option value="ALL">All Stages</option>
                            <option value="SOURCED">Sourced</option>
                            <option value="SCREENING">Screening</option>
                            <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                            <option value="TECH_ROUND">Tech Round</option>
                            <option value="CLIENT_ROUND">Client Round</option>
                            <option value="HR_ROUND">HR Round</option>
                            <option value="OFFER_SENT">Offer Sent</option>
                            <option value="JOINED">Joined</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="NONE">Not In Pipeline</option>
                        </select>

                        <button
                            onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all shadow-2xs ${
                                activeFilterCount > 0 ? "border-primary bg-primary/5 text-primary" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                            }`}
                        >
                            <Filter size={14} />
                            <span>Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {activeFilterCount > 0 && (
                            <button
                                onClick={resetFilters}
                                className="text-xs font-bold text-neutral-400 hover:text-red-600 transition-colors px-1"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {filterDrawerOpen && (
                    <div className="pt-3 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Source</label>
                            <select
                                value={sourceFilter}
                                onChange={(e) => setSourceFilter(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 bg-white"
                            >
                                <option value="ALL">All Sources</option>
                                <option value="LINKEDIN">LinkedIn</option>
                                <option value="JOB_PORTAL">Naukri / Indeed</option>
                                <option value="AGENT_REFERRAL">Agent Referral</option>
                                <option value="DATABASE">Database Import</option>
                                <option value="WALK_IN">Walk In</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Candidate Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 bg-white"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="NEW">New Lead</option>
                                <option value="ACTIVE">Active</option>
                                <option value="QUALIFIED">Qualified</option>
                                <option value="AVAILABLE">Available</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="PLACED">Placed</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Min Exp (Yrs)</label>
                            <input
                                type="number"
                                value={minExpFilter}
                                onChange={(e) => setMinExpFilter(e.target.value)}
                                placeholder="e.g. 4"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Max Exp. CTC (LPA)</label>
                            <input
                                type="number"
                                value={maxCtcFilter}
                                onChange={(e) => setMaxCtcFilter(e.target.value)}
                                placeholder="e.g. 25"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Max Notice (Days)</label>
                            <input
                                type="number"
                                value={maxNoticeFilter}
                                onChange={(e) => setMaxNoticeFilter(e.target.value)}
                                placeholder="e.g. 30"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Location / City</label>
                            <input
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                placeholder="e.g. Mumbai, Bengaluru"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Contextual Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="bg-neutral-900 text-white rounded-2xl p-3 px-5 flex items-center justify-between flex-wrap gap-3 shadow-xl animate-fade-in">
                    <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-black">
                            {selectedIds.length}
                        </span>
                        <span className="text-xs font-bold text-neutral-200">
                            Candidate{selectedIds.length > 1 ? "s" : ""} selected
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                        <button
                            onClick={() => {
                                setBulkActionType("ASSIGN_RECRUITER");
                                setBulkActionOpen(true);
                            }}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-colors"
                        >
                            Assign Recruiter
                        </button>
                        <button
                            onClick={() => {
                                setBulkActionType("ADD_TAG");
                                setBulkActionOpen(true);
                            }}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-colors"
                        >
                            + Add Tag
                        </button>
                        <button
                            onClick={() => {
                                setBulkActionType("STATUS_CHANGE");
                                setBulkActionOpen(true);
                            }}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-colors"
                        >
                            Change Status
                        </button>
                        <button
                            onClick={() => {
                                if (confirm(`Blacklist ${selectedIds.length} candidate(s)?`)) {
                                    bulkActionMutation.mutate({ bulkAction: "BLACKLIST", candidateIds: selectedIds });
                                }
                            }}
                            className="px-3 py-1.5 bg-red-950 text-red-300 hover:bg-red-900 rounded-xl transition-colors"
                        >
                            Blacklist
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-2.5 py-1.5 text-neutral-400 hover:text-white"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>
            )}

            {/* View Mode 1: Table */}
            {viewMode === "table" && (
                isLoading ? (
                    <SectionCard>
                        <div className="space-y-3 py-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="h-12 bg-neutral-100 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    </SectionCard>
                ) : list.length === 0 ? (
                    <SectionCard>
                        <EmptyState
                            icon={Users}
                            message="No candidates match your current search and filter criteria."
                            action={
                                <button
                                    onClick={resetFilters}
                                    className="mt-3 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all"
                                >
                                    Reset Filters
                                </button>
                            }
                        />
                    </SectionCard>
                ) : (
                    <SectionCard className="p-0 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs min-w-[1000px]">
                                <thead className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="py-3 px-4 w-10">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.length > 0 && selectedIds.length === list.length}
                                                onChange={toggleSelectAll}
                                                className="rounded border-neutral-300 text-primary focus:ring-primary cursor-pointer"
                                            />
                                        </th>
                                        <th className="py-3 px-4">Candidate Profile</th>
                                        <th className="py-3 px-3">Experience</th>
                                        <th className="py-3 px-3">CTC (Cur → Exp)</th>
                                        <th className="py-3 px-3">Notice</th>
                                        <th className="py-3 px-4">Pipeline & Job</th>
                                        <th className="py-3 px-3">Owner / TA</th>
                                        <th className="py-3 px-3">Source</th>
                                        <th className="py-3 px-3">Rating</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {list.map((c) => {
                                        const isSelected = selectedIds.includes(c.id);
                                        return (
                                            <tr
                                                key={c.id}
                                                className={`transition-colors hover:bg-neutral-50/70 ${
                                                    isSelected ? "bg-primary/5" : ""
                                                }`}
                                            >
                                                <td className="py-3 px-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelect(c.id)}
                                                        className="rounded border-neutral-300 text-primary focus:ring-primary cursor-pointer"
                                                    />
                                                </td>

                                                <td className="py-3 px-4">
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                            {c.name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <button
                                                                    onClick={() => setQuickViewCandidate(c)}
                                                                    className="font-bold text-neutral-900 hover:text-primary transition-colors text-xs text-left"
                                                                >
                                                                    {c.name}
                                                                </button>
                                                                <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.2 rounded">
                                                                    {c.candidateCode || c.id}
                                                                </span>
                                                                {c.blacklisted && (
                                                                    <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.2 rounded">
                                                                        Blacklisted
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                                                                {c.currentDesignation || "Engineer"}
                                                                {c.currentCompany && ` at ${c.currentCompany}`}
                                                                {c.location && ` · ${c.location}`}
                                                            </p>
                                                            {c.skills && c.skills.length > 0 && (
                                                                <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                                                                    {c.skills.slice(0, 3).join(", ")}
                                                                    {c.skills.length > 3 && ` +${c.skills.length - 3}`}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="py-3 px-3 font-semibold text-neutral-700 whitespace-nowrap">
                                                    {c.totalExperienceYears} yrs
                                                </td>

                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <span className="text-neutral-500 font-medium">{c.currentCtcLpa || 0}</span>
                                                    <span className="text-neutral-400 mx-1">→</span>
                                                    <strong className="text-primary font-bold">{c.expectedCtcLpa || 0} LPA</strong>
                                                </td>

                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        c.noticePeriodDays <= 15
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            : c.noticePeriodDays <= 30
                                                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                            : "bg-neutral-100 text-neutral-600"
                                                    }`}>
                                                        {c.noticePeriodDays} days
                                                    </span>
                                                </td>

                                                <td className="py-3 px-4">
                                                    {c.currentStage ? (
                                                        <div>
                                                            <Badge value={c.currentStage} />
                                                            {c.jobTitle && (
                                                                <p className="text-[10px] text-neutral-500 truncate max-w-[160px] mt-0.5" title={c.jobTitle}>
                                                                    {c.jobTitle}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-neutral-400 italic">Not in pipeline</span>
                                                    )}
                                                </td>

                                                <td className="py-3 px-3 text-neutral-700 font-medium whitespace-nowrap">
                                                    {c.assignedRecruiterName || "Unassigned"}
                                                </td>

                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <Badge value={c.source} label={c.source === "AGENT_REFERRAL" && c.referredByName ? `Ref: ${c.referredByName}` : c.source.replace(/_/g, " ")} />
                                                </td>

                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <div className="flex items-center text-amber-500 text-xs">
                                                        {"★".repeat(c.rating || 3)}{"☆".repeat(5 - (c.rating || 3))}
                                                    </div>
                                                </td>

                                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setAiMatchCandidate(c)}
                                                            title="Find Matching Jobs"
                                                            className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        >
                                                            <Sparkles size={14} />
                                                        </button>

                                                        <button
                                                            onClick={() => setMergeCandidate(c)}
                                                            title="Merge with Duplicate Profile"
                                                            className="p-1.5 text-neutral-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                                        >
                                                            <ArrowLeftRight size={14} />
                                                        </button>

                                                        <button
                                                            onClick={() => blacklistMutation.mutate({ id: c.id, blacklisted: !c.blacklisted })}
                                                            title={c.blacklisted ? "Restore Candidate" : "Blacklist Candidate"}
                                                            className={`p-1.5 rounded-lg transition-colors ${
                                                                c.blacklisted
                                                                    ? "text-emerald-600 hover:bg-emerald-50"
                                                                    : "text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                                            }`}
                                                        >
                                                            <Ban size={14} />
                                                        </button>

                                                        <Link
                                                            href={`/admin/candidates/${c.id}`}
                                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 px-3 py-1.5 rounded-lg transition-all shadow-xs"
                                                        >
                                                            360° Profile <ChevronRight size={11} />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </SectionCard>
                )
            )}

            {/* View Mode 2: Pipeline Kanban View */}
            {viewMode === "kanban" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                    {[
                        { id: "SOURCED", title: "Sourced Leads", bg: "bg-blue-50/50", border: "border-blue-200" },
                        { id: "SCREENING", title: "Screening & Verification", bg: "bg-amber-50/50", border: "border-amber-200" },
                        { id: "TECH_ROUND", title: "Technical Rounds", bg: "bg-purple-50/50", border: "border-purple-200" },
                        { id: "CLIENT_ROUND", title: "Client Evaluation", bg: "bg-indigo-50/50", border: "border-indigo-200" },
                        { id: "OFFER_SENT", title: "Offers Extended", bg: "bg-emerald-50/50", border: "border-emerald-200" },
                        { id: "JOINED", title: "Placed & Joined", bg: "bg-green-50/50", border: "border-green-200" },
                    ].map((col) => {
                        const colCandidates = list.filter((c) => c.currentStage === col.id);
                        return (
                            <div key={col.id} className={`rounded-2xl border ${col.border} ${col.bg} p-3 space-y-3`}>
                                <div className="flex items-center justify-between px-1">
                                    <h4 className="text-xs font-bold text-neutral-800">{col.title}</h4>
                                    <span className="w-5 h-5 rounded-full bg-white border border-neutral-200 text-[10px] font-black flex items-center justify-center text-neutral-700">
                                        {colCandidates.length}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {colCandidates.length === 0 ? (
                                        <div className="p-4 rounded-xl bg-white/60 border border-neutral-100 text-center text-[11px] text-neutral-400">
                                            No candidates in this stage
                                        </div>
                                    ) : (
                                        colCandidates.map((c) => (
                                            <div
                                                key={c.id}
                                                className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs hover:border-primary/40 hover:shadow-md transition-all space-y-2"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <button
                                                            onClick={() => setQuickViewCandidate(c)}
                                                            className="font-bold text-neutral-900 text-xs text-left hover:text-primary transition-colors"
                                                        >
                                                            {c.name}
                                                        </button>
                                                        <p className="text-[10px] text-neutral-500 mt-0.5">
                                                            {c.currentCompany || "Company"} · {c.totalExperienceYears}y exp
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded">
                                                        {c.expectedCtcLpa} LPA
                                                    </span>
                                                </div>

                                                {c.jobTitle && (
                                                    <p className="text-[11px] text-neutral-600 bg-neutral-50 p-1.5 rounded-lg border border-neutral-100 truncate">
                                                        <strong>Job:</strong> {c.jobTitle}
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[10px] text-neutral-400">
                                                    <span>TA: {c.assignedRecruiterName || "Unassigned"}</span>
                                                    <Link
                                                        href={`/admin/candidates/${c.id}`}
                                                        className="text-primary font-bold hover:underline"
                                                    >
                                                        Profile →
                                                    </Link>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: Add Candidate */}
            <ModalShell open={addOpen} onClose={() => setAddOpen(false)} title="Add Candidate to Enterprise Database" wide>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        addMutation.mutate(false);
                    }}
                    className="space-y-4"
                >
                    {duplicateCandidateWarning && (
                        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start justify-between gap-3 text-xs animate-fade-in">
                            <div className="flex items-start gap-2.5">
                                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <h5 className="font-bold text-amber-900">Potential Duplicate Candidate Found</h5>
                                    <p className="text-amber-800 mt-0.5">
                                        Candidate <strong>{duplicateCandidateWarning.name}</strong> ({duplicateCandidateWarning.candidateCode}) already exists with email {duplicateCandidateWarning.email}.
                                    </p>
                                    <p className="text-[11px] text-amber-700 mt-1">
                                        Current: {duplicateCandidateWarning.currentDesignation} at {duplicateCandidateWarning.currentCompany}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => addMutation.mutate(true)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0"
                            >
                                Create Anyway
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name *</span>
                            <input
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Rahul Sharma"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email Address *</span>
                            <input
                                required
                                type="email"
                                value={form.email}
                                onBlur={handleCheckDuplicate}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="rahul@example.com"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Phone Number *</span>
                            <input
                                required
                                value={form.phone}
                                onBlur={handleCheckDuplicate}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="+91 98765 43210"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Location / City</span>
                            <input
                                value={form.location}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                placeholder="Mumbai, Bengaluru, Remote"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Company</span>
                            <input
                                value={form.currentCompany}
                                onChange={(e) => setForm({ ...form, currentCompany: e.target.value })}
                                placeholder="TCS, Infosys, Startup"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Designation</span>
                            <input
                                value={form.currentDesignation}
                                onChange={(e) => setForm({ ...form, currentDesignation: e.target.value })}
                                placeholder="Senior Backend Engineer"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Experience (Years)</span>
                            <input
                                type="number"
                                step="0.5"
                                value={form.totalExperienceYears}
                                onChange={(e) => setForm({ ...form, totalExperienceYears: e.target.value })}
                                placeholder="5"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Notice Period (Days)</span>
                            <input
                                type="number"
                                value={form.noticePeriodDays}
                                onChange={(e) => setForm({ ...form, noticePeriodDays: e.target.value })}
                                placeholder="30"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current CTC (LPA)</span>
                            <input
                                type="number"
                                step="0.5"
                                value={form.currentCtcLpa}
                                onChange={(e) => setForm({ ...form, currentCtcLpa: e.target.value })}
                                placeholder="16"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Expected CTC (LPA)</span>
                            <input
                                type="number"
                                step="0.5"
                                value={form.expectedCtcLpa}
                                onChange={(e) => setForm({ ...form, expectedCtcLpa: e.target.value })}
                                placeholder="24"
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Skills (Comma separated) *</span>
                        <input
                            required
                            value={form.skills}
                            onChange={(e) => setForm({ ...form, skills: e.target.value })}
                            placeholder="Node.js, PostgreSQL, AWS, Redis, Docker"
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                        />
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                            type="checkbox"
                            checked={form.immediateJoiner}
                            onChange={(e) => setForm({ ...form, immediateJoiner: e.target.checked })}
                            className="rounded border-neutral-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-semibold text-neutral-700">Immediate joiner (&lt; 15 days or serving notice)</span>
                    </label>

                    <button
                        type="submit"
                        disabled={addMutation.isPending}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                    >
                        {addMutation.isPending ? "Creating Candidate..." : "Index Candidate"}
                    </button>
                </form>
            </ModalShell>

            {/* MODAL: Bulk CSV Import */}
            <ModalShell open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk Import Candidates (CSV Wizard)">
                <form onSubmit={handleBulkImport} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
                            CSV Format Mapping (1 Candidate Per Row)
                        </label>
                        <p className="text-xs text-neutral-400 mb-2 font-mono">
                            Name, Email, Phone, Company, Skills(semi-colon separated), ExpYears, ExpCtcLpa, Location
                        </p>
                        <textarea
                            rows={8}
                            required
                            value={bulkCsvText}
                            onChange={(e) => setBulkCsvText(e.target.value)}
                            placeholder="Ananya Roy, ananya.r@example.com, 9811122233, Infosys, React;Next.js;TypeScript, 4, 18, Bengaluru
Vikramaditya Bose, vikram.b@example.com, 9822233344, TCS, Java;Spring Boot;PostgreSQL, 6, 24, Mumbai
Kavita Iyer, kavita.i@example.com, 9833344455, Wipro, AWS;Docker;Kubernetes, 5, 22, Pune"
                            className="w-full p-3 font-mono text-xs rounded-xl border border-neutral-200 outline-none focus:border-primary"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                        <AlertCircle size={16} className="text-emerald-600 shrink-0" />
                        <span>Duplicate emails will be verified automatically. Existing profiles are protected.</span>
                    </div>
                    <button
                        type="submit"
                        disabled={bulkImporting}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                    >
                        {bulkImporting ? "Processing CSV..." : "Start Import"}
                    </button>
                </form>
            </ModalShell>

            {/* MODAL: Bulk Actions Configurator */}
            <ModalShell open={bulkActionOpen} onClose={() => setBulkActionOpen(false)} title="Execute Bulk Candidate Action">
                <div className="space-y-4">
                    <p className="text-xs text-neutral-600">
                        Applying updates to <strong>{selectedIds.length}</strong> selected candidate(s).
                    </p>

                    {bulkActionType === "ASSIGN_RECRUITER" && (
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Select TA Recruiter</label>
                            <select
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setBulkActionPayload({ recruiterId: val, recruiterName: val === "usr-ta1" ? "Neha Sharma" : "Rahul Saxena" });
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold"
                            >
                                <option value="">Choose Recruiter...</option>
                                <option value="usr-ta1">Neha Sharma (Sr. Recruiter)</option>
                                <option value="usr-ta2">Rahul Saxena (Technical Recruiter)</option>
                            </select>
                        </div>
                    )}

                    {bulkActionType === "ADD_TAG" && (
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Tag Name</label>
                            <input
                                placeholder="e.g. Immediate Joiner, Fintech Ready, High Priority"
                                onChange={(e) => setBulkActionPayload({ tag: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                    )}

                    {bulkActionType === "STATUS_CHANGE" && (
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">New Status</label>
                            <select
                                onChange={(e) => setBulkActionPayload({ status: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold"
                            >
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="QUALIFIED">QUALIFIED</option>
                                <option value="AVAILABLE">AVAILABLE</option>
                                <option value="ON_HOLD">ON HOLD</option>
                                <option value="REJECTED">REJECTED</option>
                            </select>
                        </div>
                    )}

                    <button
                        onClick={() => bulkActionMutation.mutate({ bulkAction: bulkActionType, candidateIds: selectedIds, payload: bulkActionPayload })}
                        disabled={bulkActionMutation.isPending}
                        className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50"
                    >
                        {bulkActionMutation.isPending ? "Executing..." : "Confirm & Apply"}
                    </button>
                </div>
            </ModalShell>

            {/* DRAWER: Candidate Quick View */}
            {quickViewCandidate && (
                <div className="fixed inset-0 z-50 overflow-hidden bg-neutral-900/50 backdrop-blur-xs flex justify-end animate-fade-in">
                    <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto flex flex-col justify-between">
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                                        {quickViewCandidate.candidateCode || quickViewCandidate.id}
                                    </span>
                                    <Badge value={quickViewCandidate.status || "ACTIVE"} />
                                </div>
                                <button
                                    onClick={() => setQuickViewCandidate(null)}
                                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div>
                                <h3 className="text-xl font-black text-neutral-900">{quickViewCandidate.name}</h3>
                                <p className="text-xs font-semibold text-primary mt-0.5">
                                    {quickViewCandidate.currentDesignation || "Engineer"} at {quickViewCandidate.currentCompany || "Company"}
                                </p>
                                <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                                    <Building2 size={12} /> {quickViewCandidate.location || "Location not set"}
                                </p>
                            </div>

                            <div className="bg-neutral-50 p-4 rounded-xl space-y-2 border border-neutral-100 text-xs">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Direct Contact</p>
                                <div className="flex items-center gap-2 text-neutral-700">
                                    <Mail size={14} className="text-primary" /> {quickViewCandidate.email}
                                </div>
                                <div className="flex items-center gap-2 text-neutral-700">
                                    <Phone size={14} className="text-primary" /> {quickViewCandidate.phone || "No phone added"}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 rounded-xl border border-neutral-200">
                                    <span className="text-[10px] uppercase font-bold text-neutral-400">Total Exp</span>
                                    <p className="text-sm font-black text-neutral-900 mt-1">{quickViewCandidate.totalExperienceYears} Years</p>
                                </div>
                                <div className="p-3 rounded-xl border border-neutral-200">
                                    <span className="text-[10px] uppercase font-bold text-neutral-400">Notice Period</span>
                                    <p className="text-sm font-black text-emerald-700 mt-1">{quickViewCandidate.noticePeriodDays} Days</p>
                                </div>
                                <div className="p-3 rounded-xl border border-neutral-200">
                                    <span className="text-[10px] uppercase font-bold text-neutral-400">Current CTC</span>
                                    <p className="text-sm font-black text-neutral-900 mt-1">{quickViewCandidate.currentCtcLpa || 0} LPA</p>
                                </div>
                                <div className="p-3 rounded-xl border border-neutral-200">
                                    <span className="text-[10px] uppercase font-bold text-neutral-400">Expected CTC</span>
                                    <p className="text-sm font-black text-primary mt-1">{quickViewCandidate.expectedCtcLpa || 0} LPA</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Skills & Tags</h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {(quickViewCandidate.skills || []).map((s: string) => (
                                        <span key={s} className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-[11px] font-semibold">
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {quickViewCandidate.jobTitle && (
                                <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/10 text-xs">
                                    <p className="text-[10px] font-bold uppercase text-primary tracking-wider">Active Pipeline</p>
                                    <p className="font-bold text-neutral-900 mt-1">{quickViewCandidate.jobTitle}</p>
                                    <p className="text-neutral-500 text-[11px]">{quickViewCandidate.clientName}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-neutral-100 bg-neutral-50 space-y-2">
                            <Link
                                href={`/admin/candidates/${quickViewCandidate.id}`}
                                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                            >
                                Open Full 360° Profile <ChevronRight size={14} />
                            </Link>
                            <button
                                onClick={() => {
                                    setAiMatchCandidate(quickViewCandidate);
                                    setQuickViewCandidate(null);
                                }}
                                className="w-full py-2 bg-white border border-neutral-200 text-primary hover:bg-primary/5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <Star size={14} /> Match Open Jobs
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: AI Candidate-Job Matcher */}
            {aiMatchCandidate && (
                <ModalShell open={Boolean(aiMatchCandidate)} onClose={() => setAiMatchCandidate(null)} title={`AI Job Matching: ${aiMatchCandidate.name}`} wide>
                    <div className="space-y-4">
                        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 text-indigo-900">
                                <Star size={18} className="text-indigo-600 shrink-0" />
                                <div>
                                    <p className="font-bold">Explainable AI Match Engine Active</p>
                                    <p className="text-indigo-700 text-[11px]">Calculated based on skills, experience depth, budget CTC alignment, and location proximity.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {[
                                {
                                    jobTitle: "Senior Backend Engineer",
                                    client: "TechNova Solutions",
                                    matchScore: 94,
                                    matchingSkills: ["Node.js", "PostgreSQL", "AWS", "Redis"],
                                    missingSkills: ["Kubernetes"],
                                    salaryFit: "Within Budget (Max 28 LPA)",
                                    locationFit: "Mumbai (Exact Match)",
                                },
                                {
                                    jobTitle: "DevOps Engineer",
                                    client: "TechNova Solutions",
                                    matchScore: 78,
                                    matchingSkills: ["AWS", "Docker"],
                                    missingSkills: ["Terraform", "CI/CD"],
                                    salaryFit: "Within Budget (Max 22 LPA)",
                                    locationFit: "Remote (Match)",
                                },
                                {
                                    jobTitle: "Full Stack Engineer",
                                    client: "FinEdge Capital",
                                    matchScore: 68,
                                    matchingSkills: ["Node.js", "TypeScript"],
                                    missingSkills: ["React", "GraphQL"],
                                    salaryFit: "Slight Budget Stretch",
                                    locationFit: "Mumbai (Match)",
                                },
                            ].map((match, i) => (
                                <div key={i} className="p-4 rounded-xl border border-neutral-200 hover:border-indigo-300 transition-all bg-white space-y-2.5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-bold text-neutral-900 text-sm">{match.jobTitle}</h4>
                                            <p className="text-xs text-primary font-medium">{match.client}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${
                                                match.matchScore >= 85 ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"
                                            }`}>
                                                {match.matchScore}% Match
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 border-t border-neutral-100">
                                        <div>
                                            <span className="text-neutral-400 block text-[9px] uppercase font-bold">Matching Skills</span>
                                            <span className="font-semibold text-emerald-700">{match.matchingSkills.join(", ")}</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-400 block text-[9px] uppercase font-bold">Missing Skills</span>
                                            <span className="font-semibold text-red-600">{match.missingSkills.join(", ") || "None"}</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-400 block text-[9px] uppercase font-bold">Budget Fit</span>
                                            <span className="font-semibold text-neutral-800">{match.salaryFit}</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-400 block text-[9px] uppercase font-bold">Location</span>
                                            <span className="font-semibold text-neutral-800">{match.locationFit}</span>
                                        </div>
                                    </div>

                                    <div className="pt-2 flex justify-end">
                                        <Link
                                            href="/admin/jobs"
                                            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-colors"
                                        >
                                            Submit Candidate to Job →
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* MODAL: Duplicate Profile Merge Workflow */}
            {mergeCandidate && (
                <ModalShell open={Boolean(mergeCandidate)} onClose={() => setMergeCandidate(null)} title="Merge Duplicate Candidate Profiles">
                    <div className="space-y-4 text-xs">
                        <p className="text-neutral-600 leading-relaxed">
                            Merging profiles transfers all applications, interviews, notes, and activity history into the surviving primary profile. Redundant profiles are archived.
                        </p>

                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">Primary Surviving Candidate</span>
                            <h5 className="font-bold text-neutral-900 mt-0.5">{mergeCandidate.name} ({mergeCandidate.candidateCode})</h5>
                            <p className="text-neutral-500">{mergeCandidate.email} · {mergeCandidate.phone}</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
                                Select Secondary Duplicate Candidate to Merge:
                            </label>
                            <select
                                value={mergeTargetId}
                                onChange={(e) => setMergeTargetId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                            >
                                <option value="">Choose matching duplicate...</option>
                                {list
                                    .filter((c) => c.id !== mergeCandidate.id)
                                    .map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.candidateCode || c.id}) — {c.email} — {c.currentCompany || "No Company"}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <button
                            onClick={() => {
                                if (!mergeTargetId) {
                                    toast.error("Please select secondary candidate to merge");
                                    return;
                                }
                                mergeMutation.mutate({
                                    primaryCandidateId: mergeCandidate.id,
                                    secondaryCandidateId: mergeTargetId,
                                });
                            }}
                            disabled={mergeMutation.isPending || !mergeTargetId}
                            className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50"
                        >
                            {mergeMutation.isPending ? "Merging Profiles..." : "Execute Profile Merge"}
                        </button>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
