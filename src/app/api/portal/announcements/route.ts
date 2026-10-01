import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { announcements, users } from "@/lib/mock/data";
import { isAnnouncementFor } from "@/lib/mock/hr";

// GET — announcements visible to me, pinned first
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    return NextResponse.json(announcements.filter((a) => a.orgId === me.orgId && isAnnouncementFor(me, a.audience))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt))
        .map((a) => ({ id: a.id, title: a.title, body: a.body, pinned: a.pinned, createdAt: a.createdAt, author: users.find((u) => u.id === a.createdById)?.name ?? "HR" })));
}
