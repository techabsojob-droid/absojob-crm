"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt, Paperclip, Lock, FileText, Sparkles } from "lucide-react";
import { PageHeader, SectionCard, Badge } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { inputCls, money, uploadFile, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Proj { regime: string; gross: number; standardDeduction: number; deductions: number; lines: { label: string; amount: number }[]; taxableIncome: number; annualTax: number; monthlyTds: number }
interface Decl { regime: "OLD" | "NEW"; sec80C: number; sec80D: number; hraRentPaid: number; metroCity: boolean; homeLoanInterest: number; nps80CCD1B: number; otherDeductions: number; status: string; reviewNote?: string | null; reviewedByName?: string | null; proofs: { id: string; name: string; url: string }[] }
interface Data { fy: string; declaration: Decl | null; projection: { OLD: Proj; NEW: Proj; recommended: "OLD" | "NEW"; saving: number }; editable: boolean; form16Years: string[] }

const FIELDS: { key: keyof Decl; label: string; hint: string }[] = [
    { key: "sec80C", label: "80C investments", hint: "LIC, ELSS, PPF, tuition fees, home-loan principal (employee PF is added automatically) — max ₹1.5L" },
    { key: "sec80D", label: "80D health insurance", hint: "Premium for self, family and parents" },
    { key: "hraRentPaid", label: "Annual rent paid", hint: "For HRA exemption — attach rent receipts; landlord PAN needed above ₹1L" },
    { key: "homeLoanInterest", label: "Home loan interest 24(b)", hint: "Self-occupied property — max ₹2L" },
    { key: "nps80CCD1B", label: "NPS 80CCD(1B)", hint: "Additional NPS contribution — max ₹50,000" },
    { key: "otherDeductions", label: "Other (80E, 80G, 80TTA)", hint: "Education loan interest, donations, savings interest" },
];

export default function TaxPage() {
    const { data, isLoading } = useQuery<Data>({ queryKey: ["my-tax"], queryFn: () => api("/api/portal/tax") });
    const [f, setF] = useState<Record<string, string | boolean>>({ regime: "NEW", metroCity: false });
    const [proofs, setProofs] = useState<{ id: string; name: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const save = useAct<{ declaration: { status: string } }>("/api/portal/tax", "PUT", ["my-tax", "portal-dashboard"], (r) => r.declaration.status === "SUBMITTED" ? "Declaration submitted for verification" : "Draft saved");

    useEffect(() => {
        if (!data) return;
        const d = data.declaration;
        setF({ regime: d?.regime ?? data.projection.recommended, metroCity: d?.metroCity ?? false, ...Object.fromEntries(FIELDS.map((x) => [x.key, d ? String(d[x.key] || "") : ""])) });
        setProofs(d?.proofs ?? []);
    }, [data]);

    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const d = data.declaration;
    const p = data.projection;
    const payload = (submit: boolean) => ({ fy: data.fy, regime: f.regime, metroCity: !!f.metroCity, ...Object.fromEntries(FIELDS.map((x) => [x.key, Number(f[x.key as string]) || 0])), proofFileIds: proofs.map((x) => x.id), submit });

    return (
        <div className="space-y-6 max-w-5xl">
            <PageHeader title="Tax Declaration & Form 16" subtitle={`Financial year ${data.fy} — your declaration decides the TDS deducted from salary`} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["NEW", "OLD"] as const).map((r) => (
                    <div key={r} className={`rounded-2xl border p-5 ${f.regime === r ? "border-primary bg-primary/5" : "border-neutral-200 bg-white"}`}>
                        <div className="flex items-center justify-between"><p className="font-extrabold">{r === "NEW" ? "New regime" : "Old regime"}</p>{p.recommended === r && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1"><Sparkles size={10} /> Saves {money(p.saving)}</span>}</div>
                        <p className="text-2xl font-extrabold mt-2">{money(p[r].annualTax)}<span className="text-xs font-bold text-neutral-400"> / year</span></p>
                        <p className="text-xs text-neutral-500">≈ {money(p[r].monthlyTds)} TDS per month · taxable {money(p[r].taxableIncome)}</p>
                        <p className="text-[11px] text-neutral-400 mt-1">Standard deduction {money(p[r].standardDeduction)}{p[r].deductions ? ` + deductions ${money(p[r].deductions)}` : ""}</p>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-neutral-400 -mt-3">Projection uses your current salary structure and the amounts below. Final tax depends on actual income for the year.</p>

            <SectionCard title="My declaration" action={d ? <Badge value={d.status} /> : <Badge value="PENDING" label="Not submitted" />}>
                {d?.status === "REJECTED" && <p className="mb-3 text-xs rounded-xl bg-rose-50 text-rose-700 p-3">Sent back by {d.reviewedByName}: {d.reviewNote}</p>}
                {d?.status === "VERIFIED" && <p className="mb-3 text-xs rounded-xl bg-emerald-50 text-emerald-800 p-3 flex items-center gap-1.5"><Lock size={12} /> Verified by {d.reviewedByName} — locked for this year. Contact HR for changes.</p>}
                <form className="space-y-4 text-sm" onSubmit={(e) => { e.preventDefault(); save.mutate(payload(true)); }}>
                    <fieldset disabled={!data.editable} className="space-y-4">
                        <div className="flex gap-2">{(["NEW", "OLD"] as const).map((r) => <label key={r} className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${f.regime === r ? "border-primary bg-primary text-white" : "border-neutral-200"}`}><input type="radio" className="hidden" checked={f.regime === r} onChange={() => setF({ ...f, regime: r })} />{r === "NEW" ? "New regime" : "Old regime"}</label>)}</div>
                        {f.regime === "OLD" ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {FIELDS.map((x) => <label key={x.key} className="text-xs font-bold text-neutral-600">{x.label}<input type="number" min="0" value={String(f[x.key] ?? "")} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} className={inputCls} placeholder="₹ 0" /><span className="block font-normal text-[10px] text-neutral-400 mt-0.5">{x.hint}</span></label>)}
                                <label className="text-xs font-semibold flex items-center gap-2"><input type="checkbox" checked={!!f.metroCity} onChange={(e) => setF({ ...f, metroCity: e.target.checked })} /> I live in a metro (Delhi, Mumbai, Kolkata, Chennai)</label>
                            </div>
                        ) : <p className="text-xs text-neutral-500">Under the new regime most deductions don&apos;t apply — only the ₹75,000 standard deduction. Nothing else to declare.</p>}
                        {f.regime === "OLD" && (
                            <div>
                                <p className="text-xs font-bold text-neutral-600 mb-1">Proofs</p>
                                <div className="flex flex-wrap gap-2">
                                    {proofs.map((x) => <span key={x.id} className="text-[11px] px-2 py-1 rounded-lg bg-neutral-100 flex items-center gap-1"><FileText size={11} />{x.name}<button type="button" onClick={() => setProofs(proofs.filter((y) => y.id !== x.id))} className="text-rose-600 ml-1" aria-label="Remove">×</button></span>)}
                                    <label className="text-[11px] px-2 py-1 rounded-lg border border-dashed border-neutral-300 cursor-pointer flex items-center gap-1"><Paperclip size={11} /> {uploading ? "Uploading…" : "Add proof"}<input type="file" hidden accept="application/pdf,image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); try { const up = await uploadFile(file, "tax-proof"); setProofs((l) => [...l, { id: up.id, name: up.name }]); } catch (err) { toast.error((err as Error).message); } finally { setUploading(false); } }} /></label>
                                </div>
                            </div>
                        )}
                    </fieldset>
                    {data.editable && (
                        <div className="flex gap-2">
                            <button type="button" disabled={save.isPending} onClick={() => save.mutate(payload(false))} className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold">Save draft</button>
                            <button disabled={save.isPending || uploading} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit for verification</button>
                        </div>
                    )}
                </form>
            </SectionCard>

            <SectionCard title="Form 16" subtitle="Issued from paid salary — Part B summary">
                {data.form16Years.length === 0 ? <p className="text-xs text-neutral-400">Available once salary has been paid in a financial year.</p> : (
                    <div className="flex flex-wrap gap-2">{data.form16Years.map((fy) => <Link key={fy} href={`/portal/tax/form16/${fy}`} className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-50"><Receipt size={13} /> FY {fy}</Link>)}</div>
                )}
            </SectionCard>
        </div>
    );
}
