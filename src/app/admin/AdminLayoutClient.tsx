"use client";

import type { NavGroup } from "@/components/shared/Sidebar";
import AppShell from "@/components/shared/AppShell";
import {
    LayoutDashboard, Building2, Briefcase, Users, Wallet,
    BarChart3, Megaphone, ScrollText, Settings, CalendarClock,
    Award, CheckSquare, TrendingUp, ShieldCheck, Sparkles, SlidersHorizontal, UserCheck, HelpCircle, GitBranch, HeartHandshake, IdCard, UserPlus, ClipboardCheck } from "lucide-react";

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
            { label: "Pipeline", icon: GitBranch, href: "/ta/pipeline" },
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
            { label: "Finance", icon: Wallet, href: "/finance/dashboard" },
        ],
    },
    {
        groupTitle: "TEAM",
        items: [
            { label: "Team", icon: Users, href: "/admin/team" },
            { label: "HRMIS Dashboard", icon: HeartHandshake, href: "/hr/dashboard" },
            { label: "Employees", icon: IdCard, href: "/hr/employees" },
            { label: "Onboarding", icon: UserPlus, href: "/hr/onboarding" },
            { label: "HR Approvals", icon: ClipboardCheck, href: "/hr/approvals" },
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
            { label: "Approvals", icon: ShieldCheck, href: "/admin/approvals", badgeKey: "approvals", badgeTone: "amber" },
            { label: "Compliance", icon: Sparkles, href: "/admin/compliance" },
            { label: "Data Quality", icon: Sparkles, href: "/admin/data-quality", badgeKey: "dataQuality", badgeTone: "neutral" },
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
    return <AppShell groups={ADMIN_NAV_GROUPS}>{children}</AppShell>;
}
