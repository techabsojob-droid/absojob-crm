"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Trophy, Target, TrendingUp, Users2 } from "lucide-react";
import {
    PageHeader, SectionCard, EmptyState,
} from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const PIE_COLORS = ["#1B4332", "#2D6A4F", "#40916C", "#52B788", "#74C69D", "#95D5B2", "#B7E4C7"];

export default function ReportsPage() {
    const { data, isLoading } = useQuery({
        queryKey: ["reports"],
        queryFn: async () => (await fetch("/api/admin/reports")).json(),
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-48" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonPulse key={i} className="h-64 rounded-2xl" />)}
                </div>
            </div>
        );
    }

    const maxRevenue = Math.max(...data.clientRevenue.map((c: any) => c.revenue), 1);

    return (
        <div className="space-y-6">
            <PageHeader title="Reports & Analytics" subtitle="Recruiter performance, source effectiveness, client revenue & referral engine health" />

            {/* Recruiter leaderboard */}
            <SectionCard title="Recruiter Leaderboard" subtitle="Ranked by total placements" action={<Trophy size={18} className="text-amber-500" />}>
                <div className="overflow-x-auto -m-5">
                    <table className="w-full text-sm min-w-[600px]">
                        <thead>
                            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                                <th className="px-5 py-3">#</th>
                                <th className="px-3 py-3">Recruiter</th>
                                <th className="px-3 py-3">Active Pipeline</th>
                                <th className="px-3 py-3">Interviews</th>
                                <th className="px-3 py-3">Joined</th>
                                <th className="px-3 py-3">Conversion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {data.recruiterStats.map((r: any, i: number) => (
                                <tr key={r.id} className="hover:bg-neutral-50/60 transition-colors">
                                    <td className="px-5 py-3.5 font-black text-neutral-300">{i + 1}</td>
                                    <td className="px-3 py-3.5 font-bold text-neutral-900">{r.name}</td>
                                    <td className="px-3 py-3.5 font-semibold text-neutral-600">{r.activePipeline}</td>
                                    <td className="px-3 py-3.5 font-semibold text-neutral-600">{r.interviews}</td>
                                    <td className="px-3 py-3.5 font-extrabold text-emerald-600">{r.joined}</td>
                                    <td className="px-3 py-3.5">
                                        <span className={`font-extrabold ${r.conversionRate >= 30 ? "text-emerald-600" : r.conversionRate >= 15 ? "text-amber-500" : "text-red-400"}`}>{r.conversionRate}%</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Source effectiveness */}
                <SectionCard title="Candidate Source Mix" subtitle="Where candidates come from">
                    {data.sourceCounts.every((s: any) => s.candidates === 0) ? (
                        <EmptyState icon={Target} message="No sourcing data yet." />
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={230}>
                                <PieChart>
                                    <Pie data={data.sourceCounts.filter((s: any) => s.candidates > 0)} dataKey="candidates" nameKey="source" innerRadius={55} outerRadius={90} paddingAngle={3}>
                                        {data.sourceCounts.filter((s: any) => s.candidates > 0).map((_: any, i: number) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: any, n: any) => [`${v} candidates`, String(n).replaceAll("_", " ")]}
                                        contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                                {data.sourceCounts.filter((s: any) => s.candidates > 0).map((s: any, i: number) => (
                                    <span key={s.source} className="text-[10px] font-bold text-neutral-500 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                        {s.source.replaceAll("_", " ")} ({s.candidates})
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </SectionCard>

                {/* Monthly trend */}
                <SectionCard title="Placement Trend" subtitle="Joins per month (last 6)">
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={data.monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                            <Line type="monotone" dataKey="placements" stroke="#1B4332" strokeWidth={2.5} dot={{ r: 4, fill: "#1B4332" }} />
                        </LineChart>
                    </ResponsiveContainer>
                </SectionCard>
            </div>

            {/* Client revenue */}
            <SectionCard title="Client Revenue Leaderboard" subtitle="Lifetime placement commission per client">
                <div className="space-y-3">
                    {data.clientRevenue.slice(0, 8).map((c: any) => (
                        <div key={c.clientName}>
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-bold text-neutral-700 flex items-center gap-2">
                                    <BarChart3 size={13} className="text-neutral-300" /> {c.clientName}
                                    {c.openJobs > 0 && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">{c.openJobs} open</span>}
                                </span>
                                <span className="font-extrabold text-neutral-900">₹{c.revenue.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-primary to-emerald-700 rounded-full transition-all" style={{ width: `${(c.revenue / maxRevenue) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Referral engine */}
            <SectionCard title="Referral Engine Health" subtitle={`${data.referralStats.total} lifetime referrals · ${data.referralStats.hired} hired · ₹${data.referralStats.incentiveTotal.toLocaleString("en-IN")} incentives`} action={<Users2 size={18} className="text-primary" />}>
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.referralStats.byAgent}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="referrals" name="Referrals" fill="#95D5B2" radius={[6, 6, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="hires" name="Hires" fill="#1B4332" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>
        </div>
    );
}
