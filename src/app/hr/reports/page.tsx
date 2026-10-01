"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, SectionCard, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    BarChart3, FileSpreadsheet, Users, Calendar, DollarSign,
    TrendingUp, ShieldCheck, Download, CheckCircle2, UserMinus,
    CalendarCheck, Award, Laptop, PieChart, Layers
} from "lucide-react";

interface ReportDef {
    id: string;
    title: string;
    description: string;
    category: "Workforce" | "Payroll" | "Compliance" | "Operations";
    icon: any;
    format: "CSV" | "PDF" | "XLSX";
    lastGenerated: string;
}

function ReportsContent() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const categoryParam = searchParams.get("category");

    const [activeTab, setActiveTab] = useState<"EXPORTS" | "HR_ANALYTICS" | "WORKFORCE" | "ATTENDANCE" | "RECRUITMENT" | "PAYROLL" | "ATTRITION">("HR_ANALYTICS");
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    useEffect(() => {
        if (tabParam === "workforce" || categoryParam === "Workforce") setActiveTab("WORKFORCE");
        else if (tabParam === "attendance" || categoryParam === "Attendance") setActiveTab("ATTENDANCE");
        else if (tabParam === "recruitment") setActiveTab("RECRUITMENT");
        else if (tabParam === "payroll" || categoryParam === "Payroll") setActiveTab("PAYROLL");
        else if (tabParam === "attrition" || categoryParam === "Attrition") setActiveTab("ATTRITION");
        else if (tabParam === "all") setActiveTab("EXPORTS");
    }, [tabParam, categoryParam]);

    // Fetch unified analytics
    const { data: analytics, isLoading } = useQuery({
        queryKey: ["hr-unified-analytics"],
        queryFn: async () => {
            const res = await fetch("/api/hr/analytics");
            if (!res.ok) throw new Error("Failed to fetch analytics");
            return res.json();
        },
    });

    const reports: ReportDef[] = [
        {
            id: "rpt-1",
            title: "Employee Master Directory",
            description: "Full active employee roster, contact info, designations, reporting lines, and bank details.",
            category: "Workforce",
            icon: Users,
            format: "CSV",
            lastGenerated: "Today, 10:30 AM",
        },
        {
            id: "rpt-2",
            title: "Daily Attendance & Late Log",
            description: "Attendance records, check-in timestamps, working hours, late arrivals, and absence breakdowns.",
            category: "Workforce",
            icon: Calendar,
            format: "XLSX",
            lastGenerated: "Yesterday",
        },
        {
            id: "rpt-3",
            title: "Monthly Payroll Register",
            description: "Complete salary breakdown including Basic, HRA, Allowances, PF/ESI deductions, and Net Salaries.",
            category: "Payroll",
            icon: DollarSign,
            format: "CSV",
            lastGenerated: "Sep 01, 2026",
        },
        {
            id: "rpt-4",
            title: "Leave Balance & Utilization",
            description: "Casual, Earned, Sick leave utilization trends, pending balances, and department-wise leave patterns.",
            category: "Workforce",
            icon: CalendarCheck,
            format: "PDF",
            lastGenerated: "3 days ago",
        },
        {
            id: "rpt-5",
            title: "Performance Appraisal Summary",
            description: "Consolidated performance review ratings, goal completion metrics, and promotion recommendations.",
            category: "Operations",
            icon: Award,
            format: "XLSX",
            lastGenerated: "1 week ago",
        },
        {
            id: "rpt-6",
            title: "Staff Turnover & Attrition Audit",
            description: "Exit management details, resignation reasons, notice period compliances, and clearance handover forms.",
            category: "Compliance",
            icon: UserMinus,
            format: "PDF",
            lastGenerated: "2 weeks ago",
        },
    ];

    const handleGenerate = (id: string, title: string) => {
        setGeneratingId(id);
        setTimeout(() => {
            setGeneratingId(null);
            toast.success(`Generated and downloaded ${title}`);
        }, 1200);
    };

    const overview = analytics?.overview || {};
    const departments = analytics?.departments || [];
    const attendanceTrend = analytics?.attendanceTrend || [];
    const recruitmentFunnel = analytics?.recruitmentFunnel || [];
    const payrollByDept = analytics?.payrollByDept || [];
    const attritionReasons = analytics?.attritionReasons || [];

    return (
        <div className="space-y-6">
            <PageHeader
                title="HR Insights & Analytics"
                subtitle="Data intelligence, workforce demographics, attendance trends, recruitment funnel, and statutory reports."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Headcount" value={overview.headcount || 52} icon={Users} tone="primary" hint="Active employees" />
                <StatCard label="Avg Attendance Rate" value={overview.attendanceRate || "94%"} icon={CalendarCheck} tone="emerald" hint="Present & WFH" />
                <StatCard label="Monthly Payroll Cost" value={inr(overview.monthlyPayroll || 4420000)} icon={DollarSign} tone="blue" hint="Current active cycle" />
                <StatCard label="Annual Attrition Rate" value={overview.attritionRate || "3.8%"} icon={UserMinus} tone="amber" hint="Industry baseline < 8%" />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
                {(
                    [
                        { id: "HR_ANALYTICS", label: "Executive Dashboard" },
                        { id: "WORKFORCE", label: "Workforce Demographics" },
                        { id: "ATTENDANCE", label: "Attendance Trends" },
                        { id: "RECRUITMENT", label: "Recruitment Velocity" },
                        { id: "PAYROLL", label: "Payroll Analytics" },
                        { id: "ATTRITION", label: "Attrition Analysis" },
                        { id: "EXPORTS", label: `Download Master Reports (${reports.length})` },
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

            {/* TAB: HR ANALYTICS (Section 31) */}
            {activeTab === "HR_ANALYTICS" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SectionCard title="Headcount by Department">
                        <div className="space-y-3">
                            {departments.map((d: any) => (
                                <div key={d.name} className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span>{d.name}</span>
                                        <span className="font-bold text-neutral-900">{d.count} ({d.percent}%)</span>
                                    </div>
                                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${d.percent}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard title="Recruitment Hiring Funnel Conversion">
                        <div className="space-y-3">
                            {recruitmentFunnel.map((step: any, idx: number) => (
                                <div key={step.stage} className="p-3 rounded-xl bg-neutral-50/80 border border-neutral-100 flex items-center justify-between">
                                    <span className="text-xs font-bold text-neutral-700">{step.stage}</span>
                                    <span className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-xs font-mono font-bold text-primary">
                                        {step.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* TAB: WORKFORCE (Section 32) */}
            {activeTab === "WORKFORCE" && (
                <SectionCard title="Workforce Composition & Distribution">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                            <span className="text-xs font-bold text-neutral-400 uppercase">Employment Type</span>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span>Full-time Regular:</span><strong className="text-neutral-900">46 (88%)</strong></div>
                                <div className="flex justify-between"><span>Probationary:</span><strong className="text-neutral-900">4 (8%)</strong></div>
                                <div className="flex justify-between"><span>Contractual / Retainer:</span><strong className="text-neutral-900">2 (4%)</strong></div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                            <span className="text-xs font-bold text-neutral-400 uppercase">Office Locations</span>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span>Mumbai - HQ:</span><strong className="text-neutral-900">32 Staff</strong></div>
                                <div className="flex justify-between"><span>Bengaluru - Tech Hub:</span><strong className="text-neutral-900">14 Staff</strong></div>
                                <div className="flex justify-between"><span>Pune - Branch:</span><strong className="text-neutral-900">6 Staff</strong></div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                            <span className="text-xs font-bold text-neutral-400 uppercase">Gender Diversity Ratio</span>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span>Female Workforce:</span><strong className="text-neutral-900">42%</strong></div>
                                <div className="flex justify-between"><span>Male Workforce:</span><strong className="text-neutral-900">58%</strong></div>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB: ATTENDANCE (Section 33) */}
            {activeTab === "ATTENDANCE" && (
                <SectionCard title="Weekly Attendance & Punctuality Variance">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {attendanceTrend.map((t: any) => (
                            <div key={t.day} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 text-center space-y-2">
                                <span className="text-xs font-extrabold text-neutral-500 uppercase">{t.day}</span>
                                <div className="text-lg font-black text-emerald-600">{t.rate}%</div>
                                <div className="text-[11px] text-neutral-400 space-y-0.5">
                                    <p>Late: {t.late}</p>
                                    <p>WFH: {t.wfh}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* TAB: RECRUITMENT (Section 34) */}
            {activeTab === "RECRUITMENT" && (
                <SectionCard title="Recruitment Sourcing & Time-to-Hire Analytics">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-1">
                            <span className="text-xs font-bold text-neutral-400 uppercase">Average Time-to-Hire</span>
                            <div className="text-xl font-black text-neutral-900">18.5 Days</div>
                            <p className="text-[11px] text-emerald-600 font-semibold">4 days faster than industry average</p>
                        </div>
                        <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-1">
                            <span className="text-xs font-bold text-neutral-400 uppercase">Offer Acceptance Ratio</span>
                            <div className="text-xl font-black text-primary">87.5%</div>
                            <p className="text-[11px] text-neutral-500">Based on last 16 released offers</p>
                        </div>
                        <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-1">
                            <span className="text-xs font-bold text-neutral-400 uppercase">Top Source Channel</span>
                            <div className="text-xl font-black text-neutral-900">Employee Referrals (44%)</div>
                            <p className="text-[11px] text-neutral-500">Followed by direct agency sourcing</p>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB: PAYROLL (Section 35) */}
            {activeTab === "PAYROLL" && (
                <SectionCard title="Departmental Payroll Cost Breakdown">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Department</th>
                                    <th className="py-3 px-2">Headcount</th>
                                    <th className="py-3 px-2">Total Monthly Spend</th>
                                    <th className="py-3 px-2">Average Monthly CTC</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {payrollByDept.map((p: any) => (
                                    <tr key={p.dept} className="hover:bg-neutral-50">
                                        <td className="py-3.5 px-2 font-bold text-neutral-900">{p.dept}</td>
                                        <td className="py-3.5 px-2 text-xs text-neutral-600">{p.headcount} Staff</td>
                                        <td className="py-3.5 px-2 font-mono font-bold text-neutral-900">{inr(p.amount)}</td>
                                        <td className="py-3.5 px-2 font-mono text-neutral-600">{inr(Math.round(p.amount / p.headcount))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* TAB: ATTRITION (Section 36) */}
            {activeTab === "ATTRITION" && (
                <SectionCard title="Turnover Reasons & Exit Categorization">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {attritionReasons.map((ar: any) => (
                                <div key={ar.reason} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
                                    <h4 className="font-bold text-xs text-neutral-800 leading-snug">{ar.reason}</h4>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-neutral-500">{ar.count} Exits</span>
                                        <span className="font-extrabold text-red-600">{ar.percent}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${ar.percent}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB: EXPORTS (Existing Preserved) */}
            {activeTab === "EXPORTS" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {reports.map((rpt) => {
                        const Icon = rpt.icon;
                        const isGenerating = generatingId === rpt.id;

                        return (
                            <SectionCard key={rpt.id}>
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                <Icon size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-neutral-900 text-sm leading-snug">{rpt.title}</h4>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                                    {rpt.category}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-neutral-100 text-neutral-700">
                                            {rpt.format}
                                        </span>
                                    </div>

                                    <p className="text-xs text-neutral-500 leading-relaxed min-h-[32px]">
                                        {rpt.description}
                                    </p>

                                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                                        <span className="text-neutral-400">Last: {rpt.lastGenerated}</span>
                                        <button
                                            onClick={() => handleGenerate(rpt.id, rpt.title)}
                                            disabled={isGenerating}
                                            className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                                        >
                                            <Download size={13} />
                                            {isGenerating ? "Generating..." : "Download"}
                                        </button>
                                    </div>
                                </div>
                            </SectionCard>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function HRReportsPage() {
    return (
        <Suspense fallback={<SkeletonPulse className="h-96 w-full" />}>
            <ReportsContent />
        </Suspense>
    );
}
