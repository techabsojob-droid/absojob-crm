import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users, recruiterTargets, addAudit, addNotification } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { isInRecruitmentTeam, teamScopeIds } from "@/lib/mock/pipeline";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const FIELDS = ["submissions", "interviews", "offers", "joinings", "revenue"] as const;

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const month = new URL(request.url).searchParams.get("month");
    const scope = me.role === "TA_RECRUITER" ? new Set([me.id]) : teamScopeIds(me);
    const list = recruiterTargets.filter((t) => t.orgId === me.orgId && (!month || t.month === month) && (!scope || scope.has(t.userId)));
    return NextResponse.json(list);
}

// PUT { userId, month, submissions, interviews, offers, joinings, revenue } — upsert (managers)
export async function PUT(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const u = users.find((x) => x.id === b.userId && x.orgId === me.orgId && ["TA_RECRUITER", "TA_MANAGER"].includes(x.role));
    if (!u) return bad("Pick a recruiter");
    // A TA Manager sets targets for their own team; their own target is set by Super Admin
    if (me.role === "TA_MANAGER" && !isInRecruitmentTeam(me, u.id)) {
        return bad(u.id === me.id ? "Your own target is set by your Super Admin" : "You can only set targets for recruiters in your team", 403);
    }
    if (!MONTH_RE.test(String(b.month ?? ""))) return bad("month must be YYYY-MM");
    const vals: Record<string, number> = {};
    for (const f of FIELDS) {
        const n = Number(b[f] ?? 0);
        if (!Number.isFinite(n) || n < 0 || n > (f === "revenue" ? 1e10 : 10000)) return bad(`Invalid ${f}`);
        vals[f] = Math.round(n);
    }
    // One target per person per month: update in place, never a second row
    let t = recruiterTargets.find((x) => x.orgId === me.orgId && x.userId === u.id && x.month === b.month);
    const before = t ? FIELDS.map((f) => `${f} ${t![f]}`).join(", ") : null;
    const now = new Date().toISOString();
    if (t) Object.assign(t, vals, { setByName: me.name, setById: me.id, updatedAt: now });
    else {
        t = { id: `tgt-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, userId: u.id, month: b.month, submissions: vals.submissions, interviews: vals.interviews, offers: vals.offers, joinings: vals.joinings, revenue: vals.revenue, setByName: me.name, setById: me.id, updatedAt: now };
        recruiterTargets.push(t);
    }
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: before ? "TARGET_UPDATED" : "TARGET_SET", entity: "RecruiterTarget", entityId: t.id, detail: `${u.name} ${b.month}: ${before ? `${before} → ` : ""}${FIELDS.map((f) => `${f} ${vals[f]}`).join(", ")}` });
    if (u.id !== me.id) addNotification({ orgId: me.orgId, userId: u.id, title: "Monthly target set", message: `${me.name} set your ${b.month} targets — ${vals.joinings} joinings, ₹${vals.revenue.toLocaleString("en-IN")} revenue`, link: "/ta/performance" });
    return NextResponse.json(t);
}
