"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api, useEmployeeOptions } from "@/lib/api";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { GraduationCap, Calendar, Users, BookOpen, Search, CheckCircle2, Filter, AlertCircle, Plus } from "lucide-react";

interface TrainingProgram {
    id: string;
    title: string;
    course: string;
    trainer: string;
    startDate: string;
    endDate: string;
    enrolledEmployeeIds: string[];
    status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED";
    description: string;
    enrolledEmployees?: { id: string; name: string; completed: boolean }[];
}

const inputCls = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none";

export default function HRTrainingPage() {
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const qc = useQueryClient();
    const { data: employeeOptions = [] } = useEmployeeOptions();
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState({ title: "", course: "", trainer: "", startDate: "", endDate: "", description: "" });
    const [manage, setManage] = useState<TrainingProgram | null>(null);
    const [enrollIds, setEnrollIds] = useState<string[]>([]);

    const mutate = useMutation({
        mutationFn: (args: { method: "POST" | "PATCH"; body: Record<string, unknown> }) => api<TrainingProgram>("/api/hr/training", args.method, args.body),
        onSuccess: (_d, args) => {
            toast.success(args.method === "POST" ? "Training program created" : "Training updated");
            setCreateOpen(false);
            setEnrollIds([]);
            setForm({ title: "", course: "", trainer: "", startDate: "", endDate: "", description: "" });
            qc.invalidateQueries({ queryKey: ["hr-training"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const { data: programs = [], isLoading } = useQuery<TrainingProgram[]>({
        queryKey: ["hr-training", statusFilter, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/training?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch training programs");
            return res.json();
        },
    });

    const current = manage ? programs.find((p) => p.id === manage.id) ?? manage : null;
    const upcomingCount = programs.filter((p) => p.status === "UPCOMING" || p.status === "IN_PROGRESS").length;
    const completedCount = programs.filter((p) => p.status === "COMPLETED").length;
    const totalEnrolled = programs.reduce((acc, p) => acc + (p.enrolledEmployeeIds?.length || 0), 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Learning & Development (L&D)"
                subtitle="Organize employee training workshops, skill development bootcamps, and compliance certifications."
                action={
                    <button onClick={() => setCreateOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2">
                        <Plus size={15} /> New Program
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Training Programs" value={programs.length} icon={GraduationCap} tone="primary" hint="Curriculum catalog" />
                <StatCard label="Active / Upcoming" value={upcomingCount} icon={Calendar} tone="amber" hint="Scheduled workshops" />
                <StatCard label="Completed Sessions" value={completedCount} icon={CheckCircle2} tone="emerald" hint="Certifications awarded" />
                <StatCard label="Total Enrollees" value={totalEnrolled} icon={Users} tone="purple" hint="Participant count" />
            </div>

            {/* Filters */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <Filter size={16} className="text-neutral-500" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="UPCOMING">Upcoming</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search title, course, trainer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Training Program Cards Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-4">
                            <SkeletonPulse className="h-6 w-3/4" />
                            <SkeletonPulse className="h-4 w-1/2" />
                            <SkeletonPulse className="h-16 w-full" />
                        </div>
                    ))}
                </div>
            ) : programs.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={AlertCircle} message="No training programs found matching your search." />
                </SectionCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {programs.map((prog) => (
                        <div key={prog.id} className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-6 flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1">
                                        <BookOpen size={12} /> {prog.course}
                                    </span>
                                    <Badge value={prog.status} />
                                </div>

                                <div>
                                    <h3 className="font-bold text-neutral-900 text-lg leading-snug">{prog.title}</h3>
                                    <p className="text-xs text-neutral-500 font-medium mt-1">Trainer: <span className="text-neutral-800 font-semibold">{prog.trainer}</span></p>
                                </div>

                                <p className="text-xs text-neutral-600 line-clamp-3 font-normal leading-relaxed">{prog.description}</p>
                            </div>

                            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 text-neutral-500 font-medium">
                                    <Calendar size={14} className="text-primary" />
                                    <span>{prog.startDate} to {prog.endDate}</span>
                                </div>

                                <button onClick={() => setManage(prog)} className="flex items-center gap-1 bg-neutral-100 hover:bg-primary/10 hover:text-primary px-2.5 py-1 rounded-full font-bold text-neutral-700">
                                    <Users size={12} />
                                    <span>{prog.enrolledEmployeeIds?.length || 0} Enrolled · Manage</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ModalShell open={createOpen} onClose={() => setCreateOpen(false)} title="New Training Program">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutate.mutate({ method: "POST", body: form }); }}>
                    <input required placeholder="Program title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
                    <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Course" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} className={inputCls} />
                        <input placeholder="Trainer" value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} className={inputCls} />
                        <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} />
                        <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputCls} />
                    </div>
                    <textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
                    <button disabled={mutate.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Create Program</button>
                </form>
            </ModalShell>

            <ModalShell open={!!current} onClose={() => setManage(null)} title={current ? current.title : ""} wide>
                {current && (
                    <div className="space-y-5 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-500">Status</span>
                            <select value={current.status} onChange={(e) => mutate.mutate({ method: "PATCH", body: { id: current.id, action: "status", status: e.target.value } })} className="px-2 py-1 rounded-lg border border-neutral-200 text-xs font-bold">
                                {["UPCOMING", "IN_PROGRESS", "COMPLETED"].map((s2) => <option key={s2} value={s2}>{s2.replace("_", " ")}</option>)}
                            </select>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold uppercase text-neutral-400 mb-2">Participants ({current.enrolledEmployees?.length ?? 0})</h4>
                            {(current.enrolledEmployees ?? []).length === 0 ? (
                                <p className="text-neutral-500">No one enrolled yet.</p>
                            ) : (
                                <ul className="space-y-1.5">
                                    {current.enrolledEmployees!.map((e) => (
                                        <li key={e.id} className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
                                            <span>{e.completed ? "🎓" : "•"} {e.name}</span>
                                            <span className="space-x-1.5">
                                                {!e.completed && <button onClick={() => mutate.mutate({ method: "PATCH", body: { id: current.id, action: "complete", employeeId: e.id } })} className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">Mark completed</button>}
                                                <button onClick={() => mutate.mutate({ method: "PATCH", body: { id: current.id, action: "unenroll", employeeId: e.id } })} className="px-2 py-0.5 rounded-lg text-neutral-500 text-xs font-bold hover:text-rose-600">Remove</button>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                            <h4 className="text-xs font-bold uppercase text-neutral-400 mb-2">Enroll employees</h4>
                            <select multiple value={enrollIds} onChange={(e) => setEnrollIds(Array.from(e.target.selectedOptions).map((o) => o.value))} className={`${inputCls} h-40`}>
                                {employeeOptions.filter((e) => !current.enrolledEmployeeIds.includes(e.id)).map((e) => (
                                    <option key={e.id} value={e.id}>{e.name} · {e.department}</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-neutral-400 mt-1">Hold Ctrl / Cmd to select several. Enrolled employees are notified.</p>
                            <button
                                disabled={!enrollIds.length || mutate.isPending}
                                onClick={() => mutate.mutate({ method: "PATCH", body: { id: current.id, action: "enroll", employeeIds: enrollIds } })}
                                className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50"
                            >
                                Enroll {enrollIds.length || ""}
                            </button>
                        </div>
                    </div>
                )}
            </ModalShell>
        </div>
    );
}
