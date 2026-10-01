"use client";

import { useState } from "react";
import Sidebar, { NavGroup } from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";
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
    const [collapsed, setCollapsed] = useState(false);
    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <Sidebar groups={FINANCE_NAV} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
            <div className="flex-1 flex flex-col min-w-0" style={{ marginLeft: collapsed ? 80 : 250, transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
                <TopBar />
                <main className="flex-1 p-8 w-full animate-fade-in">{children}</main>
            </div>
        </div>
    );
}
