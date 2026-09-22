import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { payrollRecords } from "@/lib/mock/data";

// GET: list payroll records filtered by month and query
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const month = url.searchParams.get("month");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = payrollRecords.filter((p) => p.orgId === me.orgId);

    if (month && month !== "ALL") {
        list = list.filter((p) => p.month === month);
    }
    if (q) {
        list = list.filter((p) => p.employeeName.toLowerCase().includes(q) || p.employeeCode.toLowerCase().includes(q));
    }

    return NextResponse.json(list);
}
