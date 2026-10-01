"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark, FileText } from "lucide-react";
import { PageHeader, SectionCard, Badge, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, money, Tabs, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Row { id: string; employeeName: string; employeeCode: string; fy: string; regime: string; status: string; sec80C: number; sec80D: number; hraRentPaid: number; homeLoanInterest: number; nps80CCD1B: number; otherDeductions: number; submittedAt: string | null; reviewNote: string | null; reviewedByName: string | null; projection: { annualTax: number; monthlyTds: number; deductions: number } | null; proofs: { id: string; name: string; url: string }[] }

export default function TaxDeclarationsPage() {
    const [status, setStatus] = useState<"SUBMITTED" | "ALL">("SUBMITTED");
    const { data, isLoading } = useQuery<Row[]>({ queryKey: ["hr-tax-decl", status], queryFn: () => api(`/api/hr/tax-declarations?status=${status}`) });
    const act = useAct<{ status: string }>("/api/hr/tax-declarations", "PATCH", ["hr-tax-decl"], (r) => `Declaration ${r.status.toLowerCase()}`);
    return (
        <div className="space-y-6">
            <PageHeader title="Tax Declarations" subtitle="Verify employees' investment declarations and proofs — verified declarations drive payroll TDS" />
            <Tabs tabs={[{ id: "SUBMITTED", label: "Awaiting verification" }, { id: "ALL", label: "All" }]} value={status} onChange={setStatus} />
            <SectionCard>
                {isLoading || !data ? <SkeletonPulse className="h-40 w-full" /> : data.length === 0 ? <EmptyState icon={Landmark} message="Nothing to verify." /> : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.map((d) => (
                            <li key={d.id} className="py-3.5 flex items-start justify-between gap-4">
                                <div className="space-y-0.5">
                                    <p className="font-bold">{d.employeeName} <span className="text-neutral-400 font-normal">{d.employeeCode} · FY {d.fy} · {d.regime} regime</span></p>
                                    {d.regime === "OLD" && <p className="text-xs text-neutral-600">80C {money(d.sec80C)} · 80D {money(d.sec80D)} · rent {money(d.hraRentPaid)} · 24(b) {money(d.homeLoanInterest)} · NPS {money(d.nps80CCD1B)} · other {money(d.otherDeductions)}</p>}
                                    {d.projection && <p className="text-xs text-neutral-500">Projected tax {money(d.projection.annualTax)} / yr · TDS {money(d.projection.monthlyTds)} / month</p>}
                                    <div className="flex flex-wrap gap-2 pt-0.5">{d.proofs.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noopener" className="text-[11px] font-bold text-primary flex items-center gap-1"><FileText size={10} />{p.name}</a>)}{d.regime === "OLD" && !d.proofs.length && <span className="text-[11px] text-amber-700">No proofs attached</span>}</div>
                                    {d.reviewNote && <p className="text-[11px] text-neutral-500">{d.reviewedByName}: {d.reviewNote}</p>}
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <Badge value={d.status} />
                                    {d.status === "SUBMITTED" && <div className="flex gap-1.5"><button disabled={act.isPending} onClick={() => act.mutate({ id: d.id, action: "verify" })} className={btn.good}>Verify</button><button disabled={act.isPending} onClick={() => { const note = window.prompt("What should the employee fix?"); if (note) act.mutate({ id: d.id, action: "reject", note }); }} className={btn.danger}>Send back</button></div>}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </div>
    );
}
