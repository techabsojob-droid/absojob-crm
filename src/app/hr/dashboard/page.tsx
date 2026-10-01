"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Users, UserCheck, UserPlus, CalendarOff, CalendarCheck,
    Clock, AlertCircle, Wallet, ArrowRight, CheckCircle2,
    Briefcase, FileText, ChevronRight, ShieldAlert, Filter,
    RefreshCw, Sparkles, TrendingUp, AlertTriangle, Building2,
    MapPin, Calendar, Award, CheckSquare, Search, Eye, Phone,
    Mail, DollarSign, Laptop, ExternalLink, X, HeartHandshake,
    ShieldCheck, ArrowUpRight, BarChart3, HelpCircle, UserX,
    FileSpreadsheet, Activity
} from "lucide-react";
import Link from "next/link";
import { PageHeader, StatCard, Badge, SectionCard, inr, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
    LineChart, Line, AreaChart, Area
} from "recharts";

const ATT_COLORS: Record<string, string> = {
    present: "#10B981",
    late: "#F59E0B",
    onLeave: "#3B82F6",
    wfh: "#8B5CF6",
    absent: "#EF4444",
    halfDay: "#EC4899",
};

export default function HrDashboardPage() {
    // Global Dashboard Controls
    const [dateRange, setDateRange] = useState("today");
    const [selectedDept, setSelectedDept] = useState("ALL");
    const [selectedLocation, setSelectedLocation] = useState("ALL");
    const [selectedEmpType, setSelectedEmpType] = useState("ALL");
    const [selectedStatus, setSelectedStatus] = useState("ALL");
    const [executiveMode, setExecutiveMode] = useState(false);

    // Quick Employee View Drawer
    const [quickEmployee, setQuickEmployee] = useState<any | null>(null);

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ["hr-dashboard", dateRange, selectedDept, selectedLocation, selectedEmpType, selectedStatus],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateRange !== "today") params.set("dateRange", dateRange);
            if (selectedDept !== "ALL") params.set("department", selectedDept);
            if (selectedLocation !== "ALL") params.set("location", selectedLocation);
            if (selectedEmpType !== "ALL") params.set("employmentType", selectedEmpType);
            if (selectedStatus !== "ALL") params.set("status", selectedStatus);

            const res = await fetch(`/api/hr/dashboard?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to load HR Dashboard data");
            return res.json();
        },
        refetchInterval: 30000,
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-64" />
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-28 rounded-2xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <SkeletonPulse className="h-72 rounded-2xl" />
                    <SkeletonPulse className="h-72 rounded-2xl lg:col-span-2" />
                </div>
            </div>
        );
    }

    const {
        kpis, attendanceToday, attendanceTrend, lateEmployees, missingCheckoutEmployees,
        departmentBreakdown, locationBreakdown, workModeBreakdown, pipeline,
        payrollTrend, needsAttention, upcomingLeaves, onProbationEmployees,
        upcomingEvents, dataQuality, hrHealth, recentEmployees, allEmployeesQuickList
    } = data;

    const attendanceData = [
        { name: "Present", count: attendanceToday.present, fill: ATT_COLORS.present },
        { name: "Late", count: attendanceToday.late, fill: ATT_COLORS.late },
        { name: "On Leave", count: attendanceToday.onLeave, fill: ATT_COLORS.onLeave },
        { name: "WFH", count: attendanceToday.wfh, fill: ATT_COLORS.wfh },
        { name: "Absent", count: attendanceToday.absent, fill: ATT_COLORS.absent },
        { name: "Half Day", count: attendanceToday.halfDay || 0, fill: ATT_COLORS.halfDay },
    ].filter((d) => d.count > 0 || d.name === "Present" || d.name === "Absent");

    return (
        <div className="space-y-6 animate-fade-in pb-16">
            {/* Header & Global Control Bar */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-neutral-200/80 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="p-1.5 bg-primary/10 text-primary rounded-lg">
                            <Activity size={20} />
                        </span>
                        <h1 className="text-2xl font-black text-neutral-900 tracking-tight">HR Command Center</h1>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Live Sync
                        </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                        Real-time workforce intelligence, employee operations, and HR action priority queue.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={() => setExecutiveMode(!executiveMode)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                            executiveMode ? "bg-primary text-white border-primary shadow-xs" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                        }`}
                    >
                        <BarChart3 size={14} /> {executiveMode ? "Operational Mode" : "Executive View"}
                    </button>

                    <button
                        onClick={() => refetch()}
                        disabled={isRefetching}
                        className="px-3 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                        <RefreshCw size={13} className={isRefetching ? "animate-spin text-primary" : "text-neutral-400"} />
                        <span>Refresh</span>
                    </button>

                    <Link
                        href="/hr/onboarding"
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary-dark transition-all"
                    >
                        <UserPlus size={14} /> Onboarding ({kpis.pendingOnboarding})
                    </Link>
                </div>
            </div>

            {/* Filter Toolbar Bar */}
            <div className="bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-3 flex-wrap text-xs">
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Filter size={13} className="text-neutral-400" /> Filters:
                </span>

                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 font-semibold text-neutral-700 outline-none focus:border-primary cursor-pointer"
                >
                    <option value="today">Today ({attendanceToday.present + attendanceToday.absent} staff logged)</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month (September 2026)</option>
                    <option value="quarter">This Quarter (Q3)</option>
                    <option value="year">Full Year 2026</option>
                </select>

                <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 font-semibold text-neutral-700 outline-none focus:border-primary cursor-pointer"
                >
                    <option value="ALL">All Departments</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Talent Acquisition">Talent Acquisition</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Field">Field / Agent Staff</option>
                </select>

                <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 font-semibold text-neutral-700 outline-none focus:border-primary cursor-pointer"
                >
                    <option value="ALL">All Locations</option>
                    <option value="Mumbai">Mumbai (HQ / Andheri)</option>
                    <option value="Pune">Pune Branch</option>
                    <option value="Bandra">Bandra Hub</option>
                </select>

                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 font-semibold text-neutral-700 outline-none focus:border-primary cursor-pointer"
                >
                    <option value="ALL">All Employee Statuses</option>
                    <option value="ACTIVE">Active Employees</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="NOTICE_PERIOD">Serving Notice</option>
                    <option value="EXITED">Exited</option>
                </select>

                {(selectedDept !== "ALL" || selectedLocation !== "ALL" || selectedStatus !== "ALL" || dateRange !== "today") && (
                    <button
                        onClick={() => {
                            setSelectedDept("ALL");
                            setSelectedLocation("ALL");
                            setSelectedStatus("ALL");
                            setDateRange("today");
                        }}
                        className="text-xs font-bold text-rose-600 hover:underline ml-auto flex items-center gap-1"
                    >
                        <X size={12} /> Clear Filters
                    </button>
                )}
            </div>

            {/* ROW 1: Executive KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                    label="Total Workforce"
                    value={kpis.totalEmployees}
                    icon={Users}
                    tone="primary"
                    hint={`${kpis.activeEmployees} active · +${kpis.newJoiners} joined recently`}
                    href="/hr/employees"
                />
                <StatCard
                    label="Present Today"
                    value={kpis.presentToday}
                    icon={CalendarCheck}
                    tone="emerald"
                    hint={`${kpis.presenceRate}% attendance · ${kpis.lateToday} late check-ins`}
                    href="/hr/attendance"
                />
                <StatCard
                    label="Absent / On Leave"
                    value={`${kpis.absentToday} / ${kpis.employeesOnLeave}`}
                    icon={CalendarOff}
                    tone="red"
                    hint={`${kpis.wfhToday} WFH · ${kpis.halfDayToday || 0} Half-day`}
                    href="/hr/attendance?status=ABSENT"
                />
                <StatCard
                    label="Pending Actions"
                    value={kpis.pendingTotalApprovals}
                    icon={Clock}
                    tone="amber"
                    hint={`${kpis.pendingLeaveRequests} leave · ${kpis.pendingOnboarding} onboarding`}
                    href="#action-center"
                />
                <StatCard
                    label="Payroll Liability"
                    value={kpis.totalPayrollAmount > 0 ? inr(kpis.totalPayrollAmount) : "Draft Cycle"}
                    icon={Wallet}
                    tone="purple"
                    hint={`Gross: ${inr(kpis.grossPayrollAmount || 1020000)} · ${kpis.payrollStatus}`}
                    href="/hr/payroll"
                />
            </div>

            {/* ROW 2: HR Action Center: Needs Your Attention */}
            <div id="action-center" className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-amber-500 text-white rounded-lg">
                            <AlertTriangle size={16} />
                        </span>
                        <div>
                            <h2 className="text-sm font-bold text-amber-950">Needs Your Attention Today</h2>
                            <p className="text-xs text-amber-800">Critical operational bottlenecks, approval requests, and pending HR workflows</p>
                        </div>
                    </div>
                    <span className="text-xs font-black text-amber-900 bg-amber-200/70 px-2.5 py-0.5 rounded-full">
                        {needsAttention.length} Items Require Action
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {needsAttention.map((item: any) => (
                        <div key={item.id} className="bg-white p-3.5 rounded-xl border border-amber-200/60 shadow-xs flex flex-col justify-between space-y-3 hover:border-amber-300 transition-colors">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                                        {item.category}
                                    </span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                        item.type === "CRITICAL" ? "bg-rose-100 text-rose-800" :
                                        item.type === "HIGH" ? "bg-amber-100 text-amber-800" :
                                        "bg-blue-100 text-blue-800"
                                    }`}>
                                        {item.type}
                                    </span>
                                </div>
                                <h3 className="text-xs font-bold text-neutral-900 leading-snug">{item.title}</h3>
                                <p className="text-[11px] text-neutral-500 line-clamp-2">{item.description}</p>
                            </div>
                            <Link
                                href={item.link}
                                className="w-full py-1.5 bg-neutral-50 hover:bg-primary hover:text-white text-neutral-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-neutral-200/70"
                            >
                                <span>{item.cta}</span>
                                <ArrowUpRight size={13} />
                            </Link>
                        </div>
                    ))}
                </div>
            </div>

            {/* ROW 3: Recruitment → Onboarding → Lifecycle Funnel */}
            <SectionCard
                title="Recruitment → HR Onboarding → Employee Lifecycle"
                subtitle="Live synchronization between Candidate Pipeline and active HR workforce conversion"
                action={
                    <Link href="/admin/candidates" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                        View ATS Pipeline <ChevronRight size={14} />
                    </Link>
                }
            >
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2">
                    <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Shortlisted</span>
                            <Badge value="HR_ROUND" label="Interviews" />
                        </div>
                        <p className="text-2xl font-black text-neutral-900 mt-2">{pipeline.selected}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{pipeline.interviewsToday} interviews today</p>
                    </div>

                    <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Offer Sent</span>
                            <Badge value="OFFER_SENT" label="Offered" />
                        </div>
                        <p className="text-2xl font-black text-neutral-900 mt-2">{pipeline.offerReleased}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">Awaiting signing</p>
                    </div>

                    <div className="bg-teal-50/50 rounded-xl p-3.5 border border-teal-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Accepted</span>
                            <Badge value="OFFER_ACCEPTED" label="Accepted" />
                        </div>
                        <p className="text-2xl font-black text-teal-900 mt-2">{pipeline.offerAccepted}</p>
                        <p className="text-[10px] text-teal-600 mt-0.5">Pre-boarding ready</p>
                    </div>

                    <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Onboarding</span>
                            <Badge value="ONBOARDING" label="In Progress" />
                        </div>
                        <p className="text-2xl font-black text-blue-900 mt-2">{pipeline.onboarding}</p>
                        <p className="text-[10px] text-blue-600 mt-0.5">Checklist verification</p>
                    </div>

                    <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Joined</span>
                            <Badge value="JOINED" label="Active Staff" />
                        </div>
                        <p className="text-2xl font-black text-emerald-900 mt-2">{pipeline.joined}</p>
                        <p className="text-[10px] text-emerald-600 mt-0.5">HR record created</p>
                    </div>

                    <div className="bg-purple-50/50 rounded-xl p-3.5 border border-purple-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Open Roles</span>
                            <span className="text-[10px] font-bold text-purple-600">Requisitions</span>
                        </div>
                        <p className="text-2xl font-black text-purple-900 mt-2">{pipeline.openPositions}</p>
                        <p className="text-[10px] text-purple-600 mt-0.5">Active hiring targets</p>
                    </div>
                </div>
            </SectionCard>

            {/* ROW 4: Attendance Pulse + 7-Day Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Attendance Pulse */}
                <SectionCard
                    title="Today's Attendance Pulse"
                    subtitle="Real-time check-in and presence distribution"
                    className="lg:col-span-1"
                    action={
                        <Link href="/hr/attendance" className="text-xs text-primary font-bold hover:underline">
                            Details
                        </Link>
                    }
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

                {/* 7-Day Attendance Trend */}
                <SectionCard
                    title="7-Day Attendance & Presence Trend"
                    subtitle="Daily breakdown of on-time, late arrivals, and remote workers"
                    className="lg:col-span-2"
                >
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={attendanceTrend}>
                            <defs>
                                <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                            <Area type="monotone" dataKey="present" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#presentGrad)" name="Present" />
                            <Line type="monotone" dataKey="late" stroke="#F59E0B" strokeWidth={2} name="Late" />
                            <Line type="monotone" dataKey="absent" stroke="#EF4444" strokeWidth={2} name="Absent" />
                            <Line type="monotone" dataKey="wfh" stroke="#8B5CF6" strokeWidth={2} name="WFH" />
                        </AreaChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            {/* ROW 5: Attendance Exceptions (Late & Missing Checkouts) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard
                    title="Late Arrivals Today"
                    subtitle="Employees checked in past threshold buffer"
                    action={
                        <Link href="/hr/attendance?status=LATE" className="text-xs text-primary font-bold hover:underline">
                            View Attendance
                        </Link>
                    }
                >
                    {lateEmployees.length === 0 ? (
                        <div className="py-8 text-center text-xs text-neutral-400 font-medium">
                            <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                            No late check-ins recorded today!
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-100">
                            {lateEmployees.map((emp: any) => (
                                <div key={emp.id} className="py-2.5 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[11px]">
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-neutral-900">{emp.name}</p>
                                            <p className="text-[10px] text-neutral-400">{emp.department}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                            {emp.checkIn}
                                        </span>
                                        <p className="text-[10px] text-neutral-400 mt-0.5">+{emp.delayMinutes}m delay</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                <SectionCard
                    title="Active Check-ins Without Checkout"
                    subtitle="Personnel currently clocked in on premises / remote"
                    action={
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {missingCheckoutEmployees.length} Clocked In
                        </span>
                    }
                >
                    {missingCheckoutEmployees.length === 0 ? (
                        <div className="py-8 text-center text-xs text-neutral-400 font-medium">
                            No employees actively checked in
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-100">
                            {missingCheckoutEmployees.map((emp: any) => (
                                <div key={emp.id} className="py-2.5 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px]">
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-neutral-900">{emp.name}</p>
                                            <p className="text-[10px] text-neutral-400">{emp.department}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-neutral-500">
                                        In at <strong className="text-neutral-800">{emp.checkIn}</strong>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* ROW 6: Department Breakdown & Payroll Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard
                    title="Workforce by Department"
                    subtitle="Headcount allocation across corporate divisions"
                    className="lg:col-span-2"
                >
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={departmentBreakdown}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                            <Bar dataKey="count" fill="#1B4332" radius={[6, 6, 0, 0]} name="Headcount" />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>

                <SectionCard
                    title="Monthly Payroll Trend"
                    subtitle="Gross expenditure vs net disbursed"
                    className="lg:col-span-1"
                    action={
                        <Link href="/hr/payroll" className="text-xs text-primary font-bold hover:underline">
                            Payroll
                        </Link>
                    }
                >
                    <div className="space-y-3 pt-1">
                        {payrollTrend.map((p: any) => (
                            <div key={p.month} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-xs">
                                <div>
                                    <p className="font-bold text-neutral-900">{p.month}</p>
                                    <p className="text-[10px] text-neutral-400">{p.employees} employees</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-neutral-900">{inr(p.net)}</p>
                                    <p className="text-[10px] text-neutral-400">Gross: {inr(p.gross)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>

            {/* ROW 7: Probation Tracker & People Calendar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Probation Tracker */}
                <SectionCard
                    title="Probation & Confirmation Tracker"
                    subtitle="Employees currently on evaluation or review"
                    action={
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                            {onProbationEmployees.length} on Probation
                        </span>
                    }
                >
                    {onProbationEmployees.length === 0 ? (
                        <div className="py-8 text-center text-xs text-neutral-400 font-medium">
                            No employees currently on probation
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-100">
                            {onProbationEmployees.map((emp: any) => (
                                <div key={emp.id} className="py-3 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-bold text-neutral-900">{emp.name}</p>
                                        <p className="text-[10px] text-neutral-400">{emp.designation} · {emp.department}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                            Ends {emp.probationEndDate}
                                        </span>
                                        <p className="text-[10px] text-neutral-400 mt-0.5">Joined {emp.joiningDate}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Upcoming Events / People Calendar */}
                <SectionCard
                    title="People Calendar & Milestones"
                    subtitle="Upcoming anniversaries, birthdays & check-ins"
                >
                    <div className="space-y-2.5">
                        {upcomingEvents.map((ev: any) => (
                            <div key={ev.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2.5">
                                    <span className={`p-2 rounded-xl text-white ${
                                        ev.type === "ANNIVERSARY" ? "bg-amber-500" :
                                        ev.type === "BIRTHDAY" ? "bg-rose-500" :
                                        ev.type === "JOINING" ? "bg-emerald-500" :
                                        "bg-purple-500"
                                    }`}>
                                        <Award size={14} />
                                    </span>
                                    <div>
                                        <p className="font-bold text-neutral-900">{ev.name}</p>
                                        <p className="text-[10px] text-neutral-500">{ev.title} · {ev.department}</p>
                                    </div>
                                </div>
                                <span className="font-extrabold text-[11px] text-neutral-700 bg-white px-2 py-1 rounded-lg border border-neutral-200">
                                    {ev.date}
                                </span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>

            {/* ROW 8: Operational Health Scorecard & Data Quality */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* HR Health Scorecard */}
                <SectionCard
                    title="HR Operations Health Scorecard"
                    subtitle="Status of core SLAs across workforce workflows"
                >
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        {hrHealth.map((h: any) => (
                            <div key={h.metric} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-neutral-700 text-[11px]">{h.metric}</span>
                                    <span className={`w-2 h-2 rounded-full ${h.status === "HEALTHY" ? "bg-emerald-500" : "bg-amber-500"}`} />
                                </div>
                                <p className="font-black text-sm text-neutral-900">{h.value}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                {/* HR Data Quality */}
                <SectionCard
                    title="Employee Record Completeness"
                    subtitle="Compliance with required banking and emergency records"
                    action={
                        <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                            {dataQuality.score}% Complete
                        </span>
                    }
                >
                    <div className="space-y-3 text-xs">
                        <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${dataQuality.score}%` }} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center pt-2">
                            <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                                <p className="text-lg font-black text-neutral-900">{dataQuality.missingBankDetails}</p>
                                <p className="text-[10px] text-neutral-400 mt-0.5">Missing Bank</p>
                            </div>
                            <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                                <p className="text-lg font-black text-neutral-900">{dataQuality.missingEmergencyContact}</p>
                                <p className="text-[10px] text-neutral-400 mt-0.5">No Emergency Contact</p>
                            </div>
                            <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                                <p className="text-lg font-black text-neutral-900">{dataQuality.unassignedManager}</p>
                                <p className="text-[10px] text-neutral-400 mt-0.5">No Manager</p>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            </div>

            {/* ROW 9: Recent Team Additions & Quick Profile Drawer Trigger */}
            <SectionCard
                title="Recent Workforce Additions & Quick Inspect"
                subtitle="Click any employee for a 360° slide-over summary"
                action={
                    <Link href="/hr/employees" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                        Full Employee Directory <ChevronRight size={14} />
                    </Link>
                }
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allEmployeesQuickList.slice(0, 6).map((emp: any) => (
                        <div
                            key={emp.id}
                            onClick={() => setQuickEmployee(emp)}
                            className="p-3.5 rounded-xl border border-neutral-200 bg-white hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                    {emp.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-neutral-900 truncate">{emp.name}</p>
                                    <p className="text-[11px] text-neutral-500 truncate">{emp.designation}</p>
                                    <span className="text-[10px] font-mono text-neutral-400">{emp.employeeId}</span>
                                </div>
                            </div>
                            <button className="text-neutral-400 hover:text-primary p-1">
                                <Eye size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* MODAL / DRAWER: Quick Employee View */}
            <ModalShell open={!!quickEmployee} onClose={() => setQuickEmployee(null)} title="Employee Quick Inspect">
                {quickEmployee && (
                    <div className="space-y-4 text-xs">
                        <div className="flex items-center gap-3.5 pb-3 border-b border-neutral-100">
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0">
                                {quickEmployee.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="text-sm font-extrabold text-neutral-900">{quickEmployee.name}</h3>
                                <p className="text-neutral-500 font-medium">{quickEmployee.designation} · {quickEmployee.department}</p>
                                <span className="text-[10px] font-mono text-neutral-400">{quickEmployee.employeeId}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                            <div>
                                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Reporting Manager</span>
                                <span className="font-semibold text-neutral-800">{quickEmployee.reportingManagerName}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Work Mode</span>
                                <span className="font-semibold text-neutral-800">{quickEmployee.workMode}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Location</span>
                                <span className="font-semibold text-neutral-800">{quickEmployee.location}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Joining Date</span>
                                <span className="font-semibold text-neutral-800">{quickEmployee.joiningDate}</span>
                            </div>
                        </div>

                        <div className="space-y-2 pt-1">
                            <div className="flex items-center gap-2 text-neutral-700">
                                <Mail size={14} className="text-neutral-400" />
                                <span>{quickEmployee.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-neutral-700">
                                <Phone size={14} className="text-neutral-400" />
                                <span>{quickEmployee.phone}</span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-neutral-100 flex items-center gap-2">
                            <Link
                                href={`/hr/employees?id=${quickEmployee.id}`}
                                className="flex-1 py-2.5 bg-primary text-white text-center font-bold rounded-xl hover:bg-primary-dark transition-colors"
                            >
                                Open 360° Profile
                            </Link>
                            <Link
                                href={`/hr/attendance?employeeId=${quickEmployee.id}`}
                                className="px-4 py-2.5 bg-neutral-100 text-neutral-700 font-bold rounded-xl hover:bg-neutral-200 transition-colors"
                            >
                                Attendance
                            </Link>
                        </div>
                    </div>
                )}
            </ModalShell>
        </div>
    );
}
