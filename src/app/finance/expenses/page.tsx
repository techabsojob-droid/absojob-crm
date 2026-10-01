"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Plus, Paperclip } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { btn, inputCls, money, uploadFile, useAct } from "@/components/finance/kit";

interface Expense { id: string; category: string; description: string; amount: number; gstAmount: number; vendor?: string | null; expenseDate: string; isReimbursement: boolean; submittedById: string; submittedByName: string; receiptUrl?: string | null; billable: boolean; clientName?: string | null; rebilledInvoiceId?: string | null; policyFlag?: string | null; status: string; managerApprovedByName?: string | null; approvedByName?: string | null; rejectionReason?: string | null; paymentReference?: string | null }
const CATS = ["TRAVEL", "SOFTWARE", "MARKETING", "JOB_BOARDS", "OFFICE", "UTILITIES", "MEALS", "TRAINING", "OTHER"];
const empty = { category: "SOFTWARE", description: "", amount: "", gstAmount: "", vendor: "", expenseDate: "", receiptFileId: "", billable: false, clientId: "" };

export default function ExpensesPage() {
    const { user } = useAuth();
    const [status, setStatus] = useState("PENDING");
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(empty);
    const { data = [] } = useQuery<Expense[]>({ queryKey: ["finance-expenses", status], queryFn: () => api(`/api/finance/expenses?status=${status}`) });
    const { data: clients = [] } = useQuery<{ id: string; companyName: string }[]>({ queryKey: ["finance-clients"], queryFn: () => api("/api/finance/clients") });
    const keys = ["finance-expenses", "finance-dashboard", "finance-billing"];
    const act = useAct("/api/finance/expenses", "PATCH", keys, "Expense updated");
    const add = useAct("/api/finance/expenses", "POST", keys, "Company expense recorded — awaiting approval");

    return (
        <div className="space-y-6">
            <PageHeader title="Expenses & Reimbursements" subtitle="Employee claims (manager → Finance) and company bills paid directly. Policy limits, GST input credit and client re-billing." action={<button onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"><Plus size={15} /> Record company expense</button>} />
            <div className="flex gap-1.5">{["PENDING_MANAGER", "PENDING", "APPROVED", "PAID", "REJECTED", "ALL"].map((s) => <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${status === s ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>{s === "PENDING_MANAGER" ? "WITH MANAGER" : s}</button>)}</div>
            <SectionCard title={`${data.length} expense(s) · ${money(data.reduce((s, e) => s + e.amount, 0))}`}>
                {data.length === 0 ? <EmptyState icon={CreditCard} message="Nothing here." /> : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.map((e) => (
                            <li key={e.id} className="py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold">{e.description} <span className="font-mono">{money(e.amount)}</span>{e.gstAmount > 0 && <span className="text-[11px] font-normal text-neutral-500"> incl. GST {money(e.gstAmount)}</span>}</p>
                                    <p className="text-[11px] text-neutral-500">
                                        {e.category.replace("_", " ")} · {e.expenseDate} · {e.isReimbursement ? `claim by ${e.submittedByName}` : `company bill${e.vendor ? ` · ${e.vendor}` : ""}`}
                                        {e.receiptUrl && <> · <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-primary font-bold">receipt</a></>}
                                        {e.billable && ` · re-bill to ${e.clientName}${e.rebilledInvoiceId ? " (invoiced)" : ""}`}
                                        {e.managerApprovedByName && ` · manager: ${e.managerApprovedByName}`}{e.approvedByName && ` · ${e.status.toLowerCase()} by ${e.approvedByName}`}{e.rejectionReason && ` — ${e.rejectionReason}`}{e.paymentReference && ` · ref ${e.paymentReference}`}
                                    </p>
                                    {e.policyFlag && <p className="text-[11px] font-bold text-amber-700">⚠ {e.policyFlag}</p>}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Badge value={e.status} label={e.status === "PENDING_MANAGER" ? "With manager" : undefined} />
                                    {e.status === "PENDING" && e.submittedById !== user?.id && <>
                                        <button onClick={() => act.mutate({ id: e.id, action: "approve" })} className={btn.soft}>Approve</button>
                                        <button onClick={() => { const reason = window.prompt("Reason for rejecting?"); if (reason) act.mutate({ id: e.id, action: "reject", reason }); }} className={btn.danger}>Reject</button>
                                    </>}
                                    {e.status === "APPROVED" && <button onClick={() => { const reference = window.prompt("Payment reference"); if (reference !== null) act.mutate({ id: e.id, action: "pay", reference }); }} className={btn.good}>Mark paid</button>}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <ModalShell open={open} onClose={() => setOpen(false)} title="Record company expense">
                <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate({ ...form, amount: Number(form.amount), gstAmount: Number(form.gstAmount) || 0, isReimbursement: false, receiptFileId: form.receiptFileId || undefined, expenseDate: form.expenseDate || undefined }, { onSuccess: () => { setOpen(false); setForm(empty); } }); }}>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>{CATS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select>
                    <input required type="number" min="1" placeholder="Amount (incl. GST)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
                    <input required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} col-span-2`} />
                    <input type="number" min="0" placeholder="GST in amount (ITC)" value={form.gstAmount} onChange={(e) => setForm({ ...form, gstAmount: e.target.value })} className={inputCls} />
                    <input placeholder="Vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={inputCls} />
                    <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={inputCls} />
                    <label className="text-xs font-bold text-neutral-500 flex items-center gap-1"><Paperclip size={12} /><input type="file" accept="application/pdf,image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const up = await uploadFile(f, "expense-receipt"); setForm((x) => ({ ...x, receiptFileId: up.id })); toast.success("Receipt attached"); } catch (err) { toast.error((err as Error).message); } }} className="text-xs" /></label>
                    <label className="col-span-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} /> Re-bill to client</label>
                    {form.billable && <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={`${inputCls} col-span-2`}><option value="">Client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>}
                    <p className="col-span-2 text-[11px] text-neutral-400">Another Finance admin or the Super Admin approves it. Vendor invoices with credit terms belong in Vendors & Bills.</p>
                    <button disabled={add.isPending} className="col-span-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save</button>
                </form>
            </ModalShell>
        </div>
    );
}
