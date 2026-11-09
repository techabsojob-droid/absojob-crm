"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, Download, Layers, Plus, UserX, Users } from "lucide-react";
import { PageHeader, SectionCard, EmptyState, Badge, StatCard } from "@/components/shared/ui";
import { ErrorState, SkeletonPulse } from "@/components/shared/UIStates";
import { btn, downloadText, inputCls, toCsv } from "@/components/finance/kit";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

interface Row {
    id: string; code: string | null; title: string; department: string; clientId: string; clientName: string; industry: string;
    location: string; workMode: string | null; employmentType: string; experienceMin: number; experienceMax: number;
    salaryMinLpa: number; salaryMaxLpa: number; vacancies: number; filled: number; remaining: number;
    status: string; isOpen: boolean; priority: string; primaryRecruiterName: string | null; recruiters: { id: string; name: string }[];
    inPipeline: number; postedAt: string; targetCloseDate: string | null;
}
interface Data {
    items: Row[];
    facets: { industries: string[]; clients: { id: string; name: string }[]; locations: string[]; employmentTypes: string[]; statuses: string[]; recruiters: { id: string; name: string }[] };
    summary: { openings: number; vacancies: number; clients: number; industries: number; unassigned: number };
    byIndustry: { industry: string; openings: number; vacancies: number }[];
}

