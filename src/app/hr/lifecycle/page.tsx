"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    UserCheck, TrendingUp, ArrowRightLeft, DollarSign, Clock,
    CheckCircle2, Plus, Search, Filter, ShieldCheck, XCircle, X
} from "lucide-react";
import type { ProbationRecord, PromotionRecord, TransferRecord, SalaryRevisionRecord, Employee } from "@/lib/types";

export default function HREmployeeLifecyclePage() {
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<"PROBATION" | "CONFIRMATIONS" | "PROMOTIONS" | "TRANSFERS" | "REVISIONS">("PROBATION");
    const [search, setSearch] = useState("");

    // Modals
    const [promoModalOpen, setPromoModalOpen] = useState(false);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [revisionModalOpen, setRevisionModalOpen] = useState(false);

    // Form inputs
    const [selectedEmpId, setSelectedEmpId] = useState("");
    const [newDesignation, setNewDesignation] = useState("");
    const [newCtcLpa, setNewCtcLpa] = useState("15.0");
    const [toDepartment, setToDepartment] = useState("Engineering");
    const [toLocation, setToLocation] = useState("Mumbai - HQ");
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
    const [reason, setReason] = useState("");

    // Fetch lifecycle datasets
    const { data: lifecycle, isLoading } = useQuery<{
        probation: ProbationRecord[];
        promotions: PromotionRecord[];
        transfers: TransferRecord[];
        salaryRevisions: SalaryRevisionRecord[];
    }>({
        queryKey: ["hr-lifecycle"],
        queryFn: async () => {
            const res = await fetch("/api/hr/lifecycle");
            if (!res.ok) throw new Error("Failed to fetch lifecycle data");
            return res.json();
        },
    });

    // Fetch employees for dropdown selections
    const { data: employees = [] } = useQuery<Employee[]>({
        queryKey: ["hr-employees-list"],
        queryFn: async () => {
            const res = await fetch("/api/hr/employees");
            if (!res.ok) return [];
            return res.json();
        },
    });

    const patchMutation = useMutation({
        mutationFn: async (payload: { kind: string; id: string; action: string; decisionReason?: string }) => {
            const res = await fetch("/api/hr/lifecycle", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to update lifecycle record");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-lifecycle"] });
            queryClient.invalidateQueries({ queryKey: ["hr-employees-org"] });
            toast.success("Lifecycle action applied successfully");
        },
        onError: () => {
            toast.error("Failed to process lifecycle action");
        },
    });

    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/hr/lifecycle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to submit request");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-lifecycle"] });
            toast.success("Proposal submitted successfully");
            setPromoModalOpen(false);
            setTransferModalOpen(false);
            setRevisionModalOpen(false);
            setReason("");
        },
        onError: () => {
            toast.error("Failed to submit proposal");
        },
    });

    const probations = lifecycle?.probation || [];
    const promotionsList = lifecycle?.promotions || [];
    const transfersList = lifecycle?.transfers || [];
    const revisionsList = lifecycle?.salaryRevisions || [];

    const activeProbationCount = probations.filter((p) => p.status === "ON_TRACK" || p.status === "REVIEW_PENDING").length;
    const pendingPromos = promotionsList.filter((p) => p.status === "PENDING").length;
    const pendingTransfers = transfersList.filter((t) => t.status === "PENDING").length;
    const pendingRevisions = revisionsList.filter((s) => s.status === "PENDING").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Employee Lifecycle Management"
                subtitle="Oversee probation evaluations, staff confirmations, promotion progressions, transfers, and compensation revisions."
                action={
                    <div className="flex items-center gap-2">
                        {activeTab === "PROMOTIONS" && (
                            <button
                                onClick={() => setPromoModalOpen(true)}
                                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                            >
                                <Plus size={15} /> Propose Promotion
                            </button>
                        )}
                        {activeTab === "TRANSFERS" && (
                            <button
                                onClick={() => setTransferModalOpen(true)}
                                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                            >
                                <Plus size={15} /> Request Transfer
                            </button>
                        )}
                        {activeTab === "REVISIONS" && (
                            <button
                                onClick={() => setRevisionModalOpen(true)}
                                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                            >
                                <Plus size={15} /> Propose Revision
                            </button>
                        )}
                    </div>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="On Probation" value={activeProbationCount} icon={Clock} tone="amber" hint="Pending confirmation" />
                <StatCard label="Pending Promotions" value={pendingPromos} icon={TrendingUp} tone="purple" hint="Awaiting approval" />
                <StatCard label="Pending Transfers" value={pendingTransfers} icon={ArrowRightLeft} tone="blue" hint="Dept / Location moves" />
                <StatCard label="Salary Revisions" value={pendingRevisions} icon={DollarSign} tone="emerald" hint="Appraisal adjustments" />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
                {(
                    [
                        { id: "PROBATION", label: "Probation & Reviews", count: activeProbationCount },
                        { id: "CONFIRMATIONS", label: "Confirmations", count: probations.filter((p) => p.status === "CONFIRMED").length },
                        { id: "PROMOTIONS", label: "Promotions", count: promotionsList.length },
                        { id: "TRANSFERS", label: "Transfers", count: transfersList.length },
                        { id: "REVISIONS", label: "Salary Revisions", count: revisionsList.length },
                    ] as const
                ).map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                            activeTab === t.id
                                ? "bg-primary text-white shadow-xs"
                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                    >
                        {t.label} ({t.count})
                    </button>
                ))}
            </div>

            {/* Tab 1: Probation */}
            {activeTab === "PROBATION" && (
                <SectionCard title="Active Probation Assessments">
                    {isLoading ? (
                        <SkeletonPulse className="h-32 w-full" />
                    ) : probations.length === 0 ? (
                        <EmptyState icon={Clock} message="No employees currently on probation." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                        <th className="py-3 px-2">Employee</th>
                                        <th className="py-3 px-2">Role & Dept</th>
                                        <th className="py-3 px-2">Period</th>
                                        <th className="py-3 px-2">End Date</th>
                                        <th className="py-3 px-2">Manager Rating</th>
                                        <th className="py-3 px-2">Status</th>
                                        <th className="py-3 px-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {probations.map((p) => (
                                        <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="py-3.5 px-2 font-bold text-neutral-900">{p.employeeName}</td>
                                            <td className="py-3.5 px-2 text-neutral-600">
                                                <div>{p.designation}</div>
                                                <div className="text-[11px] text-neutral-400">{p.department}</div>
                                            </td>
                                            <td className="py-3.5 px-2 font-medium text-xs text-neutral-700">{p.probationMonths} Months</td>
                                            <td className="py-3.5 px-2 text-xs font-medium text-neutral-800">{p.expectedEndDate}</td>
                                            <td className="py-3.5 px-2 text-xs font-bold text-amber-700">
                                                {p.reviewScore ? `⭐ ${p.reviewScore} / 5.0` : "Evaluation in progress"}
                                            </td>
                                            <td className="py-3.5 px-2">
                                                <Badge value={p.status} />
                                            </td>
                                            <td className="py-3.5 px-2 text-right whitespace-nowrap">
                                                {p.status !== "CONFIRMED" && (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() =>
                                                                patchMutation.mutate({
                                                                    kind: "PROBATION",
                                                                    id: p.id,
                                                                    action: "CONFIRM",
                                                                    decisionReason: "Passed review evaluation",
                                                                })
                                                            }
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                patchMutation.mutate({
                                                                    kind: "PROBATION",
                                                                    id: p.id,
                                                                    action: "EXTEND",
                                                                    decisionReason: "Extended for 3 months evaluation",
                                                                })
                                                            }
                                                            className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs"
                                                        >
                                                            Extend
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
            )}

            {/* Tab 2: Confirmations */}
            {activeTab === "CONFIRMATIONS" && (
                <SectionCard title="Employee Confirmation Records">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Department</th>
                                    <th className="py-3 px-2">Evaluation Score</th>
                                    <th className="py-3 px-2">Confirmation Date</th>
                                    <th className="py-3 px-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {probations
                                    .filter((p) => p.status === "CONFIRMED")
                                    .map((p) => (
                                        <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="py-3 px-2 font-bold text-neutral-900">{p.employeeName}</td>
                                            <td className="py-3 px-2 text-neutral-600">{p.department}</td>
                                            <td className="py-3 px-2 text-xs font-bold text-emerald-700">⭐ {p.reviewScore} / 5.0</td>
                                            <td className="py-3 px-2 text-xs text-neutral-700">{p.actualEndDate || p.expectedEndDate}</td>
                                            <td className="py-3 px-2">
                                                <Badge value="CONFIRMED" />
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Tab 3: Promotions */}
            {activeTab === "PROMOTIONS" && (
                <SectionCard title="Promotions & Designation Progression">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">From → To Role</th>
                                    <th className="py-3 px-2">Proposed CTC</th>
                                    <th className="py-3 px-2">Effective Date</th>
                                    <th className="py-3 px-2">Status</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {promotionsList.map((p) => (
                                    <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3.5 px-2 font-bold text-neutral-900">{p.employeeName}</td>
                                        <td className="py-3.5 px-2">
                                            <div className="font-semibold text-emerald-700">{p.newDesignation}</div>
                                            <div className="text-[10px] text-neutral-400 line-through">{p.currentDesignation}</div>
                                        </td>
                                        <td className="py-3.5 px-2 font-mono font-bold text-neutral-900">₹{p.newCtcLpa} LPA</td>
                                        <td className="py-3.5 px-2 text-xs text-neutral-700">{p.effectiveDate}</td>
                                        <td className="py-3.5 px-2">
                                            <Badge value={p.status} />
                                        </td>
                                        <td className="py-3.5 px-2 text-right">
                                            {p.status === "PENDING" && (
                                                <button
                                                    onClick={() => patchMutation.mutate({ kind: "PROMOTION", id: p.id, action: "APPLY" })}
                                                    className="px-3 py-1 rounded-lg bg-primary text-white font-bold text-xs hover:bg-primary/90"
                                                >
                                                    Approve & Apply
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Tab 4: Transfers */}
            {activeTab === "TRANSFERS" && (
                <SectionCard title="Department & Branch Transfers">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">From Department</th>
                                    <th className="py-3 px-2">Target Department & Location</th>
                                    <th className="py-3 px-2">Effective Date</th>
                                    <th className="py-3 px-2">Status</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {transfersList.map((t) => (
                                    <tr key={t.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3.5 px-2 font-bold text-neutral-900">{t.employeeName}</td>
                                        <td className="py-3.5 px-2 text-neutral-600">{t.fromDepartment}</td>
                                        <td className="py-3.5 px-2">
                                            <div className="font-bold text-blue-700">{t.toDepartment}</div>
                                            <div className="text-[11px] text-neutral-400">{t.toLocation}</div>
                                        </td>
                                        <td className="py-3.5 px-2 text-xs text-neutral-700">{t.effectiveDate}</td>
                                        <td className="py-3.5 px-2">
                                            <Badge value={t.status} />
                                        </td>
                                        <td className="py-3.5 px-2 text-right">
                                            {t.status === "PENDING" && (
                                                <button
                                                    onClick={() => patchMutation.mutate({ kind: "TRANSFER", id: t.id, action: "APPROVE" })}
                                                    className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100"
                                                >
                                                    Approve Transfer
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Tab 5: Salary Revisions */}
            {activeTab === "REVISIONS" && (
                <SectionCard title="Salary & Compensation Revisions">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Current CTC</th>
                                    <th className="py-3 px-2">Revised CTC</th>
                                    <th className="py-3 px-2">Increment %</th>
                                    <th className="py-3 px-2">Effective Date</th>
                                    <th className="py-3 px-2">Status</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {revisionsList.map((s) => (
                                    <tr key={s.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3.5 px-2 font-bold text-neutral-900">{s.employeeName}</td>
                                        <td className="py-3.5 px-2 font-mono text-neutral-600">{inr(s.currentCtc)}</td>
                                        <td className="py-3.5 px-2 font-mono font-bold text-emerald-700">{inr(s.newCtc)}</td>
                                        <td className="py-3.5 px-2 font-extrabold text-xs text-blue-700">+{s.incrementPercent}%</td>
                                        <td className="py-3.5 px-2 text-xs text-neutral-700">{s.effectiveDate}</td>
                                        <td className="py-3.5 px-2">
                                            <Badge value={s.status} />
                                        </td>
                                        <td className="py-3.5 px-2 text-right">
                                            {s.status === "PENDING" && (
                                                <button
                                                    onClick={() => patchMutation.mutate({ kind: "SALARY_REVISION", id: s.id, action: "PROCESS" })}
                                                    className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100"
                                                >
                                                    Process Revision
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Promotion Modal */}
            {promoModalOpen && (
                <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-100 p-6 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <h3 className="font-bold text-base text-neutral-900">Propose Employee Promotion</h3>
                            <button onClick={() => setPromoModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Select Employee *</label>
                                <select
                                    value={selectedEmpId}
                                    onChange={(e) => setSelectedEmpId(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.name} ({e.designation} - {e.department})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">New Designation *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Lead Talent Partner"
                                    value={newDesignation}
                                    onChange={(e) => setNewDesignation(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Proposed CTC (LPA)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={newCtcLpa}
                                        onChange={(e) => setNewCtcLpa(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Effective Date</label>
                                    <input
                                        type="date"
                                        value={effectiveDate}
                                        onChange={(e) => setEffectiveDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Promotion Justification</label>
                                <textarea
                                    rows={3}
                                    placeholder="Performance highlights, achievements..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm border border-neutral-200"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setPromoModalOpen(false)} className="px-4 py-2 text-sm font-bold text-neutral-600">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedEmpId || !newDesignation) {
                                        toast.error("Please fill required fields");
                                        return;
                                    }
                                    createMutation.mutate({
                                        type: "PROMOTION",
                                        employeeId: selectedEmpId,
                                        newDesignation,
                                        newCtcLpa,
                                        effectiveDate,
                                        reason,
                                    });
                                }}
                                className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-xs hover:bg-primary/90"
                            >
                                Submit Proposal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {transferModalOpen && (
                <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-100 p-6 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <h3 className="font-bold text-base text-neutral-900">Request Employee Transfer</h3>
                            <button onClick={() => setTransferModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Select Employee *</label>
                                <select
                                    value={selectedEmpId}
                                    onChange={(e) => setSelectedEmpId(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.name} ({e.department})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">To Department</label>
                                    <input
                                        type="text"
                                        value={toDepartment}
                                        onChange={(e) => setToDepartment(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">To Location</label>
                                    <input
                                        type="text"
                                        value={toLocation}
                                        onChange={(e) => setToLocation(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Effective Date</label>
                                <input
                                    type="date"
                                    value={effectiveDate}
                                    onChange={(e) => setEffectiveDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Reason</label>
                                <textarea
                                    rows={3}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm border border-neutral-200"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setTransferModalOpen(false)} className="px-4 py-2 text-sm font-bold text-neutral-600">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedEmpId) return;
                                    createMutation.mutate({
                                        type: "TRANSFER",
                                        employeeId: selectedEmpId,
                                        toDepartment,
                                        toLocation,
                                        effectiveDate,
                                        reason,
                                    });
                                }}
                                className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-xs hover:bg-primary/90"
                            >
                                Submit Transfer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
