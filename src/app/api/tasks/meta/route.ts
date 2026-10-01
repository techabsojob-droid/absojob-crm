import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, clients, employees, jobs, tasks, users } from "@/lib/mock/data";
import { canAssignTo, canViewTask } from "@/lib/tasks";

const ROLE_ORDER = ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "TA_MANAGER", "TA_RECRUITER", "AGENT", "EMPLOYEE"];

// GET /api/tasks/meta — options for the task forms: people, labels in use, linkable records
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const people = users
        .filter((u) => u.orgId === me.orgId && u.status === "ACTIVE")
        .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name))
        .map((u) => ({ id: u.id, name: u.name, role: u.role, designation: u.designation ?? null, assignable: canAssignTo(me, u) }));

    const labels = [...new Set(tasks.filter((t) => canViewTask(me, t, users)).flatMap((t) => t.labels ?? []))].sort();

    const recruitment = ["SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER"].includes(me.role);
    const hr = ["SUPER_ADMIN", "HR_ADMIN"].includes(me.role);
    const linkable = {
        CANDIDATE: recruitment ? candidates.filter((c) => c.orgId === me.orgId && !c.archived).map((c) => ({ id: c.id, label: c.name })) : [],
        JOB: recruitment ? jobs.filter((j) => j.orgId === me.orgId).map((j) => ({ id: j.id, label: j.title })) : [],
        CLIENT: recruitment ? clients.filter((c) => c.orgId === me.orgId).map((c) => ({ id: c.id, label: c.companyName })) : [],
        EMPLOYEE: hr ? employees.filter((e) => e.orgId === me.orgId && e.status !== "EXITED").map((e) => ({ id: e.id, label: e.name })) : [],
    };

    return NextResponse.json({ me: { id: me.id, name: me.name, role: me.role }, people, labels, linkable });
}
