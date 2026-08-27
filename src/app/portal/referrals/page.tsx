"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState, inr } from "@/components/shared/ui";

export default function PortalReferralsPage() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ candidateName: "", email: "", phone: "", jobId: "", notes: "" });

    const { data: referrals, isLoading } = useQuery({
        queryKey: ["my-referrals"],
        queryFn: async () => (await fetch("/api/portal/referrals")).json(),
        refetchInterval: 30000,
    });

    const { data: jobs } = useQuery({
        queryKey: ["referral-jobs"],
        queryFn: async () => (await fetch("/api/admin/jobs?status=SOURCING")).json().catch(() => null),
    });

    const submitMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/portal/referrals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: form.candidateName, email: form.email, phone: form.phone, jobId: form.jobId, notes: form.notes }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? "Submission failed");
            return body;
        },
        onSuccess: (d) => {
            toast.success(d.message ?? "Referral submitted!");
            setOpen(false);
            setForm({ candidateName: "", email: "", phone: "", jobId: "", notes: "" });
            qc.invalidateQueries({ queryKey: ["my-referrals"] });
            qc.invalidateQueries({ queryKey: ["portal-dashboard"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const list: any[] = Array.isArray(referrals) ? referrals : (referrals?.referrals ?? []);
    const placed = list.filter((r: any) => r.status === "HIRED");

    return (
        <div className="space-y-6">
            <PageHeader
                title="My Referrals"
                subtitle="Know someone perfect for a role? Refer & earn when they join"
                action={
                    <button onClick={() => setOpen(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2">
                        <Plus size={16} /> Submit Referral
                    </button>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total" value={list.length} icon={Gift} tone="primary" />
                <StatCard label="In Pipeline" value={list.filter((r: any) => !["HIRED", "REJECTED"].includes(r.status)).length} icon={Gift} tone="blue" />
                <StatCard label="Placed 🎉" value={placed.length} icon={Gift} tone="emerald" />
                <StatCard label="Earned" value={inr(placed.reduce((s: number, r: any) => s + (r.payoutAmount ?? 0), 0))} icon={Gift} tone="purple" />
            </div>

            {/* Active jobs to refer against */}
            <SectionCard title="Open Positions — refer for these roles" subtitle={`${Array.isArray(jobs) ? jobs.length : 0} active requisitions`}>
                <div className="flex gap-2 flex-wrap">
                    {(Array.isArray(jobs) ? jobs : []).slice(0, 8).map((j: any) => (
                        <button key={j.id}
                            onClick={() => { setForm({ ...form, jobId: j.id }); setOpen(true); }}
                            className="px-3 py-2 bg-white border border-neutral-200 hover:border-primary hover:bg-primary/[0.03] rounded-xl text-xs font-bold text-neutral-700 transition-colors text-left"
                            title={`Refer for ${j.title}`}>
                            <span className="block truncate max-w-[200px]">{j.title}</span>
                            <span className="text-[9px] font-bold text-neutral-400 uppercase">{j.clientName}</span>
                        </button>
                    ))}
                    {Array.isArray(jobs) && jobs.length === 0 && <EmptyState icon={Gift} message="No open positions right now." />}
                </div>
            </SectionCard>

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : list.length === 0 ? (
                <SectionCard><EmptyState icon={Gift} message="No referrals yet. Your first referral could earn you ₹15,000+!" /></SectionCard>
            ) : (
                <SectionCard title={`Referral History (${list.length})`}>
                    <div className="divide-y divide-neutral-50 -mx-5 px-5">
                        {list.map((r: any) => (
                            <div key={r.id} className="py-3.5 flex items-center justify-between gap-4 flex-wrap">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-neutral-900">{r.candidateName}</p>
                                    <p className="text-[11px] text-neutral-400 truncate">{r.jobTitle ?? "—"} · referred {new Date(r.referredAt ?? r.createdAt).toLocaleDateString("en-IN")}{r.reviewNotes ? ` · “${r.reviewNotes.slice(0, 60)}”` : ""}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {r.incentivePaid && r.status === "HIRED" && (
                                        <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">+₹{r.incentiveAmount.toLocaleString("en-IN")}</span>
                                    )}
                                    <Badge value={r.status} />
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            <ModalShell open={open} onClose={() => setOpen(false)} title="Submit a Referral" wide>
                <form onSubmit={(e) => { e.preventDefault(); submitMutation.mutate(); }} className="space-y-4">
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Requisition *</span>
                        <select required value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white">
                            <option value="">Select position…</option>
                            {(Array.isArray(jobs) ? jobs : []).map((j: any) => (
                                <option key={j.id} value={j.id}>{j.title} — {j.clientName}</option>
                            ))}
                        </select></label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Candidate Name *</span>
                            <input required value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email *</span>
                            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Phone *</span>
                            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                    </div>
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Why are they a good fit?</span>
                        <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none resize-none" placeholder="Skills, experience, relationship…" /></label>
                    <button disabled={submitMutation.isPending}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25">
                        {submitMutation.isPending ? "Submitting..." : "Submit Referral"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
