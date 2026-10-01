"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    Network, Building2, Users, UserCheck, ShieldCheck,
    ChevronRight, Mail, Phone, MapPin, Search, Layers,
    ZoomIn, ZoomOut, User
} from "lucide-react";

interface Employee {
    id: string;
    employeeId: string;
    name: string;
    email: string;
    phone: string;
    department: string;
    designation: string;
    reportingManagerName?: string | null;
    status: string;
    location?: string | null;
}

function OrganizationContent() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");

    const [activeTab, setActiveTab] = useState<"OVERVIEW" | "ORG_CHART" | "DEPARTMENTS">("OVERVIEW");
    const [chartDeptFilter, setChartDeptFilter] = useState("ALL");
    const [chartSearch, setChartSearch] = useState("");
    const [zoomLevel, setZoomLevel] = useState(1);

    useEffect(() => {
        if (tabParam === "org-chart") setActiveTab("ORG_CHART");
        else if (tabParam === "departments") setActiveTab("DEPARTMENTS");
    }, [tabParam]);

    const { data: employees = [], isLoading } = useQuery<Employee[]>({
        queryKey: ["hr-employees-org"],
        queryFn: async () => {
            const res = await fetch("/api/hr/employees");
            if (!res.ok) throw new Error("Failed to fetch employees");
            return res.json();
        },
    });

    const activeEmployees = employees.filter((e) => e.status === "ACTIVE");

    // Group by department
    const departmentMap: Record<string, Employee[]> = {};
    activeEmployees.forEach((emp) => {
        if (!departmentMap[emp.department]) {
            departmentMap[emp.department] = [];
        }
        departmentMap[emp.department].push(emp);
    });

    const deptNames = Object.keys(departmentMap);

    // Leadership tiers for Org Chart
    const ceo = activeEmployees.find((e) => e.designation.includes("CEO")) || activeEmployees[0];
    const deptHeads = activeEmployees.filter(
        (e) =>
            e.id !== ceo?.id &&
            (e.designation.includes("Head") || e.designation.includes("Lead") || e.designation.includes("Director") || e.designation.includes("Manager"))
    );
    const contributors = activeEmployees.filter(
        (e) => e.id !== ceo?.id && !deptHeads.some((h) => h.id === e.id)
    );

    const filteredContributors = contributors.filter((c) => {
        if (chartDeptFilter !== "ALL" && c.department !== chartDeptFilter) return false;
        if (chartSearch && !c.name.toLowerCase().includes(chartSearch.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Organization Architecture & Hierarchy"
                subtitle="Explore department structures, interactive organization reporting trees, and team allocations."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Headcount" value={activeEmployees.length} icon={Users} tone="primary" hint="Active employees" />
                <StatCard label="Departments" value={deptNames.length} icon={Building2} tone="blue" hint="Operational units" />
                <StatCard label="Leadership & Leads" value={deptHeads.length + (ceo ? 1 : 0)} icon={ShieldCheck} tone="purple" hint="Management tier" />
                <StatCard label="Operating Locations" value={Array.from(new Set(activeEmployees.map((e) => e.location).filter(Boolean))).length || 1} icon={Network} tone="emerald" hint="Hubs & offices" />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
                <button
                    onClick={() => setActiveTab("OVERVIEW")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        activeTab === "OVERVIEW" ? "bg-primary text-white shadow-xs" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                >
                    Organization Overview
                </button>
                <button
                    onClick={() => setActiveTab("ORG_CHART")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        activeTab === "ORG_CHART" ? "bg-primary text-white shadow-xs" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                >
                    Interactive Org Chart
                </button>
                <button
                    onClick={() => setActiveTab("DEPARTMENTS")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        activeTab === "DEPARTMENTS" ? "bg-primary text-white shadow-xs" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                >
                    Departments & Teams ({deptNames.length})
                </button>
            </div>

            {/* TAB 1: OVERVIEW (Existing Preserved) */}
            {activeTab === "OVERVIEW" && (
                <div className="space-y-6">
                    <SectionCard title="Executive Leadership & Reporting Tree">
                        {isLoading ? (
                            <SkeletonPulse className="h-28 w-full" />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {activeEmployees
                                    .filter((e) => e.designation.includes("CEO") || e.designation.includes("Lead") || e.designation.includes("Manager"))
                                    .slice(0, 6)
                                    .map((lead) => (
                                        <div key={lead.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-white hover:shadow-sm transition-all space-y-2">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-bold text-neutral-900 text-sm">{lead.name}</h4>
                                                    <p className="text-xs text-primary font-semibold">{lead.designation}</p>
                                                    <p className="text-[11px] text-neutral-500">{lead.department}</p>
                                                </div>
                                                <Badge value={lead.status} />
                                            </div>
                                            <div className="pt-2 border-t border-neutral-100 text-xs text-neutral-500 space-y-1">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <Mail size={13} className="text-neutral-400" /> {lead.email}
                                                </div>
                                                {lead.location && (
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin size={13} className="text-neutral-400" /> {lead.location}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </SectionCard>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {deptNames.map((dept) => {
                            const emps = departmentMap[dept];
                            return (
                                <SectionCard key={dept} title={`${dept} (${emps.length})`}>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {emps.map((emp) => (
                                            <div key={emp.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 border border-neutral-100 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                                                        {emp.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-neutral-900">{emp.name}</div>
                                                        <div className="text-[11px] text-neutral-500">{emp.designation}</div>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-mono font-medium text-neutral-400">{emp.employeeId}</span>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: INTERACTIVE ORG CHART (Section 3) */}
            {activeTab === "ORG_CHART" && (
                <SectionCard>
                    <div className="space-y-6">
                        {/* Org Chart Controls */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                            <div className="flex items-center gap-2">
                                <select
                                    value={chartDeptFilter}
                                    onChange={(e) => setChartDeptFilter(e.target.value)}
                                    className="px-3 py-1.5 bg-neutral-100 rounded-xl text-xs font-bold text-neutral-700 border border-neutral-200"
                                >
                                    <option value="ALL">All Departments</option>
                                    {deptNames.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>

                                <div className="relative w-48">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                                    <input
                                        type="text"
                                        placeholder="Search hierarchy..."
                                        value={chartSearch}
                                        onChange={(e) => setChartSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1 bg-neutral-100 rounded-xl text-xs font-medium border border-neutral-200"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setZoomLevel((z) => Math.min(1.2, z + 0.1))}
                                    className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
                                    title="Zoom In"
                                >
                                    <ZoomIn size={15} />
                                </button>
                                <button
                                    onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.1))}
                                    className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={15} />
                                </button>
                                <span className="text-xs font-bold text-neutral-400">{Math.round(zoomLevel * 100)}%</span>
                            </div>
                        </div>

                        {/* Hierarchical Tree Canvas */}
                        <div
                            className="overflow-x-auto py-6 flex flex-col items-center gap-8 transition-transform origin-top"
                            style={{ transform: `scale(${zoomLevel})` }}
                        >
                            {/* Tier 1: CEO / Executive */}
                            {ceo && (
                                <div className="flex flex-col items-center">
                                    <div className="w-64 p-4 rounded-2xl bg-white border-2 border-primary shadow-lg shadow-primary/10 text-center space-y-1 relative">
                                        <div className="w-12 h-12 rounded-full bg-primary text-white font-black text-sm flex items-center justify-center mx-auto mb-2 shadow-xs">
                                            {ceo.name.charAt(0)}
                                        </div>
                                        <h4 className="font-extrabold text-sm text-neutral-900">{ceo.name}</h4>
                                        <p className="text-xs font-bold text-primary">{ceo.designation}</p>
                                        <p className="text-[11px] text-neutral-400">{ceo.department} • {ceo.location || "HQ"}</p>
                                    </div>
                                    <div className="w-0.5 h-8 bg-neutral-300" />
                                </div>
                            )}

                            {/* Tier 2: Department Heads & Managers */}
                            <div className="w-full flex justify-center flex-wrap gap-6 relative">
                                <div className="absolute -top-4 left-1/4 right-1/4 h-0.5 bg-neutral-200 hidden md:block" />
                                {deptHeads.map((head) => (
                                    <div key={head.id} className="flex flex-col items-center">
                                        <div className="w-56 p-3.5 rounded-xl bg-white border border-neutral-200 hover:border-primary shadow-sm text-center space-y-1 transition-all">
                                            <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-800 font-bold text-xs flex items-center justify-center mx-auto">
                                                {head.name.charAt(0)}
                                            </div>
                                            <h5 className="font-bold text-xs text-neutral-900">{head.name}</h5>
                                            <p className="text-[11px] font-semibold text-neutral-600">{head.designation}</p>
                                            <span className="inline-block px-2 py-0.5 text-[9px] font-bold rounded bg-neutral-100 text-neutral-600">
                                                {head.department}
                                            </span>
                                        </div>
                                        <div className="w-0.5 h-6 bg-neutral-200" />
                                    </div>
                                ))}
                            </div>

                            {/* Tier 3: Direct Contributors & Leads */}
                            <div className="w-full border-t border-dashed border-neutral-200 pt-6">
                                <h5 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 text-center mb-4">
                                    Direct Team Members & Individual Contributors ({filteredContributors.length})
                                </h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {filteredContributors.map((c) => (
                                        <div key={c.id} className="p-3 rounded-xl bg-neutral-50/80 border border-neutral-200 hover:bg-white transition-all space-y-1">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                                    {c.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-neutral-900 truncate">{c.name}</p>
                                                    <p className="text-[10px] text-neutral-500 truncate">{c.designation}</p>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-neutral-400 pt-1 flex items-center justify-between border-t border-neutral-100">
                                                <span>{c.department}</span>
                                                <span className="font-mono">{c.employeeId}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB 3: DEPARTMENTS & TEAMS (Section 4) */}
            {activeTab === "DEPARTMENTS" && (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {deptNames.map((dept) => {
                            const members = departmentMap[dept];
                            const lead = members.find((m) => m.designation.includes("Lead") || m.designation.includes("Manager")) || members[0];

                            return (
                                <SectionCard key={dept}>
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                                    <Layers size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-neutral-900">{dept}</h4>
                                                    <p className="text-xs text-neutral-400 font-medium">Core Business Unit</p>
                                                </div>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-bold">
                                                {members.length} Staff
                                            </span>
                                        </div>

                                        <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-neutral-400 block">Department Lead</span>
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck size={14} className="text-primary" />
                                                <span className="text-xs font-bold text-neutral-800">{lead?.name || "Unassigned"}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-neutral-400 block">Roster Snapshot</span>
                                            <div className="divide-y divide-neutral-100 max-h-36 overflow-y-auto">
                                                {members.map((m) => (
                                                    <div key={m.id} className="py-1.5 flex items-center justify-between text-xs">
                                                        <span className="font-semibold text-neutral-700 truncate">{m.name}</span>
                                                        <span className="text-[10px] text-neutral-400 font-mono">{m.employeeId}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </SectionCard>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HROrganizationPage() {
    return (
        <Suspense fallback={<SkeletonPulse className="h-96 w-full" />}>
            <OrganizationContent />
        </Suspense>
    );
}
