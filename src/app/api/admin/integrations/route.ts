import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { integrationCatalog } from "@/lib/integrations";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    return NextResponse.json(integrationCatalog());
}
