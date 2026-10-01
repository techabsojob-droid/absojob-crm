"use client";

import { Search, ChevronDown, LayoutGrid } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { workspacesFor, WORKSPACE_LABEL, WORKSPACE_PREFIX, type Workspace } from "@/lib/access";
import ChangePasswordModal from "@/components/shared/ChangePasswordModal";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { NotificationBell } from "@/components/shared/NotificationBell";

const roleHomeFor = (ws: Workspace) => `${WORKSPACE_PREFIX[ws]}/dashboard`;



interface TopBarProps {
    title?: string;
    action?: React.ReactNode;
}


export default function TopBar({ title, action }: TopBarProps) {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const workspaces = user?.role
        ? workspacesFor(user.role).map((ws) => ({ label: WORKSPACE_LABEL[ws], href: roleHomeFor(ws), prefix: WORKSPACE_PREFIX[ws] }))
        : [];
    
    // Dropdown States
    const [profileOpen, setProfileOpen] = useState(false);
    const [pwOpen, setPwOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    // ⌘K / Ctrl+K anywhere, or "/" when not typing, opens the command palette
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
            if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
                e.preventDefault();
                setPaletteOpen((o) => !o);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header
            className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-8 flex items-center justify-between"
            style={{ height: "var(--topbar-height)" }}
        >
            {/* Left: command palette trigger */}
            <div className="flex items-center gap-6 flex-1">
                <button
                    onClick={() => setPaletteOpen(true)}
                    className="flex items-center gap-3 w-80 pl-4 pr-2 py-2.5 text-sm text-neutral-400 bg-neutral-50/70 hover:bg-neutral-100/70 rounded-full transition-colors"
                >
                    <Search size={18} />
                    <span className="flex-1 text-left">Search or jump to…</span>
                    <kbd className="text-[10px] font-semibold text-neutral-400 bg-white border border-neutral-200 rounded-md px-1.5 py-0.5">⌘K</kbd>
                </button>
                <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} role={user?.role} />
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-4">
                {action}

                <div className="h-8 w-px bg-neutral-200 mx-2" />

                {/* Notifications */}
                <NotificationBell />

                {/* Profile */}
                <div ref={profileRef} className="relative">
                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-neutral-50 transition-all border border-transparent hover:border-neutral-200"
                    >
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-neutral-800 leading-tight truncate max-w-[120px]">{user?.name || "User"}</p>
                            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">{user?.role || "View Only"}</p>
                        </div>
                        <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-primary font-bold text-sm border-2 border-white shadow-sm overflow-hidden relative">
                            {user?.avatar ? (
                                <Image src={user.avatar} alt="Avatar" fill className="object-cover" />
                            ) : (
                                user?.name?.charAt(0) || "U"
                            )}
                        </div>
                        <ChevronDown size={14} className="text-neutral-400 mr-2" />
                    </button>

                    {profileOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-neutral-100 py-2 animate-fade-in origin-top-right">
                            <div className="px-4 py-3 border-b border-neutral-100 mb-1">
                                <p className="text-sm font-bold text-neutral-900 truncate">{user?.name}</p>
                                <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                            </div>
                            {workspaces.length > 1 && (
                                <>
                                    <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <LayoutGrid size={11} /> Switch workspace
                                    </p>
                                    {workspaces.map((w) => {
                                        const active = pathname?.startsWith(w.prefix);
                                        return (
                                            <Link
                                                key={w.href}
                                                href={w.href}
                                                onClick={() => setProfileOpen(false)}
                                                className={`block w-full text-left px-4 py-2 text-sm transition-colors ${active ? "text-primary font-bold bg-primary/5" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"}`}
                                            >
                                                {w.label}
                                            </Link>
                                        );
                                    })}
                                    <div className="h-px bg-neutral-100 my-1" />
                                </>
                            )}
                            <Link href="/portal/profile" onClick={() => setProfileOpen(false)} className="block w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
                                My Profile
                            </Link>
                            <button onClick={() => { setProfileOpen(false); setPwOpen(true); }} className="block w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
                                Change Password
                            </button>
                            {user?.role === "SUPER_ADMIN" && (
                                <Link href="/admin/settings" onClick={() => setProfileOpen(false)} className="block w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
                                    Settings
                                </Link>
                            )}
                            <div className="h-px bg-neutral-100 my-1" />
                            <button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-danger-light/30 transition-colors font-medium">
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
        </header>
    );
}
