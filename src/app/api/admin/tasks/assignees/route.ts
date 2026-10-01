import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users } from "@/lib/mock/data";
import { canAssignTo } from "@/lib/tasks";

const ROLE_ORDER = ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "TA_MANAGER", "TA_RECRUITER", "AGENT", "EMPLOYEE"];

// GET → people the signed-in user may assign a task to (themselves first)
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = users
        .filter((u) => canAssignTo(me, u))
        .sort((a, b) => Number(b.id === me.id) - Number(a.id === me.id) || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name))
        .map((u) => ({ id: u.id, name: u.name, role: u.role, designation: u.designation ?? null, isMe: u.id === me.id }));

    return NextResponse.json(list);
}
