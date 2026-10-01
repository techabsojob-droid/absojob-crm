"use client";

import { Search, Bell, ChevronDown, Loader2, Briefcase, User, Building2, Users, DollarSign, LayoutGrid } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { workspacesFor, WORKSPACE_LABEL, WORKSPACE_PREFIX, type Workspace } from "@/lib/access";
import ChangePasswordModal from "@/components/shared/ChangePasswordModal";

const roleHomeFor = (ws: Workspace) => `${WORKSPACE_PREFIX[ws]}/dashboard`;



interface TopBarProps {
    title?: string;
    action?: React.ReactNode;
}

// ─── Debounce Hook ──────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function TopBar({ title, action }: TopBarProps) {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const workspaces = user?.role
        ? workspacesFor(user.role).map((ws) => ({ label: WORKSPACE_LABEL[ws], href: roleHomeFor(ws), prefix: WORKSPACE_PREFIX[ws] }))
        : [];
    
    // Dropdown States
    const [profileOpen, setProfileOpen] = useState(false);
    const [pwOpen, setPwOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    
    const profileRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    // Search Logic
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Notification Logic
    const [notifications, setNotifications] = useState<any[]>([]);
    const [notifLoading, setNotifLoading] = useState(false);

    useEffect(() => {
        const fetchResults = async () => {
            if (debouncedSearch.length < 2) {
                setSearchResults([]);
                setSearchOpen(false);
                return;
            }
            setSearchLoading(true);
            setSearchOpen(true);
            try {
                const res = await fetch(`/api/admin/search?q=${encodeURIComponent(debouncedSearch)}`);
                const data = await res.json();
                setSearchResults(data);
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setSearchLoading(false);
            }
        };
        fetchResults();
    }, [debouncedSearch]);

    useEffect(() => {
        const fetchNotifications = async () => {
            setNotifLoading(true);
            try {
                const res = await fetch('/api/notifications');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setNotifications(data);
                } else {
                    setNotifications([]);
                }
            } catch (err) {
                console.error("Failed to fetch notifications:", err);
                setNotifications([]);
            } finally {
                setNotifLoading(false);
            }
        };
        if (!user) return;
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const markAsRead = async (id: string) => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (err) {
            console.error("Failed to mark as read:", err);
        }
    };

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <header
            className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-8 flex items-center justify-between"
            style={{ height: "var(--topbar-height)" }}
        >
            {/* Left: Search */}
            <div className="flex items-center gap-6 flex-1 relative" ref={searchRef}>
                <div className="relative w-80">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
                        placeholder="Search jobs, candidates, clients..."
                        className="w-full pl-11 pr-5 py-2.5 text-sm bg-neutral-50/50 border-transparent focus:bg-white focus:border-neutral-200 rounded-full transition-all outline-none"
                    />
                    {searchLoading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Loader2 size={14} className="animate-spin text-primary" />
                        </div>
                    )}
                </div>

                {/* Search Results Dropdown */}
                {searchOpen && (
                    <div className="absolute top-full left-0 mt-2 w-[400px] bg-white rounded-2xl shadow-2xl border border-neutral-100 py-3 animate-fade-in origin-top overflow-hidden">
                        <p className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Search Results</p>
                        <div className="max-h-[400px] overflow-y-auto">
                            {searchResults.length === 0 && !searchLoading && (
                                <div className="px-4 py-8 text-center">
                                    <p className="text-sm text-neutral-400">No results found for &quot;{debouncedSearch}&quot;</p>
                                </div>
                            )}
                            {searchResults.map((res) => (
                                <Link
                                    key={`${res.type}-${res.id}`}
                                    href={res.href}
                                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                                    className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        {res.type === 'Job' && <Briefcase size={18} />}
                                        {res.type === 'Candidate' && <User size={18} />}
                                        {res.type === 'Client' && <Building2 size={18} />}
                                        {res.type === 'Team' && <Users size={18} />}
                                        {res.type === 'Invoice' && <DollarSign size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-neutral-900 truncate">{res.title}</p>
                                        <p className="text-[10px] text-neutral-400 font-semibold uppercase">{res.type}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-4">
                {action}

                <div className="h-8 w-px bg-neutral-200 mx-2" />

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setNotifOpen(!notifOpen)}
                        className={`relative p-2.5 rounded-full transition-colors ${notifOpen ? 'bg-primary/10 text-primary' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'}`}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2.5 w-4 h-4 bg-danger text-white text-[8px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {notifOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-neutral-100 py-3 animate-fade-in origin-top-right overflow-hidden">
                            <div className="px-4 py-2 border-b border-neutral-50 flex items-center justify-between">
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Notifications</p>
                                {unreadCount > 0 && <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full">{unreadCount} New</span>}
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                {notifications.length === 0 && (
                                    <div className="px-4 py-12 text-center">
                                        <Bell size={32} className="mx-auto text-neutral-100 mb-3" />
                                        <p className="text-sm text-neutral-400 font-medium">No new notifications</p>
                                    </div>
                                )}
                                {notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        onClick={() => { if (!n.isRead) markAsRead(n.id); if (n.link) router.push(n.link); setNotifOpen(false); }}
                                        className={`px-4 py-4 border-b border-neutral-50 last:border-0 hover:bg-neutral-50 cursor-pointer transition-colors relative ${!n.isRead ? 'bg-primary/[0.02]' : ''}`}
                                    >
                                        {!n.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                                        <div className="flex justify-between items-start mb-1">
                                            <p className={`text-xs font-bold ${!n.isRead ? 'text-neutral-900' : 'text-neutral-500'}`}>{n.title}</p>
                                            <span className="text-[9px] text-neutral-400">{new Date(n.createdAt).toLocaleDateString("en-IN")}</span>
                                        </div>
                                        <p className="text-[11px] text-neutral-500 leading-snug line-clamp-2">{n.message}</p>
                                    </div>
                                ))}
                            </div>
                            {unreadCount > 0 && (
                                <div className="px-4 pt-3 border-t border-neutral-50">
                                    <button
                                        onClick={async () => {
                                            await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
                                            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                                        }}
                                        className="w-full py-2 text-[10px] font-bold text-neutral-400 hover:text-primary transition-colors uppercase tracking-widest"
                                    >
                                        Mark all as read
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

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
