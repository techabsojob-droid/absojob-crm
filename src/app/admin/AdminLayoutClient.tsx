"use client";

import { useState } from "react";
import Sidebar, { NavGroup } from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";
import {
    LayoutDashboard, Building2, Briefcase, Users, Wallet,
    BarChart3, Megaphone, ScrollText, Settings, CalendarClock,
    Award, CheckSquare, TrendingUp, ShieldCheck, Sparkles, SlidersHorizontal, UserCheck, HelpCircle
} from "lucide-react";

const ADMIN_NAV_GROUPS: NavGroup[] = [
    {
        groupTitle: "MAIN",
        items: [
            { label: "Overview", icon: LayoutDashboard, href: "/admin/dashboard" },
        ],
    },
    {
        groupTitle: "RECRUITMENT",
        items: [
            { label: "Jobs", icon: Briefcase, href: "/admin/jobs" },
            { label: "Candidates", icon: Users, href: "/admin/candidates" },
            { label: "Interviews", icon: CalendarClock, href: "/admin/interviews" },
            { label: "Placements", icon: Award, href: "/admin/placements" },
            { label: "Tasks & Follow-ups", icon: CheckSquare, href: "/admin/tasks" },
        ],
    },
    {
        groupTitle: "BUSINESS",
        items: [
            { label: "Clients", icon: Building2, href: "/admin/clients" },
            { label: "Client Leads", icon: UserCheck, href: "/admin/client-leads" },
            { label: "Finance", icon: Wallet, href: "/admin/finance" },
        ],
    },
    {
        groupTitle: "TEAM",
        items: [
            { label: "Team", icon: Users, href: "/admin/team" },
            { label: "Performance", icon: TrendingUp, href: "/admin/performance" },
        ],
    },
    {
        groupTitle: "INSIGHTS",
        items: [
            { label: "Reports", icon: BarChart3, href: "/admin/reports" },
            { label: "Announcements", icon: Megaphone, href: "/admin/announcements" },
        ],
    },
    {
        groupTitle: "CONTROL",
        items: [
            { label: "Approvals", icon: ShieldCheck, href: "/admin/approvals", badge: 3, badgeTone: "amber" },
            { label: "Compliance", icon: Sparkles, href: "/admin/compliance" },
            { label: "Data Quality", icon: Sparkles, href: "/admin/data-quality", badge: 5, badgeTone: "neutral" },
            { label: "Audit Log", icon: ScrollText, href: "/admin/audit-log" },
        ],
    },
    {
        groupTitle: "SYSTEM",
        items: [
            { label: "Integrations", icon: SlidersHorizontal, href: "/admin/integrations" },
            { label: "Settings", icon: Settings, href: "/admin/settings" },
            { label: "Help & Support", icon: HelpCircle, href: "/admin/help" },
        ],
    },
];

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <Sidebar groups={ADMIN_NAV_GROUPS} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
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
