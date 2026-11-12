"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ServerCrash } from "lucide-react";

// Shown instead of the bare "Application error" page when a page or workspace layout fails
// on the server — most often a short database hiccup (e.g. connection limit), so offer a retry.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const router = useRouter();
    const [retrying, setRetrying] = useState(false);
    useEffect(() => { console.error(error); }, [error]);
    const retry = () => { setRetrying(true); router.refresh(); reset(); setTimeout(() => setRetrying(false), 1500); };

    return (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-8 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><ServerCrash size={22} /></div>
                <div>
                    <h1 className="text-lg font-bold text-neutral-900">This page couldn&apos;t load right now</h1>
                    <p className="text-sm text-neutral-500 mt-1">The server is busy or the database didn&apos;t respond in time. Your data is safe — please try again in a moment.</p>
                </div>
                <button onClick={retry} disabled={retrying} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60">
                    <RefreshCw size={15} className={retrying ? "animate-spin" : ""} /> {retrying ? "Retrying…" : "Try again"}
                </button>
                {error.digest && <p className="text-[11px] text-neutral-400">Reference: {error.digest}</p>}
            </div>
        </div>
    );
}
