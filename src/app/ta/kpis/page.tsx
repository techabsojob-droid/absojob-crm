"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Download, Users } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared/ui";
import { ErrorState, SkeletonPulse } from "@/components/shared/UIStates";
import { btn, downloadText, inputCls, toCsv } from "@/components/finance/kit";
import { InlineBar, KpiTrendChart } from "@/components/ta/team/charts";
import { api } from "@/lib/api";

type Counts = Record<string, number>;
interface Person { id: string; name: string; role: string; designation: string | null }
interface Data {
    range: { from: string; to: string; granularity: "daily" | "weekly" | "monthly"; requestedGranularity: string };
    kpis: { key: string; label: string; hint: string }[];
    totals: Counts;
    series: ({ bucket: string; label: string } & Counts)[];
    recruiters: (Person & { isMe: boolean; totals: Counts; conversion: Record<string, number | null> })[];
    byClient: { clientId: string | null; clientName: string; totals: Counts }[];
    canCompare: boolean;
    options: { recruiters: Person[]; clients: { id: string; name: string }[]; jobs: { id: string; title: string; code: string | null; clientId: string }[] };
}

const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const monday = (d: string) => { const dow = new Date(`${d}T00:00:00Z`).getUTCDay(); return addDays(d, dow === 0 ? -6 : 1 - dow); };

const PRESETS = [
    { id: "today", label: "Today", range: (t: string) => [t, t], g: "daily" },
    { id: "week", label: "This week", range: (t: string) => [monday(t), t], g: "daily" },
    { id: "month", label: "This month", range: (t: string) => [`${t.slice(0, 7)}-01`, t], g: "daily" },
    { id: "30d", label: "Last 30 days", range: (t: string) => [addDays(t, -29), t], g: "weekly" },
    { id: "quarter", label: "Last 90 days", range: (t: string) => [addDays(t, -89), t], g: "weekly" },
    { id: "year", label: "Last 12 months", range: (t: string) => [`${addDays(t, -364).slice(0, 7)}-01`, t], g: "monthly" },
] as const;

