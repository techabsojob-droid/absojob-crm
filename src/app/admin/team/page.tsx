"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    Users, UserPlus, ShieldCheck, UserCog, Ban, RotateCcw, Search, Filter,
    Building2, Network, LayoutGrid, List, ChevronRight, CheckCircle2,
    Calendar, Mail, Phone, MapPin, Briefcase, Award, ArrowRight, UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { TempPasswordDialog, type IssuedLogin } from "@/components/shared/TempPasswordDialog";

const ROLES = ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "TA_MANAGER", "TA_RECRUITER", "AGENT", "EMPLOYEE"] as const;

export default function TeamPage() {
    const qc = useQueryClient();
    const [viewMode, setViewMode] = useState<"cards" | "list" | "org">("cards");
    const [q, setQ] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("ALL");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [modalOpen, setModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editUser, setEditUser] = useState<any>(null);

    // Multi-step Add Member Form
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        role: "TA_RECRUITER",
        department: "Talent Acquisition",
        designation: "Recruiter / Talent Partner",
        reportingTo: "",
        location: "Mumbai",
        workMode: "Hybrid (Mumbai HQ)",
        employmentType: "Full Time",
    });

    const { data: team = [], isLoading } = useQuery<any[]>({
        queryKey: ["team", q, departmentFilter, roleFilter, statusFilter],
        queryFn: async () => {
            const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&department=${departmentFilter}&role=${roleFilter}&status=${statusFilter}`);
            if (!res.ok) throw new Error("Failed to load team");
            return res.json();
        },
    });

    const [issued, setIssued] = useState<IssuedLogin | null>(null);
    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to create user");
            return data;
        },
        onSuccess: (data) => {
            toast.success("Team member added.");
            if (data.tempPassword) setIssued({ name: data.name, email: data.email, password: data.tempPassword });
            setModalOpen(false);
            setStep(1);
            setForm({
                name: "", email: "", phone: "", role: "TA_RECRUITER",
                department: "Talent Acquisition", designation: "Recruiter / Talent Partner",
                reportingTo: "", location: "Mumbai", workMode: "Hybrid (Mumbai HQ)",
                employmentType: "Full Time",
            });
            qc.invalidateQueries({ queryKey: ["team"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const patchMutation = useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Update failed");
            return data;
        },
        onSuccess: () => {
            toast.success("User record updated");
            setEditModalOpen(false);
            qc.invalidateQueries({ queryKey: ["team"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const list = Array.isArray(team) ? team : [];
    const managers = list.filter((u: any) => ["SUPER_ADMIN", "TA_MANAGER", "HR_ADMIN", "FINANCE_ADMIN"].includes(u.role));
    const activeCount = list.filter((u) => u.status === "ACTIVE").length;
    const taCount = list.filter((u) => u.role.startsWith("TA_") && u.status === "ACTIVE").length;
    const agentCount = list.filter((u) => u.role === "AGENT" && u.status === "ACTIVE").length;
    const suspendedCount = list.filter((u) => ["SUSPENDED", "EXITED"].includes(u.status)).length;

    // Distinct departments
    const departments = ["ALL", "Talent Acquisition", "Human Resources", "Leadership", "Operations", "Finance", "Field"];

    return (
        <div className="space-y-6 animate-fade-in">
            <TempPasswordDialog login={issued} onClose={() => setIssued(null)} />
            <PageHeader
                title="Team Management & Organizational Hierarchy"
                subtitle="People, roles, reporting managers (solid & dotted lines) and cross-functional recruitment squads"
                action={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === "org" ? "cards" : "org")}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-xs ${
                                viewMode === "org"
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                            }`}
                        >
                            <Network size={15} /> Org Chart
                        </button>
                        <button
                            onClick={() => { setStep(1); setModalOpen(true); }}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all shadow-md shadow-primary/25 flex items-center gap-1.5"
                        >
                            <UserPlus size={16} /> Add Team Member
                        </button>
                    </div>
                }
            />

            {/* Clickable KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div onClick={() => setStatusFilter("ACTIVE")} className="cursor-pointer">
                    <StatCard label="Total Active Staff" value={activeCount} icon={Users} tone="primary" hint="verified employees" />
                </div>
                <div onClick={() => { setDepartmentFilter("Talent Acquisition"); setRoleFilter("ALL"); }} className="cursor-pointer">
                    <StatCard label="TA Recruitment Squad" value={taCount} icon={UserCog} tone="purple" hint="managers & recruiters" />
                </div>
                <div onClick={() => { setRoleFilter("AGENT"); setDepartmentFilter("ALL"); }} className="cursor-pointer">
                    <StatCard label="Field Talent Partners" value={agentCount} icon={ShieldCheck} tone="emerald" hint="active referral agents" />
                </div>
                <div onClick={() => setStatusFilter("SUSPENDED")} className="cursor-pointer">
                    <StatCard label="Suspended / Exited" value={suspendedCount} icon={Ban} tone={suspendedCount > 0 ? "red" : "neutral"} hint="access deactivated" />
                </div>
            </div>

            {/* Search, Filter Bar and View Switcher */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search employee, title, department, manager..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto justify-between md:justify-end">
                    {/* Department chips */}
                    <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
                        {departments.slice(0, 4).map((d) => (
                            <button
                                key={d}
                                onClick={() => setDepartmentFilter(d)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                    departmentFilter === d
                                        ? "bg-white text-neutral-900 shadow-xs"
                                        : "text-neutral-500 hover:text-neutral-800"
                                }`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>

                    {/* View Switcher: Cards | List | Org */}
                    <div className="flex items-center bg-neutral-100 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode("cards")}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === "cards" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500"
                            }`}
                            title="Card Grid View"
                        >
                            <LayoutGrid size={15} />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === "list" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500"
                            }`}
                            title="Table List View"
                        >
                            <List size={15} />
                        </button>
                        <button
                            onClick={() => setViewMode("org")}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === "org" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500"
                            }`}
                            title="Hierarchy Chart"
                        >
                            <Network size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* VIEW 1: ORGANIZATIONAL HIERARCHY TREE */}
            {viewMode === "org" && (
                <SectionCard
                    title="Organizational Tree & Reporting Hierarchy"
                    subtitle="Interactive tree: Solid-line reporting managers and subordinate direct reports"
                >
                    <div className="p-4 overflow-x-auto min-w-[700px]">
                        {/* Root CEO */}
                        {list.filter((u) => u.role === "SUPER_ADMIN").map((ceo) => (
                            <div key={ceo.id} className="space-y-6">
                                <div className="p-4 max-w-sm mx-auto bg-primary/5 border-2 border-primary rounded-2xl text-center space-y-1 shadow-sm">
                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-primary text-white">
                                        Executive Root
                                    </span>
                                    <h3 className="font-extrabold text-neutral-900 text-sm">{ceo.name}</h3>
                                    <p className="text-xs text-neutral-500 font-medium">{ceo.designation || "CEO / Founder"}</p>
                                    <Link href={`/admin/team/${ceo.id}`} className="text-[11px] text-primary font-bold hover:underline inline-block pt-1">
                                        View Employee 360° →
                                    </Link>
                                </div>

                                {/* Tree Connector Line */}
                                <div className="w-0.5 h-8 bg-neutral-300 mx-auto" />

                                {/* Level 2: Department Heads & Managers reporting to CEO */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {list.filter((u) => u.reportingTo === ceo.id).map((mgr) => {
                                        const subs = list.filter((s) => s.reportingTo === mgr.id);
                                        return (
                                            <div key={mgr.id} className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
                                                <div className="border-b border-neutral-200 pb-2">
                                                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                                        {mgr.department}
                                                    </span>
                                                    <h4 className="font-bold text-neutral-900 text-xs mt-1.5">{mgr.name}</h4>
                                                    <p className="text-[11px] text-neutral-500">{mgr.designation}</p>
                                                    <Link href={`/admin/team/${mgr.id}`} className="text-[10px] text-primary font-bold hover:underline block mt-0.5">
                                                        Profile →
                                                    </Link>
                                                </div>

                                                {/* Subordinate Direct Reports */}
                                                <div className="space-y-2 pt-1">
                                                    <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">
                                                        Direct Reports ({subs.length})
                                                    </p>
                                                    {subs.length === 0 ? (
                                                        <p className="text-[11px] text-neutral-400 italic">No direct reports assigned</p>
                                                    ) : (
                                                        subs.map((sub) => (
                                                            <div key={sub.id} className="p-2 bg-white rounded-xl border border-neutral-100 flex items-center justify-between text-xs">
                                                                <div>
                                                                    <p className="font-bold text-neutral-900">{sub.name}</p>
                                                                    <p className="text-[10px] text-neutral-400">{sub.designation || sub.role}</p>
                                                                </div>
                                                                <Link href={`/admin/team/${sub.id}`} className="text-primary font-bold hover:underline text-[11px]">
                                                                    View
                                                                </Link>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* VIEW 2: CARDS GRID (DEFAULT) */}
            {viewMode === "cards" && (
                isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonPulse key={i} className="h-56 rounded-2xl" />
                        ))}
                    </div>
                ) : list.length === 0 ? (
                    <SectionCard><EmptyState icon={Users} message="No team members match current criteria." /></SectionCard>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {list.map((u) => (
                            <div
                                key={u.id}
                                className="group bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:border-primary/50 hover:shadow-lg transition-all space-y-3.5 relative flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    {/* Member Identity Top */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                                                {u.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                                            </div>
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/admin/team/${u.id}`}
                                                    className="font-bold text-neutral-900 group-hover:text-primary transition-colors text-xs hover:underline truncate block"
                                                >
                                                    {u.name}
                                                </Link>
                                                <p className="text-[11px] text-neutral-500 font-medium truncate">{u.designation || u.role.replaceAll("_", " ")}</p>
                                                <span className="text-[10px] text-neutral-400 font-mono">{u.employeeId}</span>
                                            </div>
                                        </div>
                                        <Badge value={u.status} />
                                    </div>

                                    {/* Hierarchy Pill */}
                                    <div className="p-2.5 bg-neutral-50 rounded-xl text-[11px] text-neutral-600 space-y-1">
                                        <p className="flex items-center gap-1.5 truncate">
                                            <UserCheck size={12} className="text-primary shrink-0" />
                                            <span>Reports to: <strong>{u.reportingToName || "Aarav Mehta (Root)"}</strong></span>
                                        </p>
                                        <p className="flex items-center gap-1.5 text-neutral-400 text-[10px]">
                                            <Building2 size={12} className="shrink-0" />
                                            <span>{u.department} · {u.team}</span>
                                        </p>
                                    </div>

                                    {/* Operational Workload Strip */}
                                    <div className="grid grid-cols-3 gap-1.5 text-center py-2 bg-neutral-50/70 rounded-xl border border-neutral-100 text-xs">
                                        <div>
                                            <p className="font-extrabold text-neutral-900">{u.activeJobsCount || 0}</p>
                                            <p className="text-[9px] text-neutral-400 uppercase font-bold">Jobs</p>
                                        </div>
                                        <div className="border-x border-neutral-200">
                                            <p className="font-extrabold text-neutral-900">{u.activeCandidatesCount || 0}</p>
                                            <p className="text-[9px] text-neutral-400 uppercase font-bold">Pipeline</p>
                                        </div>
                                        <div>
                                            <p className="font-extrabold text-emerald-600">{u.placementsCount || 0}</p>
                                            <p className="text-[9px] text-neutral-400 uppercase font-bold">Placed</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Bottom Actions */}
                                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                                    <button
                                        onClick={() => {
                                            setEditUser(u);
                                            setEditModalOpen(true);
                                        }}
                                        className="text-neutral-500 hover:text-neutral-900 font-bold"
                                    >
                                        Quick Edit
                                    </button>
                                    <Link
                                        href={`/admin/team/${u.id}`}
                                        className="text-primary font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform"
                                    >
                                        View 360° Profile <ChevronRight size={12} />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* VIEW 3: TABLE LIST */}
            {viewMode === "list" && (
                isLoading ? (
                    <SectionCard><div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
                ) : list.length === 0 ? (
                    <SectionCard><EmptyState icon={Users} message="No team members yet." /></SectionCard>
                ) : (
                    <SectionCard>
                        <div className="overflow-x-auto -m-5">
                            <table className="w-full text-xs min-w-[850px]">
                                <thead>
                                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                                        <th className="px-5 py-3.5">Employee</th>
                                        <th className="px-3 py-3.5">Role</th>
                                        <th className="px-3 py-3.5">Department & Team</th>
                                        <th className="px-3 py-3.5">Primary Manager</th>
                                        <th className="px-3 py-3.5">Direct Reports</th>
                                        <th className="px-3 py-3.5">Status</th>
                                        <th className="px-5 py-3.5 text-right">Controls</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {list.map((u) => (
                                        <tr key={u.id} className="hover:bg-neutral-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                                        {u.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                                                    </div>
                                                    <div>
                                                        <Link href={`/admin/team/${u.id}`} className="font-bold text-neutral-900 hover:text-primary hover:underline">
                                                            {u.name}
                                                        </Link>
                                                        <p className="text-[10px] text-neutral-400">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3.5"><Badge value={u.role} /></td>
                                            <td className="px-3 py-3.5 text-neutral-600 font-medium">{u.department} · {u.team}</td>
                                            <td className="px-3 py-3.5 text-neutral-700 font-semibold">{u.reportingToName || "Aarav Mehta (Root)"}</td>
                                            <td className="px-3 py-3.5 font-bold text-neutral-800">{u.directReportsCount}</td>
                                            <td className="px-3 py-3.5"><Badge value={u.status} /></td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex justify-end gap-2 items-center">
                                                    <Link
                                                        href={`/admin/team/${u.id}`}
                                                        className="px-2.5 py-1 text-[11px] font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20"
                                                    >
                                                        360° Profile
                                                    </Link>
                                                    {!["SUSPENDED", "EXITED"].includes(u.status) && !u.id.endsWith("-sa") ? (
                                                        <button
                                                            onClick={() => patchMutation.mutate({ id: u.id, status: "SUSPENDED" })}
                                                            className="text-[11px] font-bold text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg"
                                                        >
                                                            Suspend
                                                        </button>
                                                    ) : !u.id.endsWith("-sa") ? (
                                                        <button
                                                            onClick={() => patchMutation.mutate({ id: u.id, status: "ACTIVE" })}
                                                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 hover:bg-emerald-50 rounded-lg"
                                                        >
                                                            Restore
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </SectionCard>
                )
            )}

            {/* Quick Edit Modal */}
            {editModalOpen && editUser && (
                <ModalShell
                    open={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    title={`Edit Member: ${editUser.name}`}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Designation / Job Title</label>
                            <input
                                value={editUser.designation || ""}
                                onChange={(e) => setEditUser({ ...editUser, designation: e.target.value })}
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Department</label>
                                <select
                                    value={editUser.department || "Talent Acquisition"}
                                    onChange={(e) => setEditUser({ ...editUser, department: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    <option value="Talent Acquisition">Talent Acquisition</option>
                                    <option value="Human Resources">Human Resources</option>
                                    <option value="Operations">Operations</option>
                                    <option value="Finance">Finance</option>
                                    <option value="Field">Field</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">System Role</label>
                                <select
                                    value={editUser.role}
                                    disabled={editUser.id.endsWith("-sa")}
                                    onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Primary Reporting Manager</label>
                            <select
                                value={editUser.reportingTo || ""}
                                disabled={editUser.id.endsWith("-sa")}
                                onChange={(e) => setEditUser({ ...editUser, reportingTo: e.target.value })}
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            >
                                <option value="">None / Root</option>
                                {managers.filter((m) => m.id !== editUser.id).map((m) => (
                                    <option key={m.id} value={m.id}>{m.name} ({m.designation || m.role})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setEditModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => patchMutation.mutate({
                                    id: editUser.id,
                                    designation: editUser.designation,
                                    department: editUser.department,
                                    role: editUser.role,
                                    reportingTo: editUser.reportingTo,
                                })}
                                disabled={patchMutation.isPending}
                                className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary-dark"
                            >
                                {patchMutation.isPending ? "Updating..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* Multi-step Add Member Modal */}
            <ModalShell
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Add Team Member & Assign Organizational Hierarchy"
                wide
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (step < 2) setStep(2);
                        else createMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    {/* Stepper Header */}
                    <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${step === 1 ? "bg-primary text-white" : "bg-neutral-100 text-neutral-500"}`}>
                            1. Profile & Identity
                        </span>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${step === 2 ? "bg-primary text-white" : "bg-neutral-100 text-neutral-500"}`}>
                            2. Organization & Reporting
                        </span>
                    </div>

                    {step === 1 ? (
                        <div className="space-y-3.5">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700">Full Name *</label>
                                    <input
                                        required
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="First & Last Name"
                                        className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700">Work Email *</label>
                                    <input
                                        type="email"
                                        required
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="colleague@absojob.com"
                                        className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700">Phone</label>
                                    <input
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        placeholder="+91 98..."
                                        className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700">Job Title / Designation</label>
                                    <input
                                        value={form.designation}
                                        onChange={(e) => setForm({ ...form, designation: e.target.value })}
                                        className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700">Department</label>
                                    <select
                                        value={form.department}
                                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                                        className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                    >
                                        <option value="Talent Acquisition">Talent Acquisition</option>
                                        <option value="Human Resources">Human Resources</option>
                                        <option value="Leadership">Leadership</option>
                                        <option value="Operations">Operations</option>
                                        <option value="Finance">Finance</option>
                                        <option value="Field">Field</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700">System Role</label>
                                    <select
                                        value={form.role}
                                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                                        className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                    >
                                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Primary Reporting Manager</label>
                                <select
                                    value={form.reportingTo}
                                    onChange={(e) => setForm({ ...form, reportingTo: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    <option value="">None / Self</option>
                                    {managers.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.designation || m.role})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-3 border-t border-neutral-100">
                        {step === 2 ? (
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                            >
                                ← Back
                            </button>
                        ) : <div />}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all shadow-md shadow-primary/20"
                            >
                                {step === 1 ? "Next: Hierarchy →" : createMutation.isPending ? "Inviting..." : "Confirm & Send Invitation"}
                            </button>
                        </div>
                    </div>
                </form>
            </ModalShell>
        </div>
    );
}
