import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { employees } from "@/lib/mock/data";
import { istNow } from "@/lib/mock/ess";

// GET ?q=&department= — colleague directory (work contact details only) + birthdays / work anniversaries this month
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "TA_MANAGER", "TA_RECRUITER", "EMPLOYEE");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const sp = new URL(request.url).searchParams;
    const q = (sp.get("q") ?? "").toLowerCase().trim();
    const dept = sp.get("department");
    const active = employees.filter((e) => e.orgId === me.orgId && e.status !== "EXITED" && e.department !== "Field");
    const people = active
        .filter((e) => (!q || [e.name, e.designation, e.department, e.email, e.location ?? ""].some((x) => x.toLowerCase().includes(q))) && (!dept || e.department === dept))
        .map((e) => ({ id: e.id, name: e.name, designation: e.designation, department: e.department, email: e.email, phone: e.phone, location: e.location ?? null, workMode: e.workMode ?? null, managerName: e.reportingManagerName ?? null, managerId: e.reportingManagerId, isMe: e.userId === me.id }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const month = istNow().date.slice(5, 7);
    const year = Number(istNow().date.slice(0, 4));
    return NextResponse.json({
        people,
        departments: Array.from(new Set(active.map((e) => e.department))).sort(),
        birthdays: active.filter((e) => e.personalDetails?.dob?.slice(5, 7) === month).map((e) => ({ name: e.name, day: Number(e.personalDetails!.dob!.slice(8, 10)) })).sort((a, b) => a.day - b.day),
        anniversaries: active.filter((e) => e.joiningDate.slice(5, 7) === month && Number(e.joiningDate.slice(0, 4)) < year).map((e) => ({ name: e.name, day: Number(e.joiningDate.slice(8, 10)), years: year - Number(e.joiningDate.slice(0, 4)) })).sort((a, b) => a.day - b.day),
    });
}
