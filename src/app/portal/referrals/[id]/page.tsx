"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, AlertTriangle, CheckCircle2, Circle, XCircle, CalendarClock } from "lucide-react";
import { Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { money } from "@/components/finance/kit";
import ReferralThread from "@/components/shared/ReferralThread";
import { api } from "@/lib/api";

interface Detail {
    id: string; status: string; createdAt: string; reviewNotes: string | null; agentNotes: string | null; resumeUrl: string | null;
    candidate: { name: string; email: string; phone: string; currentCompany: string | null; totalExperienceYears: number; skills: string[] } | null;
    job: { id: string; title: string; clientName: string | null; location: string } | null;
    stage: { code: string; label: string } | null;
    nextInterview: string | null;
    incentive: { amount: number | null; estimate: number; status: string | null; paid: boolean };
    timeline: { date: string; title: string; detail?: string; tone: "done" | "info" | "bad" | "upcoming" }[];
}

const ICON = { done: CheckCircle2, info: Circle, bad: XCircle, upcoming: CalendarClock };
const COLOR = { done: "text-emerald-600", info: "text-neutral-400", bad: "text-rose-600", upcoming: "text-[#2a78d6]" };

export default function ReferralDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { data, isLoading, error } = useQuery<Detail>({ queryKey: ["portal-referral", id], queryFn: () => api(`/api/portal/referrals/${id}`), refetchInterval: 30000 });
    if (isLoading) return <SkeletonPulse className="h-96 w-full" />;
    if (error || !data) return <SectionCard><EmptyState icon={AlertTriangle} message="Referral not found." /></SectionCard>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/portal/referrals" className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:bg-neutral-50" title="Back"><ArrowLeft size={16} /></Link>
                <div>
                    <h1 className="text-2xl font-black text-neutral-900 flex items-center gap-2">{data.candidate?.name} <Badge value={data.status} /></h1>
                    <p className="text-xs text-neutral-500">{data.job ? `${data.job.title}${data.job.clientName ? ` · ${data.job.clientName}` : ""} · ${data.job.location}` : "General referral"} · referred {data.createdAt.slice(0, 10)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <SectionCard title="Progress" subtitle={data.stage ? `Current stage: ${data.stage.label}` : "Waiting for the recruitment team to review"}>
                        <ol className="space-y-4">
                            {data.timeline.map((t, i) => {
                                const Icon = ICON[t.tone];
                                return (
                                    <li key={i} className="flex gap-3">
                                        <Icon size={18} className={`${COLOR[t.tone]} shrink-0 mt-0.5`} />
                                        <div className="text-sm"><p className="font-bold text-neutral-900">{t.title}</p>{t.detail && <p className="text-xs text-neutral-600">{t.detail}</p>}<p className="text-[11px] text-neutral-400">{new Date(t.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: t.tone === "upcoming" ? "short" : undefined })}</p></div>
                                    </li>
                                );
                            })}
                        </ol>
                        {data.status === "REJECTED" && data.reviewNotes && <p className="mt-4 text-xs rounded-xl bg-rose-50 text-rose-700 p-3">Reason: {data.reviewNotes}</p>}
                    </SectionCard>
                    <SectionCard title="Messages with the recruitment team"><ReferralThread referralId={data.id} /></SectionCard>
                </div>
                <div className="space-y-6">
                    <SectionCard title="Incentive">
                        <p className="text-3xl font-extrabold text-emerald-700">{money(data.incentive.amount ?? data.incentive.estimate)}</p>
                        <p className="text-xs text-neutral-500 mt-1">{data.incentive.paid ? "Paid" : data.incentive.status ? `Status: ${data.incentive.status.toLowerCase()}` : data.status === "REJECTED" ? "Not applicable" : "Estimate — confirmed when the candidate joins, based on the offered CTC"}</p>
                        {data.nextInterview && <p className="mt-3 text-xs font-bold text-[#2a78d6] flex items-center gap-1"><CalendarClock size={12} /> Next interview {new Date(data.nextInterview).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>}
                    </SectionCard>
                    <SectionCard title="Candidate">
                        {data.candidate && (
                            <div className="text-xs space-y-1.5">
                                <p>{data.candidate.email} · {data.candidate.phone}</p>
                                <p>{data.candidate.currentCompany ?? "—"} · {data.candidate.totalExperienceYears} yrs</p>
                                <p className="text-neutral-500">{data.candidate.skills.join(", ")}</p>
                                {data.resumeUrl && <a href={data.resumeUrl} target="_blank" rel="noopener" className="font-bold text-primary flex items-center gap-1"><FileText size={12} /> Resume you shared</a>}
                                {data.agentNotes && <p className="text-neutral-600 pt-1">Your note: “{data.agentNotes}”</p>}
                            </div>
                        )}
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
