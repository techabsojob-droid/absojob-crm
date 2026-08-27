import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/mock/server";
import PortalLayoutClient from "./PortalLayoutClient";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();

    if (!user) {
        redirect("/login");
    }

    const portalRoles = ["AGENT", "EMPLOYEE", "SUPER_ADMIN"];
    if (!portalRoles.includes(user.role)) {
        redirect(user.role === "SUPER_ADMIN" ? "/admin/dashboard" : "/ta/dashboard");
    }
    if (user.role === "SUPER_ADMIN") {
        // Super admin may inspect the field portal — allowed by design.
    }

    return <PortalLayoutClient>{children}</PortalLayoutClient>;
}
