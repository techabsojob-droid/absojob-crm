import { cookies } from "next/headers";
import type { User } from "@/lib/types";
import { SESSION_COOKIE, users } from "./data";
import { readSession } from "@/lib/session";
import { maintenanceBlocks, sessionProblem } from "@/lib/security";
import { dbErrorResponse, syncRequest } from "@/lib/db/request";
// Imported for its bootstrap side effect: links every staff login to an Employee record
import "./identity";

/** The signed-in user, or null if signed out, expired, signed out by an admin or not ACTIVE. */
export async function getSessionUser(): Promise<User | null> {
    // Read the cookie before touching the database: this marks the page dynamic,
    // so `next build` never needs DATABASE_URL while prerendering
    const store = await cookies();
    const session = await readSession(store.get(SESSION_COOKIE)?.value);
    if (!session) return null;
    await syncRequest();
    const user = users.find((u) => u.id === session.userId);
    if (!user || sessionProblem(user, session)) return null;
    return user;
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
    if (maintenanceBlocks(user)) {
        return { error: new Response(JSON.stringify({ error: "The CRM is in maintenance mode. Please try again later.", code: "MAINTENANCE" }), { status: 503, headers: { "content-type": "application/json" } }) };
    }
    if (allowed.length > 0 && !allowed.includes(user.role)) {
        return { error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) };
    }
    return { user };
}
