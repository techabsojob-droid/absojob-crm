import { requireWorkspace } from "@/lib/requireWorkspace";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function Layout({ children }: { children: React.ReactNode }) {
    await requireWorkspace("ADMIN");
    return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
