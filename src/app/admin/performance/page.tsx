"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, Target, CheckCircle2, Award, ArrowUpRight, Clock, Building2, Calendar, Filter } from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export default function PerformancePage() {
    const [period, setPeriod] = useState("THIS_MONTH");

    const { data, isLoading } = useQuery({
        queryKey: ["admin-reports"],
        queryFn: async () => {
            const res = await fetch("/api/admin/reports");
            if (!res.ok) throw new Error();
            return res.json();
        },
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-64" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonPulse key={i} className="h-24 rounded-2xl" />)}
                </div>
                <SkeletonPulse className="h-72 rounded-2xl" />
            </div>
        );
    }

    const recruiters = data.recruiterStats || [];
    const totalJoined = recruiters.reduce((acc: number, r: any) => acc + (r.joined || 0), 0);
    const totalInterviews = recruiters.reduce((acc: number, r: any) => acc + (r.interviews || 0), 0);
    const avgConversion = recruiters.length ? Math.round(recruiters.reduce((acc: number, r: any) => acc + (r.conversionRate || 0), 0) / recruiters.length) : 0;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Recruiter & Squad Operational Performance"
                subtitle="Factual operational deliverables — candidate pipeline velocity, interview to offer ratios & placement output"
            />

            {/* Performance KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Hired (YTD)" value={totalJoined} icon={Award} tone="emerald" hint="placements generated" />
                <StatCard label="Interviews Facilitated" value={totalInterviews} icon={Users} tone="primary" hint="client rounds conducted" />
                <StatCard label="Avg Conversion Rate" value={`${avgConversion}%`} icon={TrendingUp} tone="blue" hint="screening to offer ratio" />
                <StatCard label="Average Time to Hire" value="18 Days" icon={Clock} tone="purple" hint="from sourcing to acceptance" />
            </div>

            {/* Recruiter Throughput Chart */}
            <SectionCard title="Recruiter Deliverables Benchmark" subtitle="Active pipeline vs interviews conducted vs joined candidates">
                <div className="h-72 w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={recruiters}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#666" }} axisLine={{ stroke: "#e5e5e5" }} />
                            <YAxis tick={{ fontSize: 11, fill: "#666" }} axisLine={{ stroke: "#e5e5e5" }} />
                            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #eee", fontSize: "12px" }} />
                            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                            <Bar dataKey="activePipeline" fill="#1B4332" name="Active Candidates" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="interviews" fill="#52B788" name="Interviews" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="joined" fill="#D97706" name="Placements (Joined)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </SectionCard>

            {/* Detailed Operational Table */}
            <SectionCard title="Individual Recruiter Scorecard" subtitle="Transparent team metrics without arbitrary ratings">
                <div className="overflow-x-auto -m-5">
                    <table className="w-full text-xs min-w-[700px]">
                        <thead>
                            <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                                <th className="px-5 py-3.5">Recruiter</th>
                                <th className="px-3 py-3.5">Active Candidates</th>
                                <th className="px-3 py-3.5">Interviews Held</th>
                                <th className="px-3 py-3.5">Placements (Joined)</th>
                                <th className="px-3 py-3.5">Pipeline Conversion</th>
                                <th className="px-3 py-3.5">Avg Turnaround</th>
                                <th className="px-5 py-3.5 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {recruiters.map((r: any) => (
                                <tr key={r.id} className="hover:bg-neutral-50/60 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <p className="font-bold text-neutral-900 text-xs">{r.name}</p>
                                        <p className="text-[10px] text-neutral-400">Talent Acquisition Specialist</p>
                                    </td>
                                    <td className="px-3 py-3.5 font-bold text-neutral-800">{r.activePipeline}</td>
                                    <td className="px-3 py-3.5 font-semibold text-neutral-600">{r.interviews}</td>
                                    <td className="px-3 py-3.5 font-extrabold text-emerald-600">{r.joined}</td>
                                    <td className="px-3 py-3.5">
                                        <span className={`font-bold ${r.conversionRate >= 25 ? "text-emerald-600" : "text-amber-600"}`}>
                                            {r.conversionRate}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-3.5 text-neutral-500 font-medium">16 Days</td>
                                    <td className="px-5 py-3.5 text-right">
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                                            Active Capacity
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>
        </div>
    );
}
