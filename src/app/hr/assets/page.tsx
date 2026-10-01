"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api, useEmployeeOptions } from "@/lib/api";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { Laptop, CheckCircle2, Clock, Search, Filter, Tag, AlertCircle, Plus } from "lucide-react";

interface AssetRecord {
    id: string;
    assetTag: string;
    name: string;
    category: "LAPTOP" | "DESKTOP" | "MONITOR" | "MOBILE" | "ID_CARD" | "ACCESSORY" | "OTHER";
    serialNumber: string;
    assignedEmployeeId: string | null;
    assignedEmployeeName?: string | null;
    assignedDate?: string | null;
    condition: "EXCELLENT" | "GOOD" | "FAIR" | "DAMAGED";
    status: "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "RETIRED";
    notes?: string | null;
    history?: { action: string; employeeName?: string | null; note?: string | null; byName: string; at: string }[];
}

const inputCls = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none";

export default function HRAssetsPage() {
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const qc = useQueryClient();
    const { data: employeeOptions = [] } = useEmployeeOptions();
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({ name: "", category: "LAPTOP", serialNumber: "", condition: "EXCELLENT", notes: "" });
    const [assignFor, setAssignFor] = useState<AssetRecord | null>(null);
    const [assignEmp, setAssignEmp] = useState("");
    const [returnFor, setReturnFor] = useState<AssetRecord | null>(null);
    const [returnCondition, setReturnCondition] = useState("GOOD");
    const [historyFor, setHistoryFor] = useState<AssetRecord | null>(null);

    const mutate = useMutation({
        mutationFn: (args: { method: "POST" | "PATCH"; body: Record<string, unknown> }) => api("/api/hr/assets", args.method, args.body),
        onSuccess: (_d, args) => {
            toast.success(args.method === "POST" ? "Asset added to inventory" : "Asset updated");
            setAddOpen(false);
            setAssignFor(null);
            setReturnFor(null);
            setAssignEmp("");
            setAddForm({ name: "", category: "LAPTOP", serialNumber: "", condition: "EXCELLENT", notes: "" });
            qc.invalidateQueries({ queryKey: ["hr-assets"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const { data: assets = [], isLoading } = useQuery<AssetRecord[]>({
        queryKey: ["hr-assets", categoryFilter, statusFilter, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (categoryFilter !== "ALL") params.set("category", categoryFilter);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/assets?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch assets");
            return res.json();
        },
    });

    const assignedCount = assets.filter((a) => a.status === "ASSIGNED").length;
    const availableCount = assets.filter((a) => a.status === "AVAILABLE").length;
    const maintenanceCount = assets.filter((a) => a.status === "MAINTENANCE").length;

    const categories = ["ALL", "LAPTOP", "DESKTOP", "MONITOR", "MOBILE", "ID_CARD", "ACCESSORY"];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Company Asset Management"
                subtitle="Track hardware inventory, laptop allocation, serial tags, asset condition, and employee assignments."
                action={
                    <button onClick={() => setAddOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2">
                        <Plus size={15} /> Add Asset
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Hardware Inventory" value={assets.length} icon={Laptop} tone="primary" hint="Registered devices & items" />
                <StatCard label="Assigned Devices" value={assignedCount} icon={CheckCircle2} tone="emerald" hint="In active employee use" />
                <StatCard label="Available in Stock" value={availableCount} icon={Tag} tone="blue" hint="Ready for allocation" />
                <StatCard label="Maintenance / Service" value={maintenanceCount} icon={Clock} tone="amber" hint="Under repair / audit" />
            </div>

            {/* Filters */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <Filter size={16} className="text-neutral-500" />
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                            >
                                <option value="ALL">All Categories</option>
                                {categories.filter((c) => c !== "ALL").map((c) => (
                                    <option key={c} value={c}>
                                        {c.replace("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="ASSIGNED">Assigned</option>
                                <option value="AVAILABLE">Available</option>
                                <option value="MAINTENANCE">Maintenance</option>
                                <option value="RETIRED">Retired</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search tag, device, serial..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Assets Table */}
            <SectionCard title={`Hardware & Inventory Assets (${assets.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-xl" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-24" />
                                <SkeletonPulse className="h-4 w-20" />
                            </div>
                        ))}
                    </div>
                ) : assets.length === 0 ? (
                    <EmptyState icon={AlertCircle} message="No assets found matching the selected filters." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Asset Tag</th>
                                    <th className="py-3 px-2">Device Name</th>
                                    <th className="py-3 px-2">Category</th>
                                    <th className="py-3 px-2">Serial Number</th>
                                    <th className="py-3 px-2">Assigned Employee</th>
                                    <th className="py-3 px-2">Condition</th>
                                    <th className="py-3 px-2">Status</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {assets.map((ast) => (
                                    <tr key={ast.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="py-3.5 px-2 font-mono text-xs font-bold text-primary">{ast.assetTag}</td>
                                        <td className="py-3.5 px-2 font-bold text-neutral-900">{ast.name}</td>
                                        <td className="py-3.5 px-2">
                                            <span className="bg-neutral-100 px-2.5 py-1 rounded-lg text-xs font-bold text-neutral-700">
                                                {ast.category.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-2 font-mono text-xs text-neutral-500">{ast.serialNumber}</td>
                                        <td className="py-3.5 px-2 font-medium text-neutral-800">
                                            {ast.assignedEmployeeName ? (
                                                ast.assignedEmployeeName
                                            ) : (
                                                <span className="text-neutral-400 italic">Unassigned (In Stock)</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-2 font-semibold text-neutral-700 text-xs">{ast.condition}</td>
                                        <td className="py-3.5 px-2">
                                            <Badge value={ast.status} />
                                        </td>
                                        <td className="py-3.5 px-2 text-right whitespace-nowrap space-x-1.5">
                                            {ast.status === "AVAILABLE" && (
                                                <button onClick={() => setAssignFor(ast)} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-white">Assign</button>
                                            )}
                                            {ast.status === "ASSIGNED" && (
                                                <button onClick={() => { setReturnFor(ast); setReturnCondition(ast.condition); }} className="px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-700 text-xs font-bold hover:bg-neutral-100">Return</button>
                                            )}
                                            {ast.status === "AVAILABLE" && (
                                                <button onClick={() => mutate.mutate({ method: "PATCH", body: { id: ast.id, action: "status", status: "MAINTENANCE" } })} className="px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-50">Service</button>
                                            )}
                                            {ast.status === "MAINTENANCE" && (
                                                <button onClick={() => mutate.mutate({ method: "PATCH", body: { id: ast.id, action: "status", status: "AVAILABLE" } })} className="px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-50">Back in stock</button>
                                            )}
                                            {["AVAILABLE", "MAINTENANCE"].includes(ast.status) && (
                                                <button
                                                    onClick={() => { if (window.confirm(`Retire ${ast.assetTag}? It can no longer be assigned.`)) mutate.mutate({ method: "PATCH", body: { id: ast.id, action: "status", status: "RETIRED" } }); }}
                                                    className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-50"
                                                >
                                                    Retire
                                                </button>
                                            )}
                                            <button onClick={() => setHistoryFor(ast)} className="px-2.5 py-1 rounded-lg text-neutral-500 text-xs font-bold hover:text-primary">History</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <ModalShell open={addOpen} onClose={() => setAddOpen(false)} title="Add Asset to Inventory">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutate.mutate({ method: "POST", body: addForm }); }}>
                    <input required placeholder="Device name (e.g. MacBook Pro 14)" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className={inputCls} />
                    <div className="grid grid-cols-2 gap-3">
                        <select value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} className={inputCls}>
                            {categories.filter((c) => c !== "ALL").concat("OTHER").map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                        </select>
                        <select value={addForm.condition} onChange={(e) => setAddForm({ ...addForm, condition: e.target.value })} className={inputCls}>
                            {["EXCELLENT", "GOOD", "FAIR", "DAMAGED"].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <input required placeholder="Serial number" value={addForm.serialNumber} onChange={(e) => setAddForm({ ...addForm, serialNumber: e.target.value })} className={inputCls} />
                    <textarea placeholder="Notes (optional)" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} className={inputCls} rows={2} />
                    <button disabled={mutate.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save Asset</button>
                </form>
            </ModalShell>

            <ModalShell open={!!assignFor} onClose={() => setAssignFor(null)} title={`Assign ${assignFor?.assetTag ?? ""}`}>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (assignFor) mutate.mutate({ method: "PATCH", body: { id: assignFor.id, action: "assign", employeeId: assignEmp } }); }}>
                    <p className="text-sm text-neutral-600">{assignFor?.name} · S/N {assignFor?.serialNumber}</p>
                    <select required value={assignEmp} onChange={(e) => setAssignEmp(e.target.value)} className={inputCls}>
                        <option value="">Select employee</option>
                        {employeeOptions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.employeeId} · {e.department}</option>)}
                    </select>
                    <button disabled={mutate.isPending || !assignEmp} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Assign Asset</button>
                </form>
            </ModalShell>

            <ModalShell open={!!returnFor} onClose={() => setReturnFor(null)} title={`Return ${returnFor?.assetTag ?? ""}`}>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (returnFor) mutate.mutate({ method: "PATCH", body: { id: returnFor.id, action: "return", condition: returnCondition } }); }}>
                    <p className="text-sm text-neutral-600">Returned by <strong>{returnFor?.assignedEmployeeName}</strong></p>
                    <label className="text-xs font-bold text-neutral-500">Condition on return</label>
                    <select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value)} className={inputCls}>
                        {["EXCELLENT", "GOOD", "FAIR", "DAMAGED"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="text-[11px] text-neutral-400">Damaged assets go to maintenance automatically.</p>
                    <button disabled={mutate.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Record Return</button>
                </form>
            </ModalShell>

            <ModalShell open={!!historyFor} onClose={() => setHistoryFor(null)} title={`${historyFor?.assetTag ?? ""} history`}>
                {(historyFor?.history ?? []).length === 0 ? (
                    <p className="text-sm text-neutral-500">No history recorded for this asset yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {historyFor!.history!.map((h, i) => (
                            <li key={i} className="text-sm border-b border-neutral-100 pb-2">
                                <span className="font-bold text-neutral-900">{h.action.replace("_", " ")}</span>
                                {h.employeeName && <span className="text-neutral-700"> · {h.employeeName}</span>}
                                {h.note && <span className="text-neutral-500"> · {h.note}</span>}
                                <div className="text-[11px] text-neutral-400">{new Date(h.at).toLocaleString("en-IN")} by {h.byName}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </ModalShell>
        </div>
    );
}
