"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardCheck, History, Users } from "lucide-react";
import PortalAttendancePage from "@/app/portal/attendance/page";
import PortalLeavePage from "@/app/portal/leave/page";
import Link from "next/link";
import { PageHeader, SectionCard, EmptyState, Badge, ModalShell, StatCard } from "@/components/shared/ui";
import { ErrorState, SkeletonPulse } from "@/components/shared/UIStates";
import { ago, btn, inputCls, Tabs, useAct } from "@/components/finance/kit";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { CalendarCheck, CalendarOff, AlarmClock, UserX, Home } from "lucide-react";

interface Day { date: string; status: string; checkIn: string | null; checkOut: string | null; hours: number; lateByMinutes: number; leaveType: string | null; holiday: string | null }
interface Member {
    id: string; name: string; designation: string | null; employeeCode: string | null;
    today: { status: string; checkIn: string | null; checkOut: string | null; hours: number; lateByMinutes: number; mode: string | null };
    summary: { workingDays: number; present: number; late: number; halfDay: number; wfh: number; onLeave: number; absent: number; hours: number; attendanceRate: number; avgHours: number };
    days: Day[];
}
interface Correction { id: string; userId: string | null; employeeName: string; date: string; originalCheckIn: string | null; originalCheckOut: string | null; requestedCheckIn: string; requestedCheckOut: string; reason: string; status: string; reviewedByName?: string | null; reviewedAt?: string | null; reviewNote?: string | null; requestedAt?: string | null }
interface Data {
    month: string; today: string; members: Member[];
    snapshot: Record<string, number>;
    monthTotals: Record<string, number>;
    corrections: Correction[]; pendingCount: number;
    pendingLeave: { id: string; userId: string; name: string; leaveType: string; fromDate: string; toDate: string; halfDay: string | null; days: number | null; reason: string }[];
    history: { id: string; action: string; detail: string; createdAt: string; actorUserId: string }[];
}

