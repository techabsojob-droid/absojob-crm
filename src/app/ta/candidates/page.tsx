"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    Users, Search, Plus, Star, Briefcase, Filter, Download,
    SlidersHorizontal, Eye, X, Phone, Mail, Building2, MapPin,
    IndianRupee, Clock, GitBranch, AlertTriangle, ShieldCheck,
    CheckCircle2, ArrowRight, UserPlus, Table as TableIcon, LayoutGrid
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Badge, SectionCard, ModalShell, EmptyState, StatCard } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";

export default function TaCandidatesPage() {
    const qc = useQueryClient();

    // Views & Filters
    const [viewMode, setViewMode] = useState<"table" | "cards">("table");
    const [searchQuery, setSearchQuery] = useState("");
    const [sourceFilter, setSourceFilter] = useState("ALL");
    const [noticeFilter, setNoticeFilter] = useState("ALL");
    const [ratingFilter, setRatingFilter] = useState("ALL");
    const [pipelineFilter, setPipelineFilter] = useState("ALL");
    const [presetFilter, setPresetFilter] = useState("ALL");

    // Selection & Bulk
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Drawers & Modals
    const [previewCandidate, setPreviewCandidate] = useState<any>(null);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [addToPipelineOpen, setAddToPipelineOpen] = useState(false);
    const [targetCandidate, setTargetCandidate] = useState<any>(null);

    // Form: Push to Pipeline
    const [pipelineForm, setPipelineForm] = useState({
        jobId: "",
        screeningNotes: "",
        fitScore: "85",
    });

    // Form: New Candidate with Duplicate Detection
    const [newCandForm, setNewCandForm] = useState({
        name: "",
        email: "",
        phone: "",
        currentDesignation: "",
        currentCompany: "",
        totalExperienceYears: "4",
        currentCtcLpa: "12",
        expectedCtcLpa: "18",
        noticePeriodDays: "30",
        location: "Bangalore",
        skills: "React, Node.js, TypeScript",
        source: "LINKEDIN",
        rating: 4,
    });

    // Fetch Candidates
    const { data: candidates, isLoading } = useQuery({
        queryKey: ["ta-candidates-all", searchQuery],
        queryFn: async () => {
            const res = await fetch(`/api/admin/candidates?q=${encodeURIComponent(searchQuery)}`);
            if (!res.ok) throw new Error("Failed to fetch candidates");
            return res.json();
        },
    });

    // Fetch Active Jobs for Push to Pipeline
    const { data: jobs } = useQuery({
        queryKey: ["ta-jobs-active"],
        queryFn: async () => {
            const res = await fetch("/api/admin/jobs");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Mutation: Add to Pipeline
    const addToPipelineMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/ta/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidateId: targetCandidate.id,
                    jobId: pipelineForm.jobId,
                    screeningNotes: pipelineForm.screeningNotes,
                    fitScore: parseInt(pipelineForm.fitScore) || 85,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to add to pipeline");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Candidate pushed to pipeline (stage: SOURCED)!");
            setAddToPipelineOpen(false);
            setTargetCandidate(null);
            setPipelineForm({ jobId: "", screeningNotes: "", fitScore: "85" });
            qc.invalidateQueries({ queryKey: ["pipeline"] });
            qc.invalidateQueries({ queryKey: ["ta-candidates-all"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Mutation: Create Candidate
    const createCandidateMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/admin/candidates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create candidate");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Candidate profile created successfully!");
            setAddModalOpen(false);
            setNewCandForm({
                name: "",
                email: "",
                phone: "",
                currentDesignation: "",
                currentCompany: "",
                totalExperienceYears: "4",
                currentCtcLpa: "12",
                expectedCtcLpa: "18",
                noticePeriodDays: "30",
                location: "Bangalore",
                skills: "React, Node.js, TypeScript",
                source: "LINKEDIN",
                rating: 4,
            });
            qc.invalidateQueries({ queryKey: ["ta-candidates-all"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const allCandidates = Array.isArray(candidates) ? candidates.filter((c: any) => !c.blacklisted) : [];
    const activeJobs = Array.isArray(jobs) ? jobs.filter((j: any) => !["FULFILLED", "CLOSED", "CANCELLED"].includes(j.status)) : [];

    // Duplicate Detection for the Add Candidate Modal
    const duplicateCandidate = useMemo(() => {
        if (!newCandForm.email && !newCandForm.phone) return null;
        const normEmail = newCandForm.email.toLowerCase().trim();
        const normPhone = newCandForm.phone.replace(/[^0-9]/g, "");

        return allCandidates.find((c: any) => {
            if (normEmail && c.email && c.email.toLowerCase().trim() === normEmail) return true;
            if (normPhone && c.phone && c.phone.replace(/[^0-9]/g, "").includes(normPhone)) return true;
            return false;
        });
    }, [newCandForm.email, newCandForm.phone, allCandidates]);

    // Filtered Candidates
    const filteredCandidates = useMemo(() => {
        let list = [...allCandidates];

        // Preset Filters
        if (presetFilter === "IN_PIPELINE") {
            list = list.filter((c) => !!c.currentStage);
        } else if (presetFilter === "IMMEDIATE") {
            list = list.filter((c) => (c.noticePeriodDays || 0) <= 15);
        } else if (presetFilter === "TOP_RATED") {
            list = list.filter((c) => (c.rating || 0) >= 4);
        } else if (presetFilter === "AVAILABLE") {
            list = list.filter((c) => !c.currentStage);
        }

        // Source Filter
        if (sourceFilter !== "ALL") {
            list = list.filter((c) => c.source === sourceFilter);
        }

        // Notice Filter
        if (noticeFilter === "IMMEDIATE") {
            list = list.filter((c) => (c.noticePeriodDays || 0) <= 15);
        } else if (noticeFilter === "30_DAYS") {
            list = list.filter((c) => (c.noticePeriodDays || 0) <= 30);
        } else if (noticeFilter === "60_DAYS") {
            list = list.filter((c) => (c.noticePeriodDays || 0) <= 60);
        }

        // Rating Filter
        if (ratingFilter !== "ALL") {
            list = list.filter((c) => (c.rating || 0) >= parseInt(ratingFilter));
        }

        // Pipeline Status Filter
        if (pipelineFilter === "ACTIVE") {
            list = list.filter((c) => !!c.currentStage);
        } else if (pipelineFilter === "UNASSIGNED") {
            list = list.filter((c) => !c.currentStage);
        }

        return list;
    }, [allCandidates, presetFilter, sourceFilter, noticeFilter, ratingFilter, pipelineFilter]);

    // KPI Metrics
    const metrics = useMemo(() => {
        const total = allCandidates.length;
        const inPipeline = allCandidates.filter((c) => !!c.currentStage).length;
        const immediate = allCandidates.filter((c) => (c.noticePeriodDays || 0) <= 15).length;
        const topRated = allCandidates.filter((c) => (c.rating || 0) >= 4).length;
        const interviewing = allCandidates.filter((c) => ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"].includes(c.currentStage)).length;
        const placed = allCandidates.filter((c) => c.currentStage === "JOINED" || c.status === "PLACED").length;

        return { total, inPipeline, immediate, topRated, interviewing, placed };
    }, [allCandidates]);

    // Export CSV
    const exportCsv = () => {
        const dataToExport = selectedIds.length > 0 ? allCandidates.filter((c) => selectedIds.includes(c.id)) : filteredCandidates;
        if (dataToExport.length === 0) {
            toast.error("No candidates to export");
            return;
        }

        const headers = ["Candidate ID", "Name", "Email", "Phone", "Role", "Company", "Experience (Yrs)", "Current CTC", "Expected CTC", "Notice Days", "Source", "Current Stage", "Rating"];
        const rows = dataToExport.map((c) => [
            c.id,
            `"${c.name?.replace(/"/g, '""')}"`,
            c.email || "",
            c.phone || "",
            `"${(c.currentDesignation || c.headline || "")?.replace(/"/g, '""')}"`,
            `"${(c.currentCompany || "")?.replace(/"/g, '""')}"`,
            c.totalExperienceYears || 0,
            c.currentCtcLpa || 0,
            c.expectedCtcLpa || 0,
            c.noticePeriodDays || 0,
            c.source || "DIRECT",
            c.currentStage || "AVAILABLE",
            c.rating || 3,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `AbsoJob_Candidates_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${dataToExport.length} candidates to CSV.`);
    };

    return (
        <div className="space-y-6 pb-16 max-w-[1700px] mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Talent Pool
                        </span>
                        <span className="text-xs text-neutral-400 font-bold">Candidate Sourcing & Database</span>
                    </div>
                    <h1 className="text-2xl font-black text-neutral-900 mt-0.5">Candidates</h1>
                    <p className="text-xs text-neutral-500 font-medium">
                        Search and filter verified talent profiles, detect duplicates, and push candidates into active pipelines.
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

            {/* Candidate KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard
                    label="Total Talent Pool"
                    value={metrics.total}
                    icon={Users}
                    tone="primary"
                    hint="Verified profiles"
                />
                <StatCard
                    label="In Active Pipeline"
                    value={metrics.inPipeline}
                    icon={GitBranch}
                    tone="blue"
                    hint="Currently being evaluated"
                />
                <StatCard
                    label="In Interviews"
                    value={metrics.interviewing}
                    icon={Briefcase}
                    tone="purple"
                    hint="Tech & Client rounds"
                />
                <StatCard
                    label="Immediate Joiners"
                    value={metrics.immediate}
                    icon={Clock}
                    tone="emerald"
                    hint="Notice ≤ 15 days"
                />
                <StatCard
                    label="Top Rated (4–5★)"
                    value={metrics.topRated}
                    icon={Star}
                    tone="amber"
                    hint="High potential candidates"
                />
                <StatCard
                    label="Placed / Hired"
                    value={metrics.placed}
                    icon={CheckCircle2}
                    tone="emerald"
                    hint="Successful joins"
                />
            </div>

            {/* Filters Bar & Search */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, skill, email, company, role…"
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
                        {/* Notice Period */}
                        <select
                            value={noticeFilter}
                            onChange={(e) => setNoticeFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer"
                        >
                            <option value="ALL">All Notice Periods</option>
                            <option value="IMMEDIATE">Immediate (≤15d)</option>
                            <option value="30_DAYS">Up to 30 Days</option>
                            <option value="60_DAYS">Up to 60 Days</option>
                        </select>

                        {/* Source */}
                        <select
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer"
                        >
                            <option value="ALL">All Sources</option>
                            <option value="LINKEDIN">LinkedIn</option>
                            <option value="NAUKRI">Naukri</option>
                            <option value="REFERRAL">Referral</option>
                            <option value="DIRECT">Direct Sourced</option>
                            <option value="AGENCY">Agency</option>
                        </select>

                        {/* Rating */}
                        <select
                            value={ratingFilter}
                            onChange={(e) => setRatingFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer"
                        >
                            <option value="ALL">All Ratings</option>
                            <option value="5">5 Stars only</option>
                            <option value="4">4 Stars & above</option>
                            <option value="3">3 Stars & above</option>
                        </select>

                        {/* View Switcher */}
                        <div className="flex items-center bg-neutral-100 p-0.5 rounded-xl border border-neutral-200/60">
                            <button
                                onClick={() => setViewMode("table")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === "table" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"}`}
                            >
                                <TableIcon size={13} /> Table
                            </button>
                            <button
                                onClick={() => setViewMode("cards")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === "cards" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"}`}
                            >
                                <LayoutGrid size={13} /> Cards
                            </button>
                        </div>
                    </div>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-neutral-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mr-1 flex items-center gap-1">
                        <SlidersHorizontal size={11} /> Filters:
                    </span>
                    {[
                        { id: "ALL", label: "All Candidates" },
                        { id: "IN_PIPELINE", label: "In Active Pipeline" },
                        { id: "IMMEDIATE", label: "Immediate Joiners (≤15d)" },
                        { id: "TOP_RATED", label: "Top Rated (4–5★)" },
                        { id: "AVAILABLE", label: "Unassigned Pool" },
                    ].map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setPresetFilter(p.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${presetFilter === p.id
                                ? "bg-primary text-white shadow-xs"
                                : "bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 text-neutral-600"
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                    {(presetFilter !== "ALL" || sourceFilter !== "ALL" || noticeFilter !== "ALL" || ratingFilter !== "ALL" || searchQuery) && (
                        <button
                            onClick={() => {
                                setPresetFilter("ALL");
                                setSourceFilter("ALL");
                                setNoticeFilter("ALL");
                                setRatingFilter("ALL");
                                setSearchQuery("");
                            }}
                            className="px-2.5 py-1 text-xs text-red-600 hover:underline font-bold ml-auto"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Actions Banner */}
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

            {/* Main Content: Table or Cards */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-neutral-100" />
                    ))}
                </div>
            ) : filteredCandidates.length === 0 ? (
                <SectionCard>
                    <EmptyState
                        icon={Users}
                        message="No candidates match your current search and filters."
                        action={
                            <button
                                onClick={() => setAddModalOpen(true)}
                                className="mt-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
                            >
                                Add Candidate
                            </button>
                        }
                    />
                </SectionCard>
            ) : viewMode === "table" ? (
                /* Table View */
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[1100px]">
                            <thead>
                                <tr className="bg-neutral-50/80 border-b border-neutral-200/70 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="py-3 px-4 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                                            onChange={() => {
                                                if (selectedIds.length === filteredCandidates.length) setSelectedIds([]);
                                                else setSelectedIds(filteredCandidates.map((c) => c.id));
                                            }}
                                            className="rounded accent-primary cursor-pointer"
                                        />
                                    </th>
                                    <th className="py-3 px-3">Candidate</th>
                                    <th className="py-3 px-3">Role & Company</th>
                                    <th className="py-3 px-3">Experience</th>
                                    <th className="py-3 px-3">Skills</th>
                                    <th className="py-3 px-3">CTC (Cur → Exp)</th>
                                    <th className="py-3 px-3">Notice</th>
                                    <th className="py-3 px-3">Source</th>
                                    <th className="py-3 px-3">Pipeline Status</th>
                                    <th className="py-3 px-3">Rating</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {filteredCandidates.map((c: any) => {
                                    const isSelected = selectedIds.includes(c.id);

                                    return (
                                        <tr key={c.id} className={`hover:bg-neutral-50/60 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        setSelectedIds((prev) =>
                                                            prev.includes(c.id) ? prev.filter((i) => i !== c.id) : [...prev, c.id]
                                                        );
                                                    }}
                                                    className="rounded accent-primary cursor-pointer"
                                                />
                                            </td>

                                            <td className="py-3 px-3 font-bold text-neutral-900 min-w-[180px]">
                                                <button
                                                    onClick={() => setPreviewCandidate(c)}
                                                    className="hover:text-primary text-left font-bold text-[13px] block leading-snug"
                                                >
                                                    {c.name}
                                                </button>
                                                <p className="text-[10px] text-neutral-400 font-normal">{c.email || c.phone || "No contact"}</p>
                                            </td>

                                            <td className="py-3 px-3">
                                                <p className="font-semibold text-neutral-800 line-clamp-1">{c.currentDesignation || c.headline || "—"}</p>
                                                <p className="text-[10px] text-neutral-400">{c.currentCompany || "—"}</p>
                                            </td>

                                            <td className="py-3 px-3 font-medium">
                                                {c.totalExperienceYears || 0} yrs
                                            </td>

                                            <td className="py-3 px-3 max-w-[200px]">
                                                <div className="flex gap-1 flex-wrap">
                                                    {(c.skills || []).slice(0, 3).map((s: string) => (
                                                        <span key={s} className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[9px] font-semibold">
                                                            {s}
                                                        </span>
                                                    ))}
                                                    {(c.skills || []).length > 3 && (
                                                        <span className="text-[9px] text-neutral-400 font-bold">
                                                            +{(c.skills || []).length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3 px-3 text-neutral-600 whitespace-nowrap">
                                                ₹{c.currentCtcLpa || 0}L → <strong className="text-neutral-900 font-bold">₹{c.expectedCtcLpa || 0}L</strong>
                                            </td>

                                            <td className="py-3 px-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.noticePeriodDays <= 15
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-neutral-100 text-neutral-600"
                                                    }`}>
                                                    {c.noticePeriodDays || 30}d
                                                </span>
                                            </td>

                                            <td className="py-3 px-3 text-[10px] font-semibold text-neutral-500">
                                                {c.source || "DIRECT"}
                                            </td>

                                            <td className="py-3 px-3">
                                                {c.currentStage ? (
                                                    <div className="space-y-0.5">
                                                        <Badge value={c.currentStage} />
                                                        <p className="text-[9px] text-neutral-400 truncate max-w-[120px]">{c.jobTitle}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-neutral-400 font-medium">Available</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-3 text-amber-400 text-xs whitespace-nowrap">
                                                {"★".repeat(c.rating || 3)}
                                            </td>

                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {!c.currentStage && (
                                                        <button
                                                            onClick={() => {
                                                                setTargetCandidate(c);
                                                                setAddToPipelineOpen(true);
                                                            }}
                                                            className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold transition-colors"
                                                            title="Push candidate to requisition pipeline"
                                                        >
                                                            + Pipeline
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setPreviewCandidate(c)}
                                                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700"
                                                        title="Quick preview drawer"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <Link
                                                        href={`/ta/candidates/${c.id}`}
                                                        className="px-2.5 py-1 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-lg text-[11px] font-bold transition-colors"
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
            ) : (
                /* Card Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredCandidates.map((c: any) => (
                        <div
                            key={c.id}
                            className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                        >
                            <div className="space-y-2.5">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <button
                                            onClick={() => setPreviewCandidate(c)}
                                            className="font-bold text-neutral-900 text-sm hover:text-primary transition-colors text-left"
                                        >
                                            {c.name}
                                        </button>
                                        <p className="text-xs text-neutral-500 font-medium">
                                            {c.currentDesignation || c.headline || "Candidate"} · {c.currentCompany || "Available"}
                                        </p>
                                    </div>
                                    <span className="text-amber-400 text-xs">{"★".repeat(c.rating || 3)}</span>
                                </div>

                                <div className="flex flex-wrap gap-1">
                                    {(c.skills || []).slice(0, 4).map((s: string) => (
                                        <span key={s} className="px-2 py-0.5 bg-primary/5 text-primary rounded-md text-[10px] font-bold">
                                            {s}
                                        </span>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 pt-2 border-t border-neutral-100">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Experience</span>
                                        <p className="font-extrabold text-neutral-900">{c.totalExperienceYears} Years</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Notice Period</span>
                                        <p className="font-extrabold text-neutral-900">{c.noticePeriodDays || 30} Days</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Current CTC</span>
                                        <p className="font-extrabold text-neutral-900">₹{c.currentCtcLpa || 0} LPA</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Expected CTC</span>
                                        <p className="font-extrabold text-primary">₹{c.expectedCtcLpa || 0} LPA</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                                {c.currentStage ? (
                                    <div className="min-w-0">
                                        <Badge value={c.currentStage} />
                                        <p className="text-[9px] text-neutral-400 truncate mt-0.5">{c.jobTitle}</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setTargetCandidate(c);
                                            setAddToPipelineOpen(true);
                                        }}
                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        + Add to Pipeline
                                    </button>
                                )}

                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setPreviewCandidate(c)}
                                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400"
                                        title="Preview"
                                    >
                                        <Eye size={15} />
                                    </button>
                                    <Link
                                        href={`/ta/candidates/${c.id}`}
                                        className="px-3 py-1 bg-primary text-white hover:bg-primary-dark rounded-lg text-xs font-bold transition-colors"
                                    >
                                        360° Profile
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Preview Drawer for Candidate */}
            {previewCandidate && (
                <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
                    <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
                        <div className="space-y-5">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-100">
                                <div>
                                    <span className="text-[10px] font-mono font-bold text-neutral-400">
                                        {previewCandidate.candidateCode || previewCandidate.id}
                                    </span>
                                    <h2 className="text-xl font-black text-neutral-900">{previewCandidate.name}</h2>
                                    <p className="text-xs text-neutral-500 font-medium">
                                        {previewCandidate.currentDesignation || previewCandidate.headline || "Candidate"}
                                    </p>
                                    <p className="text-xs font-bold text-primary mt-0.5">
                                        {previewCandidate.currentCompany || "Available for hire"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setPreviewCandidate(null)}
                                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Contact Details */}
                            <div className="space-y-2 text-xs text-neutral-600 bg-neutral-50 p-3.5 rounded-xl border border-neutral-100">
                                <div className="flex items-center gap-2">
                                    <Mail size={13} className="text-neutral-400" />
                                    <span>{previewCandidate.email || "No email available"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone size={13} className="text-neutral-400" />
                                    <span>{previewCandidate.phone || "No phone available"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin size={13} className="text-neutral-400" />
                                    <span>{previewCandidate.location || "Bangalore, India"}</span>
                                </div>
                            </div>

                            {/* Key Stats */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Total Experience</p>
                                    <p className="font-extrabold text-neutral-900 mt-0.5">{previewCandidate.totalExperienceYears} Years</p>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Notice Period</p>
                                    <p className="font-extrabold text-neutral-900 mt-0.5">{previewCandidate.noticePeriodDays || 30} Days</p>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Current CTC</p>
                                    <p className="font-extrabold text-neutral-900 mt-0.5">₹{previewCandidate.currentCtcLpa || 0} LPA</p>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Expected CTC</p>
                                    <p className="font-extrabold text-primary mt-0.5">₹{previewCandidate.expectedCtcLpa || 0} LPA</p>
                                </div>
                            </div>

                            {/* Skills */}
                            {previewCandidate.skills && previewCandidate.skills.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-bold text-neutral-700">Skills & Tech Stack</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {previewCandidate.skills.map((s: string) => (
                                            <span
                                                key={s}
                                                className="px-2.5 py-1 bg-primary/10 text-primary font-bold rounded-lg text-xs"
                                            >
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pipeline status */}
                            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100 space-y-1 text-xs">
                                <span className="font-bold text-neutral-700 block">Current Pipeline Engagement</span>
                                {previewCandidate.currentStage ? (
                                    <div>
                                        <Badge value={previewCandidate.currentStage} />
                                        <p className="text-neutral-600 mt-1 font-medium">{previewCandidate.jobTitle}</p>
                                    </div>
                                ) : (
                                    <p className="text-neutral-500">Not actively tied to any requisition.</p>
                                )}
                            </div>
                        </div>

                        {/* Drawer Actions */}
                        <div className="pt-4 border-t border-neutral-100 space-y-2">
                            {!previewCandidate.currentStage && (
                                <button
                                    onClick={() => {
                                        setTargetCandidate(previewCandidate);
                                        setAddToPipelineOpen(true);
                                    }}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                                >
                                    <GitBranch size={14} /> Push to Requisition Pipeline
                                </button>
                            )}
                            <Link
                                href={`/ta/candidates/${previewCandidate.id}`}
                                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                            >
                                <ArrowRight size={14} /> Open 360° Candidate Profile
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Push Candidate to Pipeline */}
            {addToPipelineOpen && targetCandidate && (
                <ModalShell
                    title={`Push ${targetCandidate.name} to Pipeline`}
                    onClose={() => setAddToPipelineOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!pipelineForm.jobId) {
                                toast.error("Please select a target requisition");
                                return;
                            }
                            addToPipelineMutation.mutate();
                        }}
                        className="space-y-4"
                    >
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Target Requisition *</label>
                            <select
                                required
                                value={pipelineForm.jobId}
                                onChange={(e) => setPipelineForm({ ...pipelineForm, jobId: e.target.value })}
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            >
                                <option value="">Select Active Requisition</option>
                                {activeJobs.map((j: any) => (
                                    <option key={j.id} value={j.id}>
                                        {j.title} ({j.clientName} · {j.openings} openings)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Fit Score (0-100%)</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={pipelineForm.fitScore}
                                onChange={(e) => setPipelineForm({ ...pipelineForm, fitScore: e.target.value })}
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Screening Notes</label>
                            <textarea
                                rows={3}
                                value={pipelineForm.screeningNotes}
                                onChange={(e) => setPipelineForm({ ...pipelineForm, screeningNotes: e.target.value })}
                                placeholder="Why this candidate matches this requisition…"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setAddToPipelineOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={addToPipelineMutation.isPending}
                                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                            >
                                {addToPipelineMutation.isPending ? "Adding…" : "Push to Pipeline"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* Modal: Add New Candidate (with LIVE Duplicate Check) */}
            {addModalOpen && (
                <ModalShell
                    title="Add Candidate to Database"
                    onClose={() => setAddModalOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!newCandForm.name || !newCandForm.email) {
                                toast.error("Please fill Name and Email");
                                return;
                            }
                            createCandidateMutation.mutate({
                                name: newCandForm.name,
                                email: newCandForm.email,
                                phone: newCandForm.phone,
                                currentDesignation: newCandForm.currentDesignation,
                                currentCompany: newCandForm.currentCompany,
                                totalExperienceYears: parseFloat(newCandForm.totalExperienceYears) || 0,
                                currentCtcLpa: parseFloat(newCandForm.currentCtcLpa) || 0,
                                expectedCtcLpa: parseFloat(newCandForm.expectedCtcLpa) || 0,
                                noticePeriodDays: parseInt(newCandForm.noticePeriodDays) || 30,
                                location: newCandForm.location,
                                skills: newCandForm.skills.split(",").map((s) => s.trim()).filter(Boolean),
                                source: newCandForm.source,
                                rating: newCandForm.rating,
                            });
                        }}
                        className="space-y-4"
                    >
                        {/* Duplicate Alert Banner */}
                        {duplicateCandidate && (
                            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <AlertTriangle size={15} className="text-amber-600" />
                                    <span>Possible Duplicate Candidate Detected</span>
                                </div>
                                <p>
                                    A profile already exists for <strong>{duplicateCandidate.name}</strong> ({duplicateCandidate.email} · {duplicateCandidate.phone}).
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newCandForm.name}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Email Address *</label>
                                <input
                                    type="email"
                                    required
                                    value={newCandForm.email}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, email: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Phone Number</label>
                                <input
                                    type="text"
                                    value={newCandForm.phone}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, phone: e.target.value })}
                                    placeholder="+91 98765 43210"
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Location</label>
                                <input
                                    type="text"
                                    value={newCandForm.location}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, location: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Current Role</label>
                                <input
                                    type="text"
                                    value={newCandForm.currentDesignation}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, currentDesignation: e.target.value })}
                                    placeholder="Senior Software Engineer"
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Current Company</label>
                                <input
                                    type="text"
                                    value={newCandForm.currentCompany}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, currentCompany: e.target.value })}
                                    placeholder="TechNova Corp"
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Exp (Yrs)</label>
                                <input
                                    type="number"
                                    value={newCandForm.totalExperienceYears}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, totalExperienceYears: e.target.value })}
                                    className="w-full px-2.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Cur CTC (L)</label>
                                <input
                                    type="number"
                                    value={newCandForm.currentCtcLpa}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, currentCtcLpa: e.target.value })}
                                    className="w-full px-2.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Exp CTC (L)</label>
                                <input
                                    type="number"
                                    value={newCandForm.expectedCtcLpa}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, expectedCtcLpa: e.target.value })}
                                    className="w-full px-2.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Notice (Days)</label>
                                <input
                                    type="number"
                                    value={newCandForm.noticePeriodDays}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, noticePeriodDays: e.target.value })}
                                    className="w-full px-2.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Key Skills (Comma separated)</label>
                            <input
                                type="text"
                                value={newCandForm.skills}
                                onChange={(e) => setNewCandForm({ ...newCandForm, skills: e.target.value })}
                                placeholder="React, Node.js, Python, AWS"
                                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Source</label>
                                <select
                                    value={newCandForm.source}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, source: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    <option value="LINKEDIN">LinkedIn</option>
                                    <option value="NAUKRI">Naukri</option>
                                    <option value="REFERRAL">Referral</option>
                                    <option value="DIRECT">Direct Sourced</option>
                                    <option value="AGENCY">Agency</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Initial Rating (1–5)</label>
                                <select
                                    value={newCandForm.rating}
                                    onChange={(e) => setNewCandForm({ ...newCandForm, rating: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    <option value={5}>5 Stars (Strong Match)</option>
                                    <option value={4}>4 Stars (Good Candidate)</option>
                                    <option value={3}>3 Stars (Average)</option>
                                    <option value={2}>2 Stars (Below Par)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setAddModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createCandidateMutation.isPending}
                                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                            >
                                {createCandidateMutation.isPending ? "Creating…" : "Save Candidate"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
