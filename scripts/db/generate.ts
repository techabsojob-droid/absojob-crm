// ─── Supabase schema + seed generator ─────────────────────────
// Reads the domain types (src/lib/types.ts) and the mock seed data
// (src/lib/mock/data.ts) and writes:
//   supabase/schema/*.sql            → table definitions, one file per domain
//   supabase/seed/seed.sql           → every mock row as INSERT statements
//   src/lib/db/registry.generated.ts → column map the app uses at runtime
//
// Run: npm run db:generate   (re-run whenever types.ts or the seed changes)

process.env.CRM_DATA_SOURCE = "mock";

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { DOMAINS, PRIMARY_KEYS, REFERENCES, SCHEMA, SKIP, TABLE_COMMENTS, TABLE_NAMES } from "./config";

const ROOT = path.resolve(__dirname, "../..");
const TYPES_FILE = path.join(ROOT, "src/lib/types.ts");
const DATA_FILE = path.join(ROOT, "src/lib/mock/data.ts");
const OUT_SCHEMA = path.join(ROOT, "supabase/schema");
const OUT_SEED = path.join(ROOT, "supabase/seed");
const OUT_REGISTRY = path.join(ROOT, "src/lib/db/registry.generated.ts");

type ColType = "text" | "numeric" | "boolean" | "date" | "timestamptz" | "text[]" | "jsonb";

interface Column {
    field: string;
    column: string;
    type: ColType;
    notNull: boolean;
    omitIfNull: boolean; // optional field → leave it off the object instead of setting null
    enumValues?: string[];
    note?: string;
}

interface Table {
    key: string;
    name: string;
    typeName: string;
    pk: string[]; // fields
    columns: Column[];
    kind: "rows" | "orgMap";
    rows: Record<string, unknown>[];
}

const warnings: string[] = [];

// ─── Seed data ────────────────────────────────────────────────
async function loadSeed(): Promise<Record<string, unknown>> {
    await import("../../src/lib/mock/identity");
    const key = Object.keys(globalThis).find((k) => k.startsWith("__absojobMockStore"));
    if (!key) throw new Error("Mock store not found on globalThis");
    return (globalThis as Record<string, unknown>)[key] as Record<string, unknown>;
}

