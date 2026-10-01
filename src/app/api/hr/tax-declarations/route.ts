import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { employees, storedFiles, taxDeclarations, addAudit, addNotification } from "@/lib/mock/data";
import { taxProjection } from "@/lib/mock/ess";
import { bad, body } from "@/lib/mock/fin/http";

const REVIEWERS = ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"] as const;

// GET ?fy=&status= — declarations to verify, with projected tax
export async function GET(request: Request) {
    const auth = await requireRole(...REVIEWERS);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const sp = new URL(request.url).searchParams;
    const list = taxDeclarations
        .filter((d) => d.orgId === me.orgId && (!sp.get("fy") || d.fy === sp.get("fy")) && (!sp.get("status") || sp.get("status") === "ALL" || d.status === sp.get("status")))
        .map((d) => {
            const emp = employees.find((e) => e.id === d.employeeId);
            return { ...d, employeeName: emp?.name ?? "—", employeeCode: emp?.employeeId ?? "—", projection: emp ? taxProjection(emp, d.regime, d) : null, proofs: d.proofFileIds.map((id) => ({ id, name: storedFiles.find((f) => f.id === id)?.name ?? "proof", url: `/api/files/${id}` })) };
        })
        .sort((a, b) => Number(b.status === "SUBMITTED") - Number(a.status === "SUBMITTED") || b.updatedAt.localeCompare(a.updatedAt));
    return NextResponse.json(list);
}

// PATCH { id, action: verify | reject, note }
export async function PATCH(request: Request) {
    const auth = await requireRole(...REVIEWERS);
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const d = taxDeclarations.find((x) => x.id === b.id && x.orgId === me.orgId);
    if (!d) return bad("Declaration not found", 404);
    if (d.status !== "SUBMITTED") return bad(`Only submitted declarations can be reviewed (this one is ${d.status.toLowerCase()})`, 409);
    if (!["verify", "reject"].includes(b.action)) return bad("action must be verify or reject");
    if (b.action === "reject" && !String(b.note ?? "").trim()) return bad("Tell the employee what to fix");
    d.status = b.action === "verify" ? "VERIFIED" : "REJECTED";
    d.reviewNote = String(b.note ?? "").trim() || null;
    d.reviewedByName = me.name;
    d.updatedAt = new Date().toISOString();
    const emp = employees.find((e) => e.id === d.employeeId);
    if (emp?.userId) addNotification({ orgId: me.orgId, userId: emp.userId, title: `Tax declaration ${d.status.toLowerCase()}`, message: d.status === "VERIFIED" ? `FY ${d.fy} declaration verified — TDS now uses it` : `FY ${d.fy}: ${d.reviewNote}`, link: "/portal/tax" });
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `TAX_DECLARATION_${d.status}`, entity: "TaxDeclaration", entityId: d.id, detail: `${emp?.name ?? d.employeeId} FY ${d.fy}${d.reviewNote ? ` — ${d.reviewNote}` : ""}` });
    return NextResponse.json(d);
}