const CELL: Record<string, string> = {
    PRESENT: "bg-emerald-100 text-emerald-800", LATE: "bg-amber-100 text-amber-800", HALF_DAY: "bg-orange-100 text-orange-800",
    WFH: "bg-violet-100 text-violet-800", ON_LEAVE: "bg-sky-100 text-sky-800", ABSENT: "bg-rose-100 text-rose-700",
    HOLIDAY: "bg-fuchsia-50 text-fuchsia-700", WEEK_OFF: "bg-neutral-50 text-neutral-300", UPCOMING: "bg-white text-neutral-200", NOT_MARKED: "bg-white text-primary ring-1 ring-primary/40",
};
const SHORT: Record<string, string> = { PRESENT: "P", LATE: "L", HALF_DAY: "H", WFH: "W", ON_LEAVE: "LV", ABSENT: "A", HOLIDAY: "HO", WEEK_OFF: "·", UPCOMING: "", NOT_MARKED: "?" };
const LABEL: Record<string, string> = { PRESENT: "Present", LATE: "Late", HALF_DAY: "Half day", WFH: "WFH", ON_LEAVE: "On leave", ABSENT: "Absent", HOLIDAY: "Holiday", WEEK_OFF: "Week off", NOT_MARKED: "Not marked" };
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—");
const shiftMonth = (m: string, n: number) => { const d = new Date(`${m}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };

function TeamAttendance() {
    const [month, setMonth] = useState<string | null>(null);
    const [userId, setUserId] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [decide, setDecide] = useState<{ c: Correction; approve: boolean } | null>(null);
    const [note, setNote] = useState("");
    const qs = new URLSearchParams(month ? { month } : {}).toString();
    const { data, isLoading, isError, error, refetch } = useQuery<Data>({ queryKey: ["ta-team-attendance", qs], queryFn: () => api(`/api/ta/team-attendance?${qs}`), refetchInterval: 60000, placeholderData: (p) => p });
    const act = useAct<{ success: boolean }>("/api/ta/team-attendance", "PATCH", ["ta-team-attendance"], "Decision recorded");

    if (isError && !data) return <ErrorState description={(error as Error).message} onRetry={() => refetch()} />;
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const m = month ?? data.month;
    const s = data.snapshot;
    const members = data.members.filter((x) => (userId === "ALL" || x.id === userId) && (statusFilter === "ALL" || x.today.status === statusFilter));
    const pending = data.corrections.filter((c) => c.status === "PENDING");
    const decided = data.corrections.filter((c) => c.status !== "PENDING");

    if (data.members.length === 0) {
        return <SectionCard><EmptyState icon={Users} message="No recruiters report to you yet. Super Admin sets each recruiter's reporting manager in Admin › Team." /></SectionCard>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <StatCard label="Present today" value={`${(s.PRESENT ?? 0) + (s.WFH ?? 0)}/${s.size}`} icon={CalendarCheck} tone="emerald" hint={s.WFH ? `${s.WFH} WFH` : undefined} />
                <StatCard label="Late" value={s.LATE ?? 0} icon={AlarmClock} tone={s.LATE ? "amber" : "neutral"} />
                <StatCard label="Half day" value={s.HALF_DAY ?? 0} icon={Home} tone="purple" />
                <StatCard label="On leave" value={s.ON_LEAVE ?? 0} icon={CalendarOff} tone="blue" />
                <StatCard label="Absent" value={s.ABSENT ?? 0} icon={UserX} tone={s.ABSENT ? "red" : "neutral"} />
                <StatCard label="Not marked" value={s.NOT_MARKED ?? 0} icon={ClipboardCheck} tone="neutral" hint="No check-in yet today" />
            </div>

            {data.pendingLeave.length > 0 && (
                <SectionCard title={`Leave requests awaiting you (${data.pendingLeave.length})`} subtitle="Approve or reject on the Leave tab — balances and policy rules are checked there"
                    action={<Link href="/ta/attendance?tab=leave" className={btn.primary}>Review leave</Link>}>
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.pendingLeave.map((l) => (
                            <li key={l.id} className="py-2 flex justify-between gap-3">
                                <span><b>{l.name}</b> · {l.leaveType.toLowerCase().replace("_", "-")} · {l.halfDay ? `${l.fromDate} (half)` : l.fromDate === l.toDate ? l.fromDate : `${l.fromDate} → ${l.toDate}`}{l.days ? ` · ${l.days} day(s)` : ""}</span>
                                <span className="text-xs text-neutral-500 truncate max-w-[50%]">{l.reason}</span>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}

            {pending.length > 0 && (
                <SectionCard title={`Regularization requests (${pending.length})`} subtitle="Approving updates the attendance record; every decision is audit-logged">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-[10px] text-neutral-500 uppercase"><th className="py-2">Recruiter</th><th>Date</th><th>Recorded</th><th>Requested</th><th>Reason</th><th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {pending.map((c) => (
                                    <tr key={c.id}>
                                        <td className="py-2.5 font-semibold">{c.employeeName}{c.requestedAt && <span className="block text-[10px] text-neutral-400 font-normal">raised {ago(c.requestedAt)}</span>}</td>
                                        <td className="text-xs">{c.date}</td>
                                        <td className="text-xs text-neutral-500">{c.originalCheckIn ? `${time(c.originalCheckIn)} – ${time(c.originalCheckOut)}` : "No punch"}</td>
                                        <td className="text-xs font-bold">{c.requestedCheckIn} – {c.requestedCheckOut}</td>
                                        <td className="text-xs max-w-xs">{c.reason}</td>
                                        <td className="text-right whitespace-nowrap space-x-1.5">
                                            <button className={btn.good} onClick={() => { setNote(""); setDecide({ c, approve: true }); }}>Approve</button>
                                            <button className={btn.danger} onClick={() => { setNote(""); setDecide({ c, approve: false }); }}>Reject</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            <SectionCard title="Team register" subtitle={new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={userId} onChange={(e) => setUserId(e.target.value)} className={`${inputCls} !w-auto !py-1.5 !text-xs`} aria-label="Recruiter">
                            <option value="ALL">All recruiters</option>
                            {data.members.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} !w-auto !py-1.5 !text-xs`} aria-label="Today's status">
                            <option value="ALL">Any status today</option>
                            {["PRESENT", "LATE", "HALF_DAY", "WFH", "ON_LEAVE", "ABSENT", "NOT_MARKED"].map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}
                        </select>
                        <div className="flex gap-1">
                            <button onClick={() => setMonth(shiftMonth(m, -1))} className="p-1.5 rounded-lg border border-neutral-200" aria-label="Previous month"><ChevronLeft size={14} /></button>
                            <button disabled={m >= data.today.slice(0, 7)} onClick={() => setMonth(shiftMonth(m, 1))} className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-30" aria-label="Next month"><ChevronRight size={14} /></button>
                        </div>
                    </div>
                }>
                {members.length === 0 ? <EmptyState icon={Users} message="No one matches this filter." /> : (
                    <div className="overflow-x-auto">
                        <table className="text-xs border-separate border-spacing-0.5">
                            <thead>
                                <tr className="text-[10px] text-neutral-400">
                                    <th className="text-left pr-3 sticky left-0 bg-white min-w-[160px]">Recruiter</th>
                                    {members[0].days.map((d) => <th key={d.date} className={`w-7 font-bold ${d.date === data.today ? "text-primary" : ""}`}>{Number(d.date.slice(8))}</th>)}
                                    <th className="pl-3 text-left">Present</th><th className="text-left">Late</th><th className="text-left">Half</th><th className="text-left">Leave</th><th className="text-left">Absent</th><th className="text-left">Hours</th><th className="text-left">Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((x) => (
                                    <tr key={x.id}>
                                        <td className="pr-3 sticky left-0 bg-white py-1">
                                            <span className="font-semibold text-neutral-800 text-sm">{x.name}</span>
                                            <span className="block text-[10px] text-neutral-400">Today: {LABEL[x.today.status] ?? x.today.status}{x.today.checkIn ? ` · in ${time(x.today.checkIn)}` : ""}{x.today.checkOut ? ` · out ${time(x.today.checkOut)}` : ""}</span>
                                        </td>
                                        {x.days.map((d) => (
                                            <td key={d.date} title={[d.date, d.holiday ?? LABEL[d.status] ?? d.status, d.leaveType ? `${d.leaveType.toLowerCase()} leave` : null, d.checkIn ? `${time(d.checkIn)} – ${time(d.checkOut)} (${d.hours}h)` : null, d.lateByMinutes ? `${d.lateByMinutes} min late` : null].filter(Boolean).join(" · ")}
                                                className={`w-7 h-7 text-center rounded-md text-[10px] font-bold ${CELL[d.status] ?? CELL.UPCOMING}`}>{SHORT[d.status] ?? ""}</td>
                                        ))}
                                        <td className="pl-3 font-mono">{x.summary.present}/{x.summary.workingDays}</td>
                                        <td className="font-mono">{x.summary.late}</td>
                                        <td className="font-mono">{x.summary.halfDay}</td>
                                        <td className="font-mono">{x.summary.onLeave}</td>
                                        <td className={`font-mono ${x.summary.absent ? "text-rose-600 font-bold" : ""}`}>{x.summary.absent}</td>
                                        <td className="font-mono">{x.summary.hours}h</td>
                                        <td className="font-mono">{x.summary.attendanceRate}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">{["PRESENT", "LATE", "HALF_DAY", "WFH", "ON_LEAVE", "ABSENT", "HOLIDAY", "WEEK_OFF"].map((k) => <span key={k} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CELL[k]}`}>{SHORT[k] || "·"} = {LABEL[k]}</span>)}</div>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title="Decided requests" subtitle="Regularization history">
                    {decided.length === 0 ? <EmptyState icon={ClipboardCheck} message="No decided requests yet." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm max-h-80 overflow-y-auto">
                            {decided.map((c) => (
                                <li key={c.id} className="py-2 flex items-start justify-between gap-3">
                                    <span><b>{c.employeeName}</b> · {c.date} · {c.requestedCheckIn}–{c.requestedCheckOut}<span className="block text-[11px] text-neutral-500">{c.reviewedByName ? `by ${c.reviewedByName}` : ""}{c.reviewedAt ? ` · ${ago(c.reviewedAt)}` : ""}{c.reviewNote ? ` — ${c.reviewNote}` : ""}</span></span>
                                    <Badge value={c.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
                <SectionCard title="Audit trail" subtitle="Who decided what, and the change applied">
                    {data.history.length === 0 ? <EmptyState icon={History} message="No attendance decisions recorded." /> : (
                        <ul className="divide-y divide-neutral-100 text-xs max-h-80 overflow-y-auto">
                            {data.history.map((h) => <li key={h.id} className="py-2"><span className="font-bold">{h.action.replace(/_/g, " ").toLowerCase()}</span> · {h.detail}<span className="block text-neutral-400">{new Date(h.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span></li>)}
                        </ul>
                    )}
                </SectionCard>
            </div>

            <ModalShell open={!!decide} onClose={() => setDecide(null)} title={decide ? `${decide.approve ? "Approve" : "Reject"} — ${decide.c.employeeName}, ${decide.c.date}` : ""}>
                {decide && (
                    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act.mutate({ id: decide.c.id, decision: decide.approve ? "approve" : "reject", note }, { onSuccess: () => setDecide(null) }); }}>
                        <p className="text-xs text-neutral-600">Requested {decide.c.requestedCheckIn}–{decide.c.requestedCheckOut}. {decide.approve ? "The day will be updated to Present (or Half day if under half a shift)." : "The record stays as it is."}</p>
                        <textarea required={!decide.approve} rows={3} placeholder={decide.approve ? "Note (optional)" : "Reason for rejecting (required)"} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
                        <button disabled={act.isPending} className={`w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${decide.approve ? "bg-emerald-600" : "bg-rose-600"}`}>{act.isPending ? "Saving…" : decide.approve ? "Approve" : "Reject"}</button>
                    </form>
                )}
            </ModalShell>
        </div>
    );
}

function AttendanceInner() {
    const { user } = useAuth();
    const params = useSearchParams();
    const router = useRouter();
    const isLead = user?.role === "TA_MANAGER" || user?.role === "SUPER_ADMIN";
    const asked = params.get("tab");
    const tab: "me" | "leave" | "team" = asked === "leave" ? "leave" : asked === "team" && isLead ? "team" : "me";
    const setTab = (t: "me" | "leave" | "team") => router.replace(t === "me" ? "/ta/attendance" : `/ta/attendance?tab=${t}`);
    const tabs: { id: "me" | "leave" | "team"; label: string }[] = [
        { id: "me", label: "My attendance" },
        { id: "leave", label: isLead ? "Leave (mine + approvals)" : "Leave" },
        ...(isLead ? [{ id: "team" as const, label: "Team attendance" }] : []),
    ];
    return (
        <div className="space-y-6">
            <PageHeader title="Attendance & Leave" subtitle={isLead ? "Check in / out, apply leave, and manage your team's attendance, leave and regularization" : "Check in / out, apply leave and request attendance corrections"} />
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
            {tab === "me" ? <PortalAttendancePage /> : tab === "leave" ? <PortalLeavePage /> : <TeamAttendance />}
        </div>
    );
}

export default function TaAttendancePage() {
    return <Suspense fallback={<SkeletonPulse className="h-96 w-full" />}><AttendanceInner /></Suspense>;
}
