"use client";

import { useState } from "react";
import {
    CheckSquare, ChevronDown, ChevronUp, ChevronsUp, Equal, FileText, Phone, RefreshCw, UserCheck, Users, X,
} from "lucide-react";
import { STATUS_LABEL } from "@/lib/tasks/rules";
import type { TaskStatus, TaskType } from "@/lib/types";

// ─── Shapes returned by /api/tasks ────────────────────────────
export interface Person { id: string; name: string; role: string; designation?: string | null; assignable?: boolean }
export interface TaskRow {
    id: string; key: string; type: TaskType; status: TaskStatus; title: string; description: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; labels: string[]; watcherIds: string[];
    assignedToId: string; createdById: string; assignee: Person | null; reporter: Person | null; watchers: Person[];
    startDate: string | null; dueDate: string | null; estimateHours: number | null;
    relatedType: string | null; relatedId: string | null;
    related: { type: string; id: string; label: string; href: string | null } | null;
    commentCount: number; isOverdue: boolean; isWatching: boolean; canEdit: boolean;
    completedAt: string | null; createdAt: string; updatedAt: string;
}
export interface TaskMeta {
    me: Person;
    people: Person[];
    labels: string[];
    linkable: Record<"CANDIDATE" | "JOB" | "CLIENT" | "EMPLOYEE", { id: string; label: string }[]>;
}

// ─── Status / type / priority ─────────────────────────────────
export const STATUS_STYLE: Record<TaskStatus, { pill: string; dot: string; column: string }> = {
    TODO: { pill: "bg-neutral-100 text-neutral-700 border-neutral-200", dot: "bg-neutral-400", column: "bg-neutral-100/70" },
    IN_PROGRESS: { pill: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500", column: "bg-blue-50/60" },
    IN_REVIEW: { pill: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500", column: "bg-violet-50/60" },
    BLOCKED: { pill: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500", column: "bg-red-50/50" },
    DONE: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", column: "bg-emerald-50/50" },
};

export function StatusPill({ status }: { status: TaskStatus }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${STATUS_STYLE[status].pill}`}>
            {STATUS_LABEL[status]}
        </span>
    );
}

export const TYPE_META: Record<TaskType, { label: string; icon: typeof CheckSquare; color: string }> = {
    TASK: { label: "Task", icon: CheckSquare, color: "bg-blue-500" },
    FOLLOW_UP: { label: "Follow-up", icon: RefreshCw, color: "bg-amber-500" },
    CALL: { label: "Call", icon: Phone, color: "bg-teal-500" },
    MEETING: { label: "Meeting", icon: Users, color: "bg-violet-500" },
    DOCUMENTS: { label: "Documents", icon: FileText, color: "bg-slate-500" },
    INTERVIEW: { label: "Interview", icon: UserCheck, color: "bg-emerald-600" },
};

export function TypeIcon({ type, size = 16 }: { type: TaskType; size?: number }) {
    const m = TYPE_META[type] ?? TYPE_META.TASK;
    const Icon = m.icon;
    return (
        <span title={m.label} className={`inline-flex items-center justify-center rounded ${m.color} text-white shrink-0`} style={{ width: size, height: size }}>
            <Icon size={size - 5} strokeWidth={2.5} />
        </span>
    );
}

export const PRIORITY_META = {
    URGENT: { label: "Urgent", icon: ChevronsUp, color: "text-red-600" },
    HIGH: { label: "High", icon: ChevronUp, color: "text-orange-500" },
    MEDIUM: { label: "Medium", icon: Equal, color: "text-amber-500" },
    LOW: { label: "Low", icon: ChevronDown, color: "text-blue-500" },
} as const;

export function PriorityIcon({ priority, withLabel }: { priority: keyof typeof PRIORITY_META; withLabel?: boolean }) {
    const m = PRIORITY_META[priority] ?? PRIORITY_META.MEDIUM;
    const Icon = m.icon;
    return (
        <span title={`${m.label} priority`} className={`inline-flex items-center gap-1 ${m.color}`}>
            <Icon size={16} strokeWidth={2.5} />
            {withLabel && <span className="text-xs font-semibold text-neutral-700">{m.label}</span>}
        </span>
    );
}

// ─── People ───────────────────────────────────────────────────
const AVATAR_COLORS = ["bg-emerald-600", "bg-blue-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600"];

export function Avatar({ person, size = 24 }: { person: { id: string; name: string } | null; size?: number }) {
    if (!person) {
        return <span title="Unassigned" className="inline-flex rounded-full border border-dashed border-neutral-300 bg-white shrink-0" style={{ width: size, height: size }} />;
    }
    const hash = [...person.id].reduce((h, c) => h + c.charCodeAt(0), 0);
    const initials = person.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
    return (
        <span
            title={person.name}
            className={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ${AVATAR_COLORS[hash % AVATAR_COLORS.length]}`}
            style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
        >
            {initials}
        </span>
    );
}

export const ROLE_GROUP: Record<string, string> = {
    SUPER_ADMIN: "Leadership", HR_ADMIN: "HR", FINANCE_ADMIN: "Finance", TA_MANAGER: "Talent Acquisition",
    TA_RECRUITER: "Talent Acquisition", AGENT: "Field partners", EMPLOYEE: "Employees",
};

export function PeopleOptions({ people }: { people: Person[] }) {
    const groups = new Map<string, Person[]>();
    for (const p of people) groups.set(ROLE_GROUP[p.role] ?? "Other", [...(groups.get(ROLE_GROUP[p.role] ?? "Other") ?? []), p]);
    return (
        <>
            {[...groups.entries()].map(([g, list]) => (
                <optgroup key={g} label={g}>
                    {list.map((p) => <option key={p.id} value={p.id}>{p.name}{p.designation ? ` — ${p.designation}` : ""}</option>)}
                </optgroup>
            ))}
        </>
    );
}

// ─── Labels ───────────────────────────────────────────────────
export function LabelChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold">
            {label}
            {onRemove && <button type="button" onClick={onRemove} className="hover:text-sky-950" aria-label={`Remove ${label}`}><X size={10} /></button>}
        </span>
    );
}

