import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { holidays, addAudit } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { notifyRoles } from "@/lib/mock/pipeline";

export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const y = new URL(request.url).searchParams.get("year");
    return NextResponse.json(holidays.filter((h) => h.orgId === auth.user.orgId && (!y || h.date.startsWith(y))).sort((a, b) => a.date.localeCompare(b.date)));
}

// POST { date, name, type, locations? } — HR adds a holiday
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const name = String(b.name ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? "") || !name) return bad("Date and name are required");
    if (!["NATIONAL", "FESTIVAL", "OPTIONAL"].includes(b.type)) return bad("Invalid holiday type");
    if (holidays.some((h) => h.orgId === me.orgId && h.date === b.date)) return bad("A holiday already exists on this date", 409);
    const h = { id: `hol-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, date: b.date, name: name.slice(0, 80), type: b.type, locations: (Array.isArray(b.locations) ? b.locations : []).map(String).filter(Boolean) };
    holidays.push(h);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "HOLIDAY_ADDED", entity: "Holiday", entityId: h.id, detail: `${h.date} ${h.name}` });
    notifyRoles(me.orgId, ["EMPLOYEE", "TA_RECRUITER", "TA_MANAGER", "FINANCE_ADMIN"], { title: "Holiday added", message: `${h.name} on ${h.date}`, link: "/portal/holidays" });
    return NextResponse.json(h, { status: 201 });
}

// DELETE { id }
export async function DELETE(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const id = new URL(request.url).searchParams.get("id") ?? (await body(request)).id;
    const i = holidays.findIndex((h) => h.id === id && h.orgId === me.orgId);
    if (i < 0) return bad("Holiday not found", 404);
    const [h] = holidays.splice(i, 1);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "HOLIDAY_REMOVED", entity: "Holiday", entityId: h.id, detail: `${h.date} ${h.name}` });
    return NextResponse.json({ success: true });
}
