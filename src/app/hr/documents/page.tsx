"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api, useEmployeeOptions } from "@/lib/api";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { FileText, ShieldCheck, Clock, FileCheck, Search, Filter, Eye, AlertCircle, Plus } from "lucide-react";

interface DocumentRecord {
    id: string;
    employeeId?: string | null;
    employeeName?: string | null;
    title: string;
    category: string;
    fileUrl: string;
    fileSize: string;
    status: "VERIFIED" | "PENDING" | "REJECTED";
    expiryDate?: string | null;
    uploadedAt: string;
    uploadedByName?: string | null;
    rejectionReason?: string | null;
    version?: number;
}

const ALL_CATEGORIES = ["IDENTITY", "ADDRESS", "OFFER_LETTER", "APPOINTMENT_LETTER", "EXPERIENCE_LETTER", "SALARY_CERTIFICATE", "BANK_DOC", "EMPLOYMENT", "RESUME", "POLICY"];
const inputCls = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none";

export default function HRDocumentsPage() {
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const qc = useQueryClient();
    const { data: employeeOptions = [] } = useEmployeeOptions(true);
    const [addOpen, setAddOpen] = useState(false);
    const [form, setForm] = useState({ employeeId: "", title: "", category: "IDENTITY", fileUrl: "", expiryDate: "" });

    const mutate = useMutation({
        mutationFn: (args: { method: "POST" | "PATCH"; body: Record<string, unknown> }) => api("/api/hr/documents", args.method, args.body),
        onSuccess: (_d, args) => {
            toast.success(args.method === "POST" ? "Document added" : "Document updated");
            setAddOpen(false);
            setForm({ employeeId: "", title: "", category: "IDENTITY", fileUrl: "", expiryDate: "" });
            qc.invalidateQueries({ queryKey: ["hr-documents"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const reject = (doc: DocumentRecord) => {
        const reason = window.prompt(`Reason for rejecting "${doc.title}"?`);
        if (reason === null) return;
        if (!reason.trim()) return toast.error("A reason is required");
        mutate.mutate({ method: "PATCH", body: { id: doc.id, action: "reject", reason } });
    };

    const { data: docs = [], isLoading } = useQuery<DocumentRecord[]>({
        queryKey: ["hr-documents", categoryFilter, statusFilter, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (categoryFilter !== "ALL") params.set("category", categoryFilter);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/documents?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch documents");
            return res.json();
        },
    });

    const verifiedCount = docs.filter((d) => d.status === "VERIFIED").length;
    const pendingCount = docs.filter((d) => d.status === "PENDING").length;
    const policyCount = docs.filter((d) => d.category === "POLICY").length;

    const categories = ["ALL", "IDENTITY", "OFFER_LETTER", "APPOINTMENT_LETTER", "EXPERIENCE_LETTER", "BANK_DOC", "POLICY"];

    return (
        <div className="space-y-6">
            <PageHeader
                title="HR Document & Compliance Vault"
                subtitle="Manage employee identification files, offer letters, employment contracts, and company policies."
                action={
                    <button onClick={() => setAddOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2">
                        <Plus size={15} /> Add Document
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Documents" value={docs.length} icon={FileText} tone="primary" hint="Indexed records" />
                <StatCard label="Verified Files" value={verifiedCount} icon={ShieldCheck} tone="emerald" hint="Compliance cleared" />
                <StatCard label="Pending Audit" value={pendingCount} icon={Clock} tone="amber" hint="Awaiting review" />
                <StatCard label="Company Policies" value={policyCount} icon={FileCheck} tone="purple" hint="Handbook & compliance" />
            </div>

            {/* Filters */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <Filter size={16} className="text-neutral-500" />
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                            >
                                <option value="ALL">All Categories</option>
                                {categories.filter((c) => c !== "ALL").map((c) => (
                                    <option key={c} value={c}>
                                        {c.replace("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="VERIFIED">Verified</option>
                                <option value="PENDING">Pending</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search document title..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Documents Table */}
            <SectionCard title={`Document Archive (${docs.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-xl" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-24" />
                                <SkeletonPulse className="h-4 w-20" />
                            </div>
                        ))}
                    </div>
                ) : docs.length === 0 ? (
                    <EmptyState icon={AlertCircle} message="No documents found matching the filter criteria." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Document Title</th>
                                    <th className="py-3 px-2">Category</th>
                                    <th className="py-3 px-2">Associated Employee</th>
                                    <th className="py-3 px-2">Size</th>
                                    <th className="py-3 px-2">Upload Date</th>
                                    <th className="py-3 px-2">Status</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {docs.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3.5 px-2 font-bold text-neutral-900 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                                                <FileText size={18} />
                                            </div>
                                            <span className="font-semibold text-neutral-900">
                                                {doc.title}
                                                {(doc.version ?? 1) > 1 && <span className="ml-1.5 text-[10px] text-neutral-400">v{doc.version}</span>}
                                                {doc.rejectionReason && <span className="block text-[11px] text-rose-600 font-medium">{doc.rejectionReason}</span>}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-2">
                                            <span className="bg-neutral-100 px-2.5 py-1 rounded-lg text-xs font-bold text-neutral-700">
                                                {doc.category.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-2 font-medium text-neutral-800">
                                            {doc.employeeName ? doc.employeeName : <span className="text-neutral-400 italic">Organization Policy</span>}
                                        </td>
                                        <td className="py-3.5 px-2 text-neutral-500 font-mono text-xs">{doc.fileSize ?? "—"}</td>
                                        <td className="py-3.5 px-2 text-neutral-600 text-xs">{doc.uploadedAt.split("T")[0]}</td>
                                        <td className="py-3.5 px-2">
                                            <Badge value={doc.status} />
                                        </td>
                                        <td className="py-3.5 px-2 text-right whitespace-nowrap space-x-1.5">
                                            {doc.fileUrl && doc.fileUrl !== "#" && (
                                                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-neutral-600 text-xs font-bold hover:text-primary"><Eye size={13} /> View</a>
                                            )}
                                            {doc.status !== "VERIFIED" && (
                                                <button onClick={() => mutate.mutate({ method: "PATCH", body: { id: doc.id, action: "verify" } })} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100">Verify</button>
                                            )}
                                            {doc.status !== "REJECTED" && doc.category !== "POLICY" && (
                                                <button onClick={() => reject(doc)} className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-50">Reject</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <ModalShell open={addOpen} onClose={() => setAddOpen(false)} title="Add Document">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutate.mutate({ method: "POST", body: form }); }}>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                        {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                    </select>
                    {form.category !== "POLICY" && (
                        <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={inputCls}>
                            <option value="">Select employee</option>
                            {employeeOptions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.employeeId}</option>)}
                        </select>
                    )}
                    <input required placeholder="Document title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
                    <input required placeholder="File link (Drive / storage URL)" value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} className={inputCls} />
                    <label className="block text-xs font-bold text-neutral-500">Expiry date (optional)</label>
                    <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputCls} />
                    <p className="text-[11px] text-neutral-400">Documents added by HR are verified immediately and the employee is notified.</p>
                    <button disabled={mutate.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save Document</button>
                </form>
            </ModalShell>
        </div>
    );
}
