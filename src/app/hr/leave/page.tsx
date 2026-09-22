"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { Calendar, Clock, CheckCircle2, XCircle, Search, Filter, AlertCircle, UserCheck } from "lucide-react";

interface LeaveRequestEnriched {
    id: string;
    userId: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    reason: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    approverId?: string | null;
    decisionNote?: string | null;
    createdAt: string;
    employeeName: string;
    department: string;
    employeeCode: string;
    approverName?: string | null;
}

export default function HRLeavePage() {
    const [statusTab, setStatusTab] = useState<string>("ALL");
    const [search, setSearch] = useState("");
    const queryClient = useQueryClient();

    const { data: requests = [], isLoading } = useQuery<LeaveRequestEnriched[]>({
        queryKey: ["hr-leave", statusTab, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusTab !== "ALL") params.set("status", statusTab);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/leave?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch leave requests");
            return res.json();
        },
    });

    const mutation = useMutation({
        mutationFn: async ({ id, status, decisionNote }: { id: string; status: "APPROVED" | "REJECTED"; decisionNote?: string }) => {
            const res = await fetch("/api/hr/leave", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, decisionNote }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to update leave status");
            }
            return res.json();
        },
        onSuccess: (_, variables) => {
            toast.success(`Leave request ${variables.status.toLowerCase()} successfully`);
            queryClient.invalidateQueries({ queryKey: ["hr-leave"] });
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    const totalCount = requests.length;
    const pendingCount = requests.filter((r) => r.status === "PENDING").length;
    const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
    const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

    const calcDays = (from: string, to: string) => {
        try {
            const diff = +new Date(to) - +new Date(from);
            const d = Math.max(1, Math.round(diff / 86400000) + 1);
            return `${d} ${d === 1 ? "day" : "days"}`;
        } catch {
            return "1 day";
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Leave & Time-Off Management"
                subtitle="Review and process employee leave applications, vacation requests, and sick leave approvals."
            />

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Requests" value={totalCount} icon={Calendar} tone="primary" hint="All time leave logs" />
                <StatCard label="Pending Approval" value={pendingCount} icon={Clock} tone="amber" hint="Action required" />
                <StatCard label="Approved" value={approvedCount} icon={CheckCircle2} tone="emerald" hint="Sanctioned leaves" />
                <StatCard label="Rejected" value={rejectedCount} icon={XCircle} tone="red" hint="Declined requests" />
            </div>

            {/* Filter Tabs & Search */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-sm font-medium">
                        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setStatusTab(tab)}
                                className={`px-4 py-2 rounded-lg transition-colors ${
                                    statusTab === tab
                                        ? "bg-white text-neutral-900 font-bold shadow-xs"
                                        : "text-neutral-500 hover:text-neutral-900"
                                }`}
                            >
                                {tab === "ALL" ? "All Requests" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search employee or reason..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Requests Table */}
            <SectionCard title={`Leave Applications (${requests.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-full" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-28" />
                                <SkeletonPulse className="h-8 w-24 rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : requests.length === 0 ? (
                    <EmptyState icon={AlertCircle} message="No leave applications match the selected criteria." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Leave Type</th>
                                    <th className="py-3 px-2">Duration / Dates</th>
                                    <th className="py-3 px-2">Reason</th>
                                    <th className="py-3 px-2">Status</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3.5 px-2 font-bold text-neutral-900 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-extrabold flex items-center justify-center text-xs">
                                                {req.employeeName.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-neutral-900">{req.employeeName}</div>
                                                <div className="text-xs text-neutral-400 font-normal">{req.department} • {req.employeeCode}</div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-2 font-semibold text-neutral-800">
                                            <span className="bg-neutral-100 px-2.5 py-1 rounded-lg text-xs font-bold text-neutral-700">
                                                {req.leaveType}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-2 text-neutral-800">
                                            <div className="font-medium">{req.fromDate} to {req.toDate}</div>
                                            <div className="text-xs text-neutral-400">{calcDays(req.fromDate, req.toDate)}</div>
                                        </td>
                                        <td className="py-3.5 px-2 text-neutral-600 max-w-xs truncate">{req.reason}</td>
                                        <td className="py-3.5 px-2">
                                            <Badge value={req.status} />
                                        </td>
                                        <td className="py-3.5 px-2 text-right">
                                            {req.status === "PENDING" ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => mutation.mutate({ id: req.id, status: "APPROVED" })}
                                                        disabled={mutation.isPending}
                                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1"
                                                    >
                                                        <CheckCircle2 size={14} /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => mutation.mutate({ id: req.id, status: "REJECTED" })}
                                                        disabled={mutation.isPending}
                                                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors flex items-center gap-1"
                                                    >
                                                        <XCircle size={14} /> Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-neutral-400 font-medium">
                                                    {req.approverName ? `By ${req.approverName}` : "Processed"}
                                                </span>
                                            )}
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
