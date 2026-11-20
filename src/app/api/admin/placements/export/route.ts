import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { addAudit, invoices, placements } from "@/lib/mock/data";
import { placementFee } from "@/lib/mock/finance";
import { invoicingRow, missingInvoiceDetails } from "@/lib/invoicing-details";
import { EXPORT_FORMATS, renderExport, type ExportFormat } from "@/lib/export-formats";

// GET ?format=xlsx|csv|pdf&status=&q=&clientId= : "Candidate information for invoicing" sheet
// One row per placement with the ten details the client asks for (plus the client name).
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "FINANCE_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "xlsx") as ExportFormat;
    if (!EXPORT_FORMATS.includes(format)) return NextResponse.json({ error: `Format must be one of: ${EXPORT_FORMATS.join(", ")}` }, { status: 400 });
    const status = url.searchParams.get("status");
    const clientId = url.searchParams.get("clientId");
    const q = (url.searchParams.get("q") ?? "").toLowerCase();

    const list = placements
        .filter((p) => p.orgId === me.orgId)
        .filter((p) => !status || status === "ALL" || p.joiningStatus === status)
        .filter((p) => !clientId || p.clientId === clientId)
        .filter((p) => !q || [p.candidateName, p.clientName, p.jobTitle, p.recruiterName, p.employeeCode ?? ""].some((x) => x.toLowerCase().includes(q)))
        .sort((a, b) => a.clientName.localeCompare(b.clientName) || a.joiningDate.localeCompare(b.joiningDate));
    if (!list.length) return NextResponse.json({ error: "No placements match these filters" }, { status: 404 });

    const rows = list.map((p) => {
        const inv = invoices.find((i) => (i.id === p.invoiceId || (p.invoiceNumber && i.invoiceNumber === p.invoiceNumber)) && i.kind === "INVOICE" && i.status !== "CANCELLED");
        // Billed amount when invoiced, otherwise the fee it will be billed at
        const billed = inv ? inv.lineItems.filter((l) => l.placementId === p.id).reduce((n, l) => n + l.amount, 0) : 0;
        const amount = billed || placementFee(p).fee;
        return {
            Client: p.clientName,
            ...invoicingRow(p, { amount, date: inv?.issueDate ?? null }),
            "Invoice No.": inv?.invoiceNumber ?? p.invoiceNumber ?? "Not invoiced",
            "Missing details": missingInvoiceDetails(p).join(", "),
        };
    });

    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "PLACEMENTS_EXPORTED", entity: "Placement", entityId: "", detail: `${me.name} exported candidate invoicing details (${rows.length} rows) as ${format.toUpperCase()}` });

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return renderExport(format, {
        title: "Candidate information for invoicing",
        subtitle: `${rows.length} placement(s) · exported ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST by ${me.name}. Invoice amount is before GST; TAT = days from joining to invoice (to today if not invoiced).`,
        filename: `candidate-invoicing-details-${today}`,
        sections: [{
            key: "invoicing", title: "Candidate information", rows,
            pdfColumns: ["Client", "Candidate Name", "Employee Code", "Location", "Date of Joining", "Designation", "Grade", "CTC (LPA)", "Employee Type", "Invoice Amount (₹)", "Invoice TAT (days)"],
        }],
    });
}
