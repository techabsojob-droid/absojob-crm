import { cookies } from "next/headers";
import type { User } from "@/lib/types";
import { SESSION_COOKIE, users } from "./data";
import { verifySession } from "@/lib/session";
import { dbErrorResponse, syncRequest } from "@/lib/db/request";
// Imported for its bootstrap side effect: links every staff login to an Employee record
import "./identity";

export async function getSessionUser(): Promise<User | null> {
    // Read the cookie before touching the database: this marks the page dynamic,
    // so `next build` never needs DATABASE_URL while prerendering
    const store = await cookies();
    const id = await verifySession(store.get(SESSION_COOKIE)?.value);
    if (!id) return null;
    await syncRequest();
    return users.find((u) => u.id === id) ?? null;
}

/** Throws a 401/403 Response if not permitted; returns user otherwise. */
export async function requireRole(...allowed: User["role"][]): Promise<{ user: User } | { error: Response }> {
    let user: User | null;
    try {
        user = await getSessionUser();
    } catch (e) {
        return { error: dbErrorResponse(e) };
    }
    if (!user || user.status !== "ACTIVE") {
        return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };
    }
    if (allowed.length > 0 && !allowed.includes(user.role)) {
        return { error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) };
    }
    return { user };
}
