"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut, CalendarCheck, Clock, AlarmClock, Home, ChevronLeft, ChevronRight, CalendarOff } from "lucide-react";
import { PageHeader, StatCard, SectionCard, Badge, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { inputCls, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Day { date: string; status: string; checkIn: string | null; checkOut: string | null; hours: number; mode: string | null; lateByMinutes: number; holiday: string | null; leaveType: string | null; halfDayLeave: string | null; workedOnOffDay: boolean }
interface Data {
    month: string;
    shift: { name: string; startTime: string; endTime: string; graceMinutes: number; workingHours: number };
    today: { date: string; holiday: string | null; weekOff: boolean; onLeave: { type: string; halfDay: string | null } | null; wfhAllowed: boolean; workMode: string; record: { checkIn: string | null; checkOut: string | null; status: string; hoursWorked: number; lateByMinutes?: number; mode?: string } | null };
    days: Day[];
    summary: { workingDays: number; present: number; late: number; halfDay: number; wfh: number; onLeave: number; absent: number; holidays: number; hours: number; lateMinutes: number; attendanceRate: number; avgHours: number };
    corrections: { id: string; date: string; requestedCheckIn: string; requestedCheckOut: string; status: string }[];
}

const CELL: Record<string, string> = {
    PRESENT: "bg-emerald-50 border-emerald-200 text-emerald-800", LATE: "bg-amber-50 border-amber-200 text-amber-800", HALF_DAY: "bg-orange-50 border-orange-200 text-orange-800",
    WFH: "bg-violet-50 border-violet-200 text-violet-800", ON_LEAVE: "bg-sky-50 border-sky-200 text-sky-800", ABSENT: "bg-rose-50 border-rose-200 text-rose-700",
    HOLIDAY: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800", WEEK_OFF: "bg-neutral-50 border-neutral-100 text-neutral-400", UPCOMING: "bg-white border-neutral-100 text-neutral-300", NOT_MARKED: "bg-white border-primary/40 text-primary",
};
const LABEL: Record<string, string> = { PRESENT: "Present", LATE: "Late", HALF_DAY: "Half day", WFH: "WFH", ON_LEAVE: "Leave", ABSENT: "Absent", HOLIDAY: "Holiday", WEEK_OFF: "Off", UPCOMING: "", NOT_MARKED: "Today" };
const t = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—");
const shiftMonth = (m: string, n: number) => { const d = new Date(`${m}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };

export default function PortalAttendancePage() {
    const [month, setMonth] = useState<string | null>(null);
    const { data, isLoading } = useQuery<Data>({ queryKey: ["my-attendance", month], queryFn: () => api(`/api/portal/attendance${month ? `?month=${month}` : ""}`), refetchInterval: 60000 });
    const punch = useAct<{ status: string }>("/api/portal/attendance", "POST", ["my-attendance", "portal-dashboard"], (r) => `Recorded — ${r.status.replace("_", " ").toLowerCase()}`);
    const regularize = useAct("/api/hr/employee-requests", "POST", ["my-attendance", "my-requests"], "Correction sent for approval");
    const [fix, setFix] = useState<Day | null>(null);
    const [fixForm, setFixForm] = useState({ requestedCheckIn: "09:30", requestedCheckOut: "18:30", description: "" });

    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const { today, shift, summary: s } = data;
    const rec = today.record;
    const m = month ?? data.month;
    const firstDow = new Date(`${m}-01T00:00:00Z`).getUTCDay();
    const pendingFor = new Set(data.corrections.filter((c) => c.status === "PENDING").map((c) => c.date));

    return (
        <div className="space-y-6">
            <PageHeader title="Attendance" subtitle={`${shift.name} · ${shift.startTime}–${shift.endTime} · ${shift.graceMinutes} min grace`} />

            <div className="bg-gradient-to-br from-primary to-[#0f2e1e] p-6 rounded-3xl text-white">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-xs font-bold text-white/60 uppercase tracking-wider">{new Date(`${today.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</p>
                        {rec?.checkIn ? (
                            <p className="text-2xl font-extrabold mt-1.5">{t(rec.checkIn)}{rec.checkOut ? ` → ${t(rec.checkOut)}` : <span className="text-base font-bold text-emerald-300 ml-2">● working</span>}
                                {rec.hoursWorked > 0 && <span className="text-sm font-bold text-white/70 ml-3">{rec.hoursWorked}h</span>}
                                {(rec.lateByMinutes ?? 0) > 0 && <span className="text-sm font-bold text-amber-300 ml-3">{rec.lateByMinutes} min late</span>}
                            </p>
                        ) : <p className="text-2xl font-extrabold mt-1.5">{today.onLeave && !today.onLeave.halfDay ? `On ${today.onLeave.type.toLowerCase()} leave` : today.holiday ? `Holiday — ${today.holiday}` : today.weekOff ? "Week off" : "Not checked in yet"}</p>}
                        {(today.holiday || today.weekOff) && !rec?.checkIn && <p className="text-xs text-white/70 mt-1">Working today earns a comp-off.</p>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => punch.mutate({ action: "check_in", mode: "OFFICE" })} disabled={!!rec?.checkIn || punch.isPending || (!!today.onLeave && !today.onLeave.halfDay)} className="px-5 py-3 bg-white text-primary rounded-xl text-sm font-extrabold disabled:opacity-40 flex items-center gap-2"><LogIn size={16} /> Check in</button>
                        {today.wfhAllowed && <button onClick={() => punch.mutate({ action: "check_in", mode: "WFH" })} disabled={!!rec?.checkIn || punch.isPending} className="px-5 py-3 bg-white/90 text-violet-700 rounded-xl text-sm font-extrabold disabled:opacity-40 flex items-center gap-2"><Home size={16} /> Check in (WFH)</button>}
                        <button onClick={() => punch.mutate({ action: "check_out" })} disabled={!rec?.checkIn || !!rec?.checkOut || punch.isPending} className="px-5 py-3 bg-white/15 border border-white/30 text-white rounded-xl text-sm font-extrabold disabled:opacity-30 flex items-center gap-2"><LogOut size={16} /> Check out</button>
                    </div>
                </div>
                {!today.wfhAllowed && <p className="text-[11px] text-white/60 mt-3">Working from home today? <Link href="/portal/requests?new=WFH" className="underline font-bold">Request WFH</Link> — the WFH check-in appears once approved.</p>}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard label="Present" value={`${s.present}/${s.workingDays}`} icon={CalendarCheck} tone="emerald" hint={`${s.attendanceRate}% attendance`} />
                <StatCard label="Late marks" value={s.late} icon={AlarmClock} tone={s.late ? "amber" : "blue"} hint={`${s.lateMinutes} min total`} />
                <StatCard label="Half days · WFH" value={`${s.halfDay} · ${s.wfh}`} icon={Home} tone="purple" />
                <StatCard label="Leave · Absent" value={`${s.onLeave} · ${s.absent}`} icon={CalendarOff} tone={s.absent ? "amber" : "blue"} />
                <StatCard label="Hours" value={`${s.hours}h`} icon={Clock} tone="primary" hint={`avg ${s.avgHours}h / day`} />
            </div>

            <SectionCard title={new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}
                action={<div className="flex gap-1"><button onClick={() => setMonth(shiftMonth(m, -1))} className="p-1.5 rounded-lg border border-neutral-200" aria-label="Previous month"><ChevronLeft size={14} /></button><button disabled={m >= today.date.slice(0, 7)} onClick={() => setMonth(shiftMonth(m, 1))} className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-30" aria-label="Next month"><ChevronRight size={14} /></button></div>}>
                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-neutral-400 mb-1.5">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}</div>
                <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} />)}
                    {data.days.map((d) => {
                        const canFix = ["ABSENT", "LATE", "HALF_DAY", "NOT_MARKED"].includes(d.status) && d.date <= today.date && !pendingFor.has(d.date);
                        return (
                            <button key={d.date} disabled={!canFix} onClick={() => { setFix(d); setFixForm({ requestedCheckIn: shift.startTime, requestedCheckOut: shift.endTime, description: "" }); }}
                                title={[d.holiday, d.leaveType ? `${d.leaveType.toLowerCase()} leave${d.halfDayLeave ? " (half)" : ""}` : null, d.checkIn ? `${t(d.checkIn)} – ${t(d.checkOut)}` : null, canFix ? "Click to regularise" : null].filter(Boolean).join(" · ")}
                                className={`min-h-[62px] rounded-xl border p-1.5 text-left ${CELL[d.status] ?? CELL.UPCOMING} ${canFix ? "hover:ring-2 hover:ring-primary/30 cursor-pointer" : "cursor-default"}`}>
                                <span className="text-xs font-extrabold">{Number(d.date.slice(8))}</span>
                                <span className="block text-[9px] font-bold leading-tight truncate">{d.holiday ?? LABEL[d.status]}{pendingFor.has(d.date) ? " · fix pending" : ""}</span>
                                {d.hours > 0 && <span className="block text-[9px] opacity-70">{d.hours}h{d.workedOnOffDay ? " · comp-off" : ""}</span>}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-2 mt-4">{["PRESENT", "LATE", "HALF_DAY", "WFH", "ON_LEAVE", "ABSENT", "HOLIDAY", "WEEK_OFF"].map((k) => <span key={k} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CELL[k]}`}>{LABEL[k]}</span>)}</div>
                <p className="text-[11px] text-neutral-400 mt-2">Missed a punch or marked late by mistake? Click the day to request a correction — it goes to your manager / HR.</p>
            </SectionCard>

            {data.corrections.length > 0 && (
                <SectionCard title="My correction requests">
                    <ul className="divide-y divide-neutral-100 text-sm">{data.corrections.map((c) => <li key={c.id} className="py-2 flex justify-between"><span>{c.date} · {c.requestedCheckIn}–{c.requestedCheckOut}</span><Badge value={c.status} /></li>)}</ul>
                </SectionCard>
            )}

            <ModalShell open={!!fix} onClose={() => setFix(null)} title={fix ? `Regularise ${fix.date}` : ""}>
                {fix && (
                    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); regularize.mutate({ type: "ATTENDANCE_CORRECTION", date: fix.date, ...fixForm }, { onSuccess: () => setFix(null) }); }}>
                        <p className="text-xs text-neutral-500">Recorded: {fix.checkIn ? `${t(fix.checkIn)} – ${t(fix.checkOut)}` : "no punch"} ({LABEL[fix.status] || fix.status})</p>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-xs font-bold text-neutral-600">Actual check-in<input required type="time" value={fixForm.requestedCheckIn} onChange={(e) => setFixForm({ ...fixForm, requestedCheckIn: e.target.value })} className={inputCls} /></label>
                            <label className="text-xs font-bold text-neutral-600">Actual check-out<input required type="time" value={fixForm.requestedCheckOut} onChange={(e) => setFixForm({ ...fixForm, requestedCheckOut: e.target.value })} className={inputCls} /></label>
                        </div>
                        <textarea required rows={3} placeholder="Reason (e.g. forgot to punch, client visit)" value={fixForm.description} onChange={(e) => setFixForm({ ...fixForm, description: e.target.value })} className={inputCls} />
                        <button disabled={regularize.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit correction</button>
                    </form>
                )}
            </ModalShell>
        </div>
    );
}
