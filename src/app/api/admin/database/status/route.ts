import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;

    try {
        const supabase = createAdminClient();
        const tables = [
            "organizations",
            "users",
            "companies",
            "jobs",
            "internships",
            "candidates",
            "applications",
            "interviews",
            "calls",
            "invoices",
            "announcements",
            "attendance",
            "leaves",
            "audit_logs",
        ];

        const stats: Record<string, { exists: boolean; count: number; error?: string }> = {};

        for (const table of tables) {
            try {
                const { count, error } = await supabase
                    .from(table)
                    .select("*", { count: "exact", head: true });

                if (error) {
                    stats[table] = { exists: false, count: 0, error: error.message };
                } else {
                    stats[table] = { exists: true, count: count ?? 0 };
                }
            } catch (err: any) {
                stats[table] = { exists: false, count: 0, error: err?.message };
            }
        }

        const allTablesReady = Object.values(stats).every((s) => s.exists);

        return NextResponse.json({
            connected: true,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            allTablesReady,
            stats,
        });
    } catch (err: any) {
        return NextResponse.json(
            {
                connected: false,
                error: err?.message || "Failed to connect to Supabase",
            },
            { status: 500 }
        );
    }
}
