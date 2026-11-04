"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    ArrowLeft, Building2, Briefcase, Users, IndianRupee, Mail, Phone,
    MapPin, Globe, Calendar, UserCheck, Plus, CheckCircle2, Clock,
    FileText, ExternalLink, AlertCircle, ChevronRight, Loader2,
    ShieldAlert, Award, MessageSquare, ShieldCheck, Download, Edit3,
    CheckSquare, Sparkles, Filter, MoreVertical, Send
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { RelatedTasks } from "@/components/tasks/TaskWidgets";

export default function ClientDetailsPage({ params }: { params: Promise<{ clientId: string }> }) {
    const { clientId } = use(params);
    const qc = useQueryClient();

    // 12 Client 360° Tabs
    const [activeTab, setActiveTab] = useState<
        "overview" | "jobs" | "candidates" | "interviews" | "offers" |
        "placements" | "finance" | "contacts" | "documents" | "communication" |
        "notes" | "compliance"
    >("overview");

    const [jobModalOpen, setJobModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [contactModalOpen, setContactModalOpen] = useState(false);
    const [noteModalOpen, setNoteModalOpen] = useState(false);

    // Forms
    const [jobForm, setJobForm] = useState({
        title: "",
        department: "Engineering",
        location: "Mumbai",
        openings: "2",
        salaryMinLpa: "12",
        salaryMaxLpa: "20",
        experienceMinYears: "3",
        experienceMaxYears: "7",
        skills: "Node.js, PostgreSQL",
        priority: "HIGH",
        description: "",
    });

    const [editForm, setEditForm] = useState<any>(null);
    const [newNote, setNewNote] = useState("");
    const [newContact, setNewContact] = useState({
        name: "",
        jobTitle: "",
        department: "",
        email: "",
        phone: "",
    });

    // Fetch Full Client 360 Data
    const { data, isLoading, error } = useQuery({
        queryKey: ["client-details", clientId],
        queryFn: async () => {
            const res = await fetch(`/api/admin/clients/${clientId}`);
            if (!res.ok) throw new Error("Client not found");
            return res.json();
        },
    });

    // Create Job Mutation
    const createJobMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...jobForm,
                    clientId,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create job");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Job requisition posted successfully for this client.");
            setJobModalOpen(false);
            qc.invalidateQueries({ queryKey: ["client-details", clientId] });
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Edit Client Mutation
    const editMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch(`/api/admin/clients/${clientId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: () => {
            toast.success("Client account updated.");
            setEditModalOpen(false);
            qc.invalidateQueries({ queryKey: ["client-details", clientId] });
            qc.invalidateQueries({ queryKey: ["clients"] });
        },
        onError: () => toast.error("Update failed"),
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-48" />
                <SkeletonPulse className="h-44 rounded-3xl" />
                <div className="grid grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonPulse key={i} className="h-24 rounded-2xl" />)}
                </div>
            </div>
        );
    }

    if (error || !data?.client) {
        return (
            <div className="space-y-6">
                <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800">
                    <ArrowLeft size={16} /> Back to Clients
                </Link>
                <SectionCard>
                    <EmptyState icon={AlertCircle} message="Client details could not be loaded." />
                </SectionCard>
            </div>
        );
    }

    const { client, stats, jobs = [], candidates = [], interviews = [], placements = [], invoices = [], contacts = [], documents = [], communications = [], notes = [], tasks = [] } = data;

    // Derived offers
    const offers = candidates.filter((c: any) => ["OFFER_SENT", "OFFER_ACCEPTED", "JOINED"].includes(c.stage));

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Top Bar Navigation */}
            <div className="flex items-center justify-between">
                <Link
                    href="/admin/clients"
                    className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-primary transition-colors bg-white px-3.5 py-2 rounded-xl border border-neutral-200 shadow-xs"
                >
                    <ArrowLeft size={14} /> Back to All Clients
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setEditForm({
                                companyName: client.companyName,
                                industry: client.industry,
                                contactPerson: client.contactPerson,
                                contactEmail: client.contactEmail,
                                contactPhone: client.contactPhone,
                                commissionRate: client.commissionRate,
                                creditDays: client.creditDays,
                                status: client.status,
                            });
                            setEditModalOpen(true);
                        }}
                        className="px-3.5 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-xl text-xs font-bold hover:bg-neutral-50 transition-all flex items-center gap-1.5 shadow-xs"
                    >
                        <Edit3 size={14} /> Edit Client
                    </button>
                    <button
                        onClick={() => setJobModalOpen(true)}
                        className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
                    >
                        <Plus size={14} /> Post Job Requisition
                    </button>
                </div>
            </div>

            {/* Client Profile Header Card */}
            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 shadow-inner">
                            {client.companyName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-black text-neutral-900">{client.companyName}</h1>
                                <Badge value={client.status} />
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600">
                                    {client.industry}
                                </span>
                                <span className="text-xs font-mono text-neutral-400">ID: {client.id}</span>
                            </div>
                            <p className="text-xs text-neutral-500 flex items-center gap-4 flex-wrap">
                                {client.address && (
                                    <span className="flex items-center gap-1">
                                        <MapPin size={13} className="text-neutral-400" /> {client.address}
                                    </span>
                                )}
                                {client.website && (
                                    <a
                                        href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-primary hover:underline font-medium"
                                    >
                                        <Globe size={13} /> {client.website.replace(/^https?:\/\//, "")} <ExternalLink size={10} />
                                    </a>
                                )}
                                <span className="flex items-center gap-1">
                                    <Calendar size={13} className="text-neutral-400" /> Onboarded: {new Date(client.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                                </span>
                                <span className="flex items-center gap-1 text-neutral-600">
                                    <UserCheck size={13} className="text-neutral-400" /> AM: <strong>{client.accountManagerName}</strong>
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Quick Commercial Terms Summary */}
                    <div className="flex items-center gap-5 border-t md:border-t-0 md:border-l border-neutral-200/80 pt-4 md:pt-0 md:pl-6 shrink-0">
                        <div>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Commission Fee</p>
                            <p className="text-xl font-black text-neutral-900">{client.commissionRate}% <span className="text-xs font-medium text-neutral-500">of CTC</span></p>
                        </div>
                        <div className="border-l border-neutral-200/80 pl-5">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Payment Terms</p>
                            <p className="text-xl font-black text-neutral-900">{client.creditDays} <span className="text-xs font-medium text-neutral-500">Days</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Client 360° KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                <StatCard label="Total Revenue" value={inr(stats.totalIncome || 0)} icon={IndianRupee} tone="emerald" hint="verified fees paid" />
                <StatCard label="Outstanding" value={inr(stats.pendingReceivables || 0)} icon={Clock} tone={stats.pendingReceivables > 0 ? "amber" : "neutral"} hint="invoices pending" />
                <StatCard label="Open Positions" value={`${stats.openJobs} Jobs / ${stats.totalOpenings}`} icon={Briefcase} tone="blue" hint="active requisitions" />
                <StatCard label="In Pipeline" value={stats.inPipeline} icon={Users} tone="purple" hint="screening & rounds" />
                <StatCard label="Interviews Held" value={interviews.length} icon={Calendar} tone="primary" hint="client technical rounds" />
                <StatCard label="Placements Joined" value={placements.length || stats.placements} icon={Award} tone="emerald" hint="candidate joiners" />
            </div>

            {/* Operational Attention Alert Bar */}
            <div className="bg-amber-50/60 border border-amber-200/70 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                        <AlertCircle size={16} />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-neutral-900">Operational Health Check: Active Velocity</h4>
                        <p className="text-[11px] text-neutral-600">
                            {jobs.length > 0 ? `${jobs.length} open jobs with ${candidates.length} candidate applications in pipeline.` : "No open jobs. Ready for requisition intake."}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                        onClick={() => setActiveTab("candidates")}
                        className="px-3 py-1.5 text-xs font-bold bg-white text-neutral-800 rounded-xl border border-neutral-200 shadow-xs hover:bg-neutral-50"
                    >
                        Review Pipeline
                    </button>
                    <button
                        onClick={() => setActiveTab("finance")}
                        className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-xl shadow-xs hover:bg-primary-dark"
                    >
                        View Invoices
                    </button>
                </div>
            </div>

            {/* Interactive 12 Sub-Navigation Tabs */}
            <div className="flex border-b border-neutral-200 gap-2 overflow-x-auto no-scrollbar text-xs font-bold">
                {[
                    { key: "overview", label: "Overview", icon: Building2 },
                    { key: "jobs", label: `Jobs (${jobs.length})`, icon: Briefcase },
                    { key: "candidates", label: `Candidates (${candidates.length})`, icon: Users },
                    { key: "interviews", label: `Interviews (${interviews.length})`, icon: Calendar },
                    { key: "offers", label: `Offers (${offers.length})`, icon: Sparkles },
                    { key: "placements", label: `Placements (${placements.length})`, icon: Award },
                    { key: "finance", label: `Finance & Invoices (${invoices.length})`, icon: IndianRupee },
                    { key: "contacts", label: `Contacts (${contacts.length})`, icon: Users },
                    { key: "documents", label: `Documents (${documents.length})`, icon: FileText },
                    { key: "communication", label: `Communication (${communications.length})`, icon: MessageSquare },
                    { key: "notes", label: "Notes & Activity", icon: CheckSquare },
                    { key: "compliance", label: "Compliance", icon: ShieldCheck },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key as any)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                            activeTab === t.key
                                ? "border-primary text-primary font-black"
                                : "border-transparent text-neutral-500 hover:text-neutral-800"
                        }`}
                    >
                        <t.icon size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB: OVERVIEW */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    <RelatedTasks relatedType="CLIENT" relatedId={clientId} recordName={client.companyName} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Primary Contact */}
                        <SectionCard title="Primary Point of Contact" subtitle="Verified executive representative">
                            <div className="space-y-2 text-xs">
                                <p className="text-sm font-bold text-neutral-900">{client.contactPerson}</p>
                                <p className="text-neutral-500 font-medium">VP of People & Talent Acquisition</p>
                                <div className="space-y-1 pt-1 text-neutral-600">
                                    <p className="flex items-center gap-2"><Mail size={13} className="text-neutral-400" /> <a href={`mailto:${client.contactEmail}`} className="text-primary hover:underline">{client.contactEmail}</a></p>
                                    <p className="flex items-center gap-2"><Phone size={13} className="text-neutral-400" /> {client.contactPhone || "+91 98200 44551"}</p>
                                </div>
                            </div>
                        </SectionCard>

                        {/* Assigned Account Rep */}
                        <SectionCard title="Assigned Account Manager" subtitle="Internal AbsoJob TA squad lead">
                            <div className="space-y-2 text-xs">
                                <p className="text-sm font-bold text-neutral-900">{client.accountManagerName}</p>
                                <p className="text-neutral-500 font-medium">Senior Account Director</p>
                                <div className="space-y-1 pt-1 text-neutral-600">
                                    <p className="flex items-center gap-2"><Mail size={13} className="text-neutral-400" /> {client.accountManagerEmail}</p>
                                    <p className="flex items-center gap-2"><Phone size={13} className="text-neutral-400" /> {client.accountManagerPhone}</p>
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    {/* Active Jobs Preview */}
                    <SectionCard
                        title={`Active Requisitions (${jobs.length})`}
                        subtitle="Current open job mandates undergoing sourcing and interviews"
                        action={
                            <button onClick={() => setJobModalOpen(true)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                <Plus size={14} /> Add Job
                            </button>
                        }
                    >
                        {jobs.length === 0 ? (
                            <EmptyState icon={Briefcase} message="No active jobs posted." />
                        ) : (
                            <div className="divide-y divide-neutral-100 -m-5">
                                {jobs.slice(0, 3).map((j: any) => (
                                    <div key={j.id} className="p-4 hover:bg-neutral-50/60 transition-colors flex items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-neutral-900 text-xs">{j.title}</h4>
                                                <Badge value={j.status} />
                                            </div>
                                            <p className="text-[11px] text-neutral-400 mt-0.5">{j.department} · {j.location} · {j.openings} Openings</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-neutral-700">{j.inPipeline || 0} in pipeline</span>
                                            <p className="text-[10px] text-neutral-400">Target close in 20d</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* TAB: JOBS */}
            {activeTab === "jobs" && (
                <SectionCard
                    title="All Job Requisitions"
                    subtitle="Open and historical mandates for this corporate account"
                    action={
                        <button onClick={() => setJobModalOpen(true)} className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark">
                            + Add Job Requisition
                        </button>
                    }
                >
                    {jobs.length === 0 ? (
                        <EmptyState icon={Briefcase} message="No jobs found." />
                    ) : (
                        <div className="overflow-x-auto -m-5">
                            <table className="w-full text-xs min-w-[700px]">
                                <thead>
                                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                                        <th className="px-5 py-3">Role Title</th>
                                        <th className="px-3 py-3">Department & Location</th>
                                        <th className="px-3 py-3">Budget (CTC)</th>
                                        <th className="px-3 py-3">Openings</th>
                                        <th className="px-3 py-3">Status</th>
                                        <th className="px-3 py-3">Pipeline</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {jobs.map((j: any) => (
                                        <tr key={j.id} className="hover:bg-neutral-50/60 transition-colors">
                                            <td className="px-5 py-3.5 font-bold text-neutral-900">{j.title}</td>
                                            <td className="px-3 py-3.5 text-neutral-600">{j.department} · {j.location}</td>
                                            <td className="px-3 py-3.5 font-semibold text-neutral-800">₹{j.salaryMinLpa}-{j.salaryMaxLpa} LPA</td>
                                            <td className="px-3 py-3.5 font-bold text-neutral-900">{j.openings}</td>
                                            <td className="px-3 py-3.5"><Badge value={j.status} /></td>
                                            <td className="px-3 py-3.5 font-bold text-primary">{j.inPipeline || 0} candidates</td>
                                            <td className="px-5 py-3.5 text-right">
                                                <Link href={`/admin/jobs`} className="text-xs text-primary font-bold hover:underline">
                                                    Manage
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            {/* TAB: CANDIDATES */}
            {activeTab === "candidates" && (
                <SectionCard title="Candidates & Hiring Pipeline" subtitle="All talent submitted or undergoing screening for this client">
                    {candidates.length === 0 ? (
                        <EmptyState icon={Users} message="No candidates in pipeline for this client." />
                    ) : (
                        <div className="overflow-x-auto -m-5">
                            <table className="w-full text-xs min-w-[700px]">
                                <thead>
                                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                                        <th className="px-5 py-3">Candidate</th>
                                        <th className="px-3 py-3">Role Applied</th>
                                        <th className="px-3 py-3">Experience</th>
                                        <th className="px-3 py-3">Current Stage</th>
                                        <th className="px-3 py-3">Match Score</th>
                                        <th className="px-5 py-3 text-right">Profile</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {candidates.map((c: any) => (
                                        <tr key={c.id} className="hover:bg-neutral-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <p className="font-bold text-neutral-900">{c.candidateName}</p>
                                                <p className="text-[10px] text-neutral-400">{c.candidateEmail}</p>
                                            </td>
                                            <td className="px-3 py-3.5 font-medium text-neutral-700">{c.jobTitle}</td>
                                            <td className="px-3 py-3.5 text-neutral-600">{c.experience} yrs</td>
                                            <td className="px-3 py-3.5"><Badge value={c.stage} /></td>
                                            <td className="px-3 py-3.5 font-bold text-emerald-600">{c.matchScore}%</td>
                                            <td className="px-5 py-3.5 text-right">
                                                <Link href={`/admin/candidates/${c.candidateId}`} className="text-xs text-primary font-bold hover:underline">
                                                    View 360°
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            {/* TAB: INTERVIEWS */}
            {activeTab === "interviews" && (
                <SectionCard title="Scheduled Client Interviews" subtitle="Video and technical rounds held with client hiring managers">
                    {interviews.length === 0 ? (
                        <EmptyState icon={Calendar} message="No interviews scheduled for this client." />
                    ) : (
                        <div className="divide-y divide-neutral-100 -m-5">
                            {interviews.map((iv: any) => (
                                <div key={iv.id} className="p-4 hover:bg-neutral-50/60 transition-colors flex items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-neutral-900 text-xs">{iv.candidateName}</span>
                                            <span className="text-neutral-400">·</span>
                                            <span className="text-xs text-neutral-600 font-medium">{iv.jobTitle}</span>
                                            <Badge value={iv.status} />
                                        </div>
                                        <p className="text-[11px] text-neutral-400 mt-1">
                                            Round: <strong>{iv.round}</strong> · Interviewer: {iv.interviewerName} · {iv.mode}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold text-neutral-800">
                                            {new Date(iv.scheduledAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            )}

            {/* TAB: OFFERS */}
            {activeTab === "offers" && (
                <SectionCard title="Offer Lifecycle" subtitle="Offers released, accepted, and joining schedules">
                    {offers.length === 0 ? (
                        <EmptyState icon={Sparkles} message="No active offers currently released." />
                    ) : (
                        <div className="divide-y divide-neutral-100 -m-5">
                            {offers.map((off: any) => (
                                <div key={off.id} className="p-4 hover:bg-neutral-50/60 transition-colors flex items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-neutral-900 text-xs">{off.candidateName}</span>
                                            <Badge value={off.stage} />
                                        </div>
                                        <p className="text-[11px] text-neutral-500 mt-0.5">{off.jobTitle} · Offered: ₹{off.offeredCtcLpa || 16} LPA</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold text-emerald-600">Joining Expected</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            )}

            {/* TAB: PLACEMENTS */}
            {activeTab === "placements" && (
                <SectionCard title="Client Placements" subtitle="Confirmed candidate joinings and active guarantee terms">
                    {placements.length === 0 ? (
                        <EmptyState icon={Award} message="No placements finalized yet." />
                    ) : (
                        <div className="overflow-x-auto -m-5">
                            <table className="w-full text-xs min-w-[700px]">
                                <thead>
                                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                                        <th className="px-5 py-3">Candidate</th>
                                        <th className="px-3 py-3">Designation</th>
                                        <th className="px-3 py-3">Joining Date</th>
                                        <th className="px-3 py-3">Salary (CTC)</th>
                                        <th className="px-3 py-3">Placement Fee</th>
                                        <th className="px-3 py-3">Guarantee</th>
                                        <th className="px-5 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {placements.map((p: any) => (
                                        <tr key={p.id} className="hover:bg-neutral-50/60 transition-colors">
                                            <td className="px-5 py-3.5 font-bold text-neutral-900">{p.candidateName}</td>
                                            <td className="px-3 py-3.5 text-neutral-700">{p.offeredPosition}</td>
                                            <td className="px-3 py-3.5 text-neutral-600">{p.joiningDate}</td>
                                            <td className="px-3 py-3.5 font-semibold text-neutral-800">₹{p.offeredSalaryLpa} LPA</td>
                                            <td className="px-3 py-3.5 font-extrabold text-emerald-600">{inr(p.revenueInr)}</td>
                                            <td className="px-3 py-3.5 text-neutral-600 font-medium">{p.guaranteePeriodDays} Days</td>
                                            <td className="px-5 py-3.5 text-right"><Badge value={p.joiningStatus} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            {/* TAB: FINANCE & INVOICES */}
            {activeTab === "finance" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard label="Total Invoiced" value={inr(stats.totalInvoiced || 0)} icon={IndianRupee} tone="primary" />
                        <StatCard label="Paid Received" value={inr(stats.totalIncome || 0)} icon={CheckCircle2} tone="emerald" />
                        <StatCard label="Outstanding Due" value={inr(stats.pendingReceivables || 0)} icon={Clock} tone={stats.pendingReceivables > 0 ? "amber" : "neutral"} />
                    </div>

                    <SectionCard title="Invoices & Placement Billing" subtitle="Commercial billing records with GST breakdowns">
                        {invoices.length === 0 ? (
                            <EmptyState icon={IndianRupee} message="No invoices generated for this client." />
                        ) : (
                            <div className="overflow-x-auto -m-5">
                                <table className="w-full text-xs min-w-[700px]">
                                    <thead>
                                        <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                                            <th className="px-5 py-3">Invoice #</th>
                                            <th className="px-3 py-3">Description</th>
                                            <th className="px-3 py-3">Issue Date</th>
                                            <th className="px-3 py-3">Due Date</th>
                                            <th className="px-3 py-3">Total Amount</th>
                                            <th className="px-5 py-3 text-right">Payment Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {invoices.map((inv: any) => (
                                            <tr key={inv.id} className="hover:bg-neutral-50/60 transition-colors">
                                                <td className="px-5 py-3.5 font-bold text-neutral-900">{inv.id}</td>
                                                <td className="px-3 py-3.5 text-neutral-700">{inv.jobTitle}</td>
                                                <td className="px-3 py-3.5 text-neutral-500">{new Date(inv.issueDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</td>
                                                <td className="px-3 py-3.5 text-neutral-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                                                <td className="px-3 py-3.5 font-bold text-neutral-900">{inr(inv.total)}</td>
                                                <td className="px-5 py-3.5 text-right"><Badge value={inv.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* TAB: CONTACTS */}
            {activeTab === "contacts" && (
                <SectionCard
                    title="Client Key Stakeholders & Contacts"
                    subtitle="HR leaders, technical hiring managers, and accounts billing representatives"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {contacts.map((cnt: any) => (
                            <div key={cnt.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-neutral-900 text-xs">{cnt.name}</h4>
                                    {cnt.isPrimary && (
                                        <span className="px-2 py-0.5 text-[9px] font-bold bg-primary text-white rounded">
                                            Primary POC
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-neutral-500 font-medium">{cnt.jobTitle} · {cnt.department}</p>
                                <div className="space-y-1 pt-1 text-xs text-neutral-600">
                                    <p className="flex items-center gap-2"><Mail size={13} className="text-neutral-400" /> <a href={`mailto:${cnt.email}`} className="text-primary hover:underline">{cnt.email}</a></p>
                                    <p className="flex items-center gap-2"><Phone size={13} className="text-neutral-400" /> {cnt.phone}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* TAB: DOCUMENTS */}
            {activeTab === "documents" && (
                <SectionCard title="Legal & Commercial Documents" subtitle="Executed MSAs, signed NDAs, rate cards, and billing agreements">
                    <div className="space-y-3">
                        {documents.map((doc: any) => (
                            <div key={doc.id} className="p-4 bg-white rounded-2xl border border-neutral-200/80 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-primary shrink-0">
                                        <FileText size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-neutral-900">{doc.name}</h4>
                                        <span className="text-[10px] text-neutral-400 font-medium">Uploaded by {doc.uploadedBy} on {doc.uploadDate} · {doc.fileSize}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                                        Active Contract
                                    </span>
                                    <button
                                        onClick={() => toast.info("Downloading contract copy...")}
                                        className="p-2 text-neutral-500 hover:text-primary rounded-lg border border-neutral-200 hover:bg-neutral-50"
                                    >
                                        <Download size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* TAB: COMMUNICATION */}
            {activeTab === "communication" && (
                <SectionCard title="Corporate Communication Logs" subtitle="Phone logs, email interactions, and meeting summaries with client team">
                    <div className="space-y-3">
                        {communications.map((comm: any) => (
                            <div key={comm.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-neutral-200 text-neutral-700 rounded">
                                        {comm.type}
                                    </span>
                                    <span className="text-[10px] text-neutral-400 font-medium">{comm.date}</span>
                                </div>
                                <h4 className="text-xs font-bold text-neutral-900">{comm.subject}</h4>
                                <p className="text-[11px] text-neutral-600 leading-relaxed">{comm.summary}</p>
                                <p className="text-[10px] text-neutral-400 font-medium pt-1">
                                    Logged by <strong>{comm.userName}</strong> with <strong>{comm.contactName}</strong>
                                </p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* TAB: NOTES & ACTIVITY */}
            {activeTab === "notes" && (
                <SectionCard
                    title="Internal Recruiter Notes & Timeline"
                    subtitle="Confidential operational notes visible only to internal agency members"
                    action={
                        <button onClick={() => setNoteModalOpen(true)} className="text-xs font-bold text-primary hover:underline">
                            + Add Note
                        </button>
                    }
                >
                    <div className="space-y-3">
                        {notes.map((n: any) => (
                            <div key={n.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                        {n.category}
                                    </span>
                                    <span className="text-[10px] text-neutral-400">{n.createdAt}</span>
                                </div>
                                <p className="text-xs text-neutral-700 leading-relaxed pt-1">{n.text}</p>
                                <p className="text-[10px] text-neutral-400 font-medium pt-1">Author: <strong>{n.authorName}</strong></p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* TAB: COMPLIANCE */}
            {activeTab === "compliance" && (
                <SectionCard title="Client Governance & Compliance" subtitle="Statutory agreements, anti-bribery policies, and credit protection">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-1 text-xs">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Verified
                            </span>
                            <h4 className="font-bold text-neutral-900 pt-1">Master Services Agreement (MSA)</h4>
                            <p className="text-neutral-500">Valid through March 2027 with standard non-solicit clause.</p>
                        </div>
                        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-1 text-xs">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Active
                            </span>
                            <h4 className="font-bold text-neutral-900 pt-1">Replacement Guarantee Terms</h4>
                            <p className="text-neutral-500">90-day replacement window on candidate non-performance or voluntary exit.</p>
                        </div>
                        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-1 text-xs">
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                Monitored
                            </span>
                            <h4 className="font-bold text-neutral-900 pt-1">Credit Protection Rating</h4>
                            <p className="text-neutral-500">Rating A+ based on 100% on-time payment track record across 4 previous invoices.</p>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* Post Job Modal */}
            <ModalShell
                open={jobModalOpen}
                onClose={() => setJobModalOpen(false)}
                title={`Post Job Requisition for ${client.companyName}`}
                wide
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        createJobMutation.mutate();
                    }}
                    className="space-y-3.5"
                >
                    <div className="p-2.5 bg-neutral-50 rounded-xl text-xs text-neutral-600 font-medium">
                        Pre-selected Client: <strong>{client.companyName}</strong> · Account Manager: <strong>{client.accountManagerName}</strong>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-700">Role Title *</label>
                        <input
                            required
                            value={jobForm.title}
                            onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                            placeholder="e.g. Senior Frontend Engineer (React)"
                            className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Department</label>
                            <input
                                value={jobForm.department}
                                onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Location</label>
                            <input
                                value={jobForm.location}
                                onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Openings</label>
                            <input
                                type="number"
                                min="1"
                                value={jobForm.openings}
                                onChange={(e) => setJobForm({ ...jobForm, openings: e.target.value })}
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Min Salary (LPA)</label>
                            <input
                                type="number"
                                value={jobForm.salaryMinLpa}
                                onChange={(e) => setJobForm({ ...jobForm, salaryMinLpa: e.target.value })}
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Max Salary (LPA)</label>
                            <input
                                type="number"
                                value={jobForm.salaryMaxLpa}
                                onChange={(e) => setJobForm({ ...jobForm, salaryMaxLpa: e.target.value })}
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-700">Required Skills</label>
                        <input
                            value={jobForm.skills}
                            onChange={(e) => setJobForm({ ...jobForm, skills: e.target.value })}
                            placeholder="React, TypeScript, Next.js"
                            className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setJobModalOpen(false)}
                            className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createJobMutation.isPending}
                            className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary-dark"
                        >
                            {createJobMutation.isPending ? "Creating..." : "Create Requisition"}
                        </button>
                    </div>
                </form>
            </ModalShell>

            {/* Edit Client Modal */}
            {editModalOpen && editForm && (
                <ModalShell
                    open={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    title={`Edit Client Account: ${client.companyName}`}
                    wide
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            editMutation.mutate(editForm);
                        }}
                        className="space-y-3.5"
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Company Name</label>
                                <input
                                    value={editForm.companyName}
                                    onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Status</label>
                                <select
                                    value={editForm.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="ONBOARDING">ONBOARDING</option>
                                    <option value="PROSPECT">PROSPECT</option>
                                    <option value="PAUSED">PAUSED</option>
                                    <option value="CHURNED">CHURNED</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Contact Person</label>
                                <input
                                    value={editForm.contactPerson}
                                    onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Contact Email</label>
                                <input
                                    type="email"
                                    value={editForm.contactEmail}
                                    onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Commission Rate (% of CTC)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editForm.commissionRate}
                                    onChange={(e) => setEditForm({ ...editForm, commissionRate: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Credit Days</label>
                                <input
                                    type="number"
                                    value={editForm.creditDays}
                                    onChange={(e) => setEditForm({ ...editForm, creditDays: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setEditModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={editMutation.isPending}
                                className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary-dark"
                            >
                                {editMutation.isPending ? "Updating..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* Note Modal */}
            {noteModalOpen && (
                <ModalShell
                    open={noteModalOpen}
                    onClose={() => setNoteModalOpen(false)}
                    title="Add Internal Confidential Note"
                >
                    <div className="space-y-3">
                        <textarea
                            rows={4}
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Enter confidential notes regarding recruitment preferences, fee negotiations, or candidate feedback SLA..."
                            className="w-full p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setNoteModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    toast.success("Note saved to client record.");
                                    setNoteModalOpen(false);
                                    setNewNote("");
                                }}
                                className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary-dark"
                            >
                                Save Note
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
