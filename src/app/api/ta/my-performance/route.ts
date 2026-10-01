import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users, recruiterTargets } from "@/lib/mock/data";
import { isRecruitmentManager } from "@/lib/mock/pipeline";
import { recruiterMonth, recruiterPerformance } from "@/lib/mock/recruiter";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET ?month=YYYY-MM[&userId=] — recruiter KPIs vs target. Recruiters see only themselves;
// managers may pass userId, and also get a team table.
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const sp = new URL(request.url).searchParams;
    const month = MONTH_RE.test(sp.get("month") ?? "") ? sp.get("month")! : new Date().toISOString().slice(0, 7);
    const manager = isRecruitmentManager(me);
    const userId = sp.get("userId") || me.id;
    if (userId !== me.id && !manager) return NextResponse.json({ error: "You can only view your own performance" }, { status: 403 });
    const subject = users.find((u) => u.id === userId && u.orgId === me.orgId);
    if (!subject) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const perf = recruiterPerformance(subject, month);
    const team = manager
        ? users.filter((u) => u.orgId === me.orgId && u.status === "ACTIVE" && ["TA_RECRUITER", "TA_MANAGER"].includes(u.role)).map((u) => ({
            userId: u.id, name: u.name, role: u.role,
            actual: recruiterMonth(u, month),
            target: recruiterTargets.find((t) => t.orgId === me.orgId && t.userId === u.id && t.month === month) ?? null,
        }))
        : null;
    return NextResponse.json({ user: { id: subject.id, name: subject.name, role: subject.role }, ...perf, team, canSetTargets: manager });
}
