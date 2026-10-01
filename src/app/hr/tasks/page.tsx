"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    CheckSquare, Clock, AlertCircle, Plus, Search, Filter,
    Calendar, CheckCircle2, User, Flag, X, ArrowUpDown
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AssigneeSelect } from "@/components/shared/AssigneeSelect";

interface TaskItem {
    id: string;
    title: string;
    description: string | null;
    assignedToId: string;
    assignedToName: string;
    createdByName: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate: string;
    completed: boolean;
    completedAt: string | null;
    createdAt: string;
}

export default function HRTasksPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<"ALL" | "MY_TASKS" | "DUE_TODAY" | "OVERDUE" | "COMPLETED">("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [createModalOpen, setCreateModalOpen] = useState(false);

    // Form state for creating task
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
    const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
    const [assignedToId, setAssignedToId] = useState("");

    const { data: tasks = [], isLoading } = useQuery<TaskItem[]>({
        queryKey: ["hr-tasks", activeTab, priorityFilter, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (activeTab === "MY_TASKS") params.set("assignedTo", "ME");
            if (activeTab === "COMPLETED") params.set("status", "COMPLETED");
            if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/tasks?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch tasks");
            return res.json();
        },
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
            const res = await fetch("/api/hr/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, completed }),
            });
            if (!res.ok) throw new Error("Failed to update task");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-tasks"] });
            toast.success("Task updated");
        },
        onError: () => {
            toast.error("Failed to update task");
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: { title: string; description: string; priority: string; dueDate: string; assignedToId: string }) => {
            const res = await fetch("/api/hr/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to create task");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-tasks"] });
            toast.success("New HR task created successfully");
            setCreateModalOpen(false);
            setTitle("");
            setDescription("");
            setAssignedToId("");
        },
        onError: () => {
            toast.error("Failed to create task");
        },
    });

    const todayStr = new Date().toISOString().split("T")[0];

    const totalActive = tasks.filter((t) => !t.completed).length;
    const dueTodayCount = tasks.filter((t) => !t.completed && t.dueDate === todayStr).length;
    const overdueCount = tasks.filter((t) => !t.completed && t.dueDate < todayStr).length;
    const highPriorityCount = tasks.filter((t) => !t.completed && (t.priority === "HIGH" || t.priority === "URGENT")).length;

    // Filter display list
    let displayedTasks = tasks;
    if (activeTab === "DUE_TODAY") {
        displayedTasks = tasks.filter((t) => !t.completed && t.dueDate === todayStr);
    } else if (activeTab === "OVERDUE") {
        displayedTasks = tasks.filter((t) => !t.completed && t.dueDate < todayStr);
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="HR Task Management"
                subtitle="Assign, track, and complete daily operational actions across onboarding, payroll, leave, and compliance."
                action={
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-xs"
                    >
                        <Plus size={16} /> New Task
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Active Tasks" value={totalActive} icon={CheckSquare} tone="primary" hint="Pending completion" />
                <StatCard label="Due Today" value={dueTodayCount} icon={Clock} tone="amber" hint="Action required today" />
                <StatCard label="Overdue" value={overdueCount} icon={AlertCircle} tone="red" hint="Needs immediate follow-up" />
                <StatCard label="High / Urgent Priority" value={highPriorityCount} icon={Flag} tone="purple" hint="Critical SLA mandates" />
            </div>

            {/* Filter Tabs & Search Controls */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                        {(["ALL", "MY_TASKS", "DUE_TODAY", "OVERDUE", "COMPLETED"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                                    activeTab === tab
                                        ? "bg-primary text-white shadow-xs"
                                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                }`}
                            >
                                {tab.replace("_", " ")}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="px-3 py-2 bg-neutral-100 text-xs font-bold text-neutral-700 rounded-xl border border-neutral-200 focus:outline-none"
                        >
                            <option value="ALL">All Priorities</option>
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                        </select>

                        <div className="relative w-48 md:w-64">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-neutral-100 rounded-xl text-xs font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* Task List Table */}
            <SectionCard title={`Tasks (${displayedTasks.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-6 h-6 rounded" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-28" />
                            </div>
                        ))}
                    </div>
                ) : displayedTasks.length === 0 ? (
                    <EmptyState icon={CheckCircle2} message="No tasks matching the selected filters. You are completely caught up!" />
                ) : (
                    <div className="divide-y divide-neutral-100">
                        {displayedTasks.map((t) => {
                            const isOverdue = !t.completed && t.dueDate < todayStr;
                            return (
                                <div
                                    key={t.id}
                                    className={`py-3.5 px-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-neutral-50 rounded-xl transition-colors ${
                                        t.completed ? "opacity-60 bg-neutral-50/50" : ""
                                    }`}
                                >
                                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                        <button
                                            onClick={() => toggleMutation.mutate({ id: t.id, completed: !t.completed })}
                                            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                                t.completed
                                                    ? "bg-primary border-primary text-white"
                                                    : "border-neutral-300 hover:border-primary text-transparent"
                                            }`}
                                        >
                                            <CheckCircle2 size={13} strokeWidth={3} />
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className={`text-sm font-bold text-neutral-900 leading-snug ${
                                                    t.completed ? "line-through text-neutral-500" : ""
                                                }`}
                                            >
                                                {t.title}
                                            </p>
                                            {t.description && (
                                                <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                                                    {t.description}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-neutral-400">
                                                <span className="flex items-center gap-1 font-medium text-neutral-600">
                                                    <User size={12} /> {t.assignedToName}
                                                </span>
                                                <span className="text-neutral-300">•</span>
                                                <span
                                                    className={`flex items-center gap-1 font-medium ${
                                                        isOverdue ? "text-red-600 font-bold" : "text-neutral-500"
                                                    }`}
                                                >
                                                    <Calendar size={12} /> Due: {t.dueDate}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                                        <span
                                            className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded ${
                                                t.priority === "URGENT"
                                                    ? "bg-red-100 text-red-700 border border-red-200"
                                                    : t.priority === "HIGH"
                                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                    : t.priority === "MEDIUM"
                                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                    : "bg-neutral-100 text-neutral-600"
                                            }`}
                                        >
                                            {t.priority}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>

            {/* Create Task Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-100 p-6 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <h3 className="font-bold text-base text-neutral-900">Create New HR Task</h3>
                            <button
                                onClick={() => setCreateModalOpen(false)}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Title *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Verify PF deduction for September batch"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Description</label>
                                <textarea
                                    rows={3}
                                    placeholder="Add any specific context or instructions..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <AssigneeSelect
                                value={assignedToId}
                                onChange={setAssignedToId}
                                labelClassName="text-xs font-bold text-neutral-700 block mb-1"
                                className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200 focus:outline-none"
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Priority</label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200 focus:outline-none"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                onClick={() => setCreateModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!title.trim()) {
                                        toast.error("Please enter a task title");
                                        return;
                                    }
                                    createMutation.mutate({ title, description, priority, dueDate, assignedToId });
                                }}
                                disabled={createMutation.isPending}
                                className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-xs hover:bg-primary/90 transition-colors"
                            >
                                {createMutation.isPending ? "Creating..." : "Create Task"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
