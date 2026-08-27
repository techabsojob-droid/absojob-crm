"use client";

import { useState } from "react";
import Sidebar, { NavItem } from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";
import {
    LayoutDashboard, Building2, Briefcase, Users, Wallet,
    BarChart3, Megaphone, ScrollText, Settings,
} from "lucide-react";

const NAV_ITEMS: NavItem[] = [
    { label: "Overview", icon: LayoutDashboard, href: "/admin/dashboard" },
    { label: "Clients", icon: Building2, href: "/admin/clients" },
    { label: "Jobs", icon: Briefcase, href: "/admin/jobs" },
    { label: "Candidates", icon: Users, href: "/admin/candidates" },
    { label: "Team", icon: Users, href: "/admin/team" },
    { label: "Finance", icon: Wallet, href: "/admin/finance" },
    { label: "Reports", icon: BarChart3, href: "/admin/reports" },
    { label: "Announcements", icon: Megaphone, href: "/admin/announcements" },
    { label: "Audit Log", icon: ScrollText, href: "/admin/audit-log" },
    { label: "Settings", icon: Settings, href: "/admin/settings" },
];

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
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
