"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt, Plus, Paperclip, Users } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell, StatCard } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, inputCls, money, uploadFile, useAct } from "@/components/finance/kit";

interface Expense { id: string; category: string; description: string; amount: number; expenseDate: string; status: string; submittedByName: string; receiptUrl?: string | null; managerApprovedByName?: string | null; approvedByName?: string | null; rejectionReason?: string | null; paymentReference?: string | null; policyFlag?: string | null; clientName?: string | null; billable: boolean }
const CATS = ["TRAVEL", "MEALS", "SOFTWARE", "OFFICE", "TRAINING", "MARKETING", "OTHER"];
const empty = { category: "TRAVEL", description: "", amount: "", gstAmount: "", expenseDate: "", receiptFileId: "", billable: false, clientId: "" };

export default function MyExpensesPage() {
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [form, setForm] = useState(empty);
    const { data = [] } = useQuery<Expense[]>({ queryKey: ["my-expenses"], queryFn: () => api("/api/finance/expenses?mine=1") });
    const { data: team = [] } = useQuery<Expense[]>({ queryKey: ["team-expenses"], queryFn: () => api("/api/finance/expenses?team=1") });
    // Recruitment staff can mark client-rebillable costs
    const { data: clients = [] } = useQuery<{ id: string; companyName: string }[]>({ queryKey: ["my-clients"], queryFn: async () => { const r = await fetch("/api/admin/clients"); return r.ok ? r.json() : []; } });
    const keys = ["my-expenses", "team-expenses"];
    const claim = useAct("/api/finance/expenses", "POST", keys, "Claim submitted");
    const decide = useAct("/api/finance/expenses", "PATCH", keys, "Decision recorded");
    const sum = (s: string[]) => data.filter((e) => s.includes(e.status)).reduce((t, e) => t + e.amount, 0);

    return (
        <div className="space-y-6 max-w-4xl">
            <PageHeader title="My Expenses" subtitle="Claim work expenses — your manager approves, then Finance reimburses" action={<button onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"><Plus size={15} /> New Claim</button>} />
            <div className="grid grid-cols-3 gap-4">
                <StatCard label="In approval" value={money(sum(["PENDING_MANAGER", "PENDING"]))} icon={Receipt} tone="amber" />
                <StatCard label="Approved" value={money(sum(["APPROVED"]))} icon={Receipt} tone="blue" />
                <StatCard label="Reimbursed" value={money(sum(["PAID"]))} icon={Receipt} tone="emerald" />
            </div>

            {team.length > 0 && (
                <SectionCard title={`Team claims awaiting you (${team.length})`}>
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {team.map((e) => (
                            <li key={e.id} className="py-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{e.submittedByName}: {e.description} <span className="font-mono">{money(e.amount)}</span></p>
                                    <p className="text-[11px] text-neutral-500">{e.category} · {e.expenseDate}{e.receiptUrl && <> · <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-primary font-bold">receipt</a></>}{e.policyFlag && <span className="text-amber-700 font-bold"> · {e.policyFlag}</span>}</p>
                                </div>
                                <div className="flex gap-1.5">
                                    <button onClick={() => decide.mutate({ id: e.id, action: "manager_approve" })} className={btn.good}>Approve</button>
                                    <button onClick={() => { const reason = window.prompt("Reason for rejecting?"); if (reason) decide.mutate({ id: e.id, action: "manager_reject", reason }); }} className={btn.danger}>Reject</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}

            <SectionCard title={`My claims (${data.length})`}>
                {data.length === 0 ? <EmptyState icon={Receipt} message="No claims yet." /> : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.map((e) => (
                            <li key={e.id} className="py-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{e.description} <span className="font-mono">{money(e.amount)}</span></p>
                                    <p className="text-[11px] text-neutral-500">{e.category.replace("_", " ")} · {e.expenseDate}{e.billable ? ` · re-bill ${e.clientName}` : ""}{e.managerApprovedByName ? ` · manager ${e.managerApprovedByName}` : ""}{e.approvedByName ? ` · finance ${e.approvedByName}` : ""}{e.rejectionReason ? ` — ${e.rejectionReason}` : ""}{e.paymentReference ? ` · ref ${e.paymentReference}` : ""}</p>
                                    {e.policyFlag && <p className="text-[11px] text-amber-700 font-bold">{e.policyFlag}</p>}
                                </div>
                                <Badge value={e.status} label={e.status === "PENDING_MANAGER" ? "With manager" : e.status === "PENDING" ? "With Finance" : undefined} />
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <ModalShell open={open} onClose={() => setOpen(false)} title="New Expense Claim">
                <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); claim.mutate({ ...form, amount: Number(form.amount), gstAmount: Number(form.gstAmount) || 0, isReimbursement: true, receiptFileId: form.receiptFileId || undefined, expenseDate: form.expenseDate || undefined }, { onSuccess: () => { setOpen(false); setForm(empty); } }); }}>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                    <input required type="number" min="1" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
                    <input required placeholder="What was it for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} col-span-2`} />
                    <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={inputCls} />
                    <input type="number" min="0" placeholder="GST on bill (if any)" value={form.gstAmount} onChange={(e) => setForm({ ...form, gstAmount: e.target.value })} className={inputCls} />
                    <label className="col-span-2 text-xs font-bold text-neutral-600 flex items-center gap-2"><Paperclip size={13} /> Receipt (PDF / photo, max 5 MB)
                        <input type="file" accept="application/pdf,image/*" disabled={uploading} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { const up = await uploadFile(f, "expense-receipt"); setForm((x) => ({ ...x, receiptFileId: up.id })); toast.success("Receipt attached"); } catch (err) { toast.error((err as Error).message); } finally { setUploading(false); } }} className="text-xs font-normal" />
                        {form.receiptFileId && <span className="text-emerald-700">✓</span>}
                    </label>
                    {Array.isArray(clients) && clients.length > 0 && <>
                        <label className="col-span-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} /> <Users size={14} /> Client should reimburse this</label>
                        {form.billable && <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={`${inputCls} col-span-2`}><option value="">Client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>}
                    </>}
                    <button disabled={claim.isPending || uploading} className="col-span-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit Claim</button>
                </form>
            </ModalShell>
        </div>
    );
}
