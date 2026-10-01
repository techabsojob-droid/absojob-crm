import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { payrollRecords, storedFiles, taxDeclarations, addAudit } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { fyOf } from "@/lib/mock/fin/core";
import { declarationFor, istNow, taxProjection } from "@/lib/mock/ess";
import { notifyRoles } from "@/lib/mock/pipeline";
import { bad, body } from "@/lib/mock/fin/http";

const AMOUNTS = ["sec80C", "sec80D", "hraRentPaid", "homeLoanInterest", "nps80CCD1B", "otherDeductions"] as const;
const LIMIT: Record<(typeof AMOUNTS)[number], number> = { sec80C: 150000, sec80D: 100000, hraRentPaid: 5000000, homeLoanInterest: 200000, nps80CCD1B: 50000, otherDeductions: 1000000 };

// GET ?fy= — my declaration, projection under both regimes and Form 16 years available
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    if (!emp) return NextResponse.json({ error: "No employee profile is linked to your account" }, { status: 404 });
    const fy = new URL(request.url).searchParams.get("fy") || fyOf(istNow().date);
    const d = declarationFor(emp.id, fy) ?? null;
    const oldR = taxProjection(emp, "OLD", d);
    const newR = taxProjection(emp, "NEW", d);
    const form16Years = Array.from(new Set(payrollRecords.filter((p) => p.employeeId === emp.id && p.status === "PAID").map((p) => fyOf(`${p.month}-01`)))).sort().reverse();
    return NextResponse.json({
        fy, declaration: d ? { ...d, proofs: d.proofFileIds.map((id) => ({ id, name: storedFiles.find((f) => f.id === id)?.name ?? "proof", url: `/api/files/${id}` })) } : null,
        projection: { OLD: oldR, NEW: newR, recommended: oldR.annualTax < newR.annualTax ? "OLD" : "NEW", saving: Math.abs(oldR.annualTax - newR.annualTax) },
        editable: !d || ["DRAFT", "REJECTED", "SUBMITTED"].includes(d.status),
        form16Years,
    });
}

// PUT { fy, regime, sec80C…, metroCity, proofFileIds, submit } — save draft or submit for verification
export async function PUT(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    if (!emp) return bad("No employee profile is linked to your account", 404);
    const b = await body(request);
    const fy = String(b.fy || fyOf(istNow().date));
    if (!/^\d{4}-\d{2}$/.test(fy)) return bad("Invalid financial year");
    if (fy < fyOf(istNow().date)) return bad("Past financial years are closed");
    if (!["OLD", "NEW"].includes(b.regime)) return bad("Choose the old or new tax regime");
    const vals: Record<string, number> = {};
    for (const k of AMOUNTS) {
        const n = Number(b[k] ?? 0);
        if (!Number.isFinite(n) || n < 0) return bad(`Invalid amount for ${k}`);
        if (n > LIMIT[k]) return bad(`${k} cannot exceed ₹${LIMIT[k].toLocaleString("en-IN")}`);
        vals[k] = Math.round(n);
    }
    const proofs: string[] = Array.isArray(b.proofFileIds) ? b.proofFileIds.map(String) : [];
    if (proofs.some((id) => !storedFiles.some((f) => f.id === id && f.ownerUserId === me.id))) return bad("A proof file was not found — upload it again");
    let d = declarationFor(emp.id, fy);
    if (d?.status === "VERIFIED") return bad("Your declaration is verified and locked — contact HR to change it", 409);
    const now = new Date().toISOString();
    const status = b.submit ? "SUBMITTED" : "DRAFT";
    if (!d) {
        d = { id: `tdec-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, employeeId: emp.id, fy, regime: b.regime, sec80C: 0, sec80D: 0, hraRentPaid: 0, metroCity: false, homeLoanInterest: 0, nps80CCD1B: 0, otherDeductions: 0, proofFileIds: [], status, reviewNote: null, reviewedByName: null, submittedAt: null, updatedAt: now };
        taxDeclarations.push(d);
    }
    Object.assign(d, vals, { regime: b.regime, metroCity: !!b.metroCity, proofFileIds: proofs, status, updatedAt: now, reviewNote: null });
    if (b.submit) {
        d.submittedAt = now;
        notifyRoles(me.orgId, ["HR_ADMIN"], { title: "Tax declaration submitted", message: `${emp.name} (${emp.employeeId}) — ${b.regime} regime, FY ${fy}`, link: "/hr/tax-declarations" });
    }
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: b.submit ? "TAX_DECLARATION_SUBMITTED" : "TAX_DECLARATION_SAVED", entity: "TaxDeclaration", entityId: d.id, detail: `${emp.name} FY ${fy}: ${b.regime} regime` });
    return NextResponse.json({ declaration: d, projection: taxProjection(emp, d.regime, d) });
}
