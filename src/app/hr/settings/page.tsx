"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, SectionCard } from "@/components/shared/ui";
import { Sliders, Calendar, DollarSign, Clock, ShieldCheck, FileCheck, Bell, Save, Check } from "lucide-react";

export default function HRSettingsPage() {
    const [casualLeave, setCasualLeave] = useState(12);
    const [sickLeave, setSickLeave] = useState(15);
    const [earnedLeave, setEarnedLeave] = useState(10);
    const [graceMins, setGraceMins] = useState(15);
    const [workingHours, setWorkingHours] = useState(8.5);
    const [pfRate, setPfRate] = useState(12);
    const [autoApproveLeaves, setAutoApproveLeaves] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        toast.success("HRMIS Configuration Settings saved successfully.");
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="HRMIS Module Settings & Policies"
                subtitle="Configure organization leave quotas, payroll tax parameters, work shift timings, and approval rules."
                action={
                    <button
                        onClick={handleSave}
                        className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors flex items-center gap-2 shadow-xs"
                    >
                        {saved ? <Check size={16} /> : <Save size={16} />}
                        {saved ? "Saved" : "Save Changes"}
                    </button>
                }
            />

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

                        <div className="flex items-center gap-3 pt-2">
                            <input
                                type="checkbox"
                                id="autoApprove"
                                checked={autoApproveLeaves}
                                onChange={(e) => setAutoApproveLeaves(e.target.checked)}
                                className="w-4 h-4 text-primary rounded border-neutral-300 focus:ring-primary"
                            />
                            <label htmlFor="autoApprove" className="text-xs font-semibold text-neutral-800">
                                Auto-approve 1-day sick leave applications
                            </label>
                        </div>
                    </div>
                </SectionCard>

                {/* Attendance & Shift Config */}
                <SectionCard title="2. Attendance & Shift Rules">
                    <div className="space-y-4">
                        <p className="text-xs text-neutral-500 font-medium">Define standard check-in hours, late arrival thresholds, and daily shift rules.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Standard Work Hours / Day</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={workingHours}
                                    onChange={(e) => setWorkingHours(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Late Grace Period (Mins)</label>
                                <input
                                    type="number"
                                    value={graceMins}
                                    onChange={(e) => setGraceMins(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* Payroll & Tax Config */}
                <SectionCard title="3. Payroll & Statutory Deduction Rules">
                    <div className="space-y-4">
                        <p className="text-xs text-neutral-500 font-medium">Configure Provident Fund (PF), ESI rate calculations, and pay cycle dates.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">PF Deduction Rate (%)</label>
                                <input
                                    type="number"
                                    value={pfRate}
                                    onChange={(e) => setPfRate(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Pay Cycle Closing Date</label>
                                <select className="w-full px-3 py-2 bg-neutral-100 rounded-xl text-sm font-bold border border-neutral-200 focus:outline-none">
                                    <option value="25">25th of every month</option>
                                    <option value="30">Last day of month</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* Workflow & Approvals */}
                <SectionCard title="4. Workflow & Approval Matrix">
                    <div className="space-y-3">
                        <p className="text-xs text-neutral-500 font-medium">Configure approval requirements for leaves, exits, and document verifications.</p>
                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between text-xs font-semibold text-neutral-800">
                            <span>Leave Approvals</span>
                            <span className="text-primary font-bold">Reporting Manager → HR Admin</span>
                        </div>
                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between text-xs font-semibold text-neutral-800">
                            <span>Exit & Clearance</span>
                            <span className="text-primary font-bold">Multi-Department Sign-off</span>
                        </div>
                    </div>
                </SectionCard>
            </div>
        </div>
    );
}
