import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    probationRecords, promotions, transfers, salaryRevisions,
    employees, addAudit, addNotification
} from "@/lib/mock/data";

// GET /api/hr/lifecycle
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") || "all";

    // Pay figures are for Super Admin and HR only
    const pay = me.role === "SUPER_ADMIN" || me.role === "HR_ADMIN";
    return NextResponse.json({
        probation: probationRecords.filter((p) => p.orgId === me.orgId),
        promotions: promotions.filter((p) => p.orgId === me.orgId).map((p) => (pay ? p : { ...p, currentCtcLpa: null, newCtcLpa: null })),
        transfers: transfers.filter((t) => t.orgId === me.orgId),
        salaryRevisions: pay ? salaryRevisions.filter((s) => s.orgId === me.orgId) : [],
    });
}

// POST /api/hr/lifecycle (Create new lifecycle action: promotion, transfer, etc.)
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const { type } = body; // "PROMOTION" | "TRANSFER" | "SALARY_REVISION" | "PROBATION_REVIEW"

        if (type === "PROMOTION") {
            const { employeeId, newDesignation, newDepartment, newCtcLpa, effectiveDate, reason } = body;
            const emp = employees.find((e) => e.id === employeeId);
            if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

            const newPromo = {
                id: `prm-${String(promotions.length + 1).padStart(3, "0")}`,
                orgId: me.orgId,
                employeeId,
                employeeName: emp.name,
                currentDesignation: emp.designation,
                newDesignation,
                currentDepartment: emp.department,
                newDepartment: newDepartment || emp.department,
                currentCtcLpa: 12.0,
                newCtcLpa: Number(newCtcLpa),
                effectiveDate,
                reason,
                status: "PENDING" as const,
                requestedByName: me.name,
                approvedByName: null,
            };

            promotions.unshift(newPromo);

            addAudit({
                orgId: me.orgId,
                actorUserId: me.id,
                actorRole: me.role,
                action: "PROMOTION_REQUESTED" as any,
                entity: "Employee" as any,
                entityId: employeeId,
                detail: `Proposed promotion for ${emp.name} to ${newDesignation} (₹${newCtcLpa} LPA)`,
            });

            return NextResponse.json(newPromo, { status: 201 });
        }

        if (type === "TRANSFER") {
            const { employeeId, toDepartment, toLocation, toManager, effectiveDate, reason } = body;
            const emp = employees.find((e) => e.id === employeeId);
            if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

            const newTransfer = {
                id: `trf-${String(transfers.length + 1).padStart(3, "0")}`,
                orgId: me.orgId,
                employeeId,
                employeeName: emp.name,
                fromDepartment: emp.department,
                toDepartment,
                fromLocation: emp.location || "Mumbai - HQ",
                toLocation,
                fromManager: emp.reportingManagerName || "Aarav Mehta",
                toManager,
                effectiveDate,
                reason,
                status: "PENDING" as const,
            };

            transfers.unshift(newTransfer);

            addAudit({
                orgId: me.orgId,
                actorUserId: me.id,
                actorRole: me.role,
                action: "TRANSFER_REQUESTED" as any,
                entity: "Employee" as any,
                entityId: employeeId,
                detail: `Requested transfer for ${emp.name} to ${toDepartment} (${toLocation})`,
            });

            return NextResponse.json(newTransfer, { status: 201 });
        }

        if (type === "SALARY_REVISION") {
            const { employeeId, currentCtc, newCtc, incrementPercent, revisionType, effectiveDate, reason } = body;
            const emp = employees.find((e) => e.id === employeeId);
            if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

            const newRev = {
                id: `srev-${String(salaryRevisions.length + 1).padStart(3, "0")}`,
                orgId: me.orgId,
                employeeId,
                employeeName: emp.name,
                currentCtc: Number(currentCtc),
                newCtc: Number(newCtc),
                incrementPercent: Number(incrementPercent),
                revisionType: revisionType || "ANNUAL_INCREMENT",
                effectiveDate,
                reason,
                status: "PENDING" as const,
                requestedByName: me.name,
            };

            salaryRevisions.unshift(newRev);

            addAudit({
                orgId: me.orgId,
                actorUserId: me.id,
                actorRole: me.role,
                action: "SALARY_REVISION_REQUESTED" as any,
                entity: "Employee" as any,
                entityId: employeeId,
                detail: `Salary revision for ${emp.name}: ₹${currentCtc} → ₹${newCtc} (${incrementPercent}%)`,
            });

            return NextResponse.json(newRev, { status: 201 });
        }

        return NextResponse.json({ error: "Invalid lifecycle action type" }, { status: 400 });
    } catch {
        return NextResponse.json({ error: "Failed to process lifecycle request" }, { status: 500 });
    }
}

