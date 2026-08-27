import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/mock/server";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();

    if (!user) {
        redirect("/login");
    }

    if (user.role !== "SUPER_ADMIN") {
        if (user.role === "TA_MANAGER" || user.role === "TA_RECRUITER") {
            redirect("/ta/dashboard");
        } else {
            redirect("/portal/dashboard");
        }
    }

    return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
