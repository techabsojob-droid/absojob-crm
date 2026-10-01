import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users, addAudit, addNotification, jobs, candidates, applications, interviews, placements, tasks } from "@/lib/mock/data";
import { assignableRoles, canManageUser, ensureEmployeeForUser, syncUserToEmployee, uniqueUserId } from "@/lib/mock/identity";
import { notifyRoles } from "@/lib/mock/pipeline";
import type { User, UserRole, UserStatus } from "@/lib/types";

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const department = url.searchParams.get("department");
    const role = url.searchParams.get("role");
    const status = url.searchParams.get("status");

    let list = users
        .filter((u) => u.orgId === me.orgId)
        .map((u) => {
            const manager = users.find((x) => x.id === u.reportingTo);
            const directReports = users.filter((x) => x.reportingTo === u.id);
            const assignedJobs = jobs.filter((j) => j.assignedTas.includes(u.id));
            const assignedApps = applications.filter((a) => a.recruiterId === u.id);
            const userPlacements = placements.filter((p) => p.recruiterId === u.id);
            const userTasks = tasks.filter((t) => t.assignedToId === u.id && !t.completed);

            return {
                ...u,
                employeeId: `EMP-${u.id.replace(/[^0-9a-zA-Z]/g, "").slice(-4).toUpperCase() || "1001"}`,
                reportingToName: manager?.name ?? null,
                reportingToRole: manager?.role ?? null,
                secondaryManagerName: u.role === "TA_RECRUITER" ? "Aarav Mehta" : null,
                team: u.department === "Talent Acquisition" ? "Technology TA" : u.department === "Field" ? "Regional Sourcing Squad" : "Core Operations",
                directReportsCount: directReports.length,
                directReports: directReports.map((d) => ({ id: d.id, name: d.name, role: d.role })),
                activeJobsCount: assignedJobs.length,
                activeCandidatesCount: assignedApps.length,
                placementsCount: userPlacements.length,
                pendingTasksCount: userTasks.length,
                workMode: "Hybrid (Mumbai HQ)",
                employmentType: "Full Time",
            };
        });

    if (q) {
        list = list.filter(
            (u) =>
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.department ?? "").toLowerCase().includes(q) ||
                (u.designation ?? "").toLowerCase().includes(q) ||
                (u.team ?? "").toLowerCase().includes(q) ||
                (u.reportingToName ?? "").toLowerCase().includes(q)
        );
    }

    if (department && department !== "ALL") list = list.filter((u) => u.department === department);
    if (role && role !== "ALL") list = list.filter((u) => u.role === role);
    if (status && status !== "ALL") list = list.filter((u) => u.status === status);

    return NextResponse.json(list);
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!name || !email || !body.role) {
        return NextResponse.json({ error: "name, email and role are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (!assignableRoles(me).includes(body.role)) {
        return NextResponse.json({ error: `You are not allowed to create ${String(body.role).replace(/_/g, " ")} accounts` }, { status: 403 });
    }
    if (users.some((u) => u.email.toLowerCase() === email)) {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    const manager = body.reportingTo ? users.find((u) => u.id === body.reportingTo && u.orgId === me.orgId) : undefined;
    if (body.reportingTo && !manager) {
        return NextResponse.json({ error: "Reporting manager not found" }, { status: 400 });
    }

    const newUser: User = {
        id: uniqueUserId(),
        orgId: me.orgId,
        name,
        email,
        phone: body.phone ?? "",
        role: body.role as UserRole,
        status: "ACTIVE",
        avatarUrl: null,
        department: body.department ?? "Talent Acquisition",
        designation: body.designation ?? "Talent Partner",
        location: body.location ?? "Mumbai",
        reportingTo: manager?.id ?? null,
        joinedAt: new Date().toISOString(),
        deactivatedAt: null,
    };
    users.push(newUser);
    const emp = ensureEmployeeForUser(newUser);

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "USER_CREATED",
        entity: "User",
        entityId: newUser.id,
        detail: `${newUser.name} added as ${newUser.role} in ${newUser.department}${emp ? ` (HR record ${emp.employeeId})` : ""}`,
    });

    notifyRoles(me.orgId, ["HR_ADMIN"], {
        title: "New team member",
        message: `${newUser.name} joined as ${newUser.role.replace(/_/g, " ")}${emp ? ` (${emp.employeeId}). Complete their HR profile.` : ""}`,
        link: emp ? `/hr/employees?id=${emp.id}` : null,
    });

    return NextResponse.json({ ...newUser, employeeRecordId: emp?.id ?? null }, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, role, status, department, designation, reportingTo, location, phone } = await request.json();
    const user = users.find((u) => u.id === id && u.orgId === me.orgId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (!canManageUser(me, user)) {
        return NextResponse.json({ error: "You are not allowed to modify this account" }, { status: 403 });
    }
    if (user.id === me.id && ((role && role !== user.role) || (status && status !== user.status))) {
        return NextResponse.json({ error: "You cannot change your own role or status" }, { status: 403 });
    }
    if (role && role !== user.role && !assignableRoles(me).includes(role)) {
        return NextResponse.json({ error: `You are not allowed to assign the ${String(role).replace(/_/g, " ")} role` }, { status: 403 });
    }
    if (status && !["ACTIVE", "INVITED", "SUSPENDED", "EXITED"].includes(status)) {
        return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    // Hierarchy Validation: Prevent circular reporting
    if (reportingTo) {
        if (reportingTo === id) {
            return NextResponse.json({ error: "An employee cannot report to themselves." }, { status: 400 });
        }
        if (!users.some((u) => u.id === reportingTo && u.orgId === me.orgId)) {
            return NextResponse.json({ error: "Reporting manager not found" }, { status: 400 });
        }
        let currentParent = users.find((u) => u.id === reportingTo);
        while (currentParent && currentParent.reportingTo) {
            if (currentParent.reportingTo === id) {
                return NextResponse.json({ error: "Circular reporting hierarchy detected! Invalid assignment." }, { status: 400 });
            }
            currentParent = users.find((u) => u.id === currentParent!.reportingTo);
        }
    }

    const changes: string[] = [];
    let action = "USER_UPDATED";

    if (role && role !== user.role) {
        changes.push(`role ${user.role} → ${role}`);
        user.role = role as UserRole;
        action = "USER_ROLE_CHANGED";
    }
    if (status && status !== user.status) {
        changes.push(`status ${user.status} → ${status}`);
        user.status = status as UserStatus;
        action = status === "SUSPENDED" ? "USER_SUSPENDED" : status === "EXITED" ? "USER_EXITED" : "USER_REACTIVATED";
        user.deactivatedAt = status === "EXITED" || status === "SUSPENDED" ? new Date().toISOString() : null;
    }
    if (department !== undefined && department !== user.department) { changes.push(`department → ${department}`); user.department = department; }
    if (designation !== undefined && designation !== user.designation) { changes.push(`designation → ${designation}`); user.designation = designation; }
    if (reportingTo !== undefined && (reportingTo || null) !== user.reportingTo) { changes.push(`reports to → ${reportingTo || "none"}`); user.reportingTo = reportingTo || null; }
    if (location !== undefined) user.location = location;
    if (phone !== undefined) user.phone = phone;

    // Keep the HR record in step (creates it if the role now needs one)
    ensureEmployeeForUser(user);
    syncUserToEmployee(user);

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action,
        entity: "User",
        entityId: user.id,
        detail: `${user.name}: ${changes.join("; ") || "profile updated"}`,
    });

    if (action === "USER_ROLE_CHANGED") {
        addNotification({
            orgId: me.orgId, userId: user.id,
            title: "Your access changed",
            message: `Your role is now ${user.role.replace(/_/g, " ")}. Sign in again to see your new workspace.`,
            link: null,
        });
    }

    return NextResponse.json(user);
}
