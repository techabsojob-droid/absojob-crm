"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Validated categorical slots (reference palette, light surface): billed = blue, collected = orange
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";
const GRID = "#e7e6e1";
const AXIS = "#6b6a66";

const compactInr = (v: number) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${Math.round(v / 1e3)}k` : `₹${v}`);
const fullInr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const monthLabel = (m: string) => new Date(`${m}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

/** Billed vs collected per month — two series, legend + hover tooltip. */
export function BilledCollectedChart({ data }: { data: { month: string; billed: number; collected: number }[] }) {
    return (
        <div className="h-64" role="img" aria-label="Monthly billed versus collected">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.map((d) => ({ ...d, label: monthLabel(d.month) }))} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
                    <YAxis tickFormatter={compactInr} tickLine={false} axisLine={false} width={56} tick={{ fill: AXIS, fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => fullInr(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#52514e" }} />
                    <Bar dataKey="billed" name="Billed" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="collected" name="Collected" fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Single-series horizontal bars (e.g. receivables by aging bucket, revenue by client). */
export function HorizontalBars({ data, label }: { data: { name: string; value: number }[]; label: string }) {
    return (
        <div style={{ height: Math.max(160, data.length * 36 + 24) }} role="img" aria-label={label}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke={GRID} />
                    <XAxis type="number" tickFormatter={compactInr} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fill: "#52514e", fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => [fullInr(Number(v)), label]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="value" fill={SERIES_1} radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Two count series per month on one axis (e.g. recruiter submissions vs joinings). */
export function MonthlyCountChart({ data, a, b }: { data: ({ month: string } & Record<string, number | string>)[]; a: { key: string; label: string }; b: { key: string; label: string } }) {
    return (
        <div className="h-60" role="img" aria-label={`Monthly ${a.label} and ${b.label}`}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.map((d) => ({ ...d, label: monthLabel(d.month) }))} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: AXIS, fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#52514e" }} />
                    <Bar dataKey={a.key} name={a.label} fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={24} />
                    <Bar dataKey={b.key} name={b.label} fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
