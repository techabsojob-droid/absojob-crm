"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, Briefcase, GitBranch, Users, CalendarClock, CheckSquare,
    BarChart3, LogOut, ChevronLeft, ChevronRight, AlertCircle, Sparkles
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { roleHome } from "@/lib/types";

export interface NavItem {
    label: string;
    icon: any;
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
}

const COLLAPSED_W = 80;
const EXPANDED_W = 250;
const TRANSITION = "all 250ms cubic-bezier(0.4, 0, 0.2, 1)";

export default function Sidebar({ items, groups, collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const sidebarWidth = collapsed ? COLLAPSED_W : EXPANDED_W;
    const resolvedGroups: NavGroup[] = groups || (items ? [{ items }] : []);

    // Live Badges State
    const [badgeData, setBadgeData] = useState<{
        requisitions?: number;
        pipeline?: number;
        candidates?: number;
        interviews?: number;
        tasks?: number;
        approvals?: number;
        dataQuality?: number;
        overdueInvoices?: number;
        toBill?: number;
        expensesPending?: number;
        payrollAwaiting?: number;
        hasOverdueTasks?: boolean;
        hasSlaBreach?: boolean;
    }>({});

    // Fetch dynamic badge counts in background without blocking sidebar render
    useEffect(() => {
        let isMounted = true;
        async function fetchBadges() {
            try {
                const res = await fetch("/api/ta/sidebar-badges");
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setBadgeData(data);
                }
            } catch {
                // Keep UI fully functional even if badge API fails
            }
        }
        fetchBadges();
        const interval = setInterval(fetchBadges, 30000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    return (
        <>
            {/* Sidebar */}
            <aside
                className="fixed top-0 left-0 h-screen z-50 flex flex-col bg-white border-r border-neutral-200 py-6 overflow-hidden"
                style={{ width: sidebarWidth, transition: TRANSITION }}
            >
                {/* Brand / Logo Area */}
                <Link
                    href={user?.role ? roleHome(user.role) : "/login"}
                    className={`mb-6 flex items-center shrink-0 hover:opacity-90 transition-opacity ${collapsed ? "justify-center px-1" : "px-6 gap-3"}`}
                >
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white text-sm font-black tracking-tight shadow-md shadow-primary/20 shrink-0">
                        AJ
                    </div>
                    <div
                        className="flex flex-col whitespace-nowrap overflow-hidden"
                        style={{
                            width: collapsed ? 0 : "auto",
                            opacity: collapsed ? 0 : 1,
                            transition: TRANSITION,
                        }}
                    >
                        <span className="text-lg font-bold text-neutral-900 tracking-tight leading-none">
                            AbsoJob
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 mt-1">
                            {user?.role === "TA_MANAGER" ? "TA Manager" : user?.role === "TA_RECRUITER" ? "Recruitment" : user?.role === "FINANCE_ADMIN" ? "Finance" : "ATS Platform"}
                        </span>
                    </div>
                </Link>

                {/* Navigation Groups */}
                <nav className="flex-1 flex flex-col gap-5 w-full px-3 overflow-y-auto overflow-x-hidden no-scrollbar">
                    {resolvedGroups.map((grp, gIdx) => (
                        <div key={gIdx} className="space-y-1">
                            {grp.groupTitle && !collapsed && (
                                <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                                    {grp.groupTitle}
                                </p>
                            )}
                            {grp.groupTitle && collapsed && (
                                <div className="h-px bg-neutral-100 my-2 mx-2" />
                            )}
                            {grp.items.map((item) => {
                                const Icon = item.icon;
                                const isActive =
                                    pathname === item.href ||
                                    (pathname.startsWith(item.href + "/") && !item.href.endsWith("/dashboard"));

                                // Compute dynamic badge count if badgeKey is provided, or use static badge
                                const rawBadge = item.badgeKey ? badgeData[item.badgeKey] : item.badge;
                                const displayBadge = rawBadge !== undefined && rawBadge !== null && (typeof rawBadge === "string" || rawBadge > 0) ? rawBadge : undefined;

                                const isOverdueAlert = item.badgeKey === "tasks" && badgeData.hasOverdueTasks;
                                const isSlaAlert = item.badgeKey === "requisitions" && badgeData.hasSlaBreach;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`group relative flex items-center gap-3 rounded-xl transition-all ${
                                            isActive
                                                ? "bg-primary text-white shadow-lg shadow-primary/25 font-bold"
                                                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                                        }`}
                                        style={{
                                            padding: collapsed ? "10px" : "8px 12px",
                                            justifyContent: collapsed ? "center" : "flex-start",
                                            transition: TRANSITION,
                                        }}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                                        <span
                                            className="text-xs font-semibold whitespace-nowrap overflow-hidden flex-1"
                                            style={{
                                                width: collapsed ? 0 : "auto",
                                                opacity: collapsed ? 0 : 1,
                                                transition: TRANSITION,
                                            }}
                                        >
                                            {item.label}
                                        </span>

                                        {/* Expanded Badge Count */}
                                        {!collapsed && displayBadge !== undefined && (
                                            <span
                                                className={`px-1.5 py-0.5 text-[10px] font-black rounded-md leading-none flex items-center gap-1 ${
                                                    isActive
                                                        ? "bg-white/25 text-white"
                                                        : isOverdueAlert || isSlaAlert
                                                        ? "bg-red-50 text-red-700 border border-red-200"
                                                        : item.badgeTone === "amber"
                                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                        : item.badgeTone === "emerald"
                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                        : "bg-neutral-100 text-neutral-600"
                                                }`}
                                            >
                                                {displayBadge}
                                                {(isOverdueAlert || isSlaAlert) && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                )}
                                            </span>
                                        )}

                                        {/* Collapsed dot indicator */}
                                        {collapsed && displayBadge !== undefined && (
                                            <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                                                isOverdueAlert || isSlaAlert ? "bg-red-500 animate-pulse" : "bg-primary"
                                            }`} />
                                        )}

                                        {/* Tooltip (collapsed mode only) */}
                                        {collapsed && (
                                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[70] flex items-center gap-2 shadow-xl">
                                                <span>{item.label}</span>
                                                {displayBadge !== undefined && (
                                                    <span className="bg-primary px-1.5 py-0.5 rounded text-[10px] font-bold text-white">
                                                        {displayBadge}
                                                    </span>
                                                )}
                                                <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-neutral-900 rotate-45" />
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Bottom User Profile & Logout */}
                <div className="mt-auto flex flex-col gap-2 w-full px-3 shrink-0 pt-3 border-t border-neutral-100">
                    {/* User profile snippet */}
                    {!collapsed && user && (
                        <div className="px-3 py-2 rounded-xl bg-neutral-50/80 border border-neutral-100 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                                {user.name?.charAt(0) || "U"}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-neutral-900 truncate leading-tight">{user.name}</p>
                                <p className="text-[10px] text-neutral-400 font-semibold truncate uppercase">{user.role?.replaceAll("_", " ")}</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={logout}
                        className="group relative flex items-center gap-3 rounded-xl text-neutral-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                        style={{
                            padding: collapsed ? "12px" : "10px 12px",
                            justifyContent: collapsed ? "center" : "flex-start",
                            transition: TRANSITION,
                        }}
                    >
                        <LogOut size={20} strokeWidth={2} className="shrink-0" />
                        <span
                            className="text-xs font-semibold whitespace-nowrap overflow-hidden"
                            style={{
                                width: collapsed ? 0 : "auto",
                                opacity: collapsed ? 0 : 1,
                                transition: TRANSITION,
                            }}
                        >
                            Logout
                        </span>
                        {collapsed && (
                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[70] shadow-xl">
                                Logout
                            </div>
                        )}
                    </button>
                </div>
            </aside>

            {/* Edge Toggle Button — sits on the sidebar border, slides with it */}
            <button
                onClick={onToggle}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="fixed z-[60] flex items-center justify-center w-7 h-7 bg-white border border-neutral-200 rounded-full text-neutral-400 shadow-md hover:text-primary hover:border-primary hover:shadow-lg transition-all cursor-pointer"
                style={{
                    top: "50%",
                    left: sidebarWidth - 14,
                    transform: "translateY(-50%)",
                    transition: TRANSITION,
                }}
            >
                {collapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
            </button>
        </>
    );
}
