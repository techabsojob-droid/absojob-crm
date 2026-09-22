"use client";

import { useState } from "react";
import Sidebar, { NavItem } from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";
import {
    LayoutDashboard, UserPlus, Wallet, CalendarCheck, CalendarOff,
    CheckSquare, User, FileText, TrendingUp, Laptop, GraduationCap,
} from "lucide-react";

const NAV_ITEMS: NavItem[] = [
    { label: "My Dashboard", icon: LayoutDashboard, href: "/portal/dashboard" },
    { label: "My Profile", icon: User, href: "/portal/profile" },
    { label: "My Attendance", icon: CalendarCheck, href: "/portal/attendance" },
    { label: "My Leave", icon: CalendarOff, href: "/portal/leave" },
    { label: "My Payslips", icon: Wallet, href: "/portal/incentives" },
    { label: "My Documents", icon: FileText, href: "/portal/profile?tab=documents" },
    { label: "My Performance", icon: TrendingUp, href: "/portal/profile?tab=performance" },
    { label: "My Assets", icon: Laptop, href: "/portal/profile?tab=assets" },
    { label: "My Referrals", icon: UserPlus, href: "/portal/referrals" },
    { label: "My Requests & Tasks", icon: CheckSquare, href: "/portal/tasks" },
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
