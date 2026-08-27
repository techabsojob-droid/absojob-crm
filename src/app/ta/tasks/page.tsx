"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Square, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";

export default function TaTasksPage() {
    const qc = useQueryClient();

    const { data: tasks, isLoading } = useQuery({
        queryKey: ["tasks"],
        queryFn: async () => (await fetch("/api/portal/tasks")).json(),
        refetchInterval: 30000,
    });

    const completeMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/portal/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: () => {
            toast.success("Task completed 🎯");
            qc.invalidateQueries({ queryKey: ["tasks"] });
            qc.invalidateQueries({ queryKey: ["ta-dashboard"] });
        },
        onError: () => toast.error("Failed to complete task"),
    });

    const list = Array.isArray(tasks) ? tasks : [];
    const pending = list.filter((t: any) => t.status === "PENDING");
    const overdue = pending.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date());

    return (
        <div className="space-y-6">
            <PageHeader title="My Tasks" subtitle="Follow-ups, sourcing targets & admin actions assigned to you" />

            <div className="grid grid-cols-3 gap-4">
                <StatCard label="Pending" value={pending.length} icon={CheckSquare} tone={pending.length > 5 ? "red" : "primary"} />
                <StatCard label="Overdue" value={overdue.length} icon={Square} tone={overdue.length ? "red" : "emerald"} />
                <StatCard label="Completed" value={list.filter((t: any) => t.status === "COMPLETED").length} icon={CheckCircle2} tone="emerald" />
            </div>

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : (
                <SectionCard title={`To-do (${pending.length})`}>
                    {list.length === 0 ? (
                        <EmptyState icon={CheckSquare} message="No tasks assigned yet." />
                    ) : (
                        <div className="divide-y divide-neutral-50 -mx-5 px-5">
                            {[...pending, ...list.filter((t: any) => t.status === "COMPLETED")].map((t: any) => {
                                const isOverdue = t.status === "PENDING" && t.dueDate && new Date(t.dueDate) < new Date();
                                return (
                                    <div key={t.id} className={`py-3.5 flex items-center gap-3.5 ${t.status === "COMPLETED" ? "opacity-50" : ""}`}>
                                        <button
                                            onClick={() => t.status === "PENDING" && completeMutation.mutate(t.id)}
                                            disabled={completeMutation.isPending || t.status === "COMPLETED"}
                                            className={`shrink-0 transition-colors disabled:cursor-default ${t.status === "COMPLETED" ? "text-emerald-500" : "text-neutral-300 hover:text-primary"}`}
                                            title={t.status === "COMPLETED" ? "Done" : "Mark complete"}
                                        >
                                            {t.status === "COMPLETED" ? <CheckCircle2 size={22} /> : <Square size={20} />}
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-bold ${t.status === "COMPLETED" ? "line-through text-neutral-400" : "text-neutral-900"}`}>{t.title}</p>
                                            <p className="text-[11px] text-neutral-400 mt-0.5">
                                                by {t.createdByName}
                                                {t.dueDate && ` · due ${new Date(t.dueDate).toLocaleDateString("en-IN")}`}
                                                {t.completedAt && ` · done ${new Date(t.completedAt).toLocaleDateString("en-IN")}`}
                                            </p>
                                        </div>
                                        <Badge value={isOverdue ? "OVERDUE" : t.priority} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>
            )}
        </div>
    );
}
