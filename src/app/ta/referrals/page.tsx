"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { UserPlus, FileText, MessageSquare } from "lucide-react";
import ReferralThread from "@/components/shared/ReferralThread";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";

interface Ref {
    id: string; status: string; createdAt: string; candidateName: string; candidateEmail: string; candidatePhone: string;
    currentCompany: string | null; totalExperienceYears: number; expectedCtcLpa: number; skills: string[];
    jobId: string | null; jobTitle: string | null; clientName: string | null; agentName: string;
    applicationId: string | null; applicationStage: string | null; reviewNotes?: string | null; incentiveAmount: number;
    candidateId: string; resumeUrl: string | null; agentNotes?: string | null; messages: number;
}

export default function TaReferralsPage() {
    const qc = useQueryClient();
    const [status, setStatus] = useState("SUBMITTED");
    const [accepting, setAccepting] = useState<Ref | null>(null);
    const [jobId, setJobId] = useState("");
    const [thread, setThread] = useState<Ref | null>(null);

    const { data = [] } = useQuery<Ref[]>({ queryKey: ["ta-referrals", status], queryFn: () => api<Ref[]>(`/api/ta/referrals?status=${status}`) });
    const { data: jobs = [] } = useQuery<{ id: string; title: string; clientName: string | null }[]>({ queryKey: ["portal-open-jobs"], queryFn: () => api("/api/portal/jobs") });

    const act = useMutation({
        mutationFn: (body: Record<string, unknown>) => api("/api/ta/referrals", "PATCH", body),
        onSuccess: (_d, body) => {
            toast.success(body.action === "ACCEPT" ? "Added to pipeline — agent notified" : "Referral closed — agent notified");
            setAccepting(null);
            setJobId("");
            qc.invalidateQueries({ queryKey: ["ta-referrals"] });
            qc.invalidateQueries({ queryKey: ["pipeline"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <div className="space-y-6">
            <PageHeader title="Referral Review" subtitle="Candidates referred by agents and employees — accept into a job pipeline or close with a reason" />
            <div className="flex gap-2">
                {["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "HIRED", "REJECTED", "ALL"].map((s) => (
                    <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${status === s ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>{s.replace("_", " ")}</button>
                ))}
            </div>
            <SectionCard title={`Referrals (${data.length})`}>
                {data.length === 0 ? <EmptyState icon={UserPlus} message="No referrals in this state." /> : (
                    <ul className="divide-y divide-neutral-100">
                        {data.map((r) => (
                            <li key={r.id} className="py-3.5 flex items-start justify-between gap-4 text-sm">
                                <div className="space-y-0.5">
                                    <p className="font-bold text-neutral-900"><Link href={`/ta/candidates/${r.candidateId}`} className="hover:text-primary">{r.candidateName}</Link> <span className="font-normal text-neutral-500">· referred by {r.agentName}</span></p>
                                    <p className="text-xs text-neutral-600">{r.currentCompany ?? "—"} · {r.totalExperienceYears} yrs · expects ₹{r.expectedCtcLpa} LPA · {r.candidateEmail}</p>
                                    <p className="text-xs text-neutral-500">For: {r.jobTitle ? `${r.jobTitle}${r.clientName ? ` @ ${r.clientName}` : ""}` : <em>no job selected</em>}{r.applicationStage ? ` · pipeline: ${r.applicationStage.replace(/_/g, " ")}` : ""}</p>
                                    {r.skills.length > 0 && <p className="text-[11px] text-neutral-400">{r.skills.slice(0, 6).join(" · ")}</p>}
                                    {r.agentNotes && <p className="text-[11px] text-neutral-600">Partner note: “{r.agentNotes}”</p>}
                                    {r.reviewNotes && <p className="text-[11px] text-neutral-500 italic">{r.reviewNotes}</p>}
                                    <div className="flex gap-3 pt-0.5">
                                        {r.resumeUrl && <a href={r.resumeUrl} target="_blank" rel="noopener" className="text-[11px] font-bold text-primary flex items-center gap-1"><FileText size={11} /> Resume</a>}
                                        <button onClick={() => setThread(r)} className="text-[11px] font-bold text-primary flex items-center gap-1"><MessageSquare size={11} /> Messages{r.messages ? ` (${r.messages})` : ""}</button>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <Badge value={r.status} />
                                    {["SUBMITTED", "UNDER_REVIEW"].includes(r.status) && !r.applicationId && (
                                        <div className="flex gap-1.5">
                                            <button onClick={() => { setAccepting(r); setJobId(r.jobId ?? ""); }} className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold">Add to pipeline</button>
                                            <button
                                                onClick={() => { const reason = window.prompt("Why is this referral not a fit?"); if (reason) act.mutate({ id: r.id, action: "REJECT", reason }); }}
                                                className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold"
                                            >
                                                Not a fit
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <ModalShell open={!!thread} onClose={() => setThread(null)} title={thread ? `${thread.candidateName} — chat with ${thread.agentName}` : ""}>
                {thread && <ReferralThread referralId={thread.id} />}
            </ModalShell>

            <ModalShell open={!!accepting} onClose={() => setAccepting(null)} title={accepting ? `Add ${accepting.candidateName} to a pipeline` : ""}>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (accepting) act.mutate({ id: accepting.id, action: "ACCEPT", jobId }); }}>
                    <select required value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm">
                        <option value="">Select open job</option>
                        {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.clientName ? ` — ${j.clientName}` : ""}</option>)}
                    </select>
                    <p className="text-[11px] text-neutral-400">The candidate enters SCREENING and is owned by the job&apos;s primary recruiter.</p>
                    <button disabled={act.isPending || !jobId} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Add to Pipeline</button>
                </form>
            </ModalShell>
        </div>
    );
}
