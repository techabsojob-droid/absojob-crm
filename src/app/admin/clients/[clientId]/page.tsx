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
import { ClientTaManagers } from "@/components/admin/ClientTaManagers";

export default function ClientDetailsPage({ params }: { params: Promise<{ clientId: string }> }) {
    const { clientId } = use(params);
    const qc = useQueryClient();

    // 12 Client 360° Tabs
    const [activeTab, setActiveTab] = useState<
        "overview" | "jobs" | "candidates" | "interviews" | "offers" |
        "placements" | "finance" | "contacts" | "terms" | "communication" |
        "notes"
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

    // Internal note → saved on the client record
    const addNoteMutation = useMutation({
        mutationFn: async (text: string) => {
            const res = await fetch(`/api/admin/clients/${clientId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addNote: text }) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || "Could not save the note");
            return d;
        },
        onSuccess: () => {
            toast.success("Note saved.");
            setNoteModalOpen(false);
            setNewNote("");
            qc.invalidateQueries({ queryKey: ["client-details", clientId] });
        },
        onError: (e: Error) => toast.error(e.message),
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
                <SkeletonPulse className="h-44 rounded-xl" />
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

    const { client, stats, jobs = [], candidates = [], interviews = [], placements = [], invoices = [], contacts = [], terms = null, communications = [], notes = [] } = data;

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
                        className="px-3.5 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-md text-xs font-medium hover:bg-neutral-50 transition-all flex items-center gap-1.5 shadow-xs"
                    >
                        <Edit3 size={14} /> Edit Client
                    </button>
                    <button
                        onClick={() => setJobModalOpen(true)}
                        className="px-4 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-all shadow-md flex items-center gap-1.5"
                    >
                        <Plus size={14} /> Post Job Requisition
                    </button>
                </div>
            </div>

            {/* Client Profile Header Card */}
            <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 shadow-inner">
                            {client.companyName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-neutral-900">{client.companyName}</h1>
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
                        <h4 className="text-xs font-bold text-neutral-900">Pipeline check</h4>
                        <p className="text-[11px] text-neutral-600">
                            {stats.openJobs > 0 ? `${stats.openJobs} open job${stats.openJobs > 1 ? "s" : ""} with ${stats.inPipeline} candidate${stats.inPipeline === 1 ? "" : "s"} in the pipeline.` : "No open jobs. Ready for requisition intake."}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                        onClick={() => setActiveTab("candidates")}
                        className="px-3 py-1.5 text-xs font-medium bg-white text-neutral-800 rounded-md border border-neutral-200 shadow-xs hover:bg-neutral-50"
                    >
                        Review Pipeline
                    </button>
                    <button
                        onClick={() => setActiveTab("finance")}
                        className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md shadow-xs hover:bg-primary-dark"
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
                    { key: "communication", label: `Communication (${communications.length})`, icon: MessageSquare },
                    { key: "notes", label: `Notes (${notes.length})`, icon: CheckSquare },
                    { key: "terms", label: "Terms & Credit", icon: ShieldCheck },
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
                        <SectionCard title="Primary Point of Contact" subtitle="Client-side contact">
                            <div className="space-y-2 text-xs">
                                <p className="text-sm font-bold text-neutral-900">{client.contactPerson}</p>
                                <div className="space-y-1 pt-1 text-neutral-600">
                                    <p className="flex items-center gap-2"><Mail size={13} className="text-neutral-400" /> <a href={`mailto:${client.contactEmail}`} className="text-primary hover:underline">{client.contactEmail}</a></p>
                                    <p className="flex items-center gap-2"><Phone size={13} className="text-neutral-400" /> {client.contactPhone || "—"}</p>
                                </div>
                            </div>
                        </SectionCard>

                        {/* Assigned Account Rep */}
                        <SectionCard title="Assigned Account Manager" subtitle="Owns this client internally">
                            <div className="space-y-2 text-xs">
                                {client.accountManagerName ? (<>
                                <p className="text-sm font-bold text-neutral-900">{client.accountManagerName}</p>
                                {client.accountManagerDesignation && <p className="text-neutral-500 font-medium">{client.accountManagerDesignation}</p>}
                                <div className="space-y-1 pt-1 text-neutral-600">
                                    <p className="flex items-center gap-2"><Mail size={13} className="text-neutral-400" /> {client.accountManagerEmail || "—"}</p>
                                    <p className="flex items-center gap-2"><Phone size={13} className="text-neutral-400" /> {client.accountManagerPhone || "—"}</p>
                                </div>
                                </>) : <p className="text-neutral-500">No account manager assigned yet. Use Edit to assign one.</p>}
                            </div>
                        </SectionCard>

                        <ClientTaManagers key={(client.taManagerIds ?? []).join(",")} clientId={clientId} accountManagerId={client.accountManagerId ?? null} value={client.taManagerIds ?? []} />
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
                                            {j.closeDate && <p className="text-[10px] text-neutral-400">Target close {new Date(j.closeDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>}
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
                        <button onClick={() => setJobModalOpen(true)} className="px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark">
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
                                            <td className="px-3 py-3.5 font-bold text-emerald-600">{c.matchScore != null ? `${c.matchScore}%` : "—"}</td>
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
                                        <p className="text-[11px] text-neutral-500 mt-0.5">{off.jobTitle} · Offered: {off.offeredCtcLpa != null ? `₹${off.offeredCtcLpa} LPA` : "not recorded"}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold text-emerald-600">{off.stage === "JOINED" ? "Joined" : off.joiningDate ? `Joining ${new Date(off.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Joining date not set"}</span>
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
                        <StatCard label="Payments Received" value={inr(stats.totalIncome || 0)} icon={CheckCircle2} tone="emerald" />
                        <StatCard label="Outstanding Due" value={inr(stats.pendingReceivables || 0)} icon={Clock} tone={stats.pendingReceivables > 0 ? "amber" : "neutral"} />
                    </div>

                    <SectionCard title="Invoices & Placement Billing" subtitle="From the Finance workspace · amounts include GST" action={<Link href={`/finance/invoices?clientId=${clientId}`} className="text-xs font-bold text-primary hover:underline">Open in Finance</Link>}>
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
                                            <th className="px-3 py-3">Balance Due</th>
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
                                                <td className="px-3 py-3.5 font-bold text-neutral-900">{inr(inv.total)}{inv.kind === "CREDIT_NOTE" && <span className="ml-1 text-[10px] font-medium text-neutral-400">credit note</span>}</td>
                                                <td className="px-3 py-3.5 font-semibold text-neutral-700">{inv.balance ? inr(inv.balance) : "—"}</td>
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
                    title="Client Contacts"
                    subtitle="Primary contact (edit the client to change) and billing mailboxes (set in Finance › Client Billing)"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {contacts.map((cnt: any) => (
                            <div key={cnt.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-neutral-900 text-xs">{cnt.name}</h4>
                                    {cnt.isPrimary && (
                                        <span className="px-2 py-0.5 text-[9px] font-medium bg-primary text-white rounded">
                                            Primary POC
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-neutral-500 font-medium">{cnt.jobTitle}</p>
                                <div className="space-y-1 pt-1 text-xs text-neutral-600">
                                    <p className="flex items-center gap-2"><Mail size={13} className="text-neutral-400" /> <a href={`mailto:${cnt.email}`} className="text-primary hover:underline">{cnt.email}</a></p>
                                    {cnt.phone && <p className="flex items-center gap-2"><Phone size={13} className="text-neutral-400" /> {cnt.phone}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* TAB: COMMUNICATION */}
            {activeTab === "communication" && (
                <SectionCard title="Communication Log" subtitle="Calls, emails and meetings logged from Recruitment › My Clients">
                    {communications.length === 0 ? <EmptyState icon={MessageSquare} message="Nothing logged with this client yet." /> : (
                    <div className="space-y-3">
                        {communications.map((comm: any) => (
                            <div key={comm.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-neutral-200 text-neutral-700 rounded">
                                        {comm.type} · {comm.direction === "INCOMING" ? "from client" : "to client"}
                                    </span>
                                    <span className="text-[10px] text-neutral-400 font-medium">{new Date(comm.date).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                                <h4 className="text-xs font-bold text-neutral-900">{comm.subject}</h4>
                                <p className="text-[11px] text-neutral-600 leading-relaxed whitespace-pre-line">{comm.summary}</p>
                                <p className="text-[10px] text-neutral-400 font-medium pt-1">
                                    Logged by <strong>{comm.userName}</strong>{comm.nextFollowUpDate && <> · follow up {comm.nextFollowUpDate}</>}
                                </p>
                            </div>
                        ))}
                    </div>
                    )}
                </SectionCard>
            )}

            {/* TAB: NOTES & ACTIVITY */}
            {activeTab === "notes" && (
                <SectionCard
                    title="Internal Notes"
                    subtitle="Visible to your team only, never to the client"
                    action={
                        <button onClick={() => setNoteModalOpen(true)} className="text-xs font-bold text-primary hover:underline">
                            + Add Note
                        </button>
                    }
                >
                    {notes.length === 0 && !client.notes ? <EmptyState icon={CheckSquare} message="No notes yet." /> : (
                    <div className="space-y-3">
                        {client.notes && (
                            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/60 space-y-1">
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">Notes from client profile</span>
                                <p className="text-xs text-neutral-700 leading-relaxed pt-1 whitespace-pre-line">{client.notes}</p>
                            </div>
                        )}
                        {notes.map((n: any) => (
                            <div key={n.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-medium text-neutral-500">By <strong>{n.authorName}</strong></span>
                                    <span className="text-[10px] text-neutral-400">{new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                                <p className="text-xs text-neutral-700 leading-relaxed pt-1 whitespace-pre-line">{n.text}</p>
                            </div>
                        ))}
                    </div>
                    )}
                </SectionCard>
            )}

            {/* TAB: TERMS & CREDIT (billing profile + live invoices) */}
            {activeTab === "terms" && terms && (
                <div className="space-y-4">
                    {terms.onHold && (
                        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800">
                            <strong>On credit hold:</strong> {terms.holdReasons.join("; ")}
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SectionCard title="Fee" subtitle="How placements are billed">
                            <div className="space-y-1.5 text-xs text-neutral-700">
                                <p className="text-sm font-bold text-neutral-900">
                                    {terms.feeModel === "FLAT" ? (terms.flatFee != null ? inr(terms.flatFee) + " flat" : "Flat fee (not set)")
                                        : terms.feeModel === "SLAB" ? `Slabs: ${terms.feeSlabs.map((sl: any) => `${sl.percent}% up to ${sl.uptoLpa} LPA`).join(", ") || "not set"}`
                                        : terms.feePercent != null ? `${terms.feePercent}% of CTC` : "Not set"}
                                </p>
                                <p>{terms.splitOnOfferPct > 0 ? `${terms.splitOnOfferPct}% billed on offer, rest on joining` : "100% billed on joining"}</p>
                                <p>Replacement guarantee: <strong>{terms.guaranteeDays} days</strong></p>
                            </div>
                        </SectionCard>
                        <SectionCard title="Credit" subtitle="Payment terms and exposure">
                            <div className="space-y-1.5 text-xs text-neutral-700">
                                <p>Credit period: <strong>{terms.creditDays != null ? `${terms.creditDays} days` : "—"}</strong></p>
                                <p>Credit limit: <strong>{terms.creditLimit ? inr(terms.creditLimit) : "No limit set"}</strong></p>
                                <p>Outstanding now: <strong>{inr(terms.outstanding)}</strong></p>
                                <p>Oldest overdue: <strong>{terms.maxOverdueDays ? `${terms.maxOverdueDays} days` : "nothing overdue"}</strong></p>
                            </div>
                        </SectionCard>
                        <SectionCard title="Payment record" subtitle="From paid invoices">
                            <div className="space-y-1.5 text-xs text-neutral-700">
                                {terms.paidInvoices === 0 ? <p className="text-neutral-500">No invoices paid yet.</p> : (<>
                                    <p className="text-sm font-bold text-neutral-900">{Math.round((terms.paidOnTime / terms.paidInvoices) * 100)}% paid on time</p>
                                    <p>{terms.paidOnTime} of {terms.paidInvoices} paid invoices were paid by the due date</p>
                                </>)}
                                <p className="pt-1">GSTIN: <strong>{terms.gstin || "not set"}</strong></p>
                                {terms.billingAddress && <p className="text-neutral-500">{terms.billingAddress}</p>}
                            </div>
                        </SectionCard>
                    </div>
                    <p className="text-[11px] text-neutral-400">Fee, guarantee, credit limit and GSTIN are edited in Finance › Client Billing.</p>
                </div>
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
                            className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-md shadow hover:bg-primary-dark"
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
                                className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-md shadow hover:bg-primary-dark"
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
                                disabled={!newNote.trim() || addNoteMutation.isPending}
                                onClick={() => addNoteMutation.mutate(newNote)}
                                className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-md shadow hover:bg-primary-dark"
                            >
                                {addNoteMutation.isPending ? "Saving…" : "Save Note"}
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
