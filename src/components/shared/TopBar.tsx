"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, LayoutGrid, Menu, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canCreateRequisition, workspaceOfPath, workspacesFor, WORKSPACE_LABEL, WORKSPACE_PREFIX, type Workspace } from "@/lib/access";
import { COMMANDS } from "@/lib/commands";
import ChangePasswordModal from "@/components/shared/ChangePasswordModal";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { activeHref, ROLE_LABEL, type NavGroup } from "@/components/shared/Sidebar";

const homeOf = (ws: Workspace) => `${WORKSPACE_PREFIX[ws]}/dashboard`;
const SUB_LABEL: Record<string, string> = { new: "New", edit: "Edit", print: "Print" };

interface TopBarProps {
    title?: string;
    action?: React.ReactNode;
    /** Navigation of the current workspace, used for breadcrumbs. */
    groups?: NavGroup[];
    /** Opens the mobile navigation drawer. */
    onMenu?: () => void;
}

/** Workspace › section › sub-page, derived from the URL and the workspace navigation. */
function Breadcrumbs({ groups }: { groups?: NavGroup[] }) {
    const pathname = usePathname() ?? "";
    const ws = workspaceOfPath(pathname);
    if (!ws) return null;
    const flat = (groups ?? []).flatMap((g) => g.items);
    const href = activeHref(pathname, groups ?? []);
    const section = flat.find((i) => i.href === href);
    const rest = href && pathname !== href ? pathname.slice(href.length).split("/").filter(Boolean) : [];
    const last = rest[rest.length - 1];
    const sub = last ? SUB_LABEL[last] ?? (rest.length ? "Details" : null) : null;
    const crumbs: { label: string; href?: string }[] = [
        { label: WORKSPACE_LABEL[ws], href: homeOf(ws) },
        ...(section && section.href !== homeOf(ws) ? [{ label: section.label, href: sub ? section.href : undefined }] : section ? [{ label: section.label }] : []),
        ...(sub ? [{ label: sub }] : []),
    ];
    return (
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-[13px] min-w-0">
            {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && <ChevronRight size={13} className="text-neutral-300 shrink-0" />}
                    {c.href && i < crumbs.length - 1
                        ? <Link href={c.href} className="text-neutral-500 hover:text-neutral-800 truncate">{c.label}</Link>
                        : <span className={`truncate ${i === crumbs.length - 1 ? "text-neutral-800 font-medium" : "text-neutral-500"}`} aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>}
                </span>
            ))}
        </nav>
    );
}

