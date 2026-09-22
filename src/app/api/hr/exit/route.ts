import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { exitRecords } from "@/lib/mock/data";

// GET: list exit records with status and search query filter
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = exitRecords.filter((e) => e.orgId === me.orgId);

    if (status && status !== "ALL") {
        list = list.filter((e) => e.status === status);
    }
    if (q) {
        list = list.filter((e) => e.employeeName.toLowerCase().includes(q) || e.department.toLowerCase().includes(q));
    }

    return NextResponse.json(list);
}
