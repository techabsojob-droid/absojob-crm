"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Target, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { ErrorState, SkeletonPulse } from "@/components/shared/UIStates";
import { btn, inputCls, money, useAct } from "@/components/finance/kit";
import { AchievementBar, TargetBurnUp } from "@/components/ta/team/charts";
import { api } from "@/lib/api";

interface Line {
    metric: string; label: string; money: boolean; assigned: number | null; achieved: number;
    achievementPct: number | null; remaining: number | null; shortfall: number | null; isShortfall: boolean | null;
    today: number; thisWeek: number; expectedByToday: number | null; onTrack: boolean | null;
}
interface Person { id: string; name: string; role: string; designation: string | null }
interface Data {
    month: string; metric: string;
    metrics: { key: string; label: string; money: boolean }[];
    self: { user: Person; rollup: boolean; target: { setByName: string; updatedAt: string | null } | null; lines: Line[]; progress: { label: string; value: number | null }[] };
    team: { user: Person; target: { setByName: string; updatedAt: string | null } | null; lines: Line[]; headline: Line }[];
    teamTotals: (Omit<Line, "today" | "thisWeek" | "expectedByToday" | "onTrack"> & { membersWithTarget: number; membersShort: number })[];
    teamProgress: { label: string; value: number | null }[];
    canSetTeamTargets: boolean; canSetOwnTarget: boolean;
}

