import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/requireWorkspace";
import FinanceLayoutClient from "./FinanceLayoutClient";

export const metadata: Metadata = {
    title: "Finance — AbsoJob",
    description: "Billing, receivables, payables, expenses and payroll disbursement",
};

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
    await requireWorkspace("FINANCE");
    return <FinanceLayoutClient>{children}</FinanceLayoutClient>;
}
