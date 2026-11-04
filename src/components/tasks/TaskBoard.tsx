"use client";

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, LayoutGrid, List, MessageSquare, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { STATUS_LABEL, TASK_STATUSES, TASK_TYPES } from "@/lib/tasks/rules";
import type { TaskStatus } from "@/lib/types";
import {
    Avatar, LabelChip, PeopleOptions, PRIORITY_META, PriorityIcon, STATUS_STYLE, StatusPill, TYPE_META, TypeIcon,
    fmtDate, timeAgo, type TaskMeta, type TaskRow,
} from "./bits";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDrawer } from "./TaskDrawer";

type View = "all" | "mine" | "reported" | "watching";
const VIEWS: { id: View; label: string }[] = [
    { id: "all", label: "All tasks" },
    { id: "mine", label: "Assigned to me" },
    { id: "reported", label: "Reported by me" },
    { id: "watching", label: "Watching" },
];
const LAYOUT_KEY = "absojob.tasks.layout";

// Board / list preference, remembered per browser
const layoutListeners = new Set<() => void>();
function readLayout(): "board" | "list" {
    try { return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "board"; } catch { return "board"; }
}
function saveLayout(l: "board" | "list") {
    try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* storage blocked */ }
    layoutListeners.forEach((fn) => fn());
}
function useLayout() {
    return useSyncExternalStore(
        (fn) => { layoutListeners.add(fn); return () => layoutListeners.delete(fn); },
        readLayout,
        () => "board" as const,
    );
}

