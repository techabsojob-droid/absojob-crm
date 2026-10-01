"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, LogOut, Plus, Paperclip, FileText, CheckCircle2, Circle } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, inputCls, money, uploadFile, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

const TYPES = [
    { id: "WFH", label: "Work from home", group: "Attendance" },
    { id: "ATTENDANCE_CORRECTION", label: "Attendance correction", group: "Attendance" },
    { id: "SALARY_CERTIFICATE", label: "Salary certificate", group: "Letters" },
    { id: "EXPERIENCE_LETTER", label: "Employment / experience letter", group: "Letters" },
    { id: "BANK_CHANGE", label: "Change salary bank account", group: "Profile" },
    { id: "NAME_CHANGE", label: "Change legal name", group: "Profile" },
    { id: "ADDRESS_CHANGE", label: "Address change (with proof)", group: "Profile" },
    { id: "ID_CARD", label: "ID card / access card", group: "Services" },
    { id: "IT_SUPPORT", label: "IT support", group: "Services" },
    { id: "GRIEVANCE", label: "Grievance (confidential to HR)", group: "Services" },
    { id: "OTHER", label: "Other", group: "Services" },
];
const NEEDS_PROOF = ["BANK_CHANGE", "NAME_CHANGE"];

interface Req { id: string; kind: "REQUEST" | "WFH" | "CORRECTION"; type: string; title: string; description: string; status: string; requestedAt: string; reviewedByName: string | null; comments: string | null; attachmentUrl: string | null; letterUrl: string | null }
interface Exit { id: string; status: string; resignationDate: string; lastWorkingDay: string; noticePeriodDays: number; reason: string; clearanceChecklist: { department: string; cleared: boolean; clearedBy?: string | null; clearedAt?: string | null }[]; clearanceProgress: number; assetsToReturn: { tag: string; name: string }[]; canWithdraw: boolean; letterUrl: string | null; fnfSettled: boolean; fnfAmountInr?: number | null; fnfPaid?: boolean; employeeFeedback?: { rating: number } | null; open: boolean }

const EMPTY = { type: "WFH", description: "", startDate: "", endDate: "", date: "", requestedCheckIn: "09:30", requestedCheckOut: "18:30", bankName: "", accountNumber: "", ifscCode: "", accountName: "", newName: "", currentAddress: "", permanentAddress: "", priority: "MEDIUM", attachmentFileId: "" };

