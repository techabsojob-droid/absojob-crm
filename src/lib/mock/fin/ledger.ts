// ─── General ledger (double-entry), statements, reconciliation, exports, tax reports ─────
// Journal entries are derived deterministically from source documents, so the books
// can never drift from invoices, receipts, payroll, bills and expenses.

import type { JournalLine } from "@/lib/types";
import {
    bankStatementLines, budgets, commissionLedger, contractAssignments, employees, expenses, fnfPayments, invoices, manualJournals,
    payrollRecords, placements, receipts, timesheets, users, vendorBills, vendors,
} from "../data";
import { addDays, fyRange, GST_STATES, round2, settingsFor, today, daysBetween } from "./core";
import { balanceDue, inrOf, isOpen } from "./receivables";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export const CHART_OF_ACCOUNTS: { code: string; name: string; type: AccountType; group: string }[] = [
    { code: "1100", name: "Accounts Receivable", type: "ASSET", group: "Current Assets" },
    { code: "1150", name: "TDS Receivable", type: "ASSET", group: "Current Assets" },
    { code: "1160", name: "GST Input Credit", type: "ASSET", group: "Current Assets" },
    { code: "1200", name: "Unbilled Contract Revenue", type: "ASSET", group: "Current Assets" },
    { code: "2100", name: "Accounts Payable", type: "LIABILITY", group: "Current Liabilities" },
    { code: "2150", name: "Customer Advances", type: "LIABILITY", group: "Current Liabilities" },
    { code: "2200", name: "GST Output CGST", type: "LIABILITY", group: "Duties & Taxes" },
    { code: "2201", name: "GST Output SGST", type: "LIABILITY", group: "Duties & Taxes" },
    { code: "2202", name: "GST Output IGST", type: "LIABILITY", group: "Duties & Taxes" },
    { code: "2300", name: "TDS Payable - 192 Salary", type: "LIABILITY", group: "Duties & Taxes" },
    { code: "2301", name: "TDS Payable - 194H Commission", type: "LIABILITY", group: "Duties & Taxes" },
    { code: "2302", name: "TDS Payable - 194C Contract", type: "LIABILITY", group: "Duties & Taxes" },
    { code: "2303", name: "TDS Payable - 194J Professional", type: "LIABILITY", group: "Duties & Taxes" },
    { code: "2304", name: "TDS Payable - 194I Rent", type: "LIABILITY", group: "Duties & Taxes" },
    { code: "2400", name: "PF Payable", type: "LIABILITY", group: "Statutory Dues" },
    { code: "2401", name: "ESI Payable", type: "LIABILITY", group: "Statutory Dues" },
    { code: "2402", name: "Professional Tax Payable", type: "LIABILITY", group: "Statutory Dues" },
    { code: "2403", name: "Other Payroll Deductions", type: "LIABILITY", group: "Statutory Dues" },
    { code: "3000", name: "Owner's Capital", type: "EQUITY", group: "Capital" },
    { code: "4000", name: "Placement Fee Revenue", type: "INCOME", group: "Revenue" },
    { code: "4100", name: "Contract Staffing Revenue", type: "INCOME", group: "Revenue" },
    { code: "4200", name: "Retainer Revenue", type: "INCOME", group: "Revenue" },
    { code: "4300", name: "Reimbursement Income", type: "INCOME", group: "Revenue" },
    { code: "4900", name: "Rounding Off", type: "INCOME", group: "Other Income" },
    { code: "5000", name: "Salaries & Wages", type: "EXPENSE", group: "Employee Costs" },
    { code: "5010", name: "Employer PF & ESI", type: "EXPENSE", group: "Employee Costs" },
    { code: "5100", name: "Referral & Recruiter Incentives", type: "EXPENSE", group: "Direct Costs" },
    { code: "5200", name: "Contractor Costs", type: "EXPENSE", group: "Direct Costs" },
    { code: "5300", name: "Bad Debts", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5400", name: "Rent", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5401", name: "Software & Subscriptions", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5402", name: "Marketing", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5403", name: "Job Boards", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5404", name: "Travel", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5405", name: "Office Expenses", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5406", name: "Utilities", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5407", name: "Meals & Entertainment", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5408", name: "Training", type: "EXPENSE", group: "Indirect Expenses" },
    { code: "5409", name: "Other Expenses", type: "EXPENSE", group: "Indirect Expenses" },
];

const CATEGORY_ACCOUNT: Record<string, string> = {
    RENT: "Rent", SOFTWARE: "Software & Subscriptions", MARKETING: "Marketing", JOB_BOARDS: "Job Boards", TRAVEL: "Travel",
    OFFICE: "Office Expenses", UTILITIES: "Utilities", MEALS: "Meals & Entertainment", TRAINING: "Training", OTHER: "Other Expenses",
};
const TDS_ACCOUNT: Record<string, string> = { "194C": "TDS Payable - 194C Contract", "194J": "TDS Payable - 194J Professional", "194I": "TDS Payable - 194I Rent" };

export function bankAccountName(orgId: string, bankAccountId?: string | null) {
    const s = settingsFor(orgId);
    const b = s.bankAccounts.find((x) => x.id === bankAccountId) ?? s.bankAccounts.find((x) => x.isDefault) ?? s.bankAccounts[0];
    return b ? `Bank - ${b.name}` : "Bank";
}

export function accountType(name: string): AccountType {
    if (name.startsWith("Bank")) return "ASSET";
    return CHART_OF_ACCOUNTS.find((a) => a.name === name)?.type ?? "EXPENSE";
}

export interface JournalEntry { key: string; date: string; source: string; ref: string; narration: string; lines: JournalLine[] }

const L = (account: string, debit: number, credit: number, memo?: string): JournalLine => ({ account, debit: round2(debit), credit: round2(credit), memo });

/** Builds the full journal for an org from every finance source document. */
export function buildJournal(orgId: string): JournalEntry[] {
    const s = settingsFor(orgId);
    const out: JournalEntry[] = [];
    const push = (e: JournalEntry) => {
        const lines = e.lines.filter((l) => l.debit || l.credit);
        if (!lines.length) return;
        // absorb paise-level rounding so every entry balances
        const diff = round2(lines.reduce((sum, l) => sum + l.debit - l.credit, 0));
        if (Math.abs(diff) > 0 && Math.abs(diff) < 1) lines.push(diff > 0 ? L("Rounding Off", 0, diff) : L("Rounding Off", -diff, 0));
        out.push({ ...e, lines });
    };

    // Opening balances of bank accounts
    const firstDate = [...invoices.filter((i) => i.orgId === orgId).map((i) => i.issueDate), ...payrollRecords.filter((p) => p.orgId === orgId).map((p) => `${p.month}-01`), today()].sort()[0];
    s.bankAccounts.forEach((b) => push({ key: `open:${b.id}`, date: firstDate, source: "OPENING", ref: b.name, narration: `Opening balance ${b.name}`, lines: [L(`Bank - ${b.name}`, b.openingBalance, 0), L("Owner's Capital", 0, b.openingBalance)] }));

    // Sales documents
    invoices.filter((i) => i.orgId === orgId && !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(i.status)).forEach((i) => {
        const rev = i.milestone === "TIMESHEET" ? "Contract Staffing Revenue" : i.milestone === "RETAINER" ? "Retainer Revenue" : i.milestone === "REBILL" ? "Reimbursement Income" : "Placement Fee Revenue";
        const sub = inrOf(i, i.subtotal), cg = inrOf(i, i.tax?.cgst ?? 0), sg = inrOf(i, i.tax?.sgst ?? 0), ig = inrOf(i, i.tax?.igst ?? 0), ro = inrOf(i, i.roundOff ?? 0), tot = inrOf(i, i.total);
        const credit = i.kind === "CREDIT_NOTE";
        const lines = [L("Accounts Receivable", credit ? 0 : tot, credit ? tot : 0), L(rev, credit ? sub : 0, credit ? 0 : sub), L("GST Output CGST", credit ? cg : 0, credit ? 0 : cg), L("GST Output SGST", credit ? sg : 0, credit ? 0 : sg), L("GST Output IGST", credit ? ig : 0, credit ? 0 : ig)];
        if (ro) lines.push(ro > 0 ? L("Rounding Off", credit ? ro : 0, credit ? 0 : ro) : L("Rounding Off", credit ? 0 : -ro, credit ? -ro : 0));
        push({ key: `inv:${i.id}`, date: i.issueDate, source: i.kind, ref: i.invoiceNumber, narration: `${i.kind === "CREDIT_NOTE" ? "Credit note" : i.kind === "DEBIT_NOTE" ? "Debit note" : "Invoice"} ${i.invoiceNumber} · ${i.clientName}`, lines });
        if (i.writtenOff) push({ key: `wo:${i.id}`, date: i.updatedAt.slice(0, 10), source: "WRITE_OFF", ref: i.invoiceNumber, narration: `Bad debt written off ${i.invoiceNumber}`, lines: [L("Bad Debts", inrOf(i, i.writtenOff), 0), L("Accounts Receivable", 0, inrOf(i, i.writtenOff))] });
    });

    // Client receipts (applied → AR, unapplied → advances)
    // (an advance applied later is shown against the receipt date — the net position is identical)
    receipts.filter((r) => r.orgId === orgId).forEach((r) => {
        const applied = round2(r.allocations.reduce((sum, a) => sum + a.amount + a.tds, 0));
        push({
            key: `rcpt:${r.id}`, date: r.date, source: "RECEIPT", ref: r.receiptNumber, narration: `Receipt ${r.receiptNumber} · ${r.clientName}`,
            lines: [L(bankAccountName(orgId, r.bankAccountId), r.amount, 0), L("TDS Receivable", r.tdsAmount, 0), L("Accounts Receivable", 0, applied), L("Customer Advances", 0, Math.max(0, round2(r.amount + r.tdsAmount - applied)))],
        });
    });

    // Payroll (cash basis on disbursement)
    payrollRecords.filter((p) => p.orgId === orgId && p.status === "PAID" && p.paymentDate).forEach((p) => {
        const earned = p.basicSalary + p.hra + p.allowances + p.bonuses + p.overtime - (p.lopAmount ?? 0);
        const pf = p.pf ?? 0, esi = p.esi ?? 0, pt = p.pt ?? 0;
        // Balancing figure: works whether a record carries TDS inside "deductions" (legacy) or separately
        const other = Math.max(0, round2(earned - p.netSalary - pf - esi - pt - p.tax));
        const erPf = p.employerPf ?? 0, erEsi = p.employerEsi ?? 0;
        push({
            key: `pay:${p.id}`, date: p.paymentDate!, source: "PAYROLL", ref: `${p.employeeCode}/${p.month}`, narration: `Salary ${p.month} · ${p.employeeName}`,
            lines: [
                L("Salaries & Wages", earned, 0), L("Employer PF & ESI", erPf + erEsi, 0),
                L(bankAccountName(orgId, s.bankAccounts.find((b) => b.name.toLowerCase().includes("payroll"))?.id), 0, p.netSalary),
                L("PF Payable", 0, pf + erPf), L("ESI Payable", 0, esi + erEsi), L("Professional Tax Payable", 0, pt), L("TDS Payable - 192 Salary", 0, p.tax), L("Other Payroll Deductions", 0, other),
            ],
        });
    });
    fnfPayments.filter((f) => f.orgId === orgId && f.status === "PAID" && f.paidAt).forEach((f) => push({ key: `fnf:${f.id}`, date: f.paidAt!.slice(0, 10), source: "FNF", ref: f.employeeName, narration: `Full & final · ${f.employeeName}`, lines: [L("Salaries & Wages", f.amount, 0), L(bankAccountName(orgId), 0, f.amount)] }));

    // Expenses & reimbursements (cash basis on payment)
    expenses.filter((e) => e.orgId === orgId && e.status === "PAID" && e.paidAt).forEach((e) => push({
        key: `exp:${e.id}`, date: e.paidAt!.slice(0, 10), source: "EXPENSE", ref: e.id, narration: `${e.isReimbursement ? "Reimbursement" : "Expense"} · ${e.description}`,
        lines: [L(CATEGORY_ACCOUNT[e.category] ?? "Other Expenses", e.amount - (e.gstAmount || 0), 0), L("GST Input Credit", e.gstAmount || 0, 0), L(bankAccountName(orgId), 0, e.amount)],
    }));

    // Vendor bills (accrual on approval) & payments
    vendorBills.filter((b) => b.orgId === orgId && !["PENDING_APPROVAL", "CANCELLED"].includes(b.status)).forEach((b) => {
        push({
            key: `vb:${b.id}`, date: b.billDate, source: "VENDOR_BILL", ref: `${b.vendorName} ${b.billNumber}`, narration: `Bill ${b.billNumber} · ${b.vendorName}`,
            lines: [L(CATEGORY_ACCOUNT[b.category] ?? "Other Expenses", b.amount, 0), L("GST Input Credit", b.gstAmount, 0), L("Accounts Payable", 0, b.payable), L(TDS_ACCOUNT[b.tdsSection] ?? "TDS Payable - 194C Contract", 0, b.tdsAmount)],
        });
        b.payments.forEach((p) => push({ key: `vbp:${p.id}`, date: p.date, source: "VENDOR_PAYMENT", ref: `${b.vendorName} ${b.billNumber}`, narration: `Payment · ${b.vendorName}`, lines: [L("Accounts Payable", p.amount, 0), L(bankAccountName(orgId), 0, p.amount)] }));
    });

    // Incentives (on payment) and clawback recoveries
    commissionLedger.filter((l) => l.orgId === orgId && ["REFERRAL_INCENTIVE", "RECRUITER_INCENTIVE"].includes(l.type) && l.status === "PAID" && l.paidAt).forEach((l) => {
        const gross = Math.abs(l.amountInr), tds = l.tdsAmount ?? 0;
        push({ key: `inc:${l.id}`, date: l.paidAt!.slice(0, 10), source: "INCENTIVE", ref: users.find((u) => u.id === l.userId)?.name ?? "—", narration: l.description, lines: [L("Referral & Recruiter Incentives", gross, 0), L("TDS Payable - 194H Commission", 0, tds), L(bankAccountName(orgId), 0, gross - tds)] });
    });
    commissionLedger.filter((l) => l.orgId === orgId && l.type === "CLAWBACK" && l.status === "PAID" && l.paidAt).forEach((l) => push({
        key: `claw:${l.id}`, date: l.paidAt!.slice(0, 10), source: "CLAWBACK", ref: users.find((u) => u.id === l.userId)?.name ?? "—", narration: l.description,
        lines: [L(bankAccountName(orgId), Math.abs(l.amountInr), 0), L("Referral & Recruiter Incentives", 0, Math.abs(l.amountInr))],
    }));

    // Contract staffing: contractor pay
    timesheets.filter((t) => t.orgId === orgId && t.contractorPaid).forEach((t) => {
        const asg = contractAssignments.find((a) => a.id === t.assignmentId);
        push({ key: `ctr:${t.id}`, date: `${t.month}-28`, source: "CONTRACTOR", ref: asg?.workerName ?? t.id, narration: `Contractor pay ${t.month} · ${asg?.workerName}`, lines: [L("Contractor Costs", t.payAmount, 0), L(bankAccountName(orgId), 0, t.payAmount)] });
    });

    // Manual journals
    manualJournals.filter((j) => j.orgId === orgId).forEach((j) => push({ key: `mj:${j.id}`, date: j.date, source: "MANUAL", ref: j.id, narration: j.narration, lines: j.lines }));

    return out.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

export function trialBalance(orgId: string, to = today(), from?: string) {
    const bal = new Map<string, { debit: number; credit: number }>();
    buildJournal(orgId).filter((e) => e.date <= to && (!from || e.date >= from)).forEach((e) => e.lines.forEach((l) => {
        const cur = bal.get(l.account) ?? { debit: 0, credit: 0 };
        cur.debit = round2(cur.debit + l.debit);
        cur.credit = round2(cur.credit + l.credit);
        bal.set(l.account, cur);
    }));
    const rows = Array.from(bal.entries()).map(([account, v]) => ({ account, type: accountType(account), debit: v.debit, credit: v.credit, balance: round2(v.debit - v.credit) })).sort((a, b) => a.type.localeCompare(b.type) || a.account.localeCompare(b.account));
    return { rows, totalDebit: round2(rows.reduce((s, r) => s + r.debit, 0)), totalCredit: round2(rows.reduce((s, r) => s + r.credit, 0)) };
}

export function profitAndLoss(orgId: string, from: string, to: string) {
    const tb = trialBalance(orgId, to, from);
    const income = tb.rows.filter((r) => r.type === "INCOME").map((r) => ({ account: r.account, amount: round2(r.credit - r.debit) }));
    const expense = tb.rows.filter((r) => r.type === "EXPENSE").map((r) => ({ account: r.account, amount: round2(r.debit - r.credit) }));
    const totalIncome = round2(income.reduce((s, r) => s + r.amount, 0));
    const totalExpense = round2(expense.reduce((s, r) => s + r.amount, 0));
    return { income, expense, totalIncome, totalExpense, netProfit: round2(totalIncome - totalExpense) };
}

export function balanceSheet(orgId: string, asOf = today()) {
    const tb = trialBalance(orgId, asOf);
    const pick = (t: AccountType, sign: 1 | -1) => tb.rows.filter((r) => r.type === t).map((r) => ({ account: r.account, amount: round2(sign * r.balance) })).filter((r) => r.amount !== 0);
    const assets = pick("ASSET", 1), liabilities = pick("LIABILITY", -1), equity = pick("EQUITY", -1);
    const retained = round2(tb.rows.filter((r) => r.type === "INCOME" || r.type === "EXPENSE").reduce((s, r) => s - r.balance, 0));
    equity.push({ account: "Retained Earnings (P&L)", amount: retained });
    const totalAssets = round2(assets.reduce((s, r) => s + r.amount, 0));
    const totalLiabEq = round2([...liabilities, ...equity].reduce((s, r) => s + r.amount, 0));
    return { asOf, assets, liabilities, equity, totalAssets, totalLiabilitiesAndEquity: totalLiabEq, balanced: Math.abs(totalAssets - totalLiabEq) < 1 };
}

export function accountLedger(orgId: string, account: string, from?: string, to?: string) {
    let running = 0;
    return buildJournal(orgId)
        .filter((e) => (!to || e.date <= to))
        .flatMap((e) => e.lines.filter((l) => l.account === account).map((l) => ({ date: e.date, ref: e.ref, narration: e.narration, debit: l.debit, credit: l.credit, key: e.key })))
        .map((r) => { running = round2(running + r.debit - r.credit); return { ...r, balance: running }; })
        .filter((r) => !from || r.date >= from);
}

// ─── Cash flow & bank balances ───────────────────────────────

export function bankBalances(orgId: string, asOf = today()) {
    const tb = trialBalance(orgId, asOf);
    return tb.rows.filter((r) => r.account.startsWith("Bank")).map((r) => ({ account: r.account, balance: r.balance }));
}

export function cashFlow(orgId: string, from: string, to: string) {
    const months = new Map<string, { month: string; inflow: number; outflow: number; bySource: Record<string, number> }>();
    buildJournal(orgId).filter((e) => e.date >= from && e.date <= to && e.source !== "OPENING").forEach((e) => {
        e.lines.filter((l) => l.account.startsWith("Bank")).forEach((l) => {
            const m = e.date.slice(0, 7);
            const cur = months.get(m) ?? { month: m, inflow: 0, outflow: 0, bySource: {} };
            cur.inflow = round2(cur.inflow + l.debit);
            cur.outflow = round2(cur.outflow + l.credit);
            cur.bySource[e.source] = round2((cur.bySource[e.source] ?? 0) + l.debit - l.credit);
            months.set(m, cur);
        });
    });
    return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, net: round2(m.inflow - m.outflow) }));
}

