"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Bold, Check, ChevronDown, ChevronUp, GripVertical, Heading3, Italic, List, ListOrdered, Plus, Underline, X } from "lucide-react";

// ─── Shared styles ────────────────────────────────────────────
export const inputBase = "w-full h-10 px-3 text-sm bg-white border rounded-xl outline-none transition-colors placeholder:text-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-500";
export const inputCls = (error?: string | null) => `${inputBase} ${error ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100" : "border-neutral-200 hover:border-neutral-300 focus:border-primary focus:ring-2 focus:ring-primary/15"}`;
export const textareaCls = (error?: string | null) => inputCls(error).replace("h-10", "min-h-[84px] py-2.5");

/** Label + control + helper / inline error. */
export function Field({ label, required, hint, error, children, className = "", htmlFor }: {
    label: string; required?: boolean; hint?: string; error?: string | null; children: React.ReactNode; className?: string; htmlFor?: string;
}) {
    return (
        <div className={`space-y-1.5 min-w-0 ${className}`}>
            <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-neutral-800">
                {label}{required && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
            </label>
            {children}
            {error ? <p className="text-xs font-medium text-red-600" role="alert">{error}</p> : hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
        </div>
    );
}

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <section className="space-y-4">
            <div>
                <h3 className="text-[15px] font-bold text-neutral-900">{title}</h3>
                {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
            </div>
            {children}
        </section>
    );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
            className="flex items-start gap-3 text-left p-3 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 disabled:opacity-60 w-full">
            <span className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-neutral-200"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
            </span>
            <span>
                <span className="block text-sm font-semibold text-neutral-800">{label}</span>
                {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
            </span>
        </button>
    );
}

// ─── Searchable select ────────────────────────────────────────
export interface Option { value: string; label: string; hint?: string; disabled?: boolean }

/**
 * Searchable single select. With `allowCustom`, typing a value that isn't in the list and pressing
 * Enter (or choosing "Use …") keeps the typed text as the value.
 */
export function Combobox({ id, options, value, onChange, placeholder = "Select…", error, disabled, allowCustom, emptyText = "No matches", onSearch, loading, customLabel }: {
    id?: string; options: Option[]; value: string; onChange: (v: string, opt?: Option) => void; placeholder?: string; error?: string | null; disabled?: boolean;
    allowCustom?: boolean; emptyText?: string; onSearch?: (q: string) => void; loading?: boolean; customLabel?: (q: string) => string;
}) {
    const autoId = useId();
    const listId = `${id ?? autoId}-list`;
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [active, setActive] = useState(0);
    const wrap = useRef<HTMLDivElement>(null);
    const selected = options.find((o) => o.value === value);
    const shown = useMemo(() => {
        const t = q.trim().toLowerCase();
        const list = onSearch || !t ? options : options.filter((o) => o.label.toLowerCase().includes(t) || o.hint?.toLowerCase().includes(t));
        return list.slice(0, 200);
    }, [options, q, onSearch]);
    const canCustom = allowCustom && q.trim() && !options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase());

    useEffect(() => {
        const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) { setOpen(false); setQ(""); } };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const choose = (o?: Option) => {
        if (o) onChange(o.value, o);
        else if (canCustom) onChange(q.trim());
        setOpen(false);
        setQ("");
    };

    return (
        <div ref={wrap} className="relative">
            <div className="relative">
                <input
                    id={id}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    disabled={disabled}
                    value={open ? q : selected?.label ?? (allowCustom ? value : "")}
                    placeholder={selected?.label ?? (allowCustom && value ? value : placeholder)}
                    onFocus={() => { setOpen(true); setActive(0); }}
                    onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); onSearch?.(e.target.value); }}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, shown.length - 1)); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                        else if (e.key === "Enter") { e.preventDefault(); const o = shown[active]; if (o && !o.disabled) choose(o); else if (canCustom) choose(); }
                        else if (e.key === "Escape") { setOpen(false); setQ(""); }
                    }}
                    className={`${inputCls(error)} pr-9`}
                />
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
            {open && !disabled && (
                <ul id={listId} role="listbox" className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg py-1 text-sm">
                    {loading && <li className="px-3 py-2 text-xs text-neutral-400">Searching…</li>}
                    {!loading && shown.length === 0 && !canCustom && <li className="px-3 py-2 text-xs text-neutral-400">{emptyText}</li>}
                    {shown.map((o, i) => (
                        <li key={`${o.value}-${i}`} role="option" aria-selected={o.value === value} aria-disabled={o.disabled}
                            onMouseDown={(e) => { e.preventDefault(); if (!o.disabled) choose(o); }}
                            onMouseEnter={() => setActive(i)}
                            className={`px-3 py-2 flex items-center justify-between gap-2 ${o.disabled ? "text-neutral-300 cursor-not-allowed" : "cursor-pointer"} ${i === active && !o.disabled ? "bg-primary/5" : ""}`}>
                            <span className="min-w-0">
                                <span className="block truncate text-neutral-800">{o.label}</span>
                                {o.hint && <span className="block truncate text-[11px] text-neutral-400">{o.hint}</span>}
                            </span>
                            {o.value === value && <Check size={14} className="text-primary shrink-0" />}
                        </li>
                    ))}
                    {canCustom && (
                        <li role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); choose(); }} className="px-3 py-2 cursor-pointer text-primary font-semibold border-t border-neutral-100 flex items-center gap-1.5">
                            <Plus size={13} /> {customLabel ? customLabel(q.trim()) : `Use “${q.trim()}”`}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

// ─── Tag input (skills, certifications, users) ────────────────
export function TagInput({ id, value, onChange, suggestions = [], placeholder = "Type and press Enter", error, max = 30, allowCustom = true, labelOf, disabled }: {
    id?: string; value: string[]; onChange: (v: string[]) => void; suggestions?: Option[] | string[]; placeholder?: string; error?: string | null;
    max?: number; allowCustom?: boolean; labelOf?: (v: string) => string; disabled?: boolean;
}) {
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const wrap = useRef<HTMLDivElement>(null);
    const opts: Option[] = useMemo(() => (suggestions as (Option | string)[]).map((s) => (typeof s === "string" ? { value: s, label: s } : s)), [suggestions]);
    const has = (v: string) => value.some((x) => x.toLowerCase() === v.toLowerCase());
    const t = q.trim().toLowerCase();
    const shown = opts.filter((o) => !has(o.value) && (!t || o.label.toLowerCase().includes(t))).slice(0, 12);
    const display = (v: string) => labelOf?.(v) ?? opts.find((o) => o.value === v)?.label ?? v;

    useEffect(() => {
        const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const add = (raw: string) => {
        const v = raw.replace(/\s+/g, " ").trim().slice(0, 60);
        if (!v || has(v) || value.length >= max) { setQ(""); return; }
        const match = opts.find((o) => o.label.toLowerCase() === v.toLowerCase() || o.value.toLowerCase() === v.toLowerCase());
        if (!match && !allowCustom) return;
        onChange([...value, match?.value ?? v]);
        setQ("");
        setActive(0);
    };

    return (
        <div ref={wrap} className="relative">
            <div className={`flex flex-wrap items-center gap-1.5 min-h-10 px-2 py-1.5 bg-white border rounded-xl ${error ? "border-red-300" : "border-neutral-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"} ${disabled ? "bg-neutral-50" : ""}`}>
                {value.map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg bg-primary/8 border border-primary/15 text-primary text-xs font-semibold">
                        {display(v)}
                        {!disabled && <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${display(v)}`} className="p-0.5 rounded hover:bg-primary/15"><X size={11} /></button>}
                    </span>
                ))}
                {!disabled && value.length < max && (
                    <input
                        id={id}
                        value={q}
                        onFocus={() => setOpen(true)}
                        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (open && shown[active] && (!allowCustom || t && shown[active].label.toLowerCase().startsWith(t))) add(shown[active].value); else add(q); }
                            else if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
                            else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
                            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                            else if (e.key === "Escape") setOpen(false);
                        }}
                        onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            if (/[,\n]/.test(text)) {
                                e.preventDefault();
                                const next = [...value];
                                for (const part of text.split(/[,\n]/)) { const p = part.trim(); if (p && !next.some((x) => x.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p); }
                                onChange(next);
                            }
                        }}
                        placeholder={value.length ? "" : placeholder}
                        className="flex-1 min-w-[120px] h-7 bg-transparent text-sm outline-none placeholder:text-neutral-400"
                    />
                )}
            </div>
            {open && !disabled && (shown.length > 0 || (allowCustom && t && !has(q.trim()))) && (
                <ul role="listbox" className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg py-1 text-sm">
                    {shown.map((o, i) => (
                        <li key={o.value} role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); add(o.value); }} onMouseEnter={() => setActive(i)}
                            className={`px-3 py-1.5 cursor-pointer ${i === active ? "bg-primary/5" : ""}`}>
                            {o.label}{o.hint && <span className="text-[11px] text-neutral-400"> · {o.hint}</span>}
                        </li>
                    ))}
                    {allowCustom && t && !has(q.trim()) && !opts.some((o) => o.label.toLowerCase() === t) && (
                        <li role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); add(q); }} className="px-3 py-1.5 cursor-pointer text-primary font-semibold border-t border-neutral-100">+ Add “{q.trim()}”</li>
                    )}
                </ul>
            )}
        </div>
    );
}

// ─── Rich text ────────────────────────────────────────────────
const RT_TOOLS: [string, typeof Bold, string, string | undefined][] = [
    ["Bold", Bold, "bold", undefined], ["Italic", Italic, "italic", undefined], ["Underline", Underline, "underline", undefined],
    ["Heading", Heading3, "formatBlock", "<h3>"], ["Bulleted list", List, "insertUnorderedList", undefined], ["Numbered list", ListOrdered, "insertOrderedList", undefined],
];
/** Minimal rich text: bold, italic, underline, heading, bullet and numbered lists. Paste is plain text. */
export function RichTextEditor({ id, value, onChange, placeholder, error, minHeight = 160 }: {
    id?: string; value: string; onChange: (html: string) => void; placeholder?: string; error?: string | null; minHeight?: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [empty, setEmpty] = useState(() => !value.replace(/<[^>]+>/g, "").trim());
    // Set the initial content once; afterwards the editor owns its DOM
    useEffect(() => {
        // Placeholder state follows user input (emit); the initial value already set it
        if (ref.current && ref.current.innerHTML !== value && document.activeElement !== ref.current) ref.current.innerHTML = value || "";
    }, [value]);
    const emit = () => {
        const el = ref.current;
        if (!el) return;
        setEmpty(!el.textContent?.trim() && !el.querySelector("li"));
        onChange(el.innerHTML);
    };
    const cmd = (c: string, arg?: string) => {
        ref.current?.focus();
        // execCommand is deprecated but remains the only cross-browser way to format contentEditable without a library
        document.execCommand(c, false, arg);
        emit();
    };
    return (
        <div className={`rounded-xl border bg-white overflow-hidden ${error ? "border-red-300" : "border-neutral-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"}`}>
            <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-neutral-100 bg-neutral-50/60" role="toolbar" aria-label="Formatting">
                {RT_TOOLS.map(([label, Icon, command, arg]) => (
                    <button key={label} type="button" title={label} aria-label={label} onMouseDown={(e) => { e.preventDefault(); cmd(command, arg); }} className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-white">
                        <Icon size={15} />
                    </button>
                ))}
                <button type="button" title="Normal text" onMouseDown={(e) => { e.preventDefault(); cmd("formatBlock", "<p>"); }} className="ml-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 hover:bg-white">Normal</button>
            </div>
            <div className="relative">
                {empty && placeholder && <p className="absolute left-3.5 top-3 text-sm text-neutral-400 pointer-events-none">{placeholder}</p>}
                <div
                    id={id}
                    ref={ref}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline
                    onInput={emit}
                    onBlur={emit}
                    onPaste={(e) => {
                        e.preventDefault();
                        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
                    }}
                    style={{ minHeight }}
                    className="px-3.5 py-3 text-sm text-neutral-800 outline-none prose-req"
                />
            </div>
        </div>
    );
}

/** Rendered rich text from the server (already sanitised to basic tags). */
export function RichText({ html, text, className = "" }: { html?: string | null; text?: string | null; className?: string }) {
    if (html) return <div className={`prose-req text-sm text-neutral-700 ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
    return <p className={`text-sm text-neutral-700 whitespace-pre-line ${className}`}>{text || "—"}</p>;
}

// ─── Interview rounds ─────────────────────────────────────────
export function RoundsEditor({ value, onChange, presets }: { value: string[]; onChange: (v: string[]) => void; presets: readonly string[] }) {
    const [draft, setDraft] = useState("");
    const move = (i: number, d: number) => {
        const j = i + d;
        if (j < 0 || j >= value.length) return;
        const next = [...value];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    };
    const add = (name: string) => {
        const n = name.replace(/\s+/g, " ").trim().slice(0, 60);
        if (!n || value.length >= 12) return;
        onChange([...value, n]);
        setDraft("");
    };
    return (
        <div className="space-y-2">
            {value.length === 0 && <p className="text-xs text-neutral-400">No rounds yet — add them below or pick from the common rounds.</p>}
            <ol className="space-y-1.5">
                {value.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 p-1.5 pl-2 rounded-xl border border-neutral-200 bg-white">
                        <GripVertical size={14} className="text-neutral-300 shrink-0" />
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <input value={r} maxLength={60} aria-label={`Round ${i + 1}`} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
                            onBlur={(e) => { if (!e.target.value.trim()) onChange(value.filter((_, j) => j !== i)); }}
                            className="flex-1 min-w-0 h-8 px-2 text-sm rounded-lg outline-none focus:bg-neutral-50" />
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-1 rounded-lg text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 disabled:opacity-30"><ChevronUp size={15} /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move down" className="p-1 rounded-lg text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 disabled:opacity-30"><ChevronDown size={15} /></button>
                        <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove round" className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"><X size={15} /></button>
                    </li>
                ))}
            </ol>
            <div className="flex gap-2">
                <input value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
                    placeholder="Add a round, e.g. Technical Round 1" className={inputCls()} />
                <button type="button" onClick={() => add(draft)} disabled={!draft.trim() || value.length >= 12} className="h-10 px-3 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 flex items-center gap-1"><Plus size={14} /> Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {presets.filter((p) => !value.includes(p)).map((p) => (
                    <button key={p} type="button" onClick={() => add(p)} disabled={value.length >= 12} className="px-2 py-1 rounded-lg border border-dashed border-neutral-300 text-[11px] font-semibold text-neutral-500 hover:border-primary hover:text-primary">+ {p}</button>
                ))}
            </div>
        </div>
    );
}
