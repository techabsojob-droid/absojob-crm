"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { roleHome } from "@/lib/types";

export interface NavItem {
    label: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lucide icons and a few custom svg components
    icon: LucideIcon | any;
    href: string;
    badge?: number | string;
    badgeKey?: "requisitions" | "pipeline" | "candidates" | "interviews" | "tasks" | "approvals" | "dataQuality" | "overdueInvoices" | "toBill" | "expensesPending" | "payrollAwaiting";
    badgeTone?: "red" | "amber" | "emerald" | "blue" | "neutral";
    tooltipHint?: string;
}

export interface NavGroup {
    groupTitle?: string;
    items: NavItem[];
}

interface SidebarProps {
    items?: NavItem[];
    groups?: NavGroup[];
    collapsed: boolean;
    onToggle: () => void;
    /** Mobile drawer state (below lg the sidebar is off-canvas). */
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
}

type Badges = Partial<Record<NonNullable<NavItem["badgeKey"]>, number>> & { hasOverdueTasks?: boolean; hasSlaBreach?: boolean };

export const ROLE_LABEL: Record<string, string> = {
    SUPER_ADMIN: "Super Admin", TA_MANAGER: "TA Manager", TA_RECRUITER: "Recruiter", HR_ADMIN: "HR Admin",
    FINANCE_ADMIN: "Finance", AGENT: "Partner", EMPLOYEE: "Employee",
};

/** Most specific nav entry for the current path (e.g. /ta/requisitions/new beats /ta/requisitions). */
export function activeHref(pathname: string, groups: NavGroup[]): string | null {
    const matches = (href: string) => pathname === href || (pathname.startsWith(href + "/") && !href.endsWith("/dashboard"));
    let best: string | null = null;
    for (const g of groups) for (const i of g.items) if (matches(i.href) && (!best || i.href.length > best.length)) best = i.href;
    return best;
}

