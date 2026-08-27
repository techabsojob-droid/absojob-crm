import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { announcements, users, addAudit } from "@/lib/mock/data";
import type { Announcement } from "@/lib/types";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = announcements
        .filter((a) => a.orgId === me.orgId)
        .map((a) => ({
            ...a,
            createdByName: users.find((u) => u.id === a.createdById)?.name ?? "—",
        }))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt));

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.title || !body.body) {
        return NextResponse.json({ error: "title and body are required" }, { status: 400 });
    }

    const announcement: Announcement = {
        id: `ann-${Date.now().toString(36)}`,
        orgId: me.orgId,
        title: body.title,
        body: body.body,
        audience: Array.isArray(body.audience) && body.audience.length > 0 ? body.audience : ["ALL"],
        pinned: Boolean(body.pinned),
        createdById: me.id,
        createdAt: new Date().toISOString(),
    };
    announcements.unshift(announcement);

    // notify all targeted active users
    for (const u of users.filter((x) => x.orgId === me.orgId && x.status === "ACTIVE")) {
        const { addNotification } = await import("@/lib/mock/data");
        addNotification({
            orgId: me.orgId,
            userId: u.id,
            title: "New announcement",
            message: announcement.title,
            link: "/portal/dashboard",
        });
    }

    return NextResponse.json(announcement, { status: 201 });
}

export async function DELETE(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;

    const { id } = await request.json();
    const idx = announcements.findIndex((a) => a.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [removed] = announcements.splice(idx, 1);
    void removed;
    void addAudit; // audit optional here

    return NextResponse.json({ success: true });
}