// ─── Collection key → TS type name ────────────────────────────
function collectionTypes(): Record<string, string> {
    const src = fs.readFileSync(DATA_FILE, "utf8");
    const map: Record<string, string> = {};
    for (const m of src.matchAll(/export const \w+: ([\w<>, ]+?)(\[\])? = persist\("(\w+)"/g)) {
        map[m[3]] = m[2] ? m[1] : "__object__";
    }
    return map;
}

// ─── TS type analysis ─────────────────────────────────────────
const program = ts.createProgram([TYPES_FILE], { strict: true, target: ts.ScriptTarget.ES2020 });
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile(TYPES_FILE)!;
const moduleSymbol = checker.getSymbolAtLocation(sourceFile)!;
const exportsByName = new Map(checker.getExportsOfModule(moduleSymbol).map((s) => [s.getName(), s]));

interface FieldInfo { name: string; optional: boolean; nullable: boolean; type: ColType; enumValues?: string[] }

function analyse(t: ts.Type): { type: ColType; nullable: boolean; enumValues?: string[] } {
    let parts = t.isUnion() ? t.types : [t];
    const nullable = parts.some((p) => p.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined));
    parts = parts.filter((p) => !(p.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
    if (parts.length === 0) return { type: "text", nullable: true };
    const all = (f: ts.TypeFlags) => parts.every((p) => p.flags & f);
    if (all(ts.TypeFlags.StringLike)) {
        const lits = parts.every((p) => p.isStringLiteral()) ? parts.map((p) => (p as ts.StringLiteralType).value) : undefined;
        return { type: "text", nullable, enumValues: lits };
    }
    if (all(ts.TypeFlags.NumberLike)) return { type: "numeric", nullable };
    if (all(ts.TypeFlags.BooleanLike)) return { type: "boolean", nullable };
    if (parts.length === 1 && checker.isArrayType(parts[0])) {
        const el = checker.getTypeArguments(parts[0] as ts.TypeReference)[0];
        const elParts = el.isUnion() ? el.types : [el];
        if (elParts.every((p) => p.flags & ts.TypeFlags.StringLike)) return { type: "text[]", nullable };
    }
    return { type: "jsonb", nullable };
}

function fieldsOf(typeName: string): FieldInfo[] {
    const sym = exportsByName.get(typeName);
    if (!sym) throw new Error(`Type ${typeName} not exported from types.ts`);
    const declared = checker.getDeclaredTypeOfSymbol(sym);
    return checker.getPropertiesOfType(declared).map((p) => {
        const t = checker.getTypeOfSymbol(p);
        const a = analyse(t);
        return { name: p.getName(), optional: !!(p.flags & ts.SymbolFlags.Optional), nullable: a.nullable, type: a.type, enumValues: a.enumValues };
    });
}

// ─── Helpers ──────────────────────────────────────────────────
const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toLowerCase();
const RESERVED = new Set(["all", "analyse", "analyze", "and", "any", "array", "as", "asc", "both", "case", "cast", "check", "collate", "column", "constraint", "create", "current_date", "current_role", "current_time", "current_timestamp", "current_user", "default", "deferrable", "desc", "distinct", "do", "else", "end", "except", "false", "fetch", "for", "foreign", "from", "grant", "group", "having", "in", "initially", "intersect", "into", "lateral", "leading", "limit", "localtime", "localtimestamp", "not", "null", "offset", "on", "only", "or", "order", "placing", "primary", "references", "returning", "select", "session_user", "some", "symmetric", "table", "then", "to", "trailing", "true", "union", "unique", "user", "using", "variadic", "when", "where", "window", "with"]);
const q = (id: string) => (RESERVED.has(id) ? `"${id}"` : id);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function inferFromValues(values: unknown[]): ColType {
    if (values.every((v) => typeof v === "string")) return "text";
    if (values.every((v) => typeof v === "number")) return "numeric";
    if (values.every((v) => typeof v === "boolean")) return "boolean";
    if (values.every((v) => Array.isArray(v) && v.every((x) => typeof x === "string"))) return "text[]";
    return "jsonb";
}

// Strings become date/timestamptz only when every seeded value has exactly that
// shape, so the app always reads back the same string it wrote.
function refineString(field: string, values: unknown[]): ColType {
    const strs = values.filter((v) => typeof v === "string") as string[];
    if (strs.length && strs.length === values.length) {
        if (strs.every((s) => DATE_RE.test(s))) return "date";
        if (strs.every((s) => ISO_RE.test(s)) && /At$/.test(field)) return "timestamptz";
        return "text";
    }
    // No seeded values: go by name. A value that later doesn't fit is kept in _extra.
    if (strs.length === 0 && /At$/.test(field)) return "timestamptz";
    if (strs.length === 0 && /(Date|^date)$/.test(field)) return "date";
    return "text";
}

// ─── Build table models ───────────────────────────────────────
function buildTables(store: Record<string, unknown>): Table[] {
    const typeMap = collectionTypes();
    const ordered = DOMAINS.flatMap((d) => d.tables);
    const missing = Object.keys(typeMap).filter((k) => !ordered.includes(k) && !SKIP.includes(k));
    if (missing.length) throw new Error(`Collections not assigned to a domain in config.ts: ${missing.join(", ")}`);

    return ordered.map((key) => {
        const name = TABLE_NAMES[key] ?? snake(key);
        const typeName = typeMap[key];
        if (!typeName) throw new Error(`No persist("${key}") collection in data.ts`);

        if (typeName === "__object__") {
            const obj = store[key] as Record<string, unknown>;
            return {
                key, name, typeName: "Record<orgId, settings>", pk: ["orgId"], kind: "orgMap" as const,
                rows: Object.entries(obj).map(([orgId, settings]) => ({ orgId, settings })),
                columns: [
                    { field: "orgId", column: "org_id", type: "text" as ColType, notNull: true, omitIfNull: false },
                    { field: "settings", column: "settings", type: "jsonb" as ColType, notNull: true, omitIfNull: false },
                ],
            };
        }

        const rows = store[key] as Record<string, unknown>[];
        const fields = fieldsOf(typeName);
        const known = new Set(fields.map((f) => f.name));
        // Fields the seed carries but the TS type doesn't declare
        const extraFields = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !known.has(k));
        for (const f of extraFields) {
            const vals = rows.map((r) => r[f]).filter((v) => v !== undefined && v !== null);
            warnings.push(`${key}.${f} is in the seed but not in type ${typeName} — added as a column`);
            fields.push({ name: f, optional: true, nullable: true, type: inferFromValues(vals) });
        }

        const pk = PRIMARY_KEYS[key] ?? ["id"];
        const columns: Column[] = fields.map((f) => {
            const present = rows.filter((r) => r[f.name] !== undefined);
            const values = present.map((r) => r[f.name]).filter((v) => v !== null);
            let type = f.type;
            if (type === "text" && !f.enumValues) type = refineString(f.name, values);
            // Seed values that don't fit the declared type would break the round-trip
            const fits = (v: unknown) =>
                type === "numeric" ? typeof v === "number" :
                type === "boolean" ? typeof v === "boolean" :
                type === "text[]" ? Array.isArray(v) && v.every((x) => typeof x === "string") :
                type === "jsonb" ? true : typeof v === "string";
            const misfits = values.filter((v) => !fits(v));
            if (misfits.length) {
                warnings.push(`${key}.${f.name}: ${misfits.length} seed value(s) don't match ${type} — column widened to jsonb`);
                type = "jsonb";
            }
            const seedHasNull = present.some((r) => r[f.name] === null);
            return {
                field: f.name,
                column: snake(f.name),
                type,
                notNull: pk.includes(f.name) || f.name === "orgId",
                omitIfNull: f.optional && (!f.nullable || !seedHasNull),
                enumValues: f.enumValues,
            };
        });
        // Primary key first, org_id second, everything else in declaration order
        const rank = (c: Column) => (pk.includes(c.field) ? 0 : c.field === "orgId" ? 1 : 2);
        columns.sort((a, b) => rank(a) - rank(b));
        return { key, name, typeName, pk, columns, kind: "rows" as const, rows };
    });
}

// ─── Relationships (only those the seed fully satisfies) ──────
interface Ref { table: Table; column: Column; target: Table }
function buildRefs(tables: Table[]): Ref[] {
    const byKey = new Map(tables.map((t) => [t.key, t]));
    const refs: Ref[] = [];
    for (const t of tables) {
        const hints = { ...REFERENCES["*"], ...(REFERENCES[t.key] ?? {}) };
        for (const [field, targetKey] of Object.entries(hints)) {
            const column = t.columns.find((c) => c.field === field);
            const target = byKey.get(targetKey);
            if (!column || !target || target.pk.length !== 1 || column.type !== "text") continue;
            const targetIds = new Set(target.rows.map((r) => r[target.pk[0]]));
            const bad = t.rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined && !targetIds.has(v));
            if (bad.length) {
                warnings.push(`${t.name}.${column.column} → ${target.name}: skipped, ${bad.length} seeded value(s) don't resolve (e.g. ${JSON.stringify(bad[0])})`);
                continue;
            }
            refs.push({ table: t, column, target });
        }
    }
    return refs;
}

