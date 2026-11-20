"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Briefcase, ArrowRight, MapPin, Calendar, ChevronRight, AlertTriangle, AlertCircle, RefreshCw, Plus, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend
} from "recharts";
import { useState } from "react";
import { MyWork } from "@/components/tasks/TaskWidgets";
import { Kpi, KpiRow, OverviewTabs } from "@/components/shared/KpiStrip";

type AdminTab = "today" | "positions" | "pipeline" | "team" | "clients" | "revenue" | "health";

const PERIODS = [
    ["TODAY", "Today"], ["THIS_WEEK", "This week"], ["THIS_MONTH", "This month"], ["LAST_MONTH", "Last month"],
    ["THIS_QUARTER", "This quarter"], ["THIS_FY", "This financial year"],
] as const;

const lakh = (n: number) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(n >= 1e7 ? 0 : 1)}L` : inr(n));
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };

export default function AdminDashboard() {
    const [period, setPeriod] = useState("THIS_MONTH");
    const [tab, setTab] = useState<AdminTab>("today");

    const { data, isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: ["admin-dashboard", period],
        queryFn: async () => {
            const res = await fetch(`/api/admin/dashboard?period=${period}`);
            if (!res.ok) throw new Error("Failed to load dashboard data");
            return res.json();
        },
        refetchInterval: 30000,
        placeholderData: (prev) => prev,
    });

    if (isError && !data) {
        return (
            <div className="py-16 text-center text-sm text-neutral-500 space-y-3">
                <p>The overview couldn&apos;t load right now.</p>
                <button onClick={() => refetch()} className="px-4 py-2 rounded-md bg-primary text-white text-xs font-medium">Try again</button>
            </div>
        );
    }
    if (isLoading || !data) {
        return (
            <div className="space-y-5">
                <SkeletonPulse className="h-10 w-64" />
                <SkeletonPulse className="h-56 rounded-2xl" />
                <SkeletonPulse className="h-10 rounded-xl" />
                <SkeletonPulse className="h-72 rounded-2xl" />
            </div>
        );
    }

    const k = data.kpis;
    const today = data.todayOperations ?? {};
    const recruiterPerf = data.recruiterPerformance || [];
    const clientHealth = data.clientHealth || [];
    const alerts = data.alerts || [];
    const funnel = data.funnel || [];
    const pipelineAging = data.pipelineAging || {};
    const agingReceivables = k.agingReceivables || {};
    const sourcePerf = data.sourcePerformance || [];
    const dataQuality = data.dataQuality || {};
    const positions = data.positions ?? [];
    const revenueTrend = data.revenueTrend ?? [];
    const RISKY = ["PAYMENT_RISK", "NEEDS_ATTENTION"];
    const clientsAtRisk = clientHealth.filter((c: { operationalStatus: string }) => RISKY.includes(c.operationalStatus)).length;
    const growth = (pct: number | null | undefined) => (pct == null ? "no earlier data to compare" : `${pct >= 0 ? "+" : ""}${pct}% vs previous period`);

    const agingChartData = [
        { bucket: "0–30 days", amount: agingReceivables["0_30"] ?? 0 },
        { bucket: "31–60 days", amount: agingReceivables["31_60"] ?? 0 },
        { bucket: "61–90 days", amount: agingReceivables["61_90"] ?? 0 },
        { bucket: "90+ days", amount: agingReceivables["90_plus"] ?? 0 },
    ];
    const agingBuckets = [
        { label: "0–3 days (fresh)", count: pipelineAging["0_3"] ?? 0, color: "bg-emerald-500" },
        { label: "4–7 days", count: pipelineAging["4_7"] ?? 0, color: "bg-blue-500" },
        { label: "8–14 days (aging)", count: pipelineAging["8_14"] ?? 0, color: "bg-amber-500" },
        { label: "15–30 days (stuck)", count: pipelineAging["15_30"] ?? 0, color: "bg-orange-500" },
        { label: "30+ days (critical)", count: pipelineAging["30_plus"] ?? 0, color: "bg-red-500" },
    ];
    const stuck = (pipelineAging["15_30"] ?? 0) + (pipelineAging["30_plus"] ?? 0);

    const tabs: { id: AdminTab; label: string; count?: number; alert?: boolean }[] = [
        { id: "today", label: "Today", count: alerts.length, alert: alerts.length > 0 },
        { id: "positions", label: "Positions", count: positions.length },
        { id: "pipeline", label: "Pipeline", count: stuck, alert: stuck > 0 },
        { id: "team", label: "Team" },
        { id: "clients", label: "Clients", count: clientsAtRisk, alert: clientsAtRisk > 0 },
        { id: "revenue", label: "Revenue" },
        { id: "health", label: "Sources & compliance" },
    ];

    return (
        <div className="space-y-5 animate-fade-in pb-16">
            {/* 1. Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-1">
                <div>
                    <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-neutral-900">Good {greeting()}</h1>
                    <p className="text-[13px] text-neutral-500 mt-0.5">The whole agency at a glance: hiring, team, clients and money. Click any number to open it.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center bg-white border border-neutral-200 rounded-md px-2.5 h-9 text-xs">
                        <Calendar size={14} className="text-neutral-400 mr-2" />
                        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period" className="font-medium text-neutral-700 bg-transparent outline-none cursor-pointer">
                            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </label>
                    <button onClick={() => refetch()} aria-label="Refresh" title="Refresh" className="h-9 w-9 rounded-md border border-neutral-200 bg-white flex items-center justify-center text-neutral-500 hover:text-navy">
                        <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
                    </button>
                    <Link href="/admin/candidates" className="h-9 px-3 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-md text-xs font-medium flex items-center gap-1.5">
                        <Plus size={13} /> Candidate
                    </Link>
                    <Link href="/admin/jobs" className="h-9 px-3.5 bg-primary text-white hover:bg-primary-dark rounded-md text-xs font-medium flex items-center gap-1.5">
                        <Plus size={13} /> Requisition
                    </Link>
                </div>
            </div>

            {/* 2. Key numbers — one compact strip, every tile opens its page */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs divide-y divide-neutral-100">
                <KpiRow title="Today">
                    <Kpi label="Interviews today" value={today.interviewsCount ?? 0} hint="All clients" href="/admin/interviews" />
                    <Kpi label="Follow-ups due" value={today.followUpsDue ?? 0} hint="Across the team" href="/admin/tasks" tone={(today.followUpsDue ?? 0) > 0 ? "warn" : undefined} />
                    <Kpi label="Offers pending" value={today.offersPending ?? 0} hint="Awaiting candidate" href="/admin/placements" />
                    <Kpi label="Joining pending" value={today.joiningPending ?? k.joiningPending} hint="Offer accepted" href="/admin/placements?status=JOINING_PENDING" />
                    <Kpi label="Approvals waiting" value={today.approvalsPending ?? k.pendingApprovals} hint="Need your decision" href="/admin/approvals" tone={(today.approvalsPending ?? k.pendingApprovals) > 0 ? "bad" : undefined} />
                    <Kpi label="Data-quality flags" value={dataQuality.incompleteProfiles ?? 0} hint={`${dataQuality.potentialDuplicates ?? 0} possible duplicates`} href="/admin/data-quality" tone={(dataQuality.incompleteProfiles ?? 0) > 0 ? "warn" : undefined} />
                </KpiRow>
                <KpiRow title="Recruitment">
                    <Kpi label="Active clients" value={k.activeClients} hint={`${k.totalClients} accounts in total`} href="/admin/clients" />
                    <Kpi label="Open positions" value={k.openPositions} hint={`${k.activeJobs} requisitions`} href="/admin/jobs" />
                    <Kpi label="In pipeline" value={k.inPipeline} hint="Screening & rounds" href="/ta/pipeline" />
                    <Kpi label={`Joined · ${k.period ?? "period"}`} value={k.joinedInPeriod ?? 0} hint={`${k.placementsTotal} placements all time`} href="/admin/placements" />
                    <Kpi label="Stuck candidates" value={stuck} hint="Waiting 15+ days" href="/ta/pipeline" tone={stuck > 0 ? "warn" : undefined} />
                    <Kpi label="Team" value={k.teamSize} hint={`${k.recruiters} recruiters · ${k.agents} partners`} href="/admin/team" />
                </KpiRow>
                <KpiRow title="Money">
                    <Kpi label={`Revenue · ${k.period ?? "period"}`} value={lakh(k.revenuePeriod ?? k.revenueThisMonth)} hint={growth(k.revenuePeriodGrowthPct)} href="/finance/dashboard" />
                    <Kpi label="Revenue all time" value={lakh(k.totalRevenue)} hint="Placement billing" href="/finance/dashboard" />
                    <Kpi label="Receivables" value={lakh(k.pendingReceivables)} hint="Not yet collected" href="/finance/dashboard" />
                    <Kpi label="Overdue" value={lakh(k.overdueReceivables || 0)} hint="Past due date" href="/finance/dashboard" tone={(k.overdueReceivables || 0) > 0 ? "bad" : undefined} />
                    <Kpi label="Clients needing attention" value={clientsAtRisk} hint="Payment or SLA risk" href="/admin/clients" tone={clientsAtRisk > 0 ? "warn" : undefined} />
                    <Kpi label="Pending approvals" value={k.pendingApprovals} hint="Requisitions" href="/admin/approvals" tone={k.pendingApprovals > 0 ? "bad" : undefined} />
                </KpiRow>
            </div>

            {/* 3. Sections in tabs so the page stays short */}
            <OverviewTabs tabs={tabs} value={tab} onChange={setTab} />

            {tab === "today" && (<>
                <MyWork />
                {alerts.length > 0 ? (
                    <div className="space-y-3">
                        <h3 className="text-[13px] font-semibold text-neutral-800 flex items-center gap-1.5">
                            <AlertCircle size={15} className="text-amber-500" /> Needs your attention ({alerts.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {alerts.map((alt: { id: string; type: string; title: string; detail: string; link: string }) => (
                                <div key={alt.id} className={`p-4 rounded-xl border flex flex-col justify-between ${alt.type === "URGENT" ? "bg-red-50/50 border-red-200" : alt.type === "WARNING" ? "bg-amber-50/40 border-amber-200" : "bg-blue-50/40 border-blue-200"}`}>
                                    <div>
                                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${alt.type === "URGENT" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{alt.type.toLowerCase()}</span>
                                        <h4 className="mt-2 font-semibold text-neutral-900 text-[13px]">{alt.title}</h4>
                                        <p className="text-[12px] text-neutral-600 mt-0.5">{alt.detail}</p>
                                    </div>
                                    <Link href={alt.link} className="mt-3 text-xs font-medium text-primary hover:underline flex items-center gap-1">Open <ArrowRight size={12} /></Link>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <SectionCard><EmptyState icon={CheckCircle2} message="Nothing needs your attention right now." /></SectionCard>
                )}
            </>)}

            {tab === "positions" && (
                <SectionCard
                    title="Open positions & requisitions"
                    subtitle={`${positions.length} active client requisitions`}
                    action={<Link href="/admin/jobs" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">All jobs <ArrowRight size={12} /></Link>}
                >
                    <PositionsSection positions={positions} />
                </SectionCard>
            )}

            {tab === "pipeline" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <SectionCard title="Recruitment funnel" subtitle="How many candidates reach each stage, and how long they wait there" className="lg:col-span-2">
                        {funnel.length === 0 ? <EmptyState icon={Briefcase} message="No candidates in the pipeline yet." /> : (
                            <div className="space-y-2.5">
                                {funnel.map((f: { stage: string; count: number; conversion: number; avgAgingDays: number }) => {
                                    const max = Math.max(...funnel.map((x: { count: number }) => x.count), 1);
                                    return (
                                        <div key={f.stage}>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="font-medium text-neutral-800">{f.stage.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} <span className="text-neutral-400 font-normal">· avg {f.avgAgingDays}d</span></span>
                                                <span className="flex items-center gap-3"><span className="text-neutral-500">{f.conversion}% move on</span><span className="font-semibold text-neutral-900 w-6 text-right tabular-nums">{f.count}</span></span>
                                            </div>
                                            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(f.count / max) * 100}%` }} /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SectionCard>
                    <SectionCard title="Waiting for next action" subtitle="Days since each candidate last moved">
                        <div className="space-y-2">
                            {agingBuckets.map((b) => (
                                <div key={b.label} className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-100 text-xs">
                                    <span className="flex items-center gap-2 text-neutral-700"><span className={`w-2.5 h-2.5 rounded-full ${b.color}`} />{b.label}</span>
                                    <span className="font-semibold tabular-nums">{b.count}</span>
                                </div>
                            ))}
                        </div>
                        <Link href="/ta/pipeline" className="mt-4 w-full h-9 bg-navy text-white rounded-md text-xs font-medium flex items-center justify-center gap-1.5">Open pipeline <ArrowRight size={13} /></Link>
                    </SectionCard>
                </div>
            )}

            {tab === "team" && (
                <SectionCard title="Recruiter performance" subtitle="Actual output: candidates, interviews, offers, placements and revenue"
                    action={<Link href="/admin/team" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">Team <ArrowRight size={12} /></Link>}>
                    {recruiterPerf.length === 0 ? <EmptyState icon={Briefcase} message="No recruiters yet." /> : (
                        <div className="overflow-x-auto -m-5">
                            <table className="w-full text-xs min-w-[700px]">
                                <thead>
                                    <tr className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-500 font-semibold text-[11px] text-left">
                                        <th className="px-5 py-2.5">Recruiter</th><th className="px-3 py-2.5">Workload</th><th className="px-3 py-2.5 text-right">Candidates</th>
                                        <th className="px-3 py-2.5 text-right">Screened</th><th className="px-3 py-2.5 text-right">Interviews</th><th className="px-3 py-2.5 text-right">Offers</th>
                                        <th className="px-3 py-2.5 text-right">Placed</th><th className="px-3 py-2.5 text-right">Revenue</th><th className="px-5 py-2.5 text-right">Conversion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {recruiterPerf.map((r: { id: string; avatar: string; name: string; role: string; workload: string; candidatesCount: number; screened: number; interviews: number; offers: number; placements: number; revenue: number; conversionRate: number }) => (
                                        <tr key={r.id} className="hover:bg-neutral-50/50">
                                            <td className="px-5 py-3">
                                                <Link href={`/admin/team/${r.id}`} className="flex items-center gap-2 hover:text-primary">
                                                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">{r.avatar}</span>
                                                    <span><span className="block font-semibold text-neutral-900">{r.name}</span><span className="block text-[10px] text-neutral-400">{r.role}</span></span>
                                                </Link>
                                            </td>
                                            <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.workload === "HIGH" ? "bg-red-50 text-red-700" : r.workload === "NORMAL" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>{r.workload.toLowerCase()}</span></td>
                                            <td className="px-3 py-3 text-right tabular-nums">{r.candidatesCount}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{r.screened}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{r.interviews}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{r.offers}</td>
                                            <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-700">{r.placements}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{inr(r.revenue)}</td>
                                            <td className="px-5 py-3 text-right tabular-nums font-semibold text-primary">{r.conversionRate}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            {tab === "clients" && (
                <SectionCard title="Client accounts" subtitle="Open positions, submissions, placements and money owed per client"
                    action={<Link href="/admin/clients" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">All clients <ArrowRight size={12} /></Link>}>
                    {clientHealth.length === 0 ? <EmptyState icon={Briefcase} message="No clients yet." /> : (
                        <div className="overflow-x-auto -m-5">
                            <table className="w-full text-xs min-w-[700px]">
                                <thead>
                                    <tr className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-500 font-semibold text-[11px] text-left">
                                        <th className="px-5 py-2.5">Client</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Open positions</th>
                                        <th className="px-3 py-2.5 text-right">Submissions</th><th className="px-3 py-2.5 text-right">Placements</th><th className="px-3 py-2.5 text-right">Revenue</th>
                                        <th className="px-5 py-2.5 text-right">Receivables</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {[...clientHealth].sort((a: { operationalStatus: string }, b: { operationalStatus: string }) => (RISKY.includes(a.operationalStatus) ? 0 : 1) - (RISKY.includes(b.operationalStatus) ? 0 : 1)).map((c: { id: string; name: string; industry: string; operationalStatus: string; openPositions: number; candidatesSubmitted: number; placements: number; revenue: number; receivables: number }) => (
                                        <tr key={c.id} className="hover:bg-neutral-50/50">
                                            <td className="px-5 py-3"><Link href={`/admin/clients/${c.id}`} className="hover:text-primary"><span className="block font-semibold text-neutral-900">{c.name}</span><span className="block text-[10px] text-neutral-400">{c.industry}</span></Link></td>
                                            <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${c.operationalStatus === "PAYMENT_RISK" ? "bg-red-50 text-red-700" : c.operationalStatus === "NEEDS_ATTENTION" ? "bg-amber-50 text-amber-800" : c.operationalStatus === "INACTIVE" ? "bg-neutral-100 text-neutral-600" : "bg-emerald-50 text-emerald-700"}`}>{c.operationalStatus.replaceAll("_", " ").toLowerCase()}</span></td>
                                            <td className="px-3 py-3 text-right tabular-nums">{c.openPositions}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{c.candidatesSubmitted}</td>
                                            <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-700">{c.placements}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{inr(c.revenue)}</td>
                                            <td className={`px-5 py-3 text-right tabular-nums ${c.receivables > 0 ? "text-amber-700 font-medium" : "text-neutral-500"}`}>{inr(c.receivables)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            {tab === "revenue" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <SectionCard title="Billed vs collected" subtitle="Placement fees billed and money received, last 6 months" className="lg:col-span-2">
                        {revenueTrend.every((m: { revenue: number; collections: number }) => !m.revenue && !m.collections) ? (
                            <EmptyState icon={Briefcase} message="Nothing billed or collected in the last 6 months." />
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={revenueTrend}>
                                    <defs>
                                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2F6AA8" stopOpacity={0.25} /><stop offset="100%" stopColor="#2F6AA8" stopOpacity={0} /></linearGradient>
                                        <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2E8B57" stopOpacity={0.2} /><stop offset="100%" stopColor="#2E8B57" stopOpacity={0} /></linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E7EF" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#7A8699" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#7A8699" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${Math.round(v / 1000)}k`)} />
                                    <Tooltip formatter={(v, name) => [inr(Number(v)), name]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                                    <Legend verticalAlign="top" height={32} iconType="circle" />
                                    <Area name="Billed" type="monotone" dataKey="revenue" stroke="#2F6AA8" strokeWidth={2.5} fill="url(#revGrad)" />
                                    <Area name="Collected" type="monotone" dataKey="collections" stroke="#2E8B57" strokeWidth={2} fill="url(#colGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </SectionCard>
                    <SectionCard title="Receivables by age" subtitle="Unpaid amounts by days since billing">
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={agingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E7EF" vertical={false} />
                                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#7A8699" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: "#7A8699" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
                                <Tooltip formatter={(v) => [inr(Number(v)), "Outstanding"]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                                <Bar dataKey="amount" fill="#E0952A" radius={[6, 6, 0, 0]} maxBarSize={36} />
                            </BarChart>
                        </ResponsiveContainer>
                        <Link href="/finance/dashboard" className="mt-3 text-xs font-medium text-primary hover:underline flex items-center gap-1">Open Finance <ArrowRight size={12} /></Link>
                    </SectionCard>
                </div>
            )}

            {tab === "health" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <SectionCard title="Sourcing channels" subtitle="Which sources bring candidates who join, and the revenue they earn">
                        {sourcePerf.length === 0 ? <EmptyState icon={Briefcase} message="No candidates sourced yet." /> : (
                            <div className="divide-y divide-neutral-100">
                                {sourcePerf.map((s: { source: string; sourced: number; joined: number; revenue: number }) => (
                                    <div key={s.source} className="py-2.5 flex items-center justify-between text-xs">
                                        <div><Badge value={s.source} /><p className="text-[11px] text-neutral-500 mt-1">{s.sourced} sourced</p></div>
                                        <div className="text-right"><p className="font-semibold text-emerald-700">{s.joined} joined</p><p className="text-[11px] text-neutral-700 tabular-nums">{inr(s.revenue)}</p></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                    <SectionCard title="Compliance & platform" subtitle="Consent, integrations and the latest audit entries"
                        action={<Link href="/admin/audit-log" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">Audit log <ArrowRight size={12} /></Link>}>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <Link href="/admin/compliance" className="p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50">
                                <span className="text-[11px] text-neutral-500">Consent recorded (DPDP)</span>
                                <p className="text-xl font-semibold text-neutral-900 mt-1">{data.platformHealth?.consentPct != null ? `${data.platformHealth.consentPct}%` : "—"}</p>
                                <p className="text-[10px] text-neutral-500">{data.platformHealth ? `${data.platformHealth.consented} of ${data.platformHealth.candidates} candidates` : ""}</p>
                            </Link>
                            <Link href="/admin/integrations" className="p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50">
                                <span className="text-[11px] text-neutral-500">Integrations live</span>
                                <p className="text-xl font-semibold text-neutral-900 mt-1">{data.platformHealth ? `${data.platformHealth.integrationsConnected}/${data.platformHealth.integrationsTotal}` : "—"}</p>
                                <p className="text-[10px] text-neutral-500">{data.platformHealth?.integrationsNeedingAttention ? `${data.platformHealth.integrationsNeedingAttention} need setup` : "nothing needs setup"}</p>
                            </Link>
                        </div>
                        <div className="mt-4 space-y-1.5">
                            <p className="text-[11px] font-semibold text-neutral-500">Recent audit entries</p>
                            {(data.recentAudit || []).slice(0, 5).map((log: { id: string; detail: string; actorRole: string; createdAt: string }) => (
                                <div key={log.id} className="text-[11.5px] text-neutral-700 flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <span className="min-w-0">{log.detail} <span className="text-neutral-400">· {log.actorRole.replaceAll("_", " ").toLowerCase()} · {new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}
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
