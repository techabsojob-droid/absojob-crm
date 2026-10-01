import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { shifts, addAudit } from "@/lib/mock/data";
import type { ShiftSchedule } from "@/lib/types";

// GET /api/hr/shifts
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const list = shifts.filter((s) => s.orgId === me.orgId);
    return NextResponse.json(list);
}

// POST /api/hr/shifts
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const { name, code, startTime, endTime, graceMinutes = 15, workingHours = 9, isRotational = false } = body;

        const newShift: ShiftSchedule = {
            id: `shf-${shifts.length + 1}`,
            orgId: me.orgId,
            name,
            code: code || name.toUpperCase().replace(/\s+/g, "_"),
            startTime,
            endTime,
            graceMinutes: Number(graceMinutes),
            workingHours: Number(workingHours),
            assignedCount: 0,
            isRotational: Boolean(isRotational),
            status: "ACTIVE",
        };

        shifts.push(newShift);

        addAudit({
            orgId: me.orgId,
            actorUserId: me.id,
            actorRole: me.role,
            action: "SHIFT_CREATED" as any,
            entity: "ShiftSchedule" as any,
            entityId: newShift.id,
            detail: `Created new work shift: ${name} (${startTime} - ${endTime})`,
        });

        return NextResponse.json(newShift, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create shift" }, { status: 500 });
    }
}
