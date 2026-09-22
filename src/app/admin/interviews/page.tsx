"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Video, Phone, MapPin, Plus, CheckCircle2, XCircle, AlertCircle, Building2, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function AdminInterviewsMonitorPage() {
    const qc = useQueryClient();
    const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [form, setForm] = useState({ applicationId: "", round: "SCREENING_CALL", mode: "VIDEO", scheduledAt: "", durationMins: "45", interviewerName: "", meetingLink: "" });

    const { data: interviews, isLoading } = useQuery({
        queryKey: ["admin-interviews", tab],
        queryFn: async () => (await fetch(`/api/ta/interviews?filter=${tab}`)).json(),
        refetchInterval: 20000,
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
            toast.success("Interview scheduled across organization.");
            setScheduleOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-interviews"] });
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
            toast.success(vars.status === "NO_SHOW" ? "Marked as no-show." : `Outcome logged: ${vars.outcome.replaceAll("_", " ")}`);
            qc.invalidateQueries({ queryKey: ["admin-interviews"] });
        },
        onError: () => toast.error("Failed to update status"),
    });

    const list = Array.isArray(interviews) ? interviews : [];
    const activeApps = Array.isArray(pipelineApps)
        ? pipelineApps.filter((a: any) => !["JOINED", "REJECTED", "BACKED_OUT"].includes(a.stage))
        : [];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Interview Monitor"
                subtitle="Organization-wide live tracking of all candidate rounds, interviewer schedules & outcomes"
                action={
                    <button onClick={() => setScheduleOpen(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2">
                        <Plus size={16} /> Schedule Interview
                    </button>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Rounds" value={list.length} icon={CalendarClock} tone="primary" />
                <StatCard label="Scheduled / Confirmed" value={list.filter((i: any) => i.status === "SCHEDULED").length} icon={Clock} tone="blue" />
                <StatCard label="Completed / Hired" value={list.filter((i: any) => i.status === "COMPLETED").length} icon={CheckCircle2} tone="emerald" />
                <StatCard label="No-Shows / Cancelled" value={list.filter((i: any) => ["NO_SHOW", "CANCELLED"].includes(i.status)).length} icon={XCircle} tone="red" />
            </div>

            <div className="flex gap-2">
                {(["upcoming", "completed"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${tab === t ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white border border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}>
                        {t} Interviews
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-neutral-100" />)}</div>
            ) : list.length === 0 ? (
                <SectionCard><EmptyState icon={CalendarClock} message={`No ${tab} interviews scheduled.`} /></SectionCard>
            ) : (
                <div className="space-y-3">
                    {list.map((i: any) => {
                        const dt = new Date(i.scheduledAt);
                        return (
                            <div key={i.id} className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center justify-between gap-4 flex-wrap hover:border-neutral-300 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                        {i.mode === "VIDEO" ? <Video size={22} /> : i.mode === "PHONE" ? <Phone size={22} /> : <MapPin size={22} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-neutral-900">{i.candidateName}</h3>
                                            <Badge value={i.round} />
                                            <Badge value={i.status} />
                                            {i.outcome && i.outcome !== "PENDING" && <Badge value={i.outcome} />}
                                        </div>
                                        <p className="text-xs text-neutral-400 mt-0.5">
                                            {i.jobTitle} · <span className="text-neutral-600 font-semibold">{i.clientName}</span>
                                        </p>
                                        <p className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
                                            <span>Interviewer: <strong>{i.interviewerName}</strong></span>
                                            <span>· Recruiter: <strong>{i.recruiterName ?? "—"}</strong></span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-neutral-800">
                                            {dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                                        </p>
                                        <p className="text-xs text-neutral-400">
                                            {dt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} ({i.durationMins}m)
                                        </p>
                                        {i.meetingLink && (
                                            <a href={i.meetingLink} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-primary hover:underline block mt-0.5">
                                                Join Link ↗
                                            </a>
                                        )}
                                    </div>

                                    {tab === "upcoming" && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => feedbackMutation.mutate({ id: i.id, outcome: "STRONG_HIRE", score: 9 })}
                                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                            >
                                                Pass
                                            </button>
                                            <button
                                                onClick={() => feedbackMutation.mutate({ id: i.id, outcome: "NO_HIRE", score: 3 })}
                                                className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => feedbackMutation.mutate({ id: i.id, status: "NO_SHOW", outcome: "NO_HIRE" })}
                                                className="px-2.5 py-1.5 text-neutral-400 hover:text-neutral-700 text-xs font-bold transition-colors"
                                            >
                                                No-Show
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Schedule Interview Modal */}
            <ModalShell open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule Candidate Interview" wide>
                <form onSubmit={(e) => { e.preventDefault(); scheduleMutation.mutate(); }} className="space-y-4">
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Candidate Application *</span>
                        <select
                            required
                            value={form.applicationId}
                            onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white"
                        >
                            <option value="">Select active candidate application…</option>
                            {activeApps.map((a: any) => (
                                <option key={a.id} value={a.id}>
                                    {a.candidateName} — {a.jobTitle} ({a.clientName})
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Interview Round</span>
                            <select
                                value={form.round}
                                onChange={(e) => setForm({ ...form, round: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white"
                            >
                                {["SCREENING_CALL", "TECH_1", "TECH_2", "CLIENT_ROUND", "HR_ROUND", "FINAL"].map((r) => (
                                    <option key={r} value={r}>{r.replaceAll("_", " ")}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Mode</span>
                            <select
                                value={form.mode}
                                onChange={(e) => setForm({ ...form, mode: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white"
                            >
                                <option value="VIDEO">Video Call (Google Meet / Zoom)</option>
                                <option value="PHONE">Telephonic</option>
                                <option value="ONSITE">In-Person / Onsite</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Date & Time *</span>
                            <input
                                required
                                type="datetime-local"
                                value={form.scheduledAt}
                                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Interviewer Name *</span>
                            <input
                                required
                                value={form.interviewerName}
                                onChange={(e) => setForm({ ...form, interviewerName: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                                placeholder="e.g. Priya Sharma (Tech Lead)"
                            />
                        </label>
                    </div>
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Meeting Link / Room details</span>
                        <input
                            value={form.meetingLink}
                            onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            placeholder="https://meet.google.com/xyz-abcd-efg"
                        />
                    </label>
                    <button
                        disabled={scheduleMutation.isPending}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
                    >
                        {scheduleMutation.isPending ? "Scheduling..." : "Schedule Interview"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
