import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { agentProfiles, payeeProfiles, storedFiles, addAudit } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { fileUrl, IFSC_RE, MAX_FILE_BYTES, PAN_RE } from "@/lib/mock/finance";
import { notifyRoles } from "@/lib/mock/pipeline";

const mask = (v?: string | null) => (v ? `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : null);

// GET — my payout details (masked) + partner KYC
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const pay = payeeProfiles.find((p) => p.userId === me.id);
    const kyc = agentProfiles.find((p) => p.userId === me.id);
    return NextResponse.json({
        payee: pay ? { pan: pay.pan ?? null, bankName: pay.bankName ?? null, account: mask(pay.bankAccountNumber), bankIfsc: pay.bankIfsc ?? null, upiId: pay.upiId ?? null } : null,
        kyc: kyc ? { status: kyc.kycStatus, note: kyc.kycNote ?? null, pan: kyc.pan ?? null, idProofUrl: kyc.idProofFileId ? fileUrl(kyc.idProofFileId) : null, city: kyc.city, specialization: kyc.specialization, experienceYears: kyc.experienceYears, sourcingChannels: kyc.sourcingChannels, verifiedAt: kyc.verifiedAt ?? null, agreementAcceptedAt: kyc.agreementAcceptedAt } : null,
    });
}

// PATCH { pan?, bankName?, bankAccountNumber?, bankIfsc?, upiId?, idProof?: {name,mimeType,dataBase64}, specialization?, sourcingChannels?, city? }
// PAN / ID-proof changes send a partner's KYC back for verification; bank changes are flagged to Finance.
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    let pay = payeeProfiles.find((p) => p.userId === me.id);
    if (!pay) { pay = { userId: me.id }; payeeProfiles.push(pay); }
    const kyc = agentProfiles.find((p) => p.userId === me.id);
    const changed: string[] = [];
    let reverify = false;

    if (b.pan !== undefined) {
        const pan = String(b.pan).toUpperCase().trim();
        if (!PAN_RE.test(pan)) return bad("Invalid PAN");
        if (pan !== pay.pan) { pay.pan = pan; if (kyc) kyc.pan = pan; changed.push("PAN"); reverify = true; }
    }
    if (b.bankIfsc !== undefined && b.bankIfsc && !IFSC_RE.test(String(b.bankIfsc).toUpperCase())) return bad("Invalid IFSC");
    if (b.bankAccountNumber !== undefined && b.bankAccountNumber && !/^\d{9,18}$/.test(String(b.bankAccountNumber))) return bad("Account number must be 9–18 digits");
    if (b.upiId !== undefined && b.upiId && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(String(b.upiId))) return bad("Invalid UPI ID");
    let bankChanged = false;
    for (const k of ["bankName", "bankAccountNumber", "bankIfsc", "upiId"] as const) {
        if (b[k] === undefined) continue;
        const v = String(b[k]).trim() || null;
        const val = k === "bankIfsc" && v ? v.toUpperCase() : v;
        if (val !== (pay[k] ?? null)) { pay[k] = val; bankChanged = true; }
    }
    if (bankChanged) changed.push("bank/UPI");
    if (bankChanged && b.bankAccountNumber && !pay.bankIfsc) return bad("IFSC is required with a bank account");

    if (b.idProof?.dataBase64) {
        if (!kyc) return bad("ID proof applies to partner accounts");
        const data = String(b.idProof.dataBase64).replace(/^data:[^;]+;base64,/, "");
        if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(b.idProof.mimeType)) return bad("ID proof must be a PDF or image");
        const size = Math.floor((data.length * 3) / 4);
        if (size > MAX_FILE_BYTES) return bad("ID proof is larger than 5 MB");
        const f = { id: `file-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, orgId: me.orgId, name: String(b.idProof.name ?? "id-proof").slice(0, 120), mimeType: b.idProof.mimeType, size, dataBase64: data, ownerUserId: me.id, purpose: "kyc", createdAt: new Date().toISOString() };
        storedFiles.push(f);
        kyc.idProofFileId = f.id;
        changed.push("ID proof"); reverify = true;
    }
    if (kyc) {
        if (b.city !== undefined && String(b.city).trim()) kyc.city = String(b.city).trim().slice(0, 60);
        const list = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
        if (b.specialization !== undefined) kyc.specialization = list(b.specialization);
        if (b.sourcingChannels !== undefined) kyc.sourcingChannels = list(b.sourcingChannels);
        // A rejected partner resubmitting goes back to the queue as well
        if (reverify || (kyc.kycStatus === "REJECTED" && b.resubmit)) {
            kyc.kycStatus = "PENDING"; kyc.kycNote = null;
            notifyRoles(me.orgId, ["TA_MANAGER"], { title: "Partner KYC resubmitted", message: `${me.name} updated ${changed.join(", ") || "KYC"} — verify again`, link: "/ta/partners" });
        }
    }
    if (bankChanged) notifyRoles(me.orgId, ["FINANCE_ADMIN"], { title: "Payee bank details changed", message: `${me.name} changed payout bank/UPI details — confirm before the next payout`, link: "/finance/payables" });
    if (changed.length) addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "PAYEE_UPDATED", entity: "User", entityId: me.id, detail: `Updated ${changed.join(", ")}` });
    return NextResponse.json({ success: true, changed, kycStatus: kyc?.kycStatus ?? null });
}
