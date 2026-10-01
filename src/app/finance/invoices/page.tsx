"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search, Trash2, Printer, Download } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { btn, downloadText, inputCls, money, toCsv, useAct } from "@/components/finance/kit";

interface Invoice {
    id: string; invoiceNumber: string; kind: string; clientId: string; clientName: string; clientGstin?: string | null; candidateName?: string | null; milestone?: string;
    lineItems: { description: string; amount: number }[]; currency: string; fxRate: number; discount: number; subtotal: number; taxRate: number;
    tax: { cgst: number; sgst: number; igst: number; zeroRated: boolean }; taxAmount: number; roundOff: number; total: number; amountPaid: number; writtenOff: number;
    status: string; issueDate: string; dueDate: string; payments: { id: string; amount: number; tdsAmount: number; date: string; method: string; reference?: string | null }[];
    reminders: { at: string; stage: string; sentTo: string }[]; notes?: string | null; balanceDue: number; balanceDueInr: number; totalInr: number; daysOverdue: number;
    creditNoteForId?: string | null; createdById?: string; createdByName: string; approvedByName?: string | null; irn?: string | null; receipts: string[];
}
interface ClientLite { id: string; companyName: string; creditDays: number; billing: { currency: string; gstin?: string | null; stateCode?: string } }

const STATUSES = ["ALL", "DRAFT", "PENDING_APPROVAL", "SENT", "PARTIALLY_PAID", "OVERDUE", "PAID", "WRITTEN_OFF", "CANCELLED"];
const emptyForm = { clientId: "", issueDate: "", dueDate: "", discount: "", fxRate: "", notes: "", irn: "", send: true, lines: [{ description: "", amount: "" }] };

