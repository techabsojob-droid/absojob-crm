"use client";

import type { NavGroup } from "@/components/shared/Sidebar";
import AppShell from "@/components/shared/AppShell";
import {
    LayoutDashboard, Briefcase, GitBranch, Users, CalendarClock, CheckSquare,
    BarChart3, UserPlus, ShieldCheck, Building2, CalendarCheck, Target, MessageSquareText, Handshake, PhoneCall,
    FilePlus2, Clock, Gauge, Crosshair
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const MANAGER_ONLY = new Set(["/ta/approvals", "/ta/reports", "/ta/partners", "/ta/requisitions/new"]);

const TA_NAV_GROUPS: NavGroup[] = [
    {
        groupTitle: "WORKSPACE",
        items: [
            { label: "Overview", icon: LayoutDashboard, href: "/ta/dashboard", tooltipHint: "TA Command Center" },
            { label: "Tasks", icon: CheckSquare, href: "/ta/tasks", badgeKey: "tasks", badgeTone: "red", tooltipHint: "Tasks due today or overdue" },
        ],
    },
    {
        groupTitle: "RECRUITMENT",
        items: [
            { label: "Create Requisition", icon: FilePlus2, href: "/ta/requisitions/new", tooltipHint: "Raise a new job requisition (save as draft or submit)" },
            { label: "All Openings", icon: Briefcase, href: "/ta/requisitions", badgeKey: "requisitions", badgeTone: "amber", tooltipHint: "Every opening you can work on — filter by industry, client, location, experience, status and more" },
            { label: "Pipeline", icon: GitBranch, href: "/ta/pipeline", badgeKey: "pipeline", badgeTone: "neutral", tooltipHint: "Candidates requiring next action" },
            { label: "Candidates", icon: Users, href: "/ta/candidates", badgeKey: "candidates", badgeTone: "emerald", tooltipHint: "Total talent pool" },
            { label: "Calls", icon: PhoneCall, href: "/ta/calls", tooltipHint: "Log calls with feedback and review call history" },
            { label: "Interviews", icon: CalendarClock, href: "/ta/interviews", badgeKey: "interviews", badgeTone: "blue", tooltipHint: "Interviews scheduled today" },
            { label: "Offers & Joinings", icon: CalendarCheck, href: "/ta/joinings", tooltipHint: "Offers out, joining dates and dropout risk" },
            { label: "Referrals", icon: UserPlus, href: "/ta/referrals", tooltipHint: "Agent & employee referrals to review" },
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
        groupTitle: "TEAM",
        items: [
            { label: "Attendance & Leave", icon: Clock, href: "/ta/attendance", tooltipHint: "Check in / out, apply leave, team attendance and approvals" },
            { label: "Recruiter KPIs", icon: Gauge, href: "/ta/kpis", tooltipHint: "Recruiter-wise KPIs: daily, weekly, monthly" },
            { label: "Targets", icon: Crosshair, href: "/ta/targets", tooltipHint: "Monthly targets, achievement % and shortfall" },
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
    const { user } = useAuth();
    // Recruiters don't approve requisitions; hide manager-only entries for them
    const groups = user?.role === "TA_RECRUITER"
        ? TA_NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !MANAGER_ONLY.has(i.href)) }))
        : TA_NAV_GROUPS;
    return <AppShell groups={groups}>{children}</AppShell>;
}
