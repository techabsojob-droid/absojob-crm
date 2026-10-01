import { NextResponse } from "next/server";
import { vendors, vendorBills, addAudit } from "@/lib/mock/data";
import { createVendorBill, GSTIN_RE, IFSC_RE, PAN_RE, payVendorBill, refreshBillStatus, runRecurringBills, tdsRateFor } from "@/lib/mock/finance";
import { bad, body, requireFinance, respond } from "@/lib/mock/fin/http";
import type { Vendor } from "@/lib/types";

const CATEGORIES = ["TRAVEL", "SOFTWARE", "RENT", "MARKETING", "JOB_BOARDS", "OFFICE", "UTILITIES", "MEALS", "TRAINING", "OTHER"];

export async function GET() {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    runRecurringBills(me.orgId);
    const bills = vendorBills.filter((b) => b.orgId === me.orgId);
    bills.forEach(refreshBillStatus);
    return NextResponse.json({
        vendors: vendors.filter((v) => v.orgId === me.orgId).map((v) => ({
            ...v, tdsRate: tdsRateFor(v),
            outstanding: bills.filter((b) => b.vendorId === v.id && !["PAID", "CANCELLED"].includes(b.status)).reduce((s, b) => s + b.payable - b.amountPaid, 0),
        })),
        bills: bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    });
}

// POST: { type: "vendor", ... } creates a vendor; otherwise records a vendor bill
export async function POST(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    if (b.type === "vendor") {
        const name = String(b.name ?? "").trim();
        if (!name) return bad("Vendor name is required");
        if (!CATEGORIES.includes(b.category)) return bad("Select a category");
        const gstin = String(b.gstin ?? "").toUpperCase().trim();
        const pan = String(b.pan ?? (gstin ? gstin.slice(2, 12) : "")).toUpperCase().trim();
        const ifsc = String(b.bankIfsc ?? "").toUpperCase().trim();
        if (gstin && !GSTIN_RE.test(gstin)) return bad("GSTIN format is invalid");
        if (pan && !PAN_RE.test(pan)) return bad("PAN format is invalid");
        if (ifsc && !IFSC_RE.test(ifsc)) return bad("IFSC format is invalid");
        if (vendors.some((v) => v.orgId === me.orgId && v.name.toLowerCase() === name.toLowerCase())) return bad("A vendor with this name already exists", 409);
        const v: Vendor = {
            id: `ven-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, name, category: b.category, gstin: gstin || null, pan: pan || null,
            email: b.email || null, phone: b.phone || null, bankName: b.bankName || null, bankAccountNumber: b.bankAccountNumber || null, bankIfsc: ifsc || null,
            tdsSection: ["194C", "194J", "194I", "NONE"].includes(b.tdsSection) ? b.tdsSection : "NONE", paymentTermsDays: Math.max(0, Number(b.paymentTermsDays) || 30),
            active: true, createdAt: new Date().toISOString(),
        };
        vendors.unshift(v);
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "VENDOR_CREATED", entity: "Vendor", entityId: v.id, detail: `${v.name} (${v.tdsSection})` });
        return NextResponse.json(v, { status: 201 });
    }
    return respond(createVendorBill(me, b as Parameters<typeof createVendorBill>[1]), true);
}

// PATCH: approve | pay | cancel a bill · deactivate vendor
export async function PATCH(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    if (b.vendorId && b.action === "deactivate") {
        const v = vendors.find((x) => x.id === b.vendorId && x.orgId === me.orgId);
        if (!v) return bad("Vendor not found", 404);
        v.active = false;
        return NextResponse.json(v);
    }
    const bill = vendorBills.find((x) => x.id === b.id && x.orgId === me.orgId);
    if (!bill) return bad("Bill not found", 404);
    if (b.action === "approve") {
        if (bill.status !== "PENDING_APPROVAL") return bad("Bill is not awaiting approval", 409);
        if (bill.createdByName === me.name && me.role !== "SUPER_ADMIN") return bad("A different person must approve (maker-checker)", 403);
        bill.status = "APPROVED";
        bill.approvedByName = me.name;
        refreshBillStatus(bill);
    } else if (b.action === "pay") {
        return respond(payVendorBill(me, bill, b.amount, b.method ?? "BANK_TRANSFER", b.reference, b.date));
    } else if (b.action === "cancel") {
        if (bill.amountPaid > 0) return bad("Bill has payments and cannot be cancelled", 409);
        bill.status = "CANCELLED";
        bill.recurring = false;
    } else return bad("action must be approve, pay or cancel");
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `VENDOR_BILL_${String(b.action).toUpperCase()}`, entity: "VendorBill", entityId: bill.id, detail: `${bill.vendorName} ${bill.billNumber}` });
    return NextResponse.json(bill);
}
