import { redirect } from "next/navigation";

// Billing, invoices and payments live in the Finance workspace
export default function AdminFinanceRedirect() {
    redirect("/finance/dashboard");
}