// ─── SQL rendering ────────────────────────────────────────────
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

function tableSql(t: Table): string {
    const comment = TABLE_COMMENTS[t.key] ?? `Backs the "${t.key}" collection (type ${t.typeName}).`;
    const width = Math.max(...t.columns.map((c) => q(c.column).length), "_position".length) + 2;
    const lines = t.columns.map((c) => {
        const parts = [q(c.column).padEnd(width), c.type];
        if (c.notNull) parts.push("not null");
        const note = c.enumValues ? `-- ${c.enumValues.join(" | ")}` : "";
        return { sql: parts.join(" "), note };
    });
    lines.push({ sql: `${"_extra".padEnd(width)} jsonb not null default '{}'::jsonb`, note: "-- values that don't fit a typed column (kept losslessly)" });
    lines.push({ sql: `${"_position".padEnd(width)} double precision not null default 0`, note: "-- list order the app expects" });
    lines.push({ sql: `primary key (${t.pk.map((f) => q(t.columns.find((c) => c.field === f)!.column)).join(", ")})`, note: "" });
    const body = lines.map((l, i) => {
        const comma = i < lines.length - 1 ? "," : "";
        return `  ${l.sql}${comma}${l.note ? " " + l.note : ""}`.trimEnd();
    }).join("\n");
    return `-- ${comment}\ncreate table if not exists ${SCHEMA}.${t.name} (\n${body}\n);\n`;
}

