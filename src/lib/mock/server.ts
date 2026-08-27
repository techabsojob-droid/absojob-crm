import { cookies } from "next/headers";
import type { User } from "@/lib/types";
import { SESSION_COOKIE, users } from "./data";

export async function getSessionUser(): Promise<User | null> {
    const store = await cookies();
    const id = store.get(SESSION_COOKIE)?.value;
    if (!id) return null;
    return users.find((u) => u.id === id) ?? null;
}

/** Throws a 401/403 Response if not permitted; returns user otherwise. */
export async function requireRole(...allowed: User["role"][]): Promise<{ user: User } | { error: Response }> {
    const user = await getSessionUser();
    if (!user || user.status !== "ACTIVE") {
        return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };
    }
    if (allowed.length > 0 && !allowed.includes(user.role)) {
        return { error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) };
    }
    return { user };
}
