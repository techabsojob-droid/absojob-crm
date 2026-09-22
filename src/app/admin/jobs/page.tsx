"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    Briefcase, MapPin, IndianRupee, Clock, CheckCircle2, XCircle, Plus,
    Edit2, Trash2, Search, Filter, AlertTriangle, Users, ArrowRight,
    Layers, SlidersHorizontal, CheckSquare, Sparkles, AlertCircle, FileText,
    TrendingUp, ShieldAlert, ArrowUpDown, ChevronRight, X
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function AdminJobsPage() {
    const qc = useQueryClient();

    // Filters and Search state
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [clientFilter, setClientFilter] = useState("ALL");
    const [recruiterFilter, setRecruiterFilter] = useState("ALL");
    const [slaFilter, setSlaFilter] = useState("ALL"); // "ALL" | "NEAR" | "OVER"
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
    const [sortBy, setSortBy] = useState<"newest" | "priority" | "openings" | "sla">("newest");
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

    // Modals
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [statusChangeModalOpen, setStatusChangeModalOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [targetStatus, setTargetStatus] = useState<string>("");
    const [statusReason, setStatusReason] = useState<string>("");

    // Form for Create / Edit (Multi-step capable)
    const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
    const [form, setForm] = useState({
        clientId: "",
        title: "",
        department: "Engineering",
        location: "Mumbai",
        workMode: "HYBRID",
        employmentType: "FULL_TIME",
        priority: "MEDIUM",
        priorityReason: "",
        openings: "1",
        salaryMinLpa: "12",
        salaryMaxLpa: "20",
        experienceMinYears: "3",
        experienceMaxYears: "7",
        skills: "Node.js, PostgreSQL",
        preferredSkills: "AWS, Redis",
        education: "B.Tech / B.E. / BCA / MCA",
        noticePeriodPreference: "Immediate to 30 Days",
        primaryRecruiterId: "",
        slaDays: "30",
        tags: "Urgent",
        description: "",
        status: "APPROVED"
    });

    // Queries
    const { data: clients } = useQuery({
        queryKey: ["clients"],
        queryFn: async () => (await fetch("/api/admin/clients")).json()
    });

    const { data: teamMembers } = useQuery({
        queryKey: ["team-members"],
        queryFn: async () => {
            const res = await fetch("/api/admin/attendance");
            if (!res.ok) return [];
            const d = await res.json();
            return d.users || [];
        }
    });

    const { data: jobs, isLoading } = useQuery({
        queryKey: ["admin-jobs", statusFilter, priorityFilter, clientFilter, recruiterFilter, slaFilter, searchQuery],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== "ALL") params.append("status", statusFilter);
            if (priorityFilter !== "ALL") params.append("priority", priorityFilter);
            if (clientFilter !== "ALL") params.append("clientId", clientFilter);
            if (recruiterFilter !== "ALL") params.append("recruiterId", recruiterFilter);
            if (slaFilter !== "ALL") params.append("slaRisk", slaFilter);
            if (searchQuery.trim()) params.append("q", searchQuery.trim());

            const res = await fetch(`/api/admin/jobs?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to load requisitions");
            return res.json();
        },
        refetchInterval: 15000,
    });

    // Create Job Mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Job Requisition created successfully.");
            setCreateModalOpen(false);
            setFormStep(1);
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Update Job Mutation
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!selectedJob?.id) return;
            const res = await fetch("/api/admin/jobs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedJob.id,
                    ...form,
                }),
            });
            if (!res.ok) throw new Error("Failed to update job");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Job updated successfully.");
            setEditModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: () => toast.error("Failed to update job"),
    });

    // Quick Status / Approval Patch Mutation
    const patchStatusMutation = useMutation({
        mutationFn: async ({ id, action, status, reason }: { id: string; action?: string; status?: string; reason?: string }) => {
            const res = await fetch("/api/admin/jobs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action, status, reason }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.action === "approve" ? "Requisition approved & sourcing unlocked." : "Job status updated.");
            setStatusChangeModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: () => toast.error("Update failed"),
    });

    // Delete Job Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/admin/jobs?id=${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete job");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Job deleted successfully.");
            setDeleteModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: () => toast.error("Failed to delete job"),
    });

    const openEdit = (job: any) => {
        setSelectedJob(job);
        setForm({
            clientId: job.clientId || "",
            title: job.title || "",
            department: job.department || "Engineering",
            location: job.location || "",
            workMode: job.workMode || "HYBRID",
            employmentType: job.employmentType || "FULL_TIME",
            priority: job.priority || "MEDIUM",
            priorityReason: job.priorityReason || "",
            openings: String(job.openings || "1"),
            salaryMinLpa: String(job.salaryMinLpa || ""),
            salaryMaxLpa: String(job.salaryMaxLpa || ""),
            experienceMinYears: String(job.experienceMinYears || ""),
            experienceMaxYears: String(job.experienceMaxYears || ""),
            skills: Array.isArray(job.skills) ? job.skills.join(", ") : (job.skills || ""),
            preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills.join(", ") : (job.preferredSkills || ""),
            education: job.education || "",
            noticePeriodPreference: job.noticePeriodPreference || "",
            primaryRecruiterId: job.primaryRecruiterId || job.assignedTas?.[0] || "",
            slaDays: String(job.slaDays || "30"),
            tags: Array.isArray(job.tags) ? job.tags.join(", ") : (job.tags || ""),
            description: job.description || "",
            status: job.status || "APPROVED",
        });
        setFormStep(1);
        setEditModalOpen(true);
    };

    const openCreate = () => {
        setForm({
            clientId: "",
            title: "",
            department: "Engineering",
            location: "Mumbai",
            workMode: "HYBRID",
            employmentType: "FULL_TIME",
            priority: "MEDIUM",
            priorityReason: "",
            openings: "1",
            salaryMinLpa: "12",
            salaryMaxLpa: "20",
            experienceMinYears: "3",
            experienceMaxYears: "7",
            skills: "",
            preferredSkills: "",
            education: "B.Tech / B.E. / BCA / MCA",
            noticePeriodPreference: "Immediate to 30 Days",
            primaryRecruiterId: "",
            slaDays: "30",
            tags: "Urgent",
            description: "",
            status: "APPROVED",
        });
        setFormStep(1);
        setCreateModalOpen(true);
    };

    const handlePromptStatusChange = (job: any, newStatus: string) => {
        setSelectedJob(job);
        setTargetStatus(newStatus);
        setStatusReason("");
        setStatusChangeModalOpen(true);
    };

    const all = Array.isArray(jobs) ? jobs : [];

    // Filter & Sort calculation
    const processedJobs = useMemo(() => {
        let list = [...all];
        if (sortBy === "priority") {
            const pOrder: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
            list.sort((a, b) => (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0));
        } else if (sortBy === "openings") {
            list.sort((a, b) => (b.openings || 1) - (a.openings || 1));
        } else if (sortBy === "sla") {
            list.sort((a, b) => (a.daysRemaining ?? 99) - (b.daysRemaining ?? 99));
        }
        return list;
    }, [all, sortBy]);

    // KPI Summary Calculations
    const pendingCount = all.filter((j: any) => j.status === "PENDING_APPROVAL").length;
    const activeRequisitions = all.filter((j: any) => ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE", "JOINING"].includes(j.status));
    const totalOpenPositions = activeRequisitions.reduce((acc, j) => acc + (j.remainingOpenings ?? Math.max(0, (j.openings || 1) - (j.filled || 0))), 0);
    const nearSlaCount = all.filter((j: any) => j.calculatedSlaStatus === "AT_RISK" || j.calculatedSlaStatus === "OVERDUE").length;
    const fulfilledCount = all.filter((j: any) => j.status === "FULFILLED").length;
    const cancelledOrClosedCount = all.filter((j: any) => ["CANCELLED", "CLOSED"].includes(j.status)).length;

    const resetFilters = () => {
        setStatusFilter("ALL");
        setPriorityFilter("ALL");
        setClientFilter("ALL");
        setRecruiterFilter("ALL");
        setSlaFilter("ALL");
        setSearchQuery("");
        setFilterDrawerOpen(false);
    };

    const activeFilterCount = (statusFilter !== "ALL" ? 1 : 0) +
        (priorityFilter !== "ALL" ? 1 : 0) +
        (clientFilter !== "ALL" ? 1 : 0) +
        (recruiterFilter !== "ALL" ? 1 : 0) +
        (slaFilter !== "ALL" ? 1 : 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Job Requisitions"
                subtitle="Create, manage and monitor the complete lifecycle of client hiring mandates."
                action={
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                                activeFilterCount > 0 ? "border-primary bg-primary/5 text-primary" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                            }`}
                        >
                            <SlidersHorizontal size={14} />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={openCreate}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2 cursor-pointer"
                        >
                            <Plus size={16} /> New Requisition
                        </button>
                    </div>
                }
            />

            {/* Clickable KPI Strip (Part 4 of Master Prompt) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <button
                    onClick={() => { setStatusFilter("PENDING_APPROVAL"); setSlaFilter("ALL"); }}
                    className="text-left w-full focus:outline-none"
                >
                    <StatCard
                        label="Pending Approval"
                        value={pendingCount}
                        icon={Clock}
                        tone={pendingCount > 0 ? "amber" : "emerald"}
                        hint="Awaiting signoff"
                    />
                </button>
                <button
                    onClick={() => { setStatusFilter("ALL"); setSlaFilter("ALL"); }}
                    className="text-left w-full focus:outline-none"
                >
                    <StatCard
                        label="Open Mandates"
                        value={activeRequisitions.length}
                        icon={Briefcase}
                        tone="blue"
                        hint="Active requisitions"
                    />
                </button>
                <button
                    onClick={() => { setStatusFilter("ALL"); setSlaFilter("ALL"); }}
                    className="text-left w-full focus:outline-none"
                >
                    <StatCard
                        label="Open Positions"
                        value={totalOpenPositions}
                        icon={Users}
                        tone="purple"
                        hint="Seats to fill"
                    />
                </button>
                <button
                    onClick={() => { setStatusFilter("ALL"); setSlaFilter("NEAR"); }}
                    className="text-left w-full focus:outline-none"
                >
                    <StatCard
                        label="Near / Over SLA"
                        value={nearSlaCount}
                        icon={AlertTriangle}
                        tone={nearSlaCount > 0 ? "red" : "emerald"}
                        hint="SLA risk alerts"
                    />
                </button>
                <button
                    onClick={() => { setStatusFilter("FULFILLED"); setSlaFilter("ALL"); }}
                    className="text-left w-full focus:outline-none"
                >
                    <StatCard
                        label="Fulfilled"
                        value={fulfilledCount}
                        icon={CheckCircle2}
                        tone="emerald"
                        hint="100% placed"
                    />
                </button>
                <button
                    onClick={() => { setStatusFilter("CLOSED"); setSlaFilter("ALL"); }}
                    className="text-left w-full focus:outline-none"
                >
                    <StatCard
                        label="Closed / Archived"
                        value={cancelledOrClosedCount}
                        icon={XCircle}
                        tone="neutral"
                        hint="Complete / cancelled"
                    />
                </button>
            </div>

            {/* Search, Saved Quick Filters & Sort Bar */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="relative w-full md:w-96">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by title, ID, client, skill, location…"
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                        {/* Saved View Quick Pickers (Part 7) */}
                        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
                            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mr-1">Views:</span>
                            <button
                                onClick={() => { setPriorityFilter("URGENT"); setStatusFilter("ALL"); setSlaFilter("ALL"); }}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                                    priorityFilter === "URGENT" ? "bg-red-50 text-red-700 border-red-200 font-bold" : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                                }`}
                            >
                                Urgent Jobs
                            </button>
                            <button
                                onClick={() => { setSlaFilter("NEAR"); setStatusFilter("ALL"); }}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                                    slaFilter === "NEAR" ? "bg-amber-50 text-amber-800 border-amber-200 font-bold" : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                                }`}
                            >
                                At Risk SLA
                            </button>
                            <button
                                onClick={() => { setStatusFilter("PENDING_APPROVAL"); setSlaFilter("ALL"); }}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                                    statusFilter === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-800 border-amber-200 font-bold" : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                                }`}
                            >
                                Pending Approvals
                            </button>
                        </div>

                        <div className="h-4 w-px bg-neutral-200 mx-1 hidden md:block" />

                        {/* Sort Selector */}
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                            <ArrowUpDown size={13} />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5 font-semibold text-neutral-700 outline-none"
                            >
                                <option value="newest">Sort: Newest</option>
                                <option value="priority">Sort: Priority</option>
                                <option value="openings">Sort: Openings</option>
                                <option value="sla">Sort: SLA Risk</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Filter Drawer / Expandable Bar */}
                {filterDrawerOpen && (
                    <div className="pt-3 border-t border-neutral-100 grid grid-cols-2 md:grid-cols-4 gap-3 bg-neutral-50/50 p-3 rounded-xl">
                        <div>
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white outline-none"
                            >
                                <option value="ALL">All Statuses</option>
                                {["PENDING_APPROVAL", "APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE", "JOINING", "FULFILLED", "ON_HOLD", "CLOSED", "CANCELLED"].map(s => (
                                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Priority</label>
                            <select
                                value={priorityFilter}
                                onChange={(e) => setPriorityFilter(e.target.value)}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white outline-none"
                            >
                                <option value="ALL">All Priorities</option>
                                {["LOW", "MEDIUM", "HIGH", "URGENT"].map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Client</label>
                            <select
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white outline-none"
                            >
                                <option value="ALL">All Clients</option>
                                {(Array.isArray(clients) ? clients : []).map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.companyName}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">SLA Health</label>
                                <select
                                    value={slaFilter}
                                    onChange={(e) => setSlaFilter(e.target.value)}
                                    className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white outline-none"
                                >
                                    <option value="ALL">All SLA Statuses</option>
                                    <option value="NEAR">Near SLA (≤ 5 Days)</option>
                                    <option value="OVER">Over SLA (Breached)</option>
                                </select>
                            </div>
                            <button
                                onClick={resetFilters}
                                className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg bg-white"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Status Chips Strip (Part 74) */}
            <div className="flex gap-2 flex-wrap items-center">
                {["ALL", "PENDING_APPROVAL", "APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE", "JOINING", "FULFILLED", "ON_HOLD", "CLOSED", "CANCELLED"].map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                            statusFilter === s
                                ? "bg-primary text-white shadow-md shadow-primary/20"
                                : "bg-white border border-neutral-200 text-neutral-500 hover:border-neutral-300"
                        }`}
                    >
                        {s.replaceAll("_", " ")}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-neutral-200/60" />
                    ))}
                </div>
            ) : processedJobs.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={Briefcase} message="No job requisitions matching your search and filter criteria." />
                </SectionCard>
            ) : (
                <div className="space-y-3.5">
                    {processedJobs.map((j: any) => {
                        const filled = j.filled || 0;
                        const totalOpenings = j.openings || 1;
                        const remaining = Math.max(0, totalOpenings - filled);
                        const percentFilled = Math.min(100, Math.round((filled / totalOpenings) * 100));

                        return (
                            <div
                                key={j.id}
                                className={`bg-white p-5 rounded-2xl border shadow-xs space-y-3.5 transition-all hover:border-primary/40 hover:shadow-md ${
                                    j.status === "PENDING_APPROVAL" ? "border-amber-200 bg-amber-50/20" : "border-neutral-200/80"
                                }`}
                            >
                                {/* Header Row */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <Link
                                                href={`/admin/jobs/${j.id}`}
                                                className="font-extrabold text-neutral-900 text-base hover:text-primary transition-colors flex items-center gap-1.5"
                                            >
                                                {j.title}
                                                <ChevronRight size={16} className="text-neutral-400" />
                                            </Link>
                                            <span className="text-xs font-mono font-bold text-neutral-400 px-2 py-0.5 bg-neutral-100 rounded-md">
                                                {j.id}
                                            </span>
                                            <Badge value={j.status} />
                                            <Badge value={j.priority} />
                                            {j.calculatedSlaStatus && j.calculatedSlaStatus !== "ON_TRACK" && (
                                                <Badge value={j.calculatedSlaStatus} label={`SLA: ${j.calculatedSlaStatus.replace(/_/g, " ")}`} />
                                            )}
                                        </div>

                                        {/* Client & Vital Info Bar */}
                                        <div className="text-xs text-neutral-500 flex items-center gap-3 flex-wrap">
                                            <Link
                                                href={`/admin/clients/${j.clientId}`}
                                                className="font-bold text-primary hover:underline flex items-center gap-1"
                                            >
                                                {j.clientName}
                                            </Link>
                                            <span className="text-neutral-300">·</span>
                                            <span className="flex items-center gap-1 text-neutral-600">
                                                <MapPin size={12} className="text-neutral-400" /> {j.location || "Remote"} ({j.workMode || "HYBRID"})
                                            </span>
                                            <span className="text-neutral-300">·</span>
                                            <span className="flex items-center gap-1 font-semibold text-neutral-700">
                                                <IndianRupee size={12} className="text-neutral-400" /> {j.salaryMinLpa}–{j.salaryMaxLpa} LPA
                                            </span>
                                            <span className="text-neutral-300">·</span>
                                            <span>
                                                Exp: <strong className="text-neutral-700">{j.experienceMinYears}–{j.experienceMaxYears} yrs</strong>
                                            </span>
                                            {j.department && (
                                                <>
                                                    <span className="text-neutral-300">·</span>
                                                    <span className="text-neutral-500 font-medium">{j.department}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons & Quick SLA Metric */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Link
                                            href={`/admin/jobs/${j.id}`}
                                            className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold flex items-center gap-1"
                                        >
                                            View 360° <ArrowRight size={13} />
                                        </Link>
                                        <button
                                            onClick={() => openEdit(j)}
                                            className="p-2 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-primary transition-colors"
                                            title="Edit Requisition"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedJob(j);
                                                setDeleteModalOpen(true);
                                            }}
                                            className="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                                            title="Delete Job"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="text-right pl-3 border-l border-neutral-100 hidden sm:block">
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase">Days open</p>
                                            <p className="text-base font-extrabold text-neutral-900">{j.daysOpen ?? 0}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Openings & Hiring Progress Bar (Part 1 & 9) */}
                                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-center gap-6 text-xs">
                                        <div>
                                            <span className="text-neutral-400 block text-[10px] font-bold uppercase">Required Openings</span>
                                            <strong className="text-sm font-extrabold text-neutral-900">{totalOpenings}</strong>
                                        </div>
                                        <div>
                                            <span className="text-neutral-400 block text-[10px] font-bold uppercase">Filled Positions</span>
                                            <strong className="text-sm font-extrabold text-emerald-600">{filled}</strong>
                                        </div>
                                        <div>
                                            <span className="text-neutral-400 block text-[10px] font-bold uppercase">Remaining</span>
                                            <strong className={`text-sm font-extrabold ${remaining > 0 ? "text-amber-600" : "text-neutral-400"}`}>
                                                {remaining}
                                            </strong>
                                        </div>
                                        <div className="hidden sm:block">
                                            <span className="text-neutral-400 block text-[10px] font-bold uppercase">Recruitment SLA</span>
                                            <span className="text-xs font-semibold text-neutral-700">
                                                {j.daysRemaining !== undefined ? (
                                                    j.daysRemaining >= 0 ? `${j.daysRemaining} days left` : `${Math.abs(j.daysRemaining)} days overdue`
                                                ) : `${j.slaDays || 30} days target`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress Meter */}
                                    <div className="flex items-center gap-3 w-full md:w-64">
                                        <div className="flex-1 bg-neutral-200 h-2.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${
                                                    percentFilled === 100 ? "bg-emerald-500" : "bg-primary"
                                                }`}
                                                style={{ width: `${percentFilled}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-neutral-700 shrink-0">
                                            {percentFilled}% Filled
                                        </span>
                                    </div>
                                </div>

                                {/* Skills Tags */}
                                {j.skills?.length > 0 && (
                                    <div className="flex gap-1.5 flex-wrap items-center">
                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-1">Skills:</span>
                                        {j.skills.map((s: string) => (
                                            <span key={s} className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md text-[10px] font-semibold border border-neutral-200/50">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Footer Pipeline & Status Controls */}
                                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 flex-wrap gap-3">
                                    <div className="flex items-center gap-4 text-xs text-neutral-500 flex-wrap">
                                        <span className="flex items-center gap-1.5">
                                            Pipeline: <strong className="text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md font-bold">{j.inPipeline ?? 0}</strong>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            Interviews: <strong className="text-cyan-700 font-bold">{j.interviewCount ?? 0}</strong>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            Offers: <strong className="text-amber-700 font-bold">{j.offerCount ?? 0}</strong>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            Joined: <strong className="text-emerald-700 font-bold">{j.joinedCount ?? 0}</strong>
                                        </span>

                                        {j.primaryRecruiterName && (
                                            <span className="text-neutral-500">
                                                Recruiter: <strong className="text-neutral-700 font-semibold">{j.primaryRecruiterName}</strong>
                                            </span>
                                        )}
                                        {j.requestedByName && (
                                            <span className="text-neutral-400 hidden lg:inline">
                                                Raised by: <strong className="text-neutral-600">{j.requestedByName}</strong>
                                            </span>
                                        )}
                                    </div>

                                    {/* Status Controls */}
                                    <div className="flex items-center gap-2">
                                        {j.status === "PENDING_APPROVAL" ? (
                                            <>
                                                <button
                                                    onClick={() => patchStatusMutation.mutate({ id: j.id, action: "approve" })}
                                                    disabled={patchStatusMutation.isPending}
                                                    className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors flex items-center gap-1.5 shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer"
                                                >
                                                    <CheckCircle2 size={14} /> Approve Mandate
                                                </button>
                                                <button
                                                    onClick={() => handlePromptStatusChange(j, "CANCELLED")}
                                                    className="px-3.5 py-1.5 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <XCircle size={14} /> Reject
                                                </button>
                                            </>
                                        ) : (
                                            <select
                                                value={j.status}
                                                onChange={(e) => handlePromptStatusChange(j, e.target.value)}
                                                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-neutral-200 bg-white outline-none focus:border-primary hover:border-neutral-300 cursor-pointer"
                                            >
                                                {["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE", "JOINING", "FULFILLED", "ON_HOLD", "CLOSED", "CANCELLED"].map((s) => (
                                                    <option key={s} value={s}>
                                                        {s.replaceAll("_", " ")}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Status Change Confirmation / Reason Modal (Part 55, 56, 57) */}
            <ModalShell
                open={statusChangeModalOpen}
                onClose={() => setStatusChangeModalOpen(false)}
                title={`Confirm Status Transition: ${targetStatus?.replace(/_/g, " ")}`}
            >
                <div className="space-y-4">
                    <p className="text-xs text-neutral-600">
                        Aap requisition <strong className="text-neutral-900">{selectedJob?.title}</strong> ko{" "}
                        <strong className="text-primary">{targetStatus?.replace(/_/g, " ")}</strong> state mai move kar rahe hain.
                    </p>

                    {targetStatus === "CANCELLED" && (
                        <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>Cancellation reason is mandatory for compliance audit. Historical submissions will be preserved.</span>
                        </div>
                    )}

                    {targetStatus === "ON_HOLD" && (
                        <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>On-hold stops active recruiter alerts. Sourcing pipelines remain frozen.</span>
                        </div>
                    )}

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                            {targetStatus === "CANCELLED" || targetStatus === "ON_HOLD" ? "Reason / Notes *" : "Reason / Audit Notes"}
                        </span>
                        <textarea
                            rows={3}
                            value={statusReason}
                            onChange={(e) => setStatusReason(e.target.value)}
                            placeholder="Provide operational reason for this status change..."
                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                        />
                    </label>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={() => setStatusChangeModalOpen(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={patchStatusMutation.isPending || ((targetStatus === "CANCELLED" || targetStatus === "ON_HOLD") && !statusReason.trim())}
                            onClick={() => {
                                if (selectedJob?.id) {
                                    patchStatusMutation.mutate({
                                        id: selectedJob.id,
                                        status: targetStatus,
                                        reason: statusReason,
                                    });
                                }
                            }}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                        >
                            {patchStatusMutation.isPending ? "Updating..." : "Confirm Status Change"}
                        </button>
                    </div>
                </div>
            </ModalShell>

            {/* Create Job Requisition Multi-step Modal (Part 15) */}
            <ModalShell open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Job Requisition" wide>
                <div className="space-y-4">
                    {/* Stepper Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                        <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${formStep === 1 ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>
                                1
                            </span>
                            <span className="text-xs font-bold text-neutral-700">Client & Role</span>
                        </div>
                        <div className="w-8 h-px bg-neutral-200" />
                        <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${formStep === 2 ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>
                                2
                            </span>
                            <span className="text-xs font-bold text-neutral-700">Requirements & SLA</span>
                        </div>
                        <div className="w-8 h-px bg-neutral-200" />
                        <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${formStep === 3 ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>
                                3
                            </span>
                            <span className="text-xs font-bold text-neutral-700">Ownership & Review</span>
                        </div>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (formStep < 3) {
                                setFormStep((formStep + 1) as any);
                            } else {
                                createMutation.mutate();
                            }
                        }}
                        className="space-y-4"
                    >
                        {formStep === 1 && (
                            <div className="space-y-3">
                                <label className="block">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Client / Hiring Mandate *</span>
                                    <select
                                        required
                                        value={form.clientId}
                                        onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                                        className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none bg-white font-medium"
                                    >
                                        <option value="">Select client…</option>
                                        {(Array.isArray(clients) ? clients : []).map((c: any) => (
                                            <option key={c.id} value={c.id}>
                                                {c.companyName} ({c.industry || "General"})
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Requisition Title *</span>
                                        <input
                                            required
                                            value={form.title}
                                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                                            placeholder="e.g. Senior Backend Architect"
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none font-medium"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Department</span>
                                        <input
                                            value={form.department}
                                            onChange={(e) => setForm({ ...form, department: e.target.value })}
                                            placeholder="Engineering, Risk, Clinical, Sales…"
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Location</span>
                                        <input
                                            value={form.location}
                                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                                            placeholder="Powai, Mumbai"
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Work Mode</span>
                                        <select
                                            value={form.workMode}
                                            onChange={(e) => setForm({ ...form, workMode: e.target.value })}
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none bg-white"
                                        >
                                            <option value="ONSITE">Onsite</option>
                                            <option value="HYBRID">Hybrid</option>
                                            <option value="REMOTE">Remote</option>
                                            <option value="FIELD">Field</option>
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Employment Type</span>
                                        <select
                                            value={form.employmentType}
                                            onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none bg-white"
                                        >
                                            <option value="FULL_TIME">Full Time</option>
                                            <option value="PART_TIME">Part Time</option>
                                            <option value="CONTRACT">Contract</option>
                                            <option value="INTERNSHIP">Internship</option>
                                        </select>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Required Openings *</span>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={form.openings}
                                            onChange={(e) => setForm({ ...form, openings: e.target.value })}
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none font-bold"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Priority</span>
                                        <select
                                            value={form.priority}
                                            onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none bg-white font-bold"
                                        >
                                            <option value="LOW">LOW</option>
                                            <option value="MEDIUM">MEDIUM</option>
                                            <option value="HIGH">HIGH</option>
                                            <option value="URGENT">URGENT</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                        )}

                        {formStep === 2 && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Min (LPA)</span>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={form.salaryMinLpa}
                                            onChange={(e) => setForm({ ...form, salaryMinLpa: e.target.value })}
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Max (LPA)</span>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={form.salaryMaxLpa}
                                            onChange={(e) => setForm({ ...form, salaryMaxLpa: e.target.value })}
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Exp Min (yrs)</span>
                                        <input
                                            type="number"
                                            value={form.experienceMinYears}
                                            onChange={(e) => setForm({ ...form, experienceMinYears: e.target.value })}
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Exp Max (yrs)</span>
                                        <input
                                            type="number"
                                            value={form.experienceMaxYears}
                                            onChange={(e) => setForm({ ...form, experienceMaxYears: e.target.value })}
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                        />
                                    </label>
                                </div>

                                <label className="block">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Must Have Skills (comma separated) *</span>
                                    <input
                                        required
                                        value={form.skills}
                                        onChange={(e) => setForm({ ...form, skills: e.target.value })}
                                        placeholder="Node.js, PostgreSQL, Microservices"
                                        className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Preferred / Good to Have Skills</span>
                                    <input
                                        value={form.preferredSkills}
                                        onChange={(e) => setForm({ ...form, preferredSkills: e.target.value })}
                                        placeholder="Redis, Kafka, AWS, Docker"
                                        className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                    />
                                </label>

                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">SLA Target Days</span>
                                        <input
                                            type="number"
                                            value={form.slaDays}
                                            onChange={(e) => setForm({ ...form, slaDays: e.target.value })}
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Notice Period Preference</span>
                                        <input
                                            value={form.noticePeriodPreference}
                                            onChange={(e) => setForm({ ...form, noticePeriodPreference: e.target.value })}
                                            placeholder="Immediate to 30 Days"
                                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        {formStep === 3 && (
                            <div className="space-y-3">
                                <label className="block">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Primary Assigned Recruiter</span>
                                    <select
                                        value={form.primaryRecruiterId}
                                        onChange={(e) => setForm({ ...form, primaryRecruiterId: e.target.value })}
                                        className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none bg-white font-medium"
                                    >
                                        <option value="">Auto-assign / Unassigned</option>
                                        {(Array.isArray(teamMembers) ? teamMembers : []).map((u: any) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.role?.replace(/_/g, " ")})
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Priority Reason / Mandate Context</span>
                                    <input
                                        value={form.priorityReason}
                                        onChange={(e) => setForm({ ...form, priorityReason: e.target.value })}
                                        placeholder="e.g. Critical payments migration; client escalated SLA"
                                        className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Description & Responsibilities</span>
                                    <textarea
                                        rows={4}
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="Detail role scope, key deliverables and hiring manager expectations..."
                                        className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                                    />
                                </label>
                            </div>
                        )}

                        {/* Navigation Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                            {formStep > 1 ? (
                                <button
                                    type="button"
                                    onClick={() => setFormStep((formStep - 1) as any)}
                                    className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                                >
                                    Back
                                </button>
                            ) : <div />}

                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                            >
                                {createMutation.isPending
                                    ? "Submitting..."
                                    : formStep < 3
                                    ? "Next Step →"
                                    : "Create Requisition"}
                            </button>
                        </div>
                    </form>
                </div>
            </ModalShell>

            {/* Edit Job Modal */}
            <ModalShell open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Job Requisition" wide>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        updateMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Client / Company</span>
                        <select
                            value={form.clientId}
                            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                            className="mt-1 w-full px-4 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none bg-white font-medium"
                        >
                            {(Array.isArray(clients) ? clients : []).map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.companyName}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Title *</span>
                            <input
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none font-medium"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Location</span>
                            <input
                                value={form.location}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Openings</span>
                            <input
                                type="number"
                                min="1"
                                value={form.openings}
                                onChange={(e) => setForm({ ...form, openings: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none font-bold"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Priority</span>
                            <select
                                value={form.priority}
                                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none bg-white font-bold"
                            >
                                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Primary Recruiter</span>
                            <select
                                value={form.primaryRecruiterId}
                                onChange={(e) => setForm({ ...form, primaryRecruiterId: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none bg-white"
                            >
                                <option value="">Unassigned</option>
                                {(Array.isArray(teamMembers) ? teamMembers : []).map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Min (LPA)</span>
                            <input
                                type="number"
                                step="0.5"
                                value={form.salaryMinLpa}
                                onChange={(e) => setForm({ ...form, salaryMinLpa: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Max (LPA)</span>
                            <input
                                type="number"
                                step="0.5"
                                value={form.salaryMaxLpa}
                                onChange={(e) => setForm({ ...form, salaryMaxLpa: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Must Have Skills (comma separated)</span>
                        <input
                            value={form.skills}
                            onChange={(e) => setForm({ ...form, skills: e.target.value })}
                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Description</span>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                        />
                    </label>

                    <button
                        disabled={updateMutation.isPending}
                        className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md shadow-primary/25 cursor-pointer"
                    >
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </ModalShell>

            {/* Delete Confirmation Modal */}
            <ModalShell open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Job Requisition">
                <div className="space-y-4">
                    <p className="text-xs text-neutral-600">
                        Are you sure you want to permanently delete requisition <strong className="text-neutral-900">{selectedJob?.title}</strong>?
                        This will remove the job mandate and log an irreversible Super Admin audit entry.
                    </p>
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={() => setDeleteModalOpen(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => selectedJob?.id && deleteMutation.mutate(selectedJob.id)}
                            disabled={deleteMutation.isPending}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-900/20 disabled:opacity-50 cursor-pointer"
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Job"}
                        </button>
                    </div>
                </div>
            </ModalShell>
        </div>
    );
}
