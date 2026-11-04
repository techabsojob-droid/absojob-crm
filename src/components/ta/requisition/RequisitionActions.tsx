"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";
import { ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { requisitionStatusLabel } from "@/lib/requisition-options";

export type ActionKind = "assign" | "hold" | "resume" | "close" | "cancel" | "status";
export interface ActionJob { id: string; title: string; status: string; requisitionCode?: string; primaryRecruiterId?: string | null; assignedTas?: string[] }

const STATUS_TONE: Record<string, string> = {
    Open: "bg-emerald-50 text-emerald-700 border-emerald-200", Draft: "bg-neutral-100 text-neutral-600 border-neutral-200", "Pending Approval": "bg-amber-50 text-amber-700 border-amber-200",
    "On Hold": "bg-orange-50 text-orange-700 border-orange-200", Closed: "bg-sky-50 text-sky-700 border-sky-200", Cancelled: "bg-red-50 text-red-600 border-red-200",
};
export function StatusPill({ status }: { status: string }) {
    const l = requisitionStatusLabel(status);
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${STATUS_TONE[l] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{l}</span>;
}

/** Status / assignment actions with a required reason where the workflow needs one. */
export function ActionDialog({ kind, job, onClose, onDone }: { kind: ActionKind; job: ActionJob; onClose: () => void; onDone: () => void }) {
    const [reason, setReason] = useState("");
    const [resumeDate, setResumeDate] = useState("");
    const [target, setTarget] = useState<ActionKind>(job.status === "ON_HOLD" ? "resume" : "hold");
    const [recruiter, setRecruiter] = useState(job.primaryRecruiterId ?? "");
    const [busy, setBusy] = useState(false);
    const team = useQuery<{ recruiters: { id: string; name: string; role: string; department: string | null }[] }>({ queryKey: ["requisition-options"], queryFn: () => api("/api/ta/requisition-options"), enabled: kind === "assign" });
    const k = kind === "status" ? target : kind;
    const needsReason = k === "hold" || k === "close" || k === "cancel";
    const title = { assign: "Assign recruiter", hold: "Put requisition on hold", resume: "Resume sourcing", close: "Close requisition", cancel: "Cancel requisition", status: "Change status" }[kind];

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (needsReason && !reason.trim()) return toast.error("Please give a reason");
        setBusy(true);
        try {
            const body = k === "assign" ? { primaryRecruiterId: recruiter, assignedTas: [...new Set([recruiter, ...(job.assignedTas ?? []).filter((x: string) => x !== job.primaryRecruiterId)])] }
                : k === "hold" ? { action: "hold", reason, resumeDate: resumeDate || null }
                    : k === "resume" ? { action: "resume", reason }
                        : k === "close" ? { action: "close", closureReason: reason } : { action: "cancel", cancelReason: reason };
            if (k === "assign" && !recruiter) throw new Error("Choose a recruiter");
            await api(`/api/admin/jobs/${job.id}`, "PATCH", body);
            toast.success({ assign: "Recruiter assigned", hold: "Requisition put on hold", resume: "Sourcing resumed", close: "Requisition closed", cancel: "Requisition cancelled", status: "Status updated" }[k]);
            onDone();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalShell title={`${title} · ${job.requisitionCode ?? job.title}`} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4 text-sm">
                <p className="text-neutral-600">{job.title} — currently <StatusPill status={job.status} /></p>
                {kind === "status" && (
                    <div className="grid grid-cols-1 gap-2">
                        {(job.status === "ON_HOLD" ? (["resume", "close", "cancel"] as const) : (["hold", "close", "cancel"] as const)).map((x) => (
                            <label key={x} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${target === x ? "border-primary bg-primary/5" : "border-neutral-200"}`}>
                                <input type="radio" name="target" checked={target === x} onChange={() => setTarget(x)} />
                                <span className="font-semibold text-neutral-800">{{ resume: "Open (resume sourcing)", hold: "On Hold", close: "Closed", cancel: "Cancelled" }[x]}</span>
                            </label>
                        ))}
                    </div>
                )}
                {k === "assign" && (
                    <label className="block space-y-1.5">
                        <span className="text-[13px] font-semibold text-neutral-800">Primary recruiter</span>
                        <select value={recruiter} onChange={(e) => setRecruiter(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white outline-none focus:border-primary">
                            <option value="">Select recruiter</option>
                            {(team.data?.recruiters ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}{r.department ? ` · ${r.department}` : ""}</option>)}
                        </select>
                        <span className="block text-xs text-neutral-500">The change is kept in the requisition&apos;s assignment history and the recruiter is notified.</span>
                    </label>
                )}
                {needsReason && (
                    <label className="block space-y-1.5">
                        <span className="text-[13px] font-semibold text-neutral-800">Reason <span className="text-red-500">*</span></span>
                        <textarea required rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 outline-none focus:border-primary"
                            placeholder={k === "hold" ? "e.g. Client paused hiring until budget approval" : k === "close" ? "e.g. Mandate completed" : "e.g. Client withdrew the requirement"} />
                    </label>
                )}
                {k === "hold" && (
                    <label className="block space-y-1.5">
                        <span className="text-[13px] font-semibold text-neutral-800">Expected resume date</span>
                        <input type="date" min={new Date().toISOString().slice(0, 10)} value={resumeDate} onChange={(e) => setResumeDate(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-neutral-200 outline-none focus:border-primary" />
                    </label>
                )}
                {k === "cancel" && <p className="text-xs text-red-600 flex items-center gap-1"><X size={12} /> Cancelling takes the requisition off the job listing. Candidates and history are kept.</p>}
                {k === "close" && <p className="text-xs text-neutral-500 flex items-center gap-1"><CheckCircle2 size={12} /> Candidate and application records are preserved.</p>}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-neutral-200 font-semibold text-neutral-700">Back</button>
                    <button disabled={busy} className={`h-10 px-4 rounded-xl text-white font-semibold disabled:opacity-50 ${k === "cancel" ? "bg-red-600" : "bg-primary"}`}>{busy ? "Saving…" : "Confirm"}</button>
                </div>
            </form>
        </ModalShell>
    );
}
