"use client";

import { useState } from "react";
import Sidebar, { NavItem } from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";
import {
    LayoutDashboard, Briefcase, GitBranch, Users, CalendarClock, CheckSquare,
} from "lucide-react";

const NAV_ITEMS: NavItem[] = [
    { label: "Overview", icon: LayoutDashboard, href: "/ta/dashboard" },
    { label: "Requisitions", icon: Briefcase, href: "/ta/requisitions" },
    { label: "Pipeline", icon: GitBranch, href: "/ta/pipeline" },
    { label: "Candidates", icon: Users, href: "/ta/candidates" },
    { label: "Interviews", icon: CalendarClock, href: "/ta/interviews" },
    { label: "Tasks", icon: CheckSquare, href: "/ta/tasks" },
];

export default function TaLayoutClient({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(true);

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <Sidebar items={NAV_ITEMS} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
            <div
                className="flex-1 flex flex-col min-w-0"
                style={{ marginLeft: collapsed ? 80 : 250, transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)" }}
            >
                <TopBar />
                <main className="flex-1 p-8 w-full animate-fade-in">
                    {children}
                </main>
            </div>
        </div>
    );
}
