"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { DollarSign, CreditCard, Calendar, Users, FileText, Search, Download, CheckCircle2 } from "lucide-react";

interface PayrollRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    department: string;
    month: string;
    basicSalary: number;
    hra: number;
    allowances: number;
    deductions: number;
    netSalary: number;
    status: "DRAFT" | "PROCESSED" | "PAID";
    paymentDate?: string | null;
    paymentMethod?: string | null;
}

export default function HRPayrollPage() {
    const [month, setMonth] = useState("2026-09");
    const [search, setSearch] = useState("");

    const { data: records = [], isLoading } = useQuery<PayrollRecord[]>({
        queryKey: ["hr-payroll", month, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (month !== "ALL") params.set("month", month);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/payroll?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch payroll");
            return res.json();
        },
    });

    const months = ["2026-09", "2026-08", "2026-07"];

    const totalNet = records.reduce((acc, r) => acc + (r.netSalary || 0), 0);
    const totalBasic = records.reduce((acc, r) => acc + (r.basicSalary || 0), 0);
    const totalDeductions = records.reduce((acc, r) => acc + (r.deductions || 0), 0);
    const paidCount = records.filter((r) => r.status === "PAID").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Payroll & Salary Processing"
                subtitle="Review monthly salary components, deductions, net pay calculations, and disbursement statuses."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Net Payroll" value={inr(totalNet)} icon={DollarSign} tone="emerald" hint="Monthly net disbursement" />
                <StatCard label="Total Basic Salary" value={inr(totalBasic)} icon={CreditCard} tone="blue" hint="Base pay pool" />
                <StatCard label="Total Deductions" value={inr(totalDeductions)} icon={FileText} tone="amber" hint="Tax & PF deductions" />
                <StatCard label="Employees Paid" value={`${paidCount}/${records.length}`} icon={CheckCircle2} tone="purple" hint="Disbursement ratio" />
            </div>

            {/* Filter & Month Selector */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <Calendar size={16} className="text-neutral-500" />
                            <select
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="bg-transparent font-bold text-neutral-900 focus:outline-none"
                            >
                                {months.map((m) => (
                                    <option key={m} value={m}>
                                        Cycle: {m}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search employee or code..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Payroll Table */}
            <SectionCard title={`Payroll Register — ${month} (${records.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-full" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-20" />
                                <SkeletonPulse className="h-4 w-24" />
                            </div>
                        ))}
                    </div>
                ) : records.length === 0 ? (
                    <EmptyState icon={FileText} message="No payroll records found for the selected month." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Code</th>
                                    <th className="py-3 px-2">Department</th>
                                    <th className="py-3 px-2">Basic</th>
                                    <th className="py-3 px-2">HRA</th>
                                    <th className="py-3 px-2">Allowances</th>
                                    <th className="py-3 px-2">Deductions</th>
                                    <th className="py-3 px-2">Net Salary</th>
                                    <th className="py-3 px-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {records.map((r) => (
                                    <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3.5 px-2 font-bold text-neutral-900 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-extrabold flex items-center justify-center text-xs">
                                                {r.employeeName.charAt(0)}
                                            </div>
                                            <div className="font-semibold text-neutral-900">{r.employeeName}</div>
                                        </td>
                                        <td className="py-3.5 px-2 font-mono text-xs text-neutral-500">{r.employeeCode}</td>
                                        <td className="py-3.5 px-2 text-neutral-600 font-medium">{r.department}</td>
                                        <td className="py-3.5 px-2 font-medium text-neutral-800">{inr(r.basicSalary)}</td>
                                        <td className="py-3.5 px-2 font-medium text-neutral-800">{inr(r.hra)}</td>
                                        <td className="py-3.5 px-2 font-medium text-neutral-800">{inr(r.allowances)}</td>
                                        <td className="py-3.5 px-2 font-medium text-red-600">-{inr(r.deductions)}</td>
                                        <td className="py-3.5 px-2 font-extrabold text-emerald-700">{inr(r.netSalary)}</td>
                                        <td className="py-3.5 px-2">
                                            <Badge value={r.status} />
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
