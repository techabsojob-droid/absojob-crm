"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, Upload, Rocket } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, uploadFile, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Item { id: string; title: string; completed: boolean; requiredDoc?: string; completedAt?: string | null; submittedAt?: string | null; submittedUrl: string | null }
interface Onb { id: string; position: string; department: string; status: string; progressPercent: number; expectedJoiningDate: string; hrName: string | null; checklist: Item[] }

export default function OnboardingPage() {
    const { data, isLoading } = useQuery<{ onboarding: Onb | null }>({ queryKey: ["my-onboarding"], queryFn: () => api("/api/portal/onboarding") });
    const submit = useAct("/api/portal/onboarding", "POST", ["my-onboarding", "portal-dashboard"], "Submitted — HR will verify");
    const [busy, setBusy] = useState<string | null>(null);
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const o = data.onboarding;
    if (!o) return <SectionCard><EmptyState icon={Rocket} message="You have no pending joining formalities." /></SectionCard>;
    return (
        <div className="space-y-6 max-w-3xl">
            <PageHeader title="Joining Checklist" subtitle={`${o.position} · ${o.department}${o.hrName ? ` · HR contact ${o.hrName}` : ""}`} />
            <SectionCard>
                <div className="flex justify-between text-xs mb-1"><span className="font-bold">Progress</span><span>{o.progressPercent}%</span></div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-[#2a78d6]" style={{ width: `${o.progressPercent}%` }} /></div>
                <ul className="divide-y divide-neutral-100 mt-4">
                    {o.checklist.map((c) => (
                        <li key={c.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-start gap-2.5">
                                {c.completed ? <CheckCircle2 size={18} className="text-emerald-600 mt-0.5" /> : c.submittedAt ? <Clock size={18} className="text-amber-500 mt-0.5" /> : <Circle size={18} className="text-neutral-300 mt-0.5" />}
                                <div><p className="font-semibold">{c.title}</p>{c.requiredDoc && <p className="text-[11px] text-neutral-500">Needs: {c.requiredDoc}</p>}{c.submittedAt && !c.completed && <p className="text-[11px] text-amber-700">Submitted {c.submittedAt.slice(0, 10)} — awaiting HR verification</p>}</div>
                            </div>
                            {!c.completed && c.requiredDoc && (
                                <label className={`${btn.soft} cursor-pointer flex items-center gap-1`}><Upload size={12} /> {busy === c.id ? "Uploading…" : c.submittedAt ? "Replace" : "Upload"}
                                    <input type="file" hidden accept="application/pdf,image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(c.id); try { const up = await uploadFile(f, "employee-doc"); submit.mutate({ itemId: c.id, fileId: up.id }); } catch (err) { toast.error((err as Error).message); } finally { setBusy(null); } }} />
                                </label>
                            )}
                        </li>
                    ))}
                </ul>
            </SectionCard>
        </div>
    );
}
