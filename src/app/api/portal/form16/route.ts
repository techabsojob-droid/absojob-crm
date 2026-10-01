import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { employeeForUser } from "@/lib/mock/identity";
import { form16 } from "@/lib/mock/finance";

// GET ?fy= — my Form 16 (Part B summary) from paid payroll
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    const fy = new URL(request.url).searchParams.get("fy") ?? "";
    if (!emp) return NextResponse.json({ error: "No employee profile" }, { status: 404 });
    if (!/^\d{4}-\d{2}$/.test(fy)) return NextResponse.json({ error: "fy is required (e.g. 2026-27)" }, { status: 400 });
    const f = form16(me.orgId, emp.id, fy);
    if (!f.months.length) return NextResponse.json({ error: "No paid salary in this financial year yet" }, { status: 404 });
    return NextResponse.json(f);
}
