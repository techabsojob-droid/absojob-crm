// ─── Candidate information for invoicing ─────────────────────
// The ten details a client needs for each joined candidate on the invoice.
// Shared by the placements page, the billing queue, the invoice and the export.

import type { PlacementRecord } from "@/lib/types";

export const EMPLOYEE_TYPES = [["FLS", "FLS (front-line staff)"], ["NFLS", "NFLS (non front-line staff)"]] as const;
export type EmployeeType = (typeof EMPLOYEE_TYPES)[number][0];

type Details = Pick<PlacementRecord, "employeeCode" | "workLocation" | "joiningDate" | "offeredPosition" | "grade" | "offeredSalaryLpa" | "employeeType">;

/** Labels of the details still missing before this placement can be invoiced. */
export function missingInvoiceDetails(p: Partial<Details>): string[] {
    const missing: string[] = [];
    if (!p.employeeCode?.trim()) missing.push("Employee code");
    if (!p.workLocation?.trim()) missing.push("Location");
    if (!p.joiningDate) missing.push("Date of joining");
    if (!p.offeredPosition?.trim()) missing.push("Designation");
    if (!p.grade?.trim()) missing.push("Grade");
    if (!(Number(p.offeredSalaryLpa) > 0)) missing.push("CTC");
    if (p.employeeType !== "FLS" && p.employeeType !== "NFLS") missing.push("Employee type");
    return missing;
}

const DAY = 86400000;
const dayNum = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / DAY);

/**
 * Invoice TAT: days from the candidate's joining date to the invoice date.
 * Before an invoice exists it counts up to today, so finance can see what is getting late.
 */
export function invoiceTat(joiningDate: string | null | undefined, invoiceDate: string | null | undefined, today = new Date().toISOString().slice(0, 10)) {
    if (!joiningDate) return { days: null as number | null, pending: !invoiceDate, label: "—" };
    const end = invoiceDate || today;
    const days = Math.max(0, dayNum(end) - dayNum(joiningDate));
    return { days, pending: !invoiceDate, label: invoiceDate ? `${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} (not invoiced yet)` };
}

/** The ten columns in the order the client asked for. */
export function invoicingRow(p: Details & { candidateName: string }, invoice: { amount: number | null; date: string | null; number?: string | null }) {
    return {
        "Candidate Name": p.candidateName,
        "Employee Code": p.employeeCode ?? "",
        "Location": p.workLocation ?? "",
        "Date of Joining": p.joiningDate ? p.joiningDate.slice(0, 10) : "",
        "Designation": p.offeredPosition ?? "",
        "Grade": p.grade ?? "",
        "CTC (LPA)": Number(p.offeredSalaryLpa) || "",
        "Employee Type": p.employeeType ?? "",
        "Invoice Amount (₹)": invoice.amount ?? "",
        "Invoice TAT (days)": invoiceTat(p.joiningDate, invoice.date).days ?? "",
    };
}
