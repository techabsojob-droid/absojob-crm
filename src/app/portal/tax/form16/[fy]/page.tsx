"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import PrintArea from "@/components/shared/PrintArea";
import { money } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface F16 { fy: string; employer: { name: string; pan: string; tan: string; address: string }; employee: { name: string; code: string; pan: string; designation: string }; regime: string; months: { month: string; gross: number; tds: number }[]; grossSalary: number; standardDeduction: number; professionalTax: number; deductions?: { label: string; amount: number }[]; taxableIncome: number; tdsDeducted: number }

export default function Form16Page() {
    const { fy } = useParams<{ fy: string }>();
    const { data, isLoading, error } = useQuery<F16>({ queryKey: ["form16", fy], queryFn: () => api(`/api/portal/form16?fy=${fy}`) });
    if (isLoading) return <SkeletonPulse className="h-[600px] w-full" />;
    if (error || !data) return <SectionCard><EmptyState icon={AlertTriangle} message={(error as Error)?.message ?? "Form 16 not available"} /></SectionCard>;
    return (
        <PrintArea backHref="/portal/tax" backLabel="Tax & Form 16">
            <p className="text-center text-xs font-bold text-neutral-500 uppercase">Form No. 16 — Part B (summary)</p>
            <p className="text-center text-lg font-extrabold">Certificate under section 203 of the Income-tax Act, 1961</p>
            <p className="text-center text-xs text-neutral-500 mb-4">Financial year {data.fy} · Assessment year {Number(data.fy.slice(0, 4)) + 1}-{String((Number(data.fy.slice(0, 4)) + 2) % 100).padStart(2, "0")} · {data.regime} regime</p>
            <div className="grid grid-cols-2 gap-6 text-xs border-y border-neutral-200 py-3">
                <div><p className="font-bold text-neutral-500">Employer</p><p className="font-semibold">{data.employer.name}</p><p>{data.employer.address}</p><p>PAN {data.employer.pan} · TAN {data.employer.tan}</p></div>
                <div><p className="font-bold text-neutral-500">Employee</p><p className="font-semibold">{data.employee.name} ({data.employee.code})</p><p>{data.employee.designation}</p><p>PAN {data.employee.pan}</p></div>
            </div>
            <table className="w-full text-xs my-4">
                <tbody className="divide-y divide-neutral-100">
                    {[["Gross salary", data.grossSalary], ["Less: standard deduction u/s 16(ia)", -data.standardDeduction], ...(data.regime === "OLD" ? [["Less: professional tax u/s 16(iii)", -data.professionalTax] as [string, number]] : []), ...(data.deductions ?? []).map((l) => [`Less: ${l.label} (Chapter VI-A)`, -l.amount] as [string, number])].map(([k, v]) => <tr key={k as string}><td className="py-1.5">{k}</td><td className="py-1.5 text-right font-mono">{money(v as number)}</td></tr>)}
                    <tr className="font-bold border-t border-neutral-300"><td className="py-2">Total taxable income</td><td className="py-2 text-right font-mono">{money(data.taxableIncome)}</td></tr>
                    <tr className="font-bold bg-emerald-50"><td className="py-2 px-1">Tax deducted at source</td><td className="py-2 px-1 text-right font-mono">{money(data.tdsDeducted)}</td></tr>
                </tbody>
            </table>
            <p className="text-xs font-bold text-neutral-500 mb-1">Month-wise salary and TDS</p>
            <table className="w-full text-xs border border-neutral-200">
                <thead className="bg-neutral-50"><tr><th className="text-left p-1.5">Month</th><th className="text-right p-1.5">Gross</th><th className="text-right p-1.5">TDS</th></tr></thead>
                <tbody>{data.months.map((m) => <tr key={m.month} className="border-t border-neutral-100"><td className="p-1.5">{m.month}</td><td className="p-1.5 text-right font-mono">{money(m.gross)}</td><td className="p-1.5 text-right font-mono">{money(m.tds)}</td></tr>)}</tbody>
            </table>
            <p className="text-[10px] text-neutral-400 mt-6">Part A (TDS deposited, challan details) is downloaded from the TRACES portal by the employer. This summary is generated from payroll records.</p>
        </PrintArea>
    );
}
