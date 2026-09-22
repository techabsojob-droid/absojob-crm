import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { documents } from "@/lib/mock/data";

// GET: list HR documents with category, status, and query filter
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = documents.filter((d) => d.orgId === me.orgId);

    if (category && category !== "ALL") {
        list = list.filter((d) => d.category === category);
    }
    if (status && status !== "ALL") {
        list = list.filter((d) => d.status === status);
    }
    if (q) {
        list = list.filter(
            (d) =>
                d.title.toLowerCase().includes(q) ||
                (d.employeeName && d.employeeName.toLowerCase().includes(q))
        );
    }

    return NextResponse.json(list);
}
