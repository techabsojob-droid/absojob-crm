"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Search, CheckCircle2, XCircle, Clock, AlertTriangle, FileText, ChevronRight, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import type { ApprovalRequest } from "@/lib/types";

export default function ApprovalsPage() {
    const qc = useQueryClient();
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
    const [reviewComment, setReviewComment] = useState("");

    const { data: approvals = [], isLoading } = useQuery<ApprovalRequest[]>({
        queryKey: ["admin-approvals", q, statusFilter],
        queryFn: async () => {
            const res = await fetch(`/api/admin/approvals?q=${encodeURIComponent(q)}&status=${statusFilter}`);
            if (!res.ok) throw new Error();
            return res.json();
        },
    });

    const actionMutation = useMutation({
        mutationFn: async ({ id, action, comment }: { id: string; action: "APPROVE" | "REJECT" | "REQUEST_CHANGES"; comment?: string }) => {
            const res = await fetch("/api/admin/approvals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action, reviewComment: comment }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(`Request ${data.status.toLowerCase()} successfully`);
            qc.invalidateQueries({ queryKey: ["admin-approvals"] });
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
            setSelectedApproval(null);
            setReviewComment("");
        },
        onError: () => toast.error("Action failed"),
    });

    const pending = approvals.filter((a) => a.status === "PENDING");
    const approved = approvals.filter((a) => a.status === "APPROVED");
    const salaryExceptions = approvals.filter((a) => a.type === "SALARY_EXCEPTION" && a.status === "PENDING").length;
    const decided = approvals.filter((a) => a.reviewedAt);
    const avgResponseHrs = decided.length
        ? decided.reduce((s, a) => s + Math.max(0, new Date(a.reviewedAt!).getTime() - new Date(a.date).getTime()), 0) / decided.length / 3600000
        : null;
    const avgResponse = avgResponseHrs == null ? "—" : avgResponseHrs < 48 ? `${avgResponseHrs.toFixed(1)} hrs` : `${(avgResponseHrs / 24).toFixed(1)} days`;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Super Admin Approval Center"
                subtitle="High-impact governance: Requisition approvals, salary band exceptions, invoice sign-offs & role promotions"
            />

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pending Action" value={pending.length} icon={Clock} tone={pending.length > 0 ? "amber" : "emerald"} hint="awaiting admin review" />
                <StatCard label="Approved This Month" value={approved.length} icon={ShieldCheck} tone="emerald" hint="sanctioned requisitions" />
                <StatCard label="Salary Exceptions" value={salaryExceptions} icon={AlertTriangle} tone={salaryExceptions > 0 ? "amber" : "blue"} hint="pending, outside median band" />
                <StatCard label="Avg Response Time" value={avgResponse} icon={Clock} tone="purple" hint={`across ${decided.length} decided request(s)`} />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-100 shadow-sm">
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search approvals, titles..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    {["ALL", "PENDING", "APPROVED", "REJECTED"].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                statusFilter === s
                                    ? "bg-primary text-white shadow-sm"
                                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-20 rounded-2xl" />
                    ))}
                </div>
            ) : approvals.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={ShieldCheck} message="No pending approval requests." />
                </SectionCard>
            ) : (
                <div className="space-y-3">
                    {approvals.map((a) => (
                        <div
                            key={a.id}
                            className={`p-5 bg-white rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                                a.status === "PENDING" ? "border-amber-200/80 shadow-sm" : "border-neutral-100 opacity-80"
                            }`}
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge value={a.priority} label={a.priority} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                        {a.type.replace("_", " ")}
                                    </span>
                                    <span className="text-[11px] text-neutral-400 font-medium">· ID: {a.id}</span>
                                </div>
                                <h4 className="text-xs font-bold text-neutral-900">{a.title}</h4>
                                <p className="text-[11px] text-neutral-600 leading-relaxed max-w-2xl">{a.description}</p>
                                <div className="flex items-center gap-3 pt-1 text-[10px] text-neutral-400 font-semibold">
                                    <span>Requested by: <strong className="text-neutral-700">{a.requestedByName}</strong> ({a.requestedByRole})</span>
                                    <span>· Record: <strong className="text-neutral-700">{a.relatedRecordName}</strong></span>
                                </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                                {a.status === "PENDING" ? (
                                    <>
                                        <button
                                            onClick={() => actionMutation.mutate({ id: a.id, action: "APPROVE" })}
                                            className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-xl hover:bg-primary/95 shadow-sm shadow-primary/20 flex items-center gap-1"
                                        >
                                            <CheckCircle2 size={14} /> Approve
                                        </button>
                                        <button
                                            onClick={() => setSelectedApproval(a)}
                                            className="px-3 py-1.5 text-xs font-bold bg-neutral-100 text-neutral-700 rounded-xl hover:bg-neutral-200"
                                        >
                                            Review / Reject
                                        </button>
                                    </>
                                ) : (
                                    <Badge value={a.status} label={a.status} />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Review Dialog */}
            {selectedApproval && (
                <ModalShell
                    title={`Review: ${selectedApproval.title}`}
                    onClose={() => setSelectedApproval(null)}
                >
                    <div className="space-y-4">
                        <div className="p-3 bg-neutral-50 rounded-xl space-y-1 text-xs text-neutral-600">
                            <p><strong>Record:</strong> {selectedApproval.relatedRecordName}</p>
                            <p><strong>Description:</strong> {selectedApproval.description}</p>
                            <p><strong>Requested By:</strong> {selectedApproval.requestedByName}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-neutral-700 block mb-1">Decision Comments / Reason</label>
                            <textarea
                                rows={3}
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Enter rationale for approval or rejection note..."
                                className="w-full p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => actionMutation.mutate({ id: selectedApproval.id, action: "REQUEST_CHANGES", comment: reviewComment })}
                                className="px-3 py-1.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-100"
                            >
                                Request Changes
                            </button>
                            <button
                                onClick={() => actionMutation.mutate({ id: selectedApproval.id, action: "REJECT", comment: reviewComment })}
                                className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100"
                            >
                                Reject Request
                            </button>
                            <button
                                onClick={() => actionMutation.mutate({ id: selectedApproval.id, action: "APPROVE", comment: reviewComment })}
                                className="px-4 py-1.5 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary/95"
                            >
                                Approve Request
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
