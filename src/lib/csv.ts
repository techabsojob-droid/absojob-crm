/** Rows → CSV (RFC 4180 quoting). Column order follows the first row's keys. */
export function toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return "";
    const cols = Object.keys(rows[0]);
    const cell = (v: unknown) => {
        if (v == null) return "";
        const s = Array.isArray(v) ? v.join("; ") : String(v);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

/** CSV download response; the BOM makes Excel read ₹ and Indian names correctly. */
export function csvDownload(rows: Record<string, unknown>[], filename: string): Response {
    return new Response(`﻿${toCsv(rows)}`, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
    });
}
