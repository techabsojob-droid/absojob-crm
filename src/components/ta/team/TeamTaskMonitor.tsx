"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/shared/ui";
import type { TaskRow } from "@/components/tasks/bits";
import { trackStateOf, type TaskTrackState } from "@/lib/tasks/rules";
import { api } from "@/lib/api";

const STATES: { key: TaskTrackState; label: string; tone: string }[] = [
    { key: "PENDING", label: "Pending", tone: "text-neutral-700" },
    { key: "IN_PROGRESS", label: "In progress", tone: "text-blue-700" },
    { key: "COMPLETED", label: "Completed", tone: "text-emerald-700" },
    { key: "OVERDUE", label: "Overdue", tone: "text-rose-700" },
];

/**
 * For TA leads: tasks they can see (their own + their team's), summarised per assignee as
 * Pending / In progress / Completed / Overdue, with the overdue list underneath.
 */
export function TeamTaskMonitor({ meId }: { meId: string }) {
    const { data: tasks = [], isLoading } = useQuery<TaskRow[]>({ queryKey: ["tasks", "team-monitor"], queryFn: () => api("/api/tasks?view=all"), refetchInterval: 60000 });
    const [onlyMine, setOnlyMine] = useState(false);
    const rows = useMemo(() => {
        const list = onlyMine ? tasks.filter((t) => t.createdById === meId) : tasks;
        const by = new Map<string, { id: string; name: string; counts: Record<TaskTrackState, number>; total: number }>();
        for (const t of list) {
            const id = t.assignee?.id ?? t.assignedToId;
            const r = by.get(id) ?? { id, name: t.assignee?.name ?? "Unassigned", counts: { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 }, total: 0 };
            r.counts[trackStateOf(t)]++;
            r.total++;
            by.set(id, r);
        }
        return [...by.values()].sort((a, b) => b.counts.OVERDUE - a.counts.OVERDUE || b.total - a.total);
    }, [tasks, onlyMine, meId]);
    const overdue = tasks.filter((t) => trackStateOf(t) === "OVERDUE" && (!onlyMine || t.createdById === meId)).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    const totals = Object.fromEntries(STATES.map((s) => [s.key, rows.reduce((n, r) => n + r.counts[s.key], 0)])) as Record<TaskTrackState, number>;

    if (isLoading) return null;
    return (
        <SectionCard title="Team task monitor" subtitle="Tasks for you and the recruiters reporting to you"
            action={<label className="text-xs font-semibold text-neutral-600 flex items-center gap-1.5"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only tasks I assigned</label>}>
            {rows.length === 0 ? <p className="text-sm text-neutral-400">No tasks yet. Use “Create task” to assign one to a recruiter, with a priority, due date and the client or requisition it relates to.</p> : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                    <div className="lg:col-span-3 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-[10px] text-neutral-500 uppercase"><th className="py-2">Assignee</th>{STATES.map((s) => <th key={s.key} className="text-right">{s.label}</th>)}<th className="text-right">Done %</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {rows.map((r) => (
                                    <tr key={r.id}>
                                        <td className="py-2 font-semibold">{r.name}{r.id === meId && <span className="text-[10px] text-neutral-400"> (you)</span>}</td>
                                        {STATES.map((s) => <td key={s.key} className={`text-right font-mono text-xs ${r.counts[s.key] && s.key === "OVERDUE" ? "font-bold text-rose-700" : ""}`}>{r.counts[s.key]}</td>)}
                                        <td className="text-right font-mono text-xs">{r.total ? Math.round((r.counts.COMPLETED / r.total) * 100) : 0}%</td>
                                    </tr>
                                ))}
                                <tr className="font-bold"><td className="py-2">Total</td>{STATES.map((s) => <td key={s.key} className={`text-right font-mono text-xs ${s.tone}`}>{totals[s.key]}</td>)}<td /></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="lg:col-span-2">
                        <p className="text-[11px] font-bold text-neutral-500 uppercase mb-2 flex items-center gap-1"><AlertTriangle size={12} className="text-rose-600" />Overdue ({overdue.length})</p>
                        {overdue.length === 0 ? <p className="text-xs text-neutral-400">Nothing overdue.</p> : (
                            <ul className="divide-y divide-neutral-100 text-xs max-h-56 overflow-y-auto">
                                {overdue.slice(0, 30).map((t) => (
                                    <li key={t.id} className="py-1.5">
                                        <Link href={`/ta/tasks?task=${encodeURIComponent(t.key)}`} className="font-semibold hover:text-primary">{t.key} · {t.title}</Link>
                                        <span className="block text-neutral-500">{t.assignee?.name ?? "—"} · due {t.dueDate?.slice(0, 10)}{t.related ? ` · ${t.related.type}: ${t.related.label}` : ""}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </SectionCard>
    );
}
