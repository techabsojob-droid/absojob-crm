"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    UserPlus, CheckCircle2, Clock, FileCheck, ArrowRight,
    UserCheck, ChevronRight, AlertCircle, Building2, Calendar,
    Shield, Briefcase, Phone, Mail, MapPin, Sparkles,
} from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { toast } from "sonner";
import Link from "next/link";

export default function HrOnboardingPage() {
    const queryClient = useQueryClient();
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [convertModalOpen, setConvertModalOpen] = useState(false);
    
    // Form state for employee creation
    const [joiningDate, setJoiningDate] = useState("");
    const [department, setDepartment] = useState("");
    const [designation, setDesignation] = useState("");
    const [monthlySalary, setMonthlySalary] = useState(65000);

    const { data: onboardingList, isLoading } = useQuery({
        queryKey: ["hr-onboarding", statusFilter],
        queryFn: async () => {
            const url = statusFilter === "ALL" ? "/api/hr/onboarding" : `/api/hr/onboarding?status=${statusFilter}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to load onboarding records");
            return res.json();
        },
    });

    const toggleChecklistMutation = useMutation({
        mutationFn: async ({ id, itemId, completed }: { id: string; itemId: string; completed: boolean }) => {
            const res = await fetch("/api/hr/onboarding", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, checklistItemId: itemId, completed }),
            });
            if (!res.ok) throw new Error("Failed to update checklist");
            return res.json();
        },
        onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
            queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
            if (selectedRecord && selectedRecord.id === updated.id) {
                setSelectedRecord(updated);
            }
            toast.success("Checklist progress updated");
        },
    });

    const convertToEmployeeMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/hr/onboarding", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedRecord.id,
                    createEmployee: true,
                    joiningDate,
                    department: department || selectedRecord.department,
                    designation: designation || selectedRecord.position,
                    salaryMonthly: monthlySalary,
                }),
            });
            if (!res.ok) throw new Error("Failed to create employee profile");
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
            queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
            setConvertModalOpen(false);
            setSelectedRecord(null);
            toast.success(`Employee ${data.employee.employeeId} created successfully!`);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to convert to employee");
        },
    });

    const openConvertModal = (record: any) => {
        setSelectedRecord(record);
        setJoiningDate(record.expectedJoiningDate || new Date().toISOString().split("T")[0]);
        setDepartment(record.department);
        setDesignation(record.position);
        setConvertModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SkeletonPulse className="h-24 rounded-2xl" />
                    <SkeletonPulse className="h-24 rounded-2xl" />
                    <SkeletonPulse className="h-24 rounded-2xl" />
                </div>
                <SkeletonPulse className="h-80 rounded-2xl" />
            </div>
        );
    }

    const inProgressCount = onboardingList?.filter((o: any) => o.status === "IN_PROGRESS").length || 0;
    const pendingCount = onboardingList?.filter((o: any) => o.status === "PENDING").length || 0;
    const completedCount = onboardingList?.filter((o: any) => o.status === "COMPLETED").length || 0;

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Employee Onboarding & Conversion"
                subtitle="Transform selected recruitment candidates into active organizational employees"
            />

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    label="In-Flight Onboarding"
                    value={inProgressCount}
                    icon={Clock}
                    tone="primary"
                    hint="Checklists in active review"
                />
                <StatCard
                    label="Pending Formalities"
                    value={pendingCount}
                    icon={AlertCircle}
                    tone="amber"
                    hint="Awaiting initial doc submission"
                />
                <StatCard
                    label="Successfully Onboarded"
                    value={completedCount}
                    icon={UserCheck}
                    tone="emerald"
                    hint="Converted to full employee profiles"
                />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
                {[
                    { id: "ALL", label: `All (${onboardingList?.length || 0})` },
                    { id: "IN_PROGRESS", label: `In Progress (${inProgressCount})` },
                    { id: "PENDING", label: `Pending Docs (${pendingCount})` },
                    { id: "COMPLETED", label: `Converted (${completedCount})` },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            statusFilter === tab.id
                                ? "bg-primary text-white shadow-sm"
                                : "text-neutral-500 hover:bg-neutral-100"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Onboarding Records Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {onboardingList?.map((record: any) => (
                    <div
                        key={record.id}
                        className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg text-neutral-900">{record.candidateName}</h3>
                                        <Badge value={record.status} />
                                    </div>
                                    <p className="text-xs font-semibold text-primary mt-1">
                                        {record.position} · <span className="text-neutral-500 font-normal">{record.department}</span>
                                    </p>
                                </div>

                                <div className="text-right shrink-0">
                                    <span className="text-xs font-bold text-neutral-900">{record.progressPercent}%</span>
                                    <p className="text-[10px] text-neutral-400">Completed</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-neutral-100 rounded-full h-2 mt-4 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        record.progressPercent === 100 ? "bg-emerald-500" : "bg-primary"
                                    }`}
                                    style={{ width: `${record.progressPercent}%` }}
                                />
                            </div>

                            {/* Info Details */}
                            <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-neutral-100 text-xs text-neutral-600">
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-neutral-400" />
                                    <span className="truncate">{record.candidateEmail}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-neutral-400" />
                                    <span>{record.candidatePhone}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-neutral-400" />
                                    <span>Join: <strong className="text-neutral-800">{record.expectedJoiningDate}</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-neutral-400" />
                                    <span>{record.candidateLocation}</span>
                                </div>
                            </div>

                            {/* Checklist Snapshot */}
                            <div className="mt-5 space-y-2">
                                <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                                    Checklist Progress ({record.checklist.filter((c: any) => c.completed).length} / {record.checklist.length})
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                                    {record.checklist.map((item: any) => (
                                        <label
                                            key={item.id}
                                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-neutral-50 cursor-pointer text-xs"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={item.completed}
                                                disabled={record.status === "COMPLETED"}
                                                onChange={(e) =>
                                                    toggleChecklistMutation.mutate({
                                                        id: record.id,
                                                        itemId: item.id,
                                                        completed: e.target.checked,
                                                    })
                                                }
                                                className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                                            />
                                            <span className={item.completed ? "text-neutral-400 line-through truncate" : "text-neutral-700 truncate"}>
                                                {item.title}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between">
                            {record.status === "COMPLETED" ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                                    <CheckCircle2 size={15} /> Active Employee Created
                                </span>
                            ) : (
                                <button
                                    onClick={() => openConvertModal(record)}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary-dark transition-all"
                                >
                                    <Sparkles size={14} /> Create Employee Profile
                                </button>
                            )}

                            {record.createdEmployeeId && (
                                <Link
                                    href={`/hr/employees?id=${record.createdEmployeeId}`}
                                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                >
                                    View Employee Profile <ChevronRight size={14} />
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Convert to Employee Modal */}
            <ModalShell
                open={convertModalOpen}
                onClose={() => setConvertModalOpen(false)}
                title="Convert Candidate to Employee"
                wide
            >
                {selectedRecord && (
                    <div className="space-y-6">
                        <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80">
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Candidate Identity Verified</p>
                            <h4 className="font-extrabold text-neutral-900 text-lg">{selectedRecord.candidateName}</h4>
                            <p className="text-xs text-neutral-500 mt-0.5">{selectedRecord.candidateEmail} · {selectedRecord.candidatePhone}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-600 mb-1.5">Official Designation</label>
                                <input
                                    type="text"
                                    value={designation}
                                    onChange={(e) => setDesignation(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-neutral-600 mb-1.5">Department</label>
                                <select
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                                >
                                    {["Engineering", "Human Resources", "Talent Acquisition", "Operations", "Finance", "Sales", "Marketing"].map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-neutral-600 mb-1.5">Joining Date</label>
                                <input
                                    type="date"
                                    value={joiningDate}
                                    onChange={(e) => setJoiningDate(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-neutral-600 mb-1.5">Monthly Net Compensation (INR)</label>
                                <input
                                    type="number"
                                    value={monthlySalary}
                                    onChange={(e) => setMonthlySalary(Number(e.target.value))}
                                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                                />
                                <p className="text-[10px] text-neutral-400 mt-1">Approx CTC: {inr(monthlySalary * 12)} / annum</p>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl text-xs text-amber-800">
                            <strong>Note:</strong> Creating this employee will assign a unique company ID, provision the central HRMIS profile, mark the recruitment candidate as &quot;Joined&quot;, and initiate attendance/payroll schedules.
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setConvertModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => convertToEmployeeMutation.mutate({})}
                                disabled={convertToEmployeeMutation.isPending}
                                className="px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary-dark transition-all flex items-center gap-2"
                            >
                                {convertToEmployeeMutation.isPending ? "Provisioning..." : "Confirm & Create Employee"}
                            </button>
                        </div>
                    </div>
                )}
            </ModalShell>
        </div>
    );
}