// PATCH /api/hr/lifecycle (Approve, reject, or apply confirmation/promotion/transfer/revision)
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const { kind, id, action, decisionReason } = body;
        // kind: "PROMOTION" | "TRANSFER" | "PROBATION" | "SALARY_REVISION"
        // action: "APPROVE" | "REJECT" | "CONFIRM" | "EXTEND"

        if (kind === "PROBATION") {
            const rec = probationRecords.find((p) => p.id === id && p.orgId === me.orgId);
            if (!rec) return NextResponse.json({ error: "Probation record not found" }, { status: 404 });

            if (action === "CONFIRM") {
                rec.status = "CONFIRMED";
                rec.actualEndDate = new Date().toISOString().split("T")[0];
                if (decisionReason) rec.decisionReason = decisionReason;

                // Update employee status if needed
                const emp = employees.find((e) => e.id === rec.employeeId);
                if (emp) emp.status = "ACTIVE";

                addAudit({
                    orgId: me.orgId,
                    actorUserId: me.id,
                    actorRole: me.role,
                    action: "PROBATION_CONFIRMED" as any,
                    entity: "Employee" as any,
                    entityId: rec.employeeId,
                    detail: `Confirmed employee ${rec.employeeName} following probation review.`,
                });
            } else if (action === "EXTEND") {
                rec.status = "EXTENDED";
                rec.probationMonths += 3;
                if (decisionReason) rec.decisionReason = decisionReason;

                addAudit({
                    orgId: me.orgId,
                    actorUserId: me.id,
                    actorRole: me.role,
                    action: "PROBATION_EXTENDED" as any,
                    entity: "Employee" as any,
                    entityId: rec.employeeId,
                    detail: `Extended probation for ${rec.employeeName} by 3 months.`,
                });
            }

            return NextResponse.json(rec);
        }

        if (kind === "PROMOTION") {
            const promo = promotions.find((p) => p.id === id && p.orgId === me.orgId);
            if (!promo) return NextResponse.json({ error: "Promotion record not found" }, { status: 404 });

            if (action === "APPROVE" || action === "APPLY") {
                promo.status = "APPLIED";
                promo.approvedByName = me.name;

                // Auto update employee designation
                const emp = employees.find((e) => e.id === promo.employeeId);
                if (emp) {
                    emp.designation = promo.newDesignation;
                    if (promo.newDepartment) emp.department = promo.newDepartment;
                }

                addAudit({
                    orgId: me.orgId,
                    actorUserId: me.id,
                    actorRole: me.role,
                    action: "PROMOTION_APPLIED" as any,
                    entity: "Employee" as any,
                    entityId: promo.employeeId,
                    detail: `Applied promotion for ${promo.employeeName} to ${promo.newDesignation}`,
                });
            } else if (action === "REJECT") {
                promo.status = "REJECTED";
            }

            return NextResponse.json(promo);
        }

        if (kind === "TRANSFER") {
            const trf = transfers.find((t) => t.id === id && t.orgId === me.orgId);
            if (!trf) return NextResponse.json({ error: "Transfer record not found" }, { status: 404 });

            if (action === "APPROVE") {
                trf.status = "COMPLETED";

                // Update employee department & location
                const emp = employees.find((e) => e.id === trf.employeeId);
                if (emp) {
                    emp.department = trf.toDepartment;
                    emp.location = trf.toLocation;
                    emp.reportingManagerName = trf.toManager;
                }

                addAudit({
                    orgId: me.orgId,
                    actorUserId: me.id,
                    actorRole: me.role,
                    action: "TRANSFER_COMPLETED" as any,
                    entity: "Employee" as any,
                    entityId: trf.employeeId,
                    detail: `Transferred ${trf.employeeName} to ${trf.toDepartment} (${trf.toLocation})`,
                });
            } else if (action === "REJECT") {
                trf.status = "REJECTED";
            }

            return NextResponse.json(trf);
        }

        if (kind === "SALARY_REVISION") {
            const rev = salaryRevisions.find((s) => s.id === id && s.orgId === me.orgId);
            if (!rev) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

            if (action === "APPROVE" || action === "PROCESS") {
                rev.status = "PROCESSED";

                addAudit({
                    orgId: me.orgId,
                    actorUserId: me.id,
                    actorRole: me.role,
                    action: "SALARY_REVISED" as any,
                    entity: "Employee" as any,
                    entityId: rev.employeeId,
                    detail: `Applied salary revision for ${rev.employeeName}: new CTC ₹${rev.newCtc}`,
                });
            } else if (action === "REJECT") {
                rev.status = "REJECTED";
            }

            return NextResponse.json(rev);
        }

        return NextResponse.json({ error: "Invalid lifecycle patch request" }, { status: 400 });
    } catch {
        return NextResponse.json({ error: "Failed to update lifecycle record" }, { status: 500 });
    }
}
