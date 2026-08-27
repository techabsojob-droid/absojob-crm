import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/mock/server";
import TaLayoutClient from "./TaLayoutClient";

export default async function TaLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();

    if (!user) {
        redirect("/login");
    }

    if (user.role !== "TA_MANAGER" && user.role !== "TA_RECRUITER") {
        redirect(user.role === "SUPER_ADMIN" ? "/admin/dashboard" : "/portal/dashboard");
    }

    return <TaLayoutClient>{children}</TaLayoutClient>;
}
