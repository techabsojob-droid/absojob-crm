// ─── Export renderers: CSV, Excel (.xlsx) and PDF — server only ──
// Takes plain tables ("sections") and returns a download Response.

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { toCsv } from "@/lib/csv";

export type ExportFormat = "csv" | "xlsx" | "pdf";
export const EXPORT_FORMATS: ExportFormat[] = ["csv", "xlsx", "pdf"];

export type Row = Record<string, unknown>;

export interface ExportSection {
    key: string;
    title: string;
    rows: Row[];
    /** Columns to show in the PDF (wide tables don't fit a page). Defaults to all. */
    pdfColumns?: string[];
}

export interface ExportDocument {
    /** e.g. "REQ-2026-0001 · Senior Backend Engineer" */
    title: string;
    /** One line under the title, e.g. client and export time. */
    subtitle: string;
    filename: string; // without extension
    sections: ExportSection[];
}

const MIME: Record<ExportFormat, string> = {
    csv: "text/csv; charset=utf-8",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pdf: "application/pdf",
};

const text = (v: unknown) => (v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v));

function download(body: BodyInit, format: ExportFormat, filename: string) {
    return new Response(body, {
        headers: { "Content-Type": MIME[format], "Content-Disposition": `attachment; filename="${filename}.${format}"`, "Cache-Control": "no-store" },
    });
}

// ─── CSV: one table per file ─────────────────────────────────

function renderCsv(doc: ExportDocument): Response {
    // The BOM makes Excel read ₹ and Indian names correctly
    return download(`﻿${toCsv(doc.sections[0]?.rows ?? [])}`, "csv", doc.filename);
}

// ─── Excel: one sheet per section ────────────────────────────

async function renderXlsx(doc: ExportDocument): Promise<Response> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "AbsoJob CRM";
    wb.created = new Date();
    const used = new Set<string>();

    for (const s of doc.sections) {
        // Sheet names: max 31 chars, no []:*?/\ and unique
        let name = s.title.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);
        for (let i = 2; used.has(name); i++) name = `${s.title.slice(0, 28)} ${i}`;
        used.add(name);

        const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
        const cols = s.rows.length ? Object.keys(s.rows[0]) : ["Note"];
        ws.columns = cols.map((c) => ({
            header: c,
            key: c,
            width: Math.min(50, Math.max(10, c.length + 2, ...s.rows.map((r) => text(r[c]).length + 2))),
        }));
        if (s.rows.length) {
            // Numbers stay numbers so Excel can sum and sort them
            for (const r of s.rows) ws.addRow(Object.fromEntries(cols.map((c) => [c, typeof r[c] === "number" ? r[c] : text(r[c])])));
            ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
        } else {
            ws.addRow({ Note: "Nothing recorded yet" });
        }
        const header = ws.getRow(1);
        header.font = { bold: true, color: { argb: "FFFFFFFF" } };
        header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF142B4A" } };
        header.alignment = { vertical: "middle" };
        ws.eachRow((row, i) => { if (i > 1) row.alignment = { vertical: "top", wrapText: true }; });
    }

    const buf = await wb.xlsx.writeBuffer();
    return download(new Uint8Array(buf as ArrayBuffer), "xlsx", doc.filename);
}

// ─── PDF: one report, a table per section ────────────────────

// The built-in PDF fonts can't draw ₹ or emoji
const pdfText = (v: unknown) => text(v).replace(/₹/g, "Rs.").replace(/[^\x20-\x7E -ÿ–—‘’“”•\n]/g, "");

function renderPdf(doc: ExportDocument): Response {
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 36;
    const navy: [number, number, number] = [20, 43, 74];

    pdf.setFont("helvetica", "bold").setFontSize(16).setTextColor(...navy);
    pdf.text(pdfText(doc.title), margin, margin + 8, { maxWidth: pageW - margin * 2 });
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(100);
    pdf.text(pdfText(doc.subtitle), margin, margin + 24, { maxWidth: pageW - margin * 2 });
    let y = margin + 44;

    for (const s of doc.sections) {
        const cols = s.rows.length ? (s.pdfColumns ?? Object.keys(s.rows[0])).filter((c) => c in s.rows[0]) : [];
        if (y > pdf.internal.pageSize.getHeight() - 90) { pdf.addPage(); y = margin; }
        pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(...navy);
        pdf.text(`${pdfText(s.title)}${s.rows.length && s.key !== "summary" ? ` (${s.rows.length})` : ""}`, margin, y);
        y += 8;

        if (!s.rows.length) {
            pdf.setFont("helvetica", "italic").setFontSize(9).setTextColor(120);
            pdf.text("Nothing recorded yet", margin, y + 12);
            y += 32;
            continue;
        }
        autoTable(pdf, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [cols.map(pdfText)],
            body: s.rows.map((r) => cols.map((c) => pdfText(r[c]))),
            styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak", valign: "top" },
            headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [246, 247, 249] },
            columnStyles: s.key === "summary" ? { 0: { fontStyle: "bold", cellWidth: 170 } } : {},
            didDrawPage: () => {
                const h = pdf.internal.pageSize.getHeight();
                pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(140);
                pdf.text(`AbsoJob CRM · ${pdfText(doc.title)} · page ${pdf.getNumberOfPages()}`, margin, h - 16);
            },
        });
        y = ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 26;
    }

    return download(pdf.output("arraybuffer"), "pdf", doc.filename);
}

export async function renderExport(format: ExportFormat, doc: ExportDocument): Promise<Response> {
    if (format === "xlsx") return renderXlsx(doc);
    if (format === "pdf") return renderPdf(doc);
    return renderCsv(doc);
}
