import { Pool, types as pgTypes } from "pg";

// One pool per server process (kept on globalThis so hot reload doesn't leak connections)
const KEY = "__absojobPgPool__";

// Read values back in the exact shape the app wrote them
const parsers: Record<number, (v: string) => unknown> = {
    1700: (v) => parseFloat(v), // numeric
    20: (v) => Number(v), // int8 (counts)
    1082: (v) => v, // date → "YYYY-MM-DD"
    1184: (v) => new Date(v.replace(" ", "T").replace(/\+00(:00)?$/, "Z")).toISOString(), // timestamptz → ISO
};
const typeConfig = {
    getTypeParser: ((oid: number, format?: "text" | "binary") =>
        parsers[oid] ?? pgTypes.getTypeParser(oid, format)) as typeof pgTypes.getTypeParser,
};

export function databaseUrl(): string | undefined {
    return process.env.DATABASE_URL;
}

export function pool(): Pool {
    const g = globalThis as Record<string, unknown>;
    if (!g[KEY]) {
        const url = databaseUrl();
        if (!url) throw new Error("DATABASE_URL is not set");
        const p = new Pool({
            connectionString: url,
            ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
            max: Number(process.env.DATABASE_POOL_MAX) || 5,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            types: typeConfig,
        });
        // timestamptz text is parsed assuming UTC
        p.on("connect", (c) => { c.query("set time zone 'UTC'").catch(() => {}); });
        p.on("error", (e) => console.error("[db] idle client error:", e.message));
        g[KEY] = p;
    }
    return g[KEY] as Pool;
}
