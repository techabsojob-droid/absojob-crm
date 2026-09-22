"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { LogOut, Calendar, CheckCircle2, Clock, FileText, Search, UserMinus, ShieldAlert, Filter, AlertCircle } from "lucide-react";

interface ClearanceItem {
    department: string;
    cleared: boolean;
    clearedBy?: string | null;
    clearedAt?: string | null;
    notes?: string | null;
}

interface ExitRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    department: string;
    resignationDate: string;
    noticePeriodDays: number;
    lastWorkingDay: string;
    reason: string;
    status: "PENDING_APPROVAL" | "NOTICE_PERIOD" | "CLEARANCE" | "SETTLED" | "COMPLETED";
    exitInterviewNotes?: string | null;
    clearanceChecklist: ClearanceItem[];
    fnfSettled: boolean;
    fnfAmountInr?: number | null;
    experienceLetterIssued: boolean;
}

export default function HRExitPage() {
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");

    const { data: exits = [], isLoading } = useQuery<ExitRecord[]>({
        queryKey: ["hr-exit", statusFilter, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/exit?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch exit records");
            return res.json();
        },
    });

    const activeNotice = exits.filter((e) => e.status === "NOTICE_PERIOD" || e.status === "CLEARANCE").length;
    const fnfSettledCount = exits.filter((e) => e.fnfSettled).length;
    const completedExits = exits.filter((e) => e.status === "COMPLETED" || e.status === "SETTLED").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Employee Offboarding & Exit Management"
                subtitle="Manage resignations, notice periods, departmental clearances, exit interviews, and F&F settlements."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Resignations" value={exits.length} icon={LogOut} tone="primary" hint="All recorded exits" />
                <StatCard label="Serving Notice Period" value={activeNotice} icon={Clock} tone="amber" hint="Active offboarding" />
                <StatCard label="F&F Settled" value={fnfSettledCount} icon={CheckCircle2} tone="emerald" hint="Financial dues cleared" />
                <StatCard label="Completed Exits" value={completedExits} icon={UserMinus} tone="purple" hint="Offboarding complete" />
            </div>

            {/* Filters */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <Filter size={16} className="text-neutral-500" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                            >
                                <option value="ALL">All Exit Statuses</option>
                                <option value="NOTICE_PERIOD">Notice Period</option>
                                <option value="CLEARANCE">Clearance</option>
                                <option value="SETTLED">Settled</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search employee or dept..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Resignation Table */}
            <SectionCard title={`Offboarding Register (${exits.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-full" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-24" />
                                <SkeletonPulse className="h-4 w-20" />
                            </div>
                        ))}
                    </div>
                ) : exits.length === 0 ? (
                    <EmptyState icon={AlertCircle} message="No resignation or exit records found." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Department</th>
                                    <th className="py-3 px-2">Resignation Date</th>
                                    <th className="py-3 px-2">Notice Period</th>
                                    <th className="py-3 px-2">Last Working Day</th>
                                    <th className="py-3 px-2">Clearance Progress</th>
                                    <th className="py-3 px-2">F&F Settlement</th>
                                    <th className="py-3 px-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {exits.map((ext) => {
                                    const clearedCount = ext.clearanceChecklist?.filter((c) => c.cleared).length || 0;
                                    const totalDepts = ext.clearanceChecklist?.length || 1;
                                    const progressPercent = Math.round((clearedCount / totalDepts) * 100);

                                    return (
                                        <tr key={ext.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="py-3.5 px-2 font-bold text-neutral-900 flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 font-extrabold flex items-center justify-center text-xs">
                                                    {ext.employeeName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-neutral-900">{ext.employeeName}</div>
                                                    <div className="text-[11px] text-neutral-400 font-normal truncate max-w-xs">{ext.reason}</div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-2 text-neutral-600 font-medium">{ext.department}</td>
                                            <td className="py-3.5 px-2 text-neutral-800">{ext.resignationDate}</td>
                                            <td className="py-3.5 px-2 font-medium text-neutral-800">{ext.noticePeriodDays} Days</td>
                                            <td className="py-3.5 px-2 font-semibold text-neutral-900">{ext.lastWorkingDay}</td>
                                            <td className="py-3.5 px-2 min-w-35">
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[11px] font-bold text-neutral-600">
                                                        <span>{clearedCount}/{totalDepts} Cleared</span>
                                                        <span>{progressPercent}%</span>
                                                    </div>
                                                    <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                                                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${progressPercent}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-2">
                                                {ext.fnfSettled ? (
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                        Settled {ext.fnfAmountInr ? `(${inr(ext.fnfAmountInr)})` : ""}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-2">
                                                <Badge value={ext.status} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
