import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { attendance, employees, users, hoursWorkedOf, addAudit, todayStr } from "@/lib/mock/data";

// GET: list attendance with date, department, employee, status filters
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const date = url.searchParams.get("date") || todayStr;
    const department = url.searchParams.get("department");
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = attendance.filter((a) => a.orgId === me.orgId);
    if (date) {
        list = list.filter((a) => a.date === date);
    }
    if (status && status !== "ALL") {
        list = list.filter((a) => a.status === status);
    }

    const enriched = list.map((a) => {
        const emp = employees.find((e) => e.userId === a.userId || e.id === a.userId);
        const user = users.find((u) => u.id === a.userId);
        const name = emp?.name || user?.name || "Employee";
        const dept = emp?.department || user?.department || "Operations";
        const code = emp?.employeeId || "—";
        const hours = hoursWorkedOf(a);

        // Check for late arrival (> 09:30 AM)
        let isLate = false;
        if (a.checkIn) {
            const time = new Date(a.checkIn);
            if (time.getHours() > 9 || (time.getHours() === 9 && time.getMinutes() > 30)) {
                isLate = true;
            }
        }

        // Overtime if > 8.5 hours
        const overtimeHours = hours > 8.5 ? Math.round((hours - 8.5) * 10) / 10 : 0;

        return {
            ...a,
            employeeName: name,
            department: dept,
            employeeCode: code,
            hoursWorked: hours,
            isLate,
            overtimeHours,
        };
    });

    let filtered = enriched;
    if (department && department !== "ALL") {
        filtered = filtered.filter((r) => r.department === department);
    }
    if (q) {
        filtered = filtered.filter(
            (r) =>
                r.employeeName.toLowerCase().includes(q) ||
                r.employeeCode.toLowerCase().includes(q)
        );
    }

    // Sort: present/late first, then others
    filtered.sort((x, y) => (x.employeeName > y.employeeName ? 1 : -1));

    return NextResponse.json(filtered);
}

// PATCH: regularize / update attendance record
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { id, status, checkIn, checkOut } = body;

    const record = attendance.find((a) => a.id === id && a.orgId === me.orgId);
    if (!record) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

    if (status) record.status = status;
    if (checkIn !== undefined) record.checkIn = checkIn;
    if (checkOut !== undefined) record.checkOut = checkOut;

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "ATTENDANCE_REGULARIZED",
        entity: "AttendanceRecord",
        entityId: record.id,
        detail: `Regularized attendance for ${record.userId} on ${record.date} to ${record.status}`,
    });

    return NextResponse.json(record);
}
