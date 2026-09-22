"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Users, UserCheck, UserPlus, CalendarOff, CalendarCheck,
    Clock, AlertCircle, Wallet, ArrowRight, CheckCircle2,
    Briefcase, FileText, ChevronRight, ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, StatCard, Badge, SectionCard, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#1B4332", "#2D6A4F", "#40916C", "#52B788", "#74C69D", "#95D5B2", "#B7E4C7"];
const ATT_COLORS: Record<string, string> = {
    present: "#10B981",
    late: "#F59E0B",
    onLeave: "#3B82F6",
    wfh: "#8B5CF6",
    absent: "#EF4444",
};

export default function HrDashboardPage() {
    const { data, isLoading } = useQuery({
        queryKey: ["hr-dashboard"],
        queryFn: async () => {
            const res = await fetch("/api/hr/dashboard");
            if (!res.ok) throw new Error("Failed to load HR Dashboard data");
            return res.json();
        },
        refetchInterval: 30000,
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-64" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-24 rounded-2xl" />
                    ))}
                </div>
                <SkeletonPulse className="h-72 rounded-2xl" />
            </div>
        );
    }

    const { kpis, attendanceToday, departmentBreakdown, genderBreakdown, pipeline, pendingActions, recentEmployees } = data;

    const attendanceData = [
        { name: "Present", count: attendanceToday.present, fill: ATT_COLORS.present },
        { name: "Late", count: attendanceToday.late, fill: ATT_COLORS.late },
        { name: "On Leave", count: attendanceToday.onLeave, fill: ATT_COLORS.onLeave },
        { name: "WFH", count: attendanceToday.wfh, fill: ATT_COLORS.wfh },
        { name: "Absent", count: attendanceToday.absent, fill: ATT_COLORS.absent },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="HRMIS Command Center"
                subtitle="Unified workforce intelligence, attendance, onboarding & lifecycle management"
                action={
                    <div className="flex items-center gap-3">
                        <Link
                            href="/hr/onboarding"
                            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary-dark transition-all"
                        >
                            <UserPlus size={16} /> Onboarding ({kpis.pendingOnboarding})
                        </Link>
                    </div>
                }
            />

            {/* KPI Stat Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                    label="Total Workforce"
                    value={kpis.totalEmployees}
                    icon={Users}
                    tone="primary"
                    hint={`${kpis.activeEmployees} currently active`}
                    href="/hr/employees"
                />
                <StatCard
                    label="Present Today"
                    value={kpis.presentToday}
                    icon={CalendarCheck}
                    tone="emerald"
                    hint={`${kpis.lateToday} arrived late`}
                    href="/hr/attendance"
                />
                <StatCard
                    label="Absent / Leave"
                    value={`${kpis.absentToday} / ${kpis.employeesOnLeave}`}
                    icon={CalendarOff}
                    tone="red"
                    hint={`${kpis.wfhToday} working from home`}
                    href="/hr/leave"
                />
                <StatCard
                    label="Pending Onboarding"
                    value={kpis.pendingOnboarding}
                    icon={UserPlus}
                    tone="blue"
                    hint={`${kpis.newJoiners} joined recently`}
                    href="/hr/onboarding"
                />
                <StatCard
                    label="Payroll Status"
                    value={kpis.payrollStatus}
                    icon={Wallet}
                    tone="purple"
                    hint={kpis.totalPayrollAmount > 0 ? inr(kpis.totalPayrollAmount) : "Pending Cycle"}
                    href="/hr/payroll"
                />
            </div>

            {/* Recruitment to HR Integration Pipeline */}
            <SectionCard
                title="Recruitment → HR Onboarding Pipeline"
                subtitle="Live synchronization between Candidate pipeline & HRMIS employee conversion"
            >
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Selected</span>
                            <Badge value="HR_ROUND" label="HR Round" />
                        </div>
                        <p className="text-2xl font-black text-neutral-900 mt-2">{pipeline.selected}</p>
                        <p className="text-[11px] text-neutral-400 mt-1">Interviews completed</p>
                    </div>

                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Offer Sent</span>
                            <Badge value="OFFER_SENT" label="Offered" />
                        </div>
                        <p className="text-2xl font-black text-neutral-900 mt-2">{pipeline.offerReleased}</p>
                        <p className="text-[11px] text-neutral-400 mt-1">Awaiting decision</p>
                    </div>

                    <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">Accepted</span>
                            <Badge value="OFFER_ACCEPTED" label="Accepted" />
                        </div>
                        <p className="text-2xl font-black text-teal-900 mt-2">{pipeline.offerAccepted}</p>
                        <p className="text-[11px] text-teal-600 mt-1">Ready for onboarding</p>
                    </div>

                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Onboarding</span>
                            <Badge value="ONBOARDING" label="In Progress" />
                        </div>
                        <p className="text-2xl font-black text-blue-900 mt-2">{pipeline.onboarding}</p>
                        <p className="text-[11px] text-blue-600 mt-1">Checklist & verification</p>
                    </div>

                    <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Joined</span>
                            <Badge value="JOINED" label="Converted" />
                        </div>
                        <p className="text-2xl font-black text-emerald-900 mt-2">{pipeline.joined}</p>
                        <p className="text-[11px] text-emerald-600 mt-1">Active HR profile</p>
                    </div>
                </div>
            </SectionCard>

            {/* Attendance & Workforce Distribution Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Attendance Breakdown */}
                <SectionCard
                    title="Today's Attendance Pulse"
                    subtitle="Real-time check-in and presence distribution"
                    className="lg:col-span-1"
                >
                    <div className="flex flex-col items-center justify-center py-2">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={attendanceData}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={3}
                                >
                                    {attendanceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="w-full grid grid-cols-2 gap-2 mt-4 text-xs">
                            {attendanceData.map((item) => (
                                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-neutral-50">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                                        <span className="text-neutral-600 font-medium">{item.name}</span>
                                    </div>
                                    <span className="font-bold text-neutral-900">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>

                {/* Department Distribution Chart */}
                <SectionCard
                    title="Workforce by Department"
                    subtitle="Employee allocation across business units"
                    className="lg:col-span-2"
                >
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={departmentBreakdown}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                            <Bar dataKey="count" fill="#1B4332" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            {/* Pending HR Actions & Quick Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard
                    title="Pending HR Action Queue"
                    subtitle="Requests and approvals requiring human resources attention"
                    className="lg:col-span-2"
                >
                    {pendingActions.length === 0 ? (
                        <div className="py-12 text-center text-neutral-400 text-sm font-medium">
                            <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                            All pending actions are cleared!
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-100">
                            {pendingActions.map((action: any) => (
                                <div key={action.id} className="py-3.5 flex items-center justify-between gap-4 group">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                                            action.type === "LEAVE_APPROVAL" ? "bg-amber-50 text-amber-600"
                                            : action.type === "ONBOARDING_TASK" ? "bg-blue-50 text-blue-600"
                                            : action.type === "DOCUMENT_VERIFICATION" ? "bg-purple-50 text-purple-600"
                                            : "bg-red-50 text-red-600"
                                        }`}>
                                            {action.type === "LEAVE_APPROVAL" && <CalendarOff size={16} />}
                                            {action.type === "ONBOARDING_TASK" && <UserPlus size={16} />}
                                            {action.type === "DOCUMENT_VERIFICATION" && <FileText size={16} />}
                                            {action.type === "EXIT_CLEARANCE" && <ShieldAlert size={16} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-neutral-900 truncate group-hover:text-primary transition-colors">
                                                {action.title}
                                            </p>
                                            <p className="text-xs text-neutral-500 mt-0.5 truncate">
                                                {action.subtitle}
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href={action.link}
                                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-700 hover:bg-primary hover:text-white rounded-lg text-xs font-semibold transition-all"
                                    >
                                        Review <ArrowRight size={13} />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Recently Added Employees */}
                <SectionCard
                    title="Recent Team Additions"
                    subtitle="Latest onboarded personnel"
                    className="lg:col-span-1"
                >
                    <div className="space-y-3">
                        {recentEmployees.map((emp: any) => (
                            <Link
                                key={emp.id}
                                href={`/hr/employees?id=${emp.id}`}
                                className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 transition-colors border border-transparent hover:border-neutral-200"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                                        {emp.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-neutral-900">{emp.name}</p>
                                        <p className="text-[11px] text-neutral-400">{emp.designation}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono text-neutral-400">{emp.employeeId}</span>
                            </Link>
                        ))}
                    </div>
                </SectionCard>
            </div>
        </div>
    );
}
