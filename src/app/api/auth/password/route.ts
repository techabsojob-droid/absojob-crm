import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { MOCK_PASSWORD, addAudit } from "@/lib/mock/data";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/password";
import { dbEnabled } from "@/lib/db/sync";

// PATCH: change own password (current password required)
export async function PATCH(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    let b: Record<string, string>;
    try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const currentOk = me.passwordHash ? verifyPassword(String(b.currentPassword ?? ""), me.passwordHash) : !dbEnabled() && b.currentPassword === MOCK_PASSWORD;
    if (!currentOk) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    const err = passwordPolicyError(b.newPassword);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    if (b.newPassword === b.currentPassword) return NextResponse.json({ error: "Choose a different password" }, { status: 400 });
    me.passwordHash = hashPassword(b.newPassword);
    me.passwordChangedAt = new Date().toISOString();
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "PASSWORD_CHANGED", entity: "User", entityId: me.id, detail: "Password changed" });
    return NextResponse.json({ success: true });
}
