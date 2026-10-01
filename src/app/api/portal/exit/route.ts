import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { assets, exitRecords, addAudit } from "@/lib/mock/data";
import { approversFor, employeeForUser } from "@/lib/mock/identity";
import { notifyRoles } from "@/lib/mock/pipeline";
import { bad, body } from "@/lib/mock/fin/http";

const OPEN = ["PENDING_APPROVAL", "NOTICE_PERIOD", "CLEARANCE", "SETTLED"];

// GET — my resignation: status, clearance, assets to return, F&F, experience letter
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const emp = employeeForUser(auth.user.id);
    if (!emp) return NextResponse.json({ exit: null });
    const x = exitRecords.filter((e) => e.employeeId === emp.id).sort((a, b) => b.resignationDate.localeCompare(a.resignationDate))[0];
    if (!x) return NextResponse.json({ exit: null });
    const cleared = x.clearanceChecklist.filter((c) => c.cleared).length;
    return NextResponse.json({
        exit: {
            ...x, exitInterviewNotes: undefined,
            clearanceProgress: Math.round((cleared / Math.max(1, x.clearanceChecklist.length)) * 100),
            assetsToReturn: assets.filter((a) => a.assignedEmployeeId === emp.id && a.status === "ASSIGNED").map((a) => ({ tag: a.assetTag, name: a.name })),
            canWithdraw: x.status === "PENDING_APPROVAL",
            letterUrl: x.experienceLetterIssued ? `/portal/letters/${x.id}` : null,
            open: OPEN.includes(x.status),
        },
    });
}

// PATCH { action: "withdraw" } | { action: "feedback", rating, wouldRecommend, reasonCategory, comments }
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    const x = emp ? exitRecords.find((e) => e.employeeId === emp.id && OPEN.includes(e.status)) : undefined;
    if (!emp || !x) return bad("No active resignation", 404);
    const b = await body(request);
    if (b.action === "withdraw") {
        if (x.status !== "PENDING_APPROVAL") return bad("Your resignation is already accepted — talk to HR to withdraw", 409);
        x.status = "WITHDRAWN";
        const { managerUserId } = approversFor(me.id);
        notifyRoles(me.orgId, ["HR_ADMIN"], { title: "Resignation withdrawn", message: `${emp.name} withdrew their resignation`, link: "/hr/exit" }, [managerUserId]);
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "RESIGNATION_WITHDRAWN", entity: "ExitRecord", entityId: x.id, detail: emp.name });
        return NextResponse.json({ success: true, status: x.status });
    }
    if (b.action === "feedback") {
        const rating = Number(b.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad("Rating must be 1–5");
        if (!String(b.comments ?? "").trim()) return bad("Please share a few words");
        x.employeeFeedback = { rating, wouldRecommend: !!b.wouldRecommend, reasonCategory: String(b.reasonCategory ?? "Other").slice(0, 40), comments: String(b.comments).trim().slice(0, 2000), at: new Date().toISOString() };
        notifyRoles(me.orgId, ["HR_ADMIN"], { title: "Exit feedback received", message: `${emp.name} submitted exit feedback`, link: "/hr/exit" });
        return NextResponse.json({ success: true });
    }
    return bad("Unsupported action");
}
