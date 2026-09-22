import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { performanceReviews } from "@/lib/mock/data";

// GET: list performance reviews for HR management
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const cycle = url.searchParams.get("cycle");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = performanceReviews.filter((p) => p.orgId === me.orgId);

    if (cycle && cycle !== "ALL") {
        list = list.filter((p) => p.reviewCycle === cycle);
    }
    if (q) {
        list = list.filter((p) => p.employeeName.toLowerCase().includes(q) || p.department.toLowerCase().includes(q));
    }

    return NextResponse.json(list);
}
