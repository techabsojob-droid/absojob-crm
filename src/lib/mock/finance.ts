// ─── Finance facade ───────────────────────────────────────────
// Re-exports the finance engine and provides the org-wide snapshot used by
// the dashboard, badges and reports.

import { invoices, users } from "./data";
import { agingBucket, balanceDue, billingQueue, inrOf, isOpen, refreshStatus } from "./fin/receivables";

export * from "./fin/core";
export * from "./fin/receivables";
export * from "./fin/payables";
export * from "./fin/payroll";
export * from "./fin/ledger";

export const FINANCE_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN"] as const;

/** Org-wide receivables snapshot (all amounts in INR). */
export function financeSnapshot(orgId: string) {
    const all = invoices.filter((i) => i.orgId === orgId);
    all.forEach(refreshStatus);
    const live = all.filter((i) => i.kind !== "CREDIT_NOTE" && !["CANCELLED", "DRAFT", "PENDING_APPROVAL"].includes(i.status));
    const credits = all.filter((i) => i.kind === "CREDIT_NOTE" && i.status !== "CANCELLED");
    const open = live.filter(isOpen);
    const billed = live.reduce((s, i) => s + inrOf(i, i.subtotal), 0) - credits.reduce((s, i) => s + inrOf(i, i.subtotal), 0);
    const collected = live.reduce((s, i) => s + inrOf(i, i.amountPaid), 0);
    const outstanding = open.reduce((s, i) => s + inrOf(i, balanceDue(i)), 0);
    const overdue = open.filter((i) => i.status === "OVERDUE");
    const aging = { CURRENT: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } as Record<string, number>;
    open.forEach((i) => { aging[agingBucket(i)] += inrOf(i, balanceDue(i)); });
    const gstOutput = live.reduce((s, i) => s + inrOf(i, i.taxAmount), 0) - credits.reduce((s, i) => s + inrOf(i, i.taxAmount), 0);
    const toBill = billingQueue(orgId);
    return {
        all, live, credits, open, billed, collected, outstanding, overdue, aging, gstOutput, toBill,
        pendingApproval: all.filter((i) => i.status === "PENDING_APPROVAL"),
        overdueAmount: overdue.reduce((s, i) => s + inrOf(i, balanceDue(i)), 0),
    };
}

export function financeUsers(orgId: string) {
    return users.filter((u) => u.orgId === orgId && u.status === "ACTIVE" && u.role === "FINANCE_ADMIN");
}
