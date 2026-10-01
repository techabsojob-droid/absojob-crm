"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    DollarSign, CreditCard, Calendar, Users, FileText, Search,
    Download, CheckCircle2, Layers, Receipt, Percent, ArrowRight,
    Printer, X
} from "lucide-react";

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

function PayrollContent() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");

    const [activeTab, setActiveTab] = useState<"REGISTER" | "PROCESSING" | "STRUCTURE" | "PAYSLIPS" | "DEDUCTIONS">("REGISTER");
    const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [search, setSearch] = useState("");
    const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

    const qc = useQueryClient();
    const { user } = useAuth();

    useEffect(() => {
        if (tabParam === "processing") setActiveTab("PROCESSING");
        else if (tabParam === "structure") setActiveTab("STRUCTURE");
        else if (tabParam === "payslips") setActiveTab("PAYSLIPS");
        else if (tabParam === "deductions") setActiveTab("DEDUCTIONS");
    }, [tabParam]);

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

    // Current month and the five before it
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });

    const cycleAction = useMutation({
        mutationFn: async (action: "generate" | "process" | "pay") => {
            const res = await fetch("/api/hr/payroll", {
                method: action === "generate" ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month, action }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Payroll action failed");
            return { action, data };
        },
        onSuccess: ({ action, data }) => {
            if (action === "generate") {
                toast.success(`Draft generated: ${data.created} record(s)`);
                if (data.skipped?.length) toast.warning(`No salary structure for: ${data.skipped.join(", ")}`);
            } else if (action === "process") toast.success(`${data.processed} record(s) processed and locked`);
            else toast.success(`${data.paid} salaries disbursed (${inr(data.total)}). Employees notified.`);
            qc.invalidateQueries({ queryKey: ["hr-payroll"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const exportCsv = () => {
        if (!records.length) {
            toast.error("Nothing to export for this cycle");
            return;
        }
        const header = ["Employee Code", "Name", "Department", "Month", "Basic", "HRA", "Allowances", "Deductions", "Net", "Status", "Paid On"];
        const rows = records.map((r) => [r.employeeCode, r.employeeName, r.department, r.month, r.basicSalary, r.hra, r.allowances, r.deductions, r.netSalary, r.status, r.paymentDate ?? ""]);
        const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-${month}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const draftCount = records.filter((r) => r.status === "DRAFT").length;
    const processedCount = records.filter((r) => r.status === "PROCESSED").length;
    const procStep = records.length === 0 ? "DRAFT" : draftCount > 0 ? "REVIEW" : processedCount > 0 ? "APPROVE" : "COMPLETED";

    const totalNet = records.reduce((acc, r) => acc + (r.netSalary || 0), 0);
    const totalBasic = records.reduce((acc, r) => acc + (r.basicSalary || 0), 0);
    const totalDeductions = records.reduce((acc, r) => acc + (r.deductions || 0), 0);
    const paidCount = records.filter((r) => r.status === "PAID").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Payroll & Compensation Management"
                subtitle="Review salary structures, execute monthly compensation cycles, issue payslips, and manage statutory deductions."
                action={
                    <button
                        onClick={exportCsv}
                        className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs flex items-center gap-2"
                    >
                        <Download size={15} /> Export Payroll
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Net Payroll" value={inr(totalNet)} icon={DollarSign} tone="emerald" hint="Monthly net disbursement" />
                <StatCard label="Total Basic Salary" value={inr(totalBasic)} icon={CreditCard} tone="blue" hint="Base pay pool" />
                <StatCard label="Total Deductions" value={inr(totalDeductions)} icon={FileText} tone="amber" hint="Tax & PF deductions" />
                <StatCard label="Disbursed Count" value={`${paidCount} / ${records.length}`} icon={CheckCircle2} tone="primary" hint="Salaries credited" />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
                {(
                    [
                        { id: "REGISTER", label: "Monthly Register" },
                        { id: "PROCESSING", label: "Payroll Processing Workflow" },
                        { id: "STRUCTURE", label: "Salary Structure & Bands" },
                        { id: "PAYSLIPS", label: `Staff Payslips (${records.length})` },
                        { id: "DEDUCTIONS", label: "Deductions & Benefits" },
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

            {/* TAB 1: REGISTER (Existing Preserved) */}
            {activeTab === "REGISTER" && (
                <div className="space-y-6">
                    <SectionCard>
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                                    <Calendar size={16} className="text-neutral-500" />
                                    <select
                                        value={month}
                                        onChange={(e) => setMonth(e.target.value)}
                                        className="bg-transparent font-bold text-neutral-800 focus:outline-none"
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
                                    placeholder="Search employee..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title={`Payroll Register — ${month} (${records.length} Employees)`}>
                        {isLoading ? (
                            <SkeletonPulse className="h-40 w-full" />
                        ) : records.length === 0 ? (
                            <EmptyState icon={DollarSign} message="No payroll records found for this cycle." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                            <th className="py-3 px-2">Employee</th>
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
                                                <td className="py-3.5 px-2 font-bold text-neutral-900">
                                                    <div>{r.employeeName}</div>
                                                    <div className="text-[11px] text-neutral-400 font-mono">{r.employeeCode} • {r.department}</div>
                                                </td>
                                                <td className="py-3.5 px-2 font-mono text-neutral-700">{inr(r.basicSalary)}</td>
                                                <td className="py-3.5 px-2 font-mono text-neutral-700">{inr(r.hra)}</td>
                                                <td className="py-3.5 px-2 font-mono text-neutral-700">{inr(r.allowances)}</td>
                                                <td className="py-3.5 px-2 font-mono text-red-600">-{inr(r.deductions)}</td>
                                                <td className="py-3.5 px-2 font-mono font-extrabold text-neutral-900">{inr(r.netSalary)}</td>
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
            )}

            {/* TAB 2: PROCESSING WORKFLOW (Section 20) */}
            {activeTab === "PROCESSING" && (
                <SectionCard title="End-of-Month Payroll Processing Stepper">
                    <div className="space-y-6">
                        {/* Stepper Progress Bar */}
                        <div className="flex items-center justify-between relative px-6">
                            <div className="absolute top-1/2 left-10 right-10 -translate-y-1/2 h-1 bg-neutral-200 -z-0" />
                            {[
                                { id: "DRAFT", label: "1. Draft Generation" },
                                { id: "CALCULATE", label: "2. Gross & Tax Calc" },
                                { id: "REVIEW", label: "3. Discrepancy Review" },
                                { id: "APPROVE", label: "4. Executive Approval" },
                                { id: "COMPLETED", label: "5. Disbursement Credited" },
                            ].map((step, idx) => {
                                const isCurrent = procStep === step.id;
                                const order = ["DRAFT", "CALCULATE", "REVIEW", "APPROVE", "COMPLETED"];
                                const isDone = order.indexOf(step.id) < order.indexOf(procStep) || procStep === "COMPLETED";
                                return (
                                    <div key={step.id} className="flex flex-col items-center gap-2 z-10 bg-white px-2">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                                                isCurrent
                                                    ? "bg-primary text-white ring-4 ring-primary/20 shadow-md"
                                                    : isDone
                                                    ? "bg-emerald-500 text-white"
                                                    : "bg-neutral-100 text-neutral-400"
                                            }`}
                                        >
                                            {idx + 1}
                                        </div>
                                        <span className={`text-xs font-bold ${isCurrent ? "text-primary" : "text-neutral-500"}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Step Details & Action */}
                        <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h4 className="font-bold text-base text-neutral-900">Cycle {month}: {procStep === "DRAFT" ? "Not generated" : procStep === "REVIEW" ? "Draft — review & process" : procStep === "APPROVE" ? "Processed — ready to disburse" : "Disbursed"}</h4>
                                <p className="text-xs text-neutral-600">
                                    {records.length} record(s) · {draftCount} draft · {processedCount} processed · {paidCount} paid · Net {inr(totalNet)}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    disabled={cycleAction.isPending}
                                    onClick={() => cycleAction.mutate("generate")}
                                    className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-800 font-bold text-xs hover:bg-white disabled:opacity-50"
                                >
                                    {records.length ? "Add missing employees" : "Generate draft"}
                                </button>
                                {draftCount > 0 && (
                                    <button
                                        disabled={cycleAction.isPending}
                                        onClick={() => cycleAction.mutate("process")}
                                        className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        Process & lock {draftCount}
                                    </button>
                                )}
                                {processedCount > 0 && user?.role !== "SUPER_ADMIN" && (
                                    <span className="px-4 py-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs">
                                        {processedCount} with Finance for disbursement
                                    </span>
                                )}
                                {processedCount > 0 && user?.role === "SUPER_ADMIN" && (
                                    <button
                                        disabled={cycleAction.isPending}
                                        onClick={() => {
                                            if (window.confirm(`Disburse ${processedCount} salaries for ${month}? Employees will be notified.`)) cycleAction.mutate("pay");
                                        }}
                                        className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        Disburse {processedCount}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB 3: SALARY STRUCTURE (Section 21) */}
            {activeTab === "STRUCTURE" && (
                <SectionCard title="Configured Salary Components & Tax Split">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-3">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500">Earnings Components</h4>
                            <div className="space-y-2">
                                <div className="p-3 rounded-xl border border-neutral-200 bg-white flex justify-between items-center text-xs">
                                    <span className="font-bold text-neutral-800">Basic Salary</span>
                                    <span className="font-bold text-primary">50% of Annual CTC</span>
                                </div>
                                <div className="p-3 rounded-xl border border-neutral-200 bg-white flex justify-between items-center text-xs">
                                    <span className="font-bold text-neutral-800">House Rent Allowance (HRA)</span>
                                    <span className="font-bold text-primary">20% of Annual CTC</span>
                                </div>
                                <div className="p-3 rounded-xl border border-neutral-200 bg-white flex justify-between items-center text-xs">
                                    <span className="font-bold text-neutral-800">Special & Flexible Allowance</span>
                                    <span className="font-bold text-primary">Balance Allowance</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500">Statutory Deductions</h4>
                            <div className="space-y-2">
                                <div className="p-3 rounded-xl border border-neutral-200 bg-white flex justify-between items-center text-xs">
                                    <span className="font-bold text-neutral-800">Employee Provident Fund (EPF)</span>
                                    <span className="font-bold text-red-600">12% of Basic</span>
                                </div>
                                <div className="p-3 rounded-xl border border-neutral-200 bg-white flex justify-between items-center text-xs">
                                    <span className="font-bold text-neutral-800">Professional Tax (PT)</span>
                                    <span className="font-bold text-red-600">₹200 / month</span>
                                </div>
                                <div className="p-3 rounded-xl border border-neutral-200 bg-white flex justify-between items-center text-xs">
                                    <span className="font-bold text-neutral-800">Income Tax (TDS)</span>
                                    <span className="font-bold text-red-600">Applicable Slab Rate</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB 4: PAYSLIPS (Section 22) */}
            {activeTab === "PAYSLIPS" && (
                <SectionCard title="Employee Digital Payslips">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Month</th>
                                    <th className="py-3 px-2">Net Pay</th>
                                    <th className="py-3 px-2">Status</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {records.map((r) => (
                                    <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3 px-2 font-bold text-neutral-900">{r.employeeName}</td>
                                        <td className="py-3 px-2 text-xs text-neutral-600">{r.month}</td>
                                        <td className="py-3 px-2 font-mono font-bold text-neutral-900">{inr(r.netSalary)}</td>
                                        <td className="py-3 px-2">
                                            <Badge value={r.status} />
                                        </td>
                                        <td className="py-3 px-2 text-right">
                                            <button
                                                onClick={() => setSelectedPayslip(r)}
                                                className="px-3 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs"
                                            >
                                                View Payslip
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Payslip Modal View */}
            {selectedPayslip && (
                <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-5 animate-scale-in">
                        <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
                            <div>
                                <h3 className="font-extrabold text-base text-neutral-900">Payslip — {selectedPayslip.month}</h3>
                                <p className="text-xs text-neutral-500">AbsoJob HR Services Pvt Ltd</p>
                            </div>
                            <button onClick={() => setSelectedPayslip(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-neutral-400 block font-bold">Employee Name</span>
                                <span className="font-bold text-neutral-900">{selectedPayslip.employeeName}</span>
                            </div>
                            <div>
                                <span className="text-neutral-400 block font-bold">Department</span>
                                <span className="font-bold text-neutral-900">{selectedPayslip.department}</span>
                            </div>
                        </div>

                        <div className="border border-neutral-200 rounded-xl overflow-hidden text-xs">
                            <table className="w-full text-left">
                                <thead className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-600">
                                    <tr>
                                        <th className="py-2 px-3">Earnings Component</th>
                                        <th className="py-2 px-3 text-right">Amount (INR)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    <tr>
                                        <td className="py-2 px-3">Basic Pay</td>
                                        <td className="py-2 px-3 text-right font-mono">{inr(selectedPayslip.basicSalary)}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3">House Rent Allowance (HRA)</td>
                                        <td className="py-2 px-3 text-right font-mono">{inr(selectedPayslip.hra)}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3">Special Allowances</td>
                                        <td className="py-2 px-3 text-right font-mono">{inr(selectedPayslip.allowances)}</td>
                                    </tr>
                                    <tr className="bg-red-50/50">
                                        <td className="py-2 px-3 text-red-700 font-semibold">Total Deductions (PF / Tax)</td>
                                        <td className="py-2 px-3 text-right font-mono text-red-700">-{inr(selectedPayslip.deductions)}</td>
                                    </tr>
                                    <tr className="bg-emerald-50/60 font-bold text-sm">
                                        <td className="py-2.5 px-3 text-emerald-900">Net Take-Home Pay</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-emerald-900">{inr(selectedPayslip.netSalary)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                            >
                                <Printer size={14} /> Print / Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HRPayrollPage() {
    return (
        <Suspense fallback={<SkeletonPulse className="h-96 w-full" />}>
            <PayrollContent />
        </Suspense>
    );
}
