import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    attendance, users, todayStr, nextIds, hoursWorkedOf,
} from "@/lib/mock/data";
import type { AttendanceRecord } from "@/lib/types";

const withHours = (a: AttendanceRecord) => ({ ...a, hoursWorked: hoursWorkedOf(a) });

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "AGENT", "EMPLOYEE");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const mine = attendance
        .filter((a) => a.orgId === me.orgId && a.userId === me.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map(withHours);

    const monthRecords = mine.filter((r) => r.date.startsWith(todayStr.slice(0, 7)));
    const presentDays = monthRecords.filter((r) => ["PRESENT", "WFH"].includes(r.status)).length;
    const halfDays = monthRecords.filter((r) => r.status === "HALF_DAY").length;
    const leaves = monthRecords.filter((r) => ["ON_LEAVE", "ABSENT"].includes(r.status)).length;
    const lateDays = monthRecords.filter((r) => r.status === "LATE").length;

    const workingDays = monthRecords.length || 1;
    const attendanceRate = Math.round(((presentDays + halfDays * 0.5) / workingDays) * 100);

    const totalHours = Math.round(mine.reduce((s, r) => s + r.hoursWorked, 0) * 10) / 10;

    return NextResponse.json({
        records: mine.slice(0, 60),
        summary: { presentDays, halfDays, leaves, lateDays, attendanceRate, totalHours },
        todayRecord: mine.find((r) => r.date === todayStr) ?? null,
        teamView: me.role !== "SUPER_ADMIN" ? null : attendance
            .filter((a) => a.date === todayStr)
            .map(withHours)
            .map((a) => ({ ...a, userName: users.find((u) => u.id === a.userId)?.name ?? "—" })),
    });
}

export async function POST(request: Request) {
    const auth = await requireRole("AGENT", "EMPLOYEE", "SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { action } = await request.json();
    const nowIso = new Date().toISOString();

    let record = attendance.find((a) => a.orgId === me.orgId && a.userId === me.id && a.date === todayStr);

    if (action === "check_in") {
        if (record?.checkIn) return NextResponse.json({ error: "Already checked in today" }, { status: 409 });
        if (!record) {
            record = {
                id: nextIds.attendance(),
                orgId: me.orgId,
                userId: me.id,
                date: todayStr,
                status: nowIso.includes("T10:") || new Date().getHours() >= 10 ? "LATE" : "PRESENT",
                checkIn: nowIso,
                checkOut: null,
            };
            attendance.push(record);
        } else {
            record.checkIn = nowIso;
            record.status = new Date().getHours() >= 10 ? "LATE" : "PRESENT";
        }
        void checkStreak;
        return NextResponse.json(record);
    }

    if (action === "check_out") {
        if (!record?.checkIn) return NextResponse.json({ error: "Check in first" }, { status: 409 });
        if (record.checkOut) return NextResponse.json({ error: "Already checked out" }, { status: 409 });
        record.checkOut = nowIso;
        const hours = (new Date(nowIso).getTime() - new Date(record.checkIn).getTime()) / 3600000;
        if (hours > 0 && hours < 5) record.status = "HALF_DAY";
        else if (record.status === "LATE") record.status = "LATE";
        return NextResponse.json(record);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

function checkStreak() { /* placeholder for future gamification */ }