function header(title: string, about: string) {
    return `-- ════════════════════════════════════════════════════════════\n-- ${title}\n-- ${about}\n-- Generated by scripts/db/generate.ts — edit config.ts / types.ts, then re-run.\n-- ════════════════════════════════════════════════════════════\n\n`;
}

function sqlValue(c: Column, v: unknown): string {
    if (v === undefined || v === null) return "null";
    switch (c.type) {
        case "numeric": return Number.isFinite(v as number) ? String(v) : "null";
        case "boolean": return v ? "true" : "false";
        case "text[]": return (v as string[]).length ? `array[${(v as string[]).map(lit).join(", ")}]` : "'{}'::text[]";
        case "jsonb": return `${lit(JSON.stringify(v))}::jsonb`;
        default: return lit(String(v));
    }
}

function seedSql(tables: Table[]): string {
    const out: string[] = [
        header("Seed — demo data for every CRM table", "Wipes the crm schema's rows and loads the demo dataset (2 orgs, demo logins use password demo123)."),
        "begin;\nset constraints all deferred;\n",
        `truncate ${tables.map((t) => `${SCHEMA}.${t.name}`).join(",\n         ")};\n`,
    ];
    for (const t of tables) {
        if (!t.rows.length) { out.push(`-- ${t.name}: no demo rows\n`); continue; }
        const cols = [...t.columns.map((c) => q(c.column)), "_position"];
        const values = t.rows.map((r, i) => `  (${[...t.columns.map((c) => sqlValue(c, r[c.field])), String((i + 1) * 1024)].join(", ")})`);
        out.push(`-- ${t.name} (${t.rows.length})\ninsert into ${SCHEMA}.${t.name} (${cols.join(", ")}) values\n${values.join(",\n")};\n`);
    }
    out.push("commit;\n");
    return out.join("\n");
}

function setupSql(): string {
    return header("Setup — schema", `All CRM tables live in their own "${SCHEMA}" schema so they never collide with the website's tables in "public".`) +
        `create schema if not exists ${SCHEMA};\ncomment on schema ${SCHEMA} is 'AbsoJob CRM (admin, HR, TA, finance and employee portal). Accessed server-side only.';\n`;
}

function relationshipsSql(refs: Ref[], tables: Table[]): string {
    const out = [header("Relationships and indexes", "Foreign keys between CRM tables plus lookup indexes. Constraints are deferrable so the app can save related rows in any order within one transaction.")];
    for (const r of refs) {
        const cname = `${r.table.name}_${r.column.column}_fkey`;
        const onDelete = r.column.notNull ? "cascade" : "set null";
        out.push(`alter table ${SCHEMA}.${r.table.name} drop constraint if exists ${cname};\nalter table ${SCHEMA}.${r.table.name} add constraint ${cname}\n  foreign key (${q(r.column.column)}) references ${SCHEMA}.${r.target.name} (${q(r.target.columns.find((c) => c.field === r.target.pk[0])!.column)})\n  on delete ${onDelete} deferrable initially deferred;\n`);
    }
    out.push("-- Lookup indexes on every relationship column");
    const seen = new Set<string>();
    for (const r of refs) {
        if (r.table.pk.length === 1 && r.table.pk[0] === r.column.field) continue;
        const idx = `${r.table.name}_${r.column.column}_idx`;
        if (seen.has(idx)) continue;
        seen.add(idx);
        out.push(`create index if not exists ${idx} on ${SCHEMA}.${r.table.name} (${q(r.column.column)});`);
    }
    out.push("\n-- Ordering index used when the app loads each table");
    for (const t of tables) out.push(`create index if not exists ${t.name}_position_idx on ${SCHEMA}.${t.name} (_position);`);
    return out.join("\n") + "\n";
}

