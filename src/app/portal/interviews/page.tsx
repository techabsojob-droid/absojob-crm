"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";

interface Itv { id: string; round: string; scheduledAt: string; mode: string; status: string; outcome: string; candidateName: string; jobTitle: string; clientName: string | null; meetingLink?: string | null; feedback?: string | null; score?: number | null }
const inputCls = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none";

export default function MyInterviewsPage() {
    const qc = useQueryClient();
    const [fb, setFb] = useState<Itv | null>(null);
    const [form, setForm] = useState({ outcome: "HIRE", score: "7", feedback: "" });
    const { data = [] } = useQuery<Itv[]>({ queryKey: ["my-interviews"], queryFn: () => api<Itv[]>("/api/ta/interviews?assigned=me") });
    const submit = useMutation({
        mutationFn: () => api("/api/ta/interviews", "PATCH", { id: fb!.id, status: "COMPLETED", outcome: form.outcome, score: Number(form.score), feedback: form.feedback }),
        onSuccess: () => { toast.success("Feedback sent to the recruiter"); setFb(null); qc.invalidateQueries({ queryKey: ["my-interviews"] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const pending = data.filter((i) => ["SCHEDULED", "RESCHEDULED"].includes(i.status));
    const done = data.filter((i) => !["SCHEDULED", "RESCHEDULED"].includes(i.status));

    const row = (i: Itv) => (
        <li key={i.id} className="py-3 flex items-center justify-between gap-3 text-sm">
            <div>
                <p className="font-semibold">{i.candidateName} · {i.round.replace(/_/g, " ")}</p>
                <p className="text-[11px] text-neutral-500">{i.jobTitle}{i.clientName ? ` @ ${i.clientName}` : ""} · {new Date(i.scheduledAt).toLocaleString("en-IN")} · {i.mode}</p>
                {i.meetingLink && <a href={i.meetingLink} target="_blank" rel="noreferrer" className="text-[11px] text-primary font-bold">Join link</a>}
            </div>
            <div className="flex items-center gap-2">
                <Badge value={i.status === "COMPLETED" ? i.outcome : i.status} />
                {["SCHEDULED", "RESCHEDULED"].includes(i.status) && (
                    <button onClick={() => setFb(i)} className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold">Give feedback</button>
                )}
            </div>
        </li>
    );

    return (
        <div className="space-y-6 max-w-4xl">
            <PageHeader title="My Interviews" subtitle="Interviews where you are on the panel" />
            <SectionCard title={`Upcoming (${pending.length})`}>
                {pending.length === 0 ? <EmptyState icon={CalendarClock} message="No interviews assigned to you." /> : <ul className="divide-y divide-neutral-100">{pending.map(row)}</ul>}
            </SectionCard>
            {done.length > 0 && <SectionCard title={`Past (${done.length})`}><ul className="divide-y divide-neutral-100">{done.map(row)}</ul></SectionCard>}

            <ModalShell open={!!fb} onClose={() => setFb(null)} title={fb ? `Feedback — ${fb.candidateName}` : ""}>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
                    <div className="grid grid-cols-2 gap-3">
                        <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} className={inputCls}>
                            {[["STRONG_HIRE", "Strong hire"], ["HIRE", "Hire"], ["MAYBE", "Maybe / hold"], ["NO_HIRE", "Reject"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <input type="number" min="0" max="10" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className={inputCls} />
                    </div>
                    <textarea required rows={4} placeholder="Strengths, weaknesses, recommendation" value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} className={inputCls} />
                    <button disabled={submit.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit Feedback</button>
                </form>
            </ModalShell>
        </div>
    );
}
