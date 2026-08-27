"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Plane } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function PortalLeavePage() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ leaveType: "CASUAL", startDate: "", endDate: "", reason: "" });

    const { data: leaves, isLoading } = useQuery({
        queryKey: ["my-leaves"],
        queryFn: async () => (await fetch("/api/portal/leave")).json(),
        refetchInterval: 30000,
    });

    const applyMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/portal/leave", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? "Failed to apply");
            return body;
        },
        onSuccess: () => {
            toast.success("Leave request submitted for approval.");
            setOpen(false);
            setForm({ leaveType: "CASUAL", startDate: "", endDate: "", reason: "" });
            qc.invalidateQueries({ queryKey: ["my-leaves"] });
            qc.invalidateQueries({ queryKey: ["portal-dashboard"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const list = Array.isArray(leaves) ? leaves : [];
    const approved = list.filter((l: any) => l.status === "APPROVED");
    const pending = list.filter((l: any) => l.status === "PENDING");
    const daysUsed = approved.reduce((s: number, l: any) =>
        s + Math.ceil((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / 86400000) + 1, 0);

    const BALANCES = [
        { type: "Casual Leave", used: list.filter((l) => l.leaveType === "CASUAL" && l.status !== "REJECTED").length, total: 12 },
        { type: "Sick Leave", used: list.filter((l) => l.leaveType === "SICK" && l.status !== "REJECTED").length, total: 10 },
        { type: "Earned / Paid", used: list.filter((l) => ["EARNED", "PAID"].includes(l.leaveType) && l.status !== "REJECTED").length, total: 15 },
        { type: "Unpaid", used: list.filter((l) => l.leaveType === "UNPAID").length, total: null },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Leave & Time Off"
                subtitle="Apply for leave & track approvals"
                action={
                    <button onClick={() => setOpen(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2">
                        <Plane size={16} /> Apply Leave
                    </button>
                }
            />

            {/* Balances */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {BALANCES.map((b) => {
                    const pct = b.total ? Math.min(Math.round((b.used / b.total) * 100), 100) : 0;
                    return (
                        <div key={b.type} className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase">{b.type}</p>
                            <p className="text-xl font-extrabold text-neutral-900 mt-1">
                                {b.total != null ? <>{b.total - b.used}<span className="text-sm text-neutral-400 font-bold">/{b.total}</span></> : `${b.used}`}
                            </p>
                            {b.total != null && (
                                <>
                                    <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${pct > 75 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <p className="text-[9px] text-neutral-400 mt-1">{b.used} used</p>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-lg">
                <StatCard label="Approved" value={approved.length} icon={CalendarOff} tone="emerald" />
                <StatCard label="Pending" value={pending.length} icon={CalendarOff} tone={pending.length ? "amber" : "blue"} />
                <StatCard label="Days Used" value={daysUsed} icon={CalendarOff} tone="primary" />
            </div>

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : list.length === 0 ? (
                <SectionCard><EmptyState icon={Plane} message="No leave requests yet." /></SectionCard>
            ) : (
                <SectionCard title={`My Requests (${list.length})`}>
                    <div className="divide-y divide-neutral-50 -mx-5 px-5">
                        {list.map((l: any) => (
                            <div key={l.id} className="py-3.5 flex items-center justify-between gap-4 flex-wrap">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-neutral-900 capitalize">{l.leaveType.toLowerCase()} leave</p>
                                    <p className="text-[11px] text-neutral-400">
                                        {new Date(l.startDate).toLocaleDateString("en-IN")} → {new Date(l.endDate).toLocaleDateString("en-IN")}
                                        {l.reason ? ` · “${l.reason.slice(0, 60)}”` : ""}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {l.reviewedByName && l.status !== "PENDING" && (
                                        <span className="text-[10px] text-neutral-400 hidden sm:inline">by {l.reviewedByName}</span>
                                    )}
                                    <Badge value={l.status} />
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            <ModalShell open={open} onClose={() => setOpen(false)} title="Apply for Leave">
                <form onSubmit={(e) => { e.preventDefault(); applyMutation.mutate(); }} className="space-y-4">
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Leave Type *</span>
                        <select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white capitalize">
                            {["CASUAL", "SICK", "EARNED", "UNPAID"].map((t) => <option key={t} value={t}>{t[0]}{t.slice(1).toLowerCase()} Leave</option>)}
                        </select></label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">From *</span>
                            <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">To *</span>
                            <input required type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                    </div>
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Reason</span>
                        <textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Brief reason…" className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none resize-none" /></label>
                    <button disabled={applyMutation.isPending}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25">
                        {applyMutation.isPending ? "Submitting..." : "Submit Request"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
