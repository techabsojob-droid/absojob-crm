"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    Calendar, Clock, CheckCircle2, XCircle, Search, Filter,
    AlertCircle, UserCheck, CalendarDays, PieChart, ScrollText,
    Plus, Edit, X
} from "lucide-react";


function useHrReference() {
    return useQuery<Record<string, any[]>>({
        queryKey: ["hr-reference", "leaveBalances,leavePolicies"],
        queryFn: async () => (await fetch("/api/hr/reference?keys=leaveBalances,leavePolicies")).json(),
        staleTime: 60_000,
    });
}

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

function LeaveContent() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<"REQUESTS" | "CALENDAR" | "BALANCES" | "POLICIES">("REQUESTS");
    const [statusTab, setStatusTab] = useState<string>("ALL");
    const [search, setSearch] = useState("");

    // Balances state
    const { data: ref } = useHrReference();
    const mockPolicies: any[] = ref?.leavePolicies ?? [];
    // Local edits override the server list until the page reloads
    const [balancesOverride, setBalancesRaw] = useState<any[] | null>(null);
    const balances: any[] = balancesOverride ?? ref?.leaveBalances ?? [];
    const setBalances = (fn: (prev: any[]) => any[]) => setBalancesRaw(fn(balances));
    const [adjustModalOpen, setAdjustModalOpen] = useState(false);
    const [selectedBalanceEmp, setSelectedBalanceEmp] = useState<any>(null);
    const [adjustDays, setAdjustDays] = useState(1);
    const [adjustType, setAdjustType] = useState<"CASUAL" | "SICK" | "EARNED">("CASUAL");

    useEffect(() => {
        if (tabParam === "calendar") setActiveTab("CALENDAR");
        else if (tabParam === "balances") setActiveTab("BALANCES");
        else if (tabParam === "policies") setActiveTab("POLICIES");
    }, [tabParam]);

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
            queryClient.invalidateQueries({ queryKey: ["hr-approvals-feed"] });
        },
        onError: (err: any) => {
            toast.error(err.message || "Action failed");
        },
    });

    const pendingCount = requests.filter((r) => r.status === "PENDING").length;
    const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
    const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

    const handleAdjustBalance = () => {
        if (!selectedBalanceEmp) return;
        setBalances((prev) =>
            prev.map((b) => {
                if (b.id === selectedBalanceEmp.id) {
                    if (adjustType === "CASUAL") return { ...b, casualAllowance: b.casualAllowance + Number(adjustDays) };
                    if (adjustType === "SICK") return { ...b, sickAllowance: b.sickAllowance + Number(adjustDays) };
                    return { ...b, earnedAllowance: b.earnedAllowance + Number(adjustDays) };
                }
                return b;
            })
        );
        toast.success(`Adjusted ${adjustType} leave quota for ${selectedBalanceEmp.employeeName}`);
        setAdjustModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Leave & Time-Off Management"
                subtitle="Review leave applications, team time-off calendar, employee balances, and policy rules."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Pending Applications" value={pendingCount} icon={Clock} tone="amber" hint="Awaiting review" />
                <StatCard label="Approved Leaves" value={approvedCount} icon={CheckCircle2} tone="emerald" hint="Sanctioned days" />
                <StatCard label="Rejected / Declined" value={rejectedCount} icon={XCircle} tone="red" hint="Declined requests" />
                <StatCard label="On Leave Today" value={2} icon={Calendar} tone="blue" hint="Current active absences" />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
                {(
                    [
                        { id: "REQUESTS", label: `Leave Applications (${requests.length})` },
                        { id: "CALENDAR", label: "Leave Calendar & Schedule" },
                        { id: "BALANCES", label: `Employee Quotas & Balances (${balances.length})` },
                        { id: "POLICIES", label: `Leave Policies (${mockPolicies.length})` },
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
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: REQUESTS (Existing Preserved) */}
            {activeTab === "REQUESTS" && (
                <div className="space-y-6">
                    <SectionCard>
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                {["ALL", "PENDING", "APPROVED", "REJECTED"].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setStatusTab(tab)}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                                            statusTab === tab
                                                ? "bg-primary text-white shadow-xs"
                                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            <div className="relative w-full md:w-64">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or reason..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title={`Leave Requests (${requests.length})`}>
                        {isLoading ? (
                            <SkeletonPulse className="h-40 w-full" />
                        ) : requests.length === 0 ? (
                            <EmptyState icon={AlertCircle} message="No leave applications found matching your criteria." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                            <th className="py-3 px-2">Employee</th>
                                            <th className="py-3 px-2">Leave Type</th>
                                            <th className="py-3 px-2">Duration</th>
                                            <th className="py-3 px-2">Reason</th>
                                            <th className="py-3 px-2">Status</th>
                                            <th className="py-3 px-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {requests.map((r) => (
                                            <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                                                <td className="py-3.5 px-2">
                                                    <div className="font-bold text-neutral-900">{r.employeeName}</div>
                                                    <div className="text-[11px] text-neutral-400">{r.department}</div>
                                                </td>
                                                <td className="py-3.5 px-2">
                                                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-neutral-100 text-neutral-700">
                                                        {r.leaveType}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-2 text-xs font-semibold text-neutral-700">
                                                    {r.fromDate} → {r.toDate}
                                                </td>
                                                <td className="py-3.5 px-2 text-xs text-neutral-600 max-w-xs truncate">
                                                    {r.reason}
                                                </td>
                                                <td className="py-3.5 px-2">
                                                    <Badge value={r.status} />
                                                </td>
                                                <td className="py-3.5 px-2 text-right whitespace-nowrap">
                                                    {r.status === "PENDING" && (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => mutation.mutate({ id: r.id, status: "APPROVED" })}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => mutation.mutate({ id: r.id, status: "REJECTED" })}
                                                                className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs"
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
                </div>
            )}

            {/* TAB 2: CALENDAR (Section 17) */}
            {activeTab === "CALENDAR" && (
                <SectionCard title="Team Absence & Leave Schedule">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50">
                                <span className="text-xs font-bold text-neutral-900 block mb-1">Today on Leave</span>
                                <div className="space-y-1 text-xs text-neutral-600">
                                    <p className="font-semibold text-primary">• Rahul Sharma (Casual Leave)</p>
                                    <p className="font-semibold text-primary">• Pooja Hegde (Sick Leave)</p>
                                </div>
                            </div>
                            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50">
                                <span className="text-xs font-bold text-neutral-900 block mb-1">Upcoming Next Week</span>
                                <div className="space-y-1 text-xs text-neutral-600">
                                    <p>• Sneha Patil (Sep 28 - Sep 30)</p>
                                    <p>• Vikram Singh (Oct 02 - Oct 05)</p>
                                </div>
                            </div>
                            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50">
                                <span className="text-xs font-bold text-neutral-900 block mb-1">Upcoming Public Holiday</span>
                                <p className="text-xs font-bold text-emerald-700">Gandhi Jayanti • Oct 02, 2026</p>
                                <p className="text-[11px] text-neutral-400">All locations closed</p>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB 3: BALANCES (Section 18) */}
            {activeTab === "BALANCES" && (
                <SectionCard title="Employee Leave Quotas & Balances">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Department</th>
                                    <th className="py-3 px-2">Casual (Used/Total)</th>
                                    <th className="py-3 px-2">Sick (Used/Total)</th>
                                    <th className="py-3 px-2">Earned (Used/Total)</th>
                                    <th className="py-3 px-2">Carried Forward</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {balances.map((b) => (
                                    <tr key={b.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3 px-2 font-bold text-neutral-900">{b.employeeName}</td>
                                        <td className="py-3 px-2 text-neutral-600">{b.department}</td>
                                        <td className="py-3 px-2 text-xs font-bold text-neutral-800">
                                            {b.casualUsed} / {b.casualAllowance}
                                        </td>
                                        <td className="py-3 px-2 text-xs font-bold text-neutral-800">
                                            {b.sickUsed} / {b.sickAllowance}
                                        </td>
                                        <td className="py-3 px-2 text-xs font-bold text-neutral-800">
                                            {b.earnedUsed} / {b.earnedAllowance}
                                        </td>
                                        <td className="py-3 px-2 text-xs font-bold text-primary">+{b.carryForward} days</td>
                                        <td className="py-3 px-2 text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedBalanceEmp(b);
                                                    setAdjustModalOpen(true);
                                                }}
                                                className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs"
                                            >
                                                Adjust
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* TAB 4: POLICIES (Section 19) */}
            {activeTab === "POLICIES" && (
                <SectionCard title="Configurable Leave Policies">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {mockPolicies.map((p) => (
                            <div key={p.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-sm text-neutral-900">{p.leaveType} LEAVE</h4>
                                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-primary/10 text-primary">
                                        {p.annualAllowance} Days / Year
                                    </span>
                                </div>
                                <div className="text-xs text-neutral-600 space-y-1 pt-1">
                                    <p>• Max Carry Forward: {p.carryForwardMax} days</p>
                                    <p>• Encashment Allowed: {p.encashmentAllowed ? "Yes" : "No"}</p>
                                    <p>• Notice Period Required: {p.minNoticeDays} days</p>
                                    <p>• Available in Probation: {p.probationAllowed ? "Yes" : "No"}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Adjust Balance Modal */}
            {adjustModalOpen && selectedBalanceEmp && (
                <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-neutral-100 p-6 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <h3 className="font-bold text-base text-neutral-900">Adjust Leave Quota</h3>
                            <button onClick={() => setAdjustModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-xs text-neutral-600">
                            Adjusting leave allocation for <strong className="text-neutral-900">{selectedBalanceEmp.employeeName}</strong>.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Leave Category</label>
                                <select
                                    value={adjustType}
                                    onChange={(e) => setAdjustType(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                >
                                    <option value="CASUAL">Casual Leave</option>
                                    <option value="SICK">Sick Leave</option>
                                    <option value="EARNED">Earned Leave</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Quota Adjustment (Days +/-)</label>
                                <input
                                    type="number"
                                    value={adjustDays}
                                    onChange={(e) => setAdjustDays(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setAdjustModalOpen(false)} className="px-4 py-2 text-sm font-bold text-neutral-600">
                                Cancel
                            </button>
                            <button
                                onClick={handleAdjustBalance}
                                className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-xs hover:bg-primary/90"
                            >
                                Apply Adjustment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HRLeavePage() {
    return (
        <Suspense fallback={<SkeletonPulse className="h-96 w-full" />}>
            <LeaveContent />
        </Suspense>
    );
}
