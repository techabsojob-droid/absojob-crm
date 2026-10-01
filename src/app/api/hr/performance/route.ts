import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { performanceReviews, employees, promotions, addAudit, addNotification } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { notifyRoles } from "@/lib/mock/pipeline";
import type { PerformanceReview, User } from "@/lib/types";

const isHR = (role: string) => role === "SUPER_ADMIN" || role === "HR_ADMIN";

/** HR, or the reviewee's reporting manager, may give the manager review. */
function isReviewer(me: User, review: PerformanceReview): boolean {
    if (isHR(me.role)) return true;
    const emp = employees.find((e) => e.id === review.employeeId);
    const myEmp = employeeForUser(me.id);
    return !!emp && !!myEmp && emp.reportingManagerId === myEmp.id;
}

// GET: HR sees all; managers see their team; everyone sees their own
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const cycle = url.searchParams.get("cycle");
    const q = url.searchParams.get("q")?.toLowerCase();
    const mine = url.searchParams.get("mine") === "1";
    const myEmp = employeeForUser(me.id);

    let list = performanceReviews.filter((p) => p.orgId === me.orgId);
    if (mine) {
        list = myEmp ? list.filter((p) => p.employeeId === myEmp.id) : [];
    } else if (!isHR(me.role)) {
        list = list.filter((p) => (myEmp && p.employeeId === myEmp.id) || isReviewer(me, p));
    }
    if (cycle && cycle !== "ALL") list = list.filter((p) => p.reviewCycle === cycle);
    if (q) list = list.filter((p) => p.employeeName.toLowerCase().includes(q) || p.department.toLowerCase().includes(q));

    return NextResponse.json(list);
}

