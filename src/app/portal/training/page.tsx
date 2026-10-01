"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Star } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, inputCls, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Prog { id: string; title: string; course: string; trainer: string; startDate: string; endDate: string; status: string; description: string; completed: boolean; myFeedback: { rating: number; comment: string } | null; seats: number }

export default function MyTrainingPage() {
    const { data, isLoading } = useQuery<{ mine: Prog[]; open: Prog[] }>({ queryKey: ["my-training"], queryFn: () => api("/api/portal/training") });
    const act = useAct("/api/portal/training", "POST", ["my-training"], "Saved");
    const [fb, setFb] = useState<Prog | null>(null);
    const [form, setForm] = useState({ rating: "5", comment: "" });
    const today = new Date().toISOString().slice(0, 10);
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const row = (p: Prog, action: React.ReactNode) => (
        <li key={p.id} className="py-3 flex items-center justify-between gap-3 text-sm">
            <div><p className="font-semibold">{p.title}</p><p className="text-[11px] text-neutral-500">{p.course} · {p.trainer} · {p.startDate} → {p.endDate} · {p.seats} enrolled</p><p className="text-[11px] text-neutral-400">{p.description}</p></div>
            <div className="flex items-center gap-2 shrink-0">{action}</div>
        </li>
    );
    return (
        <div className="space-y-6 max-w-4xl">
            <PageHeader title="My Training" subtitle="Programmes you're enrolled in and open programmes you can join" />
            <SectionCard title={`My programmes (${data.mine.length})`}>
                {data.mine.length === 0 ? <EmptyState icon={GraduationCap} message="You are not enrolled in any training yet." /> : (
                    <ul className="divide-y divide-neutral-100">
                        {data.mine.map((p) => row(p, <>
                            {p.completed ? <Badge value="COMPLETED" label="Completed 🎓" /> : <Badge value={p.status} />}
                            {p.myFeedback ? <span className="text-xs text-amber-600 flex items-center gap-0.5">{p.myFeedback.rating}<Star size={11} fill="currentColor" /></span> : (p.endDate <= today || p.status === "COMPLETED") && <button onClick={() => { setFb(p); setForm({ rating: "5", comment: "" }); }} className={btn.soft}>Rate & complete</button>}
                        </>))}
                    </ul>
                )}
            </SectionCard>
            <SectionCard title={`Open for enrolment (${data.open.length})`}>
                {data.open.length === 0 ? <p className="text-xs text-neutral-400 py-4 text-center">No open programmes right now.</p> : (
                    <ul className="divide-y divide-neutral-100">{data.open.map((p) => row(p, <button disabled={act.isPending} onClick={() => act.mutate({ id: p.id, action: "enroll" })} className={btn.primary}>Enrol</button>))}</ul>
                )}
            </SectionCard>
            <ModalShell open={!!fb} onClose={() => setFb(null)} title={fb ? `Feedback — ${fb.title}` : ""}>
                {fb && (
                    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act.mutate({ id: fb.id, action: "feedback", rating: Number(form.rating), comment: form.comment }, { onSuccess: () => setFb(null) }); }}>
                        <select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className={inputCls} aria-label="Rating">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
                        <textarea rows={4} placeholder="What did you learn? What could be better?" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className={inputCls} />
                        <button disabled={act.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit & mark complete</button>
                    </form>
                )}
            </ModalShell>
        </div>
    );
}
