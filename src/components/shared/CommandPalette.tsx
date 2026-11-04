"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowRight, Briefcase, Building2, CheckSquare, Clock, CornerDownLeft, FileText, LayoutGrid, Loader2, Search, User, Users, Zap,
} from "lucide-react";
import { workspacesFor, WORKSPACE_LABEL, type Workspace } from "@/lib/access";
import { COMMANDS, type Command } from "@/lib/commands";
import type { UserRole } from "@/lib/types";

interface Hit { id: string; title: string; type: string; href: string }
interface Item { key: string; label: string; sub?: string; href: string; group: string; icon: typeof Search }

const RECENT_KEY = "absojob.palette.recent";
const TYPE_ICON: Record<string, typeof Search> = { Job: Briefcase, Candidate: User, Client: Building2, Team: Users, Invoice: FileText, Task: CheckSquare };

function readRecent(): Item[] {
    try { return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Item[]).slice(0, 5); } catch { return []; }
}
function rememberRecent(item: Item) {
    try {
        const list = [item, ...readRecent().filter((r) => r.href !== item.href)].slice(0, 5)
            .map((r) => ({ key: r.key, label: r.label, sub: r.sub, href: r.href, group: r.group }));
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch { /* storage blocked */ }
}

const matches = (c: Command, q: string) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q);

/** ⌘K / Ctrl+K: search records and tasks, jump to pages, run quick actions. */
export function CommandPalette({ open, onClose, role }: { open: boolean; onClose: () => void; role: UserRole | undefined }) {
    const router = useRouter();
    const [q, setQ] = useState("");
    const [hits, setHits] = useState<Hit[]>([]);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(0);
    const [recent, setRecent] = useState<Item[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Fresh state each time it opens
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => {
            setQ(""); setHits([]); setActive(0); setRecent(readRecent());
            inputRef.current?.focus();
        });
        return () => cancelAnimationFrame(id);
    }, [open]);

    // Debounced record search
    useEffect(() => {
        const term = q.trim();
        if (!open || term.length < 2) return;
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
                setHits(res.ok ? await res.json() : []);
            } catch { /* aborted */ } finally { setLoading(false); }
        }, 180);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [q, open]);

    const items = useMemo<Item[]>(() => {
        const term = q.trim().toLowerCase();
        const spaces: Workspace[] = role ? workspacesFor(role) : [];
        const audience = role === "AGENT" ? "AGENT" : "STAFF";
        const commands = spaces.flatMap((ws) =>
            COMMANDS[ws].filter((c) => !c.audience || c.audience === audience).map((c) => ({ c, ws })));
        const toItem = ({ c, ws }: { c: Command; ws: Workspace }): Item => ({
            key: `${c.kind}:${c.href}`, label: c.label, sub: spaces.length > 1 ? WORKSPACE_LABEL[ws] : undefined, href: c.href,
            group: c.kind === "action" ? "Quick actions" : "Go to", icon: c.kind === "action" ? Zap : LayoutGrid,
        });
        if (!term) {
            const quick = commands.filter(({ c }) => c.kind === "action").slice(0, 6).map(toItem);
            return [...recent.map((r) => ({ ...r, group: "Recent", icon: Clock })), ...quick];
        }
        const records = term.length >= 2 ? hits.map((h): Item => ({
            key: `hit:${h.type}:${h.id}`, label: h.title, sub: h.type, href: h.href, group: h.type === "Task" ? "Tasks" : "Records", icon: TYPE_ICON[h.type] ?? Search,
        })) : [];
        const cmds = commands.filter(({ c }) => matches(c, term)).slice(0, 8).map(toItem);
        // Exact ticket keys and records first, then actions and pages
        return [...records.filter((r) => r.group === "Tasks"), ...records.filter((r) => r.group !== "Tasks"), ...cmds.filter((c) => c.group === "Quick actions"), ...cmds.filter((c) => c.group === "Go to")];
    }, [q, hits, recent, role]);

    const selected = Math.min(active, Math.max(0, items.length - 1));
    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    const go = (item: Item) => {
        rememberRecent(item);
        onClose();
        router.push(item.href);
    };

    if (!open) return null;

    let lastGroup = "";
    return (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 pt-[12vh]" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-fade-in">
                <div className="flex items-center gap-3 px-4 border-b border-neutral-100">
                    {loading ? <Loader2 size={18} className="text-neutral-400 animate-spin" /> : <Search size={18} className="text-neutral-400" />}
                    <input
                        ref={inputRef}
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setActive(0); if (e.target.value.trim().length < 2) setHits([]); }}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
                            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
                            else if (e.key === "Enter" && items[selected]) { e.preventDefault(); go(items[selected]); }
                            else if (e.key === "Escape") onClose();
                        }}
                        placeholder="Search people, candidates, jobs, tasks (ABS-12)… or type a page"
                        className="flex-1 py-4 text-sm outline-none bg-transparent"
                    />
                    <kbd className="text-[10px] font-semibold text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5">Esc</kbd>
                </div>

                <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
                    {items.length === 0 && (
                        <p className="px-4 py-10 text-center text-sm text-neutral-400">
                            {q.trim().length >= 2 && !loading ? `Nothing found for “${q.trim()}”` : "Start typing to search"}
                        </p>
                    )}
                    {items.map((item, i) => {
                        const header = item.group !== lastGroup ? item.group : null;
                        lastGroup = item.group;
                        const Icon = item.icon;
                        return (
                            <div key={item.key}>
                                {header && <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">{header}</p>}
                                <button
                                    data-index={i}
                                    onMouseMove={() => setActive(i)}
                                    onClick={() => go(item)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${i === selected ? "bg-primary/[0.06]" : ""}`}
                                >
                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i === selected ? "bg-primary text-white" : "bg-neutral-100 text-neutral-500"}`}>
                                        <Icon size={15} />
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-semibold text-neutral-800 truncate">{item.label}</span>
                                        {item.sub && <span className="block text-[11px] text-neutral-400 truncate">{item.sub}</span>}
                                    </span>
                                    {i === selected ? <CornerDownLeft size={14} className="text-neutral-400" /> : <ArrowRight size={14} className="text-neutral-200" />}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center gap-4 px-4 py-2 border-t border-neutral-100 text-[10px] text-neutral-400">
                    <span><kbd className="font-semibold">↑↓</kbd> navigate</span>
                    <span><kbd className="font-semibold">↵</kbd> open</span>
                    <span className="ml-auto"><kbd className="font-semibold">⌘K</kbd> anywhere</span>
                </div>
            </div>
        </div>
    );
}
