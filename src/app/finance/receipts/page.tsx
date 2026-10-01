"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HandCoins, Plus } from "lucide-react";
import { PageHeader, SectionCard, EmptyState, ModalShell, Badge } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, inputCls, money, useAct } from "@/components/finance/kit";

interface Receipt { id: string; receiptNumber: string; clientId: string; clientName: string; date: string; amount: number; tdsAmount: number; method: string; reference?: string | null; allocations: { invoiceId: string; invoiceNumber: string; amount: number; tds: number }[]; unapplied: number; reconciled: boolean; recordedByName: string }
interface Inv { id: string; invoiceNumber: string; clientId: string; status: string; kind: string; dueDate: string; balanceDueInr: number }
interface ClientLite { id: string; companyName: string }

export default function ReceiptsPage() {
    const [clientId, setClientId] = useState("ALL");
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ clientId: "", amount: "", tdsAmount: "", method: "BANK_TRANSFER", reference: "", date: new Date().toISOString().split("T")[0], bankAccountId: "" });
    const [alloc, setAlloc] = useState<Record<string, { amount: string; tds: string }>>({});
    const { data = [] } = useQuery<Receipt[]>({ queryKey: ["finance-receipts", clientId], queryFn: () => api(`/api/finance/receipts?clientId=${clientId}`) });
    const { data: clients = [] } = useQuery<ClientLite[]>({ queryKey: ["finance-clients"], queryFn: () => api("/api/finance/clients") });
    const { data: invoices = [] } = useQuery<Inv[]>({ queryKey: ["finance-invoices", "all"], queryFn: () => api("/api/finance/invoices") });
    const { data: settings } = useQuery<{ bankAccounts: { id: string; name: string; isDefault: boolean }[] }>({ queryKey: ["finance-settings"], queryFn: () => api("/api/finance/settings") });
    const openInvoices = invoices.filter((i) => i.clientId === form.clientId && i.kind !== "CREDIT_NOTE" && ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(i.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const keys = ["finance-receipts", "finance-invoices", "finance-dashboard"];
    const record = useAct<Receipt>("/api/finance/receipts", "POST", keys, (r) => `${r.receiptNumber} recorded${r.unapplied ? ` · ${money(r.unapplied)} kept on account` : ""}`);
    const apply = useAct("/api/finance/receipts", "PATCH", keys, "Advance applied");
    const allocated = Object.values(alloc).reduce((s, a) => s + (Number(a.amount) || 0), 0);

    return (
        <div className="space-y-6">
            <PageHeader title="Receipts" subtitle="Client payments — split across invoices, TDS credit, and on-account advances" action={<button onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"><Plus size={15} /> Record receipt</button>} />
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-semibold"><option value="ALL">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>
            <SectionCard title={`${data.length} receipt(s) · ${money(data.reduce((s, r) => s + r.amount, 0))}`}>
                {data.length === 0 ? <EmptyState icon={HandCoins} message="No receipts yet." /> : (
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Receipt</th><th>Client</th><th>Date</th><th>Applied to</th><th className="text-right">Cash</th><th className="text-right">TDS</th><th className="text-right">On account</th><th /></tr></thead>
                        <tbody className="divide-y divide-neutral-100">
                            {data.map((r) => (
                                <tr key={r.id}>
                                    <td className="py-2.5 font-mono font-bold">{r.receiptNumber}<span className="block text-[10px] font-sans text-neutral-400">{r.method.replace("_", " ")}{r.reference ? ` · ${r.reference}` : ""}</span></td>
                                    <td>{r.clientName}</td>
                                    <td>{r.date}</td>
                                    <td className="text-xs">{r.allocations.map((a) => `${a.invoiceNumber} ${money(a.amount + a.tds)}`).join(", ") || "—"}</td>
                                    <td className="text-right font-mono">{money(r.amount)}</td>
                                    <td className="text-right font-mono">{money(r.tdsAmount)}</td>
                                    <td className="text-right font-mono">{r.unapplied ? money(r.unapplied) : "—"}</td>
                                    <td className="text-right space-x-1">
                                        {r.reconciled && <Badge value="PAID" label="Reconciled" />}
                                        {r.unapplied > 0 && (
                                            <button onClick={() => {
                                                const open2 = invoices.filter((i) => i.clientId === r.clientId && ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(i.status));
                                                if (!open2.length) return alert("No open invoice for this client");
                                                const num = window.prompt(`Apply advance to which invoice? (${open2.map((i) => i.invoiceNumber).join(", ")})`, open2[0].invoiceNumber);
                                                const target = open2.find((i) => i.invoiceNumber === num);
                                                if (target) apply.mutate({ receiptId: r.id, invoiceId: target.id });
                                            }} className={btn.soft}>Apply advance</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </SectionCard>

            <ModalShell open={open} onClose={() => setOpen(false)} title="Record receipt" wide>
                <form className="space-y-3 text-sm" onSubmit={(e) => {
                    e.preventDefault();
                    const allocations = Object.entries(alloc).filter(([, a]) => Number(a.amount) || Number(a.tds)).map(([invoiceId, a]) => ({ invoiceId, amount: Number(a.amount) || 0, tds: Number(a.tds) || 0 }));
                    record.mutate({ ...form, amount: Number(form.amount) || 0, tdsAmount: Number(form.tdsAmount) || 0, bankAccountId: form.bankAccountId || undefined, allocations: allocations.length ? allocations : undefined }, { onSuccess: () => { setOpen(false); setAlloc({}); setForm({ ...form, amount: "", tdsAmount: "", reference: "" }); } });
                }}>
                    <div className="grid grid-cols-3 gap-3">
                        <select required value={form.clientId} onChange={(e) => { setForm({ ...form, clientId: e.target.value }); setAlloc({}); }} className={inputCls}><option value="">Client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>
                        <input required type="number" min="0" step="0.01" placeholder="Cash received (₹)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
                        <input type="number" min="0" step="0.01" placeholder="TDS deducted (₹)" value={form.tdsAmount} onChange={(e) => setForm({ ...form, tdsAmount: e.target.value })} className={inputCls} />
                        <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={inputCls}>{["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</select>
                        <input placeholder="UTR / cheque no." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputCls} />
                        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
                        <select value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })} className={inputCls}><option value="">Deposit to default bank</option>{settings?.bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                    </div>
                    {form.clientId && (
                        <div>
                            <p className="text-xs font-bold text-neutral-500 mb-1">Allocate to invoices (leave empty to auto-apply oldest first; any remainder stays on account)</p>
                            {openInvoices.length === 0 ? <p className="text-xs text-neutral-400">No open invoices — the full amount will be kept as an advance.</p> : openInvoices.map((i) => (
                                <div key={i.id} className="flex items-center gap-2 py-1">
                                    <span className="flex-1 text-xs"><b>{i.invoiceNumber}</b> · due {i.dueDate} · balance {money(i.balanceDueInr)}</span>
                                    <input type="number" min="0" placeholder="Cash" value={alloc[i.id]?.amount ?? ""} onChange={(e) => setAlloc({ ...alloc, [i.id]: { amount: e.target.value, tds: alloc[i.id]?.tds ?? "" } })} className={`${inputCls} w-28`} />
                                    <input type="number" min="0" placeholder="TDS" value={alloc[i.id]?.tds ?? ""} onChange={(e) => setAlloc({ ...alloc, [i.id]: { amount: alloc[i.id]?.amount ?? "", tds: e.target.value } })} className={`${inputCls} w-24`} />
                                </div>
                            ))}
                            {allocated > 0 && <p className="text-[11px] text-neutral-500 mt-1">Allocated {money(allocated)} of {money(Number(form.amount) || 0)} — {money(Math.max(0, (Number(form.amount) || 0) - allocated))} goes on account</p>}
                        </div>
                    )}
                    <button disabled={record.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Save receipt</button>
                </form>
            </ModalShell>
        </div>
    );
}
