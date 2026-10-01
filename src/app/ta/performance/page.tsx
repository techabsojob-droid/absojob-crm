"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Target, Send, CalendarClock, FileSignature, UserCheck, IndianRupee, Wallet } from "lucide-react";
import { PageHeader, StatCard, SectionCard, Badge, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { MonthlyCountChart } from "@/components/finance/Charts";
import { btn, inputCls, money, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

type Kpi = { submissions: number; interviews: number; offers: number; joinings: number; revenue: number };
interface Perf {
    user: { id: string; name: string };
    month: string;
    actual: Kpi;
    target: (Kpi & { setByName: string }) | null;
    funnel: Record<string, number>;
    trend: ({ month: string } & Kpi)[];
    incentives: { pending: number; paid: number; entries: { id: string; description: string; amount: number; status: string; createdAt: string }[] };
    ratios: { submissionToOffer: number; offerToJoin: number; activePipeline: number };
    team: { userId: string; name: string; role: string; actual: Kpi; target: Kpi | null }[] | null;
    canSetTargets: boolean;
}

const METRICS: { key: keyof Kpi; label: string; icon: typeof Send }[] = [
    { key: "submissions", label: "CVs shared", icon: Send },
    { key: "interviews", label: "Interviews", icon: CalendarClock },
    { key: "offers", label: "Offers", icon: FileSignature },
    { key: "joinings", label: "Joinings", icon: UserCheck },
    { key: "revenue", label: "Revenue", icon: IndianRupee },
];
const STAGES = ["SOURCED", "SCREENING", "INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"];
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
                                <span className="w-32 text-neutral-600 truncate">{s.replace(/_/g, " ").toLowerCase()}</span>
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
                            <thead><tr className="text-left text-[11px] text-neutral-500 uppercase"><th className="py-2">Recruiter</th>{METRICS.map((m) => <th key={m.key} className="py-2 text-right">{m.label}</th>)}<th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {data.team.map((t) => (
                                    <tr key={t.userId}>
                                        <td className="py-2.5 font-semibold">{t.name} <Badge value={t.role} /></td>
                                        {METRICS.map((m) => <td key={m.key} className="py-2.5 text-right font-mono text-xs">{m.key === "revenue" ? money(t.actual[m.key]) : t.actual[m.key]}<span className="text-neutral-400"> / {t.target ? (m.key === "revenue" ? money(t.target[m.key]) : t.target[m.key]) : "—"}</span></td>)}
                                        <td className="py-2.5 text-right"><button className={btn.ghost} onClick={() => setEdit({ userId: t.userId, name: t.name, vals: Object.fromEntries(METRICS.map((m) => [m.key, String(t.target?.[m.key] ?? "")])) })}>Set target</button></td>
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
                        <button disabled={save.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50">Save target</button>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
