// ─── Issue login passwords ────────────────────────────────────
//   npm run db:set-passwords          → users without a password get one
//   npm run db:set-passwords -- --all → rotate every active user's password
// Hashes go to Supabase; the plain passwords are written once to
// CREDENTIALS.local.md (gitignored). Share them privately, then delete the file.

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { generateTempPassword, hashPassword } from "../../src/lib/password";
import { SCHEMA } from "./config";

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "CREDENTIALS.local.md");

for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const ROLE_LABEL: Record<string, string> = {
    SUPER_ADMIN: "Super Admin", HR_ADMIN: "HR Admin", FINANCE_ADMIN: "Finance Admin", TA_MANAGER: "TA Manager",
    TA_RECRUITER: "Recruiter", AGENT: "Partner (Agent)", EMPLOYEE: "Employee",
};

async function main() {
    const all = process.argv.includes("--all");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing in .env");
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        const { rows } = await client.query(
            `select u.id, u.name, u.email, u.role, o.name as org from ${SCHEMA}.users u join ${SCHEMA}.organizations o on o.id = u.org_id
             where u.status = 'ACTIVE' ${all ? "" : "and u.password_hash is null"} order by o.name, u._position`);
        if (!rows.length) { console.log("Every active user already has a password. Use --all to rotate."); return; }

        const issued: { org: string; role: string; name: string; email: string; password: string }[] = [];
        await client.query("begin");
        for (const u of rows) {
            const password = generateTempPassword();
            await client.query(`update ${SCHEMA}.users set password_hash = $1, password_changed_at = null where id = $2`, [hashPassword(password), u.id]);
            issued.push({ org: u.org, role: ROLE_LABEL[u.role] ?? u.role, name: u.name, email: u.email, password });
        }
        await client.query("commit");

        const lines = [
            "# CRM login credentials",
            "",
            `Issued ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC. Keep private. Ask each person to change their password after first login (profile menu › Change password).`,
            "",
            "| Organisation | Role | Name | Email | Password |",
            "|---|---|---|---|---|",
            ...issued.map((r) => `| ${r.org} | ${r.role} | ${r.name} | ${r.email} | \`${r.password}\` |`),
            "",
        ];
        fs.writeFileSync(OUT, lines.join("\n"), { mode: 0o600 });
        console.log(`✓ ${issued.length} password(s) set. Saved to ${path.relative(ROOT, OUT)} (gitignored).`);
    } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
    } finally {
        await client.end();
    }
}

main().catch((e) => { console.error("✗", e instanceof Error ? e.message : e); process.exit(1); });
