"use client";

import { useState, useEffect } from "react";
import HrmisSidebar from "@/components/shared/HrmisSidebar";
import TopBar from "@/components/shared/TopBar";
import { Menu } from "lucide-react";

export default function HrLayoutClient({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
        checkDesktop();
        window.addEventListener("resize", checkDesktop);

        try {
            const saved = localStorage.getItem("hrmis_sidebar_collapsed");
            if (saved !== null) {
                setCollapsed(saved === "true");
            }
        } catch { }

        return () => window.removeEventListener("resize", checkDesktop);
    }, []);

    const handleToggle = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem("hrmis_sidebar_collapsed", String(next));
            } catch { }
            return next;
        });
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
            {/* Enterprise HRMIS Sidebar */}
            <HrmisSidebar
                collapsed={collapsed}
                onToggle={handleToggle}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />

            {/* Mobile Header Bar with Hamburger Button */}
            <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-200">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                    aria-label="Open navigation drawer"
                >
                    <Menu size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white text-xs font-black shadow-xs">
                        AJ
                    </div>
                    <span className="font-bold text-sm text-neutral-900">HRMIS</span>
                </div>
                <div className="w-8" />
            </div>

            {/* Main Application Container */}
            <div
                className="flex-1 flex flex-col min-w-0"
                style={{
                    marginLeft: isDesktop ? (collapsed ? 80 : 264) : 0,
                    transition: "margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
            >
                <TopBar />
                <main className="flex-1 p-4 md:p-8 w-full animate-fade-in">
                    {children}
                </main>
            </div>
        </div>
    );
}
