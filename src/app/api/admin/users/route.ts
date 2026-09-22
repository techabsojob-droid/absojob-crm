import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users, addAudit, jobs, candidates, applications, interviews, placements, tasks } from "@/lib/mock/data";
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
        department: body.department ?? "Talent Acquisition",
        designation: body.designation ?? "Talent Partner",
        location: body.location ?? "Mumbai",
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
        detail: `${newUser.name} added as ${newUser.role} in ${newUser.department}`,
    });

    return NextResponse.json(newUser, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, role, status, department, designation, reportingTo, location, phone } = await request.json();
    const user = users.find((u) => u.id === id && u.orgId === me.orgId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Hierarchy Validation: Prevent circular reporting
    if (reportingTo) {
        if (reportingTo === id) {
            return NextResponse.json({ error: "An employee cannot report to themselves." }, { status: 400 });
        }
        let currentParent = users.find((u) => u.id === reportingTo);
        while (currentParent && currentParent.reportingTo) {
            if (currentParent.reportingTo === id) {
                return NextResponse.json({ error: "Circular reporting hierarchy detected! Invalid assignment." }, { status: 400 });
            }
            currentParent = users.find((u) => u.id === currentParent!.reportingTo);
        }
    }

    let action = "USER_UPDATED";
    let detail = `${user.name} profile updated`;

    if (role && role !== user.role) {
        user.role = role as UserRole;
        detail = `${user.name} role changed to ${role}`;
        action = "USER_ROLE_CHANGED";
    }
    if (status && status !== user.status) {
        user.status = status as UserStatus;
        action = status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED";
        detail = `${user.name} ${status === "SUSPENDED" ? "suspended" : "re-activated"}`;
        user.deactivatedAt = status === "EXITED" ? new Date().toISOString() : null;
    }
    if (department !== undefined) user.department = department;
    if (designation !== undefined) user.designation = designation;
    if (reportingTo !== undefined) user.reportingTo = reportingTo || null;
    if (location !== undefined) user.location = location;
    if (phone !== undefined) user.phone = phone;

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action,
        entity: "User",
        entityId: user.id,
        detail
    });

    return NextResponse.json(user);
}
