"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, ShieldCheck, UserCog, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

const ROLES = ["TA_MANAGER", "TA_RECRUITER", "AGENT", "EMPLOYEE"] as const;

export default function TeamPage() {
    const qc = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", phone: "", role: "AGENT", department: "", designation: "" });

    const { data: team, isLoading } = useQuery({
        queryKey: ["team"],
        queryFn: async () => (await fetch("/api/admin/users")).json(),
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Team member added — invite email simulated.");
            setModalOpen(false);
            setForm({ name: "", email: "", phone: "", role: "AGENT", department: "", designation: "" });
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
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
        onError: () => toast.error("Update failed"),
    });

    const list = Array.isArray(team) ? team : [];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Team Management"
                subtitle="Recruiters, field agents & employees — roles, status and reporting"
                action={
                    <button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2">
                        <UserPlus size={16} /> Add Member
                    </button>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Active" value={list.filter((u: any) => u.status === "ACTIVE").length} icon={Users} tone="primary" />
                <StatCard label="TA Team" value={list.filter((u: any) => u.role.startsWith("TA_") && u.status === "ACTIVE").length} icon={UserCog} tone="purple" />
                <StatCard label="Field Agents" value={list.filter((u: any) => u.role === "AGENT" && u.status === "ACTIVE").length} icon={ShieldCheck} tone="emerald" />
                <StatCard label="Suspended / Exited" value={list.filter((u: any) => ["SUSPENDED", "EXITED"].includes(u.status)).length} icon={Ban} tone="red" />
            </div>

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : list.length === 0 ? (
                <SectionCard><EmptyState icon={Users} message="No team members yet." /></SectionCard>
            ) : (
                <SectionCard>
                    <div className="overflow-x-auto -m-5">
                        <table className="w-full text-sm min-w-[760px]">
                            <thead>
                                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                                    <th className="px-5 py-3">Member</th>
                                    <th className="px-3 py-3">Role</th>
                                    <th className="px-3 py-3">Department</th>
                                    <th className="px-3 py-3">Reports To</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3 text-right">Controls</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {list.map((u: any) => (
                                    <tr key={u.id} className="hover:bg-neutral-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                                    {u.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-neutral-900">{u.name}</p>
                                                    <p className="text-xs text-neutral-400">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3.5"><Badge value={u.role} /></td>
                                        <td className="px-3 py-3.5 text-neutral-600 font-medium">{u.department ?? "—"}</td>
                                        <td className="px-3 py-3.5 text-neutral-600 font-medium">{u.reportingToName ?? "—"}</td>
                                        <td className="px-3 py-3.5"><Badge value={u.status} /></td>
                                        <td className="px-3 py-3.5">
                                            <div className="flex justify-end gap-2">
                                                <select
                                                    value={u.role}
                                                    disabled={u.id.endsWith("-sa")}
                                                    onChange={(e) => patchMutation.mutate({ id: u.id, role: e.target.value })}
                                                    className="text-[11px] font-semibold px-2 py-1.5 rounded-lg border border-neutral-200 bg-white outline-none focus:border-primary disabled:opacity-40"
                                                >
                                                    {[...ROLES].map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
                                                </select>
                                                {!["SUSPENDED", "EXITED"].includes(u.status) && !u.id.endsWith("-sa") ? (
                                                    <button onClick={() => patchMutation.mutate({ id: u.id, status: "SUSPENDED" })}
                                                        className="text-[11px] font-bold text-red-500 hover:text-red-700 px-2 py-1.5 hover:bg-red-50 rounded-lg transition-colors">Suspend</button>
                                                ) : !u.id.endsWith("-sa") ? (
                                                    <button onClick={() => patchMutation.mutate({ id: u.id, status: "ACTIVE" })}
                                                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1.5 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1">
                                                        <RotateCcw size={11} /> Restore
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
            )}

            <ModalShell open={modalOpen} onClose={() => setModalOpen(false)} title="Add Team Member" wide>
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name *</span>
                            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email *</span>
                            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Phone</span>
                            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Role *</span>
                            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white">
                                {ROLES.map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
                            </select></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Department</span>
                            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                        <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Designation</span>
                            <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                    </div>
                    <p className="text-xs text-neutral-400">Default password for demo logins: <strong className="text-neutral-600">demo123</strong></p>
                    <button disabled={createMutation.isPending} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25">
                        {createMutation.isPending ? "Adding..." : "Add Member"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
