"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Receipt, AlertTriangle, Clock, Lock } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, inputCls, money, useAct } from "@/components/finance/kit";

interface Item { key: string; type: string; clientId: string; clientName: string; description: string; amount: number; basis: string; date: string; recruiterName?: string; currency: string; creditHold: boolean }
interface Plc { id: string; candidateName: string; clientName: string; jobTitle: string; joiningDate: string; joiningStatus: string; replacementStatus: string; guaranteeEndDate: string; fee: number; invoiceNumber?: string | null; invoice?: { id: string; invoiceNumber: string } | null }

const TYPE_LABEL: Record<string, string> = { PLACEMENT: "Placement", OFFER_MILESTONE: "Offer milestone", TIMESHEET: "Timesheet", REBILL_EXPENSE: "Re-bill expense" };

export default function BillingQueuePage() {
    const { data } = useQuery<{ items: Item[]; atRisk: Plc[]; pendingJoin: Plc[] }>({ queryKey: ["finance-billing"], queryFn: () => api("/api/finance/billing-queue") });
    const [selected, setSelected] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const [send, setSend] = useState(true);
    const [fx, setFx] = useState("");
    const [overrides, setOverrides] = useState<Record<string, string>>({});

    const items = data?.items ?? [];
    const byClient = useMemo(() => {
        const m = new Map<string, Item[]>();
        items.forEach((i) => m.set(i.clientId, [...(m.get(i.clientId) ?? []), i]));
        return Array.from(m.values());
    }, [items]);
    const picked = items.filter((i) => selected.includes(i.key));
    const pickedClient = picked[0]?.clientId;
    const currency = picked[0]?.currency ?? "INR";

    const bill = useAct<{ invoiceNumber: string; status: string }>("/api/finance/billing-queue", "POST", ["finance-billing", "finance-dashboard", "finance-invoices"], (inv) => `${inv.invoiceNumber} ${inv.status === "PENDING_APPROVAL" ? "sent for approval" : inv.status === "DRAFT" ? "saved as draft" : "raised and emailed"}`);
    const credit = useAct("/api/finance/invoices", "PATCH", ["finance-billing"], "Credit note issued");

    const toggle = (i: Item) => {
        if (pickedClient && i.clientId !== pickedClient) return setSelected([i.key]);
        setSelected((s) => (s.includes(i.key) ? s.filter((k) => k !== i.key) : [...s, i.key]));
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Billing Queue"
                subtitle="Everything billable — joined placements, offer milestones (split billing), approved timesheets and re-billable expenses. Select items of one client to bill them on a single invoice."
                action={picked.length > 0 && (
                    <button onClick={() => { setOpen(true); setOverrides({}); setFx(""); }} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs">
                        Invoice {picked.length} item(s) · {money(picked.reduce((s, p) => s + (Number(overrides[p.key]) || p.amount), 0))}
                    </button>
                )}
            />

            {byClient.length === 0 ? <SectionCard><EmptyState icon={Receipt} message="Nothing waiting to be billed." /></SectionCard> : byClient.map((list) => (
                <SectionCard key={list[0].clientId} title={list[0].clientName} subtitle={`${list.length} item(s) · ${money(list.reduce((s, i) => s + i.amount, 0))}${list[0].currency !== "INR" ? ` · bills in ${list[0].currency}` : ""}`}
                    action={list[0].creditHold ? <span className="text-xs font-bold text-rose-700 flex items-center gap-1"><Lock size={12} /> Credit hold</span> : <button onClick={() => setSelected(list.map((i) => i.key))} className="text-xs font-bold text-primary">Select all</button>}>
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {list.map((i) => (
                            <li key={i.key} className="py-2.5 flex items-center gap-3">
                                <input type="checkbox" checked={selected.includes(i.key)} onChange={() => toggle(i)} aria-label={`Select ${i.description}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{i.description}</p>
                                    <p className="text-[11px] text-neutral-500"><Badge value={i.type} label={TYPE_LABEL[i.type]} /> {i.basis}{i.recruiterName ? ` · ${i.recruiterName}` : ""} · {i.date}</p>
                                </div>
                                <span className="font-mono font-bold">{money(i.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            ))}

            <SectionCard title={`Billed placements at risk (${data?.atRisk.length ?? 0})`} subtitle="No-show, cancelled or replacement requested inside the guarantee period — incentives are cancelled / clawed back automatically">
                {!data?.atRisk.length ? <EmptyState icon={AlertTriangle} message="No billed placement has fallen through." /> : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.atRisk.map((p) => (
                            <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{p.candidateName} · {p.clientName}</p>
                                    <p className="text-[11px] text-neutral-500">{p.jobTitle} · guarantee till {p.guaranteeEndDate} · <Badge value={p.joiningStatus} /> <Badge value={p.replacementStatus} /></p>
                                </div>
                                {p.invoice ? (
                                    <div className="flex items-center gap-2">
                                        <Link href={`/finance/invoices?id=${p.invoice.id}`} className="text-xs font-bold text-primary">{p.invoice.invoiceNumber}</Link>
                                        <button onClick={() => { const reason = window.prompt("Credit note reason", `${p.candidateName} left within guarantee`); if (reason) credit.mutate({ id: p.invoice!.id, action: "credit_note", reason }); }} className={btn.danger}>Issue credit note</button>
                                    </div>
                                ) : <span className="text-xs text-neutral-400">{p.invoiceNumber}</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <SectionCard title={`Joining pending (${data?.pendingJoin.length ?? 0})`} subtitle="Billable once the candidate joins">
                {!data?.pendingJoin.length ? <EmptyState icon={Clock} message="No pending joiners." /> : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.pendingJoin.map((p) => <li key={p.id} className="py-2.5 flex justify-between"><span>{p.candidateName} · {p.clientName} <span className="text-neutral-400">({p.jobTitle})</span></span><span className="text-neutral-500">joins {p.joiningDate} · est. {money(p.fee)}</span></li>)}
                    </ul>
                )}
            </SectionCard>

            <ModalShell open={open} onClose={() => setOpen(false)} title={`Invoice ${picked[0]?.clientName ?? ""}`} wide>
                <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); bill.mutate({ keys: selected, send, fxRate: fx ? Number(fx) : undefined, overrides: Object.fromEntries(Object.entries(overrides).filter(([, v]) => v).map(([k, v]) => [k, Number(v)])) }, { onSuccess: () => { setOpen(false); setSelected([]); } }); }}>
                    {picked.map((p) => (
                        <div key={p.key} className="flex items-center gap-2">
                            <span className="flex-1 min-w-0 truncate text-neutral-700">{p.description}</span>
                            <input type="number" min="1" placeholder={String(p.amount)} value={overrides[p.key] ?? ""} onChange={(e) => setOverrides({ ...overrides, [p.key]: e.target.value })} className={`${inputCls} w-36`} title="Override amount (INR, pre-GST)" />
                        </div>
                    ))}
                    {currency !== "INR" && (
                        <label className="block text-xs font-bold text-neutral-600">{currency} → INR exchange rate *
                            <input required type="number" step="0.0001" min="0.0001" value={fx} onChange={(e) => setFx(e.target.value)} className={inputCls} />
                        </label>
                    )}
                    <p className="text-[11px] text-neutral-400">GST (CGST+SGST or IGST, or zero-rated for exports) and due date follow the client&apos;s billing profile. Invoices above the approval limit go to a second approver.</p>
                    <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} /> Send to client now (email)</label>
                    <button disabled={bill.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">{send ? "Raise & send invoice" : "Save draft"}</button>
                </form>
            </ModalShell>
        </div>
    );
}
