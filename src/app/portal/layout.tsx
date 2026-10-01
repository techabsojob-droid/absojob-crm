import { requireWorkspace } from "@/lib/requireWorkspace";
import PortalLayoutClient from "./PortalLayoutClient";

export default async function Layout({ children }: { children: React.ReactNode }) {
    await requireWorkspace("PORTAL");
    return <PortalLayoutClient>{children}</PortalLayoutClient>;
}
