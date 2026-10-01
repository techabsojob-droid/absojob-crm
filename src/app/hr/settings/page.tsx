"use client";
import { useQuery } from "@tanstack/react-query";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader, SectionCard, Badge } from "@/components/shared/ui";
import {
    Sliders, Calendar, DollarSign, Clock, ShieldCheck, FileCheck,
    Bell, Save, Check, Zap, BookOpen, SlidersHorizontal, KeyRound,
    Plus, Lock, CheckCircle2, X
} from "lucide-react";


function useHrReference() {
    return useQuery<Record<string, any[]>>({
        queryKey: ["hr-reference", "workflows,hrPolicies"],
        queryFn: async () => (await fetch("/api/hr/reference?keys=workflows,hrPolicies")).json(),
        staleTime: 60_000,
    });
}

function SettingsContent() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");

    const [activeTab, setActiveTab] = useState<"GENERAL" | "AUTOMATION" | "POLICIES" | "CUSTOM_FIELDS" | "ROLES">("GENERAL");

    // General config state
    const [casualLeave, setCasualLeave] = useState(12);
    const [sickLeave, setSickLeave] = useState(15);
    const [earnedLeave, setEarnedLeave] = useState(10);
    const [graceMins, setGraceMins] = useState(15);
    const [workingHours, setWorkingHours] = useState(8.5);
    const [pfRate, setPfRate] = useState(12);
    const [autoApproveLeaves, setAutoApproveLeaves] = useState(false);
    const [saved, setSaved] = useState(false);

    // Workflows state
    const { data: ref } = useHrReference();
    const mockHrPolicies: any[] = ref?.hrPolicies ?? [];
    // Local edits override the server list until the page reloads
    const [workflowListOverride, setWorkflowListRaw] = useState<any[] | null>(null);
    const workflowList: any[] = workflowListOverride ?? ref?.workflows ?? [];
    const setWorkflowList = (fn: (prev: any[]) => any[]) => setWorkflowListRaw(fn(workflowList));

    useEffect(() => {
        if (tabParam === "automation") setActiveTab("AUTOMATION");
        else if (tabParam === "policies") setActiveTab("POLICIES");
        else if (tabParam === "custom-fields") setActiveTab("CUSTOM_FIELDS");
        else if (tabParam === "roles") setActiveTab("ROLES");
    }, [tabParam]);

    const handleSave = () => {
        setSaved(true);
        toast.success("HRMIS Configuration Settings saved successfully.");
        setTimeout(() => setSaved(false), 2000);
    };

    const toggleWorkflow = (id: string) => {
        setWorkflowList((prev) =>
            prev.map((w) => (w.id === id ? { ...w, active: !w.active } : w))
        );
        toast.success("Workflow rule state updated");
    };

    // Custom fields mock
    const customFields = [
        { id: "cf-1", module: "EMPLOYEE", label: "Emergency Contact Blood Group", type: "DROPDOWN", required: true },
        { id: "cf-2", module: "EMPLOYEE", label: "Prior PF Universal Account Number (UAN)", type: "TEXT", required: false },
        { id: "cf-3", module: "ONBOARDING", label: "Laptop Asset Serial Number", type: "TEXT", required: true },
        { id: "cf-4", module: "PERFORMANCE", label: "Special Mentorship Assignment", type: "TEXT", required: false },
    ];

    // RBAC Matrix
    const rbacModules = [
        { module: "Employees", superAdmin: "FULL", hrAdmin: "FULL", hrManager: "VIEW / EDIT", recruiter: "VIEW", employee: "SELF ONLY" },
        { module: "Attendance", superAdmin: "FULL", hrAdmin: "FULL", hrManager: "APPROVE / VIEW", recruiter: "SELF ONLY", employee: "PUNCH / REQUEST" },
        { module: "Leave", superAdmin: "FULL", hrAdmin: "FULL", hrManager: "APPROVE", recruiter: "SELF ONLY", employee: "APPLY / VIEW" },
        { module: "Payroll & Salary", superAdmin: "FULL", hrAdmin: "FULL", hrManager: "NO ACCESS", recruiter: "NO ACCESS", employee: "VIEW PAYSLIP" },
        { module: "Performance", superAdmin: "FULL", hrAdmin: "FULL", hrManager: "REVIEW / RATING", recruiter: "SELF REVIEW", employee: "SELF REVIEW" },
        { module: "Approvals", superAdmin: "FULL", hrAdmin: "FULL", hrManager: "TEAM ONLY", recruiter: "NO ACCESS", employee: "NO ACCESS" },
        { module: "Settings & Policies", superAdmin: "FULL", hrAdmin: "FULL", hrManager: "VIEW ONLY", recruiter: "NO ACCESS", employee: "VIEW ONLY" },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="HRMIS Administration & Governance"
                subtitle="Configure enterprise leave quotas, payroll tax parameters, automated workflows, custom fields, and RBAC matrix."
                action={
                    activeTab === "GENERAL" && (
                        <button
                            onClick={handleSave}
                            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors flex items-center gap-2 shadow-xs"
                        >
                            {saved ? <Check size={16} /> : <Save size={16} />}
                            {saved ? "Saved" : "Save Changes"}
                        </button>
                    )
                }
            />

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
                {(
                    [
                        { id: "GENERAL", label: "Policy Parameters" },
                        { id: "AUTOMATION", label: `Workflow Automation (${workflowList.length})` },
                        { id: "POLICIES", label: `Published Policies (${mockHrPolicies.length})` },
                        { id: "CUSTOM_FIELDS", label: `Custom Fields (${customFields.length})` },
                        { id: "ROLES", label: "Roles & Permissions (RBAC)" },
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

            {/* TAB 1: GENERAL POLICY CONFIG (Existing Preserved) */}
            {activeTab === "GENERAL" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Leave Policy Config */}
                    <SectionCard title="1. Annual Leave Policy & Quotas">
                        <div className="space-y-4">
                            <p className="text-xs text-neutral-500 font-medium">Set default annual leave balances allocated to full-time employees upon joining.</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Casual Leave</label>
                                    <input
                                        type="number"
                                        value={casualLeave}
                                        onChange={(e) => setCasualLeave(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Sick Leave</label>
                                    <input
                                        type="number"
                                        value={sickLeave}
                                        onChange={(e) => setSickLeave(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Earned Leave</label>
                                    <input
                                        type="number"
                                        value={earnedLeave}
                                        onChange={(e) => setEarnedLeave(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                                <div>
                                    <p className="text-xs font-bold text-neutral-800">Auto-Approve Casual Leaves (&le; 1 Day)</p>
                                    <p className="text-[11px] text-neutral-500">Automatically sanction single-day casual leave if balance is available.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={autoApproveLeaves}
                                    onChange={(e) => setAutoApproveLeaves(e.target.checked)}
                                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* Attendance Rules */}
                    <SectionCard title="2. Attendance Timings & Grace Period">
                        <div className="space-y-4">
                            <p className="text-xs text-neutral-500 font-medium">Standard daily schedule parameters applied to office and remote shifts.</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Grace Period (Minutes)</label>
                                    <input
                                        type="number"
                                        value={graceMins}
                                        onChange={(e) => setGraceMins(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Daily Work Hours</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={workingHours}
                                        onChange={(e) => setWorkingHours(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Payroll Tax Config */}
                    <SectionCard title="3. Statutory Provident Fund & Tax Parameters">
                        <div className="space-y-4">
                            <p className="text-xs text-neutral-500 font-medium">Statutory employer and employee deduction percentages for monthly payroll runs.</p>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Employee PF Contribution Rate (%)</label>
                                <input
                                    type="number"
                                    value={pfRate}
                                    onChange={(e) => setPfRate(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* TAB 2: WORKFLOW AUTOMATION (Section 38) */}
            {activeTab === "AUTOMATION" && (
                <SectionCard title="Trigger & Condition Workflow Automation Engine">
                    <div className="space-y-4">
                        <p className="text-xs text-neutral-500">
                            Configure event-driven automation rules: Trigger ➔ Condition Evaluation ➔ Required Approval Role ➔ Execution Action.
                        </p>
                        <div className="space-y-3">
                            {workflowList.map((w) => (
                                <div key={w.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Zap size={15} className={w.active ? "text-amber-500" : "text-neutral-400"} />
                                            <h4 className="font-bold text-sm text-neutral-900">{w.name}</h4>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px]">
                                                {w.trigger}
                                            </span>
                                            <span className="text-neutral-400">➔</span>
                                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[10px]">
                                                {w.condition}
                                            </span>
                                            <span className="text-neutral-400">➔</span>
                                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                                                {w.action}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-semibold text-neutral-500">
                                            {w.active ? "Active" : "Disabled"}
                                        </span>
                                        <button
                                            onClick={() => toggleWorkflow(w.id)}
                                            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                                                w.active ? "bg-primary" : "bg-neutral-300"
                                            }`}
                                        >
                                            <div
                                                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                                    w.active ? "translate-x-5" : "translate-x-0"
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB 3: HR POLICIES LIBRARY (Section 39) */}
            {activeTab === "POLICIES" && (
                <SectionCard title="Organization Policy Library & Documents">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {mockHrPolicies.map((p) => (
                                <div key={p.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-primary/10 text-primary">
                                            {p.category}
                                        </span>
                                        <Badge value={p.status} />
                                    </div>
                                    <h4 className="font-bold text-sm text-neutral-900 leading-snug">{p.title}</h4>
                                    <p className="text-xs text-neutral-500 line-clamp-2">{p.summary}</p>
                                    <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-400 flex items-center justify-between">
                                        <span>Version: {p.version}</span>
                                        <span>{p.acknowledgementCount} Staff Acknowledged</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB 4: CUSTOM FIELDS (Section 40) */}
            {activeTab === "CUSTOM_FIELDS" && (
                <SectionCard title="Configurable Organization Custom Fields">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Field Label</th>
                                    <th className="py-3 px-2">Module Scope</th>
                                    <th className="py-3 px-2">Data Type</th>
                                    <th className="py-3 px-2">Mandatory</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {customFields.map((cf) => (
                                    <tr key={cf.id} className="hover:bg-neutral-50">
                                        <td className="py-3 px-2 font-bold text-neutral-900">{cf.label}</td>
                                        <td className="py-3 px-2">
                                            <span className="px-2 py-0.5 text-xs font-bold rounded bg-neutral-100 text-neutral-700">
                                                {cf.module}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 font-mono text-xs text-neutral-600">{cf.type}</td>
                                        <td className="py-3 px-2">
                                            {cf.required ? (
                                                <span className="text-xs font-bold text-red-600">Yes</span>
                                            ) : (
                                                <span className="text-xs text-neutral-400">Optional</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* TAB 5: ROLES & PERMISSIONS (Section 41) */}
            {activeTab === "ROLES" && (
                <SectionCard title="Enterprise Role-Based Access Control (RBAC) Matrix">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-neutral-200 uppercase font-bold text-neutral-400">
                                    <th className="py-3 px-2">Module</th>
                                    <th className="py-3 px-2">Super Admin</th>
                                    <th className="py-3 px-2">HR Admin</th>
                                    <th className="py-3 px-2">HR Manager</th>
                                    <th className="py-3 px-2">TA Recruiter</th>
                                    <th className="py-3 px-2">Employee</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 font-medium">
                                {rbacModules.map((m) => (
                                    <tr key={m.module} className="hover:bg-neutral-50">
                                        <td className="py-3 px-2 font-bold text-neutral-900">{m.module}</td>
                                        <td className="py-3 px-2 font-bold text-emerald-700">{m.superAdmin}</td>
                                        <td className="py-3 px-2 font-bold text-emerald-700">{m.hrAdmin}</td>
                                        <td className="py-3 px-2 text-neutral-700">{m.hrManager}</td>
                                        <td className="py-3 px-2 text-neutral-600">{m.recruiter}</td>
                                        <td className="py-3 px-2 text-neutral-500">{m.employee}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}
        </div>
    );
}

export default function HRSettingsPage() {
    return (
        <Suspense fallback={<div className="h-96 w-full animate-pulse bg-slate-100 rounded-xl" />}>
            <SettingsContent />
        </Suspense>
    );
}
