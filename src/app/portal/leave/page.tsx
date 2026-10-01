"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarOff, Plane, Check, X, Paperclip, Users, PartyPopper } from "lucide-react";
import { PageHeader, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, inputCls, uploadFile, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Leave { id: string; userId: string; userName: string; leaveType: string; fromDate: string; toDate: string; halfDay?: string | null; days: number; reason: string; status: string; approverName?: string | null; decisionNote?: string | null; attachmentUrl?: string | null; cancelReason?: string | null }
interface Bal { type: string; label: string; allowance: number | null; used: number; pending: number; available: number | null; minNoticeDays: number; maxConsecutiveDays: number | null; eligible: boolean; note?: string }
interface Data { requests: Leave[]; balanceList: Bal[]; approvals: Leave[] | null; teamCalendar: Leave[] | null; upcomingHolidays: { id: string; date: string; name: string }[] }

const EMPTY = { leaveType: "CASUAL", fromDate: "", toDate: "", halfDay: "", reason: "", attachmentFileId: "" };
const today = () => new Date().toISOString().slice(0, 10);
const span = (l: Leave) => (l.halfDay ? `${l.fromDate} (${l.halfDay.toLowerCase()} half)` : l.fromDate === l.toDate ? l.fromDate : `${l.fromDate} → ${l.toDate}`);

export default function PortalLeavePage() {
    const { data, isLoading } = useQuery<Data>({ queryKey: ["my-leaves"], queryFn: () => api("/api/portal/leave"), refetchInterval: 30000 });
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const keys = ["my-leaves", "portal-dashboard", "my-attendance"];
    const apply = useAct("/api/portal/leave", "POST", keys, "Leave request sent to your manager and HR");
    const act = useAct<{ status: string }>("/api/portal/leave", "PATCH", keys, (r) => `Leave ${r.status.toLowerCase()}`);

    const bal = data?.balanceList ?? [];
    const sel = bal.find((b) => b.type === form.leaveType);
    // Calendar-day preview; the server charges working days only (week-offs & holidays excluded)
    const preview = useMemo(() => {
        if (!form.fromDate || !(form.toDate || form.halfDay)) return null;
        if (form.halfDay) return 0.5;
        let n = 0;
        for (let d = new Date(`${form.fromDate}T00:00:00Z`); d <= new Date(`${form.toDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
            const iso = d.toISOString().slice(0, 10);
            if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !data?.upcomingHolidays.some((h) => h.date === iso)) n++;
        }
        return n;
    }, [form, data]);

    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const pendingApprovals = data.approvals ?? [];

    return (
        <div className="space-y-6">
            <PageHeader title="My Leave" subtitle="Balances follow the company leave policy — week-offs and holidays are never counted"
                action={<button onClick={() => { setForm(EMPTY); setOpen(true); }} className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold flex items-center gap-2"><Plane size={15} /> Apply leave</button>} />

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {bal.filter((b) => b.type !== "UNPAID").map((b) => (
                    <div key={b.type} className={`bg-white rounded-2xl border p-4 ${b.eligible ? "border-neutral-200/80" : "border-dashed border-neutral-300 opacity-70"}`}>
                        <p className="text-[11px] font-bold text-neutral-500">{b.label}</p>
                        <p className="text-2xl font-extrabold mt-0.5">{b.available ?? "∞"}<span className="text-xs text-neutral-400 font-bold"> / {b.allowance ?? "∞"}</span></p>
                        <p className="text-[10px] text-neutral-400">{b.used} used{b.pending ? ` · ${b.pending} pending` : ""}</p>
                        {b.note && <p className="text-[10px] text-neutral-500 mt-1 leading-tight">{b.note}</p>}
                    </div>
                ))}
            </div>

            {data.approvals && (
                <SectionCard title={`Leave awaiting my approval (${pendingApprovals.length})`}>
                    {pendingApprovals.length === 0 ? <EmptyState icon={Check} message="Nothing waiting for you." /> : (
                        <ul className="divide-y divide-neutral-100">
                            {pendingApprovals.map((l) => (
                                <li key={l.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                                    <div>
                                        <p className="font-semibold">{l.userName} · {l.leaveType.toLowerCase()} · {l.days} day(s)</p>
                                        <p className="text-[11px] text-neutral-500">{span(l)} · {l.reason}{l.attachmentUrl && <> · <a href={l.attachmentUrl} target="_blank" rel="noopener" className="text-primary font-bold">certificate</a></>}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button disabled={act.isPending} onClick={() => act.mutate({ id: l.id, decision: "approve" })} className={btn.good}><Check size={12} className="inline" /> Approve</button>
                                        <button disabled={act.isPending} onClick={() => { const note = window.prompt("Reason for rejecting?"); if (note) act.mutate({ id: l.id, decision: "reject", decisionNote: note }); }} className={btn.danger}><X size={12} className="inline" /> Reject</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard title={`My requests (${data.requests.length})`} className="lg:col-span-2">
                    {data.requests.length === 0 ? <EmptyState icon={CalendarOff} message="No leave requests yet." /> : (
                        <ul className="divide-y divide-neutral-100">
                            {data.requests.map((l) => {
                                const cancellable = l.status === "PENDING" || (l.status === "APPROVED" && l.fromDate > today());
                                return (
                                    <li key={l.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                                        <div>
                                            <p className="font-semibold capitalize">{l.leaveType.toLowerCase().replace("_", "-")} leave · {l.days} day(s)</p>
                                            <p className="text-[11px] text-neutral-500">{span(l)} · {l.reason}{l.attachmentUrl && <> · <a href={l.attachmentUrl} target="_blank" rel="noopener" className="text-primary font-bold">attachment</a></>}</p>
                                            {(l.approverName || l.cancelReason) && <p className="text-[11px] text-neutral-400">{l.status === "CANCELLED" ? `cancelled${l.cancelReason ? ` — ${l.cancelReason}` : ""}` : `${l.status.toLowerCase()} by ${l.approverName}${l.decisionNote ? ` — ${l.decisionNote}` : ""}`}</p>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge value={l.status} />
                                            {cancellable && <button disabled={act.isPending} onClick={() => { const reason = window.prompt("Cancel this leave? Reason (optional)"); if (reason !== null) act.mutate({ id: l.id, action: "cancel", reason }); }} className={btn.ghost}>Cancel</button>}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </SectionCard>
                <div className="space-y-6">
                    <SectionCard title="Upcoming holidays" action={<Link href="/portal/holidays" className="text-xs font-bold text-primary">All</Link>}>
                        {data.upcomingHolidays.length === 0 ? <p className="text-xs text-neutral-400">None scheduled.</p> : (
                            <ul className="space-y-2 text-sm">{data.upcomingHolidays.map((h) => <li key={h.id} className="flex justify-between"><span className="flex items-center gap-1.5"><PartyPopper size={12} className="text-fuchsia-500" />{h.name}</span><span className="text-xs text-neutral-500">{new Date(`${h.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" })}</span></li>)}</ul>
                        )}
                    </SectionCard>
                    {data.teamCalendar && (
                        <SectionCard title="Team leave (next 60 days)">
                            {data.teamCalendar.length === 0 ? <p className="text-xs text-neutral-400">Nobody in your team is off.</p> : (
                                <ul className="space-y-2 text-xs">{data.teamCalendar.map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="flex items-center gap-1.5"><Users size={11} />{l.userName}</span><span className="text-neutral-500">{span(l)} {l.status === "PENDING" && <Badge value="PENDING" />}</span></li>)}</ul>
                            )}
                        </SectionCard>
                    )}
                </div>
            </div>

            <ModalShell open={open} onClose={() => setOpen(false)} title="Apply for leave">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); apply.mutate({ ...form, toDate: form.halfDay ? form.fromDate : form.toDate, halfDay: form.halfDay || null, attachmentFileId: form.attachmentFileId || null }, { onSuccess: () => setOpen(false) }); }}>
                    <select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} className={inputCls} aria-label="Leave type">
                        {bal.map((b) => <option key={b.type} value={b.type} disabled={!b.eligible}>{b.label}{b.available !== null ? ` — ${b.available} available` : ""}{!b.eligible ? " (after probation)" : ""}</option>)}
                    </select>
                    {sel && (sel.minNoticeDays > 0 || sel.maxConsecutiveDays) && <p className="text-[11px] text-neutral-500">{sel.minNoticeDays ? `Apply ${sel.minNoticeDays} day(s) in advance. ` : ""}{sel.maxConsecutiveDays ? `Max ${sel.maxConsecutiveDays} working days at a time.` : ""}</p>}
                    <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={!!form.halfDay} onChange={(e) => setForm({ ...form, halfDay: e.target.checked ? "FIRST" : "" })} /> Half day</label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-bold text-neutral-600">{form.halfDay ? "Date" : "From"}<input required type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value, toDate: form.toDate && form.toDate < e.target.value ? e.target.value : form.toDate })} className={inputCls} /></label>
                        {form.halfDay ? (
                            <label className="text-xs font-bold text-neutral-600">Half<select value={form.halfDay} onChange={(e) => setForm({ ...form, halfDay: e.target.value })} className={inputCls}><option value="FIRST">First half</option><option value="SECOND">Second half</option></select></label>
                        ) : <label className="text-xs font-bold text-neutral-600">To<input required type="date" min={form.fromDate} value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} className={inputCls} /></label>}
                    </div>
                    {preview !== null && <p className="text-xs font-bold text-primary">≈ {preview} working day(s) will be deducted</p>}
                    <textarea required rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason" className={inputCls} />
                    <label className="text-xs font-bold text-neutral-600 flex items-center gap-2"><Paperclip size={13} /> {form.leaveType === "SICK" ? "Medical certificate (required over 2 days)" : "Attachment (optional)"}
                        <input type="file" accept="application/pdf,image/*" disabled={uploading} className="text-xs font-normal" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { const up = await uploadFile(f, "leave"); setForm((x) => ({ ...x, attachmentFileId: up.id })); } catch (err) { toast.error((err as Error).message); } finally { setUploading(false); } }} />
                        {form.attachmentFileId && <span className="text-emerald-700">✓</span>}
                    </label>
                    <button disabled={apply.isPending || uploading} className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50">Submit request</button>
                </form>
            </ModalShell>
        </div>
    );
}
