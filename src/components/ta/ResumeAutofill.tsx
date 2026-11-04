"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ParsedResume } from "@/lib/resume/parse";

export interface ResumeFile { name: string; mimeType: string; dataBase64: string; size: number }
export interface ResumeMatch {
    id: string; candidateCode: string; name: string; email: string; phone: string;
    currentCompany: string | null; currentDesignation: string | null;
    matchedOn: string[]; inThisJob: boolean; activeApplications: number;
}
export interface ResumeParseResult {
    fields: Partial<ParsedResume>;
    missing: string[];
    matches: ResumeMatch[];
    pages: number | null;
}

const ACCEPT: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const MAX = 5 * 1024 * 1024;

function readBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ""));
        r.onerror = () => reject(new Error("Could not read the file"));
        r.readAsDataURL(file);
    });
}

/**
 * Drag-and-drop resume upload that reads the CV on the server and hands the
 * extracted fields back for the recruiter to review. Manual entry always stays possible.
 */
export default function ResumeAutofill({ jobId, onParsed, onCleared }: {
    jobId?: string;
    onParsed: (result: ResumeParseResult, file: ResumeFile) => void;
    onCleared: () => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [drag, setDrag] = useState(false);
    const [state, setState] = useState<{ kind: "idle" } | { kind: "parsing"; name: string } | { kind: "done"; name: string; found: number; missing: number; pages: number | null } | { kind: "error"; name?: string; message: string; file?: ResumeFile }>({ kind: "idle" });

    async function handle(file: File | undefined) {
        if (!file) return;
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const mimeType = ACCEPT[ext];
        if (!mimeType) return setState({ kind: "error", name: file.name, message: "Upload a PDF, DOC or DOCX file." });
        if (file.size > MAX) return setState({ kind: "error", name: file.name, message: "Resume is larger than 5 MB." });
        setState({ kind: "parsing", name: file.name });
        let payload: ResumeFile | undefined;
        try {
            payload = { name: file.name, mimeType, dataBase64: await readBase64(file), size: file.size };
            const res = await fetch("/api/ta/candidates/parse-resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: payload.name, mimeType, dataBase64: payload.dataBase64, jobId }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error ?? "Could not read this resume");
            const result = d as ResumeParseResult;
            const found = Object.entries(result.fields).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length)).length;
            setState({ kind: "done", name: file.name, found, missing: result.missing.length, pages: result.pages });
            onParsed(result, payload);
        } catch (e) {
            // Keep the file so it can still be attached; the recruiter types the details in
            setState({ kind: "error", name: file.name, message: e instanceof Error ? e.message : "Could not read this resume", file: payload });
            if (payload) onParsed({ fields: {}, missing: [], matches: [], pages: null }, payload);
        }
    }

    const clear = () => {
        setState({ kind: "idle" });
        if (input.current) input.current.value = "";
        onCleared();
    };

    if (state.kind === "done" || (state.kind === "error" && state.name)) {
        const ok = state.kind === "done";
        return (
            <div className={`p-3 rounded-xl border flex items-start gap-3 ${ok ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50"}`}>
                {ok ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0 text-xs">
                    <p className="font-bold text-neutral-800 truncate flex items-center gap-1.5"><FileText size={13} /> {state.name}</p>
                    {ok ? (
                        <p className="text-neutral-600 mt-0.5">
                            Details filled from the resume{state.pages ? ` (${state.pages} page${state.pages > 1 ? "s" : ""})` : ""}. Review every field before saving
                            {state.missing ? <> — <span className="font-bold text-amber-700">{state.missing} not found</span>, marked below.</> : "."}
                        </p>
                    ) : (
                        <p className="text-amber-800 mt-0.5">{state.message} {state.file ? "The file will still be attached; enter the details manually." : ""}</p>
                    )}
                </div>
                <button type="button" onClick={clear} title="Remove resume" className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-white">
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => state.kind !== "parsing" && input.current?.click()}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && state.kind !== "parsing") { e.preventDefault(); input.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (state.kind !== "parsing") void handle(e.dataTransfer.files?.[0]); }}
            className={`p-4 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors ${drag ? "border-primary bg-primary/5" : "border-neutral-200 bg-neutral-50 hover:border-primary/50"}`}
        >
            <input ref={input} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => void handle(e.target.files?.[0])} />
            {state.kind === "parsing" ? (
                <div className="flex flex-col items-center gap-1.5 text-xs text-neutral-600">
                    <Loader2 size={20} className="animate-spin text-primary" />
                    <span className="font-bold">Reading {state.name}…</span>
                    <span className="text-neutral-400">Extracting contact, experience, skills and education</span>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-1 text-xs">
                    <UploadCloud size={20} className="text-primary" />
                    <span className="font-bold text-neutral-800">Upload resume to auto-fill</span>
                    <span className="text-neutral-400">Drag & drop or click · PDF, DOC, DOCX · max 5 MB</span>
                    {state.kind === "error" && <span className="text-red-600 font-medium mt-1">{state.message}</span>}
                </div>
            )}
        </div>
    );
}
