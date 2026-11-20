import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { users, organizations, addAudit } from "@/lib/mock/data";
import { collectionRows } from "@/lib/db/sync";
import { TABLES } from "@/lib/db/registry.generated";
import { renderExport } from "@/lib/export-formats";

// Never leave the server, even in a Super Admin backup
const SECRET_FIELDS = new Set(["passwordHash", "mfaSecretEnc", "mfaPendingSecretEnc", "tempPasswordHash", "sessionSecret"]);

const clean = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !SECRET_FIELDS.has(k)));

/** Every table's rows that belong to this organisation. */
function orgSnapshot(orgId: string) {
    const memberIds = new Set(users.filter((u) => u.orgId === orgId).map((u) => u.id));
    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const t of TABLES) {
        const rows = collectionRows(t.key);
        let mine: Record<string, unknown>[];
        if (t.key === "organizations") mine = rows.filter((r) => r.id === orgId);
        else if (t.columns.some((c) => c.field === "orgId")) mine = rows.filter((r) => r.orgId === orgId);
        else if (t.columns.some((c) => c.field === "userId")) mine = rows.filter((r) => memberIds.has(String(r.userId)));
        else mine = rows; // shared reference data (e.g. leave policies)
        tables[t.key] = mine.map(clean);
    }
    return tables;
}

// Excel cells hold at most 32,767 characters
const CELL_MAX = 32000;
// Nested values go into one cell as JSON so the sheet stays flat; file contents stay in the JSON backup
const flat = (r: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => {
        if (k === "dataBase64" && typeof v === "string") return [k, `(file, ${Math.round((v.length * 3) / 4 / 1024)} KB, included in the JSON backup)`];
        const cell = v !== null && typeof v === "object" && !(Array.isArray(v) && v.every((x) => typeof x !== "object")) ? JSON.stringify(v) : v;
        return [k, typeof cell === "string" && cell.length > CELL_MAX ? `${cell.slice(0, CELL_MAX)}… (cut, see JSON backup)` : cell];
    }));

export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const format = new URL(request.url).searchParams.get("format") === "xlsx" ? "xlsx" : "json";
    const tables = orgSnapshot(me.orgId);
    const rowCount = Object.values(tables).reduce((s, r) => s + r.length, 0);
    const org = organizations.find((o) => o.id === me.orgId);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${(org?.slug || "absojob").replace(/[^a-z0-9-]/gi, "")}-backup-${stamp}`;

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "DATA_BACKUP_EXPORTED", entity: "Organization", entityId: me.orgId,
        detail: `Full backup downloaded (${format.toUpperCase()}, ${Object.keys(tables).length} tables, ${rowCount} records)`,
    });

    if (format === "xlsx") {
        return renderExport("xlsx", {
            title: `${org?.name ?? "Organisation"} backup`,
            subtitle: `Exported ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
            filename,
            sections: Object.entries(tables).map(([key, rows]) => ({ key, title: key, rows: rows.map(flat) })),
        });
    }

    const body = JSON.stringify({
        kind: "absojob-crm-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: { id: me.id, name: me.name },
        organization: { id: me.orgId, name: org?.name ?? null },
        counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
        tables,
    });
    return new NextResponse(body, {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}.json"`,
            "Cache-Control": "no-store",
        },
    });
}
