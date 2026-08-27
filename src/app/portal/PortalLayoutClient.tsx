"use client";

import { useState } from "react";
import Sidebar, { NavItem } from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";
import {
    LayoutDashboard, UserPlus, Wallet, CalendarCheck, CalendarOff, CheckSquare, User,
} from "lucide-react";

const NAV_ITEMS: NavItem[] = [
    { label: "Home", icon: LayoutDashboard, href: "/portal/dashboard" },
    { label: "My Referrals", icon: UserPlus, href: "/portal/referrals" },
    { label: "Incentives", icon: Wallet, href: "/portal/incentives" },
    { label: "Attendance", icon: CalendarCheck, href: "/portal/attendance" },
    { label: "Leave", icon: CalendarOff, href: "/portal/leave" },
    { label: "Tasks", icon: CheckSquare, href: "/portal/tasks" },
    { label: "Profile", icon: User, href: "/portal/profile" },
];

export default function PortalLayoutClient({ children }: { children: React.ReactNode }) {
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
