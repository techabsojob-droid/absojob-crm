import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/mock/server";
import { canAccessWorkspace, type Workspace } from "@/lib/access";
import { roleHome } from "@/lib/types";

/** Server-side guard for workspace layouts (defence in depth behind the proxy). */
export async function requireWorkspace(ws: Workspace) {
    const user = await getSessionUser();
    if (!user || user.status !== "ACTIVE") redirect("/login");
    if (!canAccessWorkspace(user.role, ws)) redirect(roleHome(user.role));
    return user;
}
