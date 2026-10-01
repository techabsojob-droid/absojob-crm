import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users, recruiterTargets, addAudit, addNotification } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const FIELDS = ["submissions", "interviews", "offers", "joinings", "revenue"] as const;

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const month = new URL(request.url).searchParams.get("month");
    const list = recruiterTargets.filter((t) => t.orgId === me.orgId && (!month || t.month === month) && (me.role !== "TA_RECRUITER" || t.userId === me.id));
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
    if (!MONTH_RE.test(String(b.month ?? ""))) return bad("month must be YYYY-MM");
    const vals: Record<string, number> = {};
    for (const f of FIELDS) {
        const n = Number(b[f] ?? 0);
        if (!Number.isFinite(n) || n < 0 || n > (f === "revenue" ? 1e10 : 10000)) return bad(`Invalid ${f}`);
        vals[f] = Math.round(n);
    }
    let t = recruiterTargets.find((x) => x.orgId === me.orgId && x.userId === u.id && x.month === b.month);
    if (t) Object.assign(t, vals, { setByName: me.name });
    else {
        t = { id: `tgt-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, userId: u.id, month: b.month, submissions: vals.submissions, interviews: vals.interviews, offers: vals.offers, joinings: vals.joinings, revenue: vals.revenue, setByName: me.name };
        recruiterTargets.push(t);
    }
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "TARGET_SET", entity: "RecruiterTarget", entityId: t.id, detail: `${u.name} ${b.month}: ${FIELDS.map((f) => `${f} ${vals[f]}`).join(", ")}` });
    if (u.id !== me.id) addNotification({ orgId: me.orgId, userId: u.id, title: "Monthly target set", message: `${me.name} set your ${b.month} targets — ${vals.joinings} joinings, ₹${vals.revenue.toLocaleString("en-IN")} revenue`, link: "/ta/performance" });
    return NextResponse.json(t);
}
