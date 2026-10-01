"use client";

import { useState } from "react";
import Sidebar, { NavGroup } from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";
import {
    LayoutDashboard, Briefcase, GitBranch, Users, CalendarClock, CheckSquare,
    BarChart3, UserPlus, ShieldCheck, Building2, CalendarCheck, Target, MessageSquareText, Handshake
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const MANAGER_ONLY = new Set(["/ta/approvals", "/ta/reports", "/ta/partners"]);

const TA_NAV_GROUPS: NavGroup[] = [
    {
        groupTitle: "WORKSPACE",
        items: [
            { label: "Overview", icon: LayoutDashboard, href: "/ta/dashboard", tooltipHint: "TA Command Center" },
        ],
    },
    {
        groupTitle: "RECRUITMENT",
        items: [
            { label: "Requisitions", icon: Briefcase, href: "/ta/requisitions", badgeKey: "requisitions", badgeTone: "amber", tooltipHint: "Urgent requisitions needing attention" },
            { label: "Pipeline", icon: GitBranch, href: "/ta/pipeline", badgeKey: "pipeline", badgeTone: "neutral", tooltipHint: "Candidates requiring next action" },
            { label: "Candidates", icon: Users, href: "/ta/candidates", badgeKey: "candidates", badgeTone: "emerald", tooltipHint: "Total talent pool" },
            { label: "Interviews", icon: CalendarClock, href: "/ta/interviews", badgeKey: "interviews", badgeTone: "blue", tooltipHint: "Interviews scheduled today" },
            { label: "Offers & Joinings", icon: CalendarCheck, href: "/ta/joinings", tooltipHint: "Offers out, joining dates and dropout risk" },
            { label: "Referrals", icon: UserPlus, href: "/ta/referrals", tooltipHint: "Agent & employee referrals to review" },
            { label: "Tasks", icon: CheckSquare, href: "/ta/tasks", badgeKey: "tasks", badgeTone: "red", tooltipHint: "Tasks due today or overdue" },
        ],
    },
    {
        groupTitle: "CLIENTS & PARTNERS",
        items: [
            { label: "My Clients", icon: Building2, href: "/ta/clients", tooltipHint: "Client contacts, CV feedback and communication log" },
            { label: "Templates", icon: MessageSquareText, href: "/ta/templates", tooltipHint: "Email / WhatsApp message templates" },
            { label: "Partners", icon: Handshake, href: "/ta/partners", tooltipHint: "External recruiters — KYC and performance" },
        ],
    },
    {
        groupTitle: "INSIGHTS",
        items: [
            { label: "My Performance", icon: Target, href: "/ta/performance", tooltipHint: "Targets vs actuals, funnel and incentives" },
            { label: "Approvals", icon: ShieldCheck, href: "/ta/approvals", badgeKey: "approvals", badgeTone: "amber", tooltipHint: "Requisition requests awaiting your decision" },
            { label: "Reports", icon: BarChart3, href: "/ta/reports", tooltipHint: "Recruitment analytics & funnel reports" },
        ],
    },
];

export default function TaLayoutClient({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const { user } = useAuth();
    // Recruiters don't approve requisitions; hide manager-only entries for them
    const groups = user?.role === "TA_RECRUITER"
        ? TA_NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !MANAGER_ONLY.has(i.href)) }))
        : TA_NAV_GROUPS;

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <Sidebar groups={groups} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
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
