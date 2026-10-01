import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { logAudit } from "@/lib/supabase/db";
import { Pool } from "pg";

// SQL console for Super Admins.
// - Disabled unless ENABLE_DB_CONSOLE=true.
// - Always uses the server-side DATABASE_URL (client-supplied connection strings are ignored).
// - Runs inside a READ ONLY transaction unless DB_CONSOLE_ALLOW_WRITES=true.
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    if (process.env.ENABLE_DB_CONSOLE !== "true") {
        return NextResponse.json(
            { error: "SQL console is disabled. Set ENABLE_DB_CONSOLE=true on the server to enable it." },
            { status: 403 }
        );
    }

    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!dbUrl) {
        return NextResponse.json({ error: "DATABASE_URL is not configured on the server" }, { status: 400 });
    }

    let sql: unknown;
    try {
        ({ sql } = await request.json());
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!sql || typeof sql !== "string" || !sql.trim()) {
        return NextResponse.json({ error: "SQL query string is required" }, { status: 400 });
    }

    const allowWrites = process.env.DB_CONSOLE_ALLOW_WRITES === "true";
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, max: 1 });

    try {
        const client = await pool.connect();
        const start = Date.now();
        try {
            await client.query(allowWrites ? "BEGIN" : "BEGIN TRANSACTION READ ONLY");
            await client.query("SET LOCAL statement_timeout = 15000");
            const res = await client.query(sql);
            await client.query(allowWrites ? "COMMIT" : "ROLLBACK");
            const durationMs = Date.now() - start;

            const results = Array.isArray(res) ? res : [res];
            await logAudit({
                orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
                action: "SQL_CONSOLE_QUERY", entity: "Database", entityId: null,
                detail: sql.slice(0, 500),
            });

            return NextResponse.json({
                success: true,
                durationMs,
                readOnly: !allowWrites,
                result: results.map((r) => ({
                    command: r.command,
                    rowCount: r.rowCount,
                    rows: r.rows,
                    fields: r.fields?.map((f: { name: string }) => f.name) || [],
                })),
            });
        } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Failed to execute query" },
            { status: 400 }
        );
    } finally {
        await pool.end();
    }
}
