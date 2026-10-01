import type { Metadata } from "next";
import HrLayoutClient from "./HrLayoutClient";
import { requireWorkspace } from "@/lib/requireWorkspace";

export const metadata: Metadata = {
    title: "HRMIS — AbsoJob",
    description: "Human Resource Management Information System",
};

export default async function HrLayout({ children }: { children: React.ReactNode }) {
    await requireWorkspace("HR");
    return <HrLayoutClient>{children}</HrLayoutClient>;
}
