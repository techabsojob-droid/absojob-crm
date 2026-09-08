"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    ArrowLeft,
    Building2,
    Briefcase,
    Users,
    IndianRupee,
    Mail,
    Phone,
    MapPin,
    Globe,
    Calendar,
    UserCheck,
    Plus,
    CheckCircle2,
    Clock,
    FileText,
    ExternalLink,
    AlertCircle,
    ChevronRight,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function ClientDetailsPage({ params }: { params: Promise<{ clientId: string }> }) {
    const { clientId } = use(params);
    const qc = useQueryClient();
    const [activeTab, setActiveTab] = useState<"jobs" | "candidates" | "finance" | "notes">("jobs");
    const [jobModalOpen, setJobModalOpen] = useState(false);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

    // New Job Form State
    const [jobForm, setJobForm] = useState({
        title: "",
        department: "Engineering",
        location: "",
        openings: "1",
        salaryMinLpa: "",
        salaryMaxLpa: "",
        experienceMinYears: "",
        experienceMaxYears: "",
        skills: "",
        priority: "MEDIUM",
        description: "",
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

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-neutral-500 font-medium">Loading client profile...</p>
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

    const { client, stats, jobs, candidates, invoices } = data;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Navigation Breadcrumb */}
            <div className="flex items-center justify-between">
                <Link
                    href="/admin/clients"
                    className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-primary transition-colors bg-white px-3.5 py-1.5 rounded-xl border border-neutral-200 shadow-xs"
                >
                    <ArrowLeft size={14} /> Back to All Clients
                </Link>
                <div className="flex items-center gap-2">
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
                        <div className="space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-black text-neutral-900">{client.companyName}</h1>
                                <Badge value={client.status} />
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600">
                                    {client.industry}
                                </span>
                            </div>
                            <p className="text-xs text-neutral-500 flex items-center gap-4 flex-wrap pt-1">
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
                                        className="flex items-center gap-1 text-primary hover:underline"
                                    >
                                        <Globe size={13} /> {client.website.replace(/^https?:\/\//, "")} <ExternalLink size={10} />
                                    </a>
                                )}
                                <span className="flex items-center gap-1">
                                    <Calendar size={13} className="text-neutral-400" /> Onboarded: {new Date(client.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Quick Commercial Terms Summary */}
                    <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-neutral-200/80 pt-4 md:pt-0 md:pl-6">
                        <div>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Commission Rate</p>
                            <p className="text-xl font-black text-neutral-900">{client.commissionRate}% <span className="text-xs font-medium text-neutral-500">of CTC</span></p>
                        </div>
                        <div className="border-l border-neutral-200/80 pl-4">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Credit Terms</p>
                            <p className="text-xl font-black text-neutral-900">{client.creditDays} <span className="text-xs font-medium text-neutral-500">Days</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4 Performance & Financial Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Income Earned"
                    value={`₹${(stats.totalIncome || 0).toLocaleString("en-IN")}`}
                    hint={stats.pendingReceivables > 0 ? `₹${(stats.pendingReceivables).toLocaleString("en-IN")} pending` : "All invoices cleared"}
                    icon={IndianRupee}
                    tone="emerald"
                />
                <StatCard
                    label="Job Openings"
                    value={`${stats.openJobs} Active / ${stats.totalJobs}`}
                    hint={`${stats.totalOpenings} total positions`}
                    icon={Briefcase}
                    tone="blue"
                />
                <StatCard
                    label="Placements Closed"
                    value={stats.placements}
                    hint="Candidates Joined"
                    icon={CheckCircle2}
                    tone="emerald"
                />
                <StatCard
                    label="Active Pipeline"
                    value={stats.inPipeline}
                    hint="In Screening & Interview"
                    icon={Users}
                    tone="amber"
                />
            </div>

            {/* Point of Contact (POC) & Account Manager Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* POC Card */}
                <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Users size={14} className="text-primary" /> Primary Point of Contact (POC)
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Verified</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-neutral-600">
                        <p className="text-sm font-bold text-neutral-900">{client.contactPerson}</p>
                        <p className="flex items-center gap-2">
                            <Mail size={13} className="text-neutral-400" />
                            <a href={`mailto:${client.contactEmail}`} className="text-primary hover:underline font-medium">{client.contactEmail}</a>
                        </p>
                        {client.contactPhone && (
                            <p className="flex items-center gap-2">
                                <Phone size={13} className="text-neutral-400" />
                                <a href={`tel:${client.contactPhone}`} className="text-neutral-700 font-medium">{client.contactPhone}</a>
                            </p>
                        )}
                    </div>
                </div>

                {/* Account Manager Card */}
                <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                            <UserCheck size={14} className="text-primary" /> Assigned Account Manager
                        </span>
                        <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">Internal Staff</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-neutral-600">
                        <p className="text-sm font-bold text-neutral-900">{client.accountManagerName}</p>
                        <p className="flex items-center gap-2">
                            <Mail size={13} className="text-neutral-400" />
                            <span className="text-neutral-700 font-medium">{client.accountManagerEmail}</span>
                        </p>
                        <p className="flex items-center gap-2">
                            <Phone size={13} className="text-neutral-400" />
                            <span className="text-neutral-700 font-medium">{client.accountManagerPhone}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Interactive Sub-Navigation Tabs */}
            <div className="flex border-b border-neutral-200 gap-6 text-sm font-bold">
                {[
                    { key: "jobs", label: `Jobs & Requisitions (${jobs?.length || 0})`, icon: Briefcase },
                    { key: "candidates", label: `Candidates & Pipeline (${candidates?.length || 0})`, icon: Users },
                    { key: "finance", label: `Finance & Invoices (${invoices?.length || 0})`, icon: IndianRupee },
                    { key: "notes", label: "Notes & History", icon: FileText },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key as any)}
                        className={`flex items-center gap-2 pb-3.5 border-b-2 transition-all cursor-pointer ${
                            activeTab === t.key
                                ? "border-primary text-primary"
                                : "border-transparent text-neutral-500 hover:text-neutral-800"
                        }`}
                    >
                        <t.icon size={16} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: JOBS & OPENINGS */}
            {activeTab === "jobs" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-neutral-900">Job Requisitions for {client.companyName}</h3>
                        <button
                            onClick={() => setJobModalOpen(true)}
                            className="px-3.5 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all flex items-center gap-1.5"
                        >
                            <Plus size={14} /> Add Position
                        </button>
                    </div>

                    {jobs.length === 0 ? (
                        <SectionCard>
                            <EmptyState icon={Briefcase} message="No job requisitions created for this client yet." />
                        </SectionCard>
                    ) : (
                        <div className="space-y-3">
                            {jobs.map((j: any) => (
                                <div key={j.id} className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-bold text-neutral-900 text-sm">{j.title}</h4>
                                            <Badge value={j.status} />
                                            <Badge value={j.priority} />
                                        </div>
                                        <p className="text-xs text-neutral-500 flex items-center gap-3 flex-wrap">
                                            <span className="flex items-center gap-1"><MapPin size={12} /> {j.location || "Remote"}</span>
                                            <span className="flex items-center gap-1"><IndianRupee size={12} /> {j.salaryMinLpa}–{j.salaryMaxLpa} LPA</span>
                                            <span>{j.openings} opening{j.openings > 1 ? "s" : ""}</span>
                                            <span>Exp: {j.experienceMinYears}–{j.experienceMaxYears} yrs</span>
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-6 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                                        <div className="text-center">
                                            <p className="text-base font-extrabold text-neutral-900">{j.inPipeline}</p>
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase">In Pipeline</p>
                                        </div>
                                        <div className="text-center border-l border-neutral-100 pl-4">
                                            <p className="text-base font-extrabold text-emerald-600">{j.placements}</p>
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase">Placed</p>
                                        </div>
                                        <Link
                                            href={`/admin/jobs?status=${j.status}`}
                                            className="px-3.5 py-1.5 border border-neutral-200 hover:border-primary text-neutral-700 hover:text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                        >
                                            Manage <ChevronRight size={13} />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: CANDIDATES & PIPELINE */}
            {activeTab === "candidates" && (
                <div className="space-y-4">
                    <h3 className="text-base font-bold text-neutral-900">Candidates in Pipeline & Placements</h3>

                    {candidates.length === 0 ? (
                        <SectionCard>
                            <EmptyState icon={Users} message="No candidates mapped to this client's requisitions yet." />
                        </SectionCard>
                    ) : (
                        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider font-bold border-b border-neutral-200">
                                        <tr>
                                            <th className="p-3.5">Candidate</th>
                                            <th className="p-3.5">Applied Position</th>
                                            <th className="p-3.5">Stage</th>
                                            <th className="p-3.5">CTC (LPA)</th>
                                            <th className="p-3.5">Experience</th>
                                            <th className="p-3.5">Match Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                                        {candidates.map((cand: any) => (
                                            <tr key={cand.id} className="hover:bg-neutral-50/60 transition-colors">
                                                <td className="p-3.5">
                                                    <div className="font-bold text-neutral-900">{cand.candidateName}</div>
                                                    <div className="text-neutral-400 text-[11px]">{cand.candidateEmail}</div>
                                                </td>
                                                <td className="p-3.5 font-semibold text-neutral-800">{cand.jobTitle}</td>
                                                <td className="p-3.5"><Badge value={cand.stage} /></td>
                                                <td className="p-3.5 font-bold text-neutral-900">₹{cand.offeredCtcLpa} LPA</td>
                                                <td className="p-3.5">{cand.experience} yrs</td>
                                                <td className="p-3.5">
                                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                                        {cand.matchScore}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: FINANCE & INVOICES */}
            {activeTab === "finance" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-neutral-900">Billing Invoices & Revenue</h3>
                            <p className="text-xs text-neutral-500">Placement commission fees and payment terms</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                                Total Income: ₹{stats.totalIncome.toLocaleString("en-IN")}
                            </span>
                        </div>
                    </div>

                    {invoices.length === 0 ? (
                        <SectionCard>
                            <EmptyState icon={IndianRupee} message="No invoices generated for this client yet." />
                        </SectionCard>
                    ) : (
                        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider font-bold border-b border-neutral-200">
                                        <tr>
                                            <th className="p-3.5">Invoice #</th>
                                            <th className="p-3.5">Position / Candidate</th>
                                            <th className="p-3.5">Issue Date</th>
                                            <th className="p-3.5">Due Date</th>
                                            <th className="p-3.5">Amount (INR)</th>
                                            <th className="p-3.5">GST (18%)</th>
                                            <th className="p-3.5">Total (INR)</th>
                                            <th className="p-3.5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                                        {invoices.map((inv: any) => (
                                            <tr key={inv.id} className="hover:bg-neutral-50/60 transition-colors">
                                                <td className="p-3.5 font-bold font-mono text-neutral-900">{inv.id}</td>
                                                <td className="p-3.5">
                                                    <div className="font-semibold text-neutral-800">{inv.jobTitle}</div>
                                                    {inv.candidateName && <div className="text-[11px] text-neutral-400">Placed: {inv.candidateName}</div>}
                                                </td>
                                                <td className="p-3.5">{new Date(inv.issueDate).toLocaleDateString("en-IN")}</td>
                                                <td className="p-3.5">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "—"}</td>
                                                <td className="p-3.5 font-medium">₹{inv.amount?.toLocaleString("en-IN")}</td>
                                                <td className="p-3.5 text-neutral-500">₹{inv.tax?.toLocaleString("en-IN")}</td>
                                                <td className="p-3.5 font-bold text-neutral-900">₹{inv.total?.toLocaleString("en-IN")}</td>
                                                <td className="p-3.5"><Badge value={inv.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: NOTES & ACCOUNT DETAILS */}
            {activeTab === "notes" && (
                <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-6">
                    <div>
                        <h3 className="text-base font-bold text-neutral-900 mb-2">Company Overview</h3>
                        <p className="text-sm text-neutral-600 leading-relaxed">
                            {client.description || "Leading industry partner onboarded on the AbsoJob recruitment network."}
                        </p>
                    </div>

                    <div className="border-t border-neutral-100 pt-4">
                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Internal Notes & Commercial Terms</h4>
                        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 text-xs text-neutral-700 leading-relaxed">
                            {client.notes || `Standard placement agreement signed with ${client.commissionRate}% fee on annual CTC. Payment window: ${client.creditDays} days from candidate joining date.`}
                        </div>
                    </div>
                </div>
            )}

            {/* Post Job Modal for this Client */}
            <ModalShell open={jobModalOpen} onClose={() => setJobModalOpen(false)} title={`Post Job for ${client.companyName}`} wide>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        createJobMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Title *</span>
                            <input
                                required
                                value={jobForm.title}
                                onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                                placeholder="e.g. Senior Backend Engineer"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Location</span>
                            <input
                                value={jobForm.location}
                                onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                                placeholder="e.g. Bangalore / Remote"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Openings</span>
                            <input
                                type="number"
                                min="1"
                                value={jobForm.openings}
                                onChange={(e) => setJobForm({ ...jobForm, openings: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Priority</span>
                            <select
                                value={jobForm.priority}
                                onChange={(e) => setJobForm({ ...jobForm, priority: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white"
                            >
                                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Min (LPA)</span>
                            <input
                                type="number"
                                value={jobForm.salaryMinLpa}
                                onChange={(e) => setJobForm({ ...jobForm, salaryMinLpa: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                                placeholder="12"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Max (LPA)</span>
                            <input
                                type="number"
                                value={jobForm.salaryMaxLpa}
                                onChange={(e) => setJobForm({ ...jobForm, salaryMaxLpa: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                                placeholder="24"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Exp Min (yrs)</span>
                            <input
                                type="number"
                                value={jobForm.experienceMinYears}
                                onChange={(e) => setJobForm({ ...jobForm, experienceMinYears: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Exp Max (yrs)</span>
                            <input
                                type="number"
                                value={jobForm.experienceMaxYears}
                                onChange={(e) => setJobForm({ ...jobForm, experienceMaxYears: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                    </div>
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Skills (comma separated)</span>
                        <input
                            value={jobForm.skills}
                            onChange={(e) => setJobForm({ ...jobForm, skills: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            placeholder="Node.js, PostgreSQL, AWS"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Description</span>
                        <textarea
                            rows={3}
                            value={jobForm.description}
                            onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                            className="mt-1 w-full px-4 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            placeholder="Role responsibilities and expectations..."
                        />
                    </label>
                    <button
                        disabled={createJobMutation.isPending}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
                    >
                        {createJobMutation.isPending ? "Posting..." : "Post Requisition for this Client"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
