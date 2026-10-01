"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    Inbox, Plus, Search, Filter, CheckCircle2, XCircle,
    Clock, AlertCircle, FileText, User, X
} from "lucide-react";
import type { EmployeeRequest, EmployeeRequestType } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export default function HREmployeeRequestsPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [typeFilter, setTypeFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [createModalOpen, setCreateModalOpen] = useState(false);

    // Form state
    const [newType, setNewType] = useState<EmployeeRequestType>("WFH");
    const [newDesc, setNewDesc] = useState("");
    const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");

    const { data: requests = [], isLoading } = useQuery<EmployeeRequest[]>({
        queryKey: ["hr-employee-requests", typeFilter, statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (typeFilter !== "ALL") params.set("type", typeFilter);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/hr/employee-requests?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch requests");
            return res.json();
        },
    });

    const actionMutation = useMutation({
        mutationFn: async ({ id, status, comments }: { id: string; status: string; comments?: string }) => {
            const res = await fetch("/api/hr/employee-requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, comments }),
            });
            if (!res.ok) throw new Error("Failed to update request");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-employee-requests"] });
            toast.success("Request status updated");
        },
        onError: () => {
            toast.error("Failed to update request");
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: { type: EmployeeRequestType; description: string; priority: string }) => {
            const res = await fetch("/api/hr/employee-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to submit request");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-employee-requests"] });
            toast.success("Request submitted successfully to HR");
            setCreateModalOpen(false);
            setNewDesc("");
        },
        onError: () => {
            toast.error("Failed to submit request");
        },
    });

    const pendingCount = requests.filter((r) => r.status === "PENDING").length;
    const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
    const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

    const filtered = requests.filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            r.employeeName.toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Employee Self-Service Requests"
                subtitle="Review and process employee requests for remote work, attendance corrections, certificates, and profile updates."
                action={
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-xs"
                    >
                        <Plus size={16} /> New Request
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Requests" value={requests.length} icon={Inbox} tone="primary" hint="Submitted tickets" />
                <StatCard label="Pending Review" value={pendingCount} icon={Clock} tone="amber" hint="Action required" />
                <StatCard label="Approved" value={approvedCount} icon={CheckCircle2} tone="emerald" hint="Completed & fulfilled" />
                <StatCard label="Rejected" value={rejectedCount} icon={XCircle} tone="red" hint="Declined tickets" />
            </div>

            {/* Filter Controls */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="px-3 py-2 bg-neutral-100 text-xs font-bold text-neutral-700 rounded-xl border border-neutral-200 focus:outline-none"
                        >
                            <option value="ALL">All Request Types</option>
                            <option value="WFH">WFH / Remote Work</option>
                            <option value="ATTENDANCE_CORRECTION">Attendance Correction</option>
                            <option value="SALARY_CERTIFICATE">Salary Certificate</option>
                            <option value="EXPERIENCE_LETTER">Experience Letter</option>
                            <option value="ADDRESS_CHANGE">Address Change</option>
                            <option value="BANK_CHANGE">Bank Details Change</option>
                            <option value="OTHER">Other Request</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-neutral-100 text-xs font-bold text-neutral-700 rounded-xl border border-neutral-200 focus:outline-none"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search employee or description..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-neutral-100 rounded-xl text-xs font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Requests Table */}
            <SectionCard title={`Employee Requests (${filtered.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-full" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-28" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState icon={Inbox} message="No employee requests found matching the selected filters." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Type</th>
                                    <th className="py-3 px-2">Description</th>
                                    <th className="py-3 px-2">Priority</th>
                                    <th className="py-3 px-2">Submitted</th>
                                    <th className="py-3 px-2">Status</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {filtered.map((r) => (
                                    <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3.5 px-2">
                                            <div className="font-bold text-neutral-900">{r.employeeName}</div>
                                            <div className="text-[11px] text-neutral-400">{r.department}</div>
                                        </td>
                                        <td className="py-3.5 px-2">
                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-neutral-100 text-neutral-700">
                                                {r.type.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-2 max-w-xs">
                                            <p className="text-xs text-neutral-700 line-clamp-2 leading-relaxed">
                                                {r.description}
                                            </p>
                                            {r.comments && (
                                                <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                                                    HR Note: {r.comments}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-2">
                                            <span
                                                className={`px-1.5 py-0.5 text-[10px] font-black rounded uppercase ${
                                                    r.priority === "URGENT"
                                                        ? "bg-red-100 text-red-700"
                                                        : r.priority === "HIGH"
                                                        ? "bg-amber-100 text-amber-800"
                                                        : "bg-blue-50 text-blue-700"
                                                }`}
                                            >
                                                {r.priority}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-2 text-xs text-neutral-500 font-medium whitespace-nowrap">
                                            {new Date(r.requestedAt).toLocaleDateString()}
                                        </td>
                                        <td className="py-3.5 px-2">
                                            <Badge value={r.status} />
                                        </td>
                                        <td className="py-3.5 px-2 text-right whitespace-nowrap">
                                            {r.status === "PENDING" && (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => actionMutation.mutate({ id: r.id, status: "APPROVED" })}
                                                        disabled={actionMutation.isPending}
                                                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs transition-colors"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => actionMutation.mutate({ id: r.id, status: "REJECTED" })}
                                                        disabled={actionMutation.isPending}
                                                        className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs transition-colors"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            {/* Create Request Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-100 p-6 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <h3 className="font-bold text-base text-neutral-900">Raise HR Request</h3>
                            <button
                                onClick={() => setCreateModalOpen(false)}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Request Category *</label>
                                <select
                                    value={newType}
                                    onChange={(e) => setNewType(e.target.value as EmployeeRequestType)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200 focus:outline-none"
                                >
                                    <option value="WFH">WFH / Remote Work</option>
                                    <option value="ATTENDANCE_CORRECTION">Attendance Punch Correction</option>
                                    <option value="SALARY_CERTIFICATE">Salary Certificate Letter</option>
                                    <option value="EXPERIENCE_LETTER">Experience / Bonafide Letter</option>
                                    <option value="ADDRESS_CHANGE">Permanent Address Update</option>
                                    <option value="BANK_CHANGE">Salary Bank Account Change</option>
                                    <option value="OTHER">General HR Request</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Priority</label>
                                <select
                                    value={newPriority}
                                    onChange={(e) => setNewPriority(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200 focus:outline-none"
                                >
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                    <option value="URGENT">Urgent</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Description / Reason *</label>
                                <textarea
                                    rows={4}
                                    placeholder="Provide detailed justification or dates..."
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                onClick={() => setCreateModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!newDesc.trim()) {
                                        toast.error("Please provide a description");
                                        return;
                                    }
                                    createMutation.mutate({ type: newType, description: newDesc, priority: newPriority });
                                }}
                                disabled={createMutation.isPending}
                                className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-xs hover:bg-primary/90 transition-colors"
                            >
                                {createMutation.isPending ? "Submitting..." : "Submit to HR"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
