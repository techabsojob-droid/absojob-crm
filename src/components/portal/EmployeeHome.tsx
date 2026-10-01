"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarOff, Clock, PartyPopper, Users } from "lucide-react";
import { SectionCard } from "@/components/shared/ui";

export interface EmployeeBlock {
    code: string; designation: string; department: string; workMode: string;
    shift: { name: string; startTime: string; endTime: string; graceMinutes: number };
    probation: string | null;
    leave: { type: string; label: string; available: number | null; allowance: number | null }[];
    nextHoliday: { name: string; date: string } | null;
    actions: { label: string; href: string; tone: "amber" | "red" | "blue" }[];
    isManager: boolean; teamSize: number;
    exit: { status: string; lastWorkingDay: string } | null;
}

const TONE = { amber: "bg-amber-50 border-amber-200 text-amber-900", red: "bg-rose-50 border-rose-200 text-rose-800", blue: "bg-sky-50 border-sky-200 text-sky-900" };

/** Employee self-service summary on the portal dashboard. */
export default function EmployeeHome({ e }: { e: EmployeeBlock }) {
    const days = e.nextHoliday ? Math.round((+new Date(`${e.nextHoliday.date}T00:00:00Z`) - +new Date(new Date().toISOString().slice(0, 10))) / 86400000) : null;
    return (
        <div className="space-y-4">
            {e.actions.length > 0 && (
                <SectionCard title={`Needs your attention (${e.actions.length})`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {e.actions.map((a) => (
                            <Link key={a.label} href={a.href} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${TONE[a.tone]}`}>
                                <span className="flex items-center gap-2"><AlertCircle size={14} />{a.label}</span><ArrowRight size={14} />
                            </Link>
                        ))}
                    </div>
                </SectionCard>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Link href="/portal/attendance" className="bg-white rounded-2xl border border-neutral-200/80 p-5 hover:border-primary">
                    <p className="text-xs font-bold text-neutral-500 flex items-center gap-1.5"><Clock size={13} /> My shift</p>
                    <p className="text-xl font-extrabold mt-1">{e.shift.startTime} – {e.shift.endTime}</p>
                    <p className="text-xs text-neutral-500">{e.shift.name} · {e.shift.graceMinutes} min grace · {e.workMode.toLowerCase()}</p>
                    {e.probation && <p className="text-[11px] text-amber-700 font-bold mt-2">On probation till {e.probation}</p>}
                    {e.exit && <p className="text-[11px] text-rose-700 font-bold mt-2">Serving notice · last day {e.exit.lastWorkingDay}</p>}
                </Link>
                <Link href="/portal/leave" className="bg-white rounded-2xl border border-neutral-200/80 p-5 hover:border-primary">
                    <p className="text-xs font-bold text-neutral-500 flex items-center gap-1.5"><CalendarOff size={13} /> Leave balance</p>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                        {e.leave.map((l) => <div key={l.type}><p className="text-lg font-extrabold">{l.available ?? "∞"}</p><p className="text-[10px] text-neutral-500 leading-tight">{l.label.split(" ")[0]}</p></div>)}
                    </div>
                </Link>
                <Link href="/portal/holidays" className="bg-white rounded-2xl border border-neutral-200/80 p-5 hover:border-primary">
                    <p className="text-xs font-bold text-neutral-500 flex items-center gap-1.5"><PartyPopper size={13} /> Next holiday</p>
                    {e.nextHoliday ? <><p className="text-xl font-extrabold mt-1">{e.nextHoliday.name}</p><p className="text-xs text-neutral-500">{new Date(`${e.nextHoliday.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}{days !== null ? ` · ${days === 0 ? "today" : `in ${days} day(s)`}` : ""}</p></> : <p className="text-sm text-neutral-400 mt-1">None scheduled</p>}
                    {e.isManager && <p className="text-[11px] text-primary font-bold mt-2 flex items-center gap-1"><Users size={11} /> You manage {e.teamSize} people</p>}
                </Link>
            </div>
        </div>
    );
}