/** Quick "create" actions for the current workspace, filtered by role (same list as ⌘K). */
function CreateMenu() {
    const { user } = useAuth();
    const pathname = usePathname() ?? "";
    const ws = workspaceOfPath(pathname);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);
    if (!ws || !user) return null;
    const audience = user.role === "AGENT" ? "AGENT" : "STAFF";
    const actions = (COMMANDS[ws] ?? []).filter((c) => c.kind === "action" && (!c.audience || c.audience === audience) && (!c.managerOnly || canCreateRequisition(user.role)));
    if (!actions.length) return null;
    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
                className="h-8 pl-2.5 pr-2 rounded-md bg-accent text-white text-[13px] font-medium flex items-center gap-1.5 hover:bg-accent-dark">
                <Plus size={15} /><span className="hidden sm:inline">Create</span><ChevronDown size={13} className="opacity-80" />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-lg border border-neutral-200 shadow-lg py-1 z-50">
                    {actions.map((a) => (
                        <Link key={a.href} role="menuitem" href={a.href} onClick={() => setOpen(false)} className="block px-3 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50">{a.label}</Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TopBar({ action, groups, onMenu }: TopBarProps) {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const workspaces = user?.role ? workspacesFor(user.role).map((ws) => ({ label: WORKSPACE_LABEL[ws], href: homeOf(ws), prefix: WORKSPACE_PREFIX[ws] })) : [];
    const [profileOpen, setProfileOpen] = useState(false);
    const [pwOpen, setPwOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    // ⌘K / Ctrl+K anywhere, or "/" when not typing, opens search
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
            if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setPaletteOpen((o) => !o); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const item = "block w-full text-left px-3 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50";
    return (
        <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 px-4 md:px-6 flex items-center gap-3" style={{ height: "var(--topbar-height)" }}>
            {onMenu && <button onClick={onMenu} className="lg:hidden -ml-1 p-2 rounded-md text-neutral-600 hover:bg-neutral-100" aria-label="Open menu"><Menu size={19} /></button>}
            <div className="flex-1 min-w-0 flex items-center gap-4">
                <Breadcrumbs groups={groups} />
            </div>

            <button onClick={() => setPaletteOpen(true)} aria-label="Search"
                className="h-8 w-9 md:w-64 md:px-2.5 rounded-md border border-neutral-200 bg-neutral-50 text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 flex items-center justify-center md:justify-start gap-2 text-[13px]">
                <Search size={15} className="shrink-0" />
                <span className="hidden md:block flex-1 text-left">Search records…</span>
                <kbd className="hidden md:block text-[10px] font-medium text-neutral-400 border border-neutral-200 bg-white rounded px-1">⌘K</kbd>
            </button>
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} role={user?.role} />

            {action}
            <CreateMenu />
            <NotificationBell />

            <div ref={profileRef} className="relative">
                <button onClick={() => setProfileOpen(!profileOpen)} aria-haspopup="menu" aria-expanded={profileOpen}
                    className="flex items-center gap-2 h-9 pl-1 pr-1.5 rounded-md hover:bg-neutral-100">
                    <span className="w-7 h-7 rounded-full bg-navy text-white text-xs font-semibold flex items-center justify-center">{user?.name?.charAt(0) ?? "U"}</span>
                    <span className="hidden lg:block text-left leading-tight">
                        <span className="block text-[13px] font-medium text-neutral-800 max-w-[140px] truncate">{user?.name ?? "User"}</span>
                        <span className="block text-[11px] text-neutral-500">{user ? ROLE_LABEL[user.role] ?? user.role : ""}</span>
                    </span>
                    <ChevronDown size={14} className="text-neutral-400 hidden lg:block" />
                </button>
                {profileOpen && (
                    <div role="menu" className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-lg border border-neutral-200 shadow-lg py-1 z-50">
                        <div className="px-3 py-2.5 border-b border-neutral-100">
                            <p className="text-[13px] font-semibold text-neutral-900 truncate">{user?.name}</p>
                            <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                        </div>
                        {workspaces.length > 1 && (
                            <div className="py-1 border-b border-neutral-100">
                                <p className="px-3 pt-1.5 pb-1 text-[10.5px] font-semibold text-neutral-400 uppercase tracking-[0.08em] flex items-center gap-1.5"><LayoutGrid size={11} /> Workspaces</p>
                                {workspaces.map((w) => {
                                    const active = pathname?.startsWith(w.prefix);
                                    return (
                                        <Link key={w.href} href={w.href} onClick={() => setProfileOpen(false)} className={`${item} flex items-center justify-between ${active ? "font-medium text-navy" : ""}`}>
                                            {w.label}{active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                        <div className="py-1">
                            <Link href="/portal/profile" onClick={() => setProfileOpen(false)} className={item}>My profile</Link>
                            <button onClick={() => { setProfileOpen(false); setPwOpen(true); }} className={item}>Change password</button>
                            {user?.role === "SUPER_ADMIN" && <Link href="/admin/settings" onClick={() => setProfileOpen(false)} className={item}>Settings</Link>}
                        </div>
                        <div className="py-1 border-t border-neutral-100">
                            <button onClick={logout} className={`${item} text-danger`}>Sign out</button>
                        </div>
                    </div>
                )}
            </div>
            <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
        </header>
    );
}
