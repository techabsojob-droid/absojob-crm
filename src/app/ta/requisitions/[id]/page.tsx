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
import { RelatedTasks } from "@/components/tasks/TaskWidgets";
import { LogCallModal, CALL_STATUS, CALL_NEXT_ACTION } from "@/components/ta/CallLog";
import AddCandidateDialog from "@/components/ta/AddCandidateDialog";
import { ago } from "@/components/finance/kit";
import { requisitionLabel } from "@/lib/fit";
import type { JobAssignmentRecord, JobRequirementVersion } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { ActionDialog, StatusPill } from "@/components/ta/requisition/RequisitionActions";
import { RichText } from "@/components/ta/requisition/controls";
import {
    BILLING_TYPES, CONTRACT_TYPES, EMPLOYMENT_TYPES, HIRING_REASONS, JOB_CATEGORIES, PRIORITIES, REQUISITION_TYPES, SALARY_TYPES, WORK_MODES, optLabel, salaryUnit,
} from "@/lib/requisition-options";

const OPEN_STATUSES = ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE", "JOINING"];
const NOT_ACCEPTING = ["DRAFT", "PENDING_APPROVAL", "FULFILLED", "CLOSED", "CANCELLED", "ON_HOLD"];
const callLabel = (list: readonly (readonly [string, string])[], v: string | null) => list.find(([k]) => k === v)?.[1] ?? v ?? "";