export default function RecruiterKpisPage() {
    const today = istToday();
    const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
    const [to, setTo] = useState(today);
    const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
    const [recruiterId, setRecruiterId] = useState("ALL");
    const [clientId, setClientId] = useState("ALL");
    const [jobId, setJobId] = useState("ALL");
    const [trendKpi, setTrendKpi] = useState("submitted");

    const qs = new URLSearchParams({ from, to, granularity, recruiterId, clientId, jobId }).toString();
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery<Data>({ queryKey: ["ta-kpis", qs], queryFn: () => api(`/api/ta/kpis?${qs}`), placeholderData: (prev) => prev });

    const jobs = useMemo(() => (data?.options.jobs ?? []).filter((j) => clientId === "ALL" || j.clientId === clientId), [data, clientId]);
    const select = `${inputCls} !py-1.5 !text-xs font-semibold`;
    const preset = (p: (typeof PRESETS)[number]) => { const [f, t] = p.range(today); setFrom(f); setTo(t); setGranularity(p.g); };

    if (isError && !data) return <ErrorState description={(error as Error).message} onRetry={() => refetch()} />;
    if (isLoading || !data) return <SkeletonPulse className="h-[32rem] w-full" />;

    const kpis = data.kpis;
    const trendDef = kpis.find((k) => k.key === trendKpi) ?? kpis[0];
    const maxOf = (k: string) => Math.max(0, ...data.recruiters.map((r) => r.totals[k] ?? 0));
    const single = recruiterId !== "ALL" ? data.recruiters.find((r) => r.id === recruiterId) : null;
    const allZero = kpis.every((k) => !data.totals[k.key]);

    const exportCsv = () => downloadText(toCsv([
        ["Recruiter", "Role", ...kpis.map((k) => k.label)],
        ...data.recruiters.map((r) => [r.name, r.role.replace("TA_", ""), ...kpis.map((k) => r.totals[k.key] ?? 0)]),
        ["Total", "", ...kpis.map((k) => data.totals[k.key] ?? 0)],
    ]), `recruiter-kpis-${data.range.from}-to-${data.range.to}.csv`);

    return (
        <div className="space-y-6">
            <PageHeader
                title={data.canCompare ? "Recruiter KPIs" : "My KPIs"}
                subtitle="Sourcing to joining, counted live from calls, pipeline moves, submissions, interviews and offers"
                action={<button onClick={exportCsv} className={btn.ghost}><Download size={13} className="inline mr-1" />Export CSV</button>}
            />

            {/* Filters — one row above the charts */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 p-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => {
                        const [f, t] = p.range(today);
                        const on = f === from && t === to;
                        return <button key={p.id} onClick={() => preset(p)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${on ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>{p.label}</button>;
                    })}
                    <span className="mx-1 w-px bg-neutral-200" />
                    {(["daily", "weekly", "monthly"] as const).map((g) => (
                        <button key={g} onClick={() => setGranularity(g)} className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize ${granularity === g ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>{g}</button>
                    ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {data.canCompare && (
                        <label className="text-[11px] font-bold text-neutral-500">Recruiter
                            <select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)} className={select}>
                                <option value="ALL">All ({data.options.recruiters.length})</option>
                                {data.options.recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </label>
                    )}
                    <label className="text-[11px] font-bold text-neutral-500">Client
                        <select value={clientId} onChange={(e) => { setClientId(e.target.value); setJobId("ALL"); }} className={select}>
                            <option value="ALL">All clients</option>
                            {data.options.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                    <label className="text-[11px] font-bold text-neutral-500">Requisition
                        <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={select}>
                            <option value="ALL">All requisitions</option>
                            {jobs.map((j) => <option key={j.id} value={j.id}>{j.code ? `${j.code} · ` : ""}{j.title}</option>)}
                        </select>
                    </label>
                    <label className="text-[11px] font-bold text-neutral-500">From<input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={select} /></label>
                    <label className="text-[11px] font-bold text-neutral-500">To<input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={select} /></label>
                </div>
                {data.range.granularity !== data.range.requestedGranularity && <p className="text-[11px] text-amber-700">Showing weekly buckets — daily is limited to ranges of 120 days.</p>}
                {isError && <p className="text-xs text-rose-600">{(error as Error).message}</p>}
            </div>

            {/* KPI tiles */}
            <div className={`grid grid-cols-2 md:grid-cols-5 gap-3 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
                {kpis.map((k) => (
                    <button key={k.key} onClick={() => setTrendKpi(k.key)} title={k.hint}
                        className={`text-left bg-white p-4 rounded-2xl border shadow-xs transition-colors ${trendKpi === k.key ? "border-primary ring-2 ring-primary/15" : "border-neutral-200/80 hover:border-primary/40"}`}>
                        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide leading-tight">{k.label}</p>
                        <p className="text-2xl font-extrabold text-neutral-900 mt-1 tabular-nums">{data.totals[k.key] ?? 0}</p>
                    </button>
                ))}
            </div>

            <SectionCard title={`${trendDef.label} — ${data.range.granularity}`} subtitle={`${data.range.from} → ${data.range.to}${single ? ` · ${single.name}` : ""}. Pick a tile above to chart another KPI.`}>
                {allZero ? <EmptyState icon={Activity} message="No recruitment activity recorded for these filters yet." /> : <KpiTrendChart data={data.series} dataKey={trendDef.key} label={trendDef.label} />}
            </SectionCard>

            {data.canCompare && (
                <SectionCard title="Recruiter comparison" subtitle="Same period and filters for everyone — click a name for their individual report">
                    {data.recruiters.length === 0 ? <EmptyState icon={Users} message="No recruiters report to you yet. Ask Super Admin to set their reporting manager." /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[10px] text-neutral-500 uppercase">
                                        <th className="py-2 pr-3 sticky left-0 bg-white">Recruiter</th>
                                        {kpis.map((k) => <th key={k.key} className="py-2 px-2 text-right whitespace-nowrap" title={k.hint}>{k.label}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {data.recruiters.map((r) => (
                                        <tr key={r.id} className={recruiterId === r.id ? "bg-primary/5" : ""}>
                                            <td className="py-2.5 pr-3 sticky left-0 bg-white">
                                                <button onClick={() => setRecruiterId(recruiterId === r.id ? "ALL" : r.id)} className="font-semibold text-left hover:text-primary">{r.name}{r.isMe && <span className="text-[10px] text-neutral-400 font-bold"> (you)</span>}</button>
                                                <span className="block text-[10px] text-neutral-400">{r.designation ?? r.role.replace("TA_", "")}</span>
                                            </td>
                                            {kpis.map((k) => <td key={k.key} className="py-2.5 px-2"><InlineBar value={r.totals[k.key] ?? 0} max={maxOf(k.key)} /></td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(single ?? (!data.canCompare ? data.recruiters[0] : null)) && (() => {
                    const r = (single ?? data.recruiters[0])!;
                    const rows = [
                        ["Submission → interview", r.conversion.submitToInterview],
                        ["Interview → selection", r.conversion.interviewToSelect],
                        ["Offer acceptance", r.conversion.offerAcceptance],
                        ["Accepted → joined", r.conversion.offerToJoin],
                    ] as const;
                    return (
                        <SectionCard title={`Individual report — ${r.name}`} subtitle={`${data.range.from} → ${data.range.to}`}>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                {kpis.map((k) => <div key={k.key} className="flex justify-between border-b border-neutral-100 py-1"><dt className="text-neutral-500">{k.label}</dt><dd className="font-mono font-bold tabular-nums">{r.totals[k.key] ?? 0}</dd></div>)}
                            </dl>
                            <p className="text-[11px] font-bold text-neutral-500 uppercase mt-4 mb-2">Conversion</p>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                {rows.map(([l, v]) => <div key={l} className="flex justify-between border-b border-neutral-100 py-1"><dt className="text-neutral-500">{l}</dt><dd className="font-mono font-bold">{v === null ? "—" : `${v}%`}</dd></div>)}
                            </dl>
                        </SectionCard>
                    );
                })()}
                <SectionCard title="By client" subtitle="Where the activity happened">
                    {data.byClient.length === 0 ? <EmptyState icon={Activity} message="Nothing recorded for this period." /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-[10px] text-neutral-500 uppercase"><th className="py-2">Client</th><th className="text-right">Sourced</th><th className="text-right">Submitted</th><th className="text-right">Interviews</th><th className="text-right">Offers</th><th className="text-right">Joined</th></tr></thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {data.byClient.map((c) => (
                                        <tr key={c.clientName}>
                                            <td className="py-2 font-semibold">{c.clientId ? <button className="hover:text-primary text-left" onClick={() => { setClientId(c.clientId!); setJobId("ALL"); }}>{c.clientName}</button> : <span className="text-neutral-500">{c.clientName}</span>}</td>
                                            {["sourced", "submitted", "interviewsScheduled", "offersReleased", "joined"].map((k) => <td key={k} className="text-right font-mono text-xs tabular-nums">{c.totals[k]}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            </div>

            <details className="text-xs text-neutral-500 bg-white rounded-2xl border border-neutral-200/80 p-4">
                <summary className="font-bold text-neutral-700 cursor-pointer">How each KPI is counted</summary>
                <ul className="mt-2 space-y-1">{kpis.map((k) => <li key={k.key}><b>{k.label}:</b> {k.hint}. Credited to the recruiter who owns the application.</li>)}</ul>
            </details>
        </div>
    );
}
