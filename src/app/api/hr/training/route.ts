import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { trainingPrograms, employees, addAudit, addNotification } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import type { TrainingProgram } from "@/lib/types";

const isHR = (role: string) => role === "SUPER_ADMIN" || role === "HR_ADMIN";

// GET: HR sees all programs; staff see the programs they are enrolled in
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase();
    const mine = url.searchParams.get("mine") === "1";

    let list = trainingPrograms.filter((t) => t.orgId === me.orgId);
    if (!isHR(me.role) || mine) {
        const emp = employeeForUser(me.id);
        list = emp ? list.filter((t) => t.enrolledEmployeeIds.includes(emp.id)) : [];
    }
    if (status && status !== "ALL") list = list.filter((t) => t.status === status);
    if (q) list = list.filter((t) => t.title.toLowerCase().includes(q) || t.course.toLowerCase().includes(q) || t.trainer.toLowerCase().includes(q));

    return NextResponse.json(list.map((t) => ({
        ...t,
        enrolledEmployees: t.enrolledEmployeeIds.map((id) => {
            const e = employees.find((x) => x.id === id);
            return { id, name: e?.name ?? id, completed: (t.completedEmployeeIds ?? []).includes(id) };
        }),
    })));
}

// POST: create a training program
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    if (!title || !body.startDate || !body.endDate) return NextResponse.json({ error: "title, start and end dates are required" }, { status: 400 });
    if (body.endDate < body.startDate) return NextResponse.json({ error: "End date cannot be before start date" }, { status: 400 });

    const prog: TrainingProgram = {
        id: `trn-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        title,
        course: String(body.course ?? title),
        trainer: String(body.trainer ?? "Internal"),
        startDate: body.startDate,
        endDate: body.endDate,
        enrolledEmployeeIds: [],
        completedEmployeeIds: [],
        status: "UPCOMING",
        description: String(body.description ?? ""),
    };
    trainingPrograms.unshift(prog);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "TRAINING_CREATED", entity: "Training", entityId: prog.id, detail: `${prog.title} (${prog.startDate} → ${prog.endDate})` });
    return NextResponse.json(prog, { status: 201 });
}

// PATCH: enroll / unenroll / mark completion / change status
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, action, employeeIds, employeeId, status } = await request.json();
    const prog = trainingPrograms.find((t) => t.id === id && t.orgId === me.orgId);
    if (!prog) return NextResponse.json({ error: "Training program not found" }, { status: 404 });
    if (!prog.completedEmployeeIds) prog.completedEmployeeIds = [];

    if (action === "enroll") {
        const ids: string[] = Array.isArray(employeeIds) ? employeeIds : employeeId ? [employeeId] : [];
        const valid = ids.map((x) => employees.find((e) => e.id === x && e.orgId === me.orgId && e.status !== "EXITED")).filter(Boolean) as typeof employees;
        if (!valid.length) return NextResponse.json({ error: "Select at least one active employee" }, { status: 400 });
        const added = valid.filter((e) => !prog.enrolledEmployeeIds.includes(e.id));
        added.forEach((e) => {
            prog.enrolledEmployeeIds.push(e.id);
            if (e.userId) addNotification({ orgId: me.orgId, userId: e.userId, title: "Enrolled in training", message: `${prog.title} · ${prog.startDate} → ${prog.endDate}`, link: "/portal/training" });
        });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "TRAINING_ENROLLED", entity: "Training", entityId: prog.id, detail: `${added.map((e) => e.name).join(", ") || "no new"} → ${prog.title}` });
        return NextResponse.json(prog);
    }
    if (action === "unenroll") {
        prog.enrolledEmployeeIds = prog.enrolledEmployeeIds.filter((x) => x !== employeeId);
        prog.completedEmployeeIds = prog.completedEmployeeIds.filter((x) => x !== employeeId);
        return NextResponse.json(prog);
    }
    if (action === "complete") {
        if (!prog.enrolledEmployeeIds.includes(employeeId)) return NextResponse.json({ error: "Employee is not enrolled" }, { status: 400 });
        if (!prog.completedEmployeeIds.includes(employeeId)) prog.completedEmployeeIds.push(employeeId);
        const e = employees.find((x) => x.id === employeeId);
        if (e?.userId) addNotification({ orgId: me.orgId, userId: e.userId, title: "Training completed 🎓", message: prog.title, link: "/portal/training" });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "TRAINING_COMPLETED", entity: "Training", entityId: prog.id, detail: `${e?.name ?? employeeId} completed ${prog.title}` });
        return NextResponse.json(prog);
    }
    if (action === "status") {
        if (!["UPCOMING", "IN_PROGRESS", "COMPLETED"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        prog.status = status;
        return NextResponse.json(prog);
    }
    return NextResponse.json({ error: "action must be enroll, unenroll, complete or status" }, { status: 400 });
}
