"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Target, Send, CalendarClock, FileSignature, UserCheck, IndianRupee, Wallet, TrendingDown, TrendingUp, Coins, Hourglass } from "lucide-react";
import { PageHeader, StatCard, SectionCard, Badge, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { MonthlyCountChart } from "@/components/finance/Charts";
import { btn, inputCls, money, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";
import { stageLabel } from "@/lib/types";

type Kpi = { submissions: number; interviews: number; offers: number; joinings: number; revenue: number };
type Gap = { revenue: number; target: number | null; shortfall: number | null; surplus: number | null; achievedPct: number | null; joiningsNeeded: number | null };
interface Earnings {
    fyLabel: string; fyFrom: string; incentivePct: number; avgFeePerPlacement: number | null; daysLeftInMonth: number;
    thisMonth: Gap; yearToDate: Gap & { monthsWithTarget: number; months: number };
    incentive: { earnedThisMonth: number; earnedThisYear: number; earnedAllTime: number; pending: number; paidGross: number; tds: number; paidNet: number; clawback: number; expected: number; expectedPlacements: number };
}
interface Perf {
    user: { id: string; name: string };
    month: string;
    actual: Kpi;
    target: (Kpi & { setByName: string }) | null;
    funnel: Record<string, number>;
    trend: ({ month: string } & Kpi)[];
    incentives: { pending: number; paid: number; entries: { id: string; description: string; amount: number; status: string; createdAt: string }[] };
    earnings: Earnings;
    ratios: { submissionToOffer: number; offerToJoin: number; activePipeline: number };
    team: { userId: string; name: string; role: string; canSetTarget?: boolean; actual: Kpi; target: Kpi | null; earnings: Pick<Earnings, "thisMonth" | "yearToDate" | "incentive"> }[] | null;
    canSetTargets: boolean;
}

const METRICS: { key: keyof Kpi; label: string; icon: typeof Send }[] = [
    { key: "submissions", label: "CVs shared", icon: Send },
    { key: "interviews", label: "Interviews", icon: CalendarClock },
    { key: "offers", label: "Offers", icon: FileSignature },
    { key: "joinings", label: "Joinings", icon: UserCheck },
    { key: "revenue", label: "Revenue", icon: IndianRupee },
];
const STAGES = ["SOURCED", "CONTACTED", "SCREENING", "SHORTLISTED", "INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", "INTERVIEW_COMPLETED", "SELECTED", "OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"];
const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** Revenue vs target with the shortfall (or surplus) for one period. */
function TargetPanel({ title, period, g, note }: { title: string; period: string; g: Gap; note?: string }) {
    const hasTarget = g.target != null && g.target > 0;
    const short = (g.shortfall ?? 0) > 0;
    const p = g.achievedPct ?? 0;
    return (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 space-y-4">
            <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-neutral-900">{title}</p>
                <p className="text-[11px] font-semibold text-neutral-400">{period}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">Revenue</p>
                    <p className="text-xl font-extrabold text-neutral-900 mt-0.5">{money(g.revenue)}</p>
                </div>
                <div>
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">Target</p>
                    <p className="text-xl font-extrabold text-neutral-900 mt-0.5">{hasTarget ? money(g.target!) : "—"}</p>
                </div>
                <div>
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">{!hasTarget ? "Shortfall" : short ? "Shortfall" : "Above target"}</p>
                    <p className={`text-xl font-extrabold mt-0.5 flex items-center gap-1 ${!hasTarget ? "text-neutral-400" : short ? "text-red-600" : "text-emerald-600"}`}>
                        {hasTarget && (short ? <TrendingDown size={16} /> : <TrendingUp size={16} />)}
                        {!hasTarget ? "—" : short ? money(g.shortfall!) : money(g.surplus ?? 0)}
                    </p>
                </div>
            </div>
            {hasTarget ? (
                <>
                    <div>
                        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${p >= 100 ? "bg-emerald-500" : p >= 70 ? "bg-[#2a78d6]" : "bg-amber-500"}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
                        <p className={`text-[11px] font-bold mt-1.5 ${p >= 100 ? "text-emerald-600" : "text-neutral-600"}`}>{p}% of target achieved</p>
                    </div>
                    {short && (g.joiningsNeeded ?? 0) > 0 && <p className="text-xs text-neutral-600">≈ <b>{g.joiningsNeeded}</b> more joining{g.joiningsNeeded === 1 ? "" : "s"} needed to close the gap{note ? ` · ${note}` : ""}.</p>}
                </>
            ) : (
                <p className="text-xs text-neutral-400">No revenue target set for this period — your team lead sets it.</p>
            )}
        </div>
    );
}
const pct = (a: number, t?: number) => (t ? Math.round((a / t) * 100) : null);

export default function PerformancePage() {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [viewUser, setViewUser] = useState<string>("");
    const [edit, setEdit] = useState<{ userId: string; name: string; vals: Record<string, string> } | null>(null);
    const { data, isLoading } = useQuery<Perf>({ queryKey: ["ta-performance", month, viewUser], queryFn: () => api(`/api/ta/my-performance?month=${month}${viewUser ? `&userId=${viewUser}` : ""}`) });
    const save = useAct("/api/ta/targets", "PUT", ["ta-performance"], "Target saved");

    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const maxFunnel = Math.max(1, ...STAGES.map((s) => data.funnel[s] ?? 0));

    return (
        <div className="space-y-6">
            <PageHeader
                title={viewUser ? `Performance — ${data.user.name}` : "My Performance"}
                subtitle="Monthly targets vs actuals, conversion and incentives"
                action={<div className="flex gap-2">
                    {data.team && <select value={viewUser} onChange={(e) => setViewUser(e.target.value)} className={`${inputCls} w-48`} aria-label="Recruiter"><option value="">Me</option>{data.team.map((t) => <option key={t.userId} value={t.userId}>{t.name}</option>)}</select>}
                    <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={`${inputCls} w-40`} aria-label="Month" />
                </div>}
            />

            {/* Revenue, target, shortfall and incentive */}
            <SectionCard title="Revenue, target & incentive" subtitle={`Revenue is booked on placement · incentive is ${data.earnings.incentivePct}% of the fee, credited when the client pays the invoice`}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <TargetPanel title="This month" period={monthName(data.month)} g={data.earnings.thisMonth}
                        note={data.earnings.daysLeftInMonth > 0 ? `${data.earnings.daysLeftInMonth} day${data.earnings.daysLeftInMonth === 1 ? "" : "s"} left` : undefined} />
                    <TargetPanel title={`Year to date · ${data.earnings.fyLabel}`} period={`${monthName(data.earnings.fyFrom)} – ${monthName(data.month)}`} g={data.earnings.yearToDate}
                        note={data.earnings.yearToDate.monthsWithTarget < data.earnings.yearToDate.months ? `targets set for ${data.earnings.yearToDate.monthsWithTarget} of ${data.earnings.yearToDate.months} months` : undefined} />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <StatCard label="Incentive earned (this month)" value={money(data.earnings.incentive.earnedThisMonth)} icon={Coins} tone="emerald" hint={`${data.earnings.fyLabel}: ${money(data.earnings.incentive.earnedThisYear)}`} />
                    <StatCard label="Incentive pending payout" value={money(data.earnings.incentive.pending)} icon={Hourglass} tone="amber" hint="Earned, awaiting payout" />
                    <StatCard label="Incentive paid (net)" value={money(data.earnings.incentive.paidNet)} icon={Wallet} tone="blue" hint={`Gross ${money(data.earnings.incentive.paidGross)} · TDS ${money(data.earnings.incentive.tds)}${data.earnings.incentive.clawback ? ` · clawback ${money(data.earnings.incentive.clawback)}` : ""}`} />
                    <StatCard label="Expected incentive" value={money(data.earnings.incentive.expected)} icon={IndianRupee} tone="purple" hint={`${data.earnings.incentive.expectedPlacements} placement(s) awaiting client payment`} />
                </div>
                {data.earnings.avgFeePerPlacement != null && <p className="text-[11px] text-neutral-400 mt-3">Average fee per placement (last 12 months): {money(data.earnings.avgFeePerPlacement)} — used to estimate joinings needed.</p>}
            </SectionCard>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {METRICS.map((m) => {
                    const a = data.actual[m.key];
                    const t = data.target?.[m.key];
                    const p = pct(a, t);
                    return (
                        <div key={m.key} className="bg-white rounded-2xl border border-neutral-200/80 p-4">
                            <div className="flex items-center justify-between text-xs font-bold text-neutral-500"><span>{m.label}</span><m.icon size={14} /></div>
                            <p className="text-2xl font-extrabold mt-1">{m.key === "revenue" ? money(a) : a}</p>
                            <p className="text-[11px] text-neutral-400">{t ? `Target ${m.key === "revenue" ? money(t) : t}` : "No target set"}</p>
                            {p !== null && <div className="h-1.5 bg-neutral-100 rounded-full mt-2 overflow-hidden"><div className={`h-full rounded-full ${p >= 100 ? "bg-emerald-500" : "bg-[#2a78d6]"}`} style={{ width: `${Math.min(100, p)}%` }} /></div>}
                            {p !== null && <p className={`text-[11px] font-bold mt-1 ${p >= 100 ? "text-emerald-600" : "text-neutral-500"}`}>{p}%</p>}
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Active pipeline" value={data.ratios.activePipeline} icon={Target} tone="blue" hint="Open applications you own" />
                <StatCard label="Application → offer" value={`${data.ratios.submissionToOffer}%`} icon={FileSignature} tone="purple" />
                <StatCard label="Offer → join" value={`${data.ratios.offerToJoin}%`} icon={UserCheck} tone="emerald" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard title="Last 6 months" subtitle="CVs shared vs joinings" className="lg:col-span-2">
                    <MonthlyCountChart data={data.trend} a={{ key: "submissions", label: "CVs shared" }} b={{ key: "joinings", label: "Joinings" }} />
                </SectionCard>
                <SectionCard title="My pipeline" subtitle="Applications by stage">
                    <ul className="space-y-2 text-xs">
                        {STAGES.map((s) => (
                            <li key={s} className="flex items-center gap-2">
                                <span className="w-32 text-neutral-600 truncate">{stageLabel(s)}</span>
                                <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-[#2a78d6] rounded-full" style={{ width: `${((data.funnel[s] ?? 0) / maxFunnel) * 100}%` }} /></div>
                                <span className="w-6 text-right font-mono font-bold">{data.funnel[s] ?? 0}</span>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            </div>

            <SectionCard title="Incentives" subtitle={`Pending ${money(data.incentives.pending)} · paid (net of TDS) ${money(data.incentives.paid)}`}>
                {data.incentives.entries.length === 0 ? <EmptyState icon={Wallet} message="No recruiter incentives yet — they are booked when a placement invoice is paid." /> : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.incentives.entries.map((e) => <li key={e.id} className="py-2.5 flex justify-between gap-3"><span>{e.description}<span className="block text-[11px] text-neutral-400">{e.createdAt.slice(0, 10)}</span></span><span className="text-right"><span className="font-mono font-bold">{money(e.amount)}</span><span className="block"><Badge value={e.status} /></span></span></li>)}
                    </ul>
                )}
            </SectionCard>

            {data.team && (
                <SectionCard title="Team targets" subtitle={`${month} — actual / target`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-[11px] text-neutral-500 uppercase"><th className="py-2">Recruiter</th>{METRICS.map((m) => <th key={m.key} className="py-2 text-right">{m.label}</th>)}<th className="py-2 text-right">Shortfall</th><th className="py-2 text-right">Incentive ({data.earnings.fyLabel})</th><th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {data.team.map((t) => (
                                    <tr key={t.userId}>
                                        <td className="py-2.5 font-semibold">{t.name} <Badge value={t.role} /></td>
                                        {METRICS.map((m) => <td key={m.key} className="py-2.5 text-right font-mono text-xs">{m.key === "revenue" ? money(t.actual[m.key]) : t.actual[m.key]}<span className="text-neutral-400"> / {t.target ? (m.key === "revenue" ? money(t.target[m.key]) : t.target[m.key]) : "—"}</span></td>)}
                                        <td className={`py-2.5 text-right font-mono text-xs font-bold ${(t.earnings.thisMonth.shortfall ?? 0) > 0 ? "text-red-600" : t.earnings.thisMonth.target ? "text-emerald-600" : "text-neutral-400"}`}>
                                            {t.earnings.thisMonth.target == null ? "—" : (t.earnings.thisMonth.shortfall ?? 0) > 0 ? money(t.earnings.thisMonth.shortfall!) : "Achieved"}
                                        </td>
                                        <td className="py-2.5 text-right font-mono text-xs">{money(t.earnings.incentive.earnedThisYear)}{t.earnings.incentive.pending ? <span className="block text-[10px] text-amber-600">{money(t.earnings.incentive.pending)} pending</span> : null}</td>
                                        <td className="py-2.5 text-right">{t.canSetTarget === false ? <span className="text-[10px] text-neutral-400" title="Your own target is set by Super Admin">Set by admin</span> : <button className={btn.ghost} onClick={() => setEdit({ userId: t.userId, name: t.name, vals: Object.fromEntries(METRICS.map((m) => [m.key, String(t.target?.[m.key] ?? "")])) })}>Set target</button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {edit && (
                <ModalShell onClose={() => setEdit(null)} title={`${edit.name} — ${month} targets`}>
                    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ userId: edit.userId, month, ...Object.fromEntries(Object.entries(edit.vals).map(([k, v]) => [k, Number(v) || 0])) }, { onSuccess: () => setEdit(null) }); }}>
                        {METRICS.map((m) => (
                            <label key={m.key} className="block text-xs font-bold text-neutral-600">{m.label}{m.key === "revenue" ? " (₹)" : ""}
                                <input type="number" min="0" value={edit.vals[m.key]} onChange={(e) => setEdit({ ...edit, vals: { ...edit.vals, [m.key]: e.target.value } })} className={inputCls} />
                            </label>
                        ))}
                        <button disabled={save.isPending} className="w-full py-2.5 rounded-md bg-primary text-white font-medium text-sm disabled:opacity-50">Save target</button>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
