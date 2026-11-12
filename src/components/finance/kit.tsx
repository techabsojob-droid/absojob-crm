"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const inputCls = "w-full h-9 px-3 rounded-md border border-neutral-300 text-[13px] text-neutral-800 focus:border-navy outline-none bg-white [&:is(textarea)]:h-auto [&:is(textarea)]:py-2";
export const btn = {
    // Navy = default primary; crimson ("accent") is reserved for the one key action on a screen
    primary: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-navy text-white text-[13px] font-medium hover:bg-navy-2 disabled:opacity-50 disabled:pointer-events-none",
    accent: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent text-white text-[13px] font-medium hover:bg-accent-dark disabled:opacity-50 disabled:pointer-events-none",
    good: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-success text-white text-[13px] font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none",
    ghost: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-neutral-300 bg-white text-neutral-700 text-[13px] font-medium hover:bg-neutral-50 hover:border-neutral-400 disabled:opacity-50 disabled:pointer-events-none",
    danger: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-red-200 bg-white text-red-700 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none",
    soft: "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-primary-light text-navy text-[13px] font-medium hover:bg-violet-100 disabled:opacity-50 disabled:pointer-events-none",
};

export function money(n: number | null | undefined, currency = "INR") {
    const v = Number(n || 0);
    if (currency === "INR") return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    return `${currency} ${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function downloadText(content: string, filename: string, type = "text/csv") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
    return rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

/** Mutation that shows the server error, toasts success and refreshes the given query keys. */
export function useAct<T = unknown>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", invalidate: string[], success?: string | ((d: T) => string)) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: Record<string, unknown>) => api<T>(path, method, payload),
        onSuccess: (d) => {
            if (success) toast.success(typeof success === "function" ? success(d) : success);
            invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    // Underlined tabs: the standard section switcher across the CRM
    return (
        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-neutral-200 -mb-px no-scrollbar">
            {tabs.map((t) => {
                const on = value === t.id;
                return (
                    <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
                        className={`relative h-9 px-3 text-[13px] whitespace-nowrap transition-colors ${on ? "text-navy font-semibold" : "text-neutral-500 hover:text-neutral-800"}`}>
                        {t.label}
                        {on && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-accent" />}
                    </button>
                );
            })}
        </div>
    );
}

/** Reads a browser File into base64 and uploads it to /api/files. */
export async function uploadFile(file: File, purpose: string): Promise<{ id: string; url: string; name: string }> {
    if (file.size > 5 * 1024 * 1024) throw new Error("File is larger than 5 MB");
    const dataBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file"));
        r.readAsDataURL(file);
    });
    return api("/api/files", "POST", { name: file.name, mimeType: file.type, dataBase64, purpose });
}

/** Parses a simple bank statement CSV (date, description, reference, debit, credit). */
export function parseStatementCsv(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];
    const split = (l: string) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()).slice(0, -1);
    const header = split(lines[0]).map((h) => h.toLowerCase());
    const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
    const di = idx("date"), de = idx("description", "narration", "particular"), re = idx("ref", "cheque", "utr"), dr = idx("debit", "withdrawal"), cr = idx("credit", "deposit");
    const toIso = (d: string) => {
        if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
        const m = d.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
        if (!m) return d;
        const y = m[3].length === 2 ? `20${m[3]}` : m[3];
        return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    };
    return lines.slice(1).map(split).map((c) => ({ date: toIso(c[di] ?? ""), description: c[de] ?? "", reference: re >= 0 ? c[re] : "", debit: dr >= 0 ? c[dr] : "0", credit: cr >= 0 ? c[cr] : "0" }));
}

/** Reads a browser File as a data URL payload for JSON upload APIs (max 5 MB). */
export async function fileToPayload(file: File): Promise<{ name: string; mimeType: string; dataBase64: string }> {
    if (file.size > 5 * 1024 * 1024) throw new Error("File is larger than 5 MB");
    const dataBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file"));
        r.readAsDataURL(file);
    });
    return { name: file.name, mimeType: file.type, dataBase64 };
}

/** Relative "3d ago" style label. */
export function ago(iso: string | null | undefined) {
    if (!iso) return "—";
    const s = Math.round((Date.now() - +new Date(iso)) / 1000);
    if (s < 0) { const d = Math.ceil(-s / 86400); return d <= 1 ? "tomorrow" : `in ${d}d`; }
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}
