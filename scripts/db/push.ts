// ─── Push SQL to Supabase ─────────────────────────────────────
//   npm run db:push    → create/update tables (supabase/schema/*.sql, safe to re-run)
//   npm run db:seed    → replace all CRM rows with the demo data (supabase/seed/seed.sql)
//   npm run db:reset   → drop the crm schema, recreate it and load the demo data
// Uses DATABASE_URL from .env. Only the "crm" schema is touched.

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SCHEMA } from "./config";

const ROOT = path.resolve(__dirname, "../..");

function loadEnv() {
    const file = path.join(ROOT, ".env");
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
}

async function run(client: Client, file: string) {
    const sql = fs.readFileSync(file, "utf8");
    const start = Date.now();
    await client.query(sql);
    console.log(`  ✓ ${path.relative(ROOT, file)} (${Date.now() - start} ms)`);
}

async function main() {
    loadEnv();
    const args = new Set(process.argv.slice(2));
    const reset = args.has("--reset");
    const schema = reset || args.has("--schema");
    const seed = reset || args.has("--seed");
    if (!schema && !seed) throw new Error("Pass --schema, --seed or --reset");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing in .env");

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log(`Connected to ${new URL(process.env.DATABASE_URL).hostname}`);
    try {
        if (reset) {
            await client.query(`drop schema if exists ${SCHEMA} cascade`);
            console.log(`  ✓ dropped schema ${SCHEMA}`);
        }
        if (schema) {
            const dir = path.join(ROOT, "supabase/schema");
            await client.query("begin");
            for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await run(client, path.join(dir, f));
            await client.query("commit");
        }
        if (seed) await run(client, path.join(ROOT, "supabase/seed/seed.sql"));

        const { rows } = await client.query(`select count(*)::int as tables from information_schema.tables where table_schema = $1`, [SCHEMA]);
        console.log(`Done — ${rows[0].tables} tables in schema "${SCHEMA}".`);
    } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
    } finally {
        await client.end();
    }
}

main().catch((e) => { console.error("✗", e instanceof Error ? e.message : e); process.exit(1); });