function syncSql(tables: Table[]): string {
    return header("Change tracking and access", "Every write bumps a per-table version so each running app instance knows when to reload a table. RLS is on with no policies: only the server (postgres role) can touch CRM data.") +
`create table if not exists ${SCHEMA}._sync_state (
  table_name text primary key,
  version    bigint not null default 0,
  changed_at timestamptz not null default now()
);

create or replace function ${SCHEMA}.bump_sync_version() returns trigger
language plpgsql as $$
begin
  insert into ${SCHEMA}._sync_state as s (table_name, version, changed_at)
  values (tg_table_name, 1, now())
  on conflict (table_name) do update set version = s.version + 1, changed_at = now();
  return null;
end $$;

${tables.map((t) => `drop trigger if exists ${t.name}_sync on ${SCHEMA}.${t.name};
create trigger ${t.name}_sync after insert or update or delete or truncate on ${SCHEMA}.${t.name}
  for each statement execute function ${SCHEMA}.bump_sync_version();`).join("\n")}

-- Lock the schema down: no access through the public API keys
${tables.map((t) => `alter table ${SCHEMA}.${t.name} enable row level security;`).join("\n")}
alter table ${SCHEMA}._sync_state enable row level security;
revoke all on schema ${SCHEMA} from anon, authenticated;
revoke all on all tables in schema ${SCHEMA} from anon, authenticated;
`;
}

function registryTs(tables: Table[]): string {
    const data = tables.map((t) => ({
        key: t.key, table: t.name, kind: t.kind, pk: t.pk,
        columns: t.columns.map((c) => ({ field: c.field, column: c.column, type: c.type, ...(c.omitIfNull ? { omitIfNull: true } : {}) })),
    }));
    return `// Generated by scripts/db/generate.ts — do not edit by hand.
// Maps each in-memory collection to its Supabase table and columns.

export type ColumnType = "text" | "numeric" | "boolean" | "date" | "timestamptz" | "text[]" | "jsonb";
export interface ColumnDef { field: string; column: string; type: ColumnType; omitIfNull?: boolean }
export interface TableDef { key: string; table: string; kind: "rows" | "orgMap"; pk: string[]; columns: ColumnDef[] }

export const DB_SCHEMA = ${JSON.stringify(SCHEMA)};

// Orders column maps when old and new code share one dev server (hot reload)
export const REGISTRY_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};

export const TABLES: TableDef[] = ${JSON.stringify(data, null, 4)};
`;
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
    const store = await loadSeed();
    const tables = buildTables(store);
    const refs = buildRefs(tables);

    fs.rmSync(OUT_SCHEMA, { recursive: true, force: true });
    fs.mkdirSync(OUT_SCHEMA, { recursive: true });
    fs.mkdirSync(OUT_SEED, { recursive: true });
    fs.mkdirSync(path.dirname(OUT_REGISTRY), { recursive: true });

    fs.writeFileSync(path.join(OUT_SCHEMA, "00_setup.sql"), setupSql());
    for (const d of DOMAINS) {
        const ts_ = d.tables.map((k) => tables.find((t) => t.key === k)!);
        fs.writeFileSync(path.join(OUT_SCHEMA, d.file), header(d.title, d.about) + ts_.map(tableSql).join("\n"));
    }
    fs.writeFileSync(path.join(OUT_SCHEMA, "09_relationships.sql"), relationshipsSql(refs, tables));
    fs.writeFileSync(path.join(OUT_SCHEMA, "10_sync_and_security.sql"), syncSql(tables));
    fs.writeFileSync(path.join(OUT_SEED, "seed.sql"), seedSql(tables));
    fs.writeFileSync(OUT_REGISTRY, registryTs(tables));

    const rowCount = tables.reduce((n, t) => n + t.rows.length, 0);
    console.log(`✓ ${tables.length} tables, ${refs.length} relationships, ${rowCount} seed rows`);
    if (warnings.length) console.log(`\nNotes:\n  - ${warnings.join("\n  - ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
