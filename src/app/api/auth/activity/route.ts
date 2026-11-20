import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";

// POST: the browser reports real user activity (typing, clicking). The proxy
// extends the session's inactivity timeout on this call; background polling doesn't.
export async function POST() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    return NextResponse.json({ ok: true });
}
