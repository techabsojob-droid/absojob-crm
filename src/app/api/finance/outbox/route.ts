import { NextResponse } from "next/server";
import { emailOutbox } from "@/lib/mock/data";
import { requireFinance } from "@/lib/mock/fin/http";

// Every email Finance sent (or would send when no provider key is configured)
export async function GET(request: Request) {
    const auth = await requireFinance();
    if ("error" in auth) return auth.error;
    const relatedId = new URL(request.url).searchParams.get("relatedId");
    const list = emailOutbox.filter((m) => m.orgId === auth.user.orgId && (!relatedId || m.relatedId === relatedId));
    return NextResponse.json({ provider: process.env.RESEND_API_KEY ? "resend" : "none", messages: list.slice(0, 200) });
}
