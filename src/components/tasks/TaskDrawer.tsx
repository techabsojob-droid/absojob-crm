"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, Link2, Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import { STATUS_LABEL, TASK_STATUSES, TASK_TYPES } from "@/lib/tasks/rules";
import type { TaskStatus } from "@/lib/types";
import {
    Avatar, LabelChip, LabelInput, PeopleOptions, PRIORITY_META, PriorityIcon, STATUS_STYLE, TYPE_META, TypeIcon,
    fmtDate, timeAgo, type Person, type TaskMeta, type TaskRow,
} from "./bits";

interface Comment { id: string; body: string; createdAt: string; editedAt: string | null; author: { id: string; name: string }; canEdit: boolean }
interface HistoryItem { id: string; action: "CREATED" | "UPDATED" | "COMMENTED"; field: string | null; fromValue: string | null; toValue: string | null; actorId: string; actorName: string; createdAt: string }
type Detail = TaskRow & { comments: Comment[]; history: HistoryItem[] };

const input = "w-full px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-neutral-800 disabled:appearance-none";

function readable(field: string | null, v: string | null) {
    if (v == null) return "None";
    if (field === "status") return STATUS_LABEL[v as TaskStatus] ?? v;
    if (field === "priority") return PRIORITY_META[v as keyof typeof PRIORITY_META]?.label ?? v;
    if (field === "type") return TYPE_META[v as keyof typeof TYPE_META]?.label ?? v;
    if (field === "due date" || field === "start date") return fmtDate(v);
    return v;
}

/** Comment text with @mentions highlighted. */
function CommentBody({ text, people }: { text: string; people: Person[] }) {
    const names = people.map((p) => p.name).sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!names.length) return <p className="whitespace-pre-wrap">{text}</p>;
    const parts = text.split(new RegExp(`(@(?:${names.join("|")}))`, "gi"));
    return (
        <p className="whitespace-pre-wrap">
            {parts.map((part, i) => part.startsWith("@") && i % 2 === 1
                ? <span key={i} className="px-1 rounded bg-blue-50 text-blue-700 font-semibold">{part}</span>
                : <span key={i}>{part}</span>)}
        </p>
    );
}

