"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Search, Plus, Calendar, Clock, AlertTriangle, UserCheck, CheckCircle2, ChevronRight, Filter } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import type { Task } from "@/lib/types";
import { AssigneeSelect } from "@/components/shared/AssigneeSelect";

export default function AdminTasksPage() {
    const qc = useQueryClient();
    const [q, setQ] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [completedFilter, setCompletedFilter] = useState("false");
    const [createOpen, setCreateOpen] = useState(false);

    const [form, setForm] = useState({
        title: "",
        description: "",
        dueDate: "",
        priority: "HIGH",
        assignedToId: "",
    });

    const { data: tasks = [], isLoading } = useQuery<any[]>({
        queryKey: ["admin-tasks", q, priorityFilter, completedFilter],
        queryFn: async () => {
            const res = await fetch(`/api/admin/tasks?q=${encodeURIComponent(q)}&priority=${priorityFilter}&completed=${completedFilter}`);
            if (!res.ok) throw new Error();
            return res.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: () => {
            toast.success("Task created and assigned.");
            setCreateOpen(false);
            setForm({ title: "", description: "", dueDate: "", priority: "HIGH", assignedToId: "" });
            qc.invalidateQueries({ queryKey: ["admin-tasks"] });
        },
        onError: () => toast.error("Error creating task"),
    });

    const patchMutation = useMutation({
        mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
            const res = await fetch("/api/admin/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, completed }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: (_data, vars) => {
            toast.success(vars.completed ? "Task marked completed!" : "Task re-opened.");
            qc.invalidateQueries({ queryKey: ["admin-tasks"] });
        },
        onError: () => toast.error("Update failed"),
    });

    const pendingTasks = tasks.filter((t) => !t.completed);
    const urgentTasks = tasks.filter((t) => t.priority === "URGENT" && !t.completed);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Operational Tasks & Follow-ups"
                subtitle="Agency-wide task queue: candidate documentation, interview feedback reminders, and client follow-ups"
                action={
                    <button
                        onClick={() => setCreateOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:bg-primary/95 transition-all"
                    >
                        <Plus size={16} /> New Operational Task
                    </button>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pending Tasks" value={pendingTasks.length} icon={Clock} tone="amber" hint="active deliverables" />
                <StatCard label="Urgent Priority" value={urgentTasks.length} icon={AlertTriangle} tone={urgentTasks.length > 0 ? "red" : "emerald"} hint="immediate action needed" />
                <StatCard label="Due Today" value="3" icon={Calendar} tone="blue" hint="scheduled before 6 PM" />
                <StatCard label="Completion Rate" value="84%" icon={CheckCircle2} tone="emerald" hint="this calendar week" />
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-100 shadow-sm">
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search tasks, descriptions..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-neutral-100 p-0.5 rounded-xl">
                        <button
                            onClick={() => setCompletedFilter("false")}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                completedFilter === "false" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                            }`}
                        >
                            Active Pending
                        </button>
                        <button
                            onClick={() => setCompletedFilter("true")}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                completedFilter === "true" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                            }`}
                        >
                            Completed
                        </button>
                    </div>
                </div>
            </div>

            {/* Task List */}
            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-16 rounded-xl" />
                    ))}
                </div>
            ) : tasks.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={CheckSquare} message="No tasks found matching current filters." />
                </SectionCard>
            ) : (
                <div className="space-y-2.5">
                    {tasks.map((t) => (
                        <div
                            key={t.id}
                            className={`p-4 bg-white rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                                t.completed
                                    ? "border-neutral-100 opacity-60 bg-neutral-50/50"
                                    : t.priority === "URGENT"
                                    ? "border-red-200 shadow-sm"
                                    : "border-neutral-100 shadow-sm"
                            }`}
                        >
                            <div className="flex items-start gap-3.5">
                                <input
                                    type="checkbox"
                                    checked={t.completed}
                                    onChange={(e) => patchMutation.mutate({ id: t.id, completed: e.target.checked })}
                                    className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary/20 cursor-pointer"
                                />
                                <div>
                                    <h4 className={`text-xs font-bold ${t.completed ? "line-through text-neutral-500" : "text-neutral-900"}`}>
                                        {t.title}
                                    </h4>
                                    {t.description && (
                                        <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{t.description}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                        <span className="text-[10px] font-semibold text-neutral-400">
                                            Assigned to: <strong className="text-neutral-700">{t.assignedToName}</strong>
                                        </span>
                                        {t.dueDate && (
                                            <span className="text-[10px] font-semibold text-neutral-500 flex items-center gap-1">
                                                <Calendar size={12} /> Due: {t.dueDate}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                                <Badge value={t.priority} label={t.priority} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Task Modal */}
            {createOpen && (
                <ModalShell
                    title="Create Operational Task"
                    onClose={() => setCreateOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            createMutation.mutate();
                        }}
                        className="space-y-3"
                    >
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Task Title</label>
                            <input
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="e.g. Follow up with client regarding tech round feedback"
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Description</label>
                            <textarea
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Additional details, candidate links, phone logs..."
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                        </div>
                        <AssigneeSelect value={form.assignedToId} onChange={(id) => setForm({ ...form, assignedToId: id })} />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Due Date</label>
                                <input
                                    type="date"
                                    value={form.dueDate}
                                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Priority</label>
                                <select
                                    value={form.priority}
                                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                    <option value="URGENT">Urgent</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                            <button
                                type="button"
                                onClick={() => setCreateOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary/95"
                            >
                                {createMutation.isPending ? "Assigning..." : "Assign Task"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
