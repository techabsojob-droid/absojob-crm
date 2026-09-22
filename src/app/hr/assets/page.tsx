"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { Laptop, Shield, CheckCircle2, Clock, Search, Filter, Monitor, Smartphone, Tag, AlertCircle } from "lucide-react";

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
}

export default function HRAssetsPage() {
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");

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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
