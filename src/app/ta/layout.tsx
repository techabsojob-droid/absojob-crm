import { requireWorkspace } from "@/lib/requireWorkspace";
import TaLayoutClient from "./TaLayoutClient";

export default async function Layout({ children }: { children: React.ReactNode }) {
    await requireWorkspace("TA");
    return <TaLayoutClient>{children}</TaLayoutClient>;
}
