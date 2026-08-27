"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, CalendarCheck, Flame } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard } from "@/components/shared/ui";

export default function PortalAttendancePage() {
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["my-attendance"],
        queryFn: async () => (await fetch("/api/portal/attendance")).json(),
        refetchInterval: 30000,
    });

    const punchMutation = useMutation({
        mutationFn: async (action: string) => {
            const res = await fetch("/api/portal/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Attendance recorded.");
            qc.invalidateQueries({ queryKey: ["my-attendance"] });
            qc.invalidateQueries({ queryKey: ["portal-dashboard"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const records: any[] = Array.isArray(data?.records) ? data.records : [];
    const summary = data?.summary ?? {};
    const todayRec = data?.todayRecord ?? null;
    const fmtTime = (iso: string | null) =>
        iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null;

    return (
        <div className="space-y-6">
            <PageHeader title="Attendance" subtitle="Check in & out — your monthly log" />

            {/* Punch card */}
            <div className="bg-gradient-to-br from-primary to-[#0f2e1e] p-6 rounded-3xl text-white shadow-xl shadow-primary/20">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-xs font-bold text-white/60 uppercase tracking-wider">
                            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                        {todayRec ? (
                            <p className="text-2xl font-extrabold mt-1.5">
                                {fmtTime(todayRec.checkIn) ?? "—"}
                                {todayRec.checkOut
                                    ? ` → ${fmtTime(todayRec.checkOut)}`
                                    : <span className="text-base font-bold text-emerald-300 ml-2">● running</span>}
                                {todayRec.hoursWorked > 0 && (
                                    <span className="text-sm font-bold text-white/70 ml-3">{todayRec.hoursWorked}h today</span>
                                )}
                            </p>
                        ) : (
                            <p className="text-2xl font-extrabold mt-1.5">Not checked in yet</p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => punchMutation.mutate("check_in")} disabled={!!todayRec?.checkIn || punchMutation.isPending}
                            className="px-6 py-3 bg-white text-primary rounded-xl text-sm font-extrabold hover:bg-neutral-100 transition-colors disabled:opacity-40 flex items-center gap-2 shadow-lg">
                            <LogIn size={16} /> Check In
                        </button>
                        <button onClick={() => punchMutation.mutate("check_out")} disabled={!todayRec?.checkIn || !!todayRec?.checkOut || punchMutation.isPending}
                            className="px-6 py-3 bg-white/15 border border-white/30 text-white rounded-xl text-sm font-extrabold hover:bg-white/25 transition-colors disabled:opacity-30 flex items-center gap-2 backdrop-blur">
                            <LogOut size={16} /> Check Out
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Present Days" value={`${summary.presentDays ?? 0}`} icon={CalendarCheck} tone="emerald" hint="this month" />
                <StatCard label="Total Hours" value={`${summary.totalHours ?? 0}h`} icon={Flame} tone="primary" />
                <StatCard label="Late / Half" value={`${summary.lateDays ?? 0}/${summary.halfDays ?? 0}`} icon={Flame} tone="amber" />
                <StatCard label="Attendance Rate" value={`${summary.attendanceRate ?? 0}%`} icon={CalendarCheck} tone={(summary.attendanceRate ?? 0) >= 90 ? "emerald" : "blue"} />
            </div>

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : records.length === 0 ? (
                <SectionCard><p className="text-sm text-neutral-400 py-6 text-center">No records yet this month.</p></SectionCard>
            ) : (
                <SectionCard title={`Recent Records (${records.length})`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 -mx-5 px-5">
                        {records.map((a: any) => (
                            <div key={a.id} className="p-3 flex items-center justify-between gap-3 bg-neutral-50 border border-neutral-100 rounded-xl">
                                <div>
                                    <p className="text-xs font-bold text-neutral-800">
                                        {new Date(a.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                                    </p>
                                    <p className="text-[10px] text-neutral-400">
                                        {fmtTime(a.checkIn) ?? "—"} → {fmtTime(a.checkOut) ?? "—"}
                                        {a.hoursWorked > 0 && ` · ${a.hoursWorked}h`}
                                    </p>
                                </div>
                                <Badge value={a.status} />
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
        </div>
    );
}
