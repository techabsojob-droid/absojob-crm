import { NextResponse } from "next/server";
import { users, agentProfiles, storedFiles, organizations, addAudit } from "@/lib/mock/data";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/password";
import { notifyRoles } from "@/lib/mock/pipeline";
import { PAN_RE, IFSC_RE } from "@/lib/mock/finance";
import { payeeProfiles } from "@/lib/mock/data";
import { dbErrorResponse, syncRequest } from "@/lib/db/request";

// Simple in-memory throttle per IP (10 attempts / 10 min)
const attempts = new Map<string, number[]>();

// POST: external recruitment partner (agent) self-registration with KYC → pending verification
function throttled(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    const now = Date.now();
    const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
    attempts.set(ip, [...recent, now]);
    return recent.length >= 10 ? NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 }) : null;
}

export async function POST(request: Request) {
    const limited = throttled(request);
    if (limited) return limited;
    try { await syncRequest(); } catch (e) { return dbErrorResponse(e); }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON, validated field by field below
    let b: Record<string, any>;
    try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

    const name = String(b.name ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    const phone = String(b.phone ?? "").replace(/[^\d+]/g, "");
    const city = String(b.city ?? "").trim();
    const pan = String(b.pan ?? "").toUpperCase().trim();
    const ifsc = String(b.bankIfsc ?? "").toUpperCase().trim();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter your full name and a valid email" }, { status: 400 });
    if (phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });
    if (!city) return NextResponse.json({ error: "City is required" }, { status: 400 });
    if (!PAN_RE.test(pan)) return NextResponse.json({ error: "A valid PAN is required for payouts (TDS)" }, { status: 400 });
    if (ifsc && !IFSC_RE.test(ifsc)) return NextResponse.json({ error: "IFSC format is invalid" }, { status: 400 });
    if (!b.bankAccountNumber && !b.upiId) return NextResponse.json({ error: "Add a bank account or UPI ID for payouts" }, { status: 400 });
    if (b.bankAccountNumber && (!/^\d{9,18}$/.test(String(b.bankAccountNumber)) || !ifsc)) return NextResponse.json({ error: "Enter a 9–18 digit account number with its IFSC" }, { status: 400 });
    if (b.upiId && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(String(b.upiId))) return NextResponse.json({ error: "Invalid UPI ID" }, { status: 400 });
    const pwErr = passwordPolicyError(b.password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    if (!b.acceptAgreement) return NextResponse.json({ error: "Please accept the partner agreement" }, { status: 400 });
    if (users.some((u) => u.email.toLowerCase() === email)) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    const orgId = organizations.find((o) => o.slug === (b.org || "absojob"))?.id ?? organizations[0].id;
    const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;

    // Optional ID proof upload (PDF / image, 5 MB)
    let idProofFileId: string | null = null;
    if (b.idProof?.dataBase64) {
        const data = String(b.idProof.dataBase64).replace(/^data:[^;]+;base64,/, "");
        const size = Math.floor((data.length * 3) / 4);
        if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(b.idProof.mimeType)) return NextResponse.json({ error: "ID proof must be a PDF or image" }, { status: 400 });
        if (size > 5 * 1024 * 1024) return NextResponse.json({ error: "ID proof is larger than 5 MB" }, { status: 400 });
        idProofFileId = `file-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
        storedFiles.push({ id: idProofFileId, orgId, name: String(b.idProof.name ?? "id-proof").slice(0, 120), mimeType: b.idProof.mimeType, size, dataBase64: data, ownerUserId: userId, purpose: "kyc", createdAt: new Date().toISOString() });
    }

    users.push({
        id: userId, orgId, name, email, phone, role: "AGENT", status: "INVITED", avatarUrl: null, department: "Field", designation: "Recruitment Partner",
        location: city, reportingTo: null, joinedAt: new Date().toISOString(), deactivatedAt: null, passwordHash: hashPassword(b.password), passwordChangedAt: new Date().toISOString(),
    });
    agentProfiles.push({
        userId, orgId, city, pan, idProofFileId, kycStatus: "PENDING", kycNote: null,
        specialization: (Array.isArray(b.specialization) ? b.specialization : String(b.specialization ?? "").split(",")).map((x: string) => x.trim()).filter(Boolean).slice(0, 8),
        experienceYears: Math.max(0, Math.min(50, Number(b.experienceYears) || 0)),
        sourcingChannels: (Array.isArray(b.sourcingChannels) ? b.sourcingChannels : String(b.sourcingChannels ?? "").split(",")).map((x: string) => x.trim()).filter(Boolean).slice(0, 8),
        agreementAcceptedAt: new Date().toISOString(), verifiedByName: null, verifiedAt: null, createdAt: new Date().toISOString(),
    });
    payeeProfiles.push({ userId, pan, bankName: b.bankName || null, bankAccountNumber: b.bankAccountNumber || null, bankIfsc: ifsc || null, upiId: b.upiId || null });

    addAudit({ orgId, actorUserId: userId, actorRole: "AGENT", action: "PARTNER_REGISTERED", entity: "User", entityId: userId, detail: `${name} (${email}) applied as recruitment partner — KYC pending` });
    notifyRoles(orgId, ["TA_MANAGER", "SUPER_ADMIN"], { title: "New partner application", message: `${name} (${city}) applied as a recruitment partner — verify KYC`, link: "/ta/partners" });
    return NextResponse.json({ success: true, message: "Application received. We will verify your KYC and email you once your account is active." }, { status: 201 });
}

// PUT { email, password, pan?, idProof? } — a partner whose KYC was rejected (account not yet active) resubmits
export async function PUT(request: Request) {
    const limited = throttled(request);
    if (limited) return limited;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON, validated field by field below
    let b: Record<string, any>;
    try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const user = users.find((u) => u.email.toLowerCase() === String(b.email ?? "").trim().toLowerCase() && u.role === "AGENT");
    if (!user || !user.passwordHash || !verifyPassword(String(b.password ?? ""), user.passwordHash)) return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 });
    const p = agentProfiles.find((x) => x.userId === user.id);
    if (!p || user.status !== "INVITED") return NextResponse.json({ error: "This account is already active — update KYC from your profile" }, { status: 409 });
    if (p.kycStatus !== "REJECTED") return NextResponse.json({ error: "Your application is already under review" }, { status: 409 });
    if (b.pan) {
        const pan = String(b.pan).toUpperCase().trim();
        if (!PAN_RE.test(pan)) return NextResponse.json({ error: "Invalid PAN" }, { status: 400 });
        p.pan = pan;
        const pay = payeeProfiles.find((x) => x.userId === user.id);
        if (pay) pay.pan = pan;
    }
    if (b.idProof?.dataBase64) {
        const data = String(b.idProof.dataBase64).replace(/^data:[^;]+;base64,/, "");
        const size = Math.floor((data.length * 3) / 4);
        if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(b.idProof.mimeType) || size > 5 * 1024 * 1024) return NextResponse.json({ error: "ID proof must be a PDF or image under 5 MB" }, { status: 400 });
        const id = `file-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
        storedFiles.push({ id, orgId: user.orgId, name: String(b.idProof.name ?? "id-proof").slice(0, 120), mimeType: b.idProof.mimeType, size, dataBase64: data, ownerUserId: user.id, purpose: "kyc", createdAt: new Date().toISOString() });
        p.idProofFileId = id;
    }
    p.kycStatus = "PENDING"; p.kycNote = null;
    addAudit({ orgId: user.orgId, actorUserId: user.id, actorRole: "AGENT", action: "PARTNER_KYC_RESUBMITTED", entity: "User", entityId: user.id, detail: `${user.name} resubmitted KYC` });
    notifyRoles(user.orgId, ["TA_MANAGER", "SUPER_ADMIN"], { title: "Partner KYC resubmitted", message: `${user.name} resubmitted KYC`, link: "/ta/partners" });
    return NextResponse.json({ success: true, message: "Resubmitted. We will email you once verified." });
}
