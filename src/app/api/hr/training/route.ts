import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { trainingPrograms } from "@/lib/mock/data";

// GET: list training programs with status and search query filter
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = trainingPrograms.filter((t) => t.orgId === me.orgId);

    if (status && status !== "ALL") {
        list = list.filter((t) => t.status === status);
    }
    if (q) {
        list = list.filter((t) => t.title.toLowerCase().includes(q) || t.course.toLowerCase().includes(q) || t.trainer.toLowerCase().includes(q));
    }

    return NextResponse.json(list);
}
