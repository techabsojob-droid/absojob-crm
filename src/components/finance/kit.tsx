"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const inputCls = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white";
export const btn = {
    primary: "px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50",
    good: "px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50",
    ghost: "px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 text-xs font-bold hover:bg-neutral-50 disabled:opacity-50",
    danger: "px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-50",
    soft: "px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-white disabled:opacity-50",
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
    return (
        <div className="flex flex-wrap gap-1.5 border-b border-neutral-200 pb-3">
            {tabs.map((t) => (
                <button key={t.id} onClick={() => onChange(t.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${value === t.id ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>{t.label}</button>
            ))}
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