/** Tag input: type and press Enter/comma; suggests labels already in use. */
export function LabelInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
    const [draft, setDraft] = useState("");
    const add = (raw: string) => {
        const l = raw.trim().toLowerCase().replace(/\s+/g, "-");
        if (l && !value.includes(l)) onChange([...value, l]);
        setDraft("");
    };
    const open = suggestions.filter((s) => !value.includes(s) && s.includes(draft.toLowerCase())).slice(0, 8);
    return (
        <div>
            <div className="flex flex-wrap items-center gap-1 min-h-[38px] px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:ring-2 focus-within:ring-primary/20">
                {value.map((l) => <LabelChip key={l} label={l} onRemove={() => onChange(value.filter((x) => x !== l))} />)}
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
                        if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
                    }}
                    onBlur={() => draft && add(draft)}
                    placeholder={value.length ? "" : "Type a label and press Enter"}
                    className="flex-1 min-w-[120px] bg-transparent text-xs outline-none py-0.5"
                />
            </div>
            {open.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {open.map((s) => (
                        <button key={s} type="button" onClick={() => add(s)} className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-neutral-500 border border-dashed border-neutral-300 hover:border-sky-400 hover:text-sky-700">
                            + {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Multi-select of people shown as removable chips. */
export function PeoplePicker({ value, onChange, people, placeholder = "Add people" }: { value: string[]; onChange: (v: string[]) => void; people: Person[]; placeholder?: string }) {
    const chosen = value.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
    return (
        <div className="flex flex-wrap items-center gap-1.5 min-h-[38px] px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl">
            {chosen.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full bg-white border border-neutral-200 text-[11px] font-semibold text-neutral-700">
                    <Avatar person={p} size={18} /> {p.name}
                    <button type="button" onClick={() => onChange(value.filter((x) => x !== p.id))} aria-label={`Remove ${p.name}`} className="text-neutral-400 hover:text-neutral-700"><X size={11} /></button>
                </span>
            ))}
            <select
                value=""
                onChange={(e) => e.target.value && onChange([...value, e.target.value])}
                className="flex-1 min-w-[110px] bg-transparent text-xs text-neutral-500 outline-none"
            >
                <option value="">{placeholder}…</option>
                <PeopleOptions people={people.filter((p) => !value.includes(p.id))} />
            </select>
        </div>
    );
}

// ─── Dates ────────────────────────────────────────────────────
export function fmtDate(d: string | null | undefined): string {
    if (!d) return "—";
    const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: dt.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export function timeAgo(iso: string): string {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
    return fmtDate(iso);
}
