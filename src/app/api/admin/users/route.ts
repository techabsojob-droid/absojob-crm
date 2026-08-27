import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users, addAudit } from "@/lib/mock/data";
import type { User, UserRole, UserStatus } from "@/lib/types";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = users
        .filter((u) => u.orgId === me.orgId)
        .map((u) => ({ ...u, reportingToName: users.find((x) => x.id === u.reportingTo)?.name ?? null }));

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    if (!body.name || !body.email || !body.role) {
        return NextResponse.json({ error: "name, email and role are required" }, { status: 400 });
    }
    if (users.some((u) => u.email.toLowerCase() === String(body.email).toLowerCase())) {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const newUser: User = {
        id: `usr-${Date.now().toString(36)}`,
        orgId: me.orgId,
        name: body.name,
        email: body.email,
        phone: body.phone ?? "",
        role: body.role as UserRole,
        status: "ACTIVE",
        avatarUrl: null,
        department: body.department ?? null,
        designation: body.designation ?? null,
        location: body.location ?? null,
        reportingTo: body.reportingTo ?? null,
        joinedAt: new Date().toISOString(),
        deactivatedAt: null,
    };
    users.push(newUser);

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "USER_CREATED",
        entity: "User",
        entityId: newUser.id,
        detail: `${newUser.name} added as ${newUser.role}`,
    });

    return NextResponse.json(newUser, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, role, status, department, designation } = await request.json();
    const user = users.find((u) => u.id === id && u.orgId === me.orgId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let action = "USER_UPDATED";
    let detail = `${user.name} updated`;
    if (role && role !== user.role) { user.role = role as UserRole; detail = `${user.name} role → ${role}`; action = "USER_ROLE_CHANGED"; }
    if (status && status !== user.status) {
        user.status = status as UserStatus;
        action = status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED";
        detail = `${user.name} ${status === "SUSPENDED" ? "suspended" : "re-activated"}`;
        user.deactivatedAt = status === "EXITED" ? new Date().toISOString() : null;
    }
    if (department !== undefined) user.department = department;
    if (designation !== undefined) user.designation = designation;

    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action, entity: "User", entityId: user.id, detail });

    return NextResponse.json(user);
}
