import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { holidays } from "@/lib/mock/data";
import { istNow } from "@/lib/mock/ess";

// GET ?year= — company holiday calendar
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const y = new URL(request.url).searchParams.get("year");
    const year = y && /^\d{4}$/.test(y) ? y : istNow().date.slice(0, 4);
    const today = istNow().date;
    const list = holidays.filter((h) => h.orgId === me.orgId && h.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date))
        .map((h) => ({ ...h, weekday: new Date(`${h.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" }), past: h.date < today }));
    return NextResponse.json({ year, holidays: list, next: holidays.filter((h) => h.orgId === me.orgId && h.date >= today && h.type !== "OPTIONAL").sort((a, b) => a.date.localeCompare(b.date))[0] ?? null });
}