const FIELDS = [
    { key: "joinings", label: "Joinings" }, { key: "offers", label: "Offers released" }, { key: "interviews", label: "Interviews scheduled" },
    { key: "submissions", label: "Profiles submitted" }, { key: "revenue", label: "Revenue (₹)" },
];
const shiftMonth = (m: string, n: number) => { const d = new Date(`${m}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const fmt = (n: number | null, isMoney: boolean) => (n === null ? "—" : isMoney ? money(n) : String(n));

function ShortfallFlag({ line }: { line: Pick<Line, "isShortfall"> }) {
    if (line.isShortfall === null) return <span className="text-xs text-neutral-400">—</span>;
    return line.isShortfall
        ? <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full"><AlertTriangle size={11} />Yes</span>
        : <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 size={11} />No</span>;
}

/** The five dashboard indicators for one metric. */
function Indicators({ line }: { line: Line | Data["teamTotals"][number] }) {
    const tiles: [string, React.ReactNode][] = [
        ["Target assigned", fmt(line.assigned, line.money)],
        ["Target achieved", fmt(line.achieved, line.money)],
        ["Achievement", line.achievementPct === null ? "—" : `${line.achievementPct}%`],
        ["Remaining", fmt(line.remaining, line.money)],
        ["Shortfall", <ShortfallFlag key="s" line={line} />],
    ];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {tiles.map(([l, v]) => (
                <div key={l} className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">{l}</p>
                    <div className="text-xl font-extrabold text-neutral-900 mt-1 tabular-nums">{v}</div>
                </div>
            ))}
        </div>
    );
}

function LinesTable({ lines }: { lines: Line[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead><tr className="text-left text-[10px] text-neutral-500 uppercase"><th className="py-2">Metric</th><th className="text-right">Today</th><th className="text-right">This week</th><th className="text-right">Month (achieved)</th><th className="text-right">Target</th><th className="pl-4">Achievement</th><th className="text-right">Remaining</th><th className="text-right">Shortfall</th><th className="text-right">Pace</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">
                    {lines.map((l) => (
                        <tr key={l.metric}>
                            <td className="py-2.5 font-semibold">{l.label}</td>
                            <td className="text-right font-mono text-xs">{fmt(l.today, l.money)}</td>
                            <td className="text-right font-mono text-xs">{fmt(l.thisWeek, l.money)}</td>
                            <td className="text-right font-mono text-xs font-bold">{fmt(l.achieved, l.money)}</td>
                            <td className="text-right font-mono text-xs">{fmt(l.assigned, l.money)}</td>
                            <td className="pl-4"><AchievementBar pct={l.achievementPct} /></td>
                            <td className="text-right font-mono text-xs">{fmt(l.remaining, l.money)}</td>
                            <td className="text-right"><ShortfallFlag line={l} /></td>
                            <td className="text-right text-[11px]">{l.onTrack === null ? <span className="text-neutral-400">—</span> : l.onTrack ? <span className="text-emerald-700 font-bold">On pace</span> : <span className="text-amber-700 font-bold" title={`Expected ${fmt(l.expectedByToday, l.money)} by today`}>Behind</span>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function TargetsPage() {
    const [month, setMonth] = useState<string | null>(null);
    const [metric, setMetric] = useState("joinings");
    const [edit, setEdit] = useState<{ userId: string; name: string; vals: Record<string, string> } | null>(null);
    const qs = new URLSearchParams({ metric, ...(month ? { month } : {}) }).toString();
    const { data, isLoading, isError, error, refetch } = useQuery<Data>({ queryKey: ["ta-target-tracking", qs], queryFn: () => api(`/api/ta/target-tracking?${qs}`), placeholderData: (p) => p });
    const save = useAct("/api/ta/targets", "PUT", ["ta-target-tracking", "ta-performance"], "Target saved");

    if (isError && !data) return <ErrorState description={(error as Error).message} onRetry={() => refetch()} />;
    if (isLoading || !data) return <SkeletonPulse className="h-[32rem] w-full" />;
    const m = month ?? data.month;
    const current = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()).slice(0, 7);
    const selfLine = data.self.lines.find((l) => l.metric === metric)!;
    const teamLine = data.teamTotals.find((l) => l.metric === metric);
    const def = data.metrics.find((x) => x.key === metric)!;
    const openEdit = (p: Person, lines: Line[]) => setEdit({ userId: p.id, name: p.name, vals: Object.fromEntries(FIELDS.map((f) => [f.key, String(lines.find((l) => l.metric === f.key)?.assigned ?? "")])) });

    return (
        <div className="space-y-6">
            <PageHeader title="Targets & Achievement" subtitle="Monthly targets against live results, with remaining target and shortfall"
                action={
                    <div className="flex items-center gap-2">
                        <select value={metric} onChange={(e) => setMetric(e.target.value)} className={`${inputCls} !w-auto !py-1.5 !text-xs font-semibold`} aria-label="Headline metric">
                            {data.metrics.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                        </select>
                        <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-xl px-1 py-1">
                            <button onClick={() => setMonth(shiftMonth(m, -1))} className="p-1 rounded-lg hover:bg-neutral-100" aria-label="Previous month"><ChevronLeft size={14} /></button>
                            <span className="text-xs font-bold w-28 text-center">{monthName(m)}</span>
                            <button onClick={() => setMonth(shiftMonth(m, 1))} disabled={m >= current} className="p-1 rounded-lg hover:bg-neutral-100 disabled:opacity-30" aria-label="Next month"><ChevronRight size={14} /></button>
                        </div>
                    </div>
                } />

            <SectionCard title={`My target — ${def.label}`}
                subtitle={data.self.rollup ? "Your achievement includes your own work and your team's" : data.self.target ? `Set by ${data.self.target.setByName}` : "No target set for this month"}
                action={data.canSetOwnTarget ? <button className={btn.ghost} onClick={() => openEdit(data.self.user, data.self.lines)}>Set my target</button> : undefined}>
                <Indicators line={selfLine} />
                {selfLine.assigned === null && <p className="text-xs text-neutral-500 mt-3">{data.canSetOwnTarget ? "Set a target to track achievement and shortfall." : "Your monthly target is assigned by your Super Admin. Results below are still tracked live."}</p>}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-5">
                    <div className="lg:col-span-2">
                        <p className="text-[11px] font-bold text-neutral-500 uppercase mb-2">{def.label} — cumulative this month</p>
                        <TargetBurnUp data={data.self.progress} target={selfLine.assigned} label={def.label} money={def.money} />
                    </div>
                    <div className="lg:col-span-3">
                        <p className="text-[11px] font-bold text-neutral-500 uppercase mb-2">Daily · weekly · monthly progress</p>
                        <LinesTable lines={data.self.lines} />
                    </div>
                </div>
            </SectionCard>

            {data.canSetTeamTargets && (
                <SectionCard title="Team targets" subtitle={teamLine?.membersWithTarget ? `${teamLine.membersShort} of ${teamLine.membersWithTarget} recruiter(s) with a ${def.label.toLowerCase()} target are short` : "Assign each recruiter a monthly target"}>
                    {data.team.length === 0 ? <EmptyState icon={Users} message="No recruiters report to you yet. Ask Super Admin to set their reporting manager." /> : (
                        <div className="space-y-5">
                            {teamLine && <Indicators line={teamLine} />}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left text-[10px] text-neutral-500 uppercase"><th className="py-2">Recruiter</th><th className="text-right">Assigned</th><th className="text-right">Achieved</th><th className="pl-4">Achievement %</th><th className="text-right">Remaining</th><th className="text-right">Shortfall</th><th className="text-right">Today / week</th><th /></tr></thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {data.team.map((t) => (
                                            <tr key={t.user.id}>
                                                <td className="py-2.5 font-semibold">{t.user.name}<span className="block text-[10px] text-neutral-400 font-normal">{t.target ? `Set by ${t.target.setByName}` : "No target this month"}</span></td>
                                                <td className="text-right font-mono text-xs">{fmt(t.headline.assigned, t.headline.money)}</td>
                                                <td className="text-right font-mono text-xs font-bold">{fmt(t.headline.achieved, t.headline.money)}</td>
                                                <td className="pl-4"><AchievementBar pct={t.headline.achievementPct} /></td>
                                                <td className="text-right font-mono text-xs">{fmt(t.headline.remaining, t.headline.money)}</td>
                                                <td className="text-right"><ShortfallFlag line={t.headline} /></td>
                                                <td className="text-right font-mono text-xs">{fmt(t.headline.today, t.headline.money)} / {fmt(t.headline.thisWeek, t.headline.money)}</td>
                                                <td className="text-right"><button className={btn.ghost} onClick={() => openEdit(t.user, t.lines)}>{t.target ? "Edit target" : "Set target"}</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {data.teamProgress.length > 0 && (
                                <div>
                                    <p className="text-[11px] font-bold text-neutral-500 uppercase mb-2">Team {def.label.toLowerCase()} — cumulative this month</p>
                                    <TargetBurnUp data={data.teamProgress} target={teamLine?.assigned ?? null} label={def.label} money={def.money} />
                                </div>
                            )}
                        </div>
                    )}
                </SectionCard>
            )}

            <p className="text-[11px] text-neutral-400 flex items-center gap-1"><Target size={12} />Achievement % = achieved ÷ assigned × 100 · Shortfall = assigned − achieved. One target per person per month; editing replaces it and is audit-logged.</p>

            {edit && (
                <ModalShell onClose={() => setEdit(null)} title={`${edit.name} — ${monthName(m)} targets`}>
                    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ userId: edit.userId, month: m, ...Object.fromEntries(Object.entries(edit.vals).map(([k, v]) => [k, Number(v) || 0])) }, { onSuccess: () => setEdit(null) }); }}>
                        {FIELDS.map((f) => (
                            <label key={f.key} className="block text-xs font-bold text-neutral-600">{f.label}
                                <input type="number" min="0" step="1" value={edit.vals[f.key]} onChange={(e) => setEdit({ ...edit, vals: { ...edit.vals, [f.key]: e.target.value } })} className={inputCls} />
                            </label>
                        ))}
                        <button disabled={save.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50">{save.isPending ? "Saving…" : "Save target"}</button>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
