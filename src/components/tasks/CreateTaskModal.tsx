"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { TASK_STATUSES, TASK_TYPES, STATUS_LABEL } from "@/lib/tasks/rules";
import { Avatar, LabelInput, PeopleOptions, PeoplePicker, PRIORITY_META, TYPE_META, type TaskMeta, type TaskRow } from "./bits";

const LINK_LABEL = { CANDIDATE: "Candidate", JOB: "Job requisition", CLIENT: "Client", EMPLOYEE: "Employee" } as const;
type LinkType = keyof typeof LINK_LABEL;

function localDay(offset: number) {
    const d = new Date(Date.now() + offset * 86400000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}

const field = "w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20";
const label = "block text-[11px] font-bold text-neutral-600 mb-1";

export function CreateTaskModal({ meta, onClose, onCreated }: { meta: TaskMeta; onClose: () => void; onCreated: (t: TaskRow) => void }) {
    const qc = useQueryClient();
    const [quickDates] = useState(() => ([["Today", localDay(0)], ["Tomorrow", localDay(1)], ["+1 week", localDay(7)]] as const));
    const [f, setF] = useState({
        type: "TASK", title: "", description: "", assignedToId: meta.me.id, priority: "MEDIUM", status: "TODO",
        labels: [] as string[], startDate: "", dueDate: "", estimateHours: "", watcherIds: [] as string[],
        relatedType: "" as "" | LinkType, relatedId: "",
    });
    const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

    const assignable = meta.people.filter((p) => p.assignable);
    const linkTypes = (Object.keys(LINK_LABEL) as LinkType[]).filter((k) => meta.linkable[k]?.length);

    const create = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...f, estimateHours: f.estimateHours ? Number(f.estimateHours) : null, relatedType: f.relatedType || null, relatedId: f.relatedId || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Couldn't create the task");
            return data as TaskRow;
        },
        onSuccess: (t) => {
            toast.success(`${t.key} created${t.assignee && t.assignee.id !== meta.me.id ? ` and assigned to ${t.assignee.name}` : ""}`);
            qc.invalidateQueries({ queryKey: ["tasks"] });
            qc.invalidateQueries({ queryKey: ["task-meta"] });
            onCreated(t);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={(e) => { e.preventDefault(); if (!f.title.trim()) return toast.error("Add a summary"); create.mutate(); }}
                className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl animate-fade-in"
            >
                <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                    <h3 className="font-bold text-neutral-900">Create task</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 text-xl leading-none" aria-label="Close">×</button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5 max-h-[72vh] overflow-y-auto">
                    {/* Main */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className={label}>Type</span>
                                <select value={f.type} onChange={(e) => set("type", e.target.value)} className={field}>
                                    {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
                                </select>
                            </div>
                            <div>
                                <span className={label}>Status</span>
                                <select value={f.status} onChange={(e) => set("status", e.target.value)} className={field}>
                                    {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <span className={label}>Summary *</span>
                            <input autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder="What needs to be done?" className={`${field} text-sm font-semibold`} />
                        </div>
                        <div>
                            <span className={label}>Description</span>
                            <textarea rows={6} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Context, steps, links, acceptance criteria…" className={field} />
                        </div>
                        <div>
                            <span className={label}>Labels</span>
                            <LabelInput value={f.labels} onChange={(v) => set("labels", v)} suggestions={meta.labels} />
                        </div>
                        {linkTypes.length > 0 && (
                            <div>
                                <span className={label}>Link to record</span>
                                <div className="grid grid-cols-3 gap-2">
                                    <select value={f.relatedType} onChange={(e) => setF((p) => ({ ...p, relatedType: e.target.value as LinkType | "", relatedId: "" }))} className={field}>
                                        <option value="">None</option>
                                        {linkTypes.map((k) => <option key={k} value={k}>{LINK_LABEL[k]}</option>)}
                                    </select>
                                    {f.relatedType && (
                                        <select value={f.relatedId} onChange={(e) => set("relatedId", e.target.value)} className={`${field} col-span-2`}>
                                            <option value="">Choose {LINK_LABEL[f.relatedType].toLowerCase()}…</option>
                                            {meta.linkable[f.relatedType].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Details */}
                    <div className="space-y-4 md:border-l md:border-neutral-100 md:pl-5">
                        <div>
                            <span className={label}>Assignee</span>
                            <select value={f.assignedToId} onChange={(e) => set("assignedToId", e.target.value)} className={field} disabled={assignable.length <= 1}>
                                <option value={meta.me.id}>{meta.me.name} (me)</option>
                                <PeopleOptions people={assignable.filter((p) => p.id !== meta.me.id)} />
                            </select>
                        </div>
                        <div>
                            <span className={label}>Reporter</span>
                            <div className="flex items-center gap-2 px-3 py-2 text-xs bg-neutral-50 border border-neutral-100 rounded-xl text-neutral-600">
                                <Avatar person={meta.me} size={18} /> {meta.me.name}
                            </div>
                        </div>
                        <div>
                            <span className={label}>Priority</span>
                            <select value={f.priority} onChange={(e) => set("priority", e.target.value)} className={field}>
                                {(Object.keys(PRIORITY_META) as (keyof typeof PRIORITY_META)[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className={label}>Start date</span>
                                <input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={field} />
                            </div>
                            <div>
                                <span className={label}>Due date</span>
                                <input type="date" min={f.startDate || undefined} value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={field} />
                            </div>
                        </div>
                        <div className="flex gap-1.5 -mt-2">
                            {quickDates.map(([l, date]) => {
                                return (
                                    <button key={l} type="button" onClick={() => set("dueDate", date)}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${f.dueDate === date ? "border-primary text-primary" : "border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}>
                                        {l}
                                    </button>
                                );
                            })}
                        </div>
                        <div>
                            <span className={label}>Estimate (hours)</span>
                            <input type="number" min="0" step="0.5" value={f.estimateHours} onChange={(e) => set("estimateHours", e.target.value)} placeholder="e.g. 2" className={field} />
                        </div>
                        <div>
                            <span className={label}>Watchers</span>
                            <PeoplePicker value={f.watcherIds} onChange={(v) => set("watcherIds", v)} people={meta.people.filter((p) => p.id !== meta.me.id && p.id !== f.assignedToId)} placeholder="Add watcher" />
                            <p className="text-[10px] text-neutral-400 mt-1">Watchers get notified about comments and status changes.</p>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl">Cancel</button>
                    <button type="submit" disabled={create.isPending} className="px-5 py-2 text-xs font-bold bg-primary text-white rounded-xl shadow hover:bg-primary/95 disabled:opacity-60 inline-flex items-center gap-2">
                        {create.isPending && <Loader2 size={14} className="animate-spin" />} Create
                    </button>
                </div>
            </form>
        </div>
    );
}
