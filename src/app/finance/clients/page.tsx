"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Lock } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { btn, inputCls, money, useAct } from "@/components/finance/kit";

interface Billing { gstin?: string | null; pan?: string | null; billingAddress?: string | null; stateCode?: string | null; country: string; currency: string; billingEmails: string[]; feeModel: string; feePercent?: number | null; flatFee?: number | null; feeSlabs?: { uptoLpa: number; percent: number }[]; splitOnOfferPct: number; guaranteeDays: number; creditLimit?: number | null }
interface Row { id: string; companyName: string; status: string; contactPerson: string; commissionRate: number; creditDays: number; billing: Billing; creditHold: boolean; creditReasons: string[]; accountManagerName: string | null; invoices: number; billed: number; collected: number; outstanding: number; overdue: number; placements: number; unbilled: number }

export default function ClientBillingPage() {
    const { data = [] } = useQuery<Row[]>({ queryKey: ["finance-clients"], queryFn: () => api("/api/finance/clients") });
    const [edit, setEdit] = useState<Row | null>(null);
    const [f, setF] = useState<Record<string, string>>({});
    const save = useAct("/api/finance/clients", "PATCH", ["finance-clients", "finance-billing"], "Billing profile saved");

    const openEdit = (c: Row) => {
        setEdit(c);
        setF({
            gstin: c.billing.gstin ?? "", stateCode: c.billing.stateCode ?? "", billingAddress: c.billing.billingAddress ?? "", country: c.billing.country, currency: c.billing.currency,
            billingEmails: c.billing.billingEmails.join(", "), feeModel: c.billing.feeModel, commissionRate: String(c.billing.feePercent ?? c.commissionRate), flatFee: String(c.billing.flatFee ?? ""),
            feeSlabs: (c.billing.feeSlabs ?? []).map((s) => `${s.uptoLpa}:${s.percent}`).join(", "), splitOnOfferPct: String(c.billing.splitOnOfferPct), guaranteeDays: String(c.billing.guaranteeDays),
            creditDays: String(c.creditDays), creditLimit: String(c.billing.creditLimit ?? ""),
        });
    };
    const submit = () => {
        if (!edit) return;
        save.mutate({
            id: edit.id, gstin: f.gstin, stateCode: f.stateCode || undefined, billingAddress: f.billingAddress, country: f.country, currency: f.currency, billingEmails: f.billingEmails,
            feeModel: f.feeModel, commissionRate: Number(f.commissionRate), flatFee: f.flatFee ? Number(f.flatFee) : null,
            feeSlabs: f.feeSlabs ? f.feeSlabs.split(",").map((s) => { const [u, p] = s.split(":"); return { uptoLpa: Number(u), percent: Number(p) }; }) : [],
            splitOnOfferPct: Number(f.splitOnOfferPct) || 0, guaranteeDays: Number(f.guaranteeDays), creditDays: Number(f.creditDays), creditLimit: f.creditLimit ? Number(f.creditLimit) : 0,
        }, { onSuccess: () => setEdit(null) });
    };
    const field = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
        <label className="block text-xs font-bold text-neutral-600">{label}<input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inputCls} {...props} /></label>
    );

    return (
        <div className="space-y-6">
            <PageHeader title="Client Billing" subtitle="GST registration, fee model, split billing, guarantee, credit terms and balances" />
            <SectionCard title={`${data.length} clients`}>
                {data.length === 0 ? <EmptyState icon={Building2} message="No clients." /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Client</th><th>Fee model</th><th>Terms</th><th className="text-right">Billed</th><th className="text-right">Outstanding</th><th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {data.map((c) => (
                                    <tr key={c.id} className="align-top">
                                        <td className="py-3">
                                            <span className="font-semibold">{c.companyName}</span> <Badge value={c.status} />
                                            {c.creditHold && <span className="ml-1 text-[10px] font-bold text-rose-700 inline-flex items-center gap-0.5"><Lock size={10} /> CREDIT HOLD</span>}
                                            <span className="block text-[11px] text-neutral-500">GSTIN {c.billing.gstin || "—"} · state {c.billing.stateCode} · {c.billing.currency}{c.accountManagerName ? ` · AM ${c.accountManagerName}` : ""}</span>
                                            {c.creditReasons.length > 0 && <span className="block text-[11px] text-rose-600">{c.creditReasons.join("; ")}</span>}
                                        </td>
                                        <td className="text-xs">{c.billing.feeModel === "FLAT" ? `Flat ${money(c.billing.flatFee)}` : c.billing.feeModel === "SLAB" ? `Slabs: ${(c.billing.feeSlabs ?? []).map((s) => `≤${s.uptoLpa}L ${s.percent}%`).join(", ")}` : `${c.billing.feePercent ?? c.commissionRate}% of CTC`}{c.billing.splitOnOfferPct ? <span className="block text-neutral-500">{c.billing.splitOnOfferPct}% on offer</span> : null}</td>
                                        <td className="text-xs">{c.creditDays}d credit<span className="block text-neutral-500">{c.billing.guaranteeDays}d guarantee{c.billing.creditLimit ? ` · limit ${money(c.billing.creditLimit)}` : ""}</span></td>
                                        <td className="text-right font-mono">{money(c.billed)}</td>
                                        <td className="text-right font-mono font-bold">{money(c.outstanding)}{c.overdue > 0 && <span className="block text-[11px] text-rose-600">{money(c.overdue)} overdue</span>}{c.unbilled > 0 && <Link href="/finance/billing" className="block text-[11px] text-amber-700 font-bold">{c.unbilled} to bill</Link>}</td>
                                        <td className="text-right space-y-1 whitespace-nowrap"><button onClick={() => openEdit(c)} className={btn.soft}>Billing profile</button><Link href={`/finance/statement?clientId=${c.id}`} className={`${btn.ghost} block text-center`}>Statement</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <ModalShell open={!!edit} onClose={() => setEdit(null)} title={edit ? `${edit.companyName} — billing profile` : ""} wide>
                <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                    {field("gstin", "GSTIN (sets state & PAN)", { placeholder: "27AABCA1234F1Z5" })}
                    {field("stateCode", "State code", { placeholder: "27" })}
                    <div className="col-span-2">{field("billingAddress", "Billing address")}</div>
                    {field("country", "Country")}
                    <label className="block text-xs font-bold text-neutral-600">Billing currency<select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={inputCls}>{["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => <option key={c}>{c}</option>)}</select></label>
                    <div className="col-span-2">{field("billingEmails", "Billing emails (comma-separated)")}</div>
                    <label className="block text-xs font-bold text-neutral-600">Fee model<select value={f.feeModel} onChange={(e) => setF({ ...f, feeModel: e.target.value })} className={inputCls}><option value="PERCENT">% of CTC</option><option value="FLAT">Flat fee</option><option value="SLAB">CTC slabs</option></select></label>
                    {f.feeModel === "PERCENT" && field("commissionRate", "Commission %", { type: "number", step: "0.01" })}
                    {f.feeModel === "FLAT" && field("flatFee", "Flat fee (₹)", { type: "number" })}
                    {f.feeModel === "SLAB" && field("feeSlabs", "Slabs uptoLpa:percent", { placeholder: "10:8.33, 25:10, 999:12" })}
                    {field("splitOnOfferPct", "% billed on offer acceptance", { type: "number" })}
                    {field("guaranteeDays", "Replacement guarantee (days)", { type: "number" })}
                    {field("creditDays", "Credit period (days)", { type: "number" })}
                    {field("creditLimit", "Credit limit (₹, blank = none)", { type: "number" })}
                    <p className="col-span-2 text-[11px] text-neutral-400">Same-state GSTIN → CGST+SGST; other state → IGST; foreign country or non-INR currency → zero-rated export under LUT. Clients over their credit limit or with invoices overdue beyond the configured days go on credit hold (new requisitions blocked).</p>
                    <button disabled={save.isPending} className="col-span-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save profile</button>
                </form>
            </ModalShell>
        </div>
    );
}
