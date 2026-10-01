"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, SectionCard } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { inputCls, useAct } from "@/components/finance/kit";

type S = Record<string, any>;

function Field({ label, value, onChange, type = "text", hint }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; hint?: string }) {
    return <label className="block text-xs font-bold text-neutral-600">{label}<input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />{hint && <span className="text-[10px] font-normal text-neutral-400">{hint}</span>}</label>;
}

function Form({ initial }: { initial: S }) {
    const { user } = useAuth();
    const [s, setS] = useState<S>(initial);
    const save = useAct("/api/finance/settings", "PATCH", ["finance-settings"], "Finance settings saved");
    const set = (k: string) => (v: string) => setS({ ...s, [k]: v });
    const setP = (k: string) => (v: string | boolean) => setS({ ...s, payroll: { ...s.payroll, [k]: v } });
    const num = ["gstRate", "defaultCreditDays", "reimbursementLimitInr", "invoiceApprovalThresholdInr", "vendorPaymentApprovalThresholdInr", "commissionTdsPct", "recruiterIncentivePct", "guaranteeDaysDefault", "creditHoldOverdueDays"];
    const submit = () => {
        const payload: S = { ...s };
        num.forEach((k) => { payload[k] = Number(s[k]); });
        payload.reminderDays = String(s.reminderDays).split(",").map((x) => Number(x.trim()));
        payload.payroll = { ...s.payroll, pfRatePct: Number(s.payroll.pfRatePct), pfWageCeiling: Number(s.payroll.pfWageCeiling), esiEmployeePct: Number(s.payroll.esiEmployeePct), esiEmployerPct: Number(s.payroll.esiEmployerPct), esiWageCeiling: Number(s.payroll.esiWageCeiling) };
        payload.expenseCategoryLimits = Object.fromEntries(String(s.categoryLimitsText ?? "").split(",").map((x) => x.split(":").map((y) => y.trim())).filter((p) => p[0] && Number(p[1]) > 0).map(([k, v]) => [k.toUpperCase(), Number(v)]));
        delete payload.categoryLimitsText;
        save.mutate(payload);
    };

    return (
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <SectionCard title="Company & tax">
                <div className="grid md:grid-cols-3 gap-4">
                    <Field label="Legal name" value={s.companyLegalName} onChange={set("companyLegalName")} />
                    <Field label="GSTIN" value={s.companyGstin} onChange={set("companyGstin")} />
                    <Field label="PAN" value={s.companyPan} onChange={set("companyPan")} />
                    <div className="md:col-span-2"><Field label="Registered address" value={s.companyAddress} onChange={set("companyAddress")} /></div>
                    <Field label="Home state code" value={s.companyStateCode} onChange={set("companyStateCode")} hint="Same-state clients → CGST+SGST" />
                    <Field label="GST rate %" value={s.gstRate} onChange={set("gstRate")} type="number" />
                    <Field label="SAC code" value={s.sacCode} onChange={set("sacCode")} hint="998512 = recruitment services" />
                    <Field label="LUT number (exports)" value={s.lutNumber} onChange={set("lutNumber")} />
                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-600"><input type="checkbox" checked={!!s.eInvoiceEnabled} onChange={(e) => setS({ ...s, eInvoiceEnabled: e.target.checked })} /> e-Invoicing applicable (capture IRN)</label>
                </div>
            </SectionCard>
            <SectionCard title="Numbering & terms" subtitle="Document numbers restart every financial year: PREFIX/2026-27/001">
                <div className="grid md:grid-cols-4 gap-4">
                    <Field label="Invoice prefix" value={s.invoicePrefix} onChange={set("invoicePrefix")} />
                    <Field label="Credit note prefix" value={s.creditNotePrefix} onChange={set("creditNotePrefix")} />
                    <Field label="Debit note prefix" value={s.debitNotePrefix} onChange={set("debitNotePrefix")} />
                    <Field label="Receipt prefix" value={s.receiptPrefix} onChange={set("receiptPrefix")} />
                    <Field label="Default credit days" value={s.defaultCreditDays} onChange={set("defaultCreditDays")} type="number" />
                    <Field label="Default guarantee days" value={s.guaranteeDaysDefault} onChange={set("guaranteeDaysDefault")} type="number" />
                    <Field label="Payment reminders (days vs due)" value={Array.isArray(s.reminderDays) ? s.reminderDays.join(", ") : s.reminderDays} onChange={set("reminderDays")} hint="-3 = 3 days before, 7 = 7 days after" />
                    <Field label="Credit hold after overdue (days)" value={s.creditHoldOverdueDays} onChange={set("creditHoldOverdueDays")} type="number" />
                </div>
            </SectionCard>
            <SectionCard title="Approvals & limits">
                <div className="grid md:grid-cols-3 gap-4">
                    <Field label="Invoice approval above (₹)" value={s.invoiceApprovalThresholdInr} onChange={set("invoiceApprovalThresholdInr")} type="number" hint="Maker-checker" />
                    <Field label="Vendor bill approval above (₹)" value={s.vendorPaymentApprovalThresholdInr} onChange={set("vendorPaymentApprovalThresholdInr")} type="number" />
                    <Field label="Reimbursement limit (₹)" value={s.reimbursementLimitInr} onChange={set("reimbursementLimitInr")} type="number" hint="Above → Super Admin approves" />
                    <div className="md:col-span-3"><Field label="Category limits (CATEGORY:amount, …)" value={s.categoryLimitsText ?? Object.entries(s.expenseCategoryLimits ?? {}).map(([k, v]) => `${k}:${v}`).join(", ")} onChange={set("categoryLimitsText")} hint="e.g. MEALS:5000, TRAVEL:20000" /></div>
                    <Field label="Commission TDS % (194H)" value={s.commissionTdsPct} onChange={set("commissionTdsPct")} type="number" />
                    <Field label="Recruiter incentive % of collected fee" value={s.recruiterIncentivePct} onChange={set("recruiterIncentivePct")} type="number" />
                </div>
            </SectionCard>
            <SectionCard title="Payroll statutory">
                <div className="grid md:grid-cols-4 gap-4">
                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-600"><input type="checkbox" checked={!!s.payroll.pfEnabled} onChange={(e) => setP("pfEnabled")(e.target.checked)} /> PF</label>
                    <Field label="PF rate %" value={s.payroll.pfRatePct} onChange={setP("pfRatePct")} type="number" />
                    <Field label="PF wage ceiling" value={s.payroll.pfWageCeiling} onChange={setP("pfWageCeiling")} type="number" />
                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-600"><input type="checkbox" checked={!!s.payroll.esiEnabled} onChange={(e) => setP("esiEnabled")(e.target.checked)} /> ESI</label>
                    <Field label="ESI employee %" value={s.payroll.esiEmployeePct} onChange={setP("esiEmployeePct")} type="number" />
                    <Field label="ESI employer %" value={s.payroll.esiEmployerPct} onChange={setP("esiEmployerPct")} type="number" />
                    <Field label="ESI gross ceiling" value={s.payroll.esiWageCeiling} onChange={setP("esiWageCeiling")} type="number" />
                    <label className="block text-xs font-bold text-neutral-600">Professional tax state<select value={s.payroll.ptState} onChange={(e) => setP("ptState")(e.target.value)} className={inputCls}><option value="MH">Maharashtra</option><option value="KA">Karnataka</option><option value="NONE">None</option></select></label>
                    <label className="block text-xs font-bold text-neutral-600">Default tax regime<select value={s.payroll.taxRegime} onChange={(e) => setP("taxRegime")(e.target.value)} className={inputCls}><option value="NEW">New</option><option value="OLD">Old</option></select></label>
                </div>
            </SectionCard>
            <SectionCard title="Bank accounts">
                <div className="space-y-2">
                    {(s.bankAccounts ?? []).map((b: S, i: number) => (
                        <div key={b.id ?? i} className="grid grid-cols-6 gap-2 items-center">
                            {["name", "bankName", "accountNumber", "ifsc", "openingBalance"].map((k) => <input key={k} value={b[k] ?? ""} placeholder={k} type={k === "openingBalance" ? "number" : "text"} onChange={(e) => setS({ ...s, bankAccounts: s.bankAccounts.map((x: S, j: number) => (j === i ? { ...x, [k]: e.target.value } : x)) })} className={inputCls} />)}
                            <label className="text-xs font-bold flex items-center gap-1"><input type="radio" name="defaultBank" checked={!!b.isDefault} onChange={() => setS({ ...s, bankAccounts: s.bankAccounts.map((x: S, j: number) => ({ ...x, isDefault: j === i })) })} /> default</label>
                        </div>
                    ))}
                    <button type="button" onClick={() => setS({ ...s, bankAccounts: [...(s.bankAccounts ?? []), { name: "", bankName: "", accountNumber: "", ifsc: "", openingBalance: 0, isDefault: false }] })} className="text-xs font-bold text-primary">+ Add bank account</button>
                </div>
                <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <Field label="Bank on invoices" value={s.bankName} onChange={set("bankName")} />
                    <Field label="Account no. on invoices" value={s.bankAccountNumber} onChange={set("bankAccountNumber")} />
                    <Field label="IFSC on invoices" value={s.bankIfsc} onChange={set("bankIfsc")} />
                </div>
            </SectionCard>
            <SectionCard title="Period close" subtitle="Lock the books up to a date — nothing on or before it can be created or changed">
                <div className="flex items-end gap-3">
                    <Field label="Books locked until" value={s.lockedUntil ?? ""} onChange={(v) => setS({ ...s, lockedUntil: v || null })} type="date" />
                    {s.lockedUntil && user?.role === "SUPER_ADMIN" && <button type="button" onClick={() => setS({ ...s, lockedUntil: null })} className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold">Reopen</button>}
                    <span className="text-[11px] text-neutral-400">Only the Super Admin can reopen or move the lock back.</span>
                </div>
            </SectionCard>
            <button disabled={save.isPending} className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save all settings</button>
        </form>
    );
}

export default function FinanceSettingsPage() {
    const { data } = useQuery<S>({ queryKey: ["finance-settings"], queryFn: () => api("/api/finance/settings") });
    return (
        <div className="space-y-6 max-w-5xl">
            <PageHeader title="Finance Settings" subtitle="Tax, numbering, approvals, statutory payroll, bank accounts and period close" />
            {data ? <Form key={JSON.stringify(data).length} initial={data} /> : <SkeletonPulse className="h-64 w-full" />}
        </div>
    );
}