export default function Sidebar({ items, groups, collapsed, onToggle, mobileOpen = false, onCloseMobile }: SidebarProps) {
    const pathname = usePathname() ?? "";
    const { user, logout } = useAuth();
    const resolvedGroups: NavGroup[] = groups || (items ? [{ items }] : []);
    const current = activeHref(pathname, resolvedGroups);
    const [badges, setBadges] = useState<Badges>({});

    // Live counts, refreshed in the background; the sidebar never waits on them
    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                const res = await fetch("/api/ta/sidebar-badges");
                if (res.ok && alive) setBadges(await res.json());
            } catch { /* counts are optional */ }
        };
        load();
        const t = setInterval(load, 30000);
        return () => { alive = false; clearInterval(t); };
    }, []);

    const narrow = collapsed && !mobileOpen; // icon-only rail (desktop collapsed)

    return (
        <>
            {mobileOpen && <div className="fixed inset-0 z-40 bg-navy-deep/50 lg:hidden" onClick={onCloseMobile} aria-hidden />}
            <aside
                aria-label="Main navigation"
                className={`fixed top-0 left-0 z-50 h-screen flex flex-col bg-navy text-[#BDC9DC] transition-[width,transform] duration-200 ease-out
                    ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
                style={{ width: narrow ? "var(--sidebar-collapsed)" : "var(--sidebar-expanded)" }}
            >
                {/* Brand */}
                <div className={`h-[var(--topbar-height)] shrink-0 flex items-center border-b border-white/[0.07] ${narrow ? "justify-center" : "px-5 gap-3"}`}>
                    <Link href={user?.role ? roleHome(user.role) : "/login"} className="flex items-center gap-3 min-w-0" aria-label="AbsoJob home">
                        <span className="w-8 h-8 rounded-md bg-accent text-white flex items-center justify-center text-[13px] font-bold tracking-tight shrink-0">AJ</span>
                        {!narrow && (
                            <span className="min-w-0 leading-tight">
                                <span className="block text-[15px] font-semibold text-white tracking-tight">AbsoJob</span>
                                <span className="block text-[11px] text-[#94A6C3] truncate">{user ? ROLE_LABEL[user.role] ?? "Workspace" : "Recruitment CRM"}</span>
                            </span>
                        )}
                    </Link>
                    {mobileOpen && <button onClick={onCloseMobile} className="ml-auto p-1.5 rounded-md text-[#94A6C3] hover:text-white hover:bg-white/10 lg:hidden" aria-label="Close menu"><X size={18} /></button>}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-3">
                    {resolvedGroups.map((grp, gi) => (
                        <div key={gi} className={gi ? "mt-4" : ""}>
                            {grp.groupTitle && (narrow
                                ? <div className="h-px bg-white/[0.07] mx-4 mb-2" />
                                : <p className="px-5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6A82A6]">{grp.groupTitle}</p>)}
                            <ul className={narrow ? "px-2 space-y-0.5" : "px-3 space-y-0.5"}>
                                {grp.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = current === item.href;
                                    const raw = item.badgeKey ? badges[item.badgeKey] : item.badge;
                                    const badge = raw !== undefined && raw !== null && (typeof raw === "string" || raw > 0) ? raw : undefined;
                                    const alert = (item.badgeKey === "tasks" && badges.hasOverdueTasks) || (item.badgeKey === "requisitions" && badges.hasSlaBreach) || item.badgeTone === "red";
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                onClick={onCloseMobile}
                                                aria-current={isActive ? "page" : undefined}
                                                title={narrow ? item.label : item.tooltipHint}
                                                className={`group relative flex items-center h-9 rounded-md text-[13px] transition-colors
                                                    ${narrow ? "justify-center" : "gap-3 px-3"}
                                                    ${isActive ? "bg-white/[0.09] text-white font-medium" : "hover:bg-white/[0.05] hover:text-white"}`}
                                            >
                                                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent" aria-hidden />}
                                                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} className={`shrink-0 ${isActive ? "text-white" : "text-[#94A6C3] group-hover:text-white"}`} />
                                                {!narrow && <span className="flex-1 truncate">{item.label}</span>}
                                                {!narrow && badge !== undefined && (
                                                    <span className={`min-w-5 h-5 px-1.5 rounded text-[11px] font-semibold tabular-nums flex items-center justify-center ${alert ? "bg-accent text-white" : "bg-white/10 text-[#DEE4EE]"}`}>{badge}</span>
                                                )}
                                                {narrow && badge !== undefined && <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${alert ? "bg-accent" : "bg-[#94A6C3]"}`} />}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer: who's signed in, sign out, collapse */}
                <div className="shrink-0 border-t border-white/[0.07] p-3 space-y-1">
                    {!narrow && user && (
                        <div className="flex items-center gap-2.5 px-2 py-1.5">
                            <span className="w-7 h-7 rounded-full bg-white/10 text-white text-xs font-semibold flex items-center justify-center shrink-0">{user.name?.charAt(0) ?? "U"}</span>
                            <span className="min-w-0 leading-tight">
                                <span className="block text-[13px] text-white truncate">{user.name}</span>
                                <span className="block text-[11px] text-[#94A6C3] truncate">{ROLE_LABEL[user.role] ?? user.role}</span>
                            </span>
                        </div>
                    )}
                    <div className={`flex ${narrow ? "flex-col items-center gap-1" : "items-center gap-1"}`}>
                        <button onClick={logout} title="Sign out" className={`h-8 rounded-md text-[13px] flex items-center gap-2 hover:bg-white/[0.06] hover:text-white ${narrow ? "w-9 justify-center" : "flex-1 px-2"}`}>
                            <LogOut size={16} strokeWidth={1.8} />{!narrow && "Sign out"}
                        </button>
                        <button onClick={onToggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                            className="hidden lg:flex h-8 w-9 rounded-md items-center justify-center hover:bg-white/[0.06] hover:text-white">
                            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
