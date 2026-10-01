"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Doc {
    invoice: {
        invoiceNumber: string; kind: string; issueDate: string; dueDate: string; currency: string; fxRate: number; placeOfSupply?: string | null; clientGstin?: string | null;
        lineItems: { description: string; amount: number; sacCode?: string }[]; discount: number; subtotal: number; taxRate: number;
        tax: { cgst: number; sgst: number; igst: number; zeroRated: boolean }; roundOff: number; total: number; amountPaid: number; balanceDue: number; irn?: string | null; notes?: string | null; status: string;
    };
    company: { name: string; address: string; gstin: string; pan: string; state: string; lut: string; bankName: string; bankAccountNumber: string; bankIfsc: string };
    client: { name: string; billingAddress?: string | null; gstin?: string | null; stateCode?: string | null; stateName: string; country: string } | null;
    original: string | null;
}

const words = (n: number): string => {
    const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const two = (x: number) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? ` ${a[x % 10]}` : ""}`);
    const three = (x: number) => `${x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " : ""}` : ""}${two(x % 100)}`;
    if (n === 0) return "Zero";
    const cr = Math.floor(n / 1e7), lk = Math.floor((n % 1e7) / 1e5), th = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
    return [cr && `${three(cr)} Crore`, lk && `${two(lk)} Lakh`, th && `${two(th)} Thousand`, rest && three(rest)].filter(Boolean).join(" ");
};

export default function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data, error } = useQuery<Doc>({ queryKey: ["invoice-doc", id], queryFn: () => api<Doc>(`/api/finance/invoices/${id}`) });
    if (error) return <div className="fixed inset-0 z-[100] bg-white p-10">Could not load invoice: {(error as Error).message}</div>;
    if (!data) return <div className="fixed inset-0 z-[100] bg-white p-10 text-sm text-neutral-500">Loading…</div>;
    const { invoice: inv, company, client } = data;
    const m = (n: number) => `${inv.currency === "INR" ? "₹" : `${inv.currency} `}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const title = inv.kind === "CREDIT_NOTE" ? "CREDIT NOTE" : inv.kind === "DEBIT_NOTE" ? "DEBIT NOTE" : inv.tax.zeroRated ? "TAX INVOICE (EXPORT OF SERVICES)" : "TAX INVOICE";

    return (
        <div className="fixed inset-0 z-[100] bg-white overflow-auto">
            <div className="max-w-[820px] mx-auto p-10 text-[12px] text-black">
                <div className="flex justify-between items-start border-b-2 border-black pb-4">
                    <div>
                        <p className="text-xl font-bold">{company.name}</p>
                        <p className="whitespace-pre-line">{company.address}</p>
                        <p>GSTIN: <b>{company.gstin}</b> · PAN: {company.pan} · State: {company.state}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold">{title}</p>
                        <p>No: <b>{inv.invoiceNumber}</b></p>
                        <p>Date: {inv.issueDate}</p>
                        {inv.kind === "INVOICE" && <p>Due: {inv.dueDate}</p>}
                        {data.original && <p>Against invoice: {data.original}</p>}
                        {inv.status === "CANCELLED" && <p className="text-red-600 font-bold">CANCELLED</p>}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-6 py-4 border-b border-neutral-300">
                    <div>
                        <p className="font-bold uppercase text-[10px] text-neutral-500">Bill to</p>
                        <p className="font-bold">{client?.name}</p>
                        <p className="whitespace-pre-line">{client?.billingAddress}</p>
                        <p>GSTIN: {inv.clientGstin || "Unregistered"}</p>
                    </div>
                    <div>
                        <p className="font-bold uppercase text-[10px] text-neutral-500">Place of supply</p>
                        <p>{inv.tax.zeroRated ? `Outside India (${client?.country})` : `${inv.placeOfSupply} - ${client?.stateName}`}</p>
                        {inv.irn && <p className="mt-2 break-all">IRN: {inv.irn}</p>}
                        {inv.tax.zeroRated && <p className="mt-2">Supply meant for export under LUT {company.lut} without payment of IGST</p>}
                    </div>
                </div>
                <table className="w-full mt-4 border-collapse">
                    <thead><tr className="border-y border-black"><th className="py-2 text-left w-8">#</th><th className="text-left">Description</th><th className="text-left w-20">SAC</th><th className="text-right w-32">Amount</th></tr></thead>
                    <tbody>
                        {inv.lineItems.map((l, i) => <tr key={i} className="border-b border-neutral-200 align-top"><td className="py-2">{i + 1}</td><td className="py-2 pr-4">{l.description}</td><td>{l.sacCode ?? "998512"}</td><td className="text-right">{m(l.amount)}</td></tr>)}
                    </tbody>
                </table>
                <div className="flex justify-end mt-3">
                    <table className="w-72">
                        <tbody>
                            {inv.discount > 0 && <tr><td>Discount</td><td className="text-right">−{m(inv.discount)}</td></tr>}
                            <tr><td>Taxable value</td><td className="text-right">{m(inv.subtotal)}</td></tr>
                            {!inv.tax.zeroRated && (inv.tax.igst ? <tr><td>IGST @ {inv.taxRate}%</td><td className="text-right">{m(inv.tax.igst)}</td></tr> : <>
                                <tr><td>CGST @ {inv.taxRate / 2}%</td><td className="text-right">{m(inv.tax.cgst)}</td></tr>
                                <tr><td>SGST @ {inv.taxRate / 2}%</td><td className="text-right">{m(inv.tax.sgst)}</td></tr></>)}
                            {inv.roundOff !== 0 && <tr><td>Round off</td><td className="text-right">{inv.roundOff.toFixed(2)}</td></tr>}
                            <tr className="border-t border-black font-bold text-[13px]"><td className="pt-1">Total</td><td className="pt-1 text-right">{m(inv.total)}</td></tr>
                            {inv.kind === "INVOICE" && inv.amountPaid > 0 && <tr><td>Received</td><td className="text-right">{m(inv.amountPaid)}</td></tr>}
                            {inv.kind === "INVOICE" && <tr className="font-bold"><td>Balance due</td><td className="text-right">{m(inv.balanceDue)}</td></tr>}
                        </tbody>
                    </table>
                </div>
                {inv.currency === "INR" && <p className="mt-3">Amount in words: <b>Rupees {words(Math.round(inv.total))} Only</b></p>}
                {inv.currency !== "INR" && <p className="mt-3">INR equivalent at {inv.fxRate}: ₹{Math.round(inv.total * inv.fxRate).toLocaleString("en-IN")}</p>}
                {inv.notes && <p className="mt-3 whitespace-pre-line">Notes: {inv.notes}</p>}
                <div className="grid grid-cols-2 gap-6 mt-8 pt-4 border-t border-neutral-300">
                    <div>
                        <p className="font-bold uppercase text-[10px] text-neutral-500">Bank details</p>
                        <p>{company.bankName}</p><p>A/c: {company.bankAccountNumber}</p><p>IFSC: {company.bankIfsc}</p>
                        <p className="mt-2 text-[10px] text-neutral-500">Please deduct TDS under section 194J/194C as applicable and share Form 16A.</p>
                    </div>
                    <div className="text-right">
                        <p>For {company.name}</p>
                        <p className="mt-12">Authorised Signatory</p>
                    </div>
                </div>
                <p className="mt-6 text-center text-[10px] text-neutral-500">This is a computer-generated document.</p>
                <div className="mt-6 text-center print:hidden">
                    <button onClick={() => window.print()} className="px-5 py-2 rounded-xl bg-black text-white text-sm font-bold">Print / Save as PDF</button>
                </div>
            </div>
        </div>
    );
}
