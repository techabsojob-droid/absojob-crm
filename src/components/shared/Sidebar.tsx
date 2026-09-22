"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings, type LucideIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

export interface NavItem {
    label: string;
    icon: LucideIcon;
    href: string;
    badge?: number | string;
    badgeTone?: "red" | "amber" | "emerald" | "blue" | "neutral";
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
    const { logout } = useAuth();

    const sidebarWidth = collapsed ? COLLAPSED_W : EXPANDED_W;

    // Normalize to groups
    const resolvedGroups: NavGroup[] = groups || (items ? [{ items }] : []);

    return (
        <>
            {/* Sidebar */}
            <aside
                className="fixed top-0 left-0 h-screen z-50 flex flex-col bg-white border-r border-neutral-200 py-6 overflow-hidden"
                style={{ width: sidebarWidth, transition: TRANSITION }}
            >
                {/* Logo */}
                <div className={`mb-6 flex items-center shrink-0 ${collapsed ? "justify-center px-1" : "px-6 gap-3"}`}>
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white text-sm font-black tracking-tight shadow-md shadow-primary/20 shrink-0">
                        AJ
                    </div>
                    <span
                        className="text-lg font-bold text-neutral-900 tracking-tight whitespace-nowrap overflow-hidden"
                        style={{
                            width: collapsed ? 0 : "auto",
                            opacity: collapsed ? 0 : 1,
                            transition: TRANSITION,
                        }}
                    >
                        AbsoJob
                    </span>
                </div>

                {/* Nav Groups */}
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
                                const isActive = pathname === item.href || (pathname.startsWith(item.href + "/") && !item.href.endsWith("/dashboard"));

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`group relative flex items-center gap-3 rounded-xl ${isActive
                                            ? "bg-primary text-white shadow-lg shadow-primary/25"
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

                                        {/* Badge count */}
                                        {!collapsed && item.badge !== undefined && (
                                            <span className={`px-1.5 py-0.5 text-[10px] font-black rounded-md leading-none ${
                                                isActive 
                                                    ? "bg-white/20 text-white" 
                                                    : item.badgeTone === "red" 
                                                    ? "bg-red-50 text-red-700 border border-red-200" 
                                                    : "bg-neutral-100 text-neutral-600"
                                            }`}>
                                                {item.badge}
                                            </span>
                                        )}

                                        {/* Tooltip (collapsed only) */}
                                        {collapsed && (
                                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[70] flex items-center gap-2">
                                                <span>{item.label}</span>
                                                {item.badge !== undefined && (
                                                    <span className="bg-primary px-1.5 py-0.5 rounded text-[10px] font-bold text-white">
                                                        {item.badge}
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

                {/* Bottom Actions */}
                <div className="mt-auto flex flex-col gap-1 w-full px-3 shrink-0">
                    <button
                        onClick={logout}
                        className="group relative flex items-center gap-3 rounded-xl text-neutral-500 hover:bg-red-50 hover:text-red-600"
                        style={{
                            padding: collapsed ? "12px" : "10px 12px",
                            justifyContent: collapsed ? "center" : "flex-start",
                            transition: TRANSITION,
                        }}
                    >
                        <LogOut size={22} strokeWidth={2} className="shrink-0" />
                        <span
                            className="text-sm font-medium whitespace-nowrap overflow-hidden"
                            style={{
                                width: collapsed ? 0 : "auto",
                                opacity: collapsed ? 0 : 1,
                                transition: TRANSITION,
                            }}
                        >
                            Logout
                        </span>
                        {collapsed && (
                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[70]">
                                Logout
                            </div>
                        )}
                    </button>
                </div>
            </aside>

            {/* Edge Toggle Button — sits on the sidebar border, slides with it */}
            <button
                onClick={onToggle}
                className="fixed z-[60] flex items-center justify-center w-7 h-7 bg-white border border-neutral-200 rounded-full text-neutral-400 shadow-lg hover:text-primary hover:border-primary hover:shadow-xl"
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
