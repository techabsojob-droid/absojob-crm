"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/** A4-style document with a toolbar; only the document is printed (Print → Save as PDF). */
export default function PrintArea({ backHref, backLabel, children }: { backHref: string; backLabel: string; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <style>{`@media print { body * { visibility: hidden !important; } .print-area, .print-area * { visibility: visible !important; } .print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; margin: 0 !important; } @page { margin: 14mm; } }`}</style>
            <div className="flex items-center justify-between max-w-3xl mx-auto">
                <Link href={backHref} className="text-xs font-bold text-neutral-600 flex items-center gap-1.5 hover:text-primary"><ArrowLeft size={14} /> {backLabel}</Link>
                <button onClick={() => window.print()} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5"><Printer size={14} /> Print / Save as PDF</button>
            </div>
            <div className="print-area max-w-3xl mx-auto bg-white border border-neutral-200 rounded-2xl p-8 text-neutral-900 text-sm">{children}</div>
        </div>
    );
}
