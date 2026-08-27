"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Users, Clock, Percent } from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";

export default function AdminAttendancePage() {
    const { data, isLoading } = useQuery({
        queryKey: ["admin-attendance"],
        queryFn: async () => (await fetch("/api/portal/attendance")).json(),
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-56 bg-neutral-200/60 rounded-xl animate-pulse" />
                <div className="h-96 bg-white rounded-2xl animate-pulse border border-neutral-100" />
            </div>
        );
    }

    const team = data.teamView ?? [];
    const presentToday = team.filter((t: any) => ["PRESENT", "WFH", "LATE"].includes(t.status)).length;

    return (
        <div className="space-y-6">
            <PageHeader title="Workforce Attendance" subtitle="Live organization-wide attendance & your personal record" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Present Today" value={`${presentToday}/${team.length || "—"}`} icon={Users} tone="emerald" />
                <StatCard label="My Rate (MTD)" value={`${data.summary.attendanceRate}%`} icon={Percent} tone="primary" />
                <StatCard label="My Present Days" value={data.summary.presentDays} icon={CalendarCheck} tone="blue" />
                <StatCard label="Leaves / Absents" value={data.summary.leaves} icon={Clock} tone="amber" />
            </div>

            {/* Today team snapshot */}
            <SectionCard title="Today's Snapshot" subtitle="All active members — live status">
                {team.length === 0 ? (
                    <EmptyState icon={Users} message="No attendance data for today yet." />
                ) : (
                    <div className="overflow-x-auto -m-5">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead>
                                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                                    <th className="px-5 py-3">Member</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Check In</th>
                                    <th className="px-3 py-3">Check Out</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {team.map((t: any) => (
                                    <tr key={t.id} className="hover:bg-neutral-50/60 transition-colors">
                                        <td className="px-5 py-3 font-bold text-neutral-900">{t.userName}</td>
                                        <td className="px-3 py-3"><Badge value={t.status} /></td>
                                        <td className="px-3 py-3 text-neutral-500 font-medium">{t.checkIn ? new Date(t.checkIn).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—"}</td>
                                        <td className="px-3 py-3 text-neutral-500 font-medium">{t.checkOut ? new Date(t.checkOut).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            {/* My recent records */}
            <SectionCard title="My Recent Records" subtitle="Last 14 days">
                <div className="flex flex-wrap gap-1.5">
                    {data.records.slice(0, 14).reverse().map((r: any) => {
                        const tones: Record<string, string> = {
                            PRESENT: "bg-emerald-100 text-emerald-700",
                            WFH: "bg-violet-100 text-violet-700",
                            LATE: "bg-orange-100 text-orange-700",
                            HALF_DAY: "bg-amber-100 text-amber-700",
                            ABSENT: "bg-red-100 text-red-600",
                            ON_LEAVE: "bg-blue-100 text-blue-700",
                        };
                        return (
                            <div key={r.id} title={`${r.date} · ${r.status}`} className={`w-16 rounded-lg px-1 py-1.5 text-center ${tones[r.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                                <p className="text-[9px] font-bold">{new Date(r.date).getDate()}</p>
                                <p className="text-[8px] font-semibold">{r.status.slice(0, 4)}</p>
                            </div>
                        );
                    })}
                </div>
            </SectionCard>
        </div>
    );
}
