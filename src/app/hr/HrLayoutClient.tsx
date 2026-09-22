"use client";

import { useState } from "react";
import Sidebar, { NavItem } from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";
import {
    LayoutDashboard, Users, UserPlus, CalendarCheck, CalendarOff,
    Wallet, TrendingUp, Network, FileText, Laptop,
    GraduationCap, UserMinus, BarChart3, Settings,
} from "lucide-react";

const HR_NAV_ITEMS: NavItem[] = [
    { label: "HR Dashboard", icon: LayoutDashboard, href: "/hr/dashboard" },
    { label: "Employees", icon: Users, href: "/hr/employees" },
    { label: "Onboarding", icon: UserPlus, href: "/hr/onboarding" },
    { label: "Attendance", icon: CalendarCheck, href: "/hr/attendance" },
    { label: "Leave", icon: CalendarOff, href: "/hr/leave" },
    { label: "Payroll", icon: Wallet, href: "/hr/payroll" },
    { label: "Performance", icon: TrendingUp, href: "/hr/performance" },
    { label: "Organization", icon: Network, href: "/hr/organization" },
    { label: "Documents", icon: FileText, href: "/hr/documents" },
    { label: "Assets", icon: Laptop, href: "/hr/assets" },
    { label: "Training", icon: GraduationCap, href: "/hr/training" },
    { label: "Exit Management", icon: UserMinus, href: "/hr/exit" },
    { label: "Reports & Analytics", icon: BarChart3, href: "/hr/reports" },
    { label: "HR Settings", icon: Settings, href: "/hr/settings" },
];

export default function HrLayoutClient({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(true);

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <Sidebar items={HR_NAV_ITEMS} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
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
