// ─── Supabase ⇄ in-memory store sync ──────────────────────────
// Supabase (schema "crm") is the source of truth. On the first request each
// server process loads every table into the collections exported by
// src/lib/mock/data.ts, so the API routes keep working on plain arrays.
// After each request, whatever changed (inserted / updated / removed / reordered)
// is written back in one transaction. Before each request, tables another process
// (or someone in the Supabase dashboard) changed are reloaded.
//
// CRM_DATA_SOURCE=mock skips all of this and runs on the built-in seed data.

import type { PoolClient } from "pg";
import { pool } from "./pool";
import { DB_SCHEMA, TABLES, type ColumnDef, type TableDef } from "./registry.generated";

type Row = Record<string, unknown>;
type Obj = Record<string, unknown>;

interface TableState {
    rows: Map<string, string>; // pk → JSON of the stored row (without _position)
    positions: Map<string, number>;
}

interface SyncState {
    store: Record<string, unknown> | null;
    hydrated: Promise<void> | null;
    snapshot: Map<string, TableState>;
    versions: Map<string, number>; // table → last version this process has seen
    lastCheck: number;
    checking: Promise<void> | null;
    flushing: Promise<void>;
    flushQueued: boolean;
}

const KEY = "__absojobDbSync__";
const S: SyncState = ((globalThis as Record<string, unknown>)[KEY] ??= {
    store: null,
    hydrated: null,
    snapshot: new Map(),
    versions: new Map(),
    lastCheck: 0,
    checking: null,
    flushing: Promise.resolve(),
    flushQueued: false,
}) as SyncState;

// How long a process trusts its copy before asking Supabase what changed
const FRESHNESS_MS = Number(process.env.DATABASE_FRESHNESS_MS ?? 1000);

export const dbEnabled = () => (process.env.CRM_DATA_SOURCE ?? "supabase") !== "mock";

export function attachStore(store: Record<string, unknown>) {
    S.store ??= store;
}

const qi = (id: string) => `"${id.replace(/"/g, '""')}"`;
const tableRef = (t: TableDef) => `${qi(DB_SCHEMA)}.${qi(t.table)}`;

// ─── Object ⇄ row conversion ──────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function fits(c: ColumnDef, v: unknown): boolean {
    switch (c.type) {
        case "numeric": return typeof v === "number" && Number.isFinite(v);
        case "boolean": return typeof v === "boolean";
        case "date": return typeof v === "string" && DATE_RE.test(v);
        case "timestamptz": return typeof v === "string" && ISO_RE.test(v);
        case "text[]": return Array.isArray(v) && v.every((x) => typeof x === "string");
        case "jsonb": return true;
        default: return typeof v === "string";
    }
}

function toRow(t: TableDef, obj: Obj): Row {
    const row: Row = {};
    const extra: Obj = {};
    const known = new Set<string>();
    for (const c of t.columns) {
        known.add(c.field);
        const v = obj[c.field];
        if (v === undefined || v === null) { row[c.column] = null; continue; }
        if (fits(c, v)) row[c.column] = v;
        else { row[c.column] = null; extra[c.field] = v; } // keep odd values losslessly
    }
    for (const [k, v] of Object.entries(obj)) if (!known.has(k) && v !== undefined) extra[k] = v;
    row._extra = extra;
    return row;
}

function fromRow(t: TableDef, row: Row): Obj {
    const obj: Obj = {};
    for (const c of t.columns) {
        const v = row[c.column];
        if (v === null || v === undefined) { if (!c.omitIfNull) obj[c.field] = null; continue; }
        obj[c.field] = v;
    }
    const extra = row._extra as Obj | null;
    if (extra) Object.assign(obj, extra);
    return obj;
}

const pkOf = (t: TableDef, obj: Obj) => t.pk.map((f) => String(obj[f])).join("\u0000");

// Current contents of a collection as plain objects, in list order
function currentObjects(t: TableDef): Obj[] {
    const value = S.store![t.key];
    if (t.kind === "orgMap") {
        return Object.entries(value as Record<string, unknown>).map(([orgId, settings]) => ({ orgId, settings }));
    }
    return value as Obj[];
}

function replaceCollection(t: TableDef, objs: Obj[]) {
    const value = S.store![t.key];
    if (t.kind === "orgMap") {
        const map = value as Record<string, unknown>;
        for (const k of Object.keys(map)) delete map[k];
        for (const o of objs) map[o.orgId as string] = o.settings;
        return;
    }
    const arr = value as Obj[];
    arr.length = 0;
    arr.push(...objs);
}

