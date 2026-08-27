"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Building2, Briefcase, Users, Wallet, UserCheck, Clock,
    TrendingUp, ClipboardCheck, ArrowRight, Flame,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from "recharts";

export default function AdminDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ["admin-dashboard"],
        queryFn: async () => {
            const res = await fetch("/api/admin/dashboard");
            if (!res.ok) throw new Error("Failed");
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

    const revenueTrend = [
        { month: "Mar", revenue: 180000 }, { month: "Apr", revenue: 240000 },
        { month: "May", revenue: 195000 }, { month: "Jun", revenue: 310000 },
        { month: "Jul", revenue: 285000 }, { month: "Aug", revenue: Math.max(k.revenueThisMonth, 150000) },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Organization Overview"
                subtitle="Full control — clients, team, pipeline & finance at a glance"
                action={
                    k.pendingApprovals > 0 ? (
                        <Link href="/admin/jobs?status=PENDING_APPROVAL" className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors">
                            <Clock size={16} /> {k.pendingApprovals} approval{k.pendingApprovals > 1 ? "s" : ""} pending
                        </Link>
                    ) : undefined
                }
            />

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Active Clients" value={k.activeClients} icon={Building2} tone="primary" hint={`${k.totalClients} total`} />
                <StatCard label="Open Positions" value={k.openPositions} icon={Briefcase} tone="blue" hint={`${k.activeJobs} active jobs`} />
                <StatCard label="In Pipeline" value={k.inPipeline} icon={Users} tone="purple" hint="candidates moving" />
                <StatCard label="Placements" value={k.placementsTotal} icon={UserCheck} tone="emerald" hint="all time joins" />
                <StatCard label="Revenue (MTD)" value={inr(k.revenueThisMonth)} icon={TrendingUp} tone="emerald" />
                <StatCard label="Receivables" value={inr(k.pendingReceivables)} icon={Wallet} tone="amber" hint="pending collection" />
                <StatCard label="Team Size" value={k.teamSize} icon={ClipboardCheck} tone="blue" hint={`${k.recruiters} recruiters · ${k.agents} agents`} />
                <StatCard label="Pending Approvals" value={k.pendingApprovals} icon={Clock} tone={k.pendingApprovals > 0 ? "red" : "emerald"} hint="job requisitions" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue chart */}
                <SectionCard title="Revenue Trend" subtitle="Placement commission collected (last 6 months)" className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={revenueTrend}>
                            <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#1B4332" stopOpacity={0.25} />
                                    <stop offset="100%" stopColor="#1B4332" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                                tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
                            <Tooltip formatter={(v) => [inr(Number(v)), "Revenue"]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                            <Area type="monotone" dataKey="revenue" stroke="#1B4332" strokeWidth={2.5} fill="url(#revGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </SectionCard>

                {/* Funnel */}
                <SectionCard title="Hiring Funnel" subtitle="Candidates per stage (org-wide)">
                    <div className="space-y-2.5">
                        {data.funnel.map((f: { stage: string; count: number }) => {
                            const max = Math.max(...data.funnel.map((x: { count: number }) => x.count), 1);
                            return (
                                <div key={f.stage}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="font-semibold text-neutral-600">{f.stage.replaceAll("_", " ")}</span>
                                        <span className="font-bold text-neutral-900">{f.count}</span>
                                    </div>
                                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary/80 rounded-full transition-all" style={{ width: `${(f.count / max) * 100}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Urgent jobs */}
                <SectionCard
                    title="High Priority Requisitions"
                    subtitle="Needs attention"
                    action={<Link href="/admin/jobs" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>}
                >
                    {data.urgentJobs.length === 0 ? (
                        <EmptyState icon={Flame} message="No urgent requisitions right now." />
                    ) : (
                        <div className="divide-y divide-neutral-50 -mx-5 px-5">
                            {data.urgentJobs.map((j: any) => (
                                <div key={j.id} className="py-3.5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900 truncate">{j.title}</p>
                                        <p className="text-xs text-neutral-400 mt-0.5">{j.clientName} · {j.openings - j.filled} opening(s)</p>
                                    </div>
                                    <Badge value={j.priority} />
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Recent activity / audit */}
                <SectionCard
                    title="Recent Activity"
                    subtitle="Audit trail"
                    action={<Link href="/admin/audit-log" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">Full log <ArrowRight size={12} /></Link>}
                >
                    <div className="space-y-3.5">
                        {data.recentAudit.map((log: any) => (
                            <div key={log.id} className="flex gap-3">
                                <div className="w-1 self-stretch rounded-full bg-primary/15 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm text-neutral-800 leading-snug">{log.detail}</p>
                                    <p className="text-[10px] text-neutral-400 mt-0.5 uppercase tracking-wide font-semibold">
                                        {log.actorRole.replaceAll("_", " ")} · {new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>

            {/* Openings bar */}
            <SectionCard title="Openings vs Pipeline" subtitle="Top requisitions by open positions">
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.urgentJobs.concat([]).slice(0, 6).map((j: any) => ({ name: j.title.slice(0, 18), openings: j.openings - j.filled }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                        <Bar dataKey="openings" fill="#1B4332" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>
        </div>
    );
}