function InvoicesContent() {
    const params = useSearchParams();
    const { user } = useAuth();
    const [status, setStatus] = useState(params.get("status") ?? "ALL");
    const [clientId, setClientId] = useState(params.get("clientId") ?? "ALL");
    const [kind, setKind] = useState("ALL");
    const [q, setQ] = useState("");
    const [openId, setOpenId] = useState<string | null>(params.get("id"));
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [pay, setPay] = useState({ amount: "", tdsAmount: "", method: "BANK_TRANSFER", reference: "", date: new Date().toISOString().split("T")[0] });

    const { data: list = [], isLoading } = useQuery<Invoice[]>({ queryKey: ["finance-invoices", status, clientId, kind, q], queryFn: () => api(`/api/finance/invoices?status=${status}&clientId=${clientId}&kind=${kind}&q=${encodeURIComponent(q)}`) });
    const { data: all = [] } = useQuery<Invoice[]>({ queryKey: ["finance-invoices", "all"], queryFn: () => api("/api/finance/invoices") });
    const { data: clients = [] } = useQuery<ClientLite[]>({ queryKey: ["finance-clients"], queryFn: () => api("/api/finance/clients") });
    const open = all.find((i) => i.id === openId) ?? null;
    const notes = open ? all.filter((c) => c.creditNoteForId === open.id) : [];
    const formClient = clients.find((c) => c.id === form.clientId);
    const keys = ["finance-invoices", "finance-dashboard", "finance-billing", "finance-receipts"];

    const create = useAct<Invoice>("/api/finance/invoices", "POST", keys, (i) => `${i.invoiceNumber} ${i.status === "PENDING_APPROVAL" ? "sent for approval" : i.status === "DRAFT" ? "saved" : "sent"}`);
    const act = useAct("/api/finance/invoices", "PATCH", keys, "Invoice updated");
    const receipt = useAct("/api/finance/receipts", "POST", keys, "Payment recorded");

    const subtotal = form.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) - (Number(form.discount) || 0);
    const ask = (label: string) => window.prompt(label)?.trim() || null;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Invoices & Notes"
                subtitle="GST invoices, credit / debit notes, approvals, reminders and collections"
                action={
                    <div className="flex gap-2">
                        <button onClick={() => downloadText(toCsv([["Number", "Type", "Client", "GSTIN", "Issue", "Due", "Currency", "Taxable", "CGST", "SGST", "IGST", "Total", "Paid", "Balance", "Status"], ...list.map((i) => [i.invoiceNumber, i.kind, i.clientName, i.clientGstin, i.issueDate, i.dueDate, i.currency, i.subtotal, i.tax.cgst, i.tax.sgst, i.tax.igst, i.total, i.amountPaid, i.balanceDue, i.status])]), "invoices.csv")} className="px-4 py-2.5 rounded-xl bg-neutral-100 font-bold text-xs flex items-center gap-2"><Download size={14} /> Export</button>
                        <button onClick={() => setCreateOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"><Plus size={15} /> Manual invoice</button>
                    </div>
                }
            />

            <SectionCard>
                <div className="flex flex-wrap items-center gap-2">
                    {STATUSES.map((s) => <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${status === s ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>{s.replace(/_/g, " ")}</button>)}
                    <select value={kind} onChange={(e) => setKind(e.target.value)} className="px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-semibold"><option value="ALL">All types</option><option value="INVOICE">Invoices</option><option value="CREDIT_NOTE">Credit notes</option><option value="DEBIT_NOTE">Debit notes</option></select>
                    <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-semibold"><option value="ALL">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>
                    <div className="relative ml-auto w-60"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Number, client, candidate…" className="w-full pl-8 pr-3 py-2 rounded-xl bg-neutral-100 text-sm" /></div>
                </div>
            </SectionCard>

            <SectionCard title={`${list.length} document(s)`}>
                {isLoading ? <SkeletonPulse className="h-40 w-full" /> : list.length === 0 ? <EmptyState icon={FileText} message="No documents match these filters." /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Number</th><th>Client</th><th>Issued</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {list.map((i) => (
                                    <tr key={i.id} onClick={() => setOpenId(i.id)} className="cursor-pointer hover:bg-neutral-50">
                                        <td className="py-3 font-mono font-bold text-primary">{i.invoiceNumber}{i.kind !== "INVOICE" && <span className="ml-1 text-[10px] text-rose-600">{i.kind === "CREDIT_NOTE" ? "CN" : "DN"}</span>}</td>
                                        <td>{i.clientName}{i.candidateName && <span className="block text-[11px] text-neutral-500">{i.candidateName}</span>}</td>
                                        <td>{i.issueDate}</td>
                                        <td>{i.dueDate}{i.daysOverdue > 0 && <span className="block text-[11px] text-rose-600">{i.daysOverdue}d overdue</span>}</td>
                                        <td className="text-right font-mono">{i.kind === "CREDIT_NOTE" ? "−" : ""}{money(i.total, i.currency)}</td>
                                        <td className="text-right font-mono font-bold">{i.kind === "CREDIT_NOTE" ? "—" : money(i.balanceDue, i.currency)}</td>
                                        <td><Badge value={i.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <ModalShell open={createOpen} onClose={() => setCreateOpen(false)} title="Manual invoice" wide>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate({ clientId: form.clientId, issueDate: form.issueDate || undefined, dueDate: form.dueDate || undefined, discount: Number(form.discount) || 0, fxRate: form.fxRate ? Number(form.fxRate) : undefined, notes: form.notes || null, irn: form.irn || null, send: form.send, lineItems: form.lines.map((l) => ({ description: l.description, amount: Number(l.amount) })) }, { onSuccess: () => { setCreateOpen(false); setForm(emptyForm); } }); }}>
                    <div className="grid grid-cols-3 gap-3">
                        <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={inputCls}><option value="">Select client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}{c.billing.currency !== "INR" ? ` (${c.billing.currency})` : ""}</option>)}</select>
                        <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className={inputCls} title="Issue date (defaults to today)" />
                        <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputCls} title="Due date (defaults to client credit terms)" />
                    </div>
                    {formClient && <p className="text-[11px] text-neutral-500">GSTIN {formClient.billing.gstin || "unregistered"} · state {formClient.billing.stateCode} · {formClient.creditDays} days credit · billed in {formClient.billing.currency}</p>}
                    {form.lines.map((l, idx) => (
                        <div key={idx} className="flex gap-2">
                            <input required placeholder="Description (e.g. RPO retainer — October)" value={l.description} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === idx ? { ...x, description: e.target.value } : x)) })} className={inputCls} />
                            <input required type="number" min="0.01" step="0.01" placeholder="Amount" value={l.amount} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === idx ? { ...x, amount: e.target.value } : x)) })} className={`${inputCls} w-40`} />
                            {form.lines.length > 1 && <button type="button" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== idx) })} className="text-neutral-400 hover:text-rose-600" aria-label="Remove line"><Trash2 size={16} /></button>}
                        </div>
                    ))}
                    <button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, { description: "", amount: "" }] })} className="text-xs font-bold text-primary">+ Add line</button>
                    <div className="grid grid-cols-3 gap-3">
                        <input type="number" min="0" placeholder="Discount" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className={inputCls} />
                        {formClient && formClient.billing.currency !== "INR" ? <input required type="number" step="0.0001" placeholder={`${formClient.billing.currency}→INR rate`} value={form.fxRate} onChange={(e) => setForm({ ...form, fxRate: e.target.value })} className={inputCls} /> : <span />}
                        <input placeholder="e-Invoice IRN (optional)" value={form.irn} onChange={(e) => setForm({ ...form, irn: e.target.value })} className={inputCls} />
                    </div>
                    <textarea placeholder="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.send} onChange={(e) => setForm({ ...form, send: e.target.checked })} /> Send to client now</label>
                        <span className="text-sm">Taxable <strong className="font-mono">{money(subtotal, formClient?.billing.currency)}</strong> + GST</span>
                    </div>
                    <button disabled={create.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">{form.send ? "Create & send" : "Save draft"}</button>
                </form>
            </ModalShell>

            <ModalShell open={!!open} onClose={() => setOpenId(null)} title={open ? `${open.kind === "CREDIT_NOTE" ? "Credit note" : open.kind === "DEBIT_NOTE" ? "Debit note" : "Invoice"} ${open.invoiceNumber}` : ""} wide>
                {open && (
                    <div className="space-y-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="font-bold text-base">{open.clientName} <span className="text-xs font-normal text-neutral-500">{open.clientGstin ?? "unregistered"}</span></p>
                                <p className="text-neutral-500">Issued {open.issueDate} · due {open.dueDate} · by {open.createdByName}{open.approvedByName ? ` · approved by ${open.approvedByName}` : ""}{open.irn ? ` · IRN ${open.irn}` : ""}</p>
                            </div>
                            <Badge value={open.status} />
                        </div>
                        <table className="w-full"><tbody className="divide-y divide-neutral-100">
                            {open.lineItems.map((l, i) => <tr key={i}><td className="py-1.5">{l.description}</td><td className="py-1.5 text-right font-mono">{money(l.amount, open.currency)}</td></tr>)}
                            {open.discount > 0 && <tr><td className="py-1.5 text-neutral-500">Discount</td><td className="py-1.5 text-right font-mono">−{money(open.discount, open.currency)}</td></tr>}
                            {open.tax.zeroRated ? <tr><td className="py-1.5 text-neutral-500">Zero-rated export (LUT)</td><td className="py-1.5 text-right font-mono">0</td></tr> : open.tax.igst ? <tr><td className="py-1.5 text-neutral-500">IGST {open.taxRate}%</td><td className="py-1.5 text-right font-mono">{money(open.tax.igst, open.currency)}</td></tr> : <>
                                <tr><td className="py-1.5 text-neutral-500">CGST {open.taxRate / 2}%</td><td className="py-1.5 text-right font-mono">{money(open.tax.cgst, open.currency)}</td></tr>
                                <tr><td className="py-1.5 text-neutral-500">SGST {open.taxRate / 2}%</td><td className="py-1.5 text-right font-mono">{money(open.tax.sgst, open.currency)}</td></tr></>}
                            {open.roundOff !== 0 && <tr><td className="py-1.5 text-neutral-500">Round off</td><td className="py-1.5 text-right font-mono">{open.roundOff}</td></tr>}
                            <tr className="font-bold"><td className="py-1.5">Total{open.currency !== "INR" ? ` (≈ ${money(open.totalInr)})` : ""}</td><td className="py-1.5 text-right font-mono">{money(open.total, open.currency)}</td></tr>
                            {open.kind !== "CREDIT_NOTE" && <tr className="font-bold text-primary"><td className="py-1.5">Balance due</td><td className="py-1.5 text-right font-mono">{money(open.balanceDue, open.currency)}</td></tr>}
                        </tbody></table>
                        {open.notes && <p className="text-xs text-neutral-500 whitespace-pre-line">{open.notes}</p>}
                        {open.payments.length > 0 && <div><p className="text-xs font-bold uppercase text-neutral-400 mb-1">Payments</p>{open.payments.map((p) => <p key={p.id} className="text-xs">{p.date} · {money(p.amount)}{p.tdsAmount ? ` + TDS ${money(p.tdsAmount)}` : ""} · {p.method.replace("_", " ")}{p.reference ? ` · ${p.reference}` : ""}</p>)}{open.receipts.length > 0 && <Link href="/finance/receipts" className="text-[11px] font-bold text-primary">Receipts: {open.receipts.join(", ")}</Link>}</div>}
                        {notes.length > 0 && <p className="text-xs text-rose-700">Notes: {notes.map((c) => `${c.invoiceNumber} (${money(c.total, c.currency)})`).join(", ")}</p>}
                        {open.reminders.length > 0 && <p className="text-[11px] text-neutral-500">Reminders: {open.reminders.map((r) => `${r.stage.replace(/_/g, " ").toLowerCase()} ${r.at.slice(0, 10)}`).join(" · ")}</p>}

                        {open.kind !== "CREDIT_NOTE" && ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(open.status) && (
                            <form className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end border-t border-neutral-100 pt-3" onSubmit={(e) => { e.preventDefault(); receipt.mutate({ clientId: open.clientId, amount: Number(pay.amount) || 0, tdsAmount: Number(pay.tdsAmount) || 0, method: pay.method, reference: pay.reference, date: pay.date, allocations: [{ invoiceId: open.id, amount: Number(pay.amount) || 0, tds: Number(pay.tdsAmount) || 0 }] }, { onSuccess: () => setPay({ ...pay, amount: "", tdsAmount: "", reference: "" }) }); }}>
                                <label className="text-xs font-bold text-neutral-500">Received (₹)<input type="number" min="0" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className={inputCls} placeholder={String(open.balanceDueInr)} /></label>
                                <label className="text-xs font-bold text-neutral-500">TDS (₹)<input type="number" min="0" value={pay.tdsAmount} onChange={(e) => setPay({ ...pay, tdsAmount: e.target.value })} className={inputCls} /></label>
                                <label className="text-xs font-bold text-neutral-500">Method<select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} className={inputCls}>{["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</select></label>
                                <label className="text-xs font-bold text-neutral-500">UTR / ref<input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} className={inputCls} /></label>
                                <button disabled={receipt.isPending} className="py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">Record payment</button>
                            </form>
                        )}

                        <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                            <Link href={`/finance/invoices/${open.id}/print`} target="_blank" className={`${btn.ghost} flex items-center gap-1`}><Printer size={13} /> GST invoice / PDF</Link>
                            {open.status === "PENDING_APPROVAL" && (open.createdById !== user?.id || user?.role === "SUPER_ADMIN") && <button onClick={() => act.mutate({ id: open.id, action: "approve" })} className={btn.good}>Approve & send</button>}
                            {open.status === "PENDING_APPROVAL" && open.createdById === user?.id && user?.role !== "SUPER_ADMIN" && <span className="text-xs text-amber-700 font-bold self-center">Waiting for another approver</span>}
                            {open.status === "DRAFT" && <button onClick={() => act.mutate({ id: open.id, action: "send" })} className={btn.primary}>Send to client</button>}
                            {["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(open.status) && open.kind !== "CREDIT_NOTE" && <button onClick={() => act.mutate({ id: open.id, action: "remind" })} className={btn.ghost}>Send reminder</button>}
                            {open.kind === "INVOICE" && !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(open.status) && <>
                                <button onClick={() => { const reason = ask("Reason for the credit note"); if (!reason) return; const amt = window.prompt("Credit amount (pre-GST) — blank = full remaining", ""); act.mutate({ id: open.id, action: "credit_note", reason, amount: amt ? Number(amt) : undefined }); }} className={btn.danger}>Credit note</button>
                                <button onClick={() => { const reason = ask("Reason for the debit note (extra charge)"); if (!reason) return; const amt = Number(window.prompt("Amount (pre-GST)") || 0); if (amt > 0) act.mutate({ id: open.id, action: "debit_note", reason, amount: amt }); }} className={btn.ghost}>Debit note</button>
                            </>}
                            {["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(open.status) && user?.role === "SUPER_ADMIN" && <button onClick={() => { const reason = ask("Why write this off as bad debt?"); if (reason && window.confirm(`Write off ${money(open.balanceDue, open.currency)}?`)) act.mutate({ id: open.id, action: "write_off", reason }); }} className={btn.danger}>Write off</button>}
                            {open.amountPaid === 0 && open.status !== "CANCELLED" && open.kind !== "CREDIT_NOTE" && <button onClick={() => { const reason = ask("Why cancel this invoice?"); if (reason) act.mutate({ id: open.id, action: "cancel", reason }); }} className={btn.ghost}>Cancel</button>}
                            {!open.irn && open.kind !== "CREDIT_NOTE" && !["DRAFT", "CANCELLED"].includes(open.status) && <button onClick={() => { const irn = ask("e-Invoice IRN from your GSP"); if (irn) act.mutate({ id: open.id, action: "set_irn", irn }); }} className={btn.ghost}>Add IRN</button>}
                        </div>
                    </div>
                )}
            </ModalShell>
        </div>
    );
}

function Keyed() {
    const params = useSearchParams();
    return <InvoicesContent key={`${params.get("id")}-${params.get("status")}-${params.get("clientId")}`} />;
}

export default function InvoicesPage() {
    return <Suspense fallback={<SkeletonPulse className="h-96 w-full" />}><Keyed /></Suspense>;
}
