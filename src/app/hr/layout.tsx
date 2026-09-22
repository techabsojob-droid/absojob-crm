import type { Metadata } from "next";
import HrLayoutClient from "./HrLayoutClient";

export const metadata: Metadata = {
    title: "HRMIS — AbsoJob",
    description: "Human Resource Management Information System",
};

export default function HrLayout({ children }: { children: React.ReactNode }) {
    return <HrLayoutClient>{children}</HrLayoutClient>;
}
