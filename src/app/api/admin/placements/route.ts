import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { placements, candidates, clients, jobs, users, addAudit } from "@/lib/mock/data";
import { notifyRoles } from "@/lib/mock/pipeline";
import { billingOf, feeForCtc, handlePlacementFallThrough } from "@/lib/mock/finance";
import { missingInvoiceDetails } from "@/lib/invoicing-details";
import type { PlacementRecord } from "@/lib/types";

const clean = (v: unknown, max = 60) => {
    const t = String(v ?? "").trim().slice(0, max);
    return t || null;
};
const employeeTypeOf = (v: unknown) => (v === "FLS" || v === "NFLS" ? v : null);

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "HR_ADMIN", "FINANCE_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const status = url.searchParams.get("status");

    let list = placements.filter((p) => p.orgId === me.orgId);

    if (q) {
        list = list.filter(
            (p) =>
                p.candidateName.toLowerCase().includes(q) ||
                p.clientName.toLowerCase().includes(q) ||
                p.jobTitle.toLowerCase().includes(q) ||
                p.recruiterName.toLowerCase().includes(q)
        );
    }

    if (status && status !== "ALL") {
        list = list.filter((p) => p.joiningStatus === status);
    }

    return NextResponse.json(list.map((p) => ({ ...p, missingInvoiceDetails: missingInvoiceDetails(p) })));
}

export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    try {
        const body = await request.json();
        const candidate = candidates.find((c) => c.id === body.candidateId && c.orgId === me.orgId);
        const job = jobs.find((j) => j.id === body.jobId && j.orgId === me.orgId);
        if (!candidate || !job) {
            return NextResponse.json({ error: "Candidate and job must exist in your organization" }, { status: 400 });
        }
        const client = clients.find((cl) => cl.id === job.clientId && cl.orgId === me.orgId);
        const ctc = Number(body.offeredSalaryLpa);
        if (!(ctc > 0 && ctc <= 500)) return NextResponse.json({ error: "Enter the offered CTC in LPA" }, { status: 400 });
        if (placements.some((p) => p.orgId === me.orgId && p.candidateId === candidate.id && p.jobId === job.id)) {
            return NextResponse.json({ error: "A placement already exists for this candidate and job" }, { status: 409 });
        }

        const newPlacement: PlacementRecord = {
            id: `plc-${crypto.randomUUID().slice(0, 8)}`,
            orgId: me.orgId,
            candidateId: candidate.id,
            candidateName: candidate.name,
            clientId: job.clientId,
            clientName: client?.companyName ?? "—",
            jobId: job.id,
            jobTitle: job.title,
            recruiterId: me.id,
            recruiterName: me.name,
            accountManagerName: users.find((u) => u.id === client?.accountManagerId)?.name,
            placementDate: new Date().toISOString().split("T")[0],
            offeredPosition: body.offeredPosition ?? job?.title ?? "Position",
            offeredSalaryLpa: ctc,
            joiningDate: body.joiningDate ?? new Date().toISOString().split("T")[0],
            joiningStatus: body.joiningStatus ?? "JOINING_PENDING",
            // Fee from the client's billing terms (or the default fee in Settings)
            revenueInr: Number(body.revenueInr) || feeForCtc(client, ctc, me.orgId).fee,
            invoiceId: null,
            invoiceNumber: null,
            guaranteePeriodDays: client ? billingOf(client).guaranteeDays : 90,
            guaranteeEndDate: new Date(new Date(body.joiningDate ?? Date.now()).getTime() + (client ? billingOf(client).guaranteeDays : 90) * 86400000).toISOString().split("T")[0],
            replacementStatus: "NO_REPLACEMENT",
            notes: body.notes ?? null,
            employeeCode: clean(body.employeeCode),
            workLocation: clean(body.workLocation, 120) ?? job.location ?? null,
            grade: clean(body.grade),
            employeeType: employeeTypeOf(body.employeeType),
            createdAt: new Date().toISOString(),
        };

        placements.unshift(newPlacement);
        return NextResponse.json(newPlacement, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create placement" }, { status: 400 });
    }
}