function Card({ t, onOpen, onDragStart }: { t: TaskRow; onOpen: () => void; onDragStart: (e: React.DragEvent) => void }) {
    return (
        <button
            type="button"
            draggable={t.canEdit}
            onDragStart={onDragStart}
            onClick={onOpen}
            className="w-full text-left bg-white rounded-xl border border-neutral-200 p-3 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all space-y-2.5"
        >
            <p className="text-[13px] font-semibold text-neutral-800 leading-snug line-clamp-2">{t.title}</p>
            {(t.labels.length > 0 || t.related) && (
                <div className="flex flex-wrap gap-1">
                    {t.labels.slice(0, 3).map((l) => <LabelChip key={l} label={l} />)}
                    {t.labels.length > 3 && <span className="text-[10px] text-neutral-400 font-bold">+{t.labels.length - 3}</span>}
                    {t.related && <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 text-[10px] font-semibold truncate max-w-[140px]">{t.related.label}</span>}
                </div>
            )}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <TypeIcon type={t.type} />
                    <span className={`text-[11px] font-bold ${t.status === "DONE" ? "line-through text-neutral-400" : "text-neutral-500"}`}>{t.key}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {t.dueDate && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${t.isOverdue ? "bg-red-50 text-red-600" : "text-neutral-500"}`}>
                            <Calendar size={10} /> {fmtDate(t.dueDate)}
                        </span>
                    )}
                    {t.commentCount > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-neutral-400"><MessageSquare size={11} /> {t.commentCount}</span>}
                    <PriorityIcon priority={t.priority} />
                    <Avatar person={t.assignee} size={22} />
                </div>
            </div>
        </button>
    );
}

function Board({ title, subtitle }: { title: string; subtitle?: string }) {
    const qc = useQueryClient();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const openKey = params.get("task");

    const [view, setView] = useState<View>("all");
    const layout = useLayout();
    const [q, setQ] = useState("");
    const [assignee, setAssignee] = useState("ALL");
    const [priority, setPriority] = useState("ALL");
    const [label, setLabel] = useState("ALL");
    const [type, setType] = useState("ALL");
    const [creating, setCreating] = useState(false);
    const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

    const chooseLayout = saveLayout;

    const open = (key: string | null) => {
        const next = new URLSearchParams(params.toString());
        if (key) next.set("task", key); else next.delete("task");
        next.delete("create");
        router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    };
    // "Create task" from the ⌘K palette arrives as ?create=1
    const createFromUrl = params.get("create") === "1";
    const closeCreate = () => {
        setCreating(false);
        if (createFromUrl) open(params.get("task"));
    };

    const { data: meta } = useQuery<TaskMeta>({
        queryKey: ["task-meta"],
        queryFn: async () => (await fetch("/api/tasks/meta")).json(),
        staleTime: 60_000,
    });

    const query = new URLSearchParams({ view, assignee, priority, label, type, q });
    const { data: tasks = [], isLoading } = useQuery<TaskRow[]>({
        queryKey: ["tasks", query.toString()],
        queryFn: async () => {
            const res = await fetch(`/api/tasks?${query}`);
            if (!res.ok) throw new Error();
            return res.json();
        },
        refetchInterval: 15000,
    });

    const move = useMutation({
        mutationFn: async ({ key, status }: { key: string; status: TaskStatus }) => {
            const res = await fetch(`/api/tasks/${encodeURIComponent(key)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Couldn't move the task");
            return data;
        },
        onMutate: async ({ key, status }) => {
            const k = ["tasks", query.toString()];
            await qc.cancelQueries({ queryKey: k });
            const prev = qc.getQueryData<TaskRow[]>(k);
            qc.setQueryData<TaskRow[]>(k, (old) => old?.map((t) => (t.key === key ? { ...t, status } : t)));
            return { prev, k };
        },
        onError: (e: Error, _v, ctx) => { if (ctx) qc.setQueryData(ctx.k, ctx.prev); toast.error(e.message); },
        onSuccess: (_d, v) => toast.success(`${v.key} → ${STATUS_LABEL[v.status]}`),
        onSettled: (_d, _e, v) => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["task", v.key] }); },
    });

    const columns = useMemo(() => TASK_STATUSES.map((s) => ({ status: s, items: tasks.filter((t) => t.status === s) })), [tasks]);
    const counts = useMemo(() => ({
        open: tasks.filter((t) => t.status !== "DONE").length,
        overdue: tasks.filter((t) => t.isOverdue).length,
        blocked: tasks.filter((t) => t.status === "BLOCKED").length,
    }), [tasks]);
    const filtersOn = assignee !== "ALL" || priority !== "ALL" || label !== "ALL" || type !== "ALL" || q;
    const select = "px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg outline-none font-semibold text-neutral-700";

    return (
        <div className="space-y-4">
            <PageHeader
                title={title}
                subtitle={subtitle ?? `${counts.open} open · ${counts.overdue} overdue · ${counts.blocked} blocked`}
                action={
                    <button onClick={() => setCreating(true)} disabled={!meta} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:bg-primary/95 disabled:opacity-60">
                        <Plus size={16} /> Create task
                    </button>
                }
            />

            {/* Views */}
            <div className="flex items-center gap-1 border-b border-neutral-200">
                {VIEWS.map((v) => (
                    <button key={v.id} onClick={() => setView(v.id)} className={`px-3 pb-2 text-xs font-semibold border-b-2 -mb-px ${view === v.id ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
                        {v.label}
                    </button>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search key, summary, label…" className="pl-8 pr-3 py-1.5 w-56 text-xs bg-white border border-neutral-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                {meta && meta.people.length > 1 && (
                    <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={select}>
                        <option value="ALL">Assignee: all</option>
                        <PeopleOptions people={meta.people} />
                    </select>
                )}
                <select value={type} onChange={(e) => setType(e.target.value)} className={select}>
                    <option value="ALL">Type: all</option>
                    {TASK_TYPES.map((k) => <option key={k} value={k}>{TYPE_META[k].label}</option>)}
                </select>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={select}>
                    <option value="ALL">Priority: all</option>
                    {(Object.keys(PRIORITY_META) as (keyof typeof PRIORITY_META)[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
                {meta && meta.labels.length > 0 && (
                    <select value={label} onChange={(e) => setLabel(e.target.value)} className={select}>
                        <option value="ALL">Label: all</option>
                        {meta.labels.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                )}
                {filtersOn && (
                    <button onClick={() => { setQ(""); setAssignee("ALL"); setPriority("ALL"); setLabel("ALL"); setType("ALL"); }} className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 px-2">Clear filters</button>
                )}
                <div className="ml-auto flex bg-neutral-100 p-0.5 rounded-lg">
                    {([["board", LayoutGrid, "Board"], ["list", List, "List"]] as const).map(([id, Icon, l]) => (
                        <button key={id} onClick={() => chooseLayout(id)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${layout === id ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500"}`}>
                            <Icon size={13} /> {l}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map((i) => <SkeletonPulse key={i} className="h-72 rounded-2xl" />)}</div>
            ) : layout === "board" ? (
                <div className="flex gap-3 overflow-x-auto pb-2">
                    {columns.map(({ status, items }) => (
                        <div
                            key={status}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
                            onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(null);
                                const key = e.dataTransfer.getData("text/task-key");
                                const from = e.dataTransfer.getData("text/task-status");
                                if (key && from !== status) move.mutate({ key, status });
                            }}
                            className={`flex-1 min-w-[250px] rounded-2xl p-2.5 transition-colors ${STATUS_STYLE[status].column} ${dragOver === status ? "ring-2 ring-primary/40" : ""}`}
                        >
                            <div className="flex items-center gap-2 px-1.5 pb-2.5">
                                <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[status].dot}`} />
                                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">{STATUS_LABEL[status]}</span>
                                <span className="text-[11px] font-bold text-neutral-400">{items.length}</span>
                            </div>
                            <div className="space-y-2 min-h-[120px]">
                                {items.map((t) => (
                                    <Card key={t.id} t={t} onOpen={() => open(t.key)} onDragStart={(e) => { e.dataTransfer.setData("text/task-key", t.key); e.dataTransfer.setData("text/task-status", t.status); }} />
                                ))}
                                {items.length === 0 && <p className="text-[11px] text-neutral-400 text-center py-6">Drop tasks here</p>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-neutral-200 overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-neutral-50 text-neutral-500 text-[10px] uppercase tracking-wide">
                            <tr>
                                {["Type", "Key", "Summary", "Status", "Priority", "Assignee", "Reporter", "Labels", "Due", "Updated"].map((h) => <th key={h} className="px-3 py-2.5 text-left font-bold whitespace-nowrap">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {tasks.map((t) => (
                                <tr key={t.id} onClick={() => open(t.key)} className="hover:bg-neutral-50 cursor-pointer">
                                    <td className="px-3 py-2.5"><TypeIcon type={t.type} /></td>
                                    <td className="px-3 py-2.5 font-bold text-neutral-500 whitespace-nowrap">{t.key}</td>
                                    <td className="px-3 py-2.5 font-semibold text-neutral-800 min-w-[240px]">
                                        {t.title}
                                        {t.commentCount > 0 && <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-neutral-400"><MessageSquare size={10} />{t.commentCount}</span>}
                                    </td>
                                    <td className="px-3 py-2.5"><StatusPill status={t.status} /></td>
                                    <td className="px-3 py-2.5"><PriorityIcon priority={t.priority} withLabel /></td>
                                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><Avatar person={t.assignee} size={20} />{t.assignee?.name ?? "Unassigned"}</span></td>
                                    <td className="px-3 py-2.5 whitespace-nowrap text-neutral-600">{t.reporter?.name ?? "—"}</td>
                                    <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{t.labels.map((l) => <LabelChip key={l} label={l} />)}</div></td>
                                    <td className={`px-3 py-2.5 whitespace-nowrap font-semibold ${t.isOverdue ? "text-red-600" : "text-neutral-600"}`}>{fmtDate(t.dueDate)}</td>
                                    <td className="px-3 py-2.5 whitespace-nowrap text-neutral-400">{timeAgo(t.updatedAt)}</td>
                                </tr>
                            ))}
                            {tasks.length === 0 && <tr><td colSpan={10} className="px-3 py-10 text-center text-neutral-400">No tasks match.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {(creating || createFromUrl) && meta && <CreateTaskModal meta={meta} onClose={closeCreate} onCreated={(t) => { setCreating(false); open(t.key); }} />}
            {openKey && meta && <TaskDrawer taskKey={openKey} meta={meta} onClose={() => open(null)} />}
        </div>
    );
}

/** Jira-style task board used by the Admin, HR, TA and Portal task pages. */
export function TaskBoard(props: { title: string; subtitle?: string }) {
    return (
        <Suspense fallback={<SkeletonPulse className="h-96 w-full rounded-2xl" />}>
            <Board {...props} />
        </Suspense>
    );
}
