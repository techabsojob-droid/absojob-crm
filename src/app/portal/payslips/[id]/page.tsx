"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import PrintArea from "@/components/shared/PrintArea";
import { money } from "@/components/finance/kit";
import { api } from "@/lib/api";

type Row = [string, number];
interface Slip {
    month: string; status: string; paymentDate: string | null; paymentMethod: string | null; onHold: boolean;
    employer: { name: string; address: string; pan: string };
    employee: { name: string; code: string; designation: string; department: string; joiningDate: string; pan: string | null; bank: string | null; account: string | null; location: string | null };
    earnings: Row[]; deductions: Row[]; grossEarnings: number; totalDeductions: number; netPay: number; employerContributions: Row[];
    ytd: { fy: string; gross: number; pf: number; pt: number; tds: number; net: number };
}

// Indian-system number to words for the net pay line
function words(n: number): string {
    const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const two = (x: number) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? ` ${a[x % 10]}` : ""}`);
    const three = (x: number) => `${x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " : ""}` : ""}${x % 100 ? two(x % 100) : ""}`;
    n = Math.round(n);
    if (n === 0) return "Zero";
    const parts: string[] = [];
    const cr = Math.floor(n / 1e7), lk = Math.floor((n % 1e7) / 1e5), th = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
    if (cr) parts.push(`${two(cr)} Crore`);
    if (lk) parts.push(`${two(lk)} Lakh`);
    if (th) parts.push(`${two(th)} Thousand`);
    if (rest) parts.push(three(rest));
    return parts.join(" ");
}

export default function PayslipDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { data, isLoading, error } = useQuery<Slip>({ queryKey: ["payslip", id], queryFn: () => api(`/api/portal/payslips/${id}`) });
    if (isLoading) return <SkeletonPulse className="h-[600px] w-full" />;
    if (error || !data) return <SectionCard><EmptyState icon={AlertTriangle} message="Payslip not found." /></SectionCard>;
    const e = data.employee;
    const month = new Date(`${data.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
    const rows = Math.max(data.earnings.length, data.deductions.length);

    return (
        <PrintArea backHref="/portal/payslips" backLabel="All payslips">
            <div className="flex justify-between items-start border-b border-neutral-200 pb-4">
                <div><p className="text-lg font-extrabold">{data.employer.name}</p><p className="text-xs text-neutral-500 max-w-sm">{data.employer.address}</p></div>
                <div className="text-right"><p className="text-xs font-bold text-neutral-500 uppercase">Payslip</p><p className="text-lg font-extrabold">{month}</p>{data.onHold && <p className="text-xs font-bold text-rose-600">On hold</p>}</div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs py-4 border-b border-neutral-200">
                {[["Employee", e.name], ["Employee code", e.code], ["Designation", e.designation], ["Department", e.department], ["Date of joining", e.joiningDate], ["Location", e.location ?? "—"], ["PAN", e.pan ?? "—"], ["Bank", `${e.bank ?? "—"} ${e.account ?? ""}`], ["Paid on", data.paymentDate?.slice(0, 10) ?? "—"], ["Mode", data.paymentMethod?.replace("_", " ").toLowerCase() ?? "—"]].map(([k, v]) => <p key={k} className="flex justify-between gap-2"><span className="text-neutral-500">{k}</span><span className="font-semibold text-right">{v}</span></p>)}
            </div>
            <table className="w-full text-xs my-4 border border-neutral-200">
                <thead className="bg-neutral-50"><tr><th className="text-left p-2">Earnings</th><th className="text-right p-2">Amount</th><th className="text-left p-2 border-l border-neutral-200">Deductions</th><th className="text-right p-2">Amount</th></tr></thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <tr key={i} className="border-t border-neutral-100">
                            <td className="p-2">{data.earnings[i]?.[0] ?? ""}</td><td className="p-2 text-right font-mono">{data.earnings[i] ? money(data.earnings[i][1]) : ""}</td>
                            <td className="p-2 border-l border-neutral-200">{data.deductions[i]?.[0] ?? ""}</td><td className="p-2 text-right font-mono">{data.deductions[i] ? money(data.deductions[i][1]) : ""}</td>
                        </tr>
                    ))}
                    <tr className="border-t border-neutral-300 font-bold bg-neutral-50"><td className="p-2">Gross earnings</td><td className="p-2 text-right font-mono">{money(data.grossEarnings)}</td><td className="p-2 border-l border-neutral-200">Total deductions</td><td className="p-2 text-right font-mono">{money(data.totalDeductions)}</td></tr>
                </tbody>
            </table>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex justify-between items-center">
                <div><p className="text-xs font-bold text-emerald-800 uppercase">Net pay</p><p className="text-[11px] text-emerald-900">Rupees {words(data.netPay)} only</p></div>
                <p className="text-2xl font-extrabold font-mono text-emerald-900">{money(data.netPay)}</p>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-5 text-xs">
                <div><p className="font-bold text-neutral-500 mb-1">Year to date (FY {data.ytd.fy})</p>{[["Gross", data.ytd.gross], ["Provident fund", data.ytd.pf], ["Professional tax", data.ytd.pt], ["Income tax", data.ytd.tds], ["Net pay", data.ytd.net]].map(([k, v]) => <p key={k as string} className="flex justify-between"><span>{k}</span><span className="font-mono">{money(v as number)}</span></p>)}</div>
                {data.employerContributions.length > 0 && <div><p className="font-bold text-neutral-500 mb-1">Employer contributions (not deducted)</p>{data.employerContributions.map(([k, v]) => <p key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{money(v)}</span></p>)}</div>}
            </div>
            <p className="text-[10px] text-neutral-400 mt-6 text-center">This is a system-generated payslip and does not require a signature.</p>
        </PrintArea>
    );
}