export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "FINANCE_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, joiningStatus, replacementStatus, notes, invoiceDetails } = await request.json();
    const item = placements.find((p) => p.id === id && p.orgId === me.orgId);
    if (!item) return NextResponse.json({ error: "Placement not found" }, { status: 404 });

    // Candidate information for invoicing (recruitment managers and finance)
    if (invoiceDetails && typeof invoiceDetails === "object") {
        const d = invoiceDetails as Record<string, unknown>;
        const billed = !!(item.invoiceId || item.invoiceNumber);
        const changes: string[] = [];
        const setText = (k: "employeeCode" | "workLocation" | "grade", max = 60) => {
            if (d[k] === undefined) return;
            const v = clean(d[k], max);
            if (v !== (item[k] ?? null)) { item[k] = v; changes.push(k); }
        };
        setText("employeeCode"); setText("workLocation", 120); setText("grade");
        if (d.employeeType !== undefined) {
            if (d.employeeType && !employeeTypeOf(d.employeeType)) return NextResponse.json({ error: "Employee type must be FLS or NFLS" }, { status: 400 });
            const v = employeeTypeOf(d.employeeType);
            if (v !== (item.employeeType ?? null)) { item.employeeType = v; changes.push("employeeType"); }
        }
        // Joining date, designation and CTC drive the fee, so they're fixed once invoiced
        // Older records keep a full timestamp as the joining date, so compare the date part only
        const same = (k: string) => k === "joiningDate"
            ? String(d[k]).slice(0, 10) === String(item.joiningDate ?? "").slice(0, 10)
            : k === "offeredSalaryLpa" ? Number(d[k]) === Number(item.offeredSalaryLpa) : String(d[k]).trim() === String(item.offeredPosition ?? "").trim();
        const core = ["joiningDate", "offeredPosition", "offeredSalaryLpa"].filter((k) => d[k] !== undefined && !same(k));
        if (core.length && billed) return NextResponse.json({ error: `Already invoiced (${item.invoiceNumber}) — date of joining, designation and CTC can't change. Raise a credit / debit note instead.` }, { status: 409 });
        if (d.joiningDate !== undefined && !same("joiningDate")) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.joiningDate))) return NextResponse.json({ error: "Date of joining must be a valid date" }, { status: 400 });
            item.joiningDate = String(d.joiningDate);
            item.guaranteeEndDate = new Date(Date.parse(item.joiningDate) + item.guaranteePeriodDays * 86400000).toISOString().slice(0, 10);
            changes.push("joiningDate");
        }
        if (d.offeredPosition !== undefined) {
            const v = clean(d.offeredPosition, 120);
            if (!v) return NextResponse.json({ error: "Designation is required" }, { status: 400 });
            if (v !== item.offeredPosition) { item.offeredPosition = v; changes.push("designation"); }
        }
        if (d.offeredSalaryLpa !== undefined && Number(d.offeredSalaryLpa) !== item.offeredSalaryLpa) {
            const ctc = Number(d.offeredSalaryLpa);
            if (!(ctc > 0 && ctc <= 500)) return NextResponse.json({ error: "CTC must be in lakhs per annum (LPA), between 0 and 500" }, { status: 400 });
            item.offeredSalaryLpa = ctc;
            item.revenueInr = feeForCtc(clients.find((c) => c.id === item.clientId && c.orgId === me.orgId), ctc, me.orgId).fee;
            changes.push("CTC");
        }
        if (changes.length) {
            addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "PLACEMENT_INVOICE_DETAILS", entity: "Placement", entityId: item.id, detail: `${item.candidateName}: updated ${changes.join(", ")}` });
        }
        return NextResponse.json({ ...item, missingInvoiceDetails: missingInvoiceDetails(item) });
    }
    if (me.role === "FINANCE_ADMIN") return NextResponse.json({ error: "Finance can update invoicing details only" }, { status: 403 });

    const before = `${item.joiningStatus}/${item.replacementStatus}`;
    if (joiningStatus) item.joiningStatus = joiningStatus;
    if (replacementStatus) item.replacementStatus = replacementStatus;
    if (notes !== undefined) item.notes = notes;

    // A billed placement that falls through inside the guarantee window needs a credit note
    const fellThrough = ["NO_SHOW", "CANCELLED"].includes(item.joiningStatus) || item.replacementStatus === "REPLACEMENT_REQUESTED";
    if (fellThrough && before !== `${item.joiningStatus}/${item.replacementStatus}`) {
        handlePlacementFallThrough(me, item);
    }
    if ((item.invoiceId || item.invoiceNumber) && fellThrough && before !== `${item.joiningStatus}/${item.replacementStatus}`) {
        notifyRoles(me.orgId, ["FINANCE_ADMIN"], {
            title: "Billed placement at risk",
            message: `${item.candidateName} @ ${item.clientName} is ${item.joiningStatus === "JOINED" ? "being replaced" : item.joiningStatus.toLowerCase().replace("_", " ")} — review invoice ${item.invoiceNumber} for a credit note`,
            link: "/finance/billing",
        });
    }
    // Newly joined and not yet billed → Finance bills it
    if (joiningStatus === "JOINED" && !item.invoiceId && !item.invoiceNumber) {
        notifyRoles(me.orgId, ["FINANCE_ADMIN"], { title: "Placement ready to bill", message: `${item.candidateName} joined ${item.jobTitle} (${item.clientName})`, link: "/finance/billing" });
    }
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "PLACEMENT_UPDATED", entity: "Placement", entityId: item.id, detail: `${item.candidateName}: ${before} → ${item.joiningStatus}/${item.replacementStatus}` });

    return NextResponse.json({ ...item, missingInvoiceDetails: missingInvoiceDetails(item) });
}
