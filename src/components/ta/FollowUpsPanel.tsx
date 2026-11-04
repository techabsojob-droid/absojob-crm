"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, Check, Phone } from "lucide-react";
import { SectionCard } from "@/components/shared/ui";
import { api } from "@/lib/api";

interface FollowUp {
    id: string; key: string | null; title: string; dueDate: string | null; completedAt: string | null;
    external?: boolean; candidateId: string | null; candidateName: string; candidatePhone: string | null; jobTitle: string | null; assigneeName: string;
    lastCall: { calledAt: string; callStatus: string; nextAction: string | null; remarks: string } | null;
}
interface FollowUpData { scope: "mine" | "team"; today: string; overdue: FollowUp[]; dueToday: FollowUp[]; upcoming: FollowUp[]; completed: FollowUp[] }

const daysLate = (due: string, today: string) => Math.round((+new Date(today) - +new Date(due)) / 86400000);
const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Candidate follow-ups: overdue and due-today reminders first, then the next two weeks, with history. */
export default function FollowUpsPanel({ canSeeTeam }: { canSeeTeam: boolean }) {
    const qc = useQueryClient();
    const [scope, setScope] = useState<"mine" | "team">("mine");
    const [view, setView] = useState<"pending" | "done">("pending");
    const { data, isLoading } = useQuery<FollowUpData>({ queryKey: ["ta-follow-ups", scope], queryFn: () => api(`/api/ta/follow-ups?scope=${scope}`) });
    const done = useMutation({
        mutationFn: (id: string) => api(`/api/tasks/${id}`, "PATCH", { status: "DONE" }),
        onSuccess: () => {
            toast.success("Follow-up marked done");
            qc.invalidateQueries({ queryKey: ["ta-follow-ups"] });
            qc.invalidateQueries({ queryKey: ["ta-candidate-detail"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const groups: [string, FollowUp[], string][] = data ? [
        ["Overdue", data.overdue, "text-red-600"],
        ["Due today", data.dueToday, "text-amber-600"],
        ["Next 14 days", data.upcoming, "text-neutral-500"],
    ] : [];
    const pending = data ? data.overdue.length + data.dueToday.length : 0;

    const row = (f: FollowUp, tone: string, open: boolean) => (
        <li key={f.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-neutral-100 last:border-0">
            <div className="min-w-0 text-xs">
                <p className="font-bold text-neutral-900 truncate">
                    {f.candidateId
                        ? <Link href={`/ta/candidates/${f.candidateId}`} className="hover:text-primary">{f.candidateName}</Link>
                        : <Link href="/ta/calls?tab=outside" className="hover:text-primary">{f.candidateName}</Link>}
                    {f.external && <span className="ml-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-[9px] font-black uppercase align-middle">Outside data</span>}
                    {f.jobTitle && <span className="font-medium text-neutral-400"> · {f.jobTitle}</span>}
                </p>
                <p className="text-neutral-600 truncate">{f.title}</p>
                <p className={`mt-0.5 font-semibold ${tone}`}>
                    {open && f.dueDate
                        ? (data && f.dueDate < data.today ? `${daysLate(f.dueDate, data.today)}d overdue · was due ${fmt(f.dueDate)}` : `Due ${fmt(f.dueDate)}`)
                        : f.completedAt ? `Done ${fmt(f.completedAt)}` : ""}
                    {scope === "team" && <span className="text-neutral-400 font-medium"> · {f.assigneeName}</span>}
                </p>
                {f.lastCall && <p className="text-neutral-400 truncate">Last call {fmt(f.lastCall.calledAt)}: {f.lastCall.remarks}</p>}
            </div>
            {open && (
                <div className="flex items-center gap-1.5 shrink-0">
                    {f.candidatePhone && (
                        <a href={`tel:${f.candidatePhone.replace(/\s/g, "")}`} title={`Call ${f.candidatePhone}`} className="p-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:text-primary hover:border-primary/40"><Phone size={13} /></a>
                    )}
                    <button type="button" disabled={done.isPending} onClick={() => done.mutate(f.id)} title="Mark done" className="p-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:text-emerald-600 hover:border-emerald-300 disabled:opacity-50"><Check size={13} /></button>
                </div>
            )}
        </li>
    );

    return (
        <SectionCard
            title="Candidate follow-ups"
            subtitle={data ? `${pending} need attention today · ${data.upcoming.length} upcoming` : "Reminders from logged calls"}
            action={
                <div className="flex items-center gap-1.5">
                    {canSeeTeam && (
                        <select value={scope} onChange={(e) => setScope(e.target.value as "mine" | "team")} aria-label="Whose follow-ups" className="text-[11px] font-bold border border-neutral-200 rounded-lg px-2 py-1 bg-white">
                            <option value="mine">Mine</option>
                            <option value="team">Team</option>
                        </select>
                    )}
                    <div className="flex bg-neutral-100 p-0.5 rounded-lg">
                        {(["pending", "done"] as const).map((v) => (
                            <button key={v} type="button" onClick={() => setView(v)} className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${view === v ? "bg-white shadow-2xs text-neutral-900" : "text-neutral-500"}`}>{v === "pending" ? "Pending" : "History"}</button>
                        ))}
                    </div>
                </div>
            }
        >
            {isLoading ? (
                <p className="text-xs text-neutral-400 py-6 text-center">Loading follow-ups…</p>
            ) : !data ? (
                <p className="text-xs text-red-600 py-6 text-center">Could not load follow-ups.</p>
            ) : view === "done" ? (
                data.completed.length ? <ul>{data.completed.map((f) => row(f, "text-emerald-600", false))}</ul> : <p className="text-xs text-neutral-400 py-6 text-center">No completed follow-ups yet.</p>
            ) : groups.every(([, list]) => !list.length) ? (
                <div className="py-6 text-center text-xs text-neutral-400 flex flex-col items-center gap-1.5"><AlarmClock size={18} /> No follow-ups pending. Set a follow-up date when logging a call.</div>
            ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {groups.filter(([, list]) => list.length).map(([title, list, tone]) => (
                        <div key={title}>
                            <p className={`text-[10px] font-black uppercase tracking-wide ${tone}`}>{title} · {list.length}</p>
                            <ul>{list.map((f) => row(f, tone, true))}</ul>
                        </div>
                    ))}
                </div>
            )}
        </SectionCard>
    );
}
