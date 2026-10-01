"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Briefcase, MapPin, IndianRupee, Users, Flame, Search, Filter,
    Download, Plus, SlidersHorizontal, ArrowUpDown, ChevronRight,
    CheckCircle2, Clock, AlertTriangle, ShieldAlert, GitBranch,
    Calendar, Building2, UserCheck, Eye, MoreHorizontal, X, ArrowRight,
    Check, Sparkles, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";

export default function TaRequisitionsPage() {
    const router = useRouter();
    const qc = useQueryClient();

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ACTIVE");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [clientFilter, setClientFilter] = useState("ALL");
    const [viewMode, setViewMode] = useState<"table" | "cards">("table");
    const [sortField, setSortField] = useState<string>("createdAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Selection & Bulk Actions
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkActionOpen, setBulkActionOpen] = useState(false);

    // Drawers & Modals
    const [previewJob, setPreviewJob] = useState<any>(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [statusChangeModalOpen, setStatusChangeModalOpen] = useState(false);
    const [targetStatus, setTargetStatus] = useState("SOURCING");

    // Create form state
    const [formData, setFormData] = useState({
        title: "",
        clientId: "",
        department: "Engineering",
        location: "Bangalore",
        openings: "2",
        priority: "HIGH",
        salaryMinLpa: "15",
        salaryMaxLpa: "28",
        experienceMinYears: "4",
        experienceMaxYears: "8",
        skills: "React, Node.js, TypeScript, PostgreSQL",
        slaDays: "30",
        description: "",
    });

    // Fetch Requisitions
    const { data: jobs, isLoading, refetch } = useQuery({
        queryKey: ["ta-jobs"],
        queryFn: async () => {
            const res = await fetch("/api/admin/jobs");
            if (!res.ok) throw new Error("Failed to fetch requisitions");
            return res.json();
        },
        refetchInterval: 30000,
    });

    // Fetch Clients for dropdown
    const { data: clients } = useQuery({
        queryKey: ["admin-clients-dropdown"],
        queryFn: async () => {
            const res = await fetch("/api/admin/clients");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Create Requisition Mutation
    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/admin/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create requisition");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("New requisition created successfully!");
            setCreateModalOpen(false);
            setFormData({
                title: "",
                clientId: "",
                department: "Engineering",
                location: "Bangalore",
                openings: "2",
                priority: "HIGH",
                salaryMinLpa: "15",
                salaryMaxLpa: "28",
                experienceMinYears: "4",
                experienceMaxYears: "8",
                skills: "React, Node.js, TypeScript, PostgreSQL",
                slaDays: "30",
                description: "",
            });
            qc.invalidateQueries({ queryKey: ["ta-jobs"] });
            qc.invalidateQueries({ queryKey: ["ta-dashboard"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    // Bulk status update mutation
    const bulkStatusMutation = useMutation({
        mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
            const promises = ids.map((id) =>
                fetch(`/api/admin/jobs/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                })
            );
            await Promise.all(promises);
        },
        onSuccess: () => {
            toast.success(`Updated ${selectedIds.length} requisitions to ${targetStatus}`);
            setSelectedIds([]);
            setStatusChangeModalOpen(false);
            qc.invalidateQueries({ queryKey: ["ta-jobs"] });
            qc.invalidateQueries({ queryKey: ["ta-dashboard"] });
        },
        onError: () => toast.error("Failed to update requisitions"),
    });

    const allJobs = Array.isArray(jobs) ? jobs : [];
    const clientList = Array.isArray(clients) ? clients : [];

    // Filtered & Sorted Jobs
    const filteredJobs = useMemo(() => {
        let list = [...allJobs];

        // Status Filter
        if (statusFilter === "ACTIVE") {
            list = list.filter((j) => ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status));
        } else if (statusFilter === "URGENT_ONLY") {
            list = list.filter((j) => (j.priority === "URGENT" || j.priority === "CRITICAL") && !["FULFILLED", "CLOSED", "CANCELLED"].includes(j.status));
        } else if (statusFilter === "SLA_AT_RISK") {
            list = list.filter((j) => j.calculatedSlaStatus === "AT_RISK" || j.calculatedSlaStatus === "OVERDUE" || (j.daysRemaining != null && j.daysRemaining <= 5));
        } else if (statusFilter !== "ALL") {
            list = list.filter((j) => j.status === statusFilter);
        }

        // Priority Filter
        if (priorityFilter !== "ALL") {
            list = list.filter((j) => j.priority === priorityFilter);
        }

        // Client Filter
        if (clientFilter !== "ALL") {
            list = list.filter((j) => j.clientId === clientFilter);
        }

        // Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (j) =>
                    j.title?.toLowerCase().includes(q) ||
                    j.clientName?.toLowerCase().includes(q) ||
                    j.id?.toLowerCase().includes(q) ||
                    j.department?.toLowerCase().includes(q) ||
                    (j.skills && j.skills.some((s: string) => s.toLowerCase().includes(q)))
            );
        }

        // Sorting
        list.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            if (sortField === "openings") {
                valA = Number(valA || 0);
                valB = Number(valB || 0);
            }
            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });

        return list;
    }, [allJobs, statusFilter, priorityFilter, clientFilter, searchQuery, sortField, sortOrder]);

    // KPI Metrics
    const metrics = useMemo(() => {
        const active = allJobs.filter((j) => ["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE"].includes(j.status));
        const urgent = allJobs.filter((j) => (j.priority === "URGENT" || j.priority === "CRITICAL") && !["FULFILLED", "CLOSED", "CANCELLED"].includes(j.status));
        const aging = allJobs.filter((j) => j.daysOpen >= 14 && !["FULFILLED", "CLOSED"].includes(j.status));
        const slaRisk = allJobs.filter((j) => (j.calculatedSlaStatus === "AT_RISK" || j.calculatedSlaStatus === "OVERDUE" || (j.daysRemaining != null && j.daysRemaining <= 5)) && !["FULFILLED", "CLOSED"].includes(j.status));
        const fulfilledMtd = allJobs.filter((j) => j.status === "FULFILLED");
        const totalOpenings = active.reduce((acc, curr) => acc + (curr.openings || 1), 0);
        const totalFilled = active.reduce((acc, curr) => acc + (curr.filled || 0), 0);

        return {
            activeCount: active.length,
            urgentCount: urgent.length,
            agingCount: aging.length,
            slaRiskCount: slaRisk.length,
            fulfilledCount: fulfilledMtd.length,
            totalOpenings,
            totalFilled,
        };
    }, [allJobs]);

    // Handle Checkbox Selection
    const toggleSelectAll = () => {
        if (selectedIds.length === filteredJobs.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredJobs.map((j) => j.id));
        }
    };

    const toggleSelectRow = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    // Export CSV
    const exportCsv = (subset?: any[]) => {
        const dataToExport = subset || (selectedIds.length > 0 ? allJobs.filter((j) => selectedIds.includes(j.id)) : filteredJobs);
        if (dataToExport.length === 0) {
            toast.error("No data to export");
            return;
        }

        const headers = ["Requisition ID", "Title", "Client", "Department", "Location", "Priority", "Openings", "Filled", "In Pipeline", "SLA Status", "Days Open", "Status"];
        const rows = dataToExport.map((j) => [
            j.id,
            `"${j.title?.replace(/"/g, '""')}"`,
            `"${j.clientName?.replace(/"/g, '""')}"`,
            j.department || "Engineering",
            j.location || "Remote",
            j.priority,
            j.openings || 1,
            j.filled || 0,
            j.inPipeline || 0,
            j.calculatedSlaStatus || "ON_TRACK",
            j.daysOpen || 0,
            j.status,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `AbsoJob_Requisitions_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${dataToExport.length} requisitions to CSV.`);
    };

    // Form submit for create
    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.clientId) {
            toast.error("Please fill required fields (Job Title and Client)");
            return;
        }

        const payload = {
            title: formData.title,
            clientId: formData.clientId,
            department: formData.department,
            location: formData.location,
            openings: parseInt(formData.openings) || 1,
            priority: formData.priority,
            salaryMinLpa: parseFloat(formData.salaryMinLpa) || 10,
            salaryMaxLpa: parseFloat(formData.salaryMaxLpa) || 20,
            experienceMinYears: parseInt(formData.experienceMinYears) || 2,
            experienceMaxYears: parseInt(formData.experienceMaxYears) || 6,
            skills: formData.skills.split(",").map((s) => s.trim()).filter(Boolean),
            slaDays: parseInt(formData.slaDays) || 30,
            description: formData.description || `Hiring for ${formData.title} in ${formData.department} department.`,
        };

        createMutation.mutate(payload);
    };

    return (
        <div className="space-y-6 pb-16 max-w-[1600px] mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Demand Center
                        </span>
                        <span className="text-xs text-neutral-400 font-bold">Hiring Requisitions</span>
                    </div>
                    <h1 className="text-2xl font-black text-neutral-900 mt-0.5">Requisitions</h1>
                    <p className="text-xs text-neutral-500 font-medium">
                        Manage client hiring requirements, SLA health, ownership and candidate demand.
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
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all hover:scale-[1.02]"
                    >
                        <Plus size={15} /> + New Requisition
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard
                    label="Open Requisitions"
                    value={metrics.activeCount}
                    icon={Briefcase}
                    tone="primary"
                    hint={`${metrics.totalOpenings} openings target`}
                />
                <StatCard
                    label="Urgent & Critical"
                    value={metrics.urgentCount}
                    icon={Flame}
                    tone="red"
                    hint="Requires immediate sourcing"
                />
                <StatCard
                    label="Aging (>14d)"
                    value={metrics.agingCount}
                    icon={Clock}
                    tone="amber"
                    hint="Review candidate flow"
                />
                <StatCard
                    label="SLA At Risk"
                    value={metrics.slaRiskCount}
                    icon={AlertTriangle}
                    tone="purple"
                    hint="Delivery benchmark risk"
                />
                <StatCard
                    label="Fulfilled (MTD)"
                    value={metrics.fulfilledCount}
                    icon={CheckCircle2}
                    tone="emerald"
                    hint="Closed positions"
                />
                <StatCard
                    label="Filled / Target"
                    value={`${metrics.totalFilled}/${metrics.totalOpenings}`}
                    icon={Users}
                    tone="blue"
                    hint={`${Math.round((metrics.totalFilled / Math.max(metrics.totalOpenings, 1)) * 100)}% progress`}
                />
            </div>

            {/* Filter Bar & Search */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search title, client, ID, skill, department…"
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
                        {/* Priority */}
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            aria-label="Filter by priority"
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer"
                        >
                            <option value="ALL">All Priorities</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="URGENT">Urgent</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>

                        {/* Client Filter */}
                        <select
                            value={clientFilter}
                            onChange={(e) => setClientFilter(e.target.value)}
                            aria-label="Filter by client"
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer max-w-[180px] truncate"
                        >
                            <option value="ALL">All Clients</option>
                            {clientList.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.companyName}</option>
                            ))}
                        </select>

                        {/* View Switcher */}
                        <div className="flex items-center bg-neutral-100 p-0.5 rounded-xl border border-neutral-200/60">
                            <button
                                onClick={() => setViewMode("table")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === "table" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"}`}
                            >
                                Table
                            </button>
                            <button
                                onClick={() => setViewMode("cards")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === "cards" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"}`}
                            >
                                Cards
                            </button>
                        </div>
                    </div>
                </div>

                {/* Saved Views / Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-neutral-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mr-1 flex items-center gap-1">
                        <SlidersHorizontal size={11} /> Views:
                    </span>
                    {[
                        { id: "ACTIVE", label: "Active Requisitions" },
                        { id: "URGENT_ONLY", label: "Urgent Only" },
                        { id: "SLA_AT_RISK", label: "SLA At Risk" },
                        { id: "SOURCING", label: "In Sourcing" },
                        { id: "INTERVIEWING", label: "Interviewing" },
                        { id: "OFFER_STAGE", label: "Offer Stage" },
                        { id: "FULFILLED", label: "Fulfilled" },
                        { id: "ALL", label: "All Records" },
                    ].map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => setStatusFilter(preset.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${statusFilter === preset.id
                                ? "bg-primary text-white shadow-xs"
                                : "bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 text-neutral-600"
                                }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                    {(statusFilter !== "ACTIVE" || priorityFilter !== "ALL" || clientFilter !== "ALL" || searchQuery) && (
                        <button
                            onClick={() => {
                                setStatusFilter("ACTIVE");
                                setPriorityFilter("ALL");
                                setClientFilter("ALL");
                                setSearchQuery("");
                            }}
                            className="px-2.5 py-1 text-xs text-red-600 hover:underline font-bold ml-auto"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Actions Banner (Visible when rows selected) */}
            {selectedIds.length > 0 && (
                <div className="bg-primary/95 text-white px-4 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-lg animate-fade-in">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-black text-xs">
                            {selectedIds.length}
                        </span>
                        <span className="text-xs font-bold">
                            {selectedIds.length} requisition{selectedIds.length > 1 ? "s" : ""} selected
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setStatusChangeModalOpen(true)}
                            className="px-3 py-1.5 bg-white text-primary hover:bg-neutral-50 rounded-xl text-xs font-bold transition-colors"
                        >
                            Change Status
                        </button>
                        <button
                            onClick={() => exportCsv(allJobs.filter((j) => selectedIds.includes(j.id)))}
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
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-neutral-100" />
                    ))}
                </div>
            ) : filteredJobs.length === 0 ? (
                <SectionCard>
                    <EmptyState
                        icon={Briefcase}
                        message="No requisitions match the current criteria."
                        action={
                            <button
                                onClick={() => setCreateModalOpen(true)}
                                className="mt-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
                            >
                                Create Requisition
                            </button>
                        }
                    />
                </SectionCard>
            ) : viewMode === "table" ? (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[1100px]">
                            <thead>
                                <tr className="bg-neutral-50/80 border-b border-neutral-200/70 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="py-3 px-4 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            aria-label="Select all requisitions"
                                            checked={selectedIds.length === filteredJobs.length && filteredJobs.length > 0}
                                            onChange={toggleSelectAll}
                                            className="rounded accent-primary cursor-pointer"
                                        />
                                    </th>
                                    <th className="py-3 px-3">Requisition</th>
                                    <th className="py-3 px-3">Client</th>
                                    <th className="py-3 px-3">Priority</th>
                                    <th className="py-3 px-3">Openings & Progress</th>
                                    <th className="py-3 px-3 text-center">In Pipeline</th>
                                    <th className="py-3 px-3">Owner / TA</th>
                                    <th className="py-3 px-3">SLA Status</th>
                                    <th className="py-3 px-3">Age</th>
                                    <th className="py-3 px-3">Status</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {filteredJobs.map((j: any) => {
                                    const isSelected = selectedIds.includes(j.id);
                                    const progress = Math.min(100, Math.round(((j.filled || 0) / Math.max(j.openings || 1, 1)) * 100));
                                    const slaDaysLeft = j.daysRemaining != null ? j.daysRemaining : 15;
                                    const isBreached = slaDaysLeft < 0;
                                    const isAtRisk = slaDaysLeft >= 0 && slaDaysLeft <= 5;

                                    return (
                                        <tr
                                            key={j.id}
                                            className={`hover:bg-neutral-50/60 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                                        >
                                            <td className="py-3.5 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select requisition ${j.title}`}
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectRow(j.id)}
                                                    className="rounded accent-primary cursor-pointer"
                                                />
                                            </td>

                                            {/* Requisition Title & ID */}
                                            <td className="py-3.5 px-3 min-w-[220px]">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-[10px] text-neutral-400 font-bold">
                                                            {j.id.startsWith("job-") ? `REQ-${j.id.slice(4)}` : j.id}
                                                        </span>
                                                    </div>
                                                    <Link
                                                        href={`/ta/requisitions/${j.id}`}
                                                        className="font-bold text-neutral-900 hover:text-primary transition-colors text-[13px] block leading-snug line-clamp-1"
                                                    >
                                                        {j.title}
                                                    </Link>
                                                    <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                                                        <span>{j.department || "Engineering"}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-0.5">
                                                            <MapPin size={10} /> {j.location || "Bangalore"}
                                                        </span>
                                                        <span>•</span>
                                                        <span>₹{j.salaryMinLpa}–{j.salaryMaxLpa}L</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Client */}
                                            <td className="py-3.5 px-3">
                                                <div className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-primary/70 shrink-0" />
                                                    <span className="truncate max-w-[140px]">{j.clientName || "—"}</span>
                                                </div>
                                                <span className="text-[10px] text-neutral-400 block truncate max-w-[140px]">
                                                    {j.clientIndustry || "Technology"}
                                                </span>
                                            </td>

                                            {/* Priority */}
                                            <td className="py-3.5 px-3">
                                                <Badge value={j.priority} />
                                            </td>

                                            {/* Openings & Progress */}
                                            <td className="py-3.5 px-3 min-w-[140px]">
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="font-bold text-neutral-700">
                                                            {j.filled || 0} / {j.openings || 1} filled
                                                        </span>
                                                        <span className="text-[10px] text-neutral-400 font-semibold">
                                                            {progress}%
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden w-full">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${progress >= 100
                                                                ? "bg-emerald-500"
                                                                : progress > 0
                                                                    ? "bg-primary"
                                                                    : "bg-neutral-200"
                                                                }`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Pipeline Count */}
                                            <td className="py-3.5 px-3 text-center">
                                                <Link
                                                    href={`/ta/pipeline?jobId=${j.id}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-black text-xs transition-colors"
                                                    title="View candidate pipeline"
                                                >
                                                    <Users size={12} />
                                                    <span>{j.inPipeline || 0}</span>
                                                </Link>
                                            </td>

                                            {/* Owner */}
                                            <td className="py-3.5 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px]">
                                                        {(j.primaryRecruiterName || j.requestedByName || "U").charAt(0)}
                                                    </div>
                                                    <span className="font-semibold text-neutral-700 truncate max-w-[110px]">
                                                        {j.primaryRecruiterName || j.requestedByName || "Unassigned"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* SLA Status */}
                                            <td className="py-3.5 px-3">
                                                {isBreached ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                                                        <ShieldAlert size={10} /> Overdue ({Math.abs(slaDaysLeft)}d)
                                                    </span>
                                                ) : isAtRisk ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                                        <AlertTriangle size={10} /> {slaDaysLeft}d left
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                        <CheckCircle2 size={10} /> {slaDaysLeft}d SLA
                                                    </span>
                                                )}
                                            </td>

                                            {/* Age */}
                                            <td className="py-3.5 px-3">
                                                <span className="text-neutral-500 font-medium">
                                                    {j.daysOpen || 0}d
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="py-3.5 px-3">
                                                <Badge value={j.status} />
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => setPreviewJob(j)}
                                                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-800 transition-colors"
                                                        title="Quick preview"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <Link
                                                        href={`/ta/requisitions/${j.id}`}
                                                        className="px-2.5 py-1 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-lg text-[11px] font-bold transition-all"
                                                    >
                                                        Detail
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
                    {filteredJobs.map((j: any) => {
                        const progress = Math.min(100, Math.round(((j.filled || 0) / Math.max(j.openings || 1, 1)) * 100));
                        const slaDaysLeft = j.daysRemaining != null ? j.daysRemaining : 15;
                        const isBreached = slaDaysLeft < 0;
                        const isAtRisk = slaDaysLeft >= 0 && slaDaysLeft <= 5;

                        return (
                            <div
                                key={j.id}
                                className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="text-[10px] font-mono font-bold text-neutral-400 block">
                                                {j.id.startsWith("job-") ? `REQ-${j.id.slice(4)}` : j.id}
                                            </span>
                                            <Link
                                                href={`/ta/requisitions/${j.id}`}
                                                className="font-bold text-neutral-900 hover:text-primary transition-colors text-base line-clamp-1"
                                            >
                                                {j.title}
                                            </Link>
                                            <p className="text-xs font-bold text-primary flex items-center gap-1 mt-0.5">
                                                <Building2 size={12} /> {j.clientName}
                                            </p>
                                        </div>
                                        <Badge value={j.priority} />
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <MapPin size={12} /> {j.location}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <IndianRupee size={12} /> {j.salaryMinLpa}–{j.salaryMaxLpa} LPA
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} /> {j.daysOpen}d open
                                        </span>
                                    </div>

                                    {/* Skills */}
                                    {j.skills && j.skills.length > 0 && (
                                        <div className="flex gap-1.5 flex-wrap pt-1">
                                            {j.skills.slice(0, 4).map((s: string) => (
                                                <span
                                                    key={s}
                                                    className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md text-[10px] font-semibold"
                                                >
                                                    {s}
                                                </span>
                                            ))}
                                            {j.skills.length > 4 && (
                                                <span className="px-1.5 py-0.5 bg-neutral-50 text-neutral-400 rounded-md text-[10px]">
                                                    +{j.skills.length - 4}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 pt-2 border-t border-neutral-100">
                                    {/* Fill Progress Bar */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-neutral-500 font-semibold">Filled:</span>
                                            <span className="font-extrabold text-neutral-900">
                                                {j.filled || 0} / {j.openings || 1} ({progress}%)
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary to-emerald-600 rounded-full transition-all"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Bottom strip */}
                                    <div className="flex items-center justify-between text-xs pt-1">
                                        <div className="flex items-center gap-1.5">
                                            <Badge value={j.status} />
                                            {isBreached ? (
                                                <span className="text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                                    Breached
                                                </span>
                                            ) : isAtRisk ? (
                                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                                    {slaDaysLeft}d SLA
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/ta/pipeline?jobId=${j.id}`}
                                                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                            >
                                                <Users size={12} /> {j.inPipeline || 0}
                                            </Link>
                                            <Link
                                                href={`/ta/requisitions/${j.id}`}
                                                className="px-3 py-1 bg-primary text-white hover:bg-primary-dark rounded-lg text-xs font-bold transition-colors"
                                            >
                                                View
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Quick Preview Drawer */}
            {previewJob && (
                <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
                    <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
                        <div className="space-y-5">
                            {/* Drawer Header */}
                            <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-100">
                                <div>
                                    <span className="text-[10px] font-mono font-bold text-neutral-400">
                                        {previewJob.id.startsWith("job-") ? `REQ-${previewJob.id.slice(4)}` : previewJob.id}
                                    </span>
                                    <h2 className="text-lg font-black text-neutral-900">{previewJob.title}</h2>
                                    <p className="text-xs font-bold text-primary flex items-center gap-1 mt-0.5">
                                        <Building2 size={13} /> {previewJob.clientName}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setPreviewJob(null)}
                                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Status and Priority */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge value={previewJob.priority} />
                                <Badge value={previewJob.status} />
                                <span className="text-xs text-neutral-400 font-semibold">
                                    Created {new Date(previewJob.createdAt).toLocaleDateString("en-IN")}
                                </span>
                            </div>

                            {/* Key Stats Grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Openings</p>
                                    <p className="text-base font-extrabold text-neutral-900 mt-0.5">
                                        {previewJob.filled || 0} / {previewJob.openings || 1}
                                    </p>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">In Pipeline</p>
                                    <p className="text-base font-extrabold text-blue-600 mt-0.5">
                                        {previewJob.inPipeline || 0} candidates
                                    </p>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">CTC Budget</p>
                                    <p className="text-base font-extrabold text-neutral-900 mt-0.5">
                                        ₹{previewJob.salaryMinLpa}–{previewJob.salaryMaxLpa} LPA
                                    </p>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                    <p className="text-[10px] uppercase font-bold text-neutral-400">Days Open</p>
                                    <p className="text-base font-extrabold text-neutral-900 mt-0.5">
                                        {previewJob.daysOpen || 0} days
                                    </p>
                                </div>
                            </div>

                            {/* SLA Target & Health */}
                            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-neutral-700">SLA Health</span>
                                    <span className="text-[11px] font-black text-primary">
                                        Target: {previewJob.slaDays || 30} Days
                                    </span>
                                </div>
                                <p className="text-[11px] text-neutral-500">
                                    {previewJob.daysRemaining != null && previewJob.daysRemaining < 0
                                        ? `Breached by ${Math.abs(previewJob.daysRemaining)} days. Needs immediate sourcing attention.`
                                        : `${previewJob.daysRemaining || 15} days remaining to fulfill position.`}
                                </p>
                            </div>

                            {/* Required Skills */}
                            {previewJob.skills && previewJob.skills.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-bold text-neutral-700">Required Skills</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {previewJob.skills.map((s: string) => (
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

                            {/* Location & Experience */}
                            <div className="space-y-1 text-xs text-neutral-600">
                                <p><strong>Location:</strong> {previewJob.location || "Remote"}</p>
                                <p><strong>Experience:</strong> {previewJob.experienceMinYears}–{previewJob.experienceMaxYears} years</p>
                                <p><strong>Owner:</strong> {previewJob.primaryRecruiterName || previewJob.requestedByName || "Unassigned"}</p>
                            </div>
                        </div>

                        {/* Drawer Actions */}
                        <div className="pt-4 border-t border-neutral-100 space-y-2">
                            <Link
                                href={`/ta/pipeline?jobId=${previewJob.id}`}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                            >
                                <GitBranch size={14} /> Open Candidate Pipeline
                            </Link>
                            <Link
                                href={`/ta/requisitions/${previewJob.id}`}
                                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                            >
                                <ArrowRight size={14} /> View Full 360° Requisition
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Create Requisition */}
            {createModalOpen && (
                <ModalShell
                    title="Create New Requisition"
                    onClose={() => setCreateModalOpen(false)}
                >
                    <form onSubmit={handleCreateSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Job Title *</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g. Senior Backend Engineer"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Client *</label>
                                <select
                                    required
                                    value={formData.clientId}
                                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                >
                                    <option value="">Select Client</option>
                                    {clientList.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.companyName}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Department</label>
                                <input
                                    type="text"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Openings</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.openings}
                                    onChange={(e) => setFormData({ ...formData, openings: e.target.value })}
                                    className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Priority</label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                >
                                    <option value="CRITICAL">Critical</option>
                                    <option value="URGENT">Urgent</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">SLA Target (Days)</label>
                                <input
                                    type="number"
                                    value={formData.slaDays}
                                    onChange={(e) => setFormData({ ...formData, slaDays: e.target.value })}
                                    className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">CTC Budget (LPA)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        value={formData.salaryMinLpa}
                                        onChange={(e) => setFormData({ ...formData, salaryMinLpa: e.target.value })}
                                        className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                    />
                                    <span className="text-xs text-neutral-400">to</span>
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={formData.salaryMaxLpa}
                                        onChange={(e) => setFormData({ ...formData, salaryMaxLpa: e.target.value })}
                                        className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Experience (Years)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        value={formData.experienceMinYears}
                                        onChange={(e) => setFormData({ ...formData, experienceMinYears: e.target.value })}
                                        className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                    />
                                    <span className="text-xs text-neutral-400">to</span>
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={formData.experienceMaxYears}
                                        onChange={(e) => setFormData({ ...formData, experienceMaxYears: e.target.value })}
                                        className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Mandatory Skills (Comma separated)</label>
                            <input
                                type="text"
                                value={formData.skills}
                                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                                placeholder="React, Node.js, AWS, PostgreSQL"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Job Description Summary</label>
                            <textarea
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Role responsibilities, client background, must-haves…"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setCreateModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                            >
                                {createMutation.isPending ? "Creating…" : "Create Requisition"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* Modal: Bulk Status Change */}
            {statusChangeModalOpen && (
                <ModalShell
                    title="Change Status for Selected Requisitions"
                    onClose={() => setStatusChangeModalOpen(false)}
                >
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-neutral-700">Target Status</label>
                            <select
                                value={targetStatus}
                                onChange={(e) => setTargetStatus(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none font-bold"
                            >
                                <option value="SOURCING">SOURCING</option>
                                <option value="INTERVIEWING">INTERVIEWING</option>
                                <option value="OFFER_STAGE">OFFER_STAGE</option>
                                <option value="FULFILLED">FULFILLED</option>
                                <option value="ON_HOLD">ON_HOLD</option>
                                <option value="CANCELLED">CANCELLED</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setStatusChangeModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={bulkStatusMutation.isPending}
                                onClick={() => bulkStatusMutation.mutate({ ids: selectedIds, status: targetStatus })}
                                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                            >
                                {bulkStatusMutation.isPending ? "Updating…" : "Apply Status"}
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
