"use client";

import type { NavGroup } from "@/components/shared/Sidebar";
import AppShell from "@/components/shared/AppShell";
import {
    LayoutDashboard, FileText, Receipt, Wallet, CreditCard, Banknote, Building2, BarChart3, Settings,
    HandCoins, Repeat, Timer, Store, BookOpen, Landmark, Scale, Mail,
} from "lucide-react";

const FINANCE_NAV: NavGroup[] = [
    { groupTitle: "OVERVIEW", items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/finance/dashboard" }] },
    {
        groupTitle: "RECEIVABLES",
        items: [
            { label: "Billing Queue", icon: Receipt, href: "/finance/billing", badgeKey: "toBill", badgeTone: "amber", tooltipHint: "Placements, offers, timesheets & expenses to invoice" },
            { label: "Invoices", icon: FileText, href: "/finance/invoices", badgeKey: "overdueInvoices", badgeTone: "red", tooltipHint: "Overdue invoices" },
            { label: "Receipts", icon: HandCoins, href: "/finance/receipts" },
            { label: "Recurring", icon: Repeat, href: "/finance/recurring" },
            { label: "Client Billing", icon: Building2, href: "/finance/clients" },
        ],
    },
    { groupTitle: "CONTRACT STAFFING", items: [{ label: "Contracts & Timesheets", icon: Timer, href: "/finance/contracts" }] },
    {
        groupTitle: "PAYABLES",
        items: [
            { label: "Payroll", icon: Banknote, href: "/finance/payroll", badgeKey: "payrollAwaiting", badgeTone: "amber", tooltipHint: "Cycles awaiting disbursement" },
            { label: "Vendors & Bills", icon: Store, href: "/finance/vendors" },
            { label: "Incentives & Payouts", icon: Wallet, href: "/finance/payables" },
            { label: "Expenses", icon: CreditCard, href: "/finance/expenses", badgeKey: "expensesPending", badgeTone: "amber", tooltipHint: "Claims awaiting approval" },
        ],
    },
    {
        groupTitle: "ACCOUNTING",
        items: [
            { label: "Books & Ledger", icon: BookOpen, href: "/finance/accounting" },
            { label: "Bank Reconciliation", icon: Landmark, href: "/finance/bank" },
            { label: "GST & TDS", icon: Scale, href: "/finance/tax" },
        ],
    },
    {
        groupTitle: "INSIGHTS",
        items: [
            { label: "Reports & Budget", icon: BarChart3, href: "/finance/reports" },
            { label: "Email Outbox", icon: Mail, href: "/finance/outbox" },
            { label: "Settings", icon: Settings, href: "/finance/settings" },
        ],
    },
];

export default function FinanceLayoutClient({ children }: { children: React.ReactNode }) {
    return <AppShell groups={FINANCE_NAV}>{children}</AppShell>;
}
