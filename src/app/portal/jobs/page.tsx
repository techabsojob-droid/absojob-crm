"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, MapPin, Search, IndianRupee, Users } from "lucide-react";
import { PageHeader, SectionCard, Badge, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, inputCls, money } from "@/components/finance/kit";
import ReferralForm from "@/components/portal/ReferralForm";
import { JobOverview } from "@/components/shared/JobOverview";
import type { JobOverview as Overview } from "@/lib/mock/job-overview";
import { api } from "@/lib/api";

interface Job { id: string; title: string; clientName: string | null; industry: string | null; location: string; workMode: string | null; department: string; employmentType: string; experienceMinYears: number; experienceMaxYears: number; salaryMinLpa: number; salaryMaxLpa: number; skills: string[]; preferredSkills: string[]; education: string | null; noticePeriodPreference: string | null; description: string; responsibilities: string | null; openings: number; priority: string; postedAt: string; incentiveEstimate: number; myReferrals: number; overview: Overview }

export default function PortalJobsPage() {
    const { data, isLoading } = useQuery<Job[]>({ queryKey: ["portal-open-jobs"], queryFn: () => api("/api/portal/jobs") });
    const [q, setQ] = useState("");
    const [loc, setLoc] = useState("");
    const [exp, setExp] = useState("");
    const [view, setView] = useState<Job | null>(null);
    const [referFor, setReferFor] = useState<string | null>(null);

    const locations = useMemo(() => Array.from(new Set((data ?? []).map((j) => j.location))).sort(), [data]);
    const list = (data ?? []).filter((j) => {
        const t = q.trim().toLowerCase();
        if (t && ![j.title, j.clientName ?? "", j.department, ...j.skills].some((x) => x.toLowerCase().includes(t))) return false;
        if (loc && j.location !== loc) return false;
        if (exp && (Number(exp) < j.experienceMinYears || Number(exp) > j.experienceMaxYears)) return false;
        return true;
    });

    if (isLoading) return <SkeletonPulse className="h-96 w-full" />;
    return (
        <div className="space-y-6">
            <PageHeader title="Open Jobs" subtitle="Live mandates you can refer candidates for — incentive shown is the estimate at the mid salary" />
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[220px]"><Search size={14} className="absolute left-3 top-2.5 text-neutral-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, client, skill" className={`${inputCls} pl-8`} /></div>
                <select value={loc} onChange={(e) => setLoc(e.target.value)} className={`${inputCls} w-44`} aria-label="Location"><option value="">All locations</option>{locations.map((l) => <option key={l}>{l}</option>)}</select>
                <input type="number" min="0" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="Candidate exp (yrs)" className={`${inputCls} w-44`} />
            </div>
            {list.length === 0 ? <SectionCard><EmptyState icon={Briefcase} message="No open jobs match your filters." /></SectionCard> : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {list.map((j) => (
                        <div key={j.id} className="bg-white rounded-2xl border border-neutral-200/80 p-5 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2">
                                <div><p className="font-bold text-neutral-900">{j.title}</p><p className="text-xs text-neutral-500">{j.clientName ?? "Confidential client"}{j.industry ? ` · ${j.industry}` : ""}</p></div>
                                {["URGENT", "HIGH"].includes(j.priority) && <Badge value={j.priority} />}
                            </div>
                            <div className="text-xs text-neutral-600 space-y-1">
                                <p className="flex items-center gap-1.5"><MapPin size={12} /> {j.location}{j.workMode ? ` · ${j.workMode.toLowerCase()}` : ""}</p>
                                <p className="flex items-center gap-1.5"><Briefcase size={12} /> {j.experienceMinYears}–{j.experienceMaxYears} yrs · {j.salaryMinLpa}–{j.salaryMaxLpa} LPA</p>
                                <p className="flex items-center gap-1.5"><Users size={12} /> {j.openings} opening(s){j.myReferrals ? ` · you referred ${j.myReferrals}` : ""}</p>
                            </div>
                            <div className="flex flex-wrap gap-1">{j.skills.slice(0, 5).map((s) => <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{s}</span>)}</div>
                            <div className="mt-auto flex items-center justify-between pt-2 border-t border-neutral-100">
                                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1"><IndianRupee size={12} />{money(j.incentiveEstimate).slice(1)} est.</span>
                                <div className="flex gap-1.5"><button onClick={() => setView(j)} className={btn.ghost}>Details</button><button onClick={() => setReferFor(j.id)} className={btn.primary}>Refer</button></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {view && (
                <ModalShell onClose={() => setView(null)} title={view.title} wide>
                    <div className="space-y-4 text-sm">
                        <JobOverview job={view.overview} />
                        <p className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800">Your referral incentive: <b>{money(view.incentiveEstimate)}</b> (estimate at the mid salary){view.myReferrals ? ` · you've referred ${view.myReferrals} so far` : ""}</p>
                        <button onClick={() => { setReferFor(view.id); setView(null); }} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold">Refer a candidate for this job</button>
                    </div>
                </ModalShell>
            )}
            {referFor && <ReferralForm open onClose={() => setReferFor(null)} jobId={referFor} />}
        </div>
    );
}
