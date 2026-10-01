"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    ArrowLeft, Briefcase, Building2, MapPin, IndianRupee, Users,
    Clock, CheckCircle2, AlertTriangle, AlertCircle, Calendar, Plus,
    Edit2, Check, X, ShieldAlert, Award, FileText, Download, Eye,
    ExternalLink, Layers, GitBranch, ArrowRight, UserCheck, MessageSquare,
    DollarSign, Sparkles, Filter, ChevronRight, Share2, CornerDownRight,
    TrendingUp, ShieldCheck, History, SlidersHorizontal, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";

export default function Job360Page({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const qc = useQueryClient();

    // 15 Tabs for Job 360°
    const [activeTab, setActiveTab] = useState<
        | "overview"
        | "candidates"
        | "pipeline"
        | "interviews"
        | "offers"
        | "placements"
        | "recruiters"
        | "client"
        | "requirements"
        | "tasks"
        | "documents"
        | "approvals"
        | "finance"
        | "analytics"
        | "activity"
    >("overview");

    // Action modals
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [targetStatus, setTargetStatus] = useState("");
    const [statusReason, setStatusReason] = useState("");
    const [selectedRecruiterId, setSelectedRecruiterId] = useState("");

    // Requirement Edit Modal
    const [reqModalOpen, setReqModalOpen] = useState(false);
    const [reqForm, setReqForm] = useState({
        openings: "1",
        salaryMinLpa: "12",
        salaryMaxLpa: "20",
        experienceMinYears: "3",
        experienceMaxYears: "7",
        skills: "",
        preferredSkills: "",
        changeSummary: ""
    });

    // Query for Job 360 Details
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["job-360", jobId],
        queryFn: async () => {
            const res = await fetch(`/api/admin/jobs/${jobId}`);
            if (!res.ok) throw new Error("Job requisition not found");
            return res.json();
        },
        refetchInterval: 15000,
    });

    // Query for Team Members
    const { data: teamMembers } = useQuery({
        queryKey: ["team-members"],
        queryFn: async () => {
            const res = await fetch("/api/admin/team-members");
            if (!res.ok) return [];
            const d = await res.json();
            return d.users || [];
        }
    });

    // Patch Job Mutation
    const patchMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch(`/api/admin/jobs/${jobId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update requisition");
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.action === "approve" ? "Requisition approved & sourcing unlocked." : "Job requisition updated.");
            setStatusModalOpen(false);
            setAssignModalOpen(false);
            setReqModalOpen(false);
            qc.invalidateQueries({ queryKey: ["job-360", jobId] });
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-neutral-200 animate-pulse" />
                    <div className="space-y-2 flex-1">
                        <div className="w-1/3 h-6 bg-neutral-200 rounded animate-pulse" />
                        <div className="w-1/4 h-4 bg-neutral-200 rounded animate-pulse" />
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-neutral-200/60" />
                    ))}
                </div>
                <div className="h-96 bg-white rounded-2xl animate-pulse border border-neutral-200/60" />
            </div>
        );
    }

    if (error || !data?.job) {
        return (
            <div className="space-y-6">
                <Link href="/admin/jobs" className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600 hover:text-primary">
                    <ArrowLeft size={16} /> Back to Job Requisitions
                </Link>
                <SectionCard>
                    <EmptyState icon={AlertTriangle} message="Job requisition not found or could not be loaded." />
                </SectionCard>
            </div>
        );
    }

    const { job, pipelineCounts, candidates = [], interviews = [], offers = [], placements = [], tasks = [], finance = [], recruiters = [], alerts = [], auditLogs = [] } = data;

    const totalOpenings = job.openings || 1;
    const filledOpenings = job.filled || 0;
    const remainingOpenings = job.remainingOpenings ?? Math.max(0, totalOpenings - filledOpenings);
    const percentFilled = Math.min(100, Math.round((filledOpenings / totalOpenings) * 100));

    const openRequirementsModal = () => {
        setReqForm({
            openings: String(job.openings || "1"),
            salaryMinLpa: String(job.salaryMinLpa || ""),
            salaryMaxLpa: String(job.salaryMaxLpa || ""),
            experienceMinYears: String(job.experienceMinYears || ""),
            experienceMaxYears: String(job.experienceMaxYears || ""),
            skills: Array.isArray(job.skills) ? job.skills.join(", ") : (job.skills || ""),
            preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills.join(", ") : (job.preferredSkills || ""),
            changeSummary: ""
        });
        setReqModalOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header with Navigation & 360° Requisition Identity (Part 25) */}
            <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/jobs"
                            className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
                        >
                            <ArrowLeft size={16} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-black text-neutral-900 tracking-tight">{job.title}</h1>
                                <span className="font-mono text-xs font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md">
                                    {job.id}
                                </span>
                                <Badge value={job.status} />
                                <Badge value={job.priority} />
                                {job.calculatedSlaStatus && (
                                    <Badge value={job.calculatedSlaStatus} label={`SLA: ${job.calculatedSlaStatus.replace(/_/g, " ")}`} />
                                )}
                            </div>
                            <div className="text-xs text-neutral-500 flex items-center gap-3 mt-1.5 flex-wrap">
                                <Link href={`/admin/clients/${job.clientId}`} className="font-bold text-primary hover:underline flex items-center gap-1">
                                    <Building2 size={13} /> {job.clientName}
                                </Link>
                                <span className="text-neutral-300">·</span>
                                <span className="flex items-center gap-1 text-neutral-600">
                                    <MapPin size={12} /> {job.location || "Remote"} ({job.workMode || "HYBRID"})
                                </span>
                                <span className="text-neutral-300">·</span>
                                <span className="flex items-center gap-1 font-semibold text-neutral-700">
                                    <IndianRupee size={12} /> {job.salaryMinLpa}–{job.salaryMaxLpa} LPA
                                </span>
                                <span className="text-neutral-300">·</span>
                                <span>Exp: <strong className="text-neutral-700">{job.experienceMinYears}–{job.experienceMaxYears} yrs</strong></span>
                                {job.department && (
                                    <>
                                        <span className="text-neutral-300">·</span>
                                        <span className="text-neutral-500">{job.department}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Requisition Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {job.status === "PENDING_APPROVAL" && (
                            <button
                                onClick={() => patchMutation.mutate({ action: "approve" })}
                                disabled={patchMutation.isPending}
                                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors shadow-md shadow-primary/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                <CheckCircle2 size={14} /> Approve Mandate
                            </button>
                        )}
                        <button
                            onClick={() => setAssignModalOpen(true)}
                            className="px-3.5 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <Users size={14} /> Assign Recruiter
                        </button>
                        <button
                            onClick={openRequirementsModal}
                            className="px-3.5 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <Edit2 size={14} /> Edit Requirements
                        </button>
                        <button
                            onClick={() => {
                                setTargetStatus("ON_HOLD");
                                setStatusReason("");
                                setStatusModalOpen(true);
                            }}
                            className="px-3.5 py-2 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <Clock size={14} /> Put On Hold
                        </button>
                        <button
                            onClick={() => {
                                setTargetStatus("CLOSED");
                                setStatusReason("");
                                setStatusModalOpen(true);
                            }}
                            className="px-3.5 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <X size={14} /> Close Mandate
                        </button>
                    </div>
                </div>

                {/* Sub-header Ownership & SLA Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-neutral-100 text-xs">
                    <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/50">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Primary Recruiter</span>
                        <p className="font-extrabold text-neutral-900 mt-0.5">{job.primaryRecruiterName || "Unassigned"}</p>
                    </div>
                    <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/50">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">TA Manager</span>
                        <p className="font-extrabold text-neutral-900 mt-0.5">{job.taManagerName || "Amit Joshi"}</p>
                    </div>
                    <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/50">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Account Manager</span>
                        <p className="font-extrabold text-neutral-900 mt-0.5">{job.accountManagerName || "Super Admin"}</p>
                    </div>
                    <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/50">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Days Open vs SLA</span>
                        <p className="font-extrabold text-neutral-900 mt-0.5">
                            {job.daysOpen}d / {job.slaDays}d target{" "}
                            <span className={`text-[10px] font-bold ${job.daysRemaining >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                ({job.daysRemaining >= 0 ? `${job.daysRemaining}d left` : `${Math.abs(job.daysRemaining)}d overdue`})
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* KPI Strip (Part 26) */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Required</p>
                    <h3 className="text-xl font-black text-neutral-900 mt-0.5">{totalOpenings}</h3>
                    <p className="text-[10px] text-neutral-400">Total Seats</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Filled</p>
                    <h3 className="text-xl font-black text-emerald-600 mt-0.5">{filledOpenings}</h3>
                    <p className="text-[10px] text-emerald-600 font-semibold">{percentFilled}% placed</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Remaining</p>
                    <h3 className={`text-xl font-black mt-0.5 ${remainingOpenings > 0 ? "text-amber-600" : "text-neutral-400"}`}>
                        {remainingOpenings}
                    </h3>
                    <p className="text-[10px] text-neutral-400">To be hired</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Candidates</p>
                    <h3 className="text-xl font-black text-neutral-900 mt-0.5">{candidates.length}</h3>
                    <p className="text-[10px] text-neutral-400">Mapped profiles</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Interviews</p>
                    <h3 className="text-xl font-black text-cyan-700 mt-0.5">{interviews.length}</h3>
                    <p className="text-[10px] text-cyan-600 font-semibold">Active rounds</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Offers</p>
                    <h3 className="text-xl font-black text-amber-700 mt-0.5">{offers.length}</h3>
                    <p className="text-[10px] text-amber-600 font-semibold">Extended</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Joined</p>
                    <h3 className="text-xl font-black text-emerald-700 mt-0.5">{placements.length}</h3>
                    <p className="text-[10px] text-emerald-600 font-semibold">Onboarded</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Est. Revenue</p>
                    <h3 className="text-xl font-black text-primary mt-0.5">
                        {inr(Math.round(((job.salaryMinLpa + job.salaryMaxLpa) / 2) * 100000 * 0.0833 * filledOpenings))}
                    </h3>
                    <p className="text-[10px] text-neutral-400">Billed / To Bill</p>
                </div>
            </div>

            {/* Attention Bar Alerts (Part 27) */}
            {alerts.length > 0 && (
                <div className="space-y-2">
                    {alerts.map((alt: any) => (
                        <div
                            key={alt.id}
                            onClick={() => setActiveTab(alt.actionTab as any)}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all hover:opacity-90 ${
                                alt.type === "DANGER"
                                    ? "bg-red-50/80 border-red-200 text-red-800"
                                    : alt.type === "WARNING"
                                    ? "bg-amber-50/80 border-amber-200 text-amber-800"
                                    : "bg-blue-50/80 border-blue-200 text-blue-800"
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={15} className="shrink-0" />
                                <span className="font-semibold">{alt.message}</span>
                            </div>
                            <span className="font-bold underline text-[11px] shrink-0">
                                View in {alt.actionTab} →
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* 15 Job 360° Navigation Tabs (Part 28) */}
            <div className="border-b border-neutral-200 flex gap-1 overflow-x-auto text-xs font-bold">
                {[
                    { id: "overview", label: "Overview", icon: Layers },
                    { id: "candidates", label: `Candidates (${candidates.length})`, icon: Users },
                    { id: "pipeline", label: "Pipeline Visual", icon: GitBranch },
                    { id: "interviews", label: `Interviews (${interviews.length})`, icon: Calendar },
                    { id: "offers", label: `Offers (${offers.length})`, icon: Award },
                    { id: "placements", label: `Placements (${placements.length})`, icon: UserCheck },
                    { id: "recruiters", label: `Recruiters (${recruiters.length})`, icon: Users },
                    { id: "client", label: "Client Context", icon: Building2 },
                    { id: "requirements", label: `Specs (${job.requirementVersions?.length || 1})`, icon: SlidersHorizontal },
                    { id: "tasks", label: `Tasks (${tasks.length})`, icon: CheckCircle2 },
                    { id: "documents", label: `Docs (${job.documents?.length || 0})`, icon: FileText },
                    { id: "approvals", label: `Approvals (${job.approvals?.length || 0})`, icon: ShieldCheck },
                    { id: "finance", label: "Finance & Fees", icon: DollarSign },
                    { id: "analytics", label: "Analytics & SLA", icon: TrendingUp },
                    { id: "activity", label: `Activity (${auditLogs.length})`, icon: History },
                ].map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`px-3.5 py-2.5 border-b-2 font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                                activeTab === t.id
                                    ? "border-primary text-primary bg-primary/5 rounded-t-lg"
                                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                            }`}
                        >
                            <Icon size={14} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Requisition Summary Card */}
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                                <Briefcase size={16} className="text-primary" /> Role Description & Scope
                            </h3>
                            <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-wrap">
                                {job.description || "No specific job description entered."}
                            </p>

                            {job.responsibilities && (
                                <div className="pt-3 border-t border-neutral-100">
                                    <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">Key Responsibilities</h4>
                                    <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-wrap">{job.responsibilities}</p>
                                </div>
                            )}

                            {job.aboutCompany && (
                                <div className="pt-3 border-t border-neutral-100">
                                    <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">About Client</h4>
                                    <p className="text-xs text-neutral-600 leading-relaxed">{job.aboutCompany}</p>
                                </div>
                            )}
                        </div>

                        {/* Openings Breakdown (Part 54) */}
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                                    <Users size={16} className="text-primary" /> Openings Lifecycle Breakdown ({totalOpenings} Openings)
                                </h3>
                                <span className="text-xs font-semibold text-neutral-500">{remainingOpenings} Openings Still Open</span>
                            </div>

                            <div className="space-y-2">
                                {(job.openingsList || Array.from({ length: totalOpenings }).map((_, i) => ({
                                    id: `opn-${i + 1}`,
                                    openingNumber: i + 1,
                                    status: i < filledOpenings ? "FILLED" : "OPEN",
                                    notes: i < filledOpenings ? "Placed & verified" : "Open for submissions"
                                }))).map((opn: any) => (
                                    <div key={opn.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center text-xs">
                                                #{opn.openingNumber}
                                            </span>
                                            <div>
                                                <p className="font-bold text-neutral-900">
                                                    Position #{opn.openingNumber}
                                                    {opn.assignedCandidateName && ` — ${opn.assignedCandidateName}`}
                                                </p>
                                                <p className="text-[11px] text-neutral-500">{opn.notes || "Assigned position track"}</p>
                                            </div>
                                        </div>
                                        <Badge value={opn.status} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Rail: Key Highlights & SLA Status */}
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                                <Clock size={16} className="text-primary" /> Mandate SLA Timeline
                            </h3>
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between pb-2 border-b border-neutral-100">
                                    <span className="text-neutral-500">Target Close Window:</span>
                                    <strong className="text-neutral-900">{job.slaDays} Calendar Days</strong>
                                </div>
                                <div className="flex justify-between pb-2 border-b border-neutral-100">
                                    <span className="text-neutral-500">Days Elapsed:</span>
                                    <strong className="text-neutral-900">{job.daysOpen} Days Open</strong>
                                </div>
                                <div className="flex justify-between pb-2 border-b border-neutral-100">
                                    <span className="text-neutral-500">Time Remaining:</span>
                                    <strong className={job.daysRemaining >= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                                        {job.daysRemaining >= 0 ? `${job.daysRemaining} Days` : `${Math.abs(job.daysRemaining)} Days Overdue`}
                                    </strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500">Operational SLA Status:</span>
                                    <Badge value={job.calculatedSlaStatus || "ON_TRACK"} />
                                </div>
                            </div>
                        </div>

                        {/* Candidate Conversion Quick Funnel */}
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                            <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                                <TrendingUp size={16} className="text-primary" /> Pipeline Funnel
                            </h3>
                            <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-600">Sourced</span>
                                    <span className="font-bold text-neutral-900">{pipelineCounts.SOURCED}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-600">Screening</span>
                                    <span className="font-bold text-sky-700">{pipelineCounts.SCREENING}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-600">Interviews</span>
                                    <span className="font-bold text-cyan-700">{pipelineCounts.INTERVIEW_SCHEDULED}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-600">Offer Stage</span>
                                    <span className="font-bold text-amber-700">{pipelineCounts.OFFER_SENT}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-600">Joined</span>
                                    <span className="font-bold text-emerald-700">{pipelineCounts.JOINED}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: CANDIDATES */}
            {activeTab === "candidates" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                        <h3 className="font-bold text-neutral-900 text-sm">Candidates Associated With This Requisition</h3>
                        <Link href="/admin/candidates" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                            Browse Global Candidates <ExternalLink size={12} />
                        </Link>
                    </div>

                    {candidates.length === 0 ? (
                        <div className="p-10">
                            <EmptyState icon={Users} message="No candidates have been mapped or submitted to this job requisition yet." />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider font-bold border-b border-neutral-200">
                                    <tr>
                                        <th className="py-3 px-4">Candidate</th>
                                        <th className="py-3 px-4">Experience & Company</th>
                                        <th className="py-3 px-4">Recruiter</th>
                                        <th className="py-3 px-4">Stage</th>
                                        <th className="py-3 px-4">Fit Score</th>
                                        <th className="py-3 px-4">Interviews</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 font-medium">
                                    {candidates.map((c: any) => (
                                        <tr key={c.id} className="hover:bg-neutral-50/60 transition-colors">
                                            <td className="py-3.5 px-4">
                                                <Link href={`/admin/candidates/${c.candidateId}`} className="font-bold text-neutral-900 hover:text-primary">
                                                    {c.candidateName}
                                                </Link>
                                                <p className="text-[11px] text-neutral-400">{c.candidateEmail}</p>
                                            </td>
                                            <td className="py-3.5 px-4 text-neutral-600">
                                                <p className="font-semibold text-neutral-800">{c.candidateCurrentCompany || "—"}</p>
                                                <p className="text-[11px] text-neutral-400">{c.candidateTotalExp} yrs exp · {c.candidateNoticeDays}d notice</p>
                                            </td>
                                            <td className="py-3.5 px-4 text-neutral-700">{c.recruiterName}</td>
                                            <td className="py-3.5 px-4"><Badge value={c.stage} /></td>
                                            <td className="py-3.5 px-4 font-bold text-neutral-900">{c.fitScore}%</td>
                                            <td className="py-3.5 px-4 text-neutral-600">{c.interviewsCount} rounds</td>
                                            <td className="py-3.5 px-4 text-right">
                                                <Link
                                                    href={`/admin/candidates/${c.candidateId}`}
                                                    className="px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-600 hover:text-primary hover:border-primary transition-colors font-bold inline-flex items-center gap-1"
                                                >
                                                    Profile <ArrowRight size={11} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: PIPELINE VISUAL (Part 32) */}
            {activeTab === "pipeline" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
                    {[
                        { title: "SOURCED", key: "SOURCED", color: "border-neutral-300" },
                        { title: "SCREENING", key: "SCREENING", color: "border-sky-300" },
                        { title: "INTERVIEWS", key: "INTERVIEW_SCHEDULED", color: "border-cyan-300" },
                        { title: "OFFER STAGE", key: "OFFER_SENT", color: "border-amber-300" },
                        { title: "JOINED", key: "JOINED", color: "border-emerald-300" },
                    ].map((col) => {
                        const colApps = candidates.filter((c: any) => {
                            if (col.key === "INTERVIEW_SCHEDULED") {
                                return ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"].includes(c.stage);
                            }
                            if (col.key === "OFFER_SENT") {
                                return ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING"].includes(c.stage);
                            }
                            return c.stage === col.key;
                        });

                        return (
                            <div key={col.key} className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                                    <h4 className="font-extrabold text-neutral-700 text-xs tracking-wide">{col.title}</h4>
                                    <span className="px-2 py-0.5 rounded-full bg-white text-neutral-800 text-[10px] font-black border border-neutral-200">
                                        {colApps.length}
                                    </span>
                                </div>

                                <div className="space-y-2 min-h-[220px]">
                                    {colApps.length === 0 ? (
                                        <p className="text-[11px] text-neutral-400 italic text-center py-8">No profiles</p>
                                    ) : (
                                        colApps.map((a: any) => (
                                            <div
                                                key={a.id}
                                                className="bg-white p-3 rounded-xl border border-neutral-200/80 shadow-xs hover:border-primary/40 space-y-1.5 transition-all"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <Link href={`/admin/candidates/${a.candidateId}`} className="font-bold text-neutral-900 hover:text-primary text-xs">
                                                        {a.candidateName}
                                                    </Link>
                                                    <span className="text-[10px] font-bold text-neutral-400">{a.fitScore}%</span>
                                                </div>
                                                <p className="text-[10px] text-neutral-500 line-clamp-1">{a.candidateHeadline || a.candidateCurrentCompany}</p>
                                                <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[10px] text-neutral-400">
                                                    <span>Recruiter: {a.recruiterName?.split(" ")[0]}</span>
                                                    <span>{a.daysInStage}d in stage</span>
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

            {/* TAB 4: INTERVIEWS (Part 35 & 36) */}
            {activeTab === "interviews" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-neutral-900 text-sm">Scheduled & Completed Candidate Interviews</h3>
                            <p className="text-xs text-neutral-500">Track round progression and interviewer feedback status.</p>
                        </div>
                    </div>

                    {interviews.length === 0 ? (
                        <EmptyState icon={Calendar} message="No interviews scheduled for this requisition yet." />
                    ) : (
                        <div className="space-y-3">
                            {interviews.map((itr: any) => (
                                <div key={itr.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between gap-4 flex-wrap text-xs">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-neutral-900 text-sm">{itr.roundName}</span>
                                            <Badge value={itr.status} />
                                            {itr.outcome && itr.outcome !== "PENDING" && <Badge value={itr.outcome} />}
                                        </div>
                                        <p className="text-neutral-600">
                                            Candidate: <Link href={`/admin/candidates/${itr.candidateId}`} className="font-bold text-primary hover:underline">{itr.candidateName}</Link>
                                            {" · "}
                                            Interviewer: <strong className="text-neutral-800">{itr.interviewerName}</strong>
                                        </p>
                                        <p className="text-neutral-400 text-[11px]">
                                            Scheduled: {new Date(itr.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                                        </p>
                                    </div>

                                    {itr.meetingLink && (
                                        <a
                                            href={itr.meetingLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center gap-1"
                                        >
                                            Join Video Call <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 5: OFFERS (Part 38) */}
            {activeTab === "offers" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <h3 className="font-bold text-neutral-900 text-sm">Extended Offers & Terms</h3>
                    {offers.length === 0 ? (
                        <EmptyState icon={Award} message="No candidate offers generated for this requisition yet." />
                    ) : (
                        <div className="space-y-3">
                            {offers.map((off: any) => (
                                <div key={off.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between gap-4 text-xs">
                                    <div>
                                        <p className="font-bold text-neutral-900 text-sm">{off.candidateName}</p>
                                        <p className="text-neutral-600 mt-0.5">
                                            Offered Salary: <strong className="text-neutral-900 font-extrabold">{off.offeredSalaryLpa != null ? `${off.offeredSalaryLpa} LPA` : "Not recorded"}</strong>
                                            {" · "}Expected Joining: <strong className="text-neutral-800">{off.expectedJoiningDate || "TBD"}</strong>
                                        </p>
                                        {off.approverName && <p className="text-[11px] text-neutral-400">Approved by: {off.approverName}</p>}
                                    </div>
                                    <Badge value={off.status} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 6: PLACEMENTS (Part 40) */}
            {activeTab === "placements" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <h3 className="font-bold text-neutral-900 text-sm">Final Placements & Onboarded Candidates</h3>
                    {placements.length === 0 ? (
                        <EmptyState icon={UserCheck} message="No candidates have joined yet for this requisition." />
                    ) : (
                        <div className="space-y-3">
                            {placements.map((plc: any) => (
                                <div key={plc.id} className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/60 flex items-center justify-between gap-4 text-xs">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-neutral-900 text-sm">{plc.candidateName}</p>
                                            <Badge value="JOINED" />
                                        </div>
                                        <p className="text-neutral-600 mt-1">
                                            Joined Date: <strong className="text-neutral-900">{plc.joiningDate || "—"}</strong>
                                            {" · "}Annual CTC: <strong className="text-neutral-900">{(plc.offeredSalaryLpa ?? plc.ctcLpa) != null ? `${plc.offeredSalaryLpa ?? plc.ctcLpa} LPA` : "Not recorded"}</strong>
                                        </p>
                                        <p className="text-emerald-700 font-bold mt-0.5">
                                            Invoice: {plc.invoiceNumber || "Not invoiced"} · Agency Fee: {(plc.revenueInr ?? plc.placementFeeInr) != null ? inr(plc.revenueInr ?? plc.placementFeeInr) : "—"}
                                        </p>
                                    </div>
                                    <Link
                                        href="/admin/placements"
                                        className="px-3 py-1.5 bg-white border border-neutral-200 rounded-xl font-bold text-neutral-700 hover:text-primary hover:border-primary transition-colors"
                                    >
                                        Placements Ledger →
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 7: RECRUITERS (Part 41 & 67) */}
            {activeTab === "recruiters" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-neutral-900 text-sm">Recruiter Ownership & Contribution Metrics</h3>
                            <p className="text-xs text-neutral-500">Measurable pipeline contribution per assigned recruiter.</p>
                        </div>
                        <button
                            onClick={() => setAssignModalOpen(true)}
                            className="px-3.5 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors"
                        >
                            + Assign Recruiter
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recruiters.map((r: any) => (
                            <div key={r.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-extrabold text-neutral-900 text-sm">{r.name}</h4>
                                            {r.isPrimary && <Badge value="PRIMARY_RECRUITER" label="Primary Recruiter" />}
                                        </div>
                                        <p className="text-xs text-neutral-500">{r.email} · {r.designation}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-neutral-200 text-center">
                                    <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Profiles</span>
                                        <p className="font-black text-sm text-neutral-900">{r.candidatesCount}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Interviews</span>
                                        <p className="font-black text-sm text-cyan-700">{r.interviewsCount}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Offers</span>
                                        <p className="font-black text-sm text-amber-700">{r.offersCount}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Joined</span>
                                        <p className="font-black text-sm text-emerald-700">{r.joinedCount}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 8: CLIENT CONTEXT (Part 42) */}
            {activeTab === "client" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-neutral-900 text-sm">Client Account & Mandate Alignment</h3>
                            <p className="text-xs text-neutral-500">Contact points and client-specific hiring rules.</p>
                        </div>
                        <Link
                            href={`/admin/clients/${job.clientId}`}
                            className="px-3.5 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-colors flex items-center gap-1"
                        >
                            Open Client 360° Profile <ArrowRight size={13} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-2">
                            <span className="font-bold text-neutral-400 text-[10px] uppercase">Client Organization</span>
                            <p className="text-sm font-extrabold text-neutral-900">{job.clientName}</p>
                            <p className="text-neutral-600">Industry: {job.clientIndustry}</p>
                            <p className="text-neutral-600">Headquarters / Location: {job.clientLocation || "Mumbai, India"}</p>
                        </div>
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-2">
                            <span className="font-bold text-neutral-400 text-[10px] uppercase">Primary Hiring Manager</span>
                            <p className="text-sm font-extrabold text-neutral-900">{job.clientContactPerson}</p>
                            <p className="text-neutral-600">Email: {job.clientContactEmail}</p>
                            <p className="text-neutral-600">Phone: {job.clientContactPhone}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 9: REQUIREMENTS & VERSION HISTORY (Part 30 & 53) */}
            {activeTab === "requirements" && (
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-neutral-900 text-sm">Current Requirements Specification</h3>
                                <p className="text-xs text-neutral-500">Must-have vs good-to-have skills, experience brackets and compensation.</p>
                            </div>
                            <button
                                onClick={openRequirementsModal}
                                className="px-3.5 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors"
                            >
                                Update Specification
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-3">
                                <div>
                                    <span className="font-bold text-neutral-400 text-[10px] uppercase">Must-Have Skills</span>
                                    <div className="flex gap-1.5 flex-wrap mt-1">
                                        {(job.skills || []).map((s: string) => (
                                            <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary font-bold rounded-md text-[11px]">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {job.preferredSkills?.length > 0 && (
                                    <div>
                                        <span className="font-bold text-neutral-400 text-[10px] uppercase">Preferred Skills</span>
                                        <div className="flex gap-1.5 flex-wrap mt-1">
                                            {job.preferredSkills.map((s: string) => (
                                                <span key={s} className="px-2 py-0.5 bg-neutral-200 text-neutral-700 font-semibold rounded-md text-[11px]">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-2 text-neutral-700">
                                <p>Education: <strong>{job.education || "Graduate / Professional Degree"}</strong></p>
                                <p>Notice Period: <strong>{job.noticePeriodPreference || "Immediate to 30 Days"}</strong></p>
                                <p>Experience Range: <strong>{job.experienceMinYears} to {job.experienceMaxYears} Years</strong></p>
                                <p>Compensation Band: <strong>₹{job.salaryMinLpa} – ₹{job.salaryMaxLpa} LPA</strong></p>
                            </div>
                        </div>
                    </div>

                    {/* Version History (Part 53) */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-3">
                        <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                            <History size={16} className="text-primary" /> Requirement Version History
                        </h3>
                        <div className="space-y-2.5">
                            {(job.requirementVersions || [
                                {
                                    version: 1,
                                    openings: job.openings,
                                    salaryMinLpa: job.salaryMinLpa,
                                    salaryMaxLpa: job.salaryMaxLpa,
                                    changedByName: job.requestedByName || "Initial Creator",
                                    changedAt: job.createdAt,
                                    changeSummary: "Original client mandate created"
                                }
                            ]).map((ver: any) => (
                                <div key={ver.version} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between text-xs">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-neutral-900">Version {ver.version}</span>
                                            <span className="text-[11px] text-neutral-400">· {new Date(ver.changedAt).toLocaleDateString()}</span>
                                            <span className="text-[11px] text-neutral-500">by {ver.changedByName}</span>
                                        </div>
                                        <p className="text-neutral-600 mt-0.5">{ver.changeSummary}</p>
                                    </div>
                                    <span className="text-[11px] font-semibold text-neutral-500">
                                        {ver.openings} Openings · {ver.salaryMinLpa}–{ver.salaryMaxLpa} LPA
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 10: TASKS (Part 44) */}
            {activeTab === "tasks" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <h3 className="font-bold text-neutral-900 text-sm">Action Items & Recruiter Follow-ups</h3>
                    {tasks.length === 0 ? (
                        <EmptyState icon={CheckCircle2} message="No pending follow-up tasks linked to this requisition." />
                    ) : (
                        <div className="space-y-2.5">
                            {tasks.map((t: any) => (
                                <div key={t.id} className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between text-xs">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-neutral-900">{t.title}</span>
                                            <Badge value={t.priority} />
                                        </div>
                                        <p className="text-neutral-500">
                                            Assigned to: <strong className="text-neutral-700">{t.assignedToName}</strong>
                                            {" · "}Due: {t.dueDate}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${t.completed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                        {t.completed ? "Completed" : "Pending"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 11: DOCUMENTS (Part 47) */}
            {activeTab === "documents" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <h3 className="font-bold text-neutral-900 text-sm">Requisition Documents & JD Versions</h3>
                    {(job.documents || []).length === 0 ? (
                        <EmptyState icon={FileText} message="No contract or JD documents uploaded for this requisition." />
                    ) : (
                        <div className="space-y-2.5">
                            {job.documents.map((doc: any) => (
                                <div key={doc.id} className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <FileText size={18} className="text-primary" />
                                        <div>
                                            <p className="font-bold text-neutral-900">{doc.name}</p>
                                            <p className="text-[11px] text-neutral-400">
                                                {doc.fileSizeKb} KB · v{doc.version} · Uploaded by {doc.uploadedByName} on {new Date(doc.uploadedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <a
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-white border border-neutral-200 rounded-xl font-bold text-neutral-700 hover:text-primary transition-colors flex items-center gap-1"
                                    >
                                        Download <Download size={12} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 12: APPROVALS (Part 22, 23 & 48) */}
            {activeTab === "approvals" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <h3 className="font-bold text-neutral-900 text-sm">Governance & Approval History</h3>
                    {(job.approvals || []).length === 0 ? (
                        <EmptyState icon={ShieldCheck} message="No approval logs recorded for this requisition." />
                    ) : (
                        <div className="space-y-3">
                            {job.approvals.map((appr: any) => (
                                <div key={appr.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between text-xs">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-neutral-900">{appr.approvalType.replace(/_/g, " ")}</span>
                                            <Badge value={appr.status} />
                                        </div>
                                        <p className="text-neutral-500">
                                            Requested by: <strong className="text-neutral-700">{appr.requestedByName}</strong>
                                            {" · "}Approver: <strong className="text-neutral-700">{appr.approverName}</strong>
                                        </p>
                                        {appr.comments && <p className="text-neutral-600 italic font-mono text-[11px]">“{appr.comments}”</p>}
                                    </div>
                                    <span className="text-[11px] text-neutral-400">
                                        {appr.decidedAt ? new Date(appr.decidedAt).toLocaleDateString() : "Pending"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 13: FINANCE & FEES (Part 49) */}
            {activeTab === "finance" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <h3 className="font-bold text-neutral-900 text-sm">Financial Tracking & Invoicing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">Standard Commission</span>
                            <p className="text-lg font-black text-neutral-900 mt-1">8.33% (1 Month CTC)</p>
                            <p className="text-[10px] text-neutral-400">Client agreed rate card</p>
                        </div>
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">Expected Requisition Revenue</span>
                            <p className="text-lg font-black text-emerald-600 mt-1">
                                {inr(Math.round(((job.salaryMinLpa + job.salaryMaxLpa) / 2) * 100000 * 0.0833 * totalOpenings))}
                            </p>
                            <p className="text-[10px] text-neutral-400">On 100% position fulfillment</p>
                        </div>
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">Realized Revenue</span>
                            <p className="text-lg font-black text-primary mt-1">
                                {inr(Math.round(((job.salaryMinLpa + job.salaryMaxLpa) / 2) * 100000 * 0.0833 * filledOpenings))}
                            </p>
                            <p className="text-[10px] text-neutral-400">From {filledOpenings} joined candidate(s)</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 14: ANALYTICS & SLA (Part 50) */}
            {activeTab === "analytics" && (
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                        <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                            <TrendingUp size={16} className="text-primary" /> Hiring Velocity & SLA Metrics
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase">Days Open</span>
                                <p className="text-lg font-black text-neutral-900 mt-1">{job.daysOpen} Days</p>
                            </div>
                            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase">Time to Shortlist</span>
                                <p className="text-lg font-black text-neutral-900 mt-1">4.2 Days</p>
                            </div>
                            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase">Time to Offer</span>
                                <p className="text-lg font-black text-neutral-900 mt-1">18.5 Days</p>
                            </div>
                            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase">Fulfillment %</span>
                                <p className="text-lg font-black text-emerald-600 mt-1">{percentFilled}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 15: ACTIVITY TIMELINE (Part 45 & 73) */}
            {activeTab === "activity" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
                    <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                        <History size={16} className="text-primary" /> Complete Requisition Audit Trail
                    </h3>
                    {auditLogs.length === 0 ? (
                        <EmptyState icon={History} message="No audit records logged for this job requisition yet." />
                    ) : (
                        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
                            {auditLogs.map((log: any) => (
                                <div key={log.id} className="relative text-xs">
                                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-white" />
                                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-neutral-900">{log.action?.replace(/_/g, " ")}</span>
                                            <span className="text-[10px] text-neutral-400">{new Date(log.createdAt).toLocaleString()}</span>
                                        </div>
                                        <p className="text-neutral-600 mt-0.5">{log.detail}</p>
                                        <p className="text-[10px] text-neutral-400 mt-1">Actor: {log.actorRole}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Recruiter Assignment Modal (Part 11) */}
            <ModalShell open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Recruiter to Mandate">
                <div className="space-y-4">
                    <p className="text-xs text-neutral-600">
                        Select team member to assign as the primary owner for requisition <strong className="text-neutral-900">{job.title}</strong>.
                    </p>
                    <select
                        value={selectedRecruiterId}
                        onChange={(e) => setSelectedRecruiterId(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-neutral-200 bg-white outline-none"
                    >
                        <option value="">Select Recruiter…</option>
                        {(Array.isArray(teamMembers) ? teamMembers : []).map((u: any) => (
                            <option key={u.id} value={u.id}>{u.name} ({u.role?.replace(/_/g, " ")})</option>
                        ))}
                    </select>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={() => setAssignModalOpen(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={!selectedRecruiterId || patchMutation.isPending}
                            onClick={() => {
                                patchMutation.mutate({
                                    primaryRecruiterId: selectedRecruiterId,
                                    changeSummary: `Reassigned primary recruiter to ${teamMembers?.find((u: any) => u.id === selectedRecruiterId)?.name}`
                                });
                            }}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50"
                        >
                            {patchMutation.isPending ? "Assigning..." : "Confirm Assignment"}
                        </button>
                    </div>
                </div>
            </ModalShell>

            {/* Requirements Update Modal (Creates new Version) */}
            <ModalShell open={reqModalOpen} onClose={() => setReqModalOpen(false)} title="Update Requirements & Openings" wide>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        patchMutation.mutate({
                            ...reqForm,
                            openings: Number(reqForm.openings),
                            salaryMinLpa: Number(reqForm.salaryMinLpa),
                            salaryMaxLpa: Number(reqForm.salaryMaxLpa),
                            skills: reqForm.skills.split(",").map(s => s.trim()).filter(Boolean),
                            preferredSkills: reqForm.preferredSkills.split(",").map(s => s.trim()).filter(Boolean),
                            changeSummary: reqForm.changeSummary || "Client updated specifications"
                        });
                    }}
                    className="space-y-3.5"
                >
                    <div className="grid grid-cols-3 gap-3">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Openings</span>
                            <input
                                type="number"
                                min="1"
                                required
                                value={reqForm.openings}
                                onChange={(e) => setReqForm({ ...reqForm, openings: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none font-bold"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Min (LPA)</span>
                            <input
                                type="number"
                                step="0.5"
                                value={reqForm.salaryMinLpa}
                                onChange={(e) => setReqForm({ ...reqForm, salaryMinLpa: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Max (LPA)</span>
                            <input
                                type="number"
                                step="0.5"
                                value={reqForm.salaryMaxLpa}
                                onChange={(e) => setReqForm({ ...reqForm, salaryMaxLpa: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Must Have Skills (comma separated)</span>
                        <input
                            value={reqForm.skills}
                            onChange={(e) => setReqForm({ ...reqForm, skills: e.target.value })}
                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Reason for Modification / Version Notes *</span>
                        <input
                            required
                            value={reqForm.changeSummary}
                            onChange={(e) => setReqForm({ ...reqForm, changeSummary: e.target.value })}
                            placeholder="e.g. Client expanded budget band and added 1 opening"
                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                        />
                    </label>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setReqModalOpen(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={patchMutation.isPending}
                            className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50"
                        >
                            {patchMutation.isPending ? "Saving..." : "Save & Create New Version"}
                        </button>
                    </div>
                </form>
            </ModalShell>

            {/* Status Transition Modal */}
            <ModalShell open={statusModalOpen} onClose={() => setStatusModalOpen(false)} title={`Change Status to: ${targetStatus?.replace(/_/g, " ")}`}>
                <div className="space-y-4">
                    <p className="text-xs text-neutral-600">
                        Please provide a reason or closure note to preserve audit fidelity.
                    </p>
                    <textarea
                        rows={3}
                        value={statusReason}
                        onChange={(e) => setStatusReason(e.target.value)}
                        placeholder="Reason for hold or closure..."
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                    />
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={() => setStatusModalOpen(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={patchMutation.isPending}
                            onClick={() => {
                                patchMutation.mutate({
                                    action: targetStatus === "ON_HOLD" ? "hold" : (targetStatus === "CLOSED" ? "close" : undefined),
                                    status: targetStatus,
                                    reason: statusReason,
                                });
                            }}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50"
                        >
                            {patchMutation.isPending ? "Updating..." : "Confirm Status"}
                        </button>
                    </div>
                </div>
            </ModalShell>
        </div>
    );
}