// POST: HR starts a review for an employee with goals
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const emp = employees.find((e) => e.id === body.employeeId && e.orgId === me.orgId && e.status !== "EXITED");
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 400 });
    const reviewCycle = String(body.reviewCycle ?? "").trim();
    if (!reviewCycle) return NextResponse.json({ error: "Review cycle is required" }, { status: 400 });
    if (performanceReviews.some((p) => p.employeeId === emp.id && p.reviewCycle === reviewCycle)) {
        return NextResponse.json({ error: `A ${reviewCycle} review already exists for ${emp.name}` }, { status: 409 });
    }
    const goals = (Array.isArray(body.goals) ? body.goals : [])
        .map((g: { title?: string; weightage?: number } | string) => (typeof g === "string" ? { title: g } : g))
        .filter((g: { title?: string }) => String(g.title ?? "").trim());
    const weight = goals.length ? Math.round(100 / goals.length) : 0;

    const review: PerformanceReview = {
        id: `perf-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        reviewCycle,
        goals: goals.map((g: { title: string; weightage?: number }, i: number) => ({ id: `g-${i + 1}`, title: g.title.trim(), description: "", progress: 0, weightage: g.weightage ?? weight })),
        managerFeedback: null,
        employeeFeedback: null,
        rating: null,
        status: "GOALS_SET",
        promotionRecommended: false,
        incrementPercent: null,
        updatedAt: new Date().toISOString(),
    };
    performanceReviews.unshift(review);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "REVIEW_CREATED", entity: "PerformanceReview", entityId: review.id, detail: `${emp.name} · ${reviewCycle} · ${review.goals.length} goal(s)` });
    if (emp.userId) addNotification({ orgId: me.orgId, userId: emp.userId, title: "Goals set for your review", message: `${reviewCycle}: ${review.goals.length} goal(s). Submit your self review in My Performance.`, link: "/portal/performance" });
    return NextResponse.json(review, { status: 201 });
}

// PATCH: self review (employee) → manager review (manager/HR) → completed
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const review = performanceReviews.find((p) => p.id === body.id && p.orgId === me.orgId);
    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    const emp = employees.find((e) => e.id === review.employeeId);
    const myEmp = employeeForUser(me.id);
    const now = new Date().toISOString();

    if (body.action === "self_review") {
        if (!myEmp || myEmp.id !== review.employeeId) return NextResponse.json({ error: "Only the employee can submit their self review" }, { status: 403 });
        if (!["GOALS_SET", "SELF_REVIEW"].includes(review.status)) return NextResponse.json({ error: "Self review is closed" }, { status: 409 });
        if (!String(body.employeeFeedback ?? "").trim()) return NextResponse.json({ error: "Self review comments are required" }, { status: 400 });
        review.employeeFeedback = String(body.employeeFeedback).trim();
        if (Array.isArray(body.goalProgress)) {
            body.goalProgress.forEach((gp: { id: string; progress: number }) => {
                const g = review.goals.find((x) => x.id === gp.id);
                if (g) g.progress = Math.min(100, Math.max(0, Number(gp.progress) || 0));
            });
        }
        review.status = "MANAGER_REVIEW";
        review.updatedAt = now;
        const managerUserId = emp?.reportingManagerId ? employees.find((e) => e.id === emp.reportingManagerId)?.userId : null;
        if (managerUserId) addNotification({ orgId: me.orgId, userId: managerUserId, title: "Review awaiting your feedback", message: `${review.employeeName} · ${review.reviewCycle}`, link: "/portal/performance" });
        notifyRoles(me.orgId, ["HR_ADMIN"], { title: "Self review submitted", message: `${review.employeeName} · ${review.reviewCycle}`, link: "/hr/performance" });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "SELF_REVIEW_SUBMITTED", entity: "PerformanceReview", entityId: review.id, detail: `${review.employeeName} · ${review.reviewCycle}` });
        return NextResponse.json(review);
    }

    if (body.action === "manager_review") {
        if (!isReviewer(me, review) || myEmp?.id === review.employeeId) return NextResponse.json({ error: "Only HR or the reporting manager can review" }, { status: 403 });
        if (review.status === "COMPLETED") return NextResponse.json({ error: "Review is already completed" }, { status: 409 });
        const rating = Number(body.rating);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
        if (!String(body.managerFeedback ?? "").trim()) return NextResponse.json({ error: "Manager feedback is required" }, { status: 400 });
        review.managerFeedback = String(body.managerFeedback).trim();
        review.rating = rating;
        review.incrementPercent = body.incrementPercent != null ? Number(body.incrementPercent) : null;
        review.promotionRecommended = !!body.promotionRecommended;
        review.status = "COMPLETED";
        review.updatedAt = now;

        // A recommended promotion becomes an HR approval request (applied to the employee on approval)
        if (review.promotionRecommended && emp && body.newDesignation) {
            const currentCtcLpa = emp.salary ? Math.round((emp.salary.annualCtc / 100000) * 10) / 10 : 0;
            const pct = review.incrementPercent ?? 10;
            promotions.unshift({
                id: `prm-${crypto.randomUUID().slice(0, 8)}`,
                orgId: me.orgId,
                employeeId: emp.id,
                employeeName: emp.name,
                currentDesignation: emp.designation,
                newDesignation: String(body.newDesignation),
                currentDepartment: emp.department,
                newDepartment: String(body.newDepartment || emp.department),
                currentCtcLpa,
                newCtcLpa: Math.round(currentCtcLpa * (1 + pct / 100) * 10) / 10,
                effectiveDate: body.effectiveDate || now.split("T")[0],
                reason: `${review.reviewCycle} review — rating ${rating}/5`,
                status: "PENDING",
                requestedByName: me.name,
                approvedByName: null,
            });
            notifyRoles(me.orgId, ["HR_ADMIN"], { title: "Promotion recommended", message: `${emp.name} → ${body.newDesignation}`, link: "/hr/approvals" });
        }
        if (emp?.userId) addNotification({ orgId: me.orgId, userId: emp.userId, title: "Performance review completed", message: `${review.reviewCycle}: rated ${rating}/5`, link: "/portal/performance" });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "REVIEW_COMPLETED", entity: "PerformanceReview", entityId: review.id, detail: `${review.employeeName} · ${review.reviewCycle} · ${rating}/5${review.promotionRecommended ? " · promotion recommended" : ""}` });
        return NextResponse.json(review);
    }

    return NextResponse.json({ error: "action must be self_review or manager_review" }, { status: 400 });
}
