import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { agentProfiles, payeeProfiles, users, addAudit, addNotification } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { fileUrl, sendEmail } from "@/lib/mock/finance";
import { agentStats } from "@/lib/mock/recruiter";

const mask = (v?: string | null) => (v ? `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : null);

// GET — partner (agent) directory: KYC queue + performance
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const list = users.filter((u) => u.orgId === me.orgId && u.role === "AGENT").map((u) => {
        const p = agentProfiles.find((x) => x.userId === u.id);
        const pay = payeeProfiles.find((x) => x.userId === u.id);
        return {
            userId: u.id, name: u.name, email: u.email, phone: u.phone, status: u.status, joinedAt: u.joinedAt,
            city: p?.city ?? u.location ?? "", kycStatus: p?.kycStatus ?? "PENDING", kycNote: p?.kycNote ?? null, pan: p?.pan ?? pay?.pan ?? null,
            idProofUrl: p?.idProofFileId ? fileUrl(p.idProofFileId) : null, specialization: p?.specialization ?? [], experienceYears: p?.experienceYears ?? 0,
            sourcingChannels: p?.sourcingChannels ?? [], agreementAcceptedAt: p?.agreementAcceptedAt ?? null, verifiedByName: p?.verifiedByName ?? null, verifiedAt: p?.verifiedAt ?? null,
            payee: pay ? { bankName: pay.bankName ?? null, account: mask(pay.bankAccountNumber), ifsc: pay.bankIfsc ?? null, upiId: pay.upiId ?? null } : null,
            stats: agentStats(u.id),
        };
    }).sort((a, b) => Number(b.kycStatus === "PENDING") - Number(a.kycStatus === "PENDING") || b.stats.hired - a.stats.hired);
    return NextResponse.json(list);
}

// PATCH { userId, action: VERIFY | REJECT | SUSPEND | REACTIVATE, note? }
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const u = users.find((x) => x.id === b.userId && x.orgId === me.orgId && x.role === "AGENT");
    if (!u) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    let p = agentProfiles.find((x) => x.userId === u.id);
    if (!p) {
        p = { userId: u.id, orgId: u.orgId, city: u.location ?? "", pan: payeeProfiles.find((x) => x.userId === u.id)?.pan ?? null, idProofFileId: null, kycStatus: "PENDING", kycNote: null, specialization: [], experienceYears: 0, sourcingChannels: [], agreementAcceptedAt: u.joinedAt, verifiedByName: null, verifiedAt: null, createdAt: u.joinedAt };
        agentProfiles.push(p);
    }
    const note = String(b.note ?? "").trim().slice(0, 500);
    const now = new Date().toISOString();

    if (b.action === "VERIFY") {
        if (!p.pan) return bad("PAN is missing — reject with a note asking the partner to add it");
        p.kycStatus = "VERIFIED"; p.kycNote = null; p.verifiedByName = me.name; p.verifiedAt = now;
        const wasPending = u.status !== "ACTIVE";
        if (u.status === "INVITED") u.status = "ACTIVE";
        sendEmail(me.orgId, me, { to: [u.email], subject: "Your AbsoJob partner account is active", relatedType: "User", relatedId: u.id, html: `<p>Hi ${u.name},</p><p>Your KYC has been verified${wasPending ? " and your partner account is now active. You can sign in with the email and password you registered with" : ""}. Start referring candidates for open roles from the partner portal.</p><p>— AbsoJob Talent Team</p>` });
        addNotification({ orgId: me.orgId, userId: u.id, title: "KYC verified ✅", message: "Your partner KYC is verified — payouts are enabled.", link: "/portal/profile" });
    } else if (b.action === "REJECT") {
        if (!note) return bad("Tell the partner what to fix");
        p.kycStatus = "REJECTED"; p.kycNote = note; p.verifiedByName = me.name; p.verifiedAt = now;
        sendEmail(me.orgId, me, { to: [u.email], subject: "Action needed on your AbsoJob partner KYC", relatedType: "User", relatedId: u.id, html: `<p>Hi ${u.name},</p><p>We could not verify your KYC: <b>${note.replace(/[<>&]/g, "")}</b></p><p>${u.status === "ACTIVE" ? "Please update your details from Profile → KYC in the partner portal." : "Please resubmit your details from the partner registration page (Resubmit KYC)."}</p>` });
        addNotification({ orgId: me.orgId, userId: u.id, title: "KYC needs attention", message: note, link: "/portal/profile" });
    } else if (b.action === "SUSPEND") {
        if (u.status !== "ACTIVE") return bad("Partner is not active");
        if (!note) return bad("A reason is required");
        u.status = "SUSPENDED"; u.deactivatedAt = now;
    } else if (b.action === "REACTIVATE") {
        if (u.status === "ACTIVE") return bad("Partner is already active");
        if (p.kycStatus !== "VERIFIED") return bad("Verify KYC before activating");
        u.status = "ACTIVE"; u.deactivatedAt = null;
    } else return bad("Invalid action");

    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `PARTNER_${b.action}`, entity: "User", entityId: u.id, detail: `${u.name}${note ? ` — ${note}` : ""}` });
    return NextResponse.json({ userId: u.id, status: u.status, kycStatus: p.kycStatus });
}