// ─── Bank reconciliation ─────────────────────────────────────

export function bankTransactions(orgId: string, bankAccount?: string) {
    return buildJournal(orgId)
        .filter((e) => e.source !== "OPENING")
        .flatMap((e) => e.lines.filter((l) => l.account.startsWith("Bank") && (!bankAccount || l.account === bankAccount)).map((l) => ({ key: e.key, date: e.date, ref: e.ref, narration: e.narration, amount: round2(l.debit - l.credit), account: l.account })));
}

/** Auto-match imported statement lines to book transactions by amount (±₹1) and date (±5 days). */
export function autoMatch(orgId: string) {
    const used = new Set(bankStatementLines.filter((b) => b.orgId === orgId && b.matchedId).map((b) => b.matchedId!));
    const txns = bankTransactions(orgId);
    let matched = 0;
    bankStatementLines.filter((b) => b.orgId === orgId && !b.matchedId).forEach((line) => {
        const amt = round2(line.credit - line.debit);
        const account = bankAccountName(orgId, line.bankAccountId);
        const hit = txns.find((t) => !used.has(t.key) && t.account === account && Math.abs(t.amount - amt) <= 1 && Math.abs(daysBetween(t.date, line.date)) <= 5);
        if (hit) {
            line.matchedId = hit.key;
            line.matchedType = amt >= 0 ? "RECEIPT" : "PAYMENT";
            used.add(hit.key);
            if (hit.key.startsWith("rcpt:")) { const r = receipts.find((x) => x.id === hit.key.slice(5)); if (r) r.reconciled = true; }
            matched++;
        }
    });
    return matched;
}

