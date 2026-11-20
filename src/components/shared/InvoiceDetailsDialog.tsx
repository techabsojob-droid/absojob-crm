"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ModalShell } from "@/components/shared/ui";
import { inputCls } from "@/components/finance/kit";
import { api } from "@/lib/api";
import { EMPLOYEE_TYPES, invoiceTat, missingInvoiceDetails } from "@/lib/invoicing-details";

export interface InvoiceDetailsInput {
    placementId: string;
    candidateName: string;
    employeeCode?: string | null;
    workLocation?: string | null;
    joiningDate: string;
    offeredPosition: string;
    grade?: string | null;
    offeredSalaryLpa: number;
    employeeType?: string | null;
    /** Invoice number if already billed: joining date, designation and CTC are then locked. */
    invoiceNumber?: string | null;
    feeInr?: number | null;
}

/** Candidate information for invoicing: the ten details the client needs for each joined candidate. */
export default function InvoiceDetailsDialog({ p, onClose }: { p: InvoiceDetailsInput; onClose: () => void }) {
    const qc = useQueryClient();
    const [f, setF] = useState({
        employeeCode: p.employeeCode ?? "", workLocation: p.workLocation ?? "", joiningDate: (p.joiningDate ?? "").slice(0, 10),
        offeredPosition: p.offeredPosition ?? "", grade: p.grade ?? "", offeredSalaryLpa: p.offeredSalaryLpa ? String(p.offeredSalaryLpa) : "",
        employeeType: p.employeeType ?? "",
    });
    const [saving, setSaving] = useState(false);
    const locked = !!p.invoiceNumber;
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
    const missing = missingInvoiceDetails({ ...f, offeredSalaryLpa: Number(f.offeredSalaryLpa), employeeType: f.employeeType as "FLS" | "NFLS" });
    const tat = invoiceTat(f.joiningDate, null);
    const lbl = "block text-[12px] font-medium text-neutral-600 space-y-1";

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api("/api/admin/placements", "PATCH", {
                id: p.placementId,
                invoiceDetails: {
                    employeeCode: f.employeeCode, workLocation: f.workLocation, grade: f.grade, employeeType: f.employeeType || null,
                    ...(locked ? {} : { joiningDate: f.joiningDate, offeredPosition: f.offeredPosition, offeredSalaryLpa: Number(f.offeredSalaryLpa) }),
                },
            });
            toast.success(missing.length ? `Saved. Still needed for invoicing: ${missing.join(", ")}` : "Invoicing details complete");
            ["finance-billing", "admin-placements", "placements"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
            onClose();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title={`Invoicing details · ${p.candidateName}`} onClose={onClose} wide>
            <form onSubmit={save} className="space-y-4 text-sm">
                <p className="text-xs text-neutral-500">The client needs these for each joined candidate. All are required before the placement can be invoiced.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={lbl}>1. Candidate name<input value={p.candidateName} disabled className={`${inputCls} bg-neutral-50`} /></label>
                    <label className={lbl}>2. Employee code *<input autoFocus maxLength={60} value={f.employeeCode} onChange={set("employeeCode")} className={inputCls} placeholder="Client's employee ID, e.g. EMP10234" /></label>
                    <label className={lbl}>3. Location *<input maxLength={120} value={f.workLocation} onChange={set("workLocation")} className={inputCls} placeholder="e.g. Andheri, Mumbai" /></label>
                    <label className={lbl}>4. Date of joining *<input type="date" disabled={locked} value={f.joiningDate} onChange={set("joiningDate")} className={inputCls} /></label>
                    <label className={lbl}>5. Designation *<input disabled={locked} maxLength={120} value={f.offeredPosition} onChange={set("offeredPosition")} className={inputCls} /></label>
                    <label className={lbl}>6. Grade *<input maxLength={60} value={f.grade} onChange={set("grade")} className={inputCls} placeholder="e.g. M2, L4, Band B" /></label>
                    <label className={lbl}>7. CTC (LPA) *<input type="number" step="0.01" min="0" max="500" disabled={locked} value={f.offeredSalaryLpa} onChange={set("offeredSalaryLpa")} className={inputCls} /></label>
                    <div className={lbl}>
                        <span>8. Employee type *</span>
                        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Employee type">
                            {EMPLOYEE_TYPES.map(([k, l]) => (
                                <button key={k} type="button" role="radio" aria-checked={f.employeeType === k} onClick={() => setF({ ...f, employeeType: k })}
                                    className={`h-9 px-2 rounded-md border text-[12.5px] font-medium cursor-pointer ${f.employeeType === k ? "bg-navy/5 border-navy text-navy" : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={lbl}><span>9. Invoice amount</span>
                        <p className="h-9 px-3 rounded-md border border-neutral-200 bg-neutral-50 flex items-center text-neutral-700">
                            {p.feeInr != null ? `₹${Math.round(p.feeInr).toLocaleString("en-IN")} + GST` : "Worked out from CTC and the client's fee"}
                        </p>
                    </div>
                    <div className={lbl}><span>10. Invoice TAT</span>
                        <p className="h-9 px-3 rounded-md border border-neutral-200 bg-neutral-50 flex items-center text-neutral-700">
                            {p.invoiceNumber ? `Invoiced (${p.invoiceNumber})` : tat.days == null ? "Set the date of joining" : `${tat.days} day${tat.days === 1 ? "" : "s"} since joining, not invoiced yet`}
                        </p>
                    </div>
                </div>
                {locked && <p className="text-[11.5px] text-neutral-500">Already invoiced: date of joining, designation and CTC are locked. Use a credit or debit note to change the billed amount.</p>}
                <button disabled={saving} className="w-full h-10 rounded-md bg-primary text-white font-medium disabled:opacity-50">
                    {saving ? "Saving…" : missing.length ? `Save (still missing: ${missing.length})` : "Save invoicing details"}
                </button>
            </form>
        </ModalShell>
    );
}