export default function TaRequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: jobId } = use(params);
    const qc = useQueryClient();

    // Tabs for Requisition 360°
    const [activeTab, setActiveTab] = useState<
        | "overview"
        | "applications"
        | "pipeline"
        | "interviews"
        | "offers"
        | "recruiters"
        | "sla"
        | "activity"
        | "process"
        | "documents"
        | "commercial"
    >("overview");

    // Action modals
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [targetStatus, setTargetStatus] = useState("");
    const [statusReason, setStatusReason] = useState("");
    const [resumeDate, setResumeDate] = useState("");
    const [selectedRecruiterId, setSelectedRecruiterId] = useState("");

    const [dialog, setDialog] = useState<null | "close" | "cancel">(null);
    const [decision, setDecision] = useState<null | "REJECT" | "REQUEST_CHANGES">(null);
    const [decisionNote, setDecisionNote] = useState("");

    // Applications: filters, add-candidate and log-call modals
    const [appFilter, setAppFilter] = useState("ACTIVE");
    const [appSearch, setAppSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [callFor, setCallFor] = useState<any>(null);

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
    const { data: teamMembers = [] } = useQuery<any[]>({
        queryKey: ["team-members"],
        queryFn: async () => {
            const res = await fetch("/api/admin/team-members");
            if (!res.ok) return [];
            const d = await res.json();
            return d.users || [];
        },
        enabled: !!data?.canManage,
    });

    const refreshApps = () => {
        qc.invalidateQueries({ queryKey: ["job-360", jobId] });
        qc.invalidateQueries({ queryKey: ["ta-jobs"] });
        qc.invalidateQueries({ queryKey: ["pipeline"] });
    };
    const { user: me } = useAuth();
    // Approval decision from the requisition page (same workflow as the Approvals inbox)
    const decide = useMutation({
        mutationFn: (v: { id: string; action: "APPROVE" | "REJECT" | "REQUEST_CHANGES"; reviewComment?: string }) => api("/api/admin/approvals", "PATCH", v),
        onSuccess: (_d, v) => {
            toast.success(v.action === "APPROVE" ? "Requisition approved — open for recruitment" : v.action === "REJECT" ? "Requisition rejected" : "Sent back to the author for changes");
            setDecision(null);
            qc.invalidateQueries({ queryKey: ["job-360", jobId] });
            qc.invalidateQueries({ queryKey: ["ta-jobs"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const [docUploading, setDocUploading] = useState(false);
    const uploadDoc = async (file: File, type: string) => {
        if (file.size > 5 * 1024 * 1024) return toast.error("File is larger than 5 MB");
        setDocUploading(true);
        try {
            const dataBase64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
            const up = await api<{ id: string }>("/api/files", "POST", { name: file.name, mimeType: file.type, dataBase64, purpose: "job-document" });
            await api(`/api/admin/jobs/${jobId}`, "PATCH", { action: "addDocument", fileId: up.id, documentType: type });
            toast.success("Document added");
            qc.invalidateQueries({ queryKey: ["job-360", jobId] });
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setDocUploading(false);
        }
    };

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
            const messages: Record<string, string> = {
                approve: "Requisition approved & sourcing unlocked.",
                hold: "Requisition put on hold.",
                resume: "Sourcing resumed.",
                publish: "Requisition is now on the job listing.",
                unpublish: "Removed from the job listing.",
            };
            toast.success(messages[vars.action] ?? (vars.primaryRecruiterId ? "Recruiter assigned." : "Job requisition updated."));
            setStatusModalOpen(false);
            setAssignModalOpen(false);
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
                    <ArrowLeft size={16} /> Back to Job Listing
                </Link>
                <SectionCard>
                    <EmptyState icon={AlertTriangle} message="Requisition not found or could not be loaded." />
                </SectionCard>
            </div>
        );
    }

    const { job, canManage, candidates = [], interviews = [], offers = [], recruiters = [], auditLogs = [] } = data;
    const stats = data.requisitionStats as Record<string, number> | undefined;
    const pendingApproval = (data.approvalHistory ?? []).find((a: { status: string }) => a.status === "PENDING") as { id: string } | undefined;
    const acceptingCandidates = !NOT_ACCEPTING.includes(job.status);
    const activeApps = candidates.filter((c: any) => !["REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "BLACKLISTED"].includes(c.stage));
    const shownApps = candidates
        .filter((c: any) => appFilter === "ALL" || (appFilter === "ACTIVE" ? !["REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "BLACKLISTED", "JOINED"].includes(c.stage) : appFilter === "CLOSED" ? ["REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "BLACKLISTED"].includes(c.stage) : c.stage === appFilter))
        .filter((c: any) => !appSearch.trim() || [c.candidateName, c.candidateEmail, c.candidatePhone, c.candidateCurrentCompany].some((v) => String(v ?? "").toLowerCase().includes(appSearch.toLowerCase().trim())));
    const inJob = new Set<string>(activeApps.map((c: any) => String(c.candidateId)));

    const totalOpenings = job.openings || 1;
    const filledOpenings = job.filled || 0;
    const remainingOpenings = job.remainingOpenings ?? Math.max(0, totalOpenings - filledOpenings);
    const percentFilled = Math.min(100, Math.round((filledOpenings / totalOpenings) * 100));

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-16 animate-fade-in">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/ta/requisitions"
                            className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
                            title="Back to Job Listing"
                        >
                            <ArrowLeft size={16} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-black text-neutral-900 tracking-tight">{job.title}</h1>
                                <span className="font-mono text-xs font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md">
                                    {requisitionLabel(job)}
                                </span>
                                <StatusPill status={job.status} />
                                <Badge value={job.priority} label={optLabel(PRIORITIES, job.priority)} />
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

                    {/* Actions — assignment, specification, hold and listing are team-lead only */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {data.canEdit && (
                            <Link href={`/ta/requisitions/${job.id}/edit`} className="px-3.5 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5">
                                <Edit2 size={14} /> Edit
                            </Link>
                        )}
                        <Link href={`/ta/requisitions/new?from=${job.id}`} className="px-3.5 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5">
                            <Layers size={14} /> Duplicate
                        </Link>
                        {canManage && !["CLOSED", "CANCELLED", "FULFILLED", "DRAFT"].includes(job.status) && (
                            <button onClick={() => setDialog("close")} className="px-3.5 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5"><CheckCircle2 size={14} /> Close</button>
                        )}
                        {canManage && !["CLOSED", "CANCELLED", "FULFILLED"].includes(job.status) && (
                            <button onClick={() => setDialog("cancel")} className="px-3.5 py-2 border border-red-200 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5"><X size={14} /> Cancel</button>
                        )}
                        <Link
                            href={`/ta/pipeline?jobId=${job.id}`}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                            <GitBranch size={14} /> Open Pipeline
                        </Link>
                        <button
                            onClick={() => { setAddOpen(true); }}
                            disabled={!acceptingCandidates}
                            title={acceptingCandidates ? "Add a candidate to this job" : `Requisition is ${job.status.replace(/_/g, " ").toLowerCase()} and not accepting candidates`}
                            className="px-3.5 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                        >
                            <Plus size={14} /> Add Candidate
                        </button>
                        {canManage && (
                            <>
                                <button
                                    onClick={() => { setSelectedRecruiterId(job.primaryRecruiterId || ""); setAssignModalOpen(true); }}
                                    className="px-3.5 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors flex items-center gap-1.5"
                                >
                                    <Users size={14} /> Assign Recruiter
                                </button>

                                {OPEN_STATUSES.includes(job.status) && (
                                    <button
                                        onClick={() => patchMutation.mutate({ action: job.listed ? "unpublish" : "publish" })}
                                        disabled={patchMutation.isPending}
                                        className={`px-3.5 py-2 border rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 ${job.listed ? "border-blue-200 text-blue-700 hover:bg-blue-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                                    >
                                        <Share2 size={14} /> {job.listed ? "Remove from Job Listing" : "Publish to Job Listing"}
                                    </button>
                                )}
                                {(OPEN_STATUSES.includes(job.status) || job.status === "ON_HOLD") && (
                                    <button
                                        onClick={() => {
                                            setTargetStatus(job.status === "ON_HOLD" ? "resume" : "hold");
                                            setStatusReason("");
                                            setResumeDate("");
                                            setStatusModalOpen(true);
                                        }}
                                        className="px-3.5 py-2 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1.5"
                                    >
                                        <Clock size={14} /> {job.status === "ON_HOLD" ? "Resume Sourcing" : "Put On Hold"}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {job.status === "ON_HOLD" && job.statusReason && (
                    <p className="text-xs rounded-xl bg-orange-50 border border-orange-100 text-orange-800 px-3 py-2">
                        <b>On hold:</b> {job.statusReason}{job.holdResumeDate ? ` · planned resume ${new Date(job.holdResumeDate).toLocaleDateString("en-IN")}` : ""}
                    </p>
                )}

                {/* Workflow banners */}
                {job.status === "DRAFT" && (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-neutral-700"><b>Draft</b> — not yet submitted.{job.statusReason ? <span className="text-amber-700"> {job.statusReason}</span> : null}</span>
                        {data.canEdit && <Link href={`/ta/requisitions/${job.id}/edit`} className="px-3 py-1.5 rounded-lg bg-primary text-white font-bold">Continue editing & submit</Link>}
                    </div>
                )}
                {job.status === "PENDING_APPROVAL" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-amber-800"><b>Pending approval</b> — raised by {data.createdByName ?? "a recruiter"}{job.submittedAt ? ` on ${new Date(job.submittedAt).toLocaleDateString("en-IN")}` : ""}.</span>
                        {canManage && pendingApproval && job.requestedById !== me?.id && (
                            <div className="flex items-center gap-2">
                                <button disabled={decide.isPending} onClick={() => decide.mutate({ id: pendingApproval.id, action: "APPROVE" })} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50">Approve</button>
                                <button onClick={() => { setDecision("REQUEST_CHANGES"); setDecisionNote(""); }} className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 font-bold">Request changes</button>
                                <button onClick={() => { setDecision("REJECT"); setDecisionNote(""); }} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-bold bg-white">Reject</button>
                            </div>
                        )}
                    </div>
                )}
                {job.status === "CANCELLED" && (job.rejectionReason || job.cancelReason) && (
                    <p className="text-xs rounded-xl bg-red-50 border border-red-100 text-red-700 px-3 py-2"><b>{job.rejectionReason ? "Rejected" : "Cancelled"}:</b> {job.rejectionReason ?? job.cancelReason}</p>
                )}

                {/* Key numbers */}
                <div className="pt-3 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {([
                        ["Total openings", totalOpenings, "text-neutral-900"],
                        ["Filled", filledOpenings, "text-emerald-600"],
                        ["Remaining", remainingOpenings, remainingOpenings ? "text-amber-600" : "text-neutral-400"],
                        ["Total candidates", stats?.totalCandidates ?? candidates.length, "text-blue-600"],
                        ["Shortlisted", stats?.shortlistedOrBeyond ?? 0, "text-violet-600"],
                        ["Selected", (stats?.selected ?? 0) + (stats?.offered ?? 0) + (stats?.joined ?? 0), "text-primary"],
                    ] as const).map(([l, v, tone]) => (
                        <div key={l} className="rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{l}</p>
                            <p className={`text-xl font-extrabold mt-0.5 ${tone}`}>{v}</p>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                    <div className="w-40 h-1.5 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${percentFilled}%` }} /></div>
                    <span>{percentFilled}% filled · {job.daysOpen || 0} days open{job.targetCloseDate ? ` · target closure ${new Date(`${job.targetCloseDate}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" })}` : ""}</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-2 overflow-x-auto">
                {[
                    { id: "overview", label: "Overview" },
                    { id: "applications", label: `Candidates (${candidates.length})` },
                    { id: "pipeline", label: "Hiring Pipeline" },
                    { id: "process", label: `Interview Process (${(job.interviewRounds ?? []).length})` },
                    { id: "interviews", label: `Interviews (${interviews.length})` },
                    { id: "offers", label: `Offers (${offers.length})` },
                    { id: "recruiters", label: `Recruiter Team (${recruiters.length})` },
                    { id: "documents", label: `Documents (${(job.documents ?? []).filter((d: any) => d.status !== "ARCHIVED").length})` },
                    { id: "commercial", label: "Commercial Details" },
                    { id: "sla", label: "SLA Health" },
                    { id: "activity", label: `Activity History (${auditLogs.length})` },
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
                        <RelatedTasks relatedType="JOB" relatedId={jobId} recordName={job.title} />
                        <SectionCard title="Requisition details">
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                                {([
                                    ["Job category", optLabel(JOB_CATEGORIES, job.jobCategory)],
                                    ["Employment type", optLabel(EMPLOYMENT_TYPES, job.employmentType)],
                                    ["Requisition type", optLabel(REQUISITION_TYPES, job.requisitionType ?? (job.vacancyType === "REPLACEMENT" ? "REPLACEMENT" : "NEW_POSITION"))],
                                    ["Replacement for", job.replacementFor],
                                    ["Hiring reason", optLabel(HIRING_REASONS, job.hiringReason)],
                                    ["Salary", job.salaryAmountMin != null && job.salaryType && job.salaryType !== "ANNUAL_CTC" ? `${job.salaryAmountMin}–${job.salaryAmountMax} ${salaryUnit(job.salaryType)} (≈ ${job.salaryMinLpa}–${job.salaryMaxLpa} LPA)` : `₹${job.salaryMinLpa}–${job.salaryMaxLpa} LPA`],
                                    ["Salary type", optLabel(SALARY_TYPES, job.salaryType ?? "ANNUAL_CTC")],
                                    ["Notice period", job.noticePeriodPreference],
                                    ["Joining timeline", job.joiningPreference],
                                    ["Minimum qualification", job.minimumQualification ?? job.education],
                                    ["Preferred qualification", job.preferredQualification],
                                    ["Certifications", (job.certifications ?? []).join(", ")],
                                    ["Work mode", optLabel(WORK_MODES, job.workMode)],
                                    ["Location", [job.locationLocality, job.city, job.locationDistrict && job.locationDistrict !== job.city ? job.locationDistrict : null, job.locationState].filter(Boolean).join(", ") + (job.locationPincode ? ` – ${job.locationPincode}` : "") || job.location],
                                    ["Office address", job.officeAddress ? [job.officeAddress.building, job.officeAddress.floor, job.officeAddress.street, job.officeAddress.landmark].filter(Boolean).join(", ") : null],
                                    ["Remote preference", job.workMode === "REMOTE" ? job.remoteLocationPreference : null],
                                    ["Relocation / travel", [job.relocationRequired ? "Relocation required" : null, job.travelRequired ? "Travel required" : null].filter(Boolean).join(" · ")],
                                    ["Recruiter team", job.recruiterTeam],
                                    ["Secondary recruiters", (job.secondaryRecruiters ?? []).map((r: { name: string }) => r.name).join(", ")],
                                    ["Expected joining", job.targetJoiningDate ? new Date(`${job.targetJoiningDate}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" }) : null],
                                ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([k, v]) => (
                                    <div key={k} className="flex gap-3"><dt className="w-36 shrink-0 text-neutral-500">{k}</dt><dd className="text-neutral-800 font-medium min-w-0 break-words">{v}</dd></div>
                                ))}
                            </dl>
                        </SectionCard>
                        <SectionCard title="Job Description">
                            <RichText html={job.descriptionHtml} text={job.description || "No detailed job description provided."} />
                            {(job.responsibilitiesHtml || job.responsibilities) && (
                                <div className="mt-4 pt-4 border-t border-neutral-100">
                                    <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Key responsibilities</p>
                                    <RichText html={job.responsibilitiesHtml} text={job.responsibilities} />
                                </div>
                            )}
                            {job.additionalRequirements && (
                                <div className="mt-4 pt-4 border-t border-neutral-100">
                                    <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Additional requirements</p>
                                    <p className="text-sm text-neutral-700 whitespace-pre-line">{job.additionalRequirements}</p>
                                </div>
                            )}
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
                        <SectionCard title="Work Details">
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Employment Type</span>
                                    <span className="font-bold text-neutral-900 text-right">{String(job.employmentType || "FULL_TIME").replace(/_/g, " ").toLowerCase()}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Work Mode</span>
                                    <span className="font-bold text-neutral-900 text-right">{String(job.workMode || "HYBRID").toLowerCase()}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Shift</span>
                                    <span className="font-bold text-neutral-900 text-right">{String(job.shiftTiming || "DAY").toLowerCase()}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Job Level</span>
                                    <span className="font-bold text-neutral-900 text-right">{job.jobLevel ? job.jobLevel.toLowerCase() : "—"}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Vacancy</span>
                                    <span className="font-bold text-neutral-900 text-right">{job.vacancyType === "REPLACEMENT" ? `Replacement for ${job.replacementFor || "—"}` : "New hiring"}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Education</span>
                                    <span className="font-bold text-neutral-900 text-right">{job.education || "—"}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Joining / Notice</span>
                                    <span className="font-bold text-neutral-900 text-right">{job.joiningPreference || job.noticePeriodPreference || "—"}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Interview Rounds</span>
                                    <span className="font-bold text-neutral-900 text-right">{(job.interviewRounds || []).join(" → ") || "—"}</span>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Hiring Management">
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Requisition ID</span>
                                    <span className="font-bold text-neutral-900 text-right">{requisitionLabel(job)}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Assigned Recruiter</span>
                                    <span className="font-bold text-neutral-900 text-right">{job.primaryRecruiterName || "Unassigned"}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">TA Manager</span>
                                    <span className="font-bold text-neutral-900 text-right">{job.taManagerName || "—"}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Hiring Manager</span>
                                    <span className="font-bold text-neutral-900 text-right">{job.hiringManagerName || job.clientContactPerson || "—"}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Requisition Date</span>
                                    <span className="font-bold text-neutral-900 text-right">{new Date(job.createdAt).toLocaleDateString("en-IN")}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Target Closing Date</span>
                                    <span className="font-bold text-neutral-900 text-right">{job.targetCloseDate ? new Date(job.targetCloseDate).toLocaleDateString("en-IN") : "—"}</span>
                                </div>
                                <div className="flex justify-between gap-3 py-1.5 border-b border-neutral-100">
                                    <span className="text-neutral-500">Job Listing</span>
                                    <span className="font-bold text-neutral-900 text-right">{job.listed && OPEN_STATUSES.includes(job.status) ? `Listed${job.publishedAt ? ` ${new Date(job.publishedAt).toLocaleDateString("en-IN")}` : ""}${job.publishedByName ? ` by ${job.publishedByName}` : ""}` : "Not listed"}</span>
                                </div>
                            </div>
                            {canManage && job.internalNotes && (
                                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-900">
                                    <p className="font-bold text-[10px] uppercase tracking-wider mb-1">Internal notes · team leads only</p>
                                    <p className="whitespace-pre-line">{job.internalNotes}</p>
                                </div>
                            )}
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

            {/* Tab 2: Applications */}
            {activeTab === "applications" && (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between gap-3 flex-wrap">
                        <h3 className="font-bold text-neutral-900 text-sm">Applications ({shownApps.length}{shownApps.length !== candidates.length ? ` of ${candidates.length}` : ""})</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input
                                value={appSearch}
                                onChange={(e) => setAppSearch(e.target.value)}
                                placeholder="Search name, phone, email…"
                                className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:border-primary w-52"
                            />
                            <select value={appFilter} onChange={(e) => setAppFilter(e.target.value)} aria-label="Filter applications" className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold outline-none">
                                <option value="ACTIVE">Active</option>
                                <option value="ALL">All</option>
                                <option value="SOURCED">Sourced</option>
                                <option value="SCREENING">Screening</option>
                                <option value="INTERVIEW_SCHEDULED">Interview scheduled</option>
                                <option value="OFFER_SENT">Offer sent</option>
                                <option value="JOINED">Joined</option>
                                <option value="CLOSED">Rejected / backed out</option>
                            </select>
                            <button
                                onClick={() => { setAddOpen(true); }}
                                disabled={!acceptingCandidates}
                                className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                                <Plus size={13} /> Add Candidate
                            </button>
                            <Link href={`/ta/pipeline?jobId=${job.id}`} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                Kanban <ChevronRight size={13} />
                            </Link>
                        </div>
                    </div>
                    {shownApps.length === 0 ? (
                        <div className="p-8 text-center text-xs text-neutral-400 space-y-2">
                            <p>{candidates.length === 0 ? "No candidates have been added to this requisition yet." : "No applications match this filter."}</p>
                            {candidates.length === 0 && acceptingCandidates && (
                                <button onClick={() => { setAddOpen(true); }} className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold">Add the first candidate</button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs min-w-[1100px]">
                                <thead>
                                    <tr className="bg-neutral-50 text-neutral-400 uppercase text-[10px] font-bold">
                                        <th className="py-3 px-4">Candidate</th>
                                        <th className="py-3 px-3">Stage</th>
                                        <th className="py-3 px-3">Fit</th>
                                        <th className="py-3 px-3">Exp / Notice</th>
                                        <th className="py-3 px-3">CTC (cur → exp)</th>
                                        <th className="py-3 px-3">Last Call</th>
                                        <th className="py-3 px-3">Recruiter</th>
                                        <th className="py-3 px-3">Added</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {shownApps.map((c: any) => (
                                        <tr key={c.id} className="hover:bg-neutral-50/60 align-top">
                                            <td className="py-3 px-4">
                                                <Link href={`/ta/candidates/${c.candidateId}`} className="font-bold text-neutral-900 hover:text-primary">{c.candidateName}</Link>
                                                <p className="text-[10px] text-neutral-500">{c.candidateHeadline || c.candidateCurrentCompany}</p>
                                                <p className="text-[10px] text-neutral-400">
                                                    <a href={`tel:${c.candidatePhone}`} className="hover:text-primary">{c.candidatePhone}</a> · {c.candidateEmail}
                                                </p>
                                            </td>
                                            <td className="py-3 px-3"><Badge value={c.stage} /></td>
                                            <td className="py-3 px-3 font-extrabold text-primary">{c.fitScore}%</td>
                                            <td className="py-3 px-3">{c.candidateTotalExp} yrs<p className="text-[10px] text-neutral-400">{c.candidateNoticeDays ? `${c.candidateNoticeDays}d notice` : "Immediate"}</p></td>
                                            <td className="py-3 px-3 font-semibold">₹{c.candidateCurrentCtc}L → <span className={c.candidateExpectedCtc > job.salaryMaxLpa ? "text-red-600" : "text-emerald-700"}>₹{c.candidateExpectedCtc}L</span></td>
                                            <td className="py-3 px-3">
                                                {c.lastCall ? (
                                                    <div className="space-y-0.5">
                                                        <Badge value={c.lastCall.callStatus} label={callLabel(CALL_STATUS, c.lastCall.callStatus)} />
                                                        <p className="text-[10px] text-neutral-400">{ago(c.lastCall.calledAt)} · {c.callsCount} call{c.callsCount > 1 ? "s" : ""}</p>
                                                        {(c.lastCall.followUpDate || c.lastCall.nextAction) && (
                                                            <p className="text-[10px] font-semibold text-primary">{c.lastCall.followUpDate ? `Follow up ${c.lastCall.followUpDate}` : callLabel(CALL_NEXT_ACTION, c.lastCall.nextAction)}</p>
                                                        )}
                                                    </div>
                                                ) : <span className="text-[10px] text-amber-600 font-bold">Not called yet</span>}
                                            </td>
                                            <td className="py-3 px-3 text-neutral-600">{c.recruiterName}</td>
                                            <td className="py-3 px-3 text-neutral-500">{new Date(c.createdAt).toLocaleDateString("en-IN")}<p className="text-[10px] text-neutral-400">{c.daysInStage}d in stage</p></td>
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => setCallFor(c)}
                                                    className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[11px] font-bold transition-colors mr-1.5"
                                                >
                                                    Log call
                                                </button>
                                                {c.candidateResumeUrl && (
                                                    <a href={c.candidateResumeUrl} target="_blank" rel="noopener" className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-[11px] font-bold transition-colors mr-1.5">CV</a>
                                                )}
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
            {activeTab === "pipeline" && stats && (
                <SectionCard title="Candidate pipeline" subtitle="Where every candidate linked to this requisition is right now">
                    <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                        {([
                            ["Total", stats.totalCandidates], ["Sourced", stats.sourced], ["Submitted to client", stats.submittedToClient], ["Shortlisted", stats.shortlisted],
                            ["Interview scheduled", stats.interviewScheduled], ["Selected", stats.selected], ["Offered", stats.offered], ["Joined", stats.joined],
                            ["Rejected", stats.rejected], ["On hold", stats.onHold],
                        ] as [string, number][]).map(([l, v]) => (
                            <div key={l} className="rounded-xl border border-neutral-100 bg-neutral-50/60 px-2.5 py-2 text-center">
                                <p className="text-lg font-extrabold text-neutral-900">{v ?? 0}</p>
                                <p className="text-[10px] font-semibold text-neutral-500 leading-tight">{l}</p>
                            </div>
                        ))}
                    </div>
                    {(stats.withdrawn ?? 0) > 0 && <p className="text-[11px] text-neutral-400 mt-2">{stats.withdrawn} withdrew, backed out or were not interested — they never count as filled.</p>}
                </SectionCard>
            )}
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
                                        <p className="text-[10px] text-neutral-400">{r.isPrimary ? "Primary recruiter" : r.designation || "Recruiter"}</p>
                                    </div>
                                </div>
                                <div className="text-[11px] text-neutral-600 pt-1">
                                    <p>Candidates: <strong>{r.candidatesCount || 0}</strong> · Interviews: <strong>{r.interviewsCount || 0}</strong> · Joined: <strong>{r.joinedCount || 0}</strong></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
            {activeTab === "recruiters" && (
                <SectionCard title="Recruiter assignment history" subtitle="Who owned this requisition and when (only team leads can change it)">
                    {!(job.assignmentHistory ?? []).length ? (
                        <p className="text-xs text-neutral-400 py-4 text-center">No recruiter assignments recorded yet.</p>
                    ) : (
                        <ul className="divide-y divide-neutral-100 text-xs">
                            {[...(job.assignmentHistory as JobAssignmentRecord[])].sort((a, b) => +new Date(b.assignedAt) - +new Date(a.assignedAt)).map((h) => (
                                <li key={h.id} className="py-2.5 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-neutral-900">{h.recruiterName} <span className="font-medium text-neutral-400">· {h.role.replace(/_/g, " ").toLowerCase()}</span></p>
                                        <p className="text-neutral-500">Assigned by {h.assignedByName} on {new Date(h.assignedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                                            {h.unassignedAt ? ` · removed ${new Date(h.unassignedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}${h.unassignedReason ? ` (${h.unassignedReason})` : ""}` : ""}</p>
                                    </div>
                                    <Badge value={h.active ? "ACTIVE" : "INACTIVE"} label={h.active ? "Current" : "Past"} />
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            {/* Tab 7: Activity */}
            {activeTab === "activity" && (job.requirementVersions ?? []).length > 0 && (
                <SectionCard title="Specification change history" subtitle="Every change to openings, CTC, experience, skills or location">
                    <ol className="relative border-l border-neutral-200 ml-2 space-y-4">
                        {[...(job.requirementVersions as JobRequirementVersion[])].sort((a, b) => b.version - a.version).map((v) => (
                            <li key={v.version} className="ml-4 text-xs">
                                <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary/70 border-2 border-white" />
                                <p className="font-bold text-neutral-900">Version {v.version} · {v.changeSummary}</p>
                                <p className="text-neutral-600">
                                    {v.openings} opening(s) · {v.salaryMinLpa}–{v.salaryMaxLpa} LPA · {v.experienceMinYears}–{v.experienceMaxYears} yrs · {v.location}{v.workMode ? ` (${v.workMode.toLowerCase()})` : ""}
                                </p>
                                {!!v.skills?.length && <p className="text-neutral-500">Skills: {v.skills.join(", ")}</p>}
                                <p className="text-neutral-400 flex items-center gap-1"><Clock size={10} /> {v.changedByName} · {new Date(v.changedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                            </li>
                        ))}
                    </ol>
                </SectionCard>
            )}
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

            {/* Assign Recruiter Modal (team lead only) */}
            {assignModalOpen && canManage && (
                <ModalShell
                    title="Assign Recruiter to Requisition"
                    onClose={() => setAssignModalOpen(false)}
                >
                    <div className="space-y-4">
                        <p className="text-xs text-neutral-500">
                            Current primary recruiter: <b className="text-neutral-800">{job.primaryRecruiterName || "Unassigned"}</b>. The new recruiter is notified and added to the requisition team.
                        </p>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Select Recruiter</label>
                            <select
                                value={selectedRecruiterId}
                                onChange={(e) => setSelectedRecruiterId(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            >
                                <option value="">Select a team member</option>
                                {teamMembers.filter((m: any) => ["TA_RECRUITER", "TA_MANAGER"].includes(m.role)).map((m: any) => (
                                    <option key={m.id} value={m.id}>{m.name} · {m.designation || m.role.replace(/_/g, " ").toLowerCase()}</option>
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
                                disabled={!selectedRecruiterId || selectedRecruiterId === job.primaryRecruiterId || patchMutation.isPending}
                                onClick={() => patchMutation.mutate({ primaryRecruiterId: selectedRecruiterId })}
                                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                                Assign Recruiter
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* Interview process (rounds defined on the requisition) */}
            {activeTab === "process" && (
                <SectionCard title="Interview Process" subtitle="Rounds candidates go through for this requisition">
                    {!(job.interviewRounds ?? []).length ? (
                        <EmptyState icon={Layers} message="No interview rounds defined." action={data.canEdit ? <Link href={`/ta/requisitions/${job.id}/edit`} className="text-xs font-bold text-primary">Add rounds</Link> : undefined} />
                    ) : (
                        <ol className="relative border-l-2 border-primary/20 ml-3 space-y-4">
                            {(job.interviewRounds as string[]).map((r, i) => {
                                const held = interviews.filter((iv: any) => String(iv.round ?? "").replace(/_/g, " ").toLowerCase().includes(r.toLowerCase().split(" ")[0])).length;
                                return (
                                    <li key={i} className="ml-5">
                                        <span className="absolute -left-[13px] w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                                        <p className="text-sm font-bold text-neutral-900">{r}</p>
                                        <p className="text-xs text-neutral-500">{held ? `${held} interview(s) scheduled so far` : "No interviews yet"}</p>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </SectionCard>
            )}

            {/* Documents */}
            {activeTab === "documents" && (
                <SectionCard title="Documents" subtitle="JD, client requirement, rate card and other files for this requisition"
                    action={canManage ? (
                        <label className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${docUploading ? "bg-neutral-100 text-neutral-400" : "bg-primary text-white"}`}>
                            <Plus size={13} /> {docUploading ? "Uploading…" : "Upload"}
                            <input type="file" className="hidden" disabled={docUploading} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.csv"
                                onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadDoc(file, /jd|description/i.test(file.name) ? "JD" : "OTHER"); e.target.value = ""; }} />
                        </label>
                    ) : undefined}>
                    {!(job.documents ?? []).filter((d: any) => d.status !== "ARCHIVED").length ? (
                        <EmptyState icon={FileText} message={canManage ? "No documents yet — upload the JD or client requirement." : "No documents yet."} />
                    ) : (
                        <ul className="divide-y divide-neutral-100">
                            {(job.documents as any[]).filter((d) => d.status !== "ARCHIVED").map((d) => (
                                <li key={d.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText size={16} className="text-primary shrink-0" />
                                        <div className="min-w-0">
                                            <p className="font-bold text-neutral-800 truncate">{d.name}</p>
                                            <p className="text-neutral-400">{String(d.type).replace(/_/g, " ").toLowerCase()} · v{d.version} · {d.fileSizeKb} KB · {d.uploadedByName} · {new Date(d.uploadedAt).toLocaleDateString("en-IN")}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg border border-neutral-200 font-bold text-neutral-600 hover:bg-neutral-50 flex items-center gap-1"><Download size={12} /> Open</a>
                                        {canManage && <button onClick={() => patchMutation.mutate({ action: "archiveDocument", documentId: d.id })} className="px-2.5 py-1 rounded-lg border border-neutral-200 font-bold text-neutral-500 hover:text-red-600">Archive</button>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            {/* Commercial details */}
            {activeTab === "commercial" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard title="Client contact">
                        <dl className="grid grid-cols-[140px_1fr] gap-y-2.5 text-xs">
                            <dt className="text-neutral-500">Contact person</dt><dd className="font-semibold text-neutral-800">{job.clientContactPerson || "—"}</dd>
                            <dt className="text-neutral-500">HR email</dt><dd className="text-neutral-800">{job.clientContactEmail ? <a href={`mailto:${job.clientContactEmail}`} className="text-primary hover:underline">{job.clientContactEmail}</a> : "—"}</dd>
                            <dt className="text-neutral-500">HR phone</dt><dd className="text-neutral-800">{job.clientContactPhone ? <a href={`tel:${String(job.clientContactPhone).replace(/\s/g, "")}`} className="text-primary hover:underline">{job.clientContactPhone}</a> : "—"}</dd>
                            <dt className="text-neutral-500">Client reference</dt><dd className="text-neutral-800">{job.clientRequisitionId || "—"}</dd>
                            <dt className="text-neutral-500">Hiring manager</dt><dd className="text-neutral-800">{job.hiringManagerName || "—"}</dd>
                        </dl>
                    </SectionCard>
                    <SectionCard title="Commercials">
                        <dl className="grid grid-cols-[160px_1fr] gap-y-2.5 text-xs">
                            <dt className="text-neutral-500">Billing type</dt><dd className="font-semibold text-neutral-800">{optLabel(BILLING_TYPES, job.billingType) || "—"}</dd>
                            <dt className="text-neutral-500">Placement fee</dt><dd className="text-neutral-800">{job.placementFeePct != null ? `${job.placementFeePct}%` : "—"}</dd>
                            <dt className="text-neutral-500">Contract type</dt><dd className="text-neutral-800">{optLabel(CONTRACT_TYPES, job.contractType) || "—"}</dd>
                            <dt className="text-neutral-500">Replacement guarantee</dt><dd className="text-neutral-800">{job.replacementGuaranteeDays != null ? `${job.replacementGuaranteeDays} days` : "—"}</dd>
                            <dt className="text-neutral-500">Account manager</dt><dd className="text-neutral-800">{job.accountManagerName || "—"}</dd>
                        </dl>
                        {job.commercialNotes && <p className="mt-3 text-xs text-neutral-700 whitespace-pre-line p-3 rounded-xl bg-neutral-50 border border-neutral-100">{job.commercialNotes}</p>}
                    </SectionCard>
                </div>
            )}

            {/* Approval history (activity tab) */}
            {activeTab === "activity" && (
                <SectionCard title="Approval history" subtitle={`Created by ${data.createdByName ?? "—"} on ${new Date(job.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${data.updatedByName ? ` · last updated by ${data.updatedByName}` : ""}`}>
                    {!(data.approvalHistory ?? []).length ? (
                        <p className="text-xs text-neutral-400 py-3">{job.approvedAt ? `Opened directly by ${job.approvedByName ?? "a team lead"} on ${new Date(job.approvedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} (no approval required).` : "No approval requests."}</p>
                    ) : (
                        <ul className="divide-y divide-neutral-100 text-xs">
                            {(data.approvalHistory as any[]).map((a) => (
                                <li key={a.id} className="py-2.5 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-neutral-800">{a.status === "PENDING" ? "Awaiting decision" : a.status === "APPROVED" ? `Approved by ${a.reviewedByName}` : a.status === "REJECTED" ? `Rejected by ${a.reviewedByName}` : `Changes requested by ${a.reviewedByName}`}</p>
                                        <p className="text-neutral-500">Requested by {a.requestedByName} · {new Date(a.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{a.reviewedAt ? ` · decided ${new Date(a.reviewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>
                                        {a.reviewComment && <p className="text-neutral-700 mt-0.5">“{a.reviewComment}”</p>}
                                    </div>
                                    <Badge value={a.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            {dialog && (
                <ActionDialog kind={dialog} job={job} onClose={() => setDialog(null)} onDone={() => { setDialog(null); qc.invalidateQueries({ queryKey: ["job-360", jobId] }); qc.invalidateQueries({ queryKey: ["ta-jobs"] }); }} />
            )}
            {decision && pendingApproval && (
                <ModalShell title={decision === "REJECT" ? "Reject requisition" : "Request changes"} onClose={() => setDecision(null)}>
                    <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); if (!decisionNote.trim()) { toast.error("Please give a reason"); return; } decide.mutate({ id: pendingApproval.id, action: decision, reviewComment: decisionNote.trim() }); }}>
                        <p className="text-neutral-600">{decision === "REJECT" ? "The requisition will be cancelled and the author notified." : "The requisition goes back to the author as a draft to edit and resubmit."}</p>
                        <textarea required rows={3} maxLength={500} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder={decision === "REJECT" ? "Reason for rejecting" : "What should be changed?"} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 outline-none focus:border-primary" />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setDecision(null)} className="h-10 px-4 rounded-xl border border-neutral-200 font-semibold text-neutral-700">Back</button>
                            <button disabled={decide.isPending} className={`h-10 px-4 rounded-xl text-white font-semibold disabled:opacity-50 ${decision === "REJECT" ? "bg-red-600" : "bg-amber-600"}`}>{decision === "REJECT" ? "Reject" : "Request changes"}</button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* Put On Hold / Resume Modal (team lead only) */}
            {statusModalOpen && canManage && (
                <ModalShell
                    title={targetStatus === "hold" ? "Put Requisition On Hold" : "Resume Sourcing"}
                    onClose={() => setStatusModalOpen(false)}
                >
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            patchMutation.mutate({ action: targetStatus, reason: statusReason, resumeDate: resumeDate || undefined });
                        }}
                    >
                        {targetStatus === "hold" && (
                            <p className="text-xs text-neutral-500">New candidates cannot be added while on hold, and it is removed from the job listing.</p>
                        )}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Reason {targetStatus === "hold" ? "*" : "(optional)"}</label>
                            <textarea
                                rows={3}
                                required={targetStatus === "hold"}
                                value={statusReason}
                                onChange={(e) => setStatusReason(e.target.value)}
                                placeholder={targetStatus === "hold" ? "e.g. Client froze budget until next quarter" : "e.g. Client confirmed budget"}
                                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                            />
                        </div>
                        {targetStatus === "hold" && (
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Expected resume date (optional)</label>
                                <input type="date" min={new Date().toISOString().slice(0, 10)} value={resumeDate} onChange={(e) => setResumeDate(e.target.value)} className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none" />
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setStatusModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={patchMutation.isPending}
                                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                                {targetStatus === "hold" ? "Put On Hold" : "Resume Sourcing"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* Add Candidate to this job — same flow as everywhere in the TA portal */}
            {addOpen && (
                <AddCandidateDialog jobId={jobId} jobTitle={job.title} jobSkills={job.skills} inJobCandidateIds={inJob}
                    onClose={() => setAddOpen(false)} onDone={() => { setActiveTab("applications"); refreshApps(); }} />
            )}

            {/* Log a call against one application */}
            {callFor && (
                <LogCallModal
                    candidateId={callFor.candidateId}
                    candidateName={callFor.candidateName}
                    application={{ id: callFor.id, jobTitle: job.title, clientName: job.clientName, stage: callFor.stage }}
                    defaults={{ currentCtcLpa: callFor.candidateCurrentCtc, expectedCtcLpa: callFor.candidateExpectedCtc, noticePeriodDays: callFor.candidateNoticeDays }}
                    onClose={() => setCallFor(null)}
                />
            )}
        </div>
    );
}
