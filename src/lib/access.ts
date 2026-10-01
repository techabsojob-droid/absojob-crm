// ─── Workspace access (single source of truth) ───────────────
// Used by the proxy, every workspace layout and the workspace switcher.

import type { UserRole } from "@/lib/types";

export type Workspace = "ADMIN" | "TA" | "HR" | "FINANCE" | "PORTAL";

export const WORKSPACE_PREFIX: Record<Workspace, string> = {
    ADMIN: "/admin",
    TA: "/ta",
    HR: "/hr",
    FINANCE: "/finance",
    PORTAL: "/portal",
};

export const WORKSPACE_LABEL: Record<Workspace, string> = {
    ADMIN: "Admin Console",
    TA: "Recruitment (TA)",
    HR: "HRMIS",
    FINANCE: "Finance",
    PORTAL: "My Workspace",
};

const ACCESS: Record<UserRole, Workspace[]> = {
    SUPER_ADMIN: ["ADMIN", "TA", "HR", "FINANCE", "PORTAL"],
    HR_ADMIN: ["HR", "PORTAL"],
    FINANCE_ADMIN: ["FINANCE", "PORTAL"],
    TA_MANAGER: ["TA", "PORTAL"],
    TA_RECRUITER: ["TA", "PORTAL"],
    AGENT: ["PORTAL"],
    EMPLOYEE: ["PORTAL"],
};

export function workspacesFor(role: UserRole): Workspace[] {
    return ACCESS[role] ?? ["PORTAL"];
}

export function canAccessWorkspace(role: UserRole, ws: Workspace): boolean {
    return workspacesFor(role).includes(ws);
}

export function workspaceOfPath(pathname: string): Workspace | null {
    for (const [ws, prefix] of Object.entries(WORKSPACE_PREFIX) as [Workspace, string][]) {
        if (pathname === prefix || pathname.startsWith(prefix + "/")) return ws;
    }
    return null;
}
