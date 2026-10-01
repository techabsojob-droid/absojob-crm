"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    CheckSquare, Square, CheckCircle2, Clock, AlertTriangle, Plus,
    Search, Filter, Download, User, Calendar, Briefcase, ChevronRight,
    X, MoreHorizontal, ArrowRight, Check, SlidersHorizontal, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";

const TASK_TYPES = [
    { id: "CANDIDATE_FOLLOWUP", label: "Candidate Follow-up" },
    { id: "INTERVIEW_FEEDBACK", label: "Interview Feedback" },
    { id: "CLIENT_FOLLOWUP", label: "Client Follow-up" },
    { id: "DOC_VERIFICATION", label: "Document Verification" },
    { id: "OFFER_FOLLOWUP", label: "Offer Follow-up" },
    { id: "REQUISITION_ACTION", label: "Requisition Action" },
    { id: "GENERAL", label: "General Action" },
] as const;

export default function TaTasksPage() {
    const qc = useQueryClient();

    // Tabs & Filters
    const [activeTab, setActiveTab] = useState<"my" | "all" | "today" | "overdue" | "high" | "completed">("my");
    const [searchQuery, setSearchQuery] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [createModalOpen, setCreateModalOpen] = useState(false);

    // Form: Create Task
    const [taskForm, setTaskForm] = useState({
        title: "",
        description: "",
        type: "CANDIDATE_FOLLOWUP",
        priority: "HIGH",
        dueDate: new Date().toISOString().split("T")[0],
        candidateId: "",
        jobId: "",
    });

    // Fetch Tasks
    const { data: tasks, isLoading } = useQuery({
        queryKey: ["ta-tasks-all"],
        queryFn: async () => {
            const res = await fetch("/api/admin/tasks");
            if (!res.ok) throw new Error("Failed to fetch tasks");
            return res.json();
        },
        refetchInterval: 25000,
    });

    // Fetch Candidates for linking
    const { data: candidates } = useQuery({
        queryKey: ["ta-candidates-dropdown"],
        queryFn: async () => {
            const res = await fetch("/api/admin/candidates");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Fetch Jobs for linking
    const { data: jobs } = useQuery({
        queryKey: ["ta-jobs-dropdown"],
        queryFn: async () => {
            const res = await fetch("/api/admin/jobs");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Toggle Task Complete Mutation
    const completeMutation = useMutation({
        mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
            const res = await fetch("/api/admin/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, completed }),
            });
            if (!res.ok) throw new Error("Failed to update task");
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.completed ? "Task marked completed! 🎯" : "Task reopened.");
            qc.invalidateQueries({ queryKey: ["ta-tasks-all"] });
            qc.invalidateQueries({ queryKey: ["ta-dashboard"] });
        },
        onError: () => toast.error("Could not update task"),
    });

    // Snooze Task Mutation
    const snoozeMutation = useMutation({
        mutationFn: async ({ id, days }: { id: string; days: number }) => {
            const newDate = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
            const res = await fetch("/api/admin/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, dueDate: newDate }),
            });
            if (!res.ok) throw new Error("Failed to snooze task");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Task snoozed successfully! ⏰");
            qc.invalidateQueries({ queryKey: ["ta-tasks-all"] });
        },
        onError: () => toast.error("Could not snooze task"),
    });

    // Create Task Mutation
    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/admin/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to create task");
            return res.json();
        },
        onSuccess: () => {
            toast.success("New recruitment task created!");
            setCreateModalOpen(false);
            setTaskForm({
                title: "",
                description: "",
                type: "CANDIDATE_FOLLOWUP",
                priority: "HIGH",
                dueDate: new Date().toISOString().split("T")[0],
                candidateId: "",
                jobId: "",
            });
            qc.invalidateQueries({ queryKey: ["ta-tasks-all"] });
            qc.invalidateQueries({ queryKey: ["ta-dashboard"] });
        },
        onError: () => toast.error("Failed to create task"),
    });

    const allList = Array.isArray(tasks) ? tasks : [];
    const candidateList = Array.isArray(candidates) ? candidates : [];
    const jobList = Array.isArray(jobs) ? jobs : [];

    // KPI Metrics
    const metrics = useMemo(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const open = allList.filter((t: any) => !t.completed);
        const dueToday = open.filter((t: any) => t.dueDate && t.dueDate.startsWith(todayStr));
        const overdue = open.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date(todayStr));
        const highPriority = open.filter((t: any) => t.priority === "HIGH" || t.priority === "CRITICAL" || t.priority === "URGENT");
        const completed = allList.filter((t: any) => t.completed);

        return {
            open: open.length,
            dueToday: dueToday.length,
            overdue: overdue.length,
            highPriority: highPriority.length,
            completed: completed.length,
        };
    }, [allList]);

    // Filtered Tasks
    const filteredList = useMemo(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        let list = [...allList];

        if (activeTab === "my") {
            list = list.filter((t) => !t.completed);
        } else if (activeTab === "all") {
            list = list.filter((t) => !t.completed);
        } else if (activeTab === "today") {
            list = list.filter((t) => !t.completed && t.dueDate && t.dueDate.startsWith(todayStr));
        } else if (activeTab === "overdue") {
            list = list.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) < new Date(todayStr));
        } else if (activeTab === "high") {
            list = list.filter((t) => !t.completed && (t.priority === "HIGH" || t.priority === "CRITICAL" || t.priority === "URGENT"));
        } else if (activeTab === "completed") {
            list = list.filter((t) => t.completed);
        }

        if (priorityFilter !== "ALL") {
            list = list.filter((t) => t.priority === priorityFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (t) =>
                    t.title?.toLowerCase().includes(q) ||
                    t.description?.toLowerCase().includes(q) ||
                    t.assignedToName?.toLowerCase().includes(q)
            );
        }

        return list;
    }, [allList, activeTab, priorityFilter, searchQuery]);

    // Export CSV
    const exportCsv = () => {
        if (filteredList.length === 0) {
            toast.error("No tasks to export");
            return;
        }

        const headers = ["Task ID", "Title", "Description", "Priority", "Due Date", "Status", "Assigned To"];
        const rows = filteredList.map((t) => [
            t.id,
            `"${t.title?.replace(/"/g, '""')}"`,
            `"${(t.description || "")?.replace(/"/g, '""')}"`,
            t.priority,
            t.dueDate || "None",
            t.completed ? "COMPLETED" : "OPEN",
            `"${t.assignedToName || "Unassigned"}"`,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `AbsoJob_Tasks_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${filteredList.length} tasks to CSV.`);
    };

    return (
        <div className="space-y-6 pb-16 max-w-[1600px] mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Action Center
                        </span>
                        <span className="text-xs text-neutral-400 font-bold">Recruitment Operations Tasks</span>
                    </div>
                    <h1 className="text-2xl font-black text-neutral-900 mt-0.5">Tasks</h1>
                    <p className="text-xs text-neutral-500 font-medium">
                        Manage recruiter follow-ups, interview scorecards, candidate screenings, and requisition action items.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={exportCsv}
                        className="px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                        <Download size={14} /> Export
                    </button>
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all hover:scale-[1.02]"
                    >
                        <Plus size={15} /> + New Task
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard
                    label="Open Action Items"
                    value={metrics.open}
                    icon={CheckSquare}
                    tone="primary"
                    hint="Pending completion"
                />
                <StatCard
                    label="Due Today"
                    value={metrics.dueToday}
                    icon={Clock}
                    tone={metrics.dueToday > 0 ? "blue" : "neutral"}
                    hint="Requires attention"
                />
                <StatCard
                    label="Overdue"
                    value={metrics.overdue}
                    icon={AlertTriangle}
                    tone={metrics.overdue > 0 ? "red" : "emerald"}
                    hint="Past SLA deadline"
                />
                <StatCard
                    label="High Priority"
                    value={metrics.highPriority}
                    icon={Briefcase}
                    tone="purple"
                    hint="Urgent recruitment tasks"
                />
                <StatCard
                    label="Completed"
                    value={metrics.completed}
                    icon={CheckCircle2}
                    tone="emerald"
                    hint="Finished tasks"
                />
            </div>

            {/* Filter Bar & Tabs */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tasks, descriptions, assignees…"
                            className="w-full pl-9 pr-8 py-2 bg-neutral-50/80 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white focus:border-primary outline-none transition-all placeholder:text-neutral-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Priority Filter */}
                    <div className="flex items-center gap-2">
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer"
                        >
                            <option value="ALL">All Priorities</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-neutral-100">
                    {[
                        { id: "my", label: `My Open Tasks (${metrics.open})` },
                        { id: "today", label: `Due Today (${metrics.dueToday})` },
                        { id: "overdue", label: `Overdue (${metrics.overdue})` },
                        { id: "high", label: `High Priority (${metrics.highPriority})` },
                        { id: "completed", label: `Completed (${metrics.completed})` },
                        { id: "all", label: `All (${allList.length})` },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${activeTab === t.id
                                ? "bg-primary text-white shadow-xs"
                                : "bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 text-neutral-600"
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Task Items List */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-neutral-100" />
                    ))}
                </div>
            ) : filteredList.length === 0 ? (
                <SectionCard>
                    <EmptyState
                        icon={CheckSquare}
                        message="No recruitment tasks found in this view."
                        action={
                            <button
                                onClick={() => setCreateModalOpen(true)}
                                className="mt-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
                            >
                                Create Task
                            </button>
                        }
                    />
                </SectionCard>
            ) : (
                <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs divide-y divide-neutral-100 overflow-hidden">
                    {filteredList.map((t: any) => {
                        const todayStr = new Date().toISOString().split("T")[0];
                        const isOverdue = !t.completed && t.dueDate && new Date(t.dueDate) < new Date(todayStr);
                        const isDueToday = !t.completed && t.dueDate && t.dueDate.startsWith(todayStr);

                        return (
                            <div
                                key={t.id}
                                className={`p-4 flex items-center justify-between gap-4 transition-colors ${t.completed ? "bg-neutral-50/50 opacity-60" : "hover:bg-neutral-50/70"
                                    }`}
                            >
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                    <button
                                        onClick={() => completeMutation.mutate({ id: t.id, completed: !t.completed })}
                                        disabled={completeMutation.isPending}
                                        className={`shrink-0 transition-colors ${t.completed ? "text-emerald-600" : "text-neutral-300 hover:text-primary"
                                            }`}
                                        title={t.completed ? "Reopen task" : "Mark as completed"}
                                    >
                                        {t.completed ? <CheckCircle2 size={22} /> : <Square size={22} />}
                                    </button>

                                    <div className="min-w-0 space-y-0.5">
                                        <p className={`text-sm font-bold truncate ${t.completed ? "line-through text-neutral-400" : "text-neutral-900"
                                            }`}>
                                            {t.title}
                                        </p>
                                        {t.description && (
                                            <p className="text-xs text-neutral-500 line-clamp-1">{t.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 text-[10px] text-neutral-400 flex-wrap">
                                            <span>Assigned to <strong className="text-neutral-700">{t.assignedToName || "Neha Kulkarni"}</strong></span>
                                            {t.dueDate && (
                                                <>
                                                    <span>•</span>
                                                    <span className={`font-bold ${isOverdue ? "text-red-600" : isDueToday ? "text-blue-600" : "text-neutral-500"}`}>
                                                        Due: {new Date(t.dueDate).toLocaleDateString("en-IN")}
                                                        {isOverdue && " (Overdue)"}
                                                        {isDueToday && " (Today)"}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <Badge value={isOverdue ? "OVERDUE" : t.priority} />

                                    {/* Quick Snooze Actions */}
                                    {!t.completed && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => snoozeMutation.mutate({ id: t.id, days: 1 })}
                                                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-md text-[10px] font-bold"
                                                title="Snooze 1 Day"
                                            >
                                                +1d
                                            </button>
                                            <button
                                                onClick={() => snoozeMutation.mutate({ id: t.id, days: 3 })}
                                                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-md text-[10px] font-bold"
                                                title="Snooze 3 Days"
                                            >
                                                +3d
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Create Task */}
            {createModalOpen && (
                <ModalShell
                    title="Create Recruitment Task"
                    onClose={() => setCreateModalOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!taskForm.title) {
                                toast.error("Please enter task title");
                                return;
                            }
                            createMutation.mutate({
                                title: taskForm.title,
                                description: taskForm.description,
                                priority: taskForm.priority,
                                dueDate: taskForm.dueDate,
                            });
                        }}
                        className="space-y-4"
                    >
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Task Title *</label>
                            <input
                                type="text"
                                required
                                value={taskForm.title}
                                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                                placeholder="e.g. Follow up on salary counter-offer with candidate"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-700">Description</label>
                            <textarea
                                rows={3}
                                value={taskForm.description}
                                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                                placeholder="Action details, notes, expected outcome…"
                                className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Priority</label>
                                <select
                                    value={taskForm.priority}
                                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-bold"
                                >
                                    <option value="CRITICAL">Critical</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Due Date</label>
                                <input
                                    type="date"
                                    value={taskForm.dueDate}
                                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Related Candidate (Optional)</label>
                                <select
                                    value={taskForm.candidateId}
                                    onChange={(e) => setTaskForm({ ...taskForm, candidateId: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                >
                                    <option value="">None</option>
                                    {candidateList.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-neutral-700">Related Requisition (Optional)</label>
                                <select
                                    value={taskForm.jobId}
                                    onChange={(e) => setTaskForm({ ...taskForm, jobId: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl truncate"
                                >
                                    <option value="">None</option>
                                    {jobList.map((j: any) => (
                                        <option key={j.id} value={j.id}>{j.title}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setCreateModalOpen(false)}
                                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                            >
                                {createMutation.isPending ? "Creating…" : "Create Task"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
