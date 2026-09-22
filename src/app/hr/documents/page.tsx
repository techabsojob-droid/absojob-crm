"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { FileText, ShieldCheck, Clock, FileCheck, Search, Filter, Eye, AlertCircle } from "lucide-react";

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
}

export default function HRDocumentsPage() {
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");

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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {docs.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3.5 px-2 font-bold text-neutral-900 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                                                <FileText size={18} />
                                            </div>
                                            <span className="font-semibold text-neutral-900">{doc.title}</span>
                                        </td>
                                        <td className="py-3.5 px-2">
                                            <span className="bg-neutral-100 px-2.5 py-1 rounded-lg text-xs font-bold text-neutral-700">
                                                {doc.category.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-2 font-medium text-neutral-800">
                                            {doc.employeeName ? doc.employeeName : <span className="text-neutral-400 italic">Organization Policy</span>}
                                        </td>
                                        <td className="py-3.5 px-2 text-neutral-500 font-mono text-xs">{doc.fileSize}</td>
                                        <td className="py-3.5 px-2 text-neutral-600 text-xs">{doc.uploadedAt.split("T")[0]}</td>
                                        <td className="py-3.5 px-2">
                                            <Badge value={doc.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