/** Textarea with @mention suggestions. */
function MentionBox({ value, onChange, people, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; people: Person[]; placeholder: string; autoFocus?: boolean }) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const [query, setQuery] = useState<string | null>(null);
    const matches = query === null ? [] : people.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

    const detect = (text: string, caret: number) => {
        const m = text.slice(0, caret).match(/(?:^|\s)@([A-Za-z.]*(?: [A-Za-z.]*)?)$/);
        setQuery(m ? m[1] : null);
    };
    const pick = (p: Person) => {
        const el = ref.current!;
        const caret = el.selectionStart;
        const before = value.slice(0, caret).replace(/@([A-Za-z.]*(?: [A-Za-z.]*)?)$/, `@${p.name} `);
        const next = before + value.slice(caret);
        onChange(next);
        setQuery(null);
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(before.length, before.length); });
    };

    return (
        <div className="relative">
            <textarea
                ref={ref}
                autoFocus={autoFocus}
                rows={3}
                value={value}
                placeholder={placeholder}
                onChange={(e) => { onChange(e.target.value); detect(e.target.value, e.target.selectionStart); }}
                onKeyDown={(e) => {
                    if (query !== null && matches.length && (e.key === "Enter" || e.key === "Tab")) { e.preventDefault(); pick(matches[0]); }
                    if (e.key === "Escape") setQuery(null);
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 resize-y"
            />
            {matches.length > 0 && (
                <div className="absolute z-10 left-2 bottom-full mb-1 w-64 bg-white border border-neutral-200 rounded-xl shadow-lg py-1">
                    {matches.map((p, i) => (
                        <button key={p.id} type="button" onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-neutral-50 ${i === 0 ? "bg-neutral-50" : ""}`}>
                            <Avatar person={p} size={20} />
                            <span className="font-semibold text-neutral-800">{p.name}</span>
                            <span className="text-neutral-400 truncate">{p.designation}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function TaskDrawer({ taskKey, meta, onClose }: { taskKey: string; meta: TaskMeta; onClose: () => void }) {
    const qc = useQueryClient();
    const [tab, setTab] = useState<"comments" | "history" | "all">("comments");
    const [draft, setDraft] = useState("");
    const [editingDesc, setEditingDesc] = useState(false);
    const [desc, setDesc] = useState("");
    const [editingComment, setEditingComment] = useState<{ id: string; body: string } | null>(null);

    const { data: t, isLoading, error } = useQuery<Detail>({
        queryKey: ["task", taskKey],
        queryFn: async () => {
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskKey)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Task not found");
            return data;
        },
        refetchInterval: 15000,
    });

    const refresh = () => {
        qc.invalidateQueries({ queryKey: ["task", taskKey] });
        qc.invalidateQueries({ queryKey: ["tasks"] });
    };

    const update = useMutation({
        mutationFn: async (patch: Record<string, unknown>) => {
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskKey)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Couldn't save");
            return data;
        },
        onSuccess: refresh,
        onError: (e: Error) => { toast.error(e.message); refresh(); },
    });

    const comment = useMutation({
        mutationFn: async ({ method, payload }: { method: "POST" | "PATCH" | "DELETE"; payload: Record<string, unknown> }) => {
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskKey)}/comments`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Couldn't save the comment");
            return data;
        },
        onSuccess: (_d, v) => {
            if (v.method === "POST") setDraft("");
            setEditingComment(null);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const assignable = meta.people.filter((p) => p.assignable);
    const feed = useMemo(() => {
        if (!t) return [];
        const c = t.comments.map((x) => ({ kind: "comment" as const, at: x.createdAt, c: x }));
        const h = t.history.filter((x) => x.action !== "COMMENTED").map((x) => ({ kind: "history" as const, at: x.createdAt, h: x }));
        const items = tab === "comments" ? c : tab === "history" ? h : [...c, ...h];
        return items.sort((a, b) => (tab === "history" ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)));
    }, [t, tab]);

    const copyLink = () => {
        navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}?task=${encodeURIComponent(taskKey)}`);
        toast.success("Link copied");
    };

    return (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
            <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-5xl bg-white shadow-2xl flex flex-col animate-fade-in">
                {/* Top bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        {t && <TypeIcon type={t.type} />}
                        <span className="font-bold text-neutral-700">{taskKey}</span>
                        {t?.related && (
                            <>
                                <span>·</span>
                                <Link2 size={12} />
                                {t.related.href
                                    ? <Link href={t.related.href} className="hover:underline">{t.related.type}: {t.related.label}</Link>
                                    : <span>{t.related.type}: {t.related.label}</span>}
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {t && (
                            <button onClick={() => update.mutate({ watch: !t.isWatching })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-100">
                                {t.isWatching ? <EyeOff size={14} /> : <Eye size={14} />} {t.isWatching ? "Unwatch" : "Watch"}
                                <span className="px-1.5 rounded bg-neutral-100 text-[10px]">{t.watcherIds.length}</span>
                            </button>
                        )}
                        <button onClick={copyLink} title="Copy link" className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100"><Copy size={14} /></button>
                        <button onClick={onClose} title="Close" className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100"><X size={16} /></button>
                    </div>
                </div>

                {isLoading && <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-neutral-400" /></div>}
                {error && <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">{(error as Error).message}</div>}

                {t && (
                    <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_300px]">
                        {/* Left: summary, description, activity */}
                        <div className="p-6 space-y-6 min-w-0">
                            <input
                                key={t.title}
                                defaultValue={t.title}
                                disabled={!t.canEdit}
                                onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && update.mutate({ title: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                className="w-full text-xl font-bold text-neutral-900 bg-transparent rounded-lg px-1 -mx-1 py-0.5 outline-none hover:bg-neutral-50 focus:bg-neutral-50 focus:ring-2 focus:ring-primary/20 disabled:hover:bg-transparent"
                            />

                            <section>
                                <div className="flex items-center justify-between mb-1.5">
                                    <h4 className="text-xs font-bold text-neutral-700">Description</h4>
                                    {t.canEdit && !editingDesc && (
                                        <button onClick={() => { setDesc(t.description ?? ""); setEditingDesc(true); }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-800"><Pencil size={11} /> Edit</button>
                                    )}
                                </div>
                                {editingDesc ? (
                                    <div className="space-y-2">
                                        <textarea autoFocus rows={7} value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" />
                                        <div className="flex gap-2">
                                            <button onClick={() => { update.mutate({ description: desc }); setEditingDesc(false); }} className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg">Save</button>
                                            <button onClick={() => setEditingDesc(false)} className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => { if (t.canEdit) { setDesc(t.description ?? ""); setEditingDesc(true); } }}
                                        className={`text-sm text-neutral-700 whitespace-pre-wrap rounded-lg ${t.canEdit ? "cursor-text hover:bg-neutral-50 -mx-2 px-2 py-1" : ""}`}
                                    >
                                        {t.description || <span className="text-neutral-400">{t.canEdit ? "Add a description…" : "No description"}</span>}
                                    </div>
                                )}
                            </section>

                            <section>
                                <div className="flex items-center gap-4 border-b border-neutral-100 mb-4">
                                    <h4 className="text-xs font-bold text-neutral-700 pb-2">Activity</h4>
                                    {(["comments", "history", "all"] as const).map((k) => (
                                        <button key={k} onClick={() => setTab(k)} className={`pb-2 text-xs font-semibold capitalize border-b-2 -mb-px ${tab === k ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
                                            {k}{k === "comments" ? ` (${t.comments.length})` : ""}
                                        </button>
                                    ))}
                                </div>

                                {tab !== "history" && (
                                    <div className="flex gap-3 mb-5">
                                        <Avatar person={meta.me} size={30} />
                                        <div className="flex-1 space-y-2">
                                            <MentionBox value={draft} onChange={setDraft} people={meta.people.filter((p) => p.id !== meta.me.id)} placeholder="Add a comment… type @ to mention someone" />
                                            {draft.trim() && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => comment.mutate({ method: "POST", payload: { body: draft } })} disabled={comment.isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg disabled:opacity-60">
                                                        {comment.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Comment
                                                    </button>
                                                    <button onClick={() => setDraft("")} className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {feed.length === 0 && <p className="text-xs text-neutral-400">{tab === "comments" ? "No comments yet. Start the conversation." : "No history yet."}</p>}
                                    {feed.map((item) => item.kind === "comment" ? (
                                        <div key={item.c.id} className="flex gap-3">
                                            <Avatar person={item.c.author} size={30} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2 text-xs">
                                                    <span className="font-bold text-neutral-800">{item.c.author.name}</span>
                                                    <span className="text-neutral-400" title={new Date(item.c.createdAt).toLocaleString("en-IN")}>{timeAgo(item.c.createdAt)}</span>
                                                    {item.c.editedAt && <span className="text-neutral-400">(edited)</span>}
                                                </div>
                                                {editingComment?.id === item.c.id ? (
                                                    <div className="mt-1.5 space-y-2">
                                                        <MentionBox autoFocus value={editingComment.body} onChange={(v) => setEditingComment({ id: item.c.id, body: v })} people={meta.people} placeholder="" />
                                                        <div className="flex gap-2">
                                                            <button onClick={() => comment.mutate({ method: "PATCH", payload: { commentId: item.c.id, body: editingComment.body } })} className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg">Save</button>
                                                            <button onClick={() => setEditingComment(null)} className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="mt-1 text-sm text-neutral-700"><CommentBody text={item.c.body} people={meta.people} /></div>
                                                        {item.c.canEdit && (
                                                            <div className="flex gap-3 mt-1 text-[11px] font-semibold text-neutral-400">
                                                                <button onClick={() => setEditingComment({ id: item.c.id, body: item.c.body })} className="hover:text-neutral-700">Edit</button>
                                                                <button onClick={() => confirm("Delete this comment?") && comment.mutate({ method: "DELETE", payload: { commentId: item.c.id } })} className="hover:text-red-600 inline-flex items-center gap-0.5"><Trash2 size={10} /> Delete</button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={item.h.id} className="flex gap-3 text-xs">
                                            <Avatar person={{ id: item.h.actorId, name: item.h.actorName }} size={22} />
                                            <div className="text-neutral-600 pt-0.5">
                                                <span className="font-bold text-neutral-800">{item.h.actorName}</span>{" "}
                                                {item.h.action === "CREATED" ? "created the task" : item.h.field === "description" ? "updated the description" : (
                                                    <>changed <b>{item.h.field}</b>{" "}
                                                        <span className="line-through text-neutral-400">{readable(item.h.field, item.h.fromValue)}</span> → <span className="font-semibold text-neutral-800">{readable(item.h.field, item.h.toValue)}</span>
                                                    </>
                                                )}
                                                <span className="text-neutral-400 ml-2">{timeAgo(item.h.createdAt)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Right: details */}
                        <div className="border-t lg:border-t-0 lg:border-l border-neutral-100 bg-neutral-50/40 p-5 space-y-5">
                            <select
                                value={t.status}
                                disabled={!t.canEdit}
                                onChange={(e) => update.mutate({ status: e.target.value })}
                                className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border outline-none ${STATUS_STYLE[t.status].pill}`}
                            >
                                {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                            </select>

                            <div className="rounded-xl border border-neutral-200 bg-white">
                                <div className="px-4 py-2.5 border-b border-neutral-100 text-xs font-bold text-neutral-700">Details</div>
                                <dl className="p-4 grid grid-cols-[90px_1fr] gap-x-3 gap-y-3.5 items-center text-xs">
                                    <dt className="text-neutral-500 font-semibold">Assignee</dt>
                                    <dd className="flex items-center gap-2 min-w-0">
                                        <Avatar person={t.assignee} size={22} />
                                        <select value={t.assignedToId} disabled={!t.canEdit || assignable.length <= 1} onChange={(e) => update.mutate({ assignedToId: e.target.value })} className={input}>
                                            {!assignable.some((p) => p.id === t.assignedToId) && t.assignee && <option value={t.assignee.id}>{t.assignee.name}</option>}
                                            <PeopleOptions people={assignable} />
                                        </select>
                                    </dd>

                                    <dt className="text-neutral-500 font-semibold">Reporter</dt>
                                    <dd className="flex items-center gap-2"><Avatar person={t.reporter} size={22} /> <span className="font-medium text-neutral-800">{t.reporter?.name ?? "—"}</span></dd>

                                    <dt className="text-neutral-500 font-semibold">Priority</dt>
                                    <dd className="flex items-center gap-1.5">
                                        <PriorityIcon priority={t.priority} />
                                        <select value={t.priority} disabled={!t.canEdit} onChange={(e) => update.mutate({ priority: e.target.value })} className={input}>
                                            {(Object.keys(PRIORITY_META) as (keyof typeof PRIORITY_META)[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                                        </select>
                                    </dd>

                                    <dt className="text-neutral-500 font-semibold">Type</dt>
                                    <dd className="flex items-center gap-1.5">
                                        <TypeIcon type={t.type} />
                                        <select value={t.type} disabled={!t.canEdit} onChange={(e) => update.mutate({ type: e.target.value })} className={input}>
                                            {TASK_TYPES.map((k) => <option key={k} value={k}>{TYPE_META[k].label}</option>)}
                                        </select>
                                    </dd>

                                    <dt className="text-neutral-500 font-semibold self-start pt-1.5">Labels</dt>
                                    <dd className="min-w-0">
                                        {t.canEdit
                                            ? <LabelInput value={t.labels} onChange={(v) => update.mutate({ labels: v })} suggestions={meta.labels} />
                                            : <div className="flex flex-wrap gap-1">{t.labels.length ? t.labels.map((l) => <LabelChip key={l} label={l} />) : <span className="text-neutral-400">None</span>}</div>}
                                    </dd>

                                    <dt className="text-neutral-500 font-semibold">Start date</dt>
                                    <dd><input type="date" value={t.startDate ?? ""} disabled={!t.canEdit} onChange={(e) => update.mutate({ startDate: e.target.value || null })} className={input} /></dd>

                                    <dt className="text-neutral-500 font-semibold">Due date</dt>
                                    <dd className="flex items-center gap-2">
                                        <input type="date" value={t.dueDate?.slice(0, 10) ?? ""} disabled={!t.canEdit} onChange={(e) => update.mutate({ dueDate: e.target.value || null })} className={`${input} ${t.isOverdue ? "text-red-600 font-bold" : ""}`} />
                                        {t.isOverdue && <span className="text-[10px] font-bold text-red-600 whitespace-nowrap">Overdue</span>}
                                    </dd>

                                    <dt className="text-neutral-500 font-semibold">Estimate</dt>
                                    <dd className="flex items-center gap-1">
                                        <input type="number" min="0" step="0.5" key={String(t.estimateHours)} defaultValue={t.estimateHours ?? ""} disabled={!t.canEdit}
                                            onBlur={(e) => String(t.estimateHours ?? "") !== e.target.value && update.mutate({ estimateHours: e.target.value === "" ? null : Number(e.target.value) })}
                                            placeholder="—" className={input} />
                                        <span className="text-neutral-400">h</span>
                                    </dd>

                                    <dt className="text-neutral-500 font-semibold self-start pt-0.5">Watchers</dt>
                                    <dd className="flex flex-wrap gap-1">
                                        {t.watchers.length ? t.watchers.map((w) => <Avatar key={w.id} person={w} size={22} />) : <span className="text-neutral-400">None</span>}
                                    </dd>
                                </dl>
                            </div>

                            <div className="text-[11px] text-neutral-400 space-y-1 px-1">
                                <p>Created {fmtDate(t.createdAt)} · {timeAgo(t.createdAt)}</p>
                                <p>Updated {timeAgo(t.updatedAt)}</p>
                                {t.status === "DONE" && t.completedAt && <p>Resolved {fmtDate(t.completedAt)}</p>}
                                {!t.canEdit && <p className="pt-2 text-neutral-500">You can comment on this task. Only the assignee, reporter or a manager can change its fields.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </aside>
        </div>
    );
}
