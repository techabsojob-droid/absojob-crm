import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, jobs, referralMessages, referrals, users, addNotification } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { isJobAssignedTo, isRecruitmentManager } from "@/lib/mock/pipeline";
import type { Referral, User } from "@/lib/types";

// The referring partner and TA (managers, or recruiters on the referral's job) share one thread per referral
function canAccess(me: User, ref: Referral) {
    if (ref.orgId !== me.orgId) return false;
    if (ref.agentId === me.id) return true;
    if (isRecruitmentManager(me)) return true;
    return me.role === "TA_RECRUITER" && (!ref.jobId || isJobAssignedTo(ref.jobId, me.id));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const ref = referrals.find((r) => r.id === id);
    if (!ref || !canAccess(me, ref)) return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    return NextResponse.json(referralMessages.filter((m) => m.referralId === ref.id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const ref = referrals.find((r) => r.id === id);
    if (!ref || !canAccess(me, ref)) return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    const text = String((await body(request)).text ?? "").trim();
    if (!text) return bad("Write a message");
    if (text.length > 2000) return bad("Message is too long");
    const m = { id: `rmsg-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, referralId: ref.id, fromUserId: me.id, fromName: me.name, fromRole: me.role, text, createdAt: new Date().toISOString() };
    referralMessages.push(m);

    const cand = candidates.find((c) => c.id === ref.candidateId);
    if (me.id === ref.agentId) {
        // Partner wrote → TA managers + recruiters on the job + anyone from TA already in the thread
        const job = ref.jobId ? jobs.find((j) => j.id === ref.jobId) : undefined;
        const to = new Set<string>([
            ...users.filter((u) => u.orgId === me.orgId && u.role === "TA_MANAGER" && u.status === "ACTIVE").map((u) => u.id),
            ...(job?.assignedTas ?? []), ...(job?.primaryRecruiterId ? [job.primaryRecruiterId] : []),
            ...referralMessages.filter((x) => x.referralId === ref.id && x.fromUserId !== ref.agentId).map((x) => x.fromUserId),
        ]);
        to.delete(me.id);
        to.forEach((userId) => addNotification({ orgId: me.orgId, userId, title: `Message from ${me.name}`, message: `${cand?.name ?? "Referral"}: ${text.slice(0, 120)}`, link: "/ta/referrals" }));
    } else {
        addNotification({ orgId: me.orgId, userId: ref.agentId, title: `Message from ${me.name}`, message: `${cand?.name ?? "Your referral"}: ${text.slice(0, 120)}`, link: `/portal/referrals/${ref.id}` });
    }
    return NextResponse.json(m, { status: 201 });
}
