import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { assets } from "@/lib/mock/data";

// GET: list assets with category, status, and query filter
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = assets.filter((a) => a.orgId === me.orgId);

    if (category && category !== "ALL") {
        list = list.filter((a) => a.category === category);
    }
    if (status && status !== "ALL") {
        list = list.filter((a) => a.status === status);
    }
    if (q) {
        list = list.filter(
            (a) =>
                a.name.toLowerCase().includes(q) ||
                a.assetTag.toLowerCase().includes(q) ||
                a.serialNumber.toLowerCase().includes(q) ||
                (a.assignedEmployeeName && a.assignedEmployeeName.toLowerCase().includes(q))
        );
    }

    return NextResponse.json(list);
}
