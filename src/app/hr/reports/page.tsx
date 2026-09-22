"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard, SectionCard } from "@/components/shared/ui";
import { BarChart3, FileSpreadsheet, Users, Calendar, DollarSign, Award, Laptop, LogOut, Download, FileText, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";

interface ReportDef {
    id: string;
    title: string;
    description: string;
    category: "Workforce" | "Payroll" | "Compliance" | "Operations";
    icon: any;
    format: "CSV" | "PDF" | "XLSX";
    lastGenerated: string;
}

export default function HRReportsPage() {
    const [generatingId, setGeneratingId] = useState<string | null>(null);

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
            icon: FileText,
            format: "PDF",
            lastGenerated: "3 days ago",
        },
        {
            id: "rpt-5",
            title: "Performance Appraisal Summary",
            description: "Goals completion percentages, performance review ratings, manager feedback, and promotion logs.",
            category: "Operations",
            icon: Award,
            format: "PDF",
            lastGenerated: "Sep 15, 2026",
        },
        {
            id: "rpt-6",
            title: "Asset Allocation & Audit",
            description: "Laptops, monitors, serial tags, condition reports, and active hardware assignments per employee.",
            category: "Compliance",
            icon: Laptop,
            format: "CSV",
            lastGenerated: "1 week ago",
        },
        {
            id: "rpt-7",
            title: "Exit & Attrition Analysis",
            description: "Resignation reasons, notice period completions, clearance statuses, and full & final (F&F) audit.",
            category: "Operations",
            icon: LogOut,
            format: "XLSX",
            lastGenerated: "Aug 28, 2026",
        },
        {
            id: "rpt-8",
            title: "Document Verification Audit",
            description: "KYC documents, PAN/Aadhaar compliance status, offer letter records, and expiry alerts.",
            category: "Compliance",
            icon: ShieldCheck,
            format: "CSV",
            lastGenerated: "2 weeks ago",
        },
    ];

    const handleDownload = (rpt: ReportDef) => {
        setGeneratingId(rpt.id);
        toast.info(`Generating ${rpt.title}...`);
        setTimeout(() => {
            setGeneratingId(null);
            toast.success(`${rpt.title} (${rpt.format}) generated successfully! Download started.`);
        }, 1200);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="HR Reports & Workforce Analytics"
                subtitle="Generate exportable reporting sheets for payroll, headcount, compliance audits, and leave registers."
            />

            {/* Overview KPI Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Available Report Templates" value={reports.length} icon={FileSpreadsheet} tone="primary" hint="Pre-configured export formats" />
                <StatCard label="Automated Export Jobs" value={4} icon={Sparkles} tone="emerald" hint="Scheduled monthly exports" />
                <StatCard label="Compliance Audits" value="100%" icon={ShieldCheck} tone="blue" hint="All documents verified" />
                <StatCard label="Data Freshness" value="Real-time" icon={BarChart3} tone="purple" hint="Live database sync" />
            </div>

            {/* Report Catalog Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reports.map((rpt) => {
                    const IconComp = rpt.icon;
                    return (
                        <div key={rpt.id} className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-6 flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                        <IconComp size={20} />
                                    </div>
                                    <span className="text-xs font-bold text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-lg">
                                        Format: {rpt.format}
                                    </span>
                                </div>

                                <div>
                                    <h3 className="font-bold text-neutral-900 text-lg">{rpt.title}</h3>
                                    <p className="text-xs text-neutral-500 font-medium mt-1 leading-relaxed">{rpt.description}</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                                <span className="text-[11px] text-neutral-400 font-medium">Last export: {rpt.lastGenerated}</span>
                                <button
                                    onClick={() => handleDownload(rpt)}
                                    disabled={generatingId === rpt.id}
                                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                                >
                                    {generatingId === rpt.id ? (
                                        <>Generating...</>
                                    ) : (
                                        <>
                                            <Download size={14} /> Export Report
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
