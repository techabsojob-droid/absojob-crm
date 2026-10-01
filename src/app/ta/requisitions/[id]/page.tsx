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

export default function TaRequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const qc = useQueryClient();

    // Tabs for Requisition 360°
    const [activeTab, setActiveTab] = useState<
        | "overview"
        | "candidates"
        | "pipeline"
        | "interviews"
        | "offers"
        | "recruiters"
        | "sla"
        | "activity"
    >("overview");

    // Action modals
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
        changeSummary: "",
    });

    // Query for Job 360 Details
    const { data, isLoading, error } = useQuery({
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
        },
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
            qc.invalidateQueries({ queryKey: ["ta-jobs"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-[1600px] mx-auto pb-16 animate-fade-in">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-neutral-200 animate-pulse" />
                    <div className="space-y-2 flex-1">
                        <div className="w-1/3 h-6 bg-neutral-200 rounded animate-pulse" />
                        <div className="w-1/4 h-4 bg-neutral-200 rounded animate-pulse" />
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-neutral-200/60" />
                    ))}
                </div>
                <div className="h-96 bg-white rounded-2xl animate-pulse border border-neutral-200/60" />
            </div>
        );
    }

    if (error || !data?.job) {
        return (
            <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
                <Link href="/ta/requisitions" className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600 hover:text-primary">
                    <ArrowLeft size={16} /> Back to Requisitions
                </Link>
                <SectionCard>
                    <EmptyState icon={AlertTriangle} message="Requisition not found or could not be loaded." />
                </SectionCard>
            </div>
        );
    }

    const { job, pipelineCounts, candidates = [], interviews = [], offers = [], tasks = [], recruiters = [], auditLogs = [] } = data;

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
            changeSummary: "",
        });
        setReqModalOpen(true);
    };

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-16 animate-fade-in">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/ta/requisitions"
                            className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
                            title="Back to Requisitions"
                        >
                            <ArrowLeft size={16} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-black text-neutral-900 tracking-tight">{job.title}</h1>
                                <span className="font-mono text-xs font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md">
                                    {job.id.startsWith("job-") ? `REQ-${job.id.slice(4)}` : job.id}
                                </span>
                                <Badge value={job.status} />
                                <Badge value={job.priority} />
                                {job.calculatedSlaStatus && (
                                    <Badge value={job.calculatedSlaStatus} label={`SLA: ${job.calculatedSlaStatus.replace(/_/g, " ")}`} />
                                )}
                            </div>
                            <div className="text-xs text-neutral-500 flex items-center gap-3 mt-1.5 flex-wrap">
                                <span className="font-bold text-primary flex items-center gap-1">
                                    <Building2 size={13} /> {job.clientName}
                                </span>
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

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Link
                            href={`/ta/pipeline?jobId=${job.id}`}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                            <GitBranch size={14} /> Open Pipeline
                        </Link>
                        <button
                            onClick={() => setAssignModalOpen(true)}
                            className="px-3.5 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors flex items-center gap-1.5"
                        >
                            <Users size={14} /> Assign Recruiter
                        </button>
                        <button
                            onClick={openRequirementsModal}
                            className="px-3.5 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors flex items-center gap-1.5"
                        >
                            <Edit2 size={14} /> Edit Requirements
                        </button>
                        <button
                            onClick={() => {
                                setTargetStatus(job.status === "ON_HOLD" ? "SOURCING" : "ON_HOLD");
                                setStatusReason("");
                                setStatusModalOpen(true);
                            }}
                            className="px-3.5 py-2 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1.5"
                        >
                            <Clock size={14} /> {job.status === "ON_HOLD" ? "Resume Sourcing" : "Put On Hold"}
                        </button>
                    </div>
                </div>

                {/* Progress Strip */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-4 flex-wrap text-xs">
                    <div className="flex items-center gap-6">
                        <div>
                            <span className="text-neutral-400 font-bold uppercase text-[10px]">Openings Target</span>
                            <p className="font-extrabold text-neutral-900 text-sm">{filledOpenings} / {totalOpenings} Filled ({percentFilled}%)</p>
                        </div>
                        <div>
                            <span className="text-neutral-400 font-bold uppercase text-[10px]">Active in Pipeline</span>
                            <p className="font-extrabold text-blue-600 text-sm">{candidates.length} Candidates</p>
                        </div>
                        <div>
                            <span className="text-neutral-400 font-bold uppercase text-[10px]">Days Open</span>
                            <p className="font-extrabold text-neutral-800 text-sm">{job.daysOpen || 0} Days</p>
                        </div>
                        <div>
                            <span className="text-neutral-400 font-bold uppercase text-[10px]">SLA Remaining</span>
                            <p className="font-extrabold text-emerald-600 text-sm">{job.daysRemaining != null ? `${job.daysRemaining} Days` : "On Track"}</p>
                        </div>
                    </div>

                    <div className="w-48">
                        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-emerald-600 rounded-full transition-all"
                                style={{ width: `${percentFilled}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-2 overflow-x-auto">
                {[
                    { id: "overview", label: "Overview" },
                    { id: "candidates", label: `Candidates (${candidates.length})` },
                    { id: "pipeline", label: "Pipeline Funnel" },
                    { id: "interviews", label: `Interviews (${interviews.length})` },
                    { id: "offers", label: `Offers (${offers.length})` },
                    { id: "recruiters", label: `Recruiter Team (${recruiters.length})` },
                    { id: "sla", label: "SLA Health" },
                    { id: "activity", label: `Activity (${auditLogs.length})` },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === t.id
                            ? "bg-primary text-white shadow-xs"
                            : "bg-white border border-neutral-200/80 text-neutral-600 hover:bg-neutral-50"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab 1: Overview */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <SectionCard title="Job Description & Sourcing Brief">
                            <div className="prose prose-sm max-w-none text-neutral-700 text-xs leading-relaxed space-y-3">
                                <p>{job.description || "No detailed job description provided."}</p>
                            </div>
                        </SectionCard>

                        <SectionCard title="Required Skills & Competencies">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Must Have Skills</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(job.skills || []).map((s: string) => (
                                            <span key={s} className="px-3 py-1 bg-primary/10 text-primary font-bold rounded-lg text-xs">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {job.preferredSkills && job.preferredSkills.length > 0 && (
                                    <div>
                                        <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Preferred / Good to Have</p>
                                        <div className="flex flex-wrap gap-2">
                                            {job.preferredSkills.map((s: string) => (
                                                <span key={s} className="px-3 py-1 bg-neutral-100 text-neutral-700 font-semibold rounded-lg text-xs">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </SectionCard>
                    </div>

                    <div className="space-y-6">
                        <SectionCard title="Requisition Ownership">
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">TA Manager</span>
                                    <span className="font-bold text-neutral-900">{job.taManagerName || "Neha Kulkarni"}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Primary Recruiter</span>
                                    <span className="font-bold text-neutral-900">{job.primaryRecruiterName || "Unassigned"}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Client Contact</span>
                                    <span className="font-bold text-neutral-900">{job.clientContactPerson || "Talent Team"}</span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-neutral-500">Created At</span>
                                    <span className="font-bold text-neutral-900">{new Date(job.createdAt).toLocaleDateString("en-IN")}</span>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Target Pipeline Benchmark">
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-neutral-500">Target Sourced Pool</span>
                                    <span className="font-bold text-neutral-900">{totalOpenings * 10} profiles</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500">Target 1st Interviews</span>
                                    <span className="font-bold text-neutral-900">{totalOpenings * 4} rounds</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500">Target Client Rounds</span>
                                    <span className="font-bold text-neutral-900">{totalOpenings * 2} rounds</span>
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            )}

            {/* Tab 2: Candidates */}
            {activeTab === "candidates" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                        <h3 className="font-bold text-neutral-900 text-sm">Candidates Submitted ({candidates.length})</h3>
                        <Link
                            href={`/ta/pipeline?jobId=${job.id}`}
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                            Open Kanban Pipeline <ChevronRight size={13} />
                        </Link>
                    </div>
                    {candidates.length === 0 ? (
                        <div className="p-8 text-center text-xs text-neutral-400">
                            No candidates currently in pipeline for this requisition.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs min-w-[800px]">
                                <thead>
                                    <tr className="bg-neutral-50 text-neutral-400 uppercase text-[10px] font-bold">
                                        <th className="py-3 px-4">Candidate</th>
                                        <th className="py-3 px-3">Stage</th>
                                        <th className="py-3 px-3">Fit Score</th>
                                        <th className="py-3 px-3">Experience</th>
                                        <th className="py-3 px-3">Days in Stage</th>
                                        <th className="py-3 px-3">Recruiter</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {candidates.map((c: any) => (
                                        <tr key={c.id} className="hover:bg-neutral-50/60">
                                            <td className="py-3 px-4 font-bold text-neutral-900">
                                                <Link href={`/ta/candidates/${c.candidateId}`} className="hover:text-primary">
                                                    {c.candidateName}
                                                </Link>
                                                <p className="text-[10px] text-neutral-400">{c.candidateEmail}</p>
                                            </td>
                                            <td className="py-3 px-3"><Badge value={c.stage} /></td>
                                            <td className="py-3 px-3 font-extrabold text-primary">{c.fitScore}%</td>
                                            <td className="py-3 px-3">{c.candidateTotalExp} yrs</td>
                                            <td className="py-3 px-3 font-medium">{c.daysInStage}d</td>
                                            <td className="py-3 px-3 text-neutral-600">{c.recruiterName}</td>
                                            <td className="py-3 px-4 text-right">
                                                <Link
                                                    href={`/ta/candidates/${c.candidateId}`}
                                                    className="px-2.5 py-1 bg-neutral-100 hover:bg-primary hover:text-white rounded-lg text-[11px] font-bold transition-colors"
                                                >
                                                    Profile →
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

            {/* Tab 3: Pipeline Funnel */}
            {activeTab === "pipeline" && (
                <SectionCard title="Candidate Pipeline Funnel Breakdown">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {[
                            { stage: "SOURCED", count: candidates.filter((c: any) => c.stage === "SOURCED").length },
                            { stage: "SCREENING", count: candidates.filter((c: any) => c.stage === "SCREENING").length },
                            { stage: "INTERVIEWS", count: candidates.filter((c: any) => ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND"].includes(c.stage)).length },
                            { stage: "HR ROUND", count: candidates.filter((c: any) => c.stage === "HR_ROUND").length },
                            { stage: "OFFER SENT", count: candidates.filter((c: any) => ["OFFER_SENT", "OFFER_ACCEPTED"].includes(c.stage)).length },
                            { stage: "ONBOARDING", count: candidates.filter((c: any) => c.stage === "ONBOARDING").length },
                            { stage: "JOINED", count: candidates.filter((c: any) => c.stage === "JOINED").length },
                        ].map((s) => (
                            <div key={s.stage} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-center">
                                <p className="text-[10px] font-bold uppercase text-neutral-400">{s.stage}</p>
                                <p className="text-xl font-black text-neutral-900 mt-1">{s.count}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Tab 4: Interviews */}
            {activeTab === "interviews" && (
                <SectionCard title={`Scheduled & Completed Rounds (${interviews.length})`}>
                    {interviews.length === 0 ? (
                        <p className="text-xs text-neutral-400 py-4 text-center">No interviews recorded for this requisition yet.</p>
                    ) : (
                        <div className="divide-y divide-neutral-100">
                            {interviews.map((inv: any) => (
                                <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-bold text-neutral-900">{inv.round} with {inv.candidateName}</p>
                                        <p className="text-[11px] text-neutral-400 mt-0.5">
                                            {new Date(inv.scheduledAt).toLocaleString("en-IN")} · Panel: {inv.interviewerName}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge value={inv.status} />
                                        {inv.score && (
                                            <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px]">
                                                {inv.score}/10
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            )}

            {/* Tab 5: SLA Health */}
            {activeTab === "sla" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SectionCard title="SLA Benchmark vs Current Performance">
                        <div className="space-y-4 text-xs">
                            <div className="flex justify-between py-2 border-b border-neutral-100">
                                <span className="text-neutral-500">Target Time to Fill</span>
                                <span className="font-bold text-neutral-900">{job.slaDays || 30} Days</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-100">
                                <span className="text-neutral-500">Days Elapsed</span>
                                <span className="font-bold text-neutral-900">{job.daysOpen || 0} Days</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-100">
                                <span className="text-neutral-500">Days Remaining</span>
                                <span className={`font-black ${job.daysRemaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                    {job.daysRemaining != null ? `${job.daysRemaining} Days` : "—"}
                                </span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-neutral-500">Current SLA Status</span>
                                <Badge value={job.calculatedSlaStatus || "ON_TRACK"} />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="SLA Risk Advisory">
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2 text-xs">
                            <p className="font-bold text-neutral-800">Action Plan</p>
                            <p className="text-neutral-600">
                                {job.daysRemaining < 0
                                    ? "This requisition has breached SLA benchmarks. Escalate candidate sourcing with agency partners or allocate secondary recruiters."
                                    : job.daysRemaining <= 5
                                        ? "SLA is at imminent risk. Ensure interview feedback is captured within 24 hours to prevent candidate drop-off."
                                        : "Requisition delivery is progressing according to agreed client SLAs."}
                            </p>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* Tab 6: Recruiter Team */}
            {activeTab === "recruiters" && (
                <SectionCard title="Assigned Sourcing & Recruiting Team">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {recruiters.map((r: any) => (
                            <div key={r.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                        {r.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-neutral-900 text-xs">{r.name}</p>
                                        <p className="text-[10px] text-neutral-400">{r.role || "Recruiter"}</p>
                                    </div>
                                </div>
                                <div className="text-[11px] text-neutral-600 pt-1">
                                    <p>Candidates Sourced: <strong>{r.sourcedCount || 0}</strong></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Tab 7: Activity */}
            {activeTab === "activity" && (
                <SectionCard title="Requisition Audit & Lifecycle Timeline">
                    <div className="space-y-3">
                        {auditLogs.map((log: any) => (
                            <div key={log.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-xs flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-neutral-900">{log.action}</p>
                                    <p className="text-[11px] text-neutral-500">{log.detail || log.description}</p>
                                </div>
                                <span className="text-[10px] text-neutral-400">{new Date(log.timestamp || log.createdAt).toLocaleString("en-IN")}</span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Assign Recruiter Modal */}
            {assignModalOpen && (
                <ModalShell
                    title="Assign Recruiter to Requisition"
                    onClose={() => setAssignModalOpen(false)}
                >
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Select Recruiter</label>
                            <select
                                value={selectedRecruiterId}
                                onChange={(e) => setSelectedRecruiterId(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            >
                                <option value="">Select a team member</option>
                                {teamMembers.map((m: any) => (
                                    <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setAssignModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!selectedRecruiterId || patchMutation.isPending}
                                onClick={() => patchMutation.mutate({ primaryRecruiterId: selectedRecruiterId })}
                                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                                Assign Recruiter
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* Edit Requirements Modal */}
            {reqModalOpen && (
                <ModalShell
                    title="Edit Requisition Specifications"
                    onClose={() => setReqModalOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            patchMutation.mutate({
                                openings: parseInt(reqForm.openings),
                                salaryMinLpa: parseFloat(reqForm.salaryMinLpa),
                                salaryMaxLpa: parseFloat(reqForm.salaryMaxLpa),
                                experienceMinYears: parseInt(reqForm.experienceMinYears),
                                experienceMaxYears: parseInt(reqForm.experienceMaxYears),
                                skills: reqForm.skills.split(",").map((s) => s.trim()).filter(Boolean),
                            });
                        }}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Openings</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={reqForm.openings}
                                    onChange={(e) => setReqForm({ ...reqForm, openings: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Min Exp (Yrs)</label>
                                <input
                                    type="number"
                                    value={reqForm.experienceMinYears}
                                    onChange={(e) => setReqForm({ ...reqForm, experienceMinYears: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Max Exp (Yrs)</label>
                                <input
                                    type="number"
                                    value={reqForm.experienceMaxYears}
                                    onChange={(e) => setReqForm({ ...reqForm, experienceMaxYears: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Min CTC LPA</label>
                                <input
                                    type="number"
                                    value={reqForm.salaryMinLpa}
                                    onChange={(e) => setReqForm({ ...reqForm, salaryMinLpa: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Max CTC LPA</label>
                                <input
                                    type="number"
                                    value={reqForm.salaryMaxLpa}
                                    onChange={(e) => setReqForm({ ...reqForm, salaryMaxLpa: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Skills (Comma separated)</label>
                            <input
                                type="text"
                                value={reqForm.skills}
                                onChange={(e) => setReqForm({ ...reqForm, skills: e.target.value })}
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setReqModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={patchMutation.isPending}
                                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* Status Change Modal */}
            {statusModalOpen && (
                <ModalShell
                    title={`Change Status to ${targetStatus}`}
                    onClose={() => setStatusModalOpen(false)}
                >
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Reason / Notes</label>
                            <textarea
                                rows={3}
                                value={statusReason}
                                onChange={(e) => setStatusReason(e.target.value)}
                                placeholder="Enter reason for this status change…"
                                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setStatusModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={patchMutation.isPending}
                                onClick={() => patchMutation.mutate({ status: targetStatus, reason: statusReason })}
                                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                                Confirm Status Update
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
