import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { assets, documents, employees, users, addAudit } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { shiftFor } from "@/lib/mock/ess";

// Self-service profile: the signed-in user's own HR record, documents and assets
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const emp = employeeForUser(me.id);
    const manager = emp?.reportingManagerId ? employees.find((e) => e.id === emp.reportingManagerId) : undefined;
    const reports = emp ? employees.filter((e) => e.reportingManagerId === emp.id && e.status !== "EXITED").map((e) => ({ id: e.id, name: e.name, designation: e.designation })) : [];

    return NextResponse.json({
        user: { id: me.id, name: me.name, email: me.email, phone: me.phone, role: me.role, department: me.department, designation: me.designation, location: me.location, joinedAt: me.joinedAt },
        employee: emp
            ? {
                ...emp,
                // Only show the last 4 digits of bank details, even to the owner
                bankDetails: emp.bankDetails
                    ? { ...emp.bankDetails, accountNumber: emp.bankDetails.accountNumber ? `XXXX${emp.bankDetails.accountNumber.slice(-4)}` : "", panNumber: emp.bankDetails.panNumber ? `XXXXX${emp.bankDetails.panNumber.slice(-5)}` : "" }
                    : undefined,
            }
            : null,
        managerName: manager?.name ?? users.find((u) => u.id === me.reportingTo)?.name ?? null,
        directReports: reports,
        documents: emp ? documents.filter((d) => d.orgId === me.orgId && (d.employeeId === emp.id || d.category === "POLICY")) : documents.filter((d) => d.orgId === me.orgId && d.category === "POLICY"),
        assets: emp ? assets.filter((a) => a.assignedEmployeeId === emp.id && a.status === "ASSIGNED") : [],
        shift: emp ? shiftFor(emp, me.orgId) : null,
    });
}

// PATCH — self-service personal details (identity, bank and name changes go through HR requests)
const TEXT = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    if (!emp) return NextResponse.json({ error: "No employee profile is linked to your account" }, { status: 404 });
    let b: Record<string, unknown>;
    try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const changed: string[] = [];
    if (b.phone !== undefined) {
        const phone = TEXT(b.phone, 20);
        if (phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });
        if (phone !== emp.phone) { emp.phone = phone; me.phone = phone; changed.push("phone"); }
    }
    if (b.personalEmail !== undefined) {
        const pe = TEXT(b.personalEmail, 120);
        if (pe && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pe)) return NextResponse.json({ error: "Enter a valid personal email" }, { status: 400 });
        emp.personalEmail = pe || null; changed.push("personal email");
    }
    const pd = (b.personalDetails ?? {}) as Record<string, unknown>;
    const allowedPd = ["maritalStatus", "bloodGroup", "currentAddress", "permanentAddress"] as const;
    if (Object.keys(pd).some((k) => !allowedPd.includes(k as (typeof allowedPd)[number]))) return NextResponse.json({ error: "Date of birth and legal details are changed by HR — raise a request" }, { status: 400 });
    if (Object.keys(pd).length) {
        if (pd.bloodGroup && !/^(A|B|AB|O)[+-]$/.test(String(pd.bloodGroup))) return NextResponse.json({ error: "Invalid blood group" }, { status: 400 });
        emp.personalDetails = { ...emp.personalDetails, ...Object.fromEntries(allowedPd.filter((k) => pd[k] !== undefined).map((k) => [k, TEXT(pd[k])])) };
        changed.push("personal details");
    }
    if (b.emergencyContact !== undefined) {
        const ec = b.emergencyContact as Record<string, unknown>;
        const name = TEXT(ec?.name, 80), phone = TEXT(ec?.phone, 20), relationship = TEXT(ec?.relationship, 40);
        if (!name || phone.replace(/\D/g, "").length < 10 || !relationship) return NextResponse.json({ error: "Emergency contact needs a name, relationship and valid phone" }, { status: 400 });
        emp.emergencyContact = { name, phone, relationship }; changed.push("emergency contact");
    }
    if (!changed.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    emp.updatedAt = new Date().toISOString();
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "PROFILE_SELF_UPDATED", entity: "Employee", entityId: emp.id, detail: `${emp.name} updated ${changed.join(", ")}` });
    return NextResponse.json({ success: true, changed });
}
