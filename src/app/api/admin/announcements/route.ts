import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { announcements, users, addAudit, addNotification } from "@/lib/mock/data";
import { isAnnouncementFor } from "@/lib/mock/hr";
import type { Announcement } from "@/lib/types";

const PUBLISHERS = ["SUPER_ADMIN", "HR_ADMIN"];
const AUDIENCES = ["ALL", "TA", "AGENTS", "EMPLOYEES"];

// GET: publishers see every announcement; everyone else sees what is targeted at them
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = announcements
        .filter((a) => a.orgId === me.orgId && (PUBLISHERS.includes(me.role) || isAnnouncementFor(me, a.audience)))
        .map((a) => ({
            ...a,
            createdByName: users.find((u) => u.id === a.createdById)?.name ?? "—",
        }))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt));

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!String(body.title ?? "").trim() || !String(body.body ?? "").trim()) {
        return NextResponse.json({ error: "title and body are required" }, { status: 400 });
    }
    const audience = (Array.isArray(body.audience) ? body.audience : []).filter((a: string) => AUDIENCES.includes(a));

    const announcement: Announcement = {
        id: `ann-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        title: String(body.title).trim(),
        body: String(body.body).trim(),
        audience: audience.length > 0 ? audience : ["ALL"],
        pinned: Boolean(body.pinned),
        createdById: me.id,
        createdAt: new Date().toISOString(),
    };
    announcements.unshift(announcement);

    // Notify only the users this announcement targets
    const targets = users.filter((u) => u.orgId === me.orgId && u.status === "ACTIVE" && u.id !== me.id && isAnnouncementFor(u, announcement.audience));
    targets.forEach((u) => {
        addNotification({
            orgId: me.orgId,
            userId: u.id,
            title: announcement.pinned ? "📌 Important announcement" : "New announcement",
            message: announcement.title,
            link: "/portal/dashboard",
        });
    });

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "ANNOUNCEMENT_PUBLISHED", entity: "Announcement", entityId: announcement.id,
        detail: `${announcement.title} → ${announcement.audience.join(", ")} (${targets.length} recipients)`,
    });

    return NextResponse.json(announcement, { status: 201 });
}

export async function DELETE(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id } = await request.json();
    const idx = announcements.findIndex((a) => a.id === id && a.orgId === me.orgId);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (me.role !== "SUPER_ADMIN" && announcements[idx].createdById !== me.id) {
        return NextResponse.json({ error: "You can only remove announcements you published" }, { status: 403 });
    }

    const [removed] = announcements.splice(idx, 1);
    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "ANNOUNCEMENT_REMOVED", entity: "Announcement", entityId: removed.id,
        detail: removed.title,
    });

    return NextResponse.json({ success: true });
}
