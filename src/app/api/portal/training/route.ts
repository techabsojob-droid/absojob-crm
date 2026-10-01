import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { trainingPrograms, addAudit } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { istNow } from "@/lib/mock/ess";
import { notifyRoles } from "@/lib/mock/pipeline";
import { bad, body } from "@/lib/mock/fin/http";

// GET — my programmes (with my completion + feedback) and open programmes I can join
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    if (!emp) return NextResponse.json({ mine: [], open: [] });
    const all = trainingPrograms.filter((t) => t.orgId === me.orgId);
    const shape = (t: (typeof all)[number]) => ({
        id: t.id, title: t.title, course: t.course, trainer: t.trainer, startDate: t.startDate, endDate: t.endDate, status: t.status, description: t.description,
        completed: (t.completedEmployeeIds ?? []).includes(emp.id), myFeedback: t.feedback?.find((f) => f.employeeId === emp.id) ?? null, seats: t.enrolledEmployeeIds.length,
    });
    return NextResponse.json({
        mine: all.filter((t) => t.enrolledEmployeeIds.includes(emp.id)).map(shape),
        open: all.filter((t) => t.selfEnrollOpen && t.status === "UPCOMING" && !t.enrolledEmployeeIds.includes(emp.id)).map(shape),
    });
}

// POST { id, action: enroll | feedback, rating?, comment? }
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    if (!emp) return bad("No employee profile is linked to your account", 404);
    const b = await body(request);
    const t = trainingPrograms.find((x) => x.id === b.id && x.orgId === me.orgId);
    if (!t) return bad("Programme not found", 404);
    if (b.action === "enroll") {
        if (!t.selfEnrollOpen || t.status !== "UPCOMING") return bad("This programme is not open for self-enrolment", 409);
        if (t.enrolledEmployeeIds.includes(emp.id)) return bad("Already enrolled", 409);
        t.enrolledEmployeeIds.push(emp.id);
        notifyRoles(me.orgId, ["HR_ADMIN"], { title: "Training enrolment", message: `${emp.name} joined ${t.title}`, link: "/hr/training" });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "TRAINING_SELF_ENROLLED", entity: "Training", entityId: t.id, detail: `${emp.name} → ${t.title}` });
        return NextResponse.json({ success: true });
    }
    if (b.action === "feedback") {
        if (!t.enrolledEmployeeIds.includes(emp.id)) return bad("You are not enrolled", 403);
        if (t.endDate > istNow().date && t.status !== "COMPLETED") return bad("Feedback opens once the programme ends", 409);
        const rating = Number(b.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad("Rating must be 1–5");
        t.feedback = [...(t.feedback ?? []).filter((f) => f.employeeId !== emp.id), { employeeId: emp.id, rating, comment: String(b.comment ?? "").trim().slice(0, 1000), at: new Date().toISOString() }];
        // Attending and giving feedback completes the programme for the employee
        t.completedEmployeeIds = Array.from(new Set([...(t.completedEmployeeIds ?? []), emp.id]));
        return NextResponse.json({ success: true });
    }
    return bad("action must be enroll or feedback");
}
