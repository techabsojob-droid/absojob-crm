import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { expenses, addAudit, addNotification } from "@/lib/mock/data";
import { canManagerApprove, clientById, findFile, fileUrl, initialExpenseStatus, isFinance, periodLockError, policyFlagFor } from "@/lib/mock/finance";
import { approversFor } from "@/lib/mock/identity";
import { notifyRoles } from "@/lib/mock/pipeline";
import { bad, body } from "@/lib/mock/fin/http";
import type { Expense, ExpenseCategory } from "@/lib/types";

const CATEGORIES: ExpenseCategory[] = ["TRAVEL", "SOFTWARE", "RENT", "MARKETING", "JOB_BOARDS", "OFFICE", "UTILITIES", "MEALS", "TRAINING", "OTHER"];

// GET: Finance sees all; managers also see their team's claims awaiting them (?team=1); everyone sees their own
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const mine = url.searchParams.get("mine") === "1";
    const team = url.searchParams.get("team") === "1";

    let list = expenses.filter((e) => e.orgId === me.orgId);
    if (team) list = list.filter((e) => canManagerApprove(me, e));
    else if (!isFinance(me) || mine) list = list.filter((e) => e.submittedById === me.id);
    if (status && status !== "ALL") list = list.filter((e) => e.status === status);
    return NextResponse.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((e) => ({ ...e, clientName: e.clientId ? clientById(me.orgId, e.clientId)?.companyName ?? null : null })));
}

// POST: staff claim a reimbursement; Finance records company bills paid directly
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);

    const amount = Math.round(Number(b.amount) || 0);
    const gstAmount = Math.max(0, Math.round(Number(b.gstAmount) || 0));
    const description = String(b.description ?? "").trim();
    if (!CATEGORIES.includes(b.category) || !description || amount <= 0) return bad("category, description and a positive amount are required");
    if (gstAmount >= amount) return bad("GST cannot be more than the amount");
    const expenseDate = b.expenseDate || new Date().toISOString().split("T")[0];
    if (expenseDate > new Date().toISOString().split("T")[0]) return bad("Expense date cannot be in the future");
    const lock = periodLockError(me.orgId, expenseDate);
    if (lock) return bad(lock, 423);
    if (b.receiptFileId && !findFile(me.orgId, b.receiptFileId)) return bad("Attached receipt not found");
    if (b.billable && !clientById(me.orgId, b.clientId)) return bad("Select the client to re-bill");
    const companyBill = isFinance(me) && b.isReimbursement === false;

    const exp: Expense = {
        id: `exp-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, category: b.category, description, amount, gstAmount,
        vendor: b.vendor || null, expenseDate, isReimbursement: !companyBill, submittedById: me.id, submittedByName: me.name,
        receiptUrl: b.receiptFileId ? fileUrl(b.receiptFileId) : b.receiptUrl || null, receiptFileId: b.receiptFileId || null,
        billable: !!b.billable, clientId: b.billable ? b.clientId : null, rebilledInvoiceId: null,
        policyFlag: policyFlagFor(me.orgId, b.category, amount),
        status: initialExpenseStatus(me.orgId, me.id, !companyBill),
        managerApprovedByName: null, approvedByName: null, approvedAt: null, rejectionReason: null, paidAt: null, paymentReference: null,
        createdAt: new Date().toISOString(),
    };
    expenses.unshift(exp);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: exp.isReimbursement ? "REIMBURSEMENT_CLAIMED" : "EXPENSE_RECORDED", entity: "Expense", entityId: exp.id, detail: `${exp.category} ₹${amount} — ${description}${exp.policyFlag ? ` [${exp.policyFlag}]` : ""}` });
    if (exp.status === "PENDING_MANAGER") {
        const mgr = approversFor(me.id).managerUserId;
        if (mgr) addNotification({ orgId: me.orgId, userId: mgr, title: "Expense claim to approve", message: `${me.name}: ₹${amount.toLocaleString("en-IN")} · ${description}`, link: "/portal/expenses" });
    } else if (exp.isReimbursement) {
        notifyRoles(me.orgId, ["FINANCE_ADMIN"], { title: "Reimbursement claim", message: `${me.name}: ₹${amount.toLocaleString("en-IN")} · ${description}`, link: "/finance/expenses" });
    }
    return NextResponse.json(exp, { status: 201 });
}

// PATCH: manager_approve / manager_reject (reporting manager) · approve / reject / pay (Finance)
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id, action, reason, reference } = await body(request);
    const exp = expenses.find((e) => e.id === id && e.orgId === me.orgId);
    if (!exp) return bad("Expense not found", 404);
    const now = new Date().toISOString();

    if (action === "manager_approve" || action === "manager_reject") {
        if (!canManagerApprove(me, exp)) return bad("Only the claimant's reporting manager can do this", 403);
        if (action === "manager_reject" && !String(reason ?? "").trim()) return bad("A reason is required");
        exp.status = action === "manager_approve" ? "PENDING" : "REJECTED";
        exp.managerApprovedByName = me.name;
        if (action === "manager_reject") exp.rejectionReason = String(reason).trim();
        if (exp.status === "PENDING") notifyRoles(me.orgId, ["FINANCE_ADMIN"], { title: "Reimbursement claim", message: `${exp.submittedByName}: ₹${exp.amount.toLocaleString("en-IN")} · ${exp.description} (manager approved)`, link: "/finance/expenses" });
    } else {
        if (!isFinance(me)) return bad("Forbidden", 403);
        if (action === "approve" || action === "reject") {
            if (exp.status !== "PENDING") return bad(exp.status === "PENDING_MANAGER" ? "Waiting for the manager's approval first" : `Already ${exp.status.toLowerCase()}`, 409);
            if (exp.submittedById === me.id && me.role !== "SUPER_ADMIN") return bad("You cannot approve your own expense", 403);
            if (action === "approve" && exp.policyFlag && me.role !== "SUPER_ADMIN") return bad(`${exp.policyFlag} — needs Super Admin approval`, 403);
            if (action === "reject" && !String(reason ?? "").trim()) return bad("A reason is required");
            exp.status = action === "approve" ? "APPROVED" : "REJECTED";
            exp.approvedByName = me.name;
            exp.approvedAt = now;
            exp.rejectionReason = action === "reject" ? String(reason).trim() : null;
        } else if (action === "pay") {
            if (exp.status !== "APPROVED") return bad("Only approved expenses can be paid", 409);
            const lock = periodLockError(me.orgId, now);
            if (lock) return bad(lock, 423);
            exp.status = "PAID";
            exp.paidAt = now;
            exp.paymentReference = reference || null;
        } else return bad("Unknown action");
    }

    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `EXPENSE_${String(action).toUpperCase()}`, entity: "Expense", entityId: exp.id, detail: `${exp.submittedByName}: ₹${exp.amount} ${exp.description}${reason ? ` — ${reason}` : ""}` });
    if (exp.isReimbursement && exp.submittedById !== me.id) {
        addNotification({
            orgId: me.orgId, userId: exp.submittedById,
            title: exp.status === "PAID" ? "Reimbursement paid 💸" : exp.status === "PENDING" ? "Claim approved by manager" : `Reimbursement ${exp.status.toLowerCase()}`,
            message: `₹${exp.amount.toLocaleString("en-IN")} · ${exp.description}${exp.rejectionReason ? ` — ${exp.rejectionReason}` : ""}`,
            link: "/portal/expenses",
        });
    }
    return NextResponse.json(exp);
}
