import { NextResponse } from "next/server";
import { organizations } from "@/lib/mock/data";
import { dbErrorResponse, syncRequest } from "@/lib/db/request";
import { securityPolicy } from "@/lib/security";

// GET (public): whether the CRM is in maintenance mode, for the maintenance page
export async function GET() {
    try { await syncRequest(); } catch (e) { return dbErrorResponse(e); }
    const orgId = organizations[0]?.id;
    const p = orgId ? securityPolicy(orgId) : null;
    return NextResponse.json({ maintenance: !!p?.maintenanceMode, reason: p?.maintenanceMode ? p.maintenanceReason : "" });
}
