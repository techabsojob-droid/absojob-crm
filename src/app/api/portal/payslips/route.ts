import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { payrollRecords } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";

// My payslips: only finalised (processed / paid) payroll of the signed-in employee
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const emp = employeeForUser(me.id);
    if (!emp) return NextResponse.json([]);
    const list = payrollRecords
        .filter((p) => p.orgId === me.orgId && p.employeeId === emp.id && p.status !== "DRAFT")
        .sort((a, b) => b.month.localeCompare(a.month));
    return NextResponse.json(list);
}
