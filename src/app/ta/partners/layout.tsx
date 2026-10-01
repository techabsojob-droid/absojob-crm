import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/requireWorkspace";

// Team-level view: recruiters are sent to their own performance page
export default async function Layout({ children }: { children: React.ReactNode }) {
    const user = await requireWorkspace("TA");
    if (user.role === "TA_RECRUITER") redirect("/ta/performance");
    return <>{children}</>;
}