export function reconciliationSummary(orgId: string, bankAccountId: string) {
    const account = bankAccountName(orgId, bankAccountId);
    const lines = bankStatementLines.filter((b) => b.orgId === orgId && b.bankAccountId === bankAccountId);
    const matchedKeys = new Set(lines.filter((l) => l.matchedId).map((l) => l.matchedId));
    const txns = bankTransactions(orgId, account);
    const statementBalance = round2(lines.reduce((s, l) => s + l.credit - l.debit, 0));
    return {
        account,
        statementLines: lines.sort((a, b) => b.date.localeCompare(a.date)),
        unmatchedBook: txns.filter((t) => !matchedKeys.has(t.key)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200),
        bookBalance: bankBalances(orgId).find((b) => b.account === account)?.balance ?? 0,
        statementNet: statementBalance,
        matched: lines.filter((l) => l.matchedId).length,
        unmatched: lines.filter((l) => !l.matchedId).length,
    };
}

// ─── Exports: Tally XML & Zoho Books CSV ─────────────────────

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function tallyXml(orgId: string, from: string, to: string) {
    const s = settingsFor(orgId);
    const vouchers = buildJournal(orgId).filter((e) => e.date >= from && e.date <= to && e.source !== "OPENING").map((e) => {
        const type = e.source === "RECEIPT" ? "Receipt" : ["VENDOR_PAYMENT", "EXPENSE", "INCENTIVE", "CONTRACTOR", "FNF", "PAYROLL"].includes(e.source) ? "Payment" : ["INVOICE", "DEBIT_NOTE"].includes(e.source) ? "Sales" : e.source === "CREDIT_NOTE" ? "Credit Note" : e.source === "VENDOR_BILL" ? "Purchase" : "Journal";
        const entries = e.lines.map((l) => `      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${xmlEsc(l.account)}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>${l.debit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
       <AMOUNT>${(l.debit ? -l.debit : l.credit).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`).join("\n");
        return `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="${type}" ACTION="Create">
     <DATE>${e.date.replace(/-/g, "")}</DATE>
     <VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${xmlEsc(e.ref)}</VOUCHERNUMBER>
     <NARRATION>${xmlEsc(e.narration)}</NARRATION>
${entries}
    </VOUCHER>
   </TALLYMESSAGE>`;
    });
    return `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xmlEsc(s.companyLegalName)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
   <REQUESTDATA>
${vouchers.join("\n")}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
}

export function zohoJournalCsv(orgId: string, from: string, to: string) {
    const rows = [["Journal Date", "Reference Number", "Notes", "Account", "Debit", "Credit"]];
    buildJournal(orgId).filter((e) => e.date >= from && e.date <= to).forEach((e) => e.lines.forEach((l) => rows.push([e.date, e.ref, e.narration, l.account, l.debit ? l.debit.toFixed(2) : "", l.credit ? l.credit.toFixed(2) : ""])));
    return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// ─── GST returns ─────────────────────────────────────────────

export function gstr1(orgId: string, month: string) {
    const docs = invoices.filter((i) => i.orgId === orgId && i.issueDate.startsWith(month) && !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(i.status));
    const row = (i: (typeof docs)[number]) => ({
        gstin: i.clientGstin ?? "", receiver: i.clientName, number: i.invoiceNumber, date: i.issueDate, value: inrOf(i, i.total),
        placeOfSupply: `${i.placeOfSupply ?? ""}-${GST_STATES[i.placeOfSupply ?? ""] ?? ""}`, rate: i.taxRate, taxable: inrOf(i, i.subtotal),
        igst: inrOf(i, i.tax?.igst ?? 0), cgst: inrOf(i, i.tax?.cgst ?? 0), sgst: inrOf(i, i.tax?.sgst ?? 0), sac: i.lineItems[0]?.sacCode ?? settingsFor(orgId).sacCode,
        noteFor: i.creditNoteForId ? invoices.find((x) => x.id === i.creditNoteForId)?.invoiceNumber ?? "" : "",
    });
    const b2b = docs.filter((i) => i.kind !== "CREDIT_NOTE" && i.clientGstin && !i.tax?.zeroRated).map(row);
    const b2c = docs.filter((i) => i.kind !== "CREDIT_NOTE" && !i.clientGstin && !i.tax?.zeroRated).map(row);
    const exp = docs.filter((i) => i.tax?.zeroRated).map(row);
    const cdnr = docs.filter((i) => i.kind === "CREDIT_NOTE").map(row);
    const sum = (list: ReturnType<typeof row>[], k: "taxable" | "igst" | "cgst" | "sgst") => round2(list.reduce((s, r) => s + r[k], 0));
    const outward = [...b2b, ...b2c];
    const inputs = [
        ...expenses.filter((e) => e.orgId === orgId && e.status === "PAID" && (e.paidAt ?? "").startsWith(month)).map((e) => e.gstAmount || 0),
        ...vendorBills.filter((b) => b.orgId === orgId && b.billDate.startsWith(month) && !["PENDING_APPROVAL", "CANCELLED"].includes(b.status)).map((b) => b.gstAmount),
    ];
    const outputTax = round2(sum(outward, "igst") + sum(outward, "cgst") + sum(outward, "sgst") - sum(cdnr, "igst") - sum(cdnr, "cgst") - sum(cdnr, "sgst"));
    const inputTax = round2(inputs.reduce((s, n) => s + n, 0));
    return {
        month, b2b, b2c, exports: exp, cdnr,
        summary: { taxable: round2(sum(outward, "taxable") + sum(exp, "taxable") - sum(cdnr, "taxable")), igst: sum(outward, "igst") - sum(cdnr, "igst"), cgst: sum(outward, "cgst") - sum(cdnr, "cgst"), sgst: sum(outward, "sgst") - sum(cdnr, "sgst"), outputTax, inputTax, netPayable: round2(Math.max(0, outputTax - inputTax)), dueDate: addDays(`${month}-01`, 40).slice(0, 8) + "11" },
    };
}

export function gstr1Csv(orgId: string, month: string) {
    const g = gstr1(orgId, month);
    const header = ["Section", "GSTIN of Recipient", "Receiver Name", "Invoice/Note No", "Date", "Invoice Value", "Place Of Supply", "Rate", "Taxable Value", "IGST", "CGST", "SGST", "SAC", "Original Invoice"];
    const lines = [["B2B", g.b2b], ["B2C", g.b2c], ["EXP", g.exports], ["CDNR", g.cdnr]] as const;
    const rows = [header, ...lines.flatMap(([sec, list]) => list.map((r) => [sec, r.gstin, r.receiver, r.number, r.date, r.value, r.placeOfSupply, r.rate, r.taxable, r.igst, r.cgst, r.sgst, r.sac, r.noteFor]))];
    return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// ─── TDS ─────────────────────────────────────────────────────

export function tdsReport(orgId: string, from: string, to: string) {
    const inRange = (d?: string | null) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
    const receivable = new Map<string, { clientName: string; tds: number; receipts: number }>();
    receipts.filter((r) => r.orgId === orgId && inRange(r.date) && r.tdsAmount > 0).forEach((r) => {
        const c = receivable.get(r.clientId) ?? { clientName: r.clientName, tds: 0, receipts: 0 };
        c.tds = round2(c.tds + r.tdsAmount); c.receipts++;
        receivable.set(r.clientId, c);
    });
    const payable: { section: string; payee: string; pan: string; amount: number; tds: number; date: string }[] = [];
    payrollRecords.filter((p) => p.orgId === orgId && p.status === "PAID" && inRange(p.paymentDate) && p.tax > 0).forEach((p) => {
        const emp = employees.find((e) => e.id === p.employeeId);
        payable.push({ section: "192", payee: p.employeeName, pan: emp?.bankDetails?.panNumber || "", amount: p.basicSalary + p.hra + p.allowances, tds: p.tax, date: p.paymentDate! });
    });
    commissionLedger.filter((l) => l.orgId === orgId && ["REFERRAL_INCENTIVE", "RECRUITER_INCENTIVE"].includes(l.type) && l.status === "PAID" && inRange(l.paidAt) && (l.tdsAmount ?? 0) > 0).forEach((l) => {
        payable.push({ section: "194H", payee: users.find((u) => u.id === l.userId)?.name ?? "—", pan: "", amount: Math.abs(l.amountInr), tds: l.tdsAmount ?? 0, date: l.paidAt!.slice(0, 10) });
    });
    vendorBills.filter((b) => b.orgId === orgId && inRange(b.billDate) && b.tdsAmount > 0 && !["PENDING_APPROVAL", "CANCELLED"].includes(b.status)).forEach((b) => {
        payable.push({ section: b.tdsSection, payee: b.vendorName, pan: vendors.find((v) => v.id === b.vendorId)?.pan ?? "", amount: b.amount, tds: b.tdsAmount, date: b.billDate });
    });
    const bySection: Record<string, number> = {};
    payable.forEach((p) => { bySection[p.section] = round2((bySection[p.section] ?? 0) + p.tds); });
    return {
        receivable: Array.from(receivable.values()).sort((a, b) => b.tds - a.tds),
        totalReceivable: round2(Array.from(receivable.values()).reduce((s, r) => s + r.tds, 0)),
        payable: payable.sort((a, b) => a.date.localeCompare(b.date)),
        bySection,
        totalPayable: round2(payable.reduce((s, p) => s + p.tds, 0)),
    };
}

// ─── KPIs: DSO, forecast, recruiter profitability, budget ────

export function dso(orgId: string) {
    const since = addDays(today(), -90);
    const revenue90 = invoices.filter((i) => i.orgId === orgId && i.kind === "INVOICE" && i.issueDate >= since && !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(i.status)).reduce((s, i) => s + inrOf(i, i.total), 0);
    const ar = invoices.filter((i) => i.orgId === orgId && isOpen(i)).reduce((s, i) => s + inrOf(i, balanceDue(i)), 0);
    return revenue90 ? Math.round((ar / revenue90) * 90) : 0;
}

export function collectionForecast(orgId: string) {
    const weeks = Array.from({ length: 8 }, (_, k) => ({ label: `Week ${k + 1}`, from: addDays(today(), k * 7), to: addDays(today(), k * 7 + 6), amount: 0 }));
    let overdue = 0;
    invoices.filter((i) => i.orgId === orgId && isOpen(i)).forEach((i) => {
        const amt = inrOf(i, balanceDue(i));
        if (i.dueDate < today()) { overdue += amt; return; }
        const w = weeks.find((x) => i.dueDate >= x.from && i.dueDate <= x.to);
        if (w) w.amount += amt;
    });
    return { overdue: round2(overdue), weeks };
}

export function recruiterProfitability(orgId: string, from: string, to: string) {
    const map = new Map<string, { recruiterId: string; name: string; revenue: number; placements: number; salaryCost: number }>();
    const touch = (uid: string) => {
        if (!map.has(uid)) map.set(uid, { recruiterId: uid, name: users.find((u) => u.id === uid)?.name ?? "—", revenue: 0, placements: 0, salaryCost: 0 });
        return map.get(uid)!;
    };
    invoices.filter((i) => i.orgId === orgId && i.kind === "INVOICE" && i.issueDate >= from && i.issueDate <= to && !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(i.status)).forEach((i) => {
        const ids = i.placementIds?.length ? i.placementIds : i.placementId ? [i.placementId] : [];
        ids.forEach((pid) => {
            const p = placements.find((x) => x.id === pid);
            if (!p) return;
            const r = touch(p.recruiterId);
            r.revenue = round2(r.revenue + inrOf(i, i.subtotal) / ids.length);
            r.placements++;
        });
    });
    payrollRecords.filter((p) => p.orgId === orgId && p.status === "PAID" && `${p.month}-01` >= from.slice(0, 7) + "-01" && `${p.month}-01` <= to).forEach((p) => {
        const uid = employees.find((e) => e.id === p.employeeId)?.userId;
        if (uid && map.has(uid)) map.get(uid)!.salaryCost += p.basicSalary + p.hra + p.allowances + (p.employerPf ?? 0) + (p.employerEsi ?? 0);
    });
    return Array.from(map.values()).map((r) => ({ ...r, contribution: round2(r.revenue - r.salaryCost), roi: r.salaryCost ? round2(r.revenue / r.salaryCost) : null })).sort((a, b) => b.contribution - a.contribution);
}

export function budgetVsActual(orgId: string, month: string) {
    const rows = budgets.filter((b) => b.orgId === orgId && b.month === month).map((b) => {
        let actual = 0;
        if (b.category === "REVENUE") {
            actual = invoices.filter((i) => i.orgId === orgId && i.issueDate.startsWith(month) && !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(i.status)).reduce((s, i) => s + inrOf(i, i.kind === "CREDIT_NOTE" ? -i.subtotal : i.subtotal), 0);
        } else {
            actual = expenses.filter((e) => e.orgId === orgId && e.category === b.category && e.expenseDate.startsWith(month) && ["APPROVED", "PAID"].includes(e.status)).reduce((s, e) => s + e.amount, 0)
                + vendorBills.filter((v) => v.orgId === orgId && v.category === b.category && v.billDate.startsWith(month) && !["PENDING_APPROVAL", "CANCELLED"].includes(v.status)).reduce((s, v) => s + v.amount, 0);
        }
        return { ...b, actual: round2(actual), variance: round2(actual - b.amount), pct: b.amount ? Math.round((actual / b.amount) * 100) : 0 };
    });
    return rows;
}

export function fyBounds(date = today()) {
    const y = new Date(date).getMonth() >= 3 ? new Date(date).getFullYear() : new Date(date).getFullYear() - 1;
    return fyRange(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
}
