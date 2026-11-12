"use client";

import { useState } from "react";
import Sidebar, { type NavGroup, type NavItem } from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";

/**
 * The one application frame every workspace uses: navy sidebar (rail when collapsed,
 * drawer on mobile), top bar with breadcrumbs / search / create / notifications / profile,
 * and the page area.
 */
export default function AppShell({ groups, items, children }: { groups?: NavGroup[]; items?: NavItem[]; children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const navGroups = groups ?? (items ? [{ items }] : []);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-3 focus:py-2 focus:rounded-md focus:shadow-md">Skip to content</a>
            <Sidebar groups={navGroups} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
            <div
                className="flex flex-col min-w-0 min-h-screen transition-[padding] duration-200 ease-out lg:pl-[var(--shell-offset)]"
                style={{ ["--shell-offset" as string]: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-expanded)" }}
            >
                <TopBar groups={navGroups} onMenu={() => setMobileOpen(true)} />
                <main id="main" className="flex-1 w-full px-4 py-5 md:px-6 md:py-6 animate-fade-in">
                    <div className="mx-auto w-full max-w-[1600px]">{children}</div>
                </main>
            </div>
        </div>
    );
}