const EMPTY = { industry: "ALL", clientId: "ALL", q: "", location: "", experience: "", employmentType: "ALL", status: "OPEN", recruiterId: "ALL", postedFrom: "", postedTo: "" };
const nice = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function AllOpeningsPage() {
    const { user } = useAuth();
    const [f, setF] = useState(EMPTY);
    const set = (k: keyof typeof EMPTY, v: string) => setF((p) => ({ ...p, [k]: v }));
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== "" && v !== "ALL").map(([k, v]) => [k, v])).toString();
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery<Data>({ queryKey: ["ta-openings", qs], queryFn: () => api(`/api/ta/openings?${qs}`), placeholderData: (p) => p });

    if (isError && !data) return <ErrorState description={(error as Error).message} onRetry={() => refetch()} />;
    if (isLoading || !data) return <SkeletonPulse className="h-[32rem] w-full" />;
    const sel = `${inputCls} !py-1.5 !text-xs font-semibold`;
    const filtersOn = JSON.stringify(f) !== JSON.stringify(EMPTY);

    const exportCsv = () => downloadText(toCsv([
        ["Code", "Job title", "Client", "Industry", "Location", "Experience", "Employment type", "Vacancies", "Filled", "Remaining", "Recruiter", "Status", "Posted"],
        ...data.items.map((r) => [r.code ?? "", r.title, r.clientName, r.industry, r.location, `${r.experienceMin}-${r.experienceMax} yrs`, nice(r.employmentType), r.vacancies, r.filled, r.remaining, r.recruiters.map((x) => x.name).join("; "), nice(r.status), r.postedAt]),
    ]), "all-openings.csv");

    return (
        <div className="space-y-6">
            <PageHeader title="All Openings" subtitle="Every job opening you're authorised to work on, across your clients' industries"
                action={
                    <div className="flex gap-2">
                        <button onClick={exportCsv} className={btn.ghost}><Download size={13} className="inline mr-1" />CSV</button>
                        {user?.role !== "AGENT" && <Link href="/ta/requisitions/new" className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1"><Plus size={13} />New requisition</Link>}
                    </div>
                } />

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard label="Openings" value={data.summary.openings} icon={Briefcase} tone="primary" />
                <StatCard label="Vacancies left" value={data.summary.vacancies} icon={Users} tone="blue" />
                <StatCard label="Clients" value={data.summary.clients} icon={Building2} tone="purple" />
                <StatCard label="Industries" value={data.summary.industries} icon={Layers} tone="emerald" />
                <StatCard label="No recruiter" value={data.summary.unassigned} icon={UserX} tone={data.summary.unassigned ? "amber" : "neutral"} hint="Open roles nobody is assigned to" />
            </div>

            {data.byIndustry.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => set("industry", "ALL")} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${f.industry === "ALL" ? "bg-primary text-white border-primary" : "bg-white border-neutral-200 text-neutral-600"}`}>All industries</button>
                    {data.byIndustry.map((i) => (
                        <button key={i.industry} onClick={() => set("industry", f.industry === i.industry ? "ALL" : i.industry)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${f.industry === i.industry ? "bg-primary text-white border-primary" : "bg-white border-neutral-200 text-neutral-600 hover:border-primary/40"}`}>
                            {i.industry} <span className="opacity-70">· {i.openings}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-neutral-200/80 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    <label className="text-[11px] font-bold text-neutral-500 col-span-2 md:col-span-1">Job title / skill<input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="e.g. Java" className={sel} /></label>
                    <label className="text-[11px] font-bold text-neutral-500">Industry<select value={f.industry} onChange={(e) => set("industry", e.target.value)} className={sel}><option value="ALL">All</option>{data.facets.industries.map((x) => <option key={x}>{x}</option>)}</select></label>
                    <label className="text-[11px] font-bold text-neutral-500">Client<select value={f.clientId} onChange={(e) => set("clientId", e.target.value)} className={sel}><option value="ALL">All</option>{data.facets.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                    <label className="text-[11px] font-bold text-neutral-500">Location<input list="opening-locations" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="City" className={sel} /><datalist id="opening-locations">{data.facets.locations.map((l) => <option key={l} value={l} />)}</datalist></label>
                    <label className="text-[11px] font-bold text-neutral-500">Experience (yrs)<input type="number" min="0" max="50" value={f.experience} onChange={(e) => set("experience", e.target.value)} placeholder="Candidate's years" className={sel} /></label>
                    <label className="text-[11px] font-bold text-neutral-500">Employment type<select value={f.employmentType} onChange={(e) => set("employmentType", e.target.value)} className={sel}><option value="ALL">All</option>{data.facets.employmentTypes.map((x) => <option key={x} value={x}>{nice(x)}</option>)}</select></label>
                    <label className="text-[11px] font-bold text-neutral-500">Job status<select value={f.status} onChange={(e) => set("status", e.target.value)} className={sel}><option value="OPEN">Open (all active)</option><option value="ALL">Any status</option>{data.facets.statuses.map((x) => <option key={x} value={x}>{nice(x)}</option>)}</select></label>
                    <label className="text-[11px] font-bold text-neutral-500">Recruiter<select value={f.recruiterId} onChange={(e) => set("recruiterId", e.target.value)} className={sel}><option value="ALL">All</option>{data.facets.recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                    <label className="text-[11px] font-bold text-neutral-500">Posted from<input type="date" value={f.postedFrom} onChange={(e) => set("postedFrom", e.target.value)} className={sel} /></label>
                    <label className="text-[11px] font-bold text-neutral-500">Posted to<input type="date" value={f.postedTo} onChange={(e) => set("postedTo", e.target.value)} className={sel} /></label>
                </div>
                {filtersOn && <button onClick={() => setF(EMPTY)} className="mt-2 text-xs font-bold text-primary">Reset filters</button>}
            </div>

            <SectionCard title={`${data.items.length} opening${data.items.length === 1 ? "" : "s"}`} subtitle={isFetching ? "Updating…" : "Sorted by open first, newest posted first"}>
                {data.items.length === 0 ? (
                    <EmptyState icon={Briefcase} message={filtersOn ? "No openings match these filters." : "No openings yet for your clients. Create a requisition, or ask Super Admin to assign clients to you."} />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-[10px] text-neutral-500 uppercase"><th className="py-2">Job</th><th>Client</th><th>Location</th><th>Experience</th><th>Type</th><th className="text-right">Vacancies</th><th>Recruiter</th><th>Status</th><th>Posted</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {data.items.map((r) => (
                                    <tr key={r.id} className="hover:bg-neutral-50/60">
                                        <td className="py-2.5 pr-3"><Link href={`/ta/requisitions/${r.id}`} className="font-semibold hover:text-primary">{r.title}</Link><span className="block text-[10px] text-neutral-400">{[r.code, r.department].filter(Boolean).join(" · ")}</span></td>
                                        <td className="pr-3 text-xs"><span className="font-semibold text-neutral-800">{r.clientName}</span><span className="block text-neutral-400">{r.industry}</span></td>
                                        <td className="pr-3 text-xs">{r.location}{r.workMode && <span className="block text-neutral-400">{nice(r.workMode)}</span>}</td>
                                        <td className="pr-3 text-xs whitespace-nowrap">{r.experienceMin}–{r.experienceMax} yrs</td>
                                        <td className="pr-3 text-xs">{nice(r.employmentType)}</td>
                                        <td className="pr-3 text-right font-mono text-xs whitespace-nowrap"><b>{r.remaining}</b><span className="text-neutral-400"> / {r.vacancies}</span><span className="block text-[10px] text-neutral-400">{r.inPipeline} in pipeline</span></td>
                                        <td className="pr-3 text-xs">{r.primaryRecruiterName ?? <span className="text-amber-700 font-bold">Unassigned</span>}{r.recruiters.length > 1 && <span className="text-neutral-400"> +{r.recruiters.length - 1}</span>}</td>
                                        <td className="pr-3"><Badge value={r.status} /></td>
                                        <td className="text-xs whitespace-nowrap text-neutral-500">{r.postedAt}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
