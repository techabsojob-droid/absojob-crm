import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { benefitEnrollments, benefits, addAudit } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { notifyRoles } from "@/lib/mock/pipeline";
import { bad, body } from "@/lib/mock/fin/http";

const RELATIONS = ["Spouse", "Child", "Father", "Mother", "Father-in-law", "Mother-in-law"];

// GET — active benefits with my enrollment
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    return NextResponse.json(benefits.filter((b) => b.orgId === me.orgId && b.status === "ACTIVE").map((b) => {
        const e = emp ? benefitEnrollments.find((x) => x.benefitId === b.id && x.employeeId === emp.id) : undefined;
        return { ...b, enrollment: e ? { status: e.status, dependents: e.dependents, updatedAt: e.updatedAt } : null, allowsDependents: b.category === "INSURANCE" };
    }));
}

// POST { benefitId, action: enroll | opt_out, dependents? }
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    if (!emp) return bad("No employee profile is linked to your account", 404);
    const b = await body(request);
    const ben = benefits.find((x) => x.id === b.benefitId && x.orgId === me.orgId && x.status === "ACTIVE");
    if (!ben) return bad("Benefit not found", 404);
    if (!["enroll", "opt_out"].includes(b.action)) return bad("action must be enroll or opt_out");
    const deps = (Array.isArray(b.dependents) ? b.dependents : []).map((d: Record<string, string>) => ({ name: String(d.name ?? "").trim(), relation: String(d.relation ?? ""), dob: d.dob || undefined }));
    if (deps.length > 6) return bad("At most 6 dependents");
    if (deps.some((d: { name: string; relation: string }) => !d.name || !RELATIONS.includes(d.relation))) return bad("Each dependent needs a name and a valid relation");
    if (deps.length && ben.category !== "INSURANCE") return bad("Dependents apply to insurance benefits only");
    let e = benefitEnrollments.find((x) => x.benefitId === ben.id && x.employeeId === emp.id);
    const was = e?.status;
    const status = b.action === "enroll" ? "ENROLLED" : "OPTED_OUT";
    if (!e) { e = { id: `benr-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, benefitId: ben.id, employeeId: emp.id, status, dependents: [], updatedAt: "" }; benefitEnrollments.push(e); }
    e.status = status;
    if (status === "ENROLLED") e.dependents = deps;
    e.updatedAt = new Date().toISOString();
    if (was !== status) ben.enrolledCount = Math.max(0, ben.enrolledCount + (status === "ENROLLED" ? 1 : was === "ENROLLED" ? -1 : 0));
    notifyRoles(me.orgId, ["HR_ADMIN"], { title: `Benefit ${status === "ENROLLED" ? "enrollment" : "opt-out"}`, message: `${emp.name}: ${ben.title}${deps.length ? ` (+${deps.length} dependent(s))` : ""}`, link: "/hr/benefits" });
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `BENEFIT_${status}`, entity: "Benefit", entityId: ben.id, detail: `${emp.name}: ${ben.title}` });
    return NextResponse.json(e);
}
