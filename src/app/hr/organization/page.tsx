"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { Network, Building2, Users, UserCheck, ShieldCheck, ChevronRight, Mail, Phone, MapPin } from "lucide-react";

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

export default function HROrganizationPage() {
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

    return (
        <div className="space-y-6">
            <PageHeader
                title="Organization & Department Hierarchy"
                subtitle="Explore organizational structures, team breakdown, reporting lines, and department headcount."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Headcount" value={activeEmployees.length} icon={Users} tone="primary" hint="Active employees" />
                <StatCard label="Departments" value={deptNames.length} icon={Building2} tone="blue" hint="Operational units" />
                <StatCard label="Leadership & Leads" value={activeEmployees.filter((e) => e.designation.includes("CEO") || e.designation.includes("Lead") || e.designation.includes("Manager")).length} icon={ShieldCheck} tone="purple" hint="Management team" />
                <StatCard label="Locations" value={Array.from(new Set(activeEmployees.map((e) => e.location).filter(Boolean))).length} icon={Network} tone="emerald" hint="Offices & hubs" />
            </div>

            {/* Executive Leadership Highlight */}
            <SectionCard title="Executive Leadership & Reporting Tree">
                {isLoading ? (
                    <SkeletonPulse className="h-24 w-full" />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {activeEmployees
                            .filter((e) => !e.reportingManagerName || e.designation.includes("CEO") || e.designation.includes("Lead"))
                            .map((leader) => (
                                <div key={leader.id} className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-primary text-white font-extrabold flex items-center justify-center text-base">
                                        {leader.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-neutral-900">{leader.name}</h4>
                                        <p className="text-xs text-primary font-bold">{leader.designation}</p>
                                        <p className="text-[11px] text-neutral-400 mt-0.5">{leader.department}</p>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </SectionCard>

            {/* Department Breakdown */}
            <SectionCard title="Departments & Team Members">
                {isLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <SkeletonPulse key={i} className="h-32 w-full" />
                        ))}
                    </div>
                ) : deptNames.length === 0 ? (
                    <EmptyState icon={Building2} message="No active departments found." />
                ) : (
                    <div className="space-y-6">
                        {deptNames.map((dept) => {
                            const team = departmentMap[dept];
                            return (
                                <div key={dept} className="border border-neutral-200 rounded-2xl p-5 bg-white space-y-4">
                                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={18} className="text-primary" />
                                            <h3 className="font-bold text-neutral-900 text-lg">{dept}</h3>
                                            <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5 rounded-full">
                                                {team.length} {team.length === 1 ? "member" : "members"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {team.map((member) => (
                                            <div key={member.id} className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 transition-colors flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-neutral-200 text-neutral-700 font-bold flex items-center justify-center text-xs shrink-0">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div className="space-y-1 min-w-0">
                                                    <div className="font-bold text-neutral-900 text-sm truncate">{member.name}</div>
                                                    <div className="text-xs text-neutral-600 font-medium">{member.designation}</div>
                                                    <div className="text-[11px] text-neutral-400 flex items-center gap-1 pt-1">
                                                        <Mail size={12} /> {member.email}
                                                    </div>
                                                    {member.reportingManagerName && (
                                                        <div className="text-[11px] text-neutral-500 font-medium">
                                                            Reports to: <span className="font-semibold text-neutral-700">{member.reportingManagerName}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
