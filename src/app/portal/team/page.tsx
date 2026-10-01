"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, CalendarOff, Clock, ShieldAlert, Home, Check, X } from "lucide-react";
import { PageHeader, StatCard, SectionCard, Badge, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Member { id: string; name: string; designation: string; email: string; phone: string; workMode: string | null; today: string; checkIn: string | null; hoursToday: number; lateThisMonth: number; probationEndDate: string | null; upcomingLeave: { id: string; type: string; fromDate: string; toDate: string; status: string }[] }
interface Data {
    isManager: boolean; members: Member[];
    summary: { size: number; present: number; onLeave: number; notMarked: number; probationDue: number };
    approvals: { leave: number; expenses: number; reviews: number; wfh: { id: string; employeeName: string; startDate: string; endDate: string; days: number; reason: string }[]; corrections: { id: string; employeeName: string; date: string; requestedCheckIn: string; requestedCheckOut: string; reason: string }[] };
}

export default function MyTeamPage() {
    const { data, isLoading } = useQuery<Data>({ queryKey: ["my-team"], queryFn: () => api("/api/portal/team"), refetchInterval: 60000 });
    const decide = useAct("/api/portal/team", "PATCH", ["my-team", "portal-dashboard"], "Decision recorded — employee notified");
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    if (!data.isManager) return <SectionCard><EmptyState icon={Users} message="No one reports to you yet." /></SectionCard>;
    const a = data.approvals;
    const reject = (kind: string, id: string) => { const note = window.prompt("Reason for rejecting?"); if (note) decide.mutate({ kind, id, decision: "reject", note }); };

    return (
        <div className="space-y-6">
            <PageHeader title="My Team" subtitle="Today's attendance, leave and everything waiting for your approval" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="Team size" value={data.summary.size} icon={Users} tone="blue" />
                <StatCard label="Working today" value={data.summary.present} icon={UserCheck} tone="emerald" />
                <StatCard label="On leave" value={data.summary.onLeave} icon={CalendarOff} tone="purple" />
                <StatCard label="Not checked in" value={data.summary.notMarked} icon={Clock} tone={data.summary.notMarked ? "amber" : "blue"} />
                <StatCard label="Probation due (30d)" value={data.summary.probationDue} icon={ShieldAlert} tone={data.summary.probationDue ? "amber" : "blue"} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Link href="/portal/leave" className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-primary"><p className="text-xs font-bold text-neutral-500">Leave to approve</p><p className="text-2xl font-extrabold">{a.leave}</p></Link>
                <Link href="/portal/expenses" className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-primary"><p className="text-xs font-bold text-neutral-500">Expense claims</p><p className="text-2xl font-extrabold">{a.expenses}</p></Link>
                <Link href="/portal/performance" className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-primary"><p className="text-xs font-bold text-neutral-500">Reviews to complete</p><p className="text-2xl font-extrabold">{a.reviews}</p></Link>
            </div>

            {(a.wfh.length > 0 || a.corrections.length > 0) && (
                <SectionCard title={`WFH & attendance corrections (${a.wfh.length + a.corrections.length})`}>
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {a.wfh.map((w) => (
                            <li key={w.id} className="py-3 flex items-center justify-between gap-3">
                                <div><p className="font-semibold flex items-center gap-1.5"><Home size={13} /> {w.employeeName} · WFH {w.days} day(s)</p><p className="text-[11px] text-neutral-500">{w.startDate} → {w.endDate} · {w.reason}</p></div>
                                <div className="flex gap-1.5"><button disabled={decide.isPending} onClick={() => decide.mutate({ kind: "WFH", id: w.id, decision: "approve" })} className={btn.good}><Check size={12} className="inline" /> Approve</button><button disabled={decide.isPending} onClick={() => reject("WFH", w.id)} className={btn.danger}><X size={12} className="inline" /> Reject</button></div>
                            </li>
                        ))}
                        {a.corrections.map((c) => (
                            <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                                <div><p className="font-semibold flex items-center gap-1.5"><Clock size={13} /> {c.employeeName} · correction {c.date}</p><p className="text-[11px] text-neutral-500">{c.requestedCheckIn} – {c.requestedCheckOut} · {c.reason}</p></div>
                                <div className="flex gap-1.5"><button disabled={decide.isPending} onClick={() => decide.mutate({ kind: "CORRECTION", id: c.id, decision: "approve" })} className={btn.good}><Check size={12} className="inline" /> Approve</button><button disabled={decide.isPending} onClick={() => reject("CORRECTION", c.id)} className={btn.danger}><X size={12} className="inline" /> Reject</button></div>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}

            <SectionCard title="Team members">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-[11px] text-neutral-500 uppercase"><th className="py-2">Member</th><th>Today</th><th>Late (month)</th><th>Upcoming leave</th><th>Probation</th></tr></thead>
                        <tbody className="divide-y divide-neutral-100">
                            {data.members.map((m) => (
                                <tr key={m.id}>
                                    <td className="py-2.5"><p className="font-semibold">{m.name}</p><p className="text-[11px] text-neutral-500">{m.designation}{m.workMode ? ` · ${m.workMode.toLowerCase()}` : ""} · <a href={`tel:${m.phone}`} className="hover:text-primary">{m.phone}</a></p></td>
                                    <td><Badge value={m.today.startsWith("ON_LEAVE") ? "ON_LEAVE" : m.today} label={m.today.startsWith("ON_LEAVE") ? m.today.replace("ON_LEAVE", "Leave").toLowerCase() : m.today === "NOT_MARKED" ? "Not in" : undefined} />{m.checkIn && <span className="block text-[10px] text-neutral-400">{new Date(m.checkIn).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}{m.hoursToday ? ` · ${m.hoursToday}h` : ""}</span>}</td>
                                    <td className={m.lateThisMonth >= 3 ? "text-amber-700 font-bold" : ""}>{m.lateThisMonth}</td>
                                    <td className="text-xs">{m.upcomingLeave.length ? m.upcomingLeave.map((l) => <span key={l.id} className="block">{l.fromDate}{l.toDate !== l.fromDate ? ` → ${l.toDate}` : ""} · {l.type.toLowerCase()}{l.status === "PENDING" ? " (pending)" : ""}</span>) : "—"}</td>
                                    <td className="text-xs">{m.probationEndDate ? `ends ${m.probationEndDate}` : "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>
        </div>
    );
}
