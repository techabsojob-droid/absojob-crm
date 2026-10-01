import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users } from "@/lib/mock/data";

// Lightweight list of assignable recruitment team members (for recruiter / TA pickers)
// ?scope=staff → every active internal staff member (e.g. interview panel picker)
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const staff = new URL(request.url).searchParams.get("scope") === "staff";
    const roles = staff ? ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER", "EMPLOYEE"] : ["SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER"];

    const list = users
        .filter((u) => u.orgId === me.orgId && u.status === "ACTIVE" && roles.includes(u.role))
        .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, designation: u.designation ?? null, avatarUrl: u.avatarUrl ?? null }));

    return NextResponse.json({ users: list });
}
