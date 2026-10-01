import { NextResponse } from "next/server";
import { requireRole } from "../server";

/** Finance-only guard (Super Admin + Finance Admin). */
export const requireFinance = () => requireRole("SUPER_ADMIN", "FINANCE_ADMIN");

export function respond<T>(r: { ok: true; value: T } | { ok: false; error: string; status: number }, created = false) {
    return r.ok ? NextResponse.json(r.value, { status: created ? 201 : 200 }) : NextResponse.json({ error: r.error }, { status: r.status });
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function body<T = Record<string, any>>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        return {} as T;
    }
}

export function csvResponse(csv: string, filename: string, type = "text/csv") {
    return new NextResponse(csv, { headers: { "Content-Type": `${type}; charset=utf-8`, "Content-Disposition": `attachment; filename="${filename}"` } });
}
