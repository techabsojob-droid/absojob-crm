"use client";

import { useQuery } from "@tanstack/react-query";
import type { NavGroup, NavItem } from "@/components/shared/Sidebar";
import AppShell from "@/components/shared/AppShell";
import {
    LayoutDashboard, UserPlus, Wallet, CalendarCheck, CalendarOff, CheckSquare, User, FileText, TrendingUp, Laptop,
    GraduationCap, CalendarClock, ClipboardList, Receipt, Briefcase, PartyPopper, Landmark, Users, Contact,
    Megaphone, BookOpen, HeartHandshake, Rocket,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

// Staff with an HR record get full self-service, grouped the way employees think about it
const STAFF_GROUPS = (isManager: boolean, onboarding: boolean): NavGroup[] => [
    {
        groupTitle: "ME",
        items: [
            { label: "Dashboard", icon: LayoutDashboard, href: "/portal/dashboard" },
            { label: "My Profile", icon: User, href: "/portal/profile" },
            ...(onboarding ? [{ label: "Joining Checklist", icon: Rocket, href: "/portal/onboarding" }] : []),
            { label: "My Documents", icon: FileText, href: "/portal/profile?tab=documents" },
            { label: "My Assets", icon: Laptop, href: "/portal/profile?tab=assets" },
        ],
    },
    {
        groupTitle: "TIME",
        items: [
            { label: "Attendance", icon: CalendarCheck, href: "/portal/attendance" },
            { label: "Leave", icon: CalendarOff, href: "/portal/leave" },
            { label: "Holidays", icon: PartyPopper, href: "/portal/holidays" },
        ],
    },
    {
        groupTitle: "PAY",
        items: [
            { label: "Payslips & Salary", icon: Wallet, href: "/portal/payslips" },
            { label: "Tax & Form 16", icon: Landmark, href: "/portal/tax" },
            { label: "Expenses", icon: Receipt, href: "/portal/expenses" },
            { label: "Benefits", icon: HeartHandshake, href: "/portal/benefits" },
        ],
    },
    {
        groupTitle: "WORK & GROWTH",
        items: [
            ...(isManager ? [{ label: "My Team", icon: Users, href: "/portal/team" }] : []),
            { label: "Tasks", icon: CheckSquare, href: "/portal/tasks" },
            { label: "Performance & Goals", icon: TrendingUp, href: "/portal/performance" },
            { label: "Training", icon: GraduationCap, href: "/portal/training" },
            { label: "Interview Panel", icon: CalendarClock, href: "/portal/interviews" },
            { label: "Refer & Earn", icon: UserPlus, href: "/portal/referrals" },
            { label: "Open Jobs", icon: Briefcase, href: "/portal/jobs" },
        ],
    },
    {
        groupTitle: "COMPANY & HELP",
        items: [
            { label: "Requests & Letters", icon: ClipboardList, href: "/portal/requests" },
            { label: "Announcements", icon: Megaphone, href: "/portal/announcements" },
            { label: "Policies", icon: BookOpen, href: "/portal/policies" },
            { label: "People Directory", icon: Contact, href: "/portal/directory" },
        ],
    },
];

// External recruitment partners: jobs, referrals, earnings and their own KYC — no HR self-service
const AGENT_ITEMS: NavItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/portal/dashboard" },
    { label: "Open Jobs", icon: Briefcase, href: "/portal/jobs" },
    { label: "My Referrals", icon: UserPlus, href: "/portal/referrals" },
    { label: "My Earnings", icon: Wallet, href: "/portal/incentives" },
    { label: "My Tasks", icon: CheckSquare, href: "/portal/tasks" },
    { label: "Profile & KYC", icon: User, href: "/portal/profile" },
];

export default function PortalLayoutClient({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const isAgent = user?.role === "AGENT";
    // Manager-only and new-joiner entries appear only when relevant
    const { data: me } = useQuery<{ directReports: unknown[] }>({ queryKey: ["portal-me"], queryFn: async () => (await fetch("/api/portal/me")).json(), enabled: !!user && !isAgent, staleTime: 60000 });
    const { data: onb } = useQuery<{ onboarding: { status: string } | null }>({ queryKey: ["my-onboarding"], queryFn: async () => (await fetch("/api/portal/onboarding")).json(), enabled: !!user && !isAgent, staleTime: 60000 });

    return isAgent
        ? <AppShell items={AGENT_ITEMS}>{children}</AppShell>
        : <AppShell groups={STAFF_GROUPS((me?.directReports?.length ?? 0) > 0, !!onb?.onboarding && onb.onboarding.status !== "COMPLETED")}>{children}</AppShell>;
}
