"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Files, Table2 } from "lucide-react";
import { toast } from "sonner";

type Format = "xlsx" | "pdf" | "csv";

const FORMATS: { id: Format; label: string; icon: typeof FileText }[] = [
    { id: "xlsx", label: "Excel", icon: FileSpreadsheet },
    { id: "pdf", label: "PDF", icon: FileText },
    { id: "csv", label: "CSV", icon: Table2 },
];

const SECTIONS: { type: string; label: string; hint: string }[] = [
    { type: "summary", label: "Opening summary", hint: "Details, team, SLA and stage counts" },
    { type: "candidates", label: "Candidates", hint: "Everyone in this opening's pipeline" },
    { type: "interviews", label: "Interviews", hint: "Rounds, outcomes and feedback" },
    { type: "offers", label: "Offers", hint: "Offered CTC and joining dates" },
    { type: "placements", label: "Placements", hint: "Joined candidates and fees" },
    { type: "tasks", label: "Tasks", hint: "Follow-ups linked to this opening" },
    { type: "activity", label: "Activity log", hint: "Who did what, and when" },
];

/** "Export" menu for one job opening: everything or one section, as Excel, PDF or CSV. */
export default function JobExportMenu({ jobId }: { jobId: string }) {
    const [open, setOpen] = useState(false);
    const [format, setFormat] = useState<Format>("xlsx");
    const [busy, setBusy] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);
        return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
    }, [open]);

    const download = async (type: string, label: string) => {
        setBusy(type);
        try {
            const res = await fetch(`/api/admin/jobs/${jobId}/export?type=${type}&format=${format}`);
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Export failed");
            }
            const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `${type}.${format}`;
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast.success(`${label} downloaded as ${FORMATS.find((f) => f.id === format)?.label}`);
            setOpen(false);
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setBusy(null);
        }
    };

    const allDisabled = format === "csv";

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="px-3.5 py-2 border border-neutral-200 rounded-md text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
                <Download size={14} /> Export <ChevronDown size={12} />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white border border-neutral-200 rounded-lg shadow-lg">
                    {/* Format */}
                    <div className="p-2 border-b border-neutral-100">
                        <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Format</p>
                        <div className="grid grid-cols-3 gap-1 p-0.5 bg-neutral-100 rounded-md" role="radiogroup" aria-label="Export format">
                            {FORMATS.map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={format === f.id}
                                    onClick={() => setFormat(f.id)}
                                    className={`flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium cursor-pointer ${format === f.id ? "bg-white text-navy shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
                                >
                                    <f.icon size={13} /> {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Everything */}
                    <div className="p-1 border-b border-neutral-100">
                        <button
                            role="menuitem"
                            type="button"
                            disabled={!!busy || allDisabled}
                            onClick={() => download("all", "Full report")}
                            className="w-full text-left px-2.5 py-2 rounded-md hover:bg-neutral-50 disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed flex gap-2.5"
                        >
                            <Files size={16} className="text-navy mt-0.5 shrink-0" />
                            <span>
                                <span className="block text-xs font-semibold text-neutral-900">{busy === "all" ? "Preparing…" : "Everything (full report)"}</span>
                                <span className="block text-[11px] text-neutral-500">
                                    {allDisabled ? "CSV holds one table. Pick Excel or PDF for everything." : format === "xlsx" ? "All sections, one sheet each" : "All sections in one document"}
                                </span>
                            </span>
                        </button>
                    </div>

                    {/* One section */}
                    <div className="py-1 max-h-[50vh] overflow-y-auto">
                        <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Or just one section</p>
                        {SECTIONS.map((o) => (
                            <button
                                key={o.type}
                                role="menuitem"
                                type="button"
                                disabled={!!busy}
                                onClick={() => download(o.type, o.label)}
                                className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-60 cursor-pointer"
                            >
                                <span className="block text-xs font-medium text-neutral-800">{busy === o.type ? "Preparing…" : o.label}</span>
                                <span className="block text-[11px] text-neutral-500">{o.hint}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