// ─── Load ─────────────────────────────────────────────────────
async function loadTables(client: PoolClient, tables: TableDef[]) {
    for (const t of tables) {
        const { rows } = await client.query(`select * from ${tableRef(t)} order by _position, ${t.pk.map((f) => qi(t.columns.find((c) => c.field === f)!.column)).join(", ")}`);
        const objs: Obj[] = [];
        const state: TableState = { rows: new Map(), positions: new Map() };
        for (const r of rows as Row[]) {
            const obj = fromRow(t, r);
            const pk = pkOf(t, obj);
            objs.push(obj);
            state.positions.set(pk, r._position as number);
            state.rows.set(pk, JSON.stringify(toRow(t, obj)));
        }
        replaceCollection(t, objs);
        S.snapshot.set(t.table, state);
    }
}

async function readVersions(client: PoolClient): Promise<Map<string, number>> {
    const { rows } = await client.query(`select table_name, version from ${qi(DB_SCHEMA)}._sync_state`);
    return new Map((rows as { table_name: string; version: number }[]).map((r) => [r.table_name, Number(r.version)]));
}

async function hydrate() {
    const client = await pool().connect();
    try {
        await client.query("begin isolation level repeatable read read only");
        S.versions = await readVersions(client);
        await loadTables(client, TABLES);
        await client.query("commit");
        const rows = TABLES.reduce((n, t) => n + (S.snapshot.get(t.table)?.rows.size ?? 0), 0);
        if (rows === 0) console.warn("[db] Supabase crm schema is empty — run `npm run db:seed` to load the demo data");
        else console.log(`[db] loaded ${rows} rows from Supabase (${TABLES.length} tables)`);
    } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

/** Make sure this process has Supabase's current data. Safe to call often. */
export async function ensureFresh(): Promise<void> {
    if (!dbEnabled() || !S.store) return;
    if (!S.hydrated) {
        S.hydrated = hydrate().catch((e) => { S.hydrated = null; throw e; });
        S.lastCheck = Date.now();
    }
    await S.hydrated;
    if (Date.now() - S.lastCheck < FRESHNESS_MS) return;
    S.checking ??= (async () => {
        try {
            await S.flushing; // push our own pending writes first
            const client = await pool().connect();
            try {
                const remote = await readVersions(client);
                const stale = TABLES.filter((t) => (remote.get(t.table) ?? 0) !== (S.versions.get(t.table) ?? 0));
                if (stale.length) {
                    await client.query("begin isolation level repeatable read read only");
                    const fresh = await readVersions(client);
                    await loadTables(client, stale);
                    await client.query("commit");
                    for (const t of stale) S.versions.set(t.table, fresh.get(t.table) ?? 0);
                }
            } finally {
                client.release();
            }
            S.lastCheck = Date.now();
        } finally {
            S.checking = null;
        }
    })();
    await S.checking;
}

// ─── Save ─────────────────────────────────────────────────────
interface TableDiff {
    t: TableDef;
    upserts: Row[];
    deletes: string[][]; // pk values
    next: TableState;
}

// Keeps existing positions where the order is unchanged; slots new rows in between
function assignPositions(pks: string[], prev: Map<string, number>): Map<string, number> {
    const out = new Map<string, number>();
    const known = pks.map((pk) => prev.get(pk));
    const existing = known.filter((p): p is number => p !== undefined);
    const ordered = existing.every((p, i) => i === 0 || p > existing[i - 1]);
    if (!ordered) {
        pks.forEach((pk, i) => out.set(pk, (i + 1) * 1024));
        return out;
    }
    let i = 0;
    while (i < pks.length) {
        if (known[i] !== undefined) { out.set(pks[i], known[i]!); i++; continue; }
        let j = i;
        while (j < pks.length && known[j] === undefined) j++;
        const lo = i > 0 ? out.get(pks[i - 1])! : undefined;
        const hi = j < pks.length ? known[j]! : undefined;
        const n = j - i;
        for (let k = 0; k < n; k++) {
            const pos = lo === undefined && hi === undefined ? (k + 1) * 1024
                : lo === undefined ? hi! - (n - k) * 1024
                : hi === undefined ? lo + (k + 1) * 1024
                : lo + ((hi - lo) * (k + 1)) / (n + 1);
            out.set(pks[i + k], pos);
        }
        i = j;
    }
    return out;
}

function diffTable(t: TableDef): TableDiff | null {
    const prev = S.snapshot.get(t.table) ?? { rows: new Map(), positions: new Map() };
    const objs = currentObjects(t);
    const seen = new Set<string>();
    const list: { pk: string; obj: Obj }[] = [];
    for (const obj of objs) {
        if (!obj || typeof obj !== "object") continue;
        const pk = pkOf(t, obj);
        if (seen.has(pk)) { console.warn(`[db] ${t.table}: duplicate key ${pk.replace(/\u0000/g, "/")} ignored`); continue; }
        seen.add(pk);
        list.push({ pk, obj });
    }
    const positions = assignPositions(list.map((x) => x.pk), prev.positions);
    const next: TableState = { rows: new Map(), positions };
    const upserts: Row[] = [];
    for (const { pk, obj } of list) {
        const row = toRow(t, obj);
        const json = JSON.stringify(row);
        next.rows.set(pk, json);
        if (prev.rows.get(pk) !== json || prev.positions.get(pk) !== positions.get(pk)) {
            upserts.push({ ...row, _position: positions.get(pk) });
        }
    }
    const deletes = [...prev.rows.keys()].filter((pk) => !seen.has(pk)).map((pk) => pk.split("\u0000"));
    if (!upserts.length && !deletes.length) return null;
    return { t, upserts, deletes, next };
}

async function writeDiff(client: PoolClient, d: TableDiff) {
    const { t } = d;
    const pkCols = t.pk.map((f) => qi(t.columns.find((c) => c.field === f)!.column));
    if (d.deletes.length) {
        if (pkCols.length === 1) {
            await client.query(`delete from ${tableRef(t)} where ${pkCols[0]} = any($1::text[])`, [d.deletes.map((k) => k[0])]);
        } else {
            for (const k of d.deletes) {
                await client.query(`delete from ${tableRef(t)} where ${pkCols.map((c, i) => `${c} = $${i + 1}`).join(" and ")}`, k);
            }
        }
    }
    if (d.upserts.length) {
        const cols = [...t.columns.map((c) => qi(c.column)), "_extra", "_position"];
        const updates = cols.filter((c) => !pkCols.includes(c)).map((c) => `${c} = excluded.${c}`).join(", ");
        await client.query(
            `insert into ${tableRef(t)} (${cols.join(", ")})
             select ${cols.join(", ")} from jsonb_populate_recordset(null::${tableRef(t)}, $1::jsonb)
             on conflict (${pkCols.join(", ")}) do update set ${updates}`,
            [JSON.stringify(d.upserts)],
        );
    }
}

async function flushNow() {
    if (!dbEnabled() || !S.store || !S.hydrated) return;
    await S.hydrated;
    const diffs = TABLES.map(diffTable).filter((d): d is TableDiff => d !== null);
    if (!diffs.length) return;
    const client = await pool().connect();
    try {
        await client.query("begin");
        await client.query("set constraints all deferred");
        for (const d of diffs) await writeDiff(client, d);
        // Our own writes bumped these versions; remember them so we don't reload our own data
        const versions = await readVersions(client);
        await client.query("commit");
        for (const d of diffs) {
            S.snapshot.set(d.t.table, d.next);
            S.versions.set(d.t.table, versions.get(d.t.table) ?? 0);
        }
    } catch (e) {
        await client.query("rollback").catch(() => {});
        console.error(`[db] save failed (${diffs.map((d) => d.t.table).join(", ")}):`, e instanceof Error ? e.message : e);
        await flushRowByRow(diffs);
    } finally {
        client.release();
    }
}

// Fallback when the batch is rejected: save what can be saved, report the rest
async function flushRowByRow(diffs: TableDiff[]) {
    const client = await pool().connect();
    try {
        for (const d of diffs) {
            const state = S.snapshot.get(d.t.table) ?? { rows: new Map(), positions: new Map() };
            if (d.deletes.length) {
                try { await writeDiff(client, { ...d, upserts: [] }); for (const k of d.deletes) { state.rows.delete(k.join("\u0000")); state.positions.delete(k.join("\u0000")); } }
                catch (e) { console.error(`[db] ${d.t.table}: delete failed:`, e instanceof Error ? e.message : e); }
            }
            for (const row of d.upserts) {
                const pk = d.t.pk.map((f) => String(row[d.t.columns.find((c) => c.field === f)!.column])).join("\u0000");
                try {
                    await writeDiff(client, { ...d, upserts: [row], deletes: [] });
                    state.rows.set(pk, d.next.rows.get(pk)!);
                    state.positions.set(pk, row._position as number);
                } catch (e) {
                    console.error(`[db] ${d.t.table} ${pk.replace(/\u0000/g, "/")}: not saved:`, e instanceof Error ? e.message : e);
                }
            }
            S.snapshot.set(d.t.table, state);
        }
        const versions = await readVersions(client);
        for (const d of diffs) S.versions.set(d.t.table, versions.get(d.t.table) ?? 0);
    } finally {
        client.release();
    }
}

/** Write all pending changes to Supabase. Calls are serialised and coalesced. */
export function flush(): Promise<void> {
    if (!dbEnabled()) return Promise.resolve();
    if (S.flushQueued) return S.flushing;
    S.flushQueued = true;
    S.flushing = S.flushing.then(() => {
        S.flushQueued = false;
        return flushNow();
    }).catch((e) => console.error("[db] flush error:", e instanceof Error ? e.message : e));
    return S.flushing;
}
