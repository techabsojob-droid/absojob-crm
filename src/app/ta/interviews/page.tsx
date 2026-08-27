"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Video, Phone, MapPin, Plus, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function TaInterviewsPage() {
    const qc = useQueryClient();
    const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [form, setForm] = useState({ applicationId: "", round: "SCREENING_CALL", mode: "VIDEO", scheduledAt: "", durationMins: "45", interviewerName: "", meetingLink: "" });

    const { data: interviews, isLoading } = useQuery({
        queryKey: ["interviews", tab],
        queryFn: async () => (await fetch(`/api/ta/interviews?filter=${tab}`)).json(),
        refetchInterval: 25000,
    });

    const { data: pipelineApps } = useQuery({
        queryKey: ["pipeline-schedule"],
        queryFn: async () => (await fetch("/api/ta/applications")).json().catch(() => null),
    });

    const scheduleMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/ta/interviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, durationMins: Number(form.durationMins) }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Interview scheduled — candidate notified (simulated).");
            setScheduleOpen(false);
            qc.invalidateQueries({ queryKey: ["interviews"] });
            qc.invalidateQueries({ queryKey: ["pipeline"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const feedbackMutation = useMutation({
        mutationFn: async ({ id, status, outcome, score }: any) => {
            const res = await fetch("/api/ta/interviews", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: status ?? "COMPLETED", outcome, score }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.status === "NO_SHOW" ? "Marked as no-show." : `Feedback saved: ${vars.outcome.replaceAll("_", " ")}`);
            qc.invalidateQueries({ queryKey: ["interviews"] });
        },
        onError: () => toast.error("Failed to record feedback"),
    });

    const list = Array.isArray(interviews) ? interviews : [];
    const activeApps = Array.isArray(pipelineApps)
        ? pipelineApps.filter((a: any) => !["JOINED", "REJECTED", "BACKED_OUT"].includes(a.stage))
        : [];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Interview Management"
                subtitle="Schedule rounds & capture structured feedback"
                action={
                    <button onClick={() => setScheduleOpen(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2">
                        <Plus size={16} /> Schedule Interview
                    </button>
                }
            />

            <div className="grid grid-cols-2 gap-4">
                <StatCard label="Upcoming" value={list.length && tab === "upcoming" ? list.length : list.length} icon={CalendarClock} tone="blue" />
                <StatCard label="Completed / Closed" value={tab === "completed" ? list.length : "—"} icon={CheckCircle2} tone="emerald" />
            </div>

            <div className="flex gap-2">
                {(["upcoming", "completed"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${tab === t ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white border border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}>
                        {t}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-neutral-100" />)}</div>
            ) : list.length === 0 ? (
                <SectionCard><EmptyState icon={CalendarClock} message={`No ${tab} interviews.`} /></SectionCard>
            ) : (
                <div className="space-y-3">
                    {list.map((i: any) => {
                        const dt = new Date(i.scheduledAt);
                        return (
                            <div key={i.id} className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-neutral-900">{i.candidateName}</h3>
                                            <Badge value={i.round.replace("TECH_1", "TECH_1").replaceAll("_", " ")} label={i.round.replaceAll("_", " ")} />
                                            <Badge value={i.status} />
                                            {i.outcome !== "PENDING" && i.status === "COMPLETED" && <Badge value={i.outcome === "STRONG_HIRE" ? "HIRED" : i.outcome === "HIRE" ? "SHORTLISTED" : i.outcome === "MAYBE" ? "PENDING" : "REJECTED"} label={i.outcome.replaceAll("_", " ")} />}
                                        </div>
                                        <p className="text-xs text-neutral-500 mt-1 flex items-center gap-3 flex-wrap">
                                            <span>{dt.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                                            <span>· {i.durationMins} min</span>
                                            <span className="flex items-center gap-1">
                                                {i.mode === "VIDEO" ? <Video size={12} /> : i.mode === "PHONE" ? <Phone size={12} /> : <MapPin size={12} />} {i.mode}
                                            </span>
                                            <span>Interviewer: <strong className="text-neutral-700">{i.interviewerName}</strong></span>
                                        </p>
                                        {i.feedback && <p className="text-xs text-neutral-500 mt-2 bg-neutral-50 rounded-lg px-3 py-2 border border-neutral-100">“{i.feedback}”{i.score != null ? ` — Score: ${i.score}/10` : ""}</p>}
                                    </div>
                                    {tab === "upcoming" && i.meetingLink && (
                                        <a href={i.meetingLink} target="_blank" rel="noreferrer"
                                            className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors shrink-0">
                                            Join Meeting →
                                        </a>
                                    )}
                                </div>

                                {tab === "upcoming" && (
                                    <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-end gap-2 flex-wrap">
                                        <button onClick={() => feedbackMutation.mutate({ id: i.id, status: "NO_SHOW" })} disabled={feedbackMutation.isPending}
                                            className="text-xs font-bold text-red-500 hover:text-red-600 px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">No-show</button>
                                        <button onClick={() => feedbackMutation.mutate({ id: i.id, outcome: "NO_HIRE" })} disabled={feedbackMutation.isPending}
                                            className="px-3.5 py-1.5 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5 disabled:opacity-40">
                                            <XCircle size={13} /> Reject
                                        </button>
                                        {[7, 9].map((score) => (
                                            <button key={score} onClick={() => feedbackMutation.mutate({ id: i.id, outcome: score >= 9 ? "STRONG_HIRE" : "HIRE", score })} disabled={feedbackMutation.isPending}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border disabled:opacity-40 ${score >= 9 ? "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-primary/5 border-primary/20 text-primary hover:bg-primary hover:text-white"}`}>
                                                <CheckCircle2 size={13} /> {score}/10
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Schedule modal */}
            <ModalShell open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule Interview" wide>
                <form onSubmit={(e) => { e.preventDefault(); scheduleMutation.mutate(); }} className="space-y-4">
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Candidate (application) *</span>
                        <select required value={form.applicationId} onChange={(e) => setForm({ ...form, applicationId: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white">
                            <option value="">Select pipeline candidate…</option>
                            {activeApps.map((a: any) => (
                                <option key={a.id} value={a.id}>{a.candidateName} — {a.jobTitle}</option>
                            ))}
                        </select></label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Round *</span>
                            <select value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white">
                                {["SCREENING_CALL", "TECH_1", "TECH_2", "CLIENT_ROUND", "HR_ROUND", "FINAL"].map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
                            </select></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Mode</span>
                            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white">
                                {["VIDEO", "PHONE", "ONSITE"].map((m) => <option key={m} value={m}>{m}</option>)}
                            </select></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Date & Time *</span>
                            <input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: new Date(e.target.value).toISOString() })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Duration (mins)</span>
                            <input type="number" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                    </div>
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Interviewer</span>
                        <input value={form.interviewerName} onChange={(e) => setForm({ ...form, interviewerName: e.target.value })} placeholder="e.g. Deepak Rao (TechNova)" className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                    <button disabled={scheduleMutation.isPending || activeApps.length === 0}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25">
                        {scheduleMutation.isPending ? "Scheduling..." : "Confirm Schedule"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
