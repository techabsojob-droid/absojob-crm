import { NextResponse } from "next/server";
import { commissionLedger, expenses, payrollRecords, vendorBills, fnfPayments, timesheets } from "@/lib/mock/data";
import {
    bankBalances, budgetVsActual, collectionForecast, daysOverdue, dso, financeSnapshot, inrOf, balanceDue, refreshBillStatus, refreshCreditHolds,
    runRecurring, runRecurringBills, runReminders,
} from "@/lib/mock/finance";
import { requireFinance } from "@/lib/mock/fin/http";

export async function GET() {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    // Housekeeping that a scheduler would normally run
    runRecurring(me.orgId);
    runRecurringBills(me.orgId);
    runReminders(me.orgId);
    refreshCreditHolds(me.orgId);

    const snap = financeSnapshot(me.orgId);
    const month = new Date().toISOString().slice(0, 7);
    const orgBills = vendorBills.filter((b) => b.orgId === me.orgId);
    orgBills.forEach(refreshBillStatus);
    const orgExpenses = expenses.filter((e) => e.orgId === me.orgId);
    const payrollAwaiting = payrollRecords.filter((p) => p.orgId === me.orgId && p.status === "PROCESSED" && !p.onHold);
    const incentivesDue = commissionLedger.filter((l) => l.orgId === me.orgId && ["REFERRAL_INCENTIVE", "RECRUITER_INCENTIVE"].includes(l.type) && ["PENDING", "APPROVED"].includes(l.status));
    const payments = snap.live.flatMap((i) => i.payments);

    const trend = Array.from({ length: 6 }, (_, k) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - k));
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return {
            month: m,
            billed: snap.live.filter((i) => i.issueDate.startsWith(m)).reduce((s, i) => s + inrOf(i, i.subtotal), 0),
            collected: payments.filter((p) => p.date.startsWith(m)).reduce((s, p) => s + p.amount + p.tdsAmount, 0),
        };
    });

    const byClient = new Map<string, { clientName: string; outstanding: number }>();
    snap.open.forEach((i) => {
        const cur = byClient.get(i.clientId) ?? { clientName: i.clientName, outstanding: 0 };
        cur.outstanding += inrOf(i, balanceDue(i));
        byClient.set(i.clientId, cur);
    });

    const apDue = orgBills.filter((b) => ["APPROVED", "PARTIALLY_PAID", "OVERDUE"].includes(b.status));
    return NextResponse.json({
        kpis: {
            billedThisMonth: snap.live.filter((i) => i.issueDate.startsWith(month)).reduce((s, i) => s + inrOf(i, i.subtotal), 0),
            collectedThisMonth: payments.filter((p) => p.date.startsWith(month)).reduce((s, p) => s + p.amount + p.tdsAmount, 0),
            outstanding: snap.outstanding,
            overdueAmount: snap.overdueAmount,
            overdueCount: snap.overdue.length,
            toBillCount: snap.toBill.length,
            toBillAmount: snap.toBill.reduce((s, i) => s + i.amount, 0),
            pendingApprovalCount: snap.pendingApproval.length + orgBills.filter((b) => b.status === "PENDING_APPROVAL").length,
            incentivesDue: incentivesDue.reduce((s, l) => s + Math.abs(l.amountInr), 0),
            expensesPending: orgExpenses.filter((e) => e.status === "PENDING").length,
            expensesToPay: orgExpenses.filter((e) => e.status === "APPROVED").reduce((s, e) => s + e.amount, 0),
            payablesDue: apDue.reduce((s, b) => s + (b.payable - b.amountPaid), 0),
            payablesOverdue: apDue.filter((b) => b.status === "OVERDUE").length,
            payrollAwaitingCount: payrollAwaiting.length,
            payrollAwaitingAmount: payrollAwaiting.reduce((s, p) => s + p.netSalary, 0),
            fnfPending: fnfPayments.filter((f) => f.orgId === me.orgId && f.status === "PENDING").reduce((s, f) => s + f.amount, 0),
            contractorsToPay: timesheets.filter((t) => t.orgId === me.orgId && ["APPROVED", "INVOICED"].includes(t.status) && !t.contractorPaid).reduce((s, t) => s + t.payAmount, 0),
            gstOutput: snap.gstOutput,
            dso: dso(me.orgId),
            cash: bankBalances(me.orgId).reduce((s, b) => s + b.balance, 0),
        },
        bankBalances: bankBalances(me.orgId),
        aging: snap.aging,
        trend,
        forecast: collectionForecast(me.orgId),
        budget: budgetVsActual(me.orgId, month),
        topOutstanding: Array.from(byClient.values()).filter((c) => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5),
        overdueInvoices: snap.overdue.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, clientName: i.clientName, balance: inrOf(i, balanceDue(i)), daysOverdue: daysOverdue(i) })).sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 6),
        toBill: snap.toBill.slice(0, 6),
    });
}
