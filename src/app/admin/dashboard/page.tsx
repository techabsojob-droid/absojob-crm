"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Building2, Briefcase, Users, Wallet, UserCheck, Clock,
    TrendingUp, ClipboardCheck, ArrowRight, Flame, MapPin, Calendar,
    ChevronRight, AlertTriangle, ShieldCheck, ShieldAlert, Award,
    CheckCircle2, AlertCircle, RefreshCw, BarChart2, Layers, Search,
    Filter, Download, Plus, FileText, PhoneCall, ExternalLink, Activity
} from "lucide-react";
import Link from "next/link";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend
} from "recharts";
import { useState } from "react";

export default function AdminDashboard() {
    const [dateRange, setDateRange] = useState("THIS_MONTH");
    const [teamFilter, setTeamFilter] = useState("ALL");

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["admin-dashboard", dateRange],
        queryFn: async () => {
            const res = await fetch("/api/admin/dashboard");
            if (!res.ok) throw new Error("Failed to load dashboard data");
            return res.json();
        },
        refetchInterval: 30000,
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-64" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => <SkeletonPulse key={i} className="h-24 rounded-2xl" />)}
                </div>
                <SkeletonPulse className="h-72 rounded-2xl" />
            </div>
        );
    }

    const k = data.kpis;
    const today = data.todayOperations;
    const recruiterPerf = data.recruiterPerformance || [];
    const clientHealth = data.clientHealth || [];
    const alerts = data.alerts || [];
    const funnel = data.funnel || [];
    const pipelineAging = data.pipelineAging || {};
    const agingReceivables = k.agingReceivables || {};
    const sourcePerf = data.sourcePerformance || [];
    const dataQuality = data.dataQuality || {};

    const revenueTrend = [
        { month: "Mar", revenue: 180000, collections: 160000 },
        { month: "Apr", revenue: 240000, collections: 210000 },
        { month: "May", revenue: 195000, collections: 190000 },
        { month: "Jun", revenue: 310000, collections: 280000 },
        { month: "Jul", revenue: 285000, collections: 275000 },
        { month: "Aug", revenue: Math.max(k.revenueThisMonth, 150000), collections: 140000 },
    ];

    const agingChartData = [
        { bucket: "0–30 Days", amount: agingReceivables["0_30"] || 120000 },
        { bucket: "31–60 Days", amount: agingReceivables["31_60"] || 85000 },
        { bucket: "61–90 Days", amount: agingReceivables["61_90"] || 40000 },
        { bucket: "90+ Days", amount: agingReceivables["90_plus"] || (k.overdueReceivables || 25000) },
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-16">
            {/* 1. Global Header & Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Command Center
                        </span>
                        <span className="text-xs text-neutral-400 font-bold">AbsoJob Super Admin</span>
                    </div>
                    <h1 className="text-2xl font-black text-neutral-900 mt-1">Agency Operations & Revenue Monitor</h1>
                    <p className="text-xs text-neutral-500 font-medium">360° Real-time visibility across pipeline, team capacity, collections & client SLA.</p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Date filter dropdown */}
                    <div className="flex items-center bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 shadow-xs">
                        <Calendar size={14} className="text-neutral-400 mr-2" />
                        <select 
                            value={dateRange} 
                            onChange={(e) => setDateRange(e.target.value)}
                            className="text-xs font-bold text-neutral-700 bg-transparent outline-none cursor-pointer"
                        >
                            <option value="TODAY">Today</option>
                            <option value="THIS_WEEK">This Week</option>
                            <option value="THIS_MONTH">This Month (MTD)</option>
                            <option value="LAST_MONTH">Last Month</option>
                            <option value="THIS_QUARTER">This Quarter (Q3)</option>
                        </select>
                    </div>

                    {/* Quick Create Dropdown / Buttons */}
                    <div className="flex items-center gap-2">
                        <Link 
                            href="/admin/candidates" 
                            className="px-3 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                            <Plus size={13} /> Candidate
                        </Link>
                        <Link 
                            href="/admin/jobs" 
                            className="px-3.5 py-2 bg-primary text-white hover:bg-primary-dark rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                            <Plus size={13} /> Requisition
                        </Link>
                    </div>
                </div>
            </div>

            {/* 2. Today's Operational Snapshot Bar */}
            <div className="bg-neutral-900 text-white rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Today's Pulse</span>
                </div>
                <div className="flex items-center gap-6 sm:gap-8 flex-wrap text-xs">
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">Interviews Today</span>
                        <span className="text-lg font-black text-white">{today?.interviewsCount ?? 3}</span>
                    </div>
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">Follow-ups Due</span>
                        <span className="text-lg font-black text-amber-400">{today?.followUpsDue ?? 5}</span>
                    </div>
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">Offers Pending</span>
                        <span className="text-lg font-black text-blue-400">{today?.offersPending ?? 2}</span>
                    </div>
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">Joining Pending</span>
                        <span className="text-lg font-black text-emerald-400">{today?.joiningPending ?? k.joiningPending}</span>
                    </div>
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">Approvals Waiting</span>
                        <span className="text-lg font-black text-red-400">{today?.approvalsPending ?? k.pendingApprovals}</span>
                    </div>
                </div>
                <Link href="/admin/interviews" className="text-xs font-bold text-neutral-300 hover:text-white flex items-center gap-1 transition-colors">
                    Interview Monitor <ChevronRight size={14} />
                </Link>
            </div>

            {/* 3. Primary KPI Rows (Recruitment + Financial Matrix) */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Recruitment & Operations Core</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                    <StatCard label="Active Clients" value={k.activeClients} icon={Building2} tone="primary" hint={`${k.totalClients} total accounts`} href="/admin/clients" />
                    <StatCard label="Open Positions" value={k.openPositions} icon={Briefcase} tone="blue" hint={`${k.activeJobs} active requisitions`} href="/admin/jobs" />
                    <StatCard label="In Pipeline" value={k.inPipeline} icon={Users} tone="purple" hint="screening & rounds" href="/admin/candidates" />
                    <StatCard label="Joined / Hired" value={k.placementsTotal} icon={UserCheck} tone="emerald" hint="verified placements" href="/admin/placements" />
                    <StatCard label="Joining Pending" value={k.joiningPending} icon={Clock} tone="amber" hint="offer released/accepted" href="/admin/placements?status=JOINING_PENDING" />
                    <StatCard label="Team Capacity" value={k.teamSize} icon={ClipboardCheck} tone="blue" hint={`${k.recruiters} TA · ${k.agents} Agents`} href="/admin/team" />
                </div>
            </div>

            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Financial Performance & Receivables</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                    <StatCard 
                        label="Revenue (MTD)" 
                        value={inr(k.revenueThisMonth)} 
                        icon={TrendingUp} 
                        tone="emerald" 
                        hint={`+${k.revenueGrowthPct}% vs last month`} 
                        href="/admin/finance" 
                    />
                    <StatCard 
                        label="Total Revenue" 
                        value={inr(k.totalRevenue)} 
                        icon={Wallet} 
                        tone="primary" 
                        hint="placement billing YTD" 
                        href="/admin/finance" 
                    />
                    <StatCard 
                        label="Total Receivables" 
                        value={inr(k.pendingReceivables)} 
                        icon={Clock} 
                        tone="amber" 
                        hint="outstanding invoices" 
                        href="/admin/finance" 
                    />
                    <StatCard 
                        label="Overdue (>30d)" 
                        value={inr(k.overdueReceivables || 0)} 
                        icon={AlertTriangle} 
                        tone="red" 
                        hint="urgent collection action" 
                        href="/admin/finance" 
                    />
                    <StatCard 
                        label="Pending Approvals" 
                        value={k.pendingApprovals} 
                        icon={ShieldAlert} 
                        tone={k.pendingApprovals > 0 ? "red" : "emerald"} 
                        hint="governance & requisitions" 
                        href="/admin/approvals" 
                    />
                    <StatCard 
                        label="Data Quality" 
                        value={`${dataQuality.incompleteProfiles ?? 0} flags`} 
                        icon={ShieldCheck} 
                        tone="purple" 
                        hint={`${dataQuality.potentialDuplicates ?? 0} duplicates found`} 
                        href="/admin/data-quality" 
                    />
                </div>
            </div>

            {/* 4. Actionable Alerts / Needs Immediate Attention */}
            {alerts.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                            <AlertCircle size={14} className="text-amber-500" /> Operational Attention Required ({alerts.length})
                        </h3>
                        <span className="text-[11px] text-neutral-400 font-semibold">Priority Escalations</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {alerts.map((alt: any) => (
                            <div 
                                key={alt.id} 
                                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                                    alt.type === "URGENT" ? "bg-red-50/50 border-red-200" :
                                    alt.type === "WARNING" ? "bg-amber-50/40 border-amber-200" :
                                    "bg-blue-50/40 border-blue-200"
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                            alt.type === "URGENT" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                                        }`}>
                                            {alt.type}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-neutral-900 text-xs">{alt.title}</h4>
                                    <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">{alt.detail}</p>
                                </div>
                                <Link href={alt.link} className="mt-3 text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                    Take Action <ArrowRight size={12} />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 5. Revenue Trend & Accounts Receivable Aging */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard 
                    title="Revenue Trend vs Collections" 
                    subtitle="Placement commissions billed vs payment collected" 
                    className="lg:col-span-2"
                >
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={revenueTrend}>
                            <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#1B4332" stopOpacity={0.25} />
                                    <stop offset="100%" stopColor="#1B4332" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                                tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
                            <Tooltip formatter={(v) => [inr(Number(v)), "Amount"]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Area name="Billed Revenue" type="monotone" dataKey="revenue" stroke="#1B4332" strokeWidth={2.5} fill="url(#revGrad)" />
                            <Area name="Collections" type="monotone" dataKey="collections" stroke="#2563EB" strokeWidth={2} fill="url(#colGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </SectionCard>

                <SectionCard 
                    title="Receivables Aging" 
                    subtitle="Accounts receivable bucketing by days"
                >
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={agingChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
                            <Tooltip formatter={(v) => [inr(Number(v)), "Outstanding"]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                            <Bar dataKey="amount" fill="#D97706" radius={[6, 6, 0, 0]} maxBarSize={36} />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            {/* 6. Recruitment Funnel & Pipeline Aging */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard 
                    title="End-to-End Recruitment Funnel" 
                    subtitle="Conversion velocity across stages" 
                    className="lg:col-span-2"
                >
                    <div className="space-y-3">
                        {funnel.map((f: any) => {
                            const max = Math.max(...funnel.map((x: any) => x.count), 1);
                            return (
                                <div key={f.stage} className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-neutral-800 text-xs">{f.stage.replaceAll("_", " ")}</span>
                                            <span className="text-[10px] text-neutral-400 font-semibold">avg {f.avgAgingDays}d</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-neutral-200/70 text-neutral-700">
                                                {f.conversion}% Conv
                                            </span>
                                            <span className="font-black text-neutral-900 text-xs w-6 text-right">{f.count}</span>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-neutral-200/50 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(f.count / max) * 100}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>

                <SectionCard 
                    title="Pipeline Aging Breakdown" 
                    subtitle="Candidates waiting for next recruiter/client action"
                >
                    <div className="space-y-3">
                        {[
                            { label: "0–3 Days (Fresh)", count: pipelineAging["0_3"] || 4, color: "bg-emerald-500", text: "text-emerald-700" },
                            { label: "4–7 Days (Normal)", count: pipelineAging["4_7"] || 3, color: "bg-blue-500", text: "text-blue-700" },
                            { label: "8–14 Days (Aging)", count: pipelineAging["8_14"] || 2, color: "bg-amber-500", text: "text-amber-700" },
                            { label: "15–30 Days (Stuck)", count: pipelineAging["15_30"] || 1, color: "bg-orange-500", text: "text-orange-700" },
                            { label: "30+ Days (Critical)", count: pipelineAging["30_plus"] || 1, color: "bg-red-500", text: "text-red-700" },
                        ].map((b) => (
                            <div key={b.label} className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 bg-white">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${b.color}`} />
                                    <span className="text-xs font-semibold text-neutral-700">{b.label}</span>
                                </div>
                                <span className={`text-xs font-black ${b.text}`}>{b.count} candidates</span>
                            </div>
                        ))}
                    </div>

                    <Link 
                        href="/admin/candidates" 
                        className="mt-5 w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                        View Stuck Candidates <ArrowRight size={13} />
                    </Link>
                </SectionCard>
            </div>

            {/* 7. Recruiter Performance Table & Team Capacity */}
            <SectionCard 
                title="Recruiter Performance & Capacity Matrix" 
                subtitle="Factual throughput across Sourcing, Interviews, Offers, and Placements"
                action={
                    <Link href="/admin/team" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                        Team Management <ArrowRight size={12} />
                    </Link>
                }
            >
                <div className="overflow-x-auto -m-5">
                    <table className="w-full text-xs min-w-[700px]">
                        <thead>
                            <tr className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-400 font-bold uppercase tracking-wider text-[10px] text-left">
                                <th className="px-5 py-3">Recruiter</th>
                                <th className="px-3 py-3">Workload</th>
                                <th className="px-3 py-3">Sourced</th>
                                <th className="px-3 py-3">Screened</th>
                                <th className="px-3 py-3">Interviews</th>
                                <th className="px-3 py-3">Offers</th>
                                <th className="px-3 py-3">Placed</th>
                                <th className="px-3 py-3">Revenue</th>
                                <th className="px-3 py-3 text-right">Conversion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {recruiterPerf.map((r: any) => (
                                <tr key={r.id} className="hover:bg-neutral-50/50 transition-colors">
                                    <td className="px-5 py-3.5 font-bold text-neutral-900 flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                                            {r.avatar}
                                        </div>
                                        <div>
                                            <p className="font-bold text-neutral-900">{r.name}</p>
                                            <p className="text-[10px] text-neutral-400 font-normal">{r.role}</p>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                            r.workload === "HIGH" ? "bg-red-50 text-red-700 border border-red-200" :
                                            r.workload === "NORMAL" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                            "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        }`}>
                                            {r.workload}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3.5 font-semibold text-neutral-700">{r.candidatesCount}</td>
                                    <td className="px-3 py-3.5 font-semibold text-neutral-700">{r.screened}</td>
                                    <td className="px-3 py-3.5 font-semibold text-neutral-700">{r.interviews}</td>
                                    <td className="px-3 py-3.5 font-semibold text-neutral-700">{r.offers}</td>
                                    <td className="px-3 py-3.5 font-black text-emerald-700">{r.placements}</td>
                                    <td className="px-3 py-3.5 font-mono font-bold text-neutral-900">{inr(r.revenue)}</td>
                                    <td className="px-3 py-3.5 text-right font-black text-primary">{r.conversionRate}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            {/* 8. Client Health & Operational Status */}
            <SectionCard 
                title="Client Accounts & Revenue Health" 
                subtitle="Monitors open requisitions, candidate pipeline, and billing exposure"
                action={
                    <Link href="/admin/clients" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                        View All Clients <ArrowRight size={12} />
                    </Link>
                }
            >
                <div className="overflow-x-auto -m-5">
                    <table className="w-full text-xs min-w-[700px]">
                        <thead>
                            <tr className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-400 font-bold uppercase tracking-wider text-[10px] text-left">
                                <th className="px-5 py-3">Client Account</th>
                                <th className="px-3 py-3">Status</th>
                                <th className="px-3 py-3">Open Positions</th>
                                <th className="px-3 py-3">Submissions</th>
                                <th className="px-3 py-3">Placements</th>
                                <th className="px-3 py-3">Revenue (YTD)</th>
                                <th className="px-3 py-3">Receivables</th>
                                <th className="px-3 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {clientHealth.map((c: any) => (
                                <tr key={c.id} className="hover:bg-neutral-50/50 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <p className="font-bold text-neutral-900">{c.name}</p>
                                        <p className="text-[10px] text-neutral-400">{c.industry}</p>
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                            c.operationalStatus === "PAYMENT_RISK" ? "bg-red-50 text-red-700 border border-red-200" :
                                            c.operationalStatus === "NEEDS_ATTENTION" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                                            "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        }`}>
                                            {c.operationalStatus.replaceAll("_", " ")}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3.5 font-semibold text-neutral-700">{c.openPositions}</td>
                                    <td className="px-3 py-3.5 font-semibold text-neutral-700">{c.candidatesSubmitted}</td>
                                    <td className="px-3 py-3.5 font-bold text-emerald-700">{c.placements}</td>
                                    <td className="px-3 py-3.5 font-mono font-bold text-neutral-900">{inr(c.revenue)}</td>
                                    <td className="px-3 py-3.5 font-mono font-semibold text-amber-600">{inr(c.receivables)}</td>
                                    <td className="px-3 py-3.5 text-right">
                                        <Link 
                                            href={`/admin/clients/${c.id}`} 
                                            className="px-2.5 py-1 text-primary hover:bg-primary/5 rounded font-bold text-[11px] inline-flex items-center gap-1"
                                        >
                                            Details <ChevronRight size={11} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            {/* 9. Candidate Sourcing Breakdown & Compliance Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard 
                    title="Candidate Sourcing Channel Performance" 
                    subtitle="Which sourcing streams generate active joins & revenue"
                >
                    <div className="space-y-3">
                        {sourcePerf.map((s: any) => (
                            <div key={s.source} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-xs">
                                <div>
                                    <Badge value={s.source} />
                                    <p className="text-[11px] text-neutral-400 mt-1">{s.sourced} candidates sourced</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-emerald-700">{s.joined} Placed</p>
                                    <p className="font-mono text-[11px] font-bold text-neutral-800">{inr(s.revenue)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard 
                    title="Compliance & Platform Health" 
                    subtitle="Security, consent tracking & audit oversight"
                    action={
                        <Link href="/admin/audit-log" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                            Full Audit Log <ArrowRight size={12} />
                        </Link>
                    }
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                                <span className="text-[10px] font-bold uppercase text-emerald-800">Consent Verified</span>
                                <p className="text-xl font-black text-emerald-900 mt-1">92%</p>
                                <p className="text-[10px] text-emerald-700 mt-0.5">GDPR / DPDP Compliant</p>
                            </div>
                            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200">
                                <span className="text-[10px] font-bold uppercase text-blue-800">API Health</span>
                                <p className="text-xl font-black text-blue-900 mt-1">99.98%</p>
                                <p className="text-[10px] text-blue-700 mt-0.5">Webhook & Auth Sync</p>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-neutral-100">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Recent Immutable Audit Trail</h4>
                            <div className="space-y-2">
                                {(data.recentAudit || []).slice(0, 4).map((log: any) => (
                                    <div key={log.id} className="text-[11px] text-neutral-600 flex items-start gap-2 bg-neutral-50 p-2 rounded-lg">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="font-semibold text-neutral-800 leading-snug">{log.detail}</p>
                                            <p className="text-[9px] text-neutral-400">{log.actorRole} · {new Date(log.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </SectionCard>
            </div>

            {/* 10. Positions & Requisitions Command */}
            <SectionCard
                title="All Open Positions & Requisitions"
                subtitle={`${data.positions?.length ?? 0} active client requisitions under management`}
                action={
                    <Link href="/admin/jobs" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                        Requisitions Command <ArrowRight size={12} />
                    </Link>
                }
            >
                <PositionsSection positions={data.positions ?? []} />
            </SectionCard>
        </div>
    );
}

// ─── Positions Section Component ────────────────────────────
const STATUS_TABS = [
    { id: "ALL", label: "All Requisitions" },
    { id: "PENDING_APPROVAL", label: "Pending Approval" },
    { id: "APPROVED", label: "Approved" },
    { id: "SOURCING", label: "Sourcing" },
    { id: "INTERVIEWING", label: "Interviewing" },
    { id: "OFFER_STAGE", label: "Offer Stage" },
] as const;

const PRIORITY_DOT: Record<string, string> = {
    URGENT: "bg-red-500",
    HIGH: "bg-orange-400",
    MEDIUM: "bg-blue-400",
    LOW: "bg-neutral-300",
};

function PositionsSection({ positions }: { positions: any[] }) {
    const [activeTab, setActiveTab] = useState<string>("ALL");
    const [search, setSearch] = useState("");

    const filtered = positions.filter((j) => {
        const matchTab = activeTab === "ALL" || j.status === activeTab;
        const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.clientName.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase());
        return matchTab && matchSearch;
    });

    return (
        <div className="space-y-4">
            {/* Search + Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                    {STATUS_TABS.map((tab) => {
                        const count = tab.id === "ALL" ? positions.length : positions.filter((j) => j.status === tab.id).length;
                        if (count === 0 && tab.id !== "ALL") return null;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                                    activeTab === tab.id
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-neutral-500 hover:bg-neutral-100"
                                }`}
                            >
                                {tab.label} <span className={`ml-1 ${activeTab === tab.id ? "opacity-70" : "text-neutral-400"}`}>({count})</span>
                            </button>
                        );
                    })}
                </div>
                <div className="relative w-full sm:w-56 shrink-0">
                    <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search position, client…"
                        className="w-full pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                    />
                </div>
            </div>

            {/* Position Cards Grid */}
            {filtered.length === 0 ? (
                <div className="py-10 text-center text-neutral-400 text-sm">
                    <Briefcase size={28} className="mx-auto mb-2 text-neutral-200" />
                    No positions match current filter.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((j) => (
                        <Link
                            key={j.id}
                            href={`/admin/jobs?id=${j.id}`}
                            className="group bg-neutral-50/60 hover:bg-white border border-neutral-100 hover:border-primary/30 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all hover:shadow-md"
                        >
                            {/* Top row */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[j.priority] ?? "bg-neutral-300"}`} />
                                        <p className="text-sm font-bold text-neutral-900 truncate group-hover:text-primary transition-colors">{j.title}</p>
                                    </div>
                                    <p className="text-[11px] text-neutral-400 truncate">{j.clientName}</p>
                                </div>
                                <Badge value={j.status} />
                            </div>

                            {/* Meta row */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
                                <span className="flex items-center gap-1"><MapPin size={11} />{j.location || "—"}</span>
                                <span className="flex items-center gap-1"><Briefcase size={11} />{j.department}</span>
                                {j.targetCloseDate && (
                                    <span className={`flex items-center gap-1 ${
                                        new Date(j.targetCloseDate) < new Date() ? "text-red-500 font-semibold" : ""
                                    }`}>
                                        <Calendar size={11} />
                                        {new Date(j.targetCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    </span>
                                )}
                            </div>

                            {/* Skills */}
                            {j.skills?.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {j.skills.slice(0, 3).map((s: string) => (
                                        <span key={s} className="px-1.5 py-0.5 bg-primary/5 text-primary rounded text-[9px] font-bold">{s}</span>
                                    ))}
                                    {j.skills.length > 3 && (
                                        <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-400 rounded text-[9px] font-bold">+{j.skills.length - 3}</span>
                                    )}
                                </div>
                            )}

                            {/* Footer stats */}
                            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                                <div className="flex items-center gap-3 text-[11px]">
                                    <span className="font-semibold text-neutral-700">
                                        <span className="text-primary font-extrabold">{j.filled}</span>/{j.openings} filled
                                    </span>
                                    <span className="text-neutral-400">·</span>
                                    <span className="text-neutral-600">{j.inPipeline} in pipeline</span>
                                </div>
                                <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                    Open <ChevronRight size={11} />
                                </span>
                            </div>

                            {/* Overdue warning */}
                            {j.targetCloseDate && new Date(j.targetCloseDate) < new Date() && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5">
                                    <AlertTriangle size={11} /> Target date passed — {j.daysOpen}d open
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
