"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, CheckCircle2, Square } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Badge, SectionCard, EmptyState } from "@/components/shared/ui";

export default function PortalTasksPage() {
    const qc = useQueryClient();

    const { data: tasks, isLoading } = useQuery({
        queryKey: ["portal-tasks"],
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
            toast.success("Task done ✅");
            qc.invalidateQueries({ queryKey: ["portal-tasks"] });
            qc.invalidateQueries({ queryKey: ["portal-dashboard"] });
        },
        onError: () => toast.error("Failed to update task"),
    });

    const list = Array.isArray(tasks) ? tasks : [];
    const pending = list.filter((t: any) => t.status === "PENDING");
    const completed = list.filter((t: any) => t.status === "COMPLETED");

    return (
        <div className="space-y-6">
            <PageHeader title="My Tasks" subtitle={`${pending.length} pending · ${completed.length} completed`} />

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : list.length === 0 ? (
                <SectionCard><EmptyState icon={CheckSquare} message="Nothing on your plate. Enjoy!" /></SectionCard>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <SectionCard title={`To-do (${pending.length})`}>
                        {pending.length === 0 ? (
                            <EmptyState icon={CheckCircle2} message="All caught up!" />
                        ) : (
                            <div className="divide-y divide-neutral-50 -mx-5 px-5">
                                {pending.map((t: any) => {
                                    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
                                    return (
                                        <div key={t.id} className="py-3.5 flex items-start gap-3.5">
                                            <button onClick={() => completeMutation.mutate(t.id)} disabled={completeMutation.isPending}
                                                className="shrink-0 text-neutral-300 hover:text-primary transition-colors disabled:opacity-40 mt-0.5" title="Mark complete">
                                                <Square size={20} />
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-neutral-900">{t.title}</p>
                                                <p className="text-[11px] text-neutral-400 mt-0.5">by {t.createdByName}{t.dueDate && ` · due ${new Date(t.dueDate).toLocaleDateString("en-IN")}`}</p>
                                            </div>
                                            <Badge value={isOverdue ? "OVERDUE" : t.priority} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard title={`Completed (${completed.length})`}>
                        {completed.length === 0 ? (
                            <EmptyState icon={Square} message="Complete a task to see it here." />
                        ) : (
                            <div className="divide-y divide-neutral-50 -mx-5 px-5 max-h-[400px] overflow-y-auto">
                                {completed.map((t: any) => (
                                    <div key={t.id} className="py-3 flex items-center gap-3 opacity-60">
                                        <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-neutral-500 line-through truncate">{t.title}</p>
                                            <p className="text-[10px] text-neutral-400">done {new Date(t.completedAt).toLocaleDateString("en-IN")}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}
        </div>
    );
}
