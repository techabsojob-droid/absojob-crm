"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Upload, FileText } from "lucide-react";
import { SectionCard, Badge } from "@/components/shared/ui";
import { fileToPayload, inputCls, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Data {
    payee: { pan: string | null; bankName: string | null; account: string | null; bankIfsc: string | null; upiId: string | null } | null;
    kyc: { status: string; note: string | null; pan: string | null; idProofUrl: string | null; city: string; specialization: string[]; experienceYears: number; sourcingChannels: string[]; verifiedAt: string | null; agreementAcceptedAt: string } | null;
}

/** Partner KYC status + self-service payout details (PAN, bank / UPI, ID proof). */
export default function PayoutKyc() {
    const { data } = useQuery<Data>({ queryKey: ["portal-payee"], queryFn: () => api("/api/portal/payee") });
    const [f, setF] = useState<Record<string, string>>({});
    const [idProof, setIdProof] = useState<File | null>(null);
    const save = useAct<{ changed: string[]; kycStatus: string | null }>("/api/portal/payee", "PATCH", ["portal-payee", "portal-dashboard", "portal-incentives"], (r) => r.changed.length ? `Updated ${r.changed.join(", ")}${r.kycStatus === "PENDING" ? " — sent for KYC verification" : ""}` : "No changes");
    if (!data) return null;
    const k = data.kyc;
    const val = (key: string, fallback: string | null | undefined) => f[key] ?? fallback ?? "";

    return (
        <div className="space-y-6">
            {k && (
                <SectionCard title="KYC status" action={<Badge value={k.status} />}>
                    <div className="flex items-start gap-3 text-sm">
                        {k.status === "VERIFIED" ? <ShieldCheck className="text-emerald-600 shrink-0" /> : <ShieldAlert className="text-amber-600 shrink-0" />}
                        <div>
                            <p className="font-semibold">{k.status === "VERIFIED" ? `Verified on ${k.verifiedAt?.slice(0, 10)} — payouts are enabled.` : k.status === "REJECTED" ? "Your KYC was sent back — payouts are on hold until it is verified." : "Under verification by the talent team — payouts start once verified."}</p>
                            {k.note && <p className="text-xs text-rose-600 mt-1">Reason: {k.note}</p>}
                            <p className="text-xs text-neutral-500 mt-1">PAN {k.pan ?? "not provided"} · {k.idProofUrl ? <a href={k.idProofUrl} target="_blank" rel="noopener" className="text-primary font-bold inline-flex items-center gap-1"><FileText size={11} /> ID proof</a> : "no ID proof"} · agreement accepted {k.agreementAcceptedAt.slice(0, 10)}</p>
                        </div>
                    </div>
                </SectionCard>
            )}
            <SectionCard title="Payout details" subtitle="Changing PAN or ID proof sends your KYC for re-verification; bank changes are confirmed by Finance before the next payout">
                <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm" onSubmit={async (e) => {
                    e.preventDefault();
                    let proof;
                    try { proof = idProof ? await fileToPayload(idProof) : undefined; } catch (err) { alert((err as Error).message); return; }
                    save.mutate({ ...f, idProof: proof, resubmit: k?.status === "REJECTED" }, { onSuccess: () => { setF({}); setIdProof(null); } });
                }}>
                    <label className="text-xs font-bold text-neutral-600">PAN<input value={val("pan", data.payee?.pan ?? k?.pan)} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} maxLength={10} className={`${inputCls} uppercase`} /></label>
                    <label className="text-xs font-bold text-neutral-600">UPI ID<input value={val("upiId", data.payee?.upiId)} onChange={(e) => setF({ ...f, upiId: e.target.value })} className={inputCls} placeholder="name@bank" /></label>
                    <label className="text-xs font-bold text-neutral-600">Bank name<input value={val("bankName", data.payee?.bankName)} onChange={(e) => setF({ ...f, bankName: e.target.value })} className={inputCls} /></label>
                    <label className="text-xs font-bold text-neutral-600">Account number<input value={f.bankAccountNumber ?? ""} onChange={(e) => setF({ ...f, bankAccountNumber: e.target.value })} placeholder={data.payee?.account ?? ""} inputMode="numeric" className={inputCls} /></label>
                    <label className="text-xs font-bold text-neutral-600">IFSC<input value={val("bankIfsc", data.payee?.bankIfsc)} onChange={(e) => setF({ ...f, bankIfsc: e.target.value.toUpperCase() })} maxLength={11} className={`${inputCls} uppercase`} /></label>
                    {k && (
                        <label className="text-xs font-bold text-neutral-600">ID proof (PDF / image)
                            <span className={`${inputCls} flex items-center gap-2 cursor-pointer font-normal`}><Upload size={14} className="text-neutral-400" /><span className="truncate">{idProof ? idProof.name : "Upload new"}</span><input type="file" accept=".pdf,image/*" hidden onChange={(e) => setIdProof(e.target.files?.[0] ?? null)} /></span>
                        </label>
                    )}
                    {k && <label className="text-xs font-bold text-neutral-600 sm:col-span-2">Industries you hire for<input value={val("specialization", k.specialization.join(", "))} onChange={(e) => setF({ ...f, specialization: e.target.value })} className={inputCls} /></label>}
                    <button disabled={save.isPending || (!Object.keys(f).length && !idProof && k?.status !== "REJECTED")} className="sm:col-span-2 py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">{k?.status === "REJECTED" ? "Save & resubmit KYC" : "Save"}</button>
                </form>
            </SectionCard>
        </div>
    );
}
