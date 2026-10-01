"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store, Plus, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { btn, inputCls, money, Tabs, uploadFile, useAct } from "@/components/finance/kit";

interface Vendor { id: string; name: string; category: string; gstin?: string | null; pan?: string | null; email?: string | null; tdsSection: string; tdsRate: number; paymentTermsDays: number; active: boolean; outstanding: number; bankAccountNumber?: string | null }
interface Bill { id: string; vendorId: string; vendorName: string; billNumber: string; billDate: string; dueDate: string; category: string; description: string; amount: number; gstAmount: number; tdsSection: string; tdsAmount: number; total: number; payable: number; amountPaid: number; status: string; recurring: boolean; recurringNextDate?: string | null; fileId?: string | null; createdByName: string; approvedByName?: string | null }
const CATS = ["RENT", "SOFTWARE", "MARKETING", "JOB_BOARDS", "TRAVEL", "OFFICE", "UTILITIES", "MEALS", "TRAINING", "OTHER"];

export default function VendorsPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState<"bills" | "vendors">("bills");
    const [status, setStatus] = useState("OPEN");
    const [vOpen, setVOpen] = useState(false);
    const [bOpen, setBOpen] = useState(false);
    const [v, setV] = useState({ name: "", category: "SOFTWARE", gstin: "", pan: "", email: "", bankName: "", bankAccountNumber: "", bankIfsc: "", tdsSection: "NONE", paymentTermsDays: "30" });
    const [b, setB] = useState({ vendorId: "", billNumber: "", billDate: "", dueDate: "", description: "", amount: "", gstAmount: "", recurring: false, fileId: "" });
    const { data } = useQuery<{ vendors: Vendor[]; bills: Bill[] }>({ queryKey: ["finance-vendors"], queryFn: () => api("/api/finance/vendors") });
    const keys = ["finance-vendors", "finance-dashboard"];
    const post = useAct("/api/finance/vendors", "POST", keys, "Saved");
    const patch = useAct("/api/finance/vendors", "PATCH", keys, "Updated");
    const bills = (data?.bills ?? []).filter((x) => status === "ALL" || (status === "OPEN" ? !["PAID", "CANCELLED"].includes(x.status) : x.status === status));
    const vendor = data?.vendors.find((x) => x.id === b.vendorId);

    return (
        <div className="space-y-6">
            <PageHeader title="Vendors & Bills" subtitle="Accounts payable — TDS by section, GST input credit, maker-checker approval, recurring bills" action={<div className="flex gap-2"><button onClick={() => setVOpen(true)} className={btn.ghost}>New vendor</button><button onClick={() => setBOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"><Plus size={15} /> Record bill</button></div>} />
            <Tabs tabs={[{ id: "bills", label: "Bills" }, { id: "vendors", label: `Vendors (${data?.vendors.length ?? 0})` }]} value={tab} onChange={setTab} />
            {tab === "bills" && <>
                <div className="flex gap-1.5">{["OPEN", "PENDING_APPROVAL", "OVERDUE", "PAID", "ALL"].map((s) => <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${status === s ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>{s.replace("_", " ")}</button>)}</div>
                <SectionCard title={`${bills.length} bill(s) · payable ${money(bills.reduce((s, x) => s + x.payable - x.amountPaid, 0))}`}>
                    {bills.length === 0 ? <EmptyState icon={Store} message="No bills." /> : (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs font-bold uppercase text-neutral-400 border-b border-neutral-200"><th className="py-2">Vendor · bill</th><th>Dates</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">TDS</th><th className="text-right">Payable</th><th>Status</th><th /></tr></thead>
                            <tbody className="divide-y divide-neutral-100">
                                {bills.map((x) => (
                                    <tr key={x.id} className="align-top">
                                        <td className="py-2.5"><span className="font-semibold">{x.vendorName}</span><span className="block text-[11px] text-neutral-500">{x.billNumber} · {x.description}{x.recurring ? ` · recurring (next ${x.recurringNextDate})` : ""}</span>{x.fileId && <a href={`/api/files/${x.fileId}`} target="_blank" rel="noreferrer" className="text-[11px] text-primary font-bold">bill copy</a>}</td>
                                        <td className="text-xs">{x.billDate}<span className="block text-neutral-500">due {x.dueDate}</span></td>
                                        <td className="text-right font-mono">{money(x.amount)}</td>
                                        <td className="text-right font-mono">{money(x.gstAmount)}</td>
                                        <td className="text-right font-mono">{x.tdsAmount ? `${money(x.tdsAmount)} (${x.tdsSection})` : "—"}</td>
                                        <td className="text-right font-mono font-bold">{money(x.payable - x.amountPaid)}<span className="block text-[10px] font-normal text-neutral-400">of {money(x.payable)}</span></td>
                                        <td><Badge value={x.status} /></td>
                                        <td className="text-right whitespace-nowrap space-x-1">
                                            {x.status === "PENDING_APPROVAL" && (x.createdByName !== user?.name || user?.role === "SUPER_ADMIN") && <button onClick={() => patch.mutate({ id: x.id, action: "approve" })} className={btn.good}>Approve</button>}
                                            {["APPROVED", "PARTIALLY_PAID", "OVERDUE"].includes(x.status) && <button onClick={() => { const amt = window.prompt("Amount to pay", String(x.payable - x.amountPaid)); if (!amt) return; const reference = window.prompt("UTR / reference") ?? ""; patch.mutate({ id: x.id, action: "pay", amount: Number(amt), method: "BANK_TRANSFER", reference }); }} className={btn.primary}>Pay</button>}
                                            {x.amountPaid === 0 && !["CANCELLED"].includes(x.status) && <button onClick={() => { if (window.confirm("Cancel this bill?")) patch.mutate({ id: x.id, action: "cancel" }); }} className={btn.ghost}>Cancel</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </SectionCard>
            </>}
            {tab === "vendors" && (
                <SectionCard>
                    {!data?.vendors.length ? <EmptyState icon={Store} message="No vendors." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">
                            {data.vendors.map((x) => (
                                <li key={x.id} className="py-3 flex items-center justify-between gap-3">
                                    <div><p className="font-semibold">{x.name} {!x.active && <Badge value="INACTIVE" />}</p><p className="text-[11px] text-neutral-500">{x.category.replace("_", " ")} · GSTIN {x.gstin || "—"} · PAN {x.pan || "—"} · TDS {x.tdsSection}{x.tdsRate ? ` @ ${x.tdsRate}%` : ""} · {x.paymentTermsDays}d terms{x.bankAccountNumber ? " · bank ✓" : " · no bank details"}</p></div>
                                    <div className="flex items-center gap-2"><span className="font-mono text-sm">{money(x.outstanding)}</span>{x.active && <button onClick={() => patch.mutate({ vendorId: x.id, action: "deactivate" })} className={btn.ghost}>Deactivate</button>}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            <ModalShell open={vOpen} onClose={() => setVOpen(false)} title="New vendor">
                <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); post.mutate({ type: "vendor", ...v, paymentTermsDays: Number(v.paymentTermsDays) }, { onSuccess: () => setVOpen(false) }); }}>
                    <input required placeholder="Vendor name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={`${inputCls} col-span-2`} />
                    <select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} className={inputCls}>{CATS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select>
                    <select value={v.tdsSection} onChange={(e) => setV({ ...v, tdsSection: e.target.value })} className={inputCls}><option value="NONE">No TDS</option><option value="194C">194C Contract (1%/2%)</option><option value="194J">194J Professional (10%)</option><option value="194I">194I Rent (10%)</option></select>
                    <input placeholder="GSTIN" value={v.gstin} onChange={(e) => setV({ ...v, gstin: e.target.value.toUpperCase() })} className={inputCls} />
                    <input placeholder="PAN" value={v.pan} onChange={(e) => setV({ ...v, pan: e.target.value.toUpperCase() })} className={inputCls} />
                    <input placeholder="Email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={inputCls} />
                    <input type="number" placeholder="Payment terms (days)" value={v.paymentTermsDays} onChange={(e) => setV({ ...v, paymentTermsDays: e.target.value })} className={inputCls} />
                    <input placeholder="Bank name" value={v.bankName} onChange={(e) => setV({ ...v, bankName: e.target.value })} className={inputCls} />
                    <input placeholder="Account number" value={v.bankAccountNumber} onChange={(e) => setV({ ...v, bankAccountNumber: e.target.value })} className={inputCls} />
                    <input placeholder="IFSC" value={v.bankIfsc} onChange={(e) => setV({ ...v, bankIfsc: e.target.value.toUpperCase() })} className={inputCls} />
                    <button disabled={post.isPending} className="col-span-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save vendor</button>
                </form>
            </ModalShell>
            <ModalShell open={bOpen} onClose={() => setBOpen(false)} title="Record vendor bill">
                <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); post.mutate({ ...b, amount: Number(b.amount), gstAmount: Number(b.gstAmount) || 0, fileId: b.fileId || null, dueDate: b.dueDate || undefined }, { onSuccess: () => { setBOpen(false); setB({ vendorId: "", billNumber: "", billDate: "", dueDate: "", description: "", amount: "", gstAmount: "", recurring: false, fileId: "" }); } }); }}>
                    <select required value={b.vendorId} onChange={(e) => setB({ ...b, vendorId: e.target.value })} className={`${inputCls} col-span-2`}><option value="">Vendor</option>{data?.vendors.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                    <input required placeholder="Bill number" value={b.billNumber} onChange={(e) => setB({ ...b, billNumber: e.target.value })} className={inputCls} />
                    <input required type="date" value={b.billDate} onChange={(e) => setB({ ...b, billDate: e.target.value })} className={inputCls} />
                    <input required placeholder="Description" value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} className={`${inputCls} col-span-2`} />
                    <input required type="number" min="1" placeholder="Taxable amount" value={b.amount} onChange={(e) => setB({ ...b, amount: e.target.value })} className={inputCls} />
                    <input type="number" min="0" placeholder="GST on bill" value={b.gstAmount} onChange={(e) => setB({ ...b, gstAmount: e.target.value })} className={inputCls} />
                    <label className="text-xs font-bold text-neutral-500">Due (default: vendor terms)<input type="date" value={b.dueDate} onChange={(e) => setB({ ...b, dueDate: e.target.value })} className={inputCls} /></label>
                    <label className="text-xs font-bold text-neutral-500 flex flex-col justify-end"><span className="flex items-center gap-1"><Paperclip size={12} /> Bill copy</span><input type="file" accept="application/pdf,image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const up = await uploadFile(file, "vendor-bill"); setB((x) => ({ ...x, fileId: up.id })); toast.success("Bill attached"); } catch (err) { toast.error((err as Error).message); } }} className="text-xs" /></label>
                    <label className="col-span-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={b.recurring} onChange={(e) => setB({ ...b, recurring: e.target.checked })} /> Recurring monthly (e.g. rent)</label>
                    {vendor && Number(b.amount) > 0 && <p className="col-span-2 text-[11px] text-neutral-500">TDS {vendor.tdsSection} @ {vendor.tdsRate}% = {money(Math.round(Number(b.amount) * vendor.tdsRate / 100))} · payable {money(Number(b.amount) + (Number(b.gstAmount) || 0) - Math.round(Number(b.amount) * vendor.tdsRate / 100))}</p>}
                    <button disabled={post.isPending} className="col-span-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save bill</button>
                </form>
            </ModalShell>
        </div>
    );
}
