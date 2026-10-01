"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Approval { id: string; type: string; title: string; requestedByName: string; requestedById: string; date: string; priority: string; relatedRecordType: string; relatedRecordId: string; description: string; status: string; reviewComment?: string | null; reviewedByName?: string | null }

// TA Manager's approval inbox (job requisitions and other recruitment approvals)
export default function TaApprovalsPage() {
    const qc = useQueryClient();
    const { user } = useAuth();
    const { data = [] } = useQuery<Approval[]>({ queryKey: ["ta-approvals"], queryFn: () => api<Approval[]>("/api/admin/approvals") });
    const recruitment = data.filter((a) => ["JOB_REQUISITION", "OFFER_APPROVAL", "CANDIDATE_EXCEPTION"].includes(a.type));
    const pending = recruitment.filter((a) => a.status === "PENDING" || a.status === "CHANGES_REQUESTED");
    const done = recruitment.filter((a) => !pending.includes(a)).slice(0, 15);

    const decide = useMutation({
        mutationFn: (body: { id: string; action: string; reviewComment?: string }) => api("/api/admin/approvals", "PATCH", body),
        onSuccess: () => {
            toast.success("Decision recorded — requester notified");
            qc.invalidateQueries({ queryKey: ["ta-approvals"] });
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const ask = (id: string, action: string) => {
        const reviewComment = window.prompt(action === "REJECT" ? "Reason for rejecting?" : "What should be changed?");
        if (reviewComment) decide.mutate({ id, action, reviewComment });
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Approvals" subtitle="Requisition requests from your recruiters" />
            <SectionCard title={`Waiting for decision (${pending.length})`}>
                {pending.length === 0 ? <EmptyState icon={ShieldCheck} message="No pending approvals." /> : (
                    <ul className="divide-y divide-neutral-100">
                        {pending.map((a) => (
                            <li key={a.id} className="py-3.5 flex items-start justify-between gap-4 text-sm">
                                <div>
                                    <p className="font-bold">{a.title}</p>
                                    <p className="text-xs text-neutral-600">{a.description}</p>
                                    <p className="text-[11px] text-neutral-400">by {a.requestedByName} · {new Date(a.date).toLocaleDateString("en-IN")} · {a.priority}</p>
                                    {a.relatedRecordType === "JOB" && <Link href={`/ta/requisitions/${a.relatedRecordId}`} className="text-[11px] font-bold text-primary">Open requisition →</Link>}
                                </div>
                                {a.requestedById !== user?.id ? (
                                    <div className="flex gap-1.5 shrink-0">
                                        <button disabled={decide.isPending} onClick={() => decide.mutate({ id: a.id, action: "APPROVE" })} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">Approve</button>
                                        <button disabled={decide.isPending} onClick={() => ask(a.id, "REQUEST_CHANGES")} className="px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 text-xs font-bold">Changes</button>
                                        <button disabled={decide.isPending} onClick={() => ask(a.id, "REJECT")} className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold">Reject</button>
                                    </div>
                                ) : <Badge value={a.status} />}
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
            {done.length > 0 && (
                <SectionCard title="Recently decided">
                    <ul className="divide-y divide-neutral-100">
                        {done.map((a) => (
                            <li key={a.id} className="py-2.5 flex items-center justify-between text-sm">
                                <span>{a.title} <span className="text-[11px] text-neutral-400">· {a.reviewedByName ?? "—"}{a.reviewComment ? ` — ${a.reviewComment}` : ""}</span></span>
                                <Badge value={a.status} />
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}
        </div>
    );
}
