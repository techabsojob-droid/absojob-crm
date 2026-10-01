import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { pool } from "@/lib/db/pool";
import { DB_SCHEMA, TABLES } from "@/lib/db/registry.generated";

// Shown first on the Settings › Database card
const HIGHLIGHT = ["users", "clients", "jobs", "candidates", "applications", "employees", "tasks", "invoices"];

export async function GET() {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;

    try {
        const tables = [...TABLES].sort((a, b) => {
            const ia = HIGHLIGHT.indexOf(a.table), ib = HIGHLIGHT.indexOf(b.table);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
        const { rows: present } = await pool().query(
            "select table_name from information_schema.tables where table_schema = $1",
            [DB_SCHEMA],
        );
        const existing = new Set(present.map((r: { table_name: string }) => r.table_name));
        const countable = tables.filter((t) => existing.has(t.table));
        const counts = new Map<string, number>();
        if (countable.length) {
            const { rows } = await pool().query(
                countable.map((t) => `select '${t.table}' as t, count(*) as c from "${DB_SCHEMA}"."${t.table}"`).join(" union all "),
            );
            for (const r of rows as { t: string; c: number }[]) counts.set(r.t, Number(r.c));
        }

        const stats: Record<string, { exists: boolean; count: number }> = {};
        for (const t of tables) stats[t.table] = { exists: existing.has(t.table), count: counts.get(t.table) ?? 0 };

        return NextResponse.json({
            connected: true,
            supabaseUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "Supabase"} · schema "${DB_SCHEMA}" · ${tables.length} tables`,
            allTablesReady: Object.values(stats).every((s) => s.exists),
            stats,
        });
    } catch (err) {
        return NextResponse.json(
            { connected: false, error: err instanceof Error ? err.message : "Failed to connect to Supabase" },
            { status: 500 },
        );
    }
}
