"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Same validated slots as the finance charts (src/components/finance/Charts.tsx)
const SERIES_1 = "#2a78d6";
const GRID = "#e7e6e1";
const AXIS = "#6b6a66";
const TARGET = "#52514e";

const compactInr = (v: number) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${Math.round(v / 1e3)}k` : `₹${v}`);

/** One KPI over time (daily / weekly / monthly buckets). Single series: the title names it. */
export function KpiTrendChart({ data, dataKey, label }: { data: Record<string, string | number>[]; dataKey: string; label: string }) {
    return (
        <div className="h-64" role="img" aria-label={`${label} over time`}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: AXIS, fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => [v, label]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey={dataKey} name={label} fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Cumulative achievement through the month against the target (dashed reference line). */
export function TargetBurnUp({ data, target, label, money }: { data: { label: string; value: number | null }[]; target: number | null; label: string; money?: boolean }) {
    const fmt = (v: number) => (money ? compactInr(v) : String(v));
    return (
        <div className="h-56" role="img" aria-label={`${label}: cumulative achievement this month${target ? ` against a target of ${target}` : ""}`}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} interval="preserveStartEnd" minTickGap={10} />
                    <YAxis allowDecimals={false} tickFormatter={fmt} tickLine={false} axisLine={false} width={money ? 56 : 32} tick={{ fill: AXIS, fontSize: 11 }} domain={[0, (max: number) => Math.max(max, target ?? 0)]} />
                    <Tooltip formatter={(v) => [money ? `₹${Number(v).toLocaleString("en-IN")}` : v, `${label} (cumulative)`]} labelFormatter={(l) => `Day ${l}`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    {target ? <ReferenceLine y={target} stroke={TARGET} strokeDasharray="4 4" label={{ value: `Target ${fmt(target)}`, position: "insideTopRight", fill: TARGET, fontSize: 11 }} /> : null}
                    <Line type="monotone" dataKey="value" name={label} stroke={SERIES_1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Inline magnitude bar for comparison tables (value shown as text beside it). */
export function InlineBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100)) : 0;
    return (
        <span className="inline-flex items-center gap-2 w-full justify-end">
            <span className="font-mono text-xs text-neutral-800 tabular-nums">{value}</span>
            <span className="w-14 h-1.5 rounded-full bg-neutral-100 overflow-hidden" aria-hidden><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: SERIES_1 }} /></span>
        </span>
    );
}

/** Achievement progress bar; the % is always printed, so colour is never the only signal. */
export function AchievementBar({ pct }: { pct: number | null }) {
    if (pct === null) return <span className="text-xs text-neutral-400">No target</span>;
    const w = Math.min(100, Math.max(0, pct));
    const tone = pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-rose-500";
    return (
        <span className="flex items-center gap-2 min-w-[110px]">
            <span className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden"><span className={`block h-full rounded-full ${tone}`} style={{ width: `${w}%` }} /></span>
            <span className="font-mono text-xs font-bold text-neutral-800 tabular-nums w-12 text-right">{pct}%</span>
        </span>
    );
}
