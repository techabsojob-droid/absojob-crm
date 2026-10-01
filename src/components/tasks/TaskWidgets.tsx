"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Calendar, CheckSquare, MessageSquare, Plus } from "lucide-react";
import { taskLinkFor } from "@/lib/tasks/rules";
import type { UserRole } from "@/lib/types";
import { Avatar, PriorityIcon, StatusPill, TypeIcon, fmtDate, type TaskMeta, type TaskRow } from "./bits";
import { CreateTaskModal, type LinkType } from "./CreateTaskModal";
import { TaskDrawer } from "./TaskDrawer";

function useMeta() {
    return useQuery<TaskMeta>({ queryKey: ["task-meta"], queryFn: async () => (await fetch("/api/tasks/meta")).json(), staleTime: 60_000 });
}

function Row({ t, onOpen, showAssignee }: { t: TaskRow; onOpen: () => void; showAssignee?: boolean }) {
    return (
        <button onClick={onOpen} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 text-left transition-colors">
            <TypeIcon type={t.type} />
            <span className="text-[11px] font-bold text-neutral-400 w-14 shrink-0">{t.key}</span>
            <span className="flex-1 min-w-0 text-xs font-semibold text-neutral-800 truncate">{t.title}</span>
            {t.commentCount > 0 && <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-neutral-400"><MessageSquare size={10} />{t.commentCount}</span>}
            <PriorityIcon priority={t.priority} />
            {t.dueDate && <span className={`hidden sm:inline-flex items-center gap-0.5 text-[10px] font-bold ${t.isOverdue ? "text-red-600" : "text-neutral-500"}`}><Calendar size={10} />{fmtDate(t.dueDate)}</span>}
            <StatusPill status={t.status} />
            {showAssignee && <Avatar person={t.assignee} size={20} />}
        </button>
    );
}

/** Dashboard card: my open tasks, most urgent first. */
export function MyWork({ limit = 6 }: { limit?: number }) {
    const { data: meta } = useMeta();
    const [openKey, setOpenKey] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const { data: tasks = [], isLoading } = useQuery<TaskRow[]>({
        queryKey: ["tasks", "my-work"],
        queryFn: async () => { const r = await fetch("/api/tasks?view=mine"); return r.ok ? r.json() : []; },
        refetchInterval: 30000,
    });
    const today = new Date().toISOString().slice(0, 10);
    const open = tasks.filter((t) => t.status !== "DONE");
    const sorted = [...open].sort((a, b) =>
        Number(b.isOverdue) - Number(a.isOverdue) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    const overdue = open.filter((t) => t.isOverdue).length;
    const dueToday = open.filter((t) => t.dueDate?.slice(0, 10) === today).length;
    const blocked = open.filter((t) => t.status === "BLOCKED").length;
    const base = meta ? taskLinkFor(meta.me.role as UserRole) : "#";

    return (
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><CheckSquare size={16} /></span>
                    <div>
                        <h3 className="text-sm font-bold text-neutral-900">My work</h3>
                        <p className="text-[11px] text-neutral-500">
                            {open.length} open{overdue ? <> · <span className="text-red-600 font-semibold">{overdue} overdue</span></> : ""}{dueToday ? ` · ${dueToday} due today` : ""}{blocked ? ` · ${blocked} blocked` : ""}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setCreating(true)} disabled={!meta} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-primary hover:bg-primary/5"><Plus size={13} /> New</button>
                    <Link href={base} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-neutral-500 hover:bg-neutral-100">All tasks <ArrowRight size={12} /></Link>
                </div>
            </div>
            <div className="px-2 pb-3">
                {isLoading && <p className="px-3 py-6 text-xs text-neutral-400">Loading…</p>}
                {!isLoading && sorted.length === 0 && (
                    <p className="px-3 py-6 text-xs text-neutral-400 text-center">Nothing assigned to you right now.</p>
                )}
                {sorted.slice(0, limit).map((t) => <Row key={t.id} t={t} onOpen={() => setOpenKey(t.key)} />)}
                {overdue > 0 && sorted.length > limit && (
                    <p className="px-3 pt-2 text-[11px] text-red-600 font-semibold inline-flex items-center gap-1"><AlertTriangle size={12} /> More overdue tasks on the task board</p>
                )}
            </div>
            {creating && meta && <CreateTaskModal meta={meta} onClose={() => setCreating(false)} onCreated={(t) => { setCreating(false); setOpenKey(t.key); }} />}
            {openKey && meta && <TaskDrawer taskKey={openKey} meta={meta} onClose={() => setOpenKey(null)} />}
        </div>
    );
}

/** Record page panel: tasks linked to a candidate / job / client / employee. */
export function RelatedTasks({ relatedType, relatedId, recordName }: { relatedType: LinkType; relatedId: string; recordName?: string }) {
    const { data: meta } = useMeta();
    const [openKey, setOpenKey] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const { data: tasks = [], isLoading } = useQuery<TaskRow[]>({
        queryKey: ["tasks", "related", relatedType, relatedId],
        queryFn: async () => { const r = await fetch(`/api/tasks?related=${relatedType}:${encodeURIComponent(relatedId)}`); return r.ok ? r.json() : []; },
    });
    const open = tasks.filter((t) => t.status !== "DONE").length;

    return (
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <div>
                    <h3 className="text-sm font-bold text-neutral-900">Linked tasks</h3>
                    <p className="text-[11px] text-neutral-500">{tasks.length ? `${open} open of ${tasks.length}` : `Track follow-ups${recordName ? ` for ${recordName}` : ""} as tasks`}</p>
                </div>
                <button onClick={() => setCreating(true)} disabled={!meta} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-primary text-white hover:bg-primary/95 disabled:opacity-60"><Plus size={13} /> New task</button>
            </div>
            <div className="px-2 pb-3">
                {isLoading && <p className="px-3 py-4 text-xs text-neutral-400">Loading…</p>}
                {!isLoading && tasks.length === 0 && <p className="px-3 py-4 text-xs text-neutral-400">No tasks linked yet.</p>}
                {tasks.map((t) => <Row key={t.id} t={t} showAssignee onOpen={() => setOpenKey(t.key)} />)}
            </div>
            {creating && meta && (
                <CreateTaskModal
                    meta={meta}
                    initial={{ relatedType, relatedId }}
                    onClose={() => setCreating(false)}
                    onCreated={(t) => { setCreating(false); setOpenKey(t.key); }}
                />
            )}
            {openKey && meta && <TaskDrawer taskKey={openKey} meta={meta} onClose={() => setOpenKey(null)} />}
        </div>
    );
}
