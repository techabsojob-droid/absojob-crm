import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { leaveBalances, leavePolicies, goals, reviewCycles, hrPolicies, workflows } from "@/lib/mock/data";

// HR reference collections, served from the server so the data store never ships in the client bundle
const COLLECTIONS = { leaveBalances, leavePolicies, goals, reviewCycles, hrPolicies, workflows } as const;

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const keys = (new URL(request.url).searchParams.get("keys") ?? "").split(",").filter(Boolean);
    const out: Record<string, unknown[]> = {};
    for (const k of keys) {
        const col = COLLECTIONS[k as keyof typeof COLLECTIONS] as unknown as { orgId?: string }[] | undefined;
        if (col) out[k] = col.filter((x) => !x.orgId || x.orgId === me.orgId);
    }
    return NextResponse.json(out);
}
