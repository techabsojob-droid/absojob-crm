import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { goals, addAudit, addNotification } from "@/lib/mock/data";
import { approversFor, employeeForUser } from "@/lib/mock/identity";
import { bad, body } from "@/lib/mock/fin/http";

// GET — my goals / OKRs
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const emp = employeeForUser(auth.user.id);
    return NextResponse.json(emp ? goals.filter((g) => g.orgId === auth.user.orgId && (g.ownerId === emp.id || g.ownerId === auth.user.id || (g.type !== "INDIVIDUAL" && g.department === emp.department))) : []);
}

// POST { title, description, startDate, endDate, weight } — propose an individual goal (manager informed)
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    if (!emp) return bad("No employee profile is linked to your account", 404);
    const b = await body(request);
    const title = String(b.title ?? "").trim();
    if (title.length < 3) return bad("Give the goal a title");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.startDate ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(b.endDate ?? "") || b.endDate < b.startDate) return bad("Valid start and end dates are required");
    const weight = Number(b.weight ?? 10);
    if (!Number.isFinite(weight) || weight < 1 || weight > 100) return bad("Weight must be 1–100");
    const g = { id: `goal-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, title: title.slice(0, 140), description: String(b.description ?? "").trim().slice(0, 1000), ownerId: emp.id, ownerName: emp.name, department: emp.department, type: "INDIVIDUAL" as const, startDate: b.startDate, endDate: b.endDate, weight, progress: 0, status: "NOT_STARTED" as const };
    goals.push(g);
    const { managerUserId } = approversFor(me.id);
    if (managerUserId) addNotification({ orgId: me.orgId, userId: managerUserId, title: "New goal set", message: `${emp.name}: ${g.title}`, link: "/portal/team" });
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "GOAL_CREATED", entity: "Goal", entityId: g.id, detail: `${emp.name}: ${g.title}` });
    return NextResponse.json(g, { status: 201 });
}

// PATCH { id, progress, status? } — update my goal's progress
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    const b = await body(request);
    const g = goals.find((x) => x.id === b.id && x.orgId === me.orgId);
    if (!g || !emp || (g.ownerId !== emp.id && g.ownerId !== me.id)) return bad("Goal not found", 404);
    const progress = Number(b.progress);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) return bad("Progress must be 0–100");
    g.progress = Math.round(progress);
    g.status = b.status === "AT_RISK" ? "AT_RISK" : g.progress >= 100 ? "COMPLETED" : g.progress > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    return NextResponse.json(g);
}
