"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import ManagerReviewModal from "@/components/hr/ManagerReviewModal";

interface Review {
    id: string; employeeId: string; employeeName: string; reviewCycle: string; status: string; rating?: number | null;
    employeeFeedback?: string | null; managerFeedback?: string | null; goals: { id: string; title: string; progress: number }[];
}
const inputCls = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none";
interface Goal { id: string; title: string; description: string; type: string; startDate: string; endDate: string; weight: number; progress: number; status: string; ownerName: string }

export default function MyPerformancePage() {
    const qc = useQueryClient();
    const [selfFor, setSelfFor] = useState<Review | null>(null);
    const [selfText, setSelfText] = useState("");
    const [progress, setProgress] = useState<Record<string, number>>({});
    const [managing, setManaging] = useState<Review | null>(null);

    const { data: mine = [] } = useQuery<Review[]>({ queryKey: ["my-reviews"], queryFn: () => api<Review[]>("/api/hr/performance?mine=1") });
    const { data: visible = [] } = useQuery<Review[]>({ queryKey: ["team-reviews"], queryFn: () => api<Review[]>("/api/hr/performance") });
    const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["my-goals"], queryFn: () => api<Goal[]>("/api/portal/goals") });
    const [goalOpen, setGoalOpen] = useState(false);
    const [goalForm, setGoalForm] = useState({ title: "", description: "", startDate: "", endDate: "", weight: "20" });
    const goalAct = useMutation({
        mutationFn: (b: { method: "POST" | "PATCH"; body: Record<string, unknown> }) => api("/api/portal/goals", b.method, b.body),
        onSuccess: () => { toast.success("Goal saved"); setGoalOpen(false); qc.invalidateQueries({ queryKey: ["my-goals"] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const myIds = new Set(mine.map((r) => r.id));
    const team = visible.filter((r) => !myIds.has(r.id));

    const act = useMutation({
        mutationFn: (body: Record<string, unknown>) => api("/api/hr/performance", "PATCH", body),
        onSuccess: () => {
            toast.success("Review submitted");
            setSelfFor(null);
            setManaging(null);
            qc.invalidateQueries({ queryKey: ["my-reviews"] });
            qc.invalidateQueries({ queryKey: ["team-reviews"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const card = (r: Review, action?: React.ReactNode) => (
        <div key={r.id} className="border border-neutral-200 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
                <p className="font-bold">{r.employeeName} · {r.reviewCycle}</p>
                <Badge value={r.status} />
            </div>
            {r.goals.map((g) => <p key={g.id} className="text-xs text-neutral-600">• {g.title} — {g.progress}%</p>)}
            {r.rating != null && <p className="text-xs">Rating: <strong>{r.rating}/5</strong>{r.managerFeedback ? ` — ${r.managerFeedback}` : ""}</p>}
            {action}
        </div>
    );

    return (
        <div className="space-y-6 max-w-4xl">
            <PageHeader title="My Performance" subtitle="Goals, self review and your manager's feedback" />
            <SectionCard title={`Goals & OKRs (${goals.length})`} action={<button onClick={() => setGoalOpen(true)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">Add goal</button>}>
                {goals.length === 0 ? <EmptyState icon={Target} message="No goals yet — add what you plan to achieve this cycle." /> : (
                    <ul className="space-y-3">
                        {goals.map((g) => (
                            <li key={g.id} className="text-sm">
                                <div className="flex items-center justify-between gap-2"><p className="font-semibold">{g.title} <span className="text-[10px] text-neutral-400">{g.type.toLowerCase()} · weight {g.weight}% · {g.startDate} → {g.endDate}</span></p><Badge value={g.status} /></div>
                                <div className="flex items-center gap-3 mt-1">
                                    <input type="range" min="0" max="100" step="5" defaultValue={g.progress} disabled={g.type !== "INDIVIDUAL" || goalAct.isPending} onMouseUp={(e) => goalAct.mutate({ method: "PATCH", body: { id: g.id, progress: Number((e.target as HTMLInputElement).value) } })} onKeyUp={(e) => goalAct.mutate({ method: "PATCH", body: { id: g.id, progress: Number((e.target as HTMLInputElement).value) } })} className="flex-1" aria-label={`${g.title} progress`} />
                                    <span className="w-10 text-right text-xs font-bold text-primary">{g.progress}%</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <ModalShell open={goalOpen} onClose={() => setGoalOpen(false)} title="New goal">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); goalAct.mutate({ method: "POST", body: { ...goalForm, weight: Number(goalForm.weight) } }); }}>
                    <input required placeholder="Goal (e.g. Close 12 positions in Q3)" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} className={inputCls} />
                    <textarea rows={2} placeholder="How will it be measured?" value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} className={inputCls} />
                    <div className="grid grid-cols-3 gap-2">
                        <input required type="date" value={goalForm.startDate} onChange={(e) => setGoalForm({ ...goalForm, startDate: e.target.value })} className={inputCls} aria-label="Start" />
                        <input required type="date" min={goalForm.startDate} value={goalForm.endDate} onChange={(e) => setGoalForm({ ...goalForm, endDate: e.target.value })} className={inputCls} aria-label="End" />
                        <input type="number" min="1" max="100" value={goalForm.weight} onChange={(e) => setGoalForm({ ...goalForm, weight: e.target.value })} className={inputCls} aria-label="Weight %" />
                    </div>
                    <button disabled={goalAct.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save goal</button>
                </form>
            </ModalShell>

            <SectionCard title="My Reviews">
                {mine.length === 0 ? <EmptyState icon={Target} message="No review cycles yet." /> : (
                    <div className="grid gap-3">
                        {mine.map((r) => card(r, ["GOALS_SET", "SELF_REVIEW"].includes(r.status) ? (
                            <button onClick={() => { setSelfFor(r); setSelfText(r.employeeFeedback ?? ""); setProgress(Object.fromEntries(r.goals.map((g) => [g.id, g.progress]))); }} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">Submit self review</button>
                        ) : undefined))}
                    </div>
                )}
            </SectionCard>
            {team.length > 0 && (
                <SectionCard title="My Team's Reviews">
                    <div className="grid gap-3">
                        {team.map((r) => card(r, r.status === "MANAGER_REVIEW" ? (
                            <button onClick={() => setManaging(r)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">Give manager review</button>
                        ) : undefined))}
                    </div>
                </SectionCard>
            )}

            <ModalShell open={!!selfFor} onClose={() => setSelfFor(null)} title={selfFor ? `Self review · ${selfFor.reviewCycle}` : ""}>
                {selfFor && (
                    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act.mutate({ id: selfFor.id, action: "self_review", employeeFeedback: selfText, goalProgress: Object.entries(progress).map(([id, p]) => ({ id, progress: p })) }); }}>
                        {selfFor.goals.map((g) => (
                            <label key={g.id} className="block text-xs font-bold text-neutral-600">{g.title}
                                <input type="range" min="0" max="100" step="5" value={progress[g.id] ?? 0} onChange={(e) => setProgress({ ...progress, [g.id]: Number(e.target.value) })} className="w-full" />
                                <span className="text-primary">{progress[g.id] ?? 0}%</span>
                            </label>
                        ))}
                        <textarea required rows={4} placeholder="Achievements, challenges, what you need" value={selfText} onChange={(e) => setSelfText(e.target.value)} className={inputCls} />
                        <button disabled={act.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit to Manager</button>
                    </form>
                )}
            </ModalShell>

            <ManagerReviewModal review={managing} onClose={() => setManaging(null)} pending={act.isPending} onSubmit={(body) => act.mutate(body)} />
        </div>
    );
}
