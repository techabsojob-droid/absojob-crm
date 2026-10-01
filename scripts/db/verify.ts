// ─── Round-trip check ─────────────────────────────────────────
// Loads every table from Supabase through the same code the app uses and
// compares it field-by-field with the built-in seed data.
//   npm run db:verify   (run right after db:seed / db:reset)

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function diff(a: unknown, b: unknown, at: string, out: string[]) {
    if (out.length > 200) return;
    if (a === b) return;
    if (a && b && typeof a === "object" && typeof b === "object") {
        if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${at}: array vs object`); return; }
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of keys) diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${at}.${k}`, out);
        return;
    }
    // The seed stamps rows relative to "now", so timestamps shift between runs
    if (typeof a === "string" && typeof b === "string" && TS.test(a) && TS.test(b)) return;
    out.push(`${at}: seed=${JSON.stringify(a)} db=${JSON.stringify(b)}`);
}

async function main() {
    await import("../../src/lib/mock/identity");
    const { TABLES } = await import("../../src/lib/db/registry.generated");
    const { ensureFresh } = await import("../../src/lib/db/sync");
    const { pool } = await import("../../src/lib/db/pool");
    const key = Object.keys(globalThis).find((k) => k.startsWith("__absojobMockStore"))!;
    const store = (globalThis as unknown as Record<string, Record<string, unknown>>)[key];
    const seed = JSON.parse(JSON.stringify(Object.fromEntries(TABLES.map((t) => [t.key, store[t.key]]))));

    await ensureFresh();

    const problems: string[] = [];
    for (const t of TABLES) diff(seed[t.key], JSON.parse(JSON.stringify(store[t.key])), t.key, problems);
    await pool().end();
    if (problems.length) {
        console.log(`✗ ${problems.length} difference(s):\n  ${problems.slice(0, 60).join("\n  ")}`);
        process.exit(1);
    }
    console.log(`✓ All ${TABLES.length} tables read back from Supabase identical to the seed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