function RequestsContent() {
    const params = useSearchParams();
    const [open, setOpen] = useState(false);
    const [resignOpen, setResignOpen] = useState(false);
    const [fbOpen, setFbOpen] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [resign, setResign] = useState({ reason: "", noticePeriodDays: "30" });
    const [fb, setFb] = useState({ rating: "4", wouldRecommend: true, reasonCategory: "Career growth", comments: "" });

    const { data: requests = [], isLoading } = useQuery<Req[]>({ queryKey: ["my-requests"], queryFn: () => api("/api/portal/requests") });
    const { data: exitData } = useQuery<{ exit: Exit | null }>({ queryKey: ["my-exit"], queryFn: () => api("/api/portal/exit") });
    const keys = ["my-requests", "my-attendance", "portal-dashboard"];
    const submit = useAct("/api/hr/employee-requests", "POST", keys, "Request submitted");
    const withdraw = useAct("/api/portal/requests", "PATCH", keys, "Request withdrawn");
    const resignAct = useAct("/api/hr/exit", "POST", ["my-exit", "portal-dashboard"], "Resignation submitted to HR and your manager");
    const exitAct = useAct("/api/portal/exit", "PATCH", ["my-exit", "portal-dashboard"], "Saved");

    useEffect(() => { const t = params.get("new"); if (t && TYPES.some((x) => x.id === t)) { setForm({ ...EMPTY, type: t }); setOpen(true); } }, [params]);

    const exit = exitData?.exit;
    const activeExit = exit?.open ? exit : null;

    return (
        <div className="space-y-6 max-w-4xl">
            <PageHeader title="Requests & Letters" subtitle="WFH, corrections, letters, profile changes and IT / HR help — track everything here"
                action={<button onClick={() => { setForm(EMPTY); setOpen(true); }} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"><Plus size={15} /> New request</button>} />

            <SectionCard title={`My requests (${requests.length})`}>
                {isLoading ? <SkeletonPulse className="h-24 w-full" /> : requests.length === 0 ? <EmptyState icon={ClipboardList} message="You haven't raised any requests." /> : (
                    <ul className="divide-y divide-neutral-100">
                        {requests.map((r) => (
                            <li key={r.id} className="py-3 flex items-start justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                    <p className="font-semibold capitalize">{r.title.toLowerCase()}</p>
                                    <p className="text-neutral-600 text-xs">{r.description}</p>
                                    <p className="text-[11px] text-neutral-400">{new Date(r.requestedAt).toLocaleDateString("en-IN")}{r.reviewedByName ? ` · ${r.status.toLowerCase()} by ${r.reviewedByName}` : ""}{r.comments ? ` — ${r.comments}` : ""}</p>
                                    <div className="flex gap-3 mt-0.5">
                                        {r.attachmentUrl && <a href={r.attachmentUrl} target="_blank" rel="noopener" className="text-[11px] font-bold text-primary flex items-center gap-1"><Paperclip size={10} /> Attachment</a>}
                                        {r.letterUrl && <Link href={r.letterUrl} className="text-[11px] font-bold text-emerald-700 flex items-center gap-1"><FileText size={10} /> Download letter</Link>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge value={r.status} />
                                    {["PENDING", "IN_REVIEW"].includes(r.status) && <button disabled={withdraw.isPending} onClick={() => { if (window.confirm("Withdraw this request?")) withdraw.mutate({ id: r.id, kind: r.kind, action: "withdraw" }); }} className={btn.ghost}>Withdraw</button>}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <SectionCard title="Resignation & exit">
                {exit && (activeExit || exit.status === "COMPLETED") ? (
                    <div className="space-y-4 text-sm">
                        <div className="flex flex-wrap items-center gap-3"><Badge value={exit.status} /><span className="text-neutral-600">Resigned {exit.resignationDate} · last working day <b>{exit.lastWorkingDay}</b></span></div>
                        <div>
                            <div className="flex justify-between text-xs mb-1"><span className="font-bold text-neutral-600">Clearance</span><span>{exit.clearanceProgress}%</span></div>
                            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-[#2a78d6]" style={{ width: `${exit.clearanceProgress}%` }} /></div>
                            <ul className="grid grid-cols-2 gap-1.5 mt-2 text-xs">{exit.clearanceChecklist.map((c) => <li key={c.department} className="flex items-center gap-1.5">{c.cleared ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Circle size={13} className="text-neutral-300" />}{c.department}{c.cleared && c.clearedBy ? <span className="text-neutral-400">· {c.clearedBy}</span> : ""}</li>)}</ul>
                        </div>
                        {exit.assetsToReturn.length > 0 && <p className="text-xs rounded-xl bg-amber-50 text-amber-800 p-2.5">Return before your last day: {exit.assetsToReturn.map((a) => `${a.tag} ${a.name}`).join(", ")}</p>}
                        <p className="text-xs text-neutral-600">Full & final: {exit.fnfSettled ? `${money(exit.fnfAmountInr ?? 0)} ${exit.fnfPaid ? "— paid" : "— settled, payment pending with Finance"}` : "calculated after clearance"}</p>
                        <div className="flex flex-wrap gap-2">
                            {exit.canWithdraw && <button disabled={exitAct.isPending} onClick={() => { if (window.confirm("Withdraw your resignation?")) exitAct.mutate({ action: "withdraw" }); }} className={btn.ghost}>Withdraw resignation</button>}
                            {activeExit && !exit.employeeFeedback && <button onClick={() => setFbOpen(true)} className={btn.soft}>Share exit feedback</button>}
                            {exit.letterUrl && <Link href={exit.letterUrl} className={btn.good}>Download experience letter</Link>}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-sm gap-3">
                        <p className="text-neutral-600">Submitting a resignation notifies HR and your reporting manager. You can withdraw it until it is accepted.</p>
                        <button onClick={() => setResignOpen(true)} className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-50 shrink-0"><LogOut size={13} /> Resign</button>
                    </div>
                )}
            </SectionCard>

            <ModalShell open={open} onClose={() => setOpen(false)} title="New request" wide>
                <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); submit.mutate({ ...form, attachmentFileId: form.attachmentFileId || undefined }, { onSuccess: () => setOpen(false) }); }}>
                    <select value={form.type} onChange={(e) => setForm({ ...EMPTY, type: e.target.value })} className={inputCls} aria-label="Request type">
                        {["Attendance", "Letters", "Profile", "Services"].map((g) => <optgroup key={g} label={g}>{TYPES.filter((t) => t.group === g).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>)}
                    </select>
                    {form.type === "WFH" && <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-neutral-600">From<input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} /></label><label className="text-xs font-bold text-neutral-600">To<input required type="date" min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputCls} /></label></div>}
                    {form.type === "ATTENDANCE_CORRECTION" && <div className="grid grid-cols-3 gap-3"><input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} aria-label="Date" /><input required type="time" value={form.requestedCheckIn} onChange={(e) => setForm({ ...form, requestedCheckIn: e.target.value })} className={inputCls} aria-label="Check-in" /><input required type="time" value={form.requestedCheckOut} onChange={(e) => setForm({ ...form, requestedCheckOut: e.target.value })} className={inputCls} aria-label="Check-out" /></div>}
                    {form.type === "BANK_CHANGE" && <div className="grid grid-cols-2 gap-3"><input required placeholder="Bank name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className={inputCls} /><input placeholder="Account holder name" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} className={inputCls} /><input required inputMode="numeric" placeholder="Account number" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} className={inputCls} /><input required placeholder="IFSC" maxLength={11} value={form.ifscCode} onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} className={`${inputCls} uppercase`} /></div>}
                    {form.type === "NAME_CHANGE" && <input required placeholder="New legal name (as on PAN / Aadhaar)" value={form.newName} onChange={(e) => setForm({ ...form, newName: e.target.value })} className={inputCls} />}
                    {form.type === "ADDRESS_CHANGE" && <div className="grid grid-cols-1 gap-3"><textarea rows={2} placeholder="New current address" value={form.currentAddress} onChange={(e) => setForm({ ...form, currentAddress: e.target.value })} className={inputCls} /><textarea rows={2} placeholder="New permanent address (if changed)" value={form.permanentAddress} onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })} className={inputCls} /></div>}
                    {["IT_SUPPORT", "OTHER", "GRIEVANCE"].includes(form.type) && <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputCls} aria-label="Priority">{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p}>{p}</option>)}</select>}
                    <textarea required rows={3} placeholder={form.type === "SALARY_CERTIFICATE" ? "Purpose (e.g. home loan, visa)" : form.type === "GRIEVANCE" ? "Describe the issue — only HR can see this" : "Details / reason"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
                    {!["WFH", "ATTENDANCE_CORRECTION"].includes(form.type) && (
                        <label className="text-xs font-bold text-neutral-600 flex items-center gap-2"><Paperclip size={13} /> {NEEDS_PROOF.includes(form.type) ? (form.type === "BANK_CHANGE" ? "Cancelled cheque / bank statement *" : "Supporting document *") : "Attachment (optional)"}
                            <input type="file" accept="application/pdf,image/*" disabled={uploading} className="text-xs font-normal" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { const up = await uploadFile(f, "request"); setForm((x) => ({ ...x, attachmentFileId: up.id })); } catch (err) { toast.error((err as Error).message); } finally { setUploading(false); } }} />
                            {form.attachmentFileId && <span className="text-emerald-700">✓</span>}
                        </label>
                    )}
                    {["BANK_CHANGE", "NAME_CHANGE", "ADDRESS_CHANGE"].includes(form.type) && <p className="text-[11px] text-neutral-400">HR verifies the proof; the change is applied to your record automatically on approval{form.type === "BANK_CHANGE" ? " and used from the next payroll" : ""}.</p>}
                    <button disabled={submit.isPending || uploading || (NEEDS_PROOF.includes(form.type) && !form.attachmentFileId)} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit</button>
                </form>
            </ModalShell>

            <ModalShell open={resignOpen} onClose={() => setResignOpen(false)} title="Submit resignation">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (window.confirm("Submit your resignation?")) resignAct.mutate({ reason: resign.reason, noticePeriodDays: Number(resign.noticePeriodDays) }, { onSuccess: () => setResignOpen(false) }); }}>
                    <textarea required rows={3} placeholder="Reason" value={resign.reason} onChange={(e) => setResign({ ...resign, reason: e.target.value })} className={inputCls} />
                    <label className="text-xs font-bold text-neutral-600">Notice period (days)<input type="number" min="0" max="180" value={resign.noticePeriodDays} onChange={(e) => setResign({ ...resign, noticePeriodDays: e.target.value })} className={inputCls} /></label>
                    <button disabled={resignAct.isPending} className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-50">Submit resignation</button>
                </form>
            </ModalShell>

            <ModalShell open={fbOpen} onClose={() => setFbOpen(false)} title="Exit feedback (shared with HR only)">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); exitAct.mutate({ action: "feedback", ...fb, rating: Number(fb.rating) }, { onSuccess: () => setFbOpen(false) }); }}>
                    <label className="text-xs font-bold text-neutral-600">Overall experience<select value={fb.rating} onChange={(e) => setFb({ ...fb, rating: e.target.value })} className={inputCls}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select></label>
                    <label className="text-xs font-bold text-neutral-600">Main reason for leaving<select value={fb.reasonCategory} onChange={(e) => setFb({ ...fb, reasonCategory: e.target.value })} className={inputCls}>{["Career growth", "Compensation", "Manager / team", "Work-life balance", "Relocation", "Higher studies", "Health / personal", "Other"].map((r) => <option key={r}>{r}</option>)}</select></label>
                    <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={fb.wouldRecommend} onChange={(e) => setFb({ ...fb, wouldRecommend: e.target.checked })} /> I would recommend this company to a friend</label>
                    <textarea required rows={4} placeholder="What should we improve?" value={fb.comments} onChange={(e) => setFb({ ...fb, comments: e.target.value })} className={inputCls} />
                    <button disabled={exitAct.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit feedback</button>
                </form>
            </ModalShell>
        </div>
    );
}

export default function MyRequestsPage() {
    return <Suspense fallback={<SkeletonPulse className="h-64 w-full" />}><RequestsContent /></Suspense>;
}
