import { after } from "next/server";
import { dbEnabled, ensureFresh, flush } from "./sync";

const TIMER_KEY = "__absojobDbFlushTimer__";

/**
 * Call at the start of every request: loads Supabase's latest data, then saves
 * whatever the request changed once the response has been sent.
 */
export async function syncRequest(): Promise<void> {
    if (!dbEnabled()) return;
    await ensureFresh();
    try {
        after(flush);
    } catch {
        // Outside a request scope (scripts, proxy) — the interval below still saves
    }
    // Safety net for changes made outside a request
    const g = globalThis as Record<string, unknown>;
    if (!g[TIMER_KEY]) {
        const t = setInterval(() => { void flush(); }, 2000);
        (t as { unref?: () => void }).unref?.();
        g[TIMER_KEY] = t;
    }
}

export function dbErrorResponse(e: unknown): Response {
    console.error("[db] Supabase unavailable:", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "Database is unreachable. Please try again in a moment." }), {
        status: 503,
        headers: { "content-type": "application/json" },
    });
}
