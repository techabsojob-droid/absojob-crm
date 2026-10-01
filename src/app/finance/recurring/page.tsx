"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Repeat, Plus } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, inputCls, money, useAct } from "@/components/finance/kit";

interface Rec { id: string; clientId: string; clientName: string; description: string; amount: number; frequency: string; nextDate: string; endDate?: string | null; autoSend: boolean; active: boolean }

export default function RecurringPage() {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ clientId: "", description: "", amount: "", frequency: "MONTHLY", nextDate: "", endDate: "", autoSend: false });
    const { data = [] } = useQuery<Rec[]>({ queryKey: ["finance-recurring"], queryFn: () => api("/api/finance/recurring") });
    const { data: clients = [] } = useQuery<{ id: string; companyName: string }[]>({ queryKey: ["finance-clients"], queryFn: () => api("/api/finance/clients") });
    const create = useAct<{ generated: number }>("/api/finance/recurring", "POST", ["finance-recurring", "finance-invoices"], (r) => `Schedule saved${r.generated ? ` · ${r.generated} invoice(s) generated` : ""}`);
    const update = useAct("/api/finance/recurring", "PATCH", ["finance-recurring"], "Schedule updated");

    return (
        <div className="space-y-6">
            <PageHeader title="Recurring Invoices" subtitle="Retainers & RPO fees billed automatically on schedule (drafts, or sent directly when auto-send is on)" action={<button onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"><Plus size={15} /> New schedule</button>} />
            <SectionCard>
                {data.length === 0 ? <EmptyState icon={Repeat} message="No recurring schedules." /> : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.map((r) => (
                            <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{r.clientName} · {r.description}</p>
                                    <p className="text-[11px] text-neutral-500">{money(r.amount)} + GST · {r.frequency.toLowerCase()} · next {r.nextDate}{r.endDate ? ` · ends ${r.endDate}` : ""} · {r.autoSend ? "auto-send" : "creates draft"}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge value={r.active ? "ACTIVE" : "PAUSED"} />
                                    <button onClick={() => update.mutate({ id: r.id, active: !r.active })} className={btn.ghost}>{r.active ? "Pause" : "Resume"}</button>
                                    <button onClick={() => update.mutate({ id: r.id, autoSend: !r.autoSend })} className={btn.ghost}>{r.autoSend ? "Draft only" : "Auto-send"}</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
            <ModalShell open={open} onClose={() => setOpen(false)} title="New recurring invoice">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate({ ...form, amount: Number(form.amount), endDate: form.endDate || null, nextDate: form.nextDate || undefined }, { onSuccess: () => setOpen(false) }); }}>
                    <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={inputCls}><option value="">Client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>
                    <input required placeholder="Description (e.g. RPO retainer)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
                    <div className="grid grid-cols-2 gap-3">
                        <input required type="number" min="1" placeholder="Amount (pre-GST)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
                        <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className={inputCls}><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option></select>
                        <label className="text-xs font-bold text-neutral-500">First invoice<input type="date" value={form.nextDate} onChange={(e) => setForm({ ...form, nextDate: e.target.value })} className={inputCls} /></label>
                        <label className="text-xs font-bold text-neutral-500">End (optional)<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputCls} /></label>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.autoSend} onChange={(e) => setForm({ ...form, autoSend: e.target.checked })} /> Email invoices automatically</label>
                    <button disabled={create.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save schedule</button>
                </form>
            </ModalShell>
        </div>
    );
}
