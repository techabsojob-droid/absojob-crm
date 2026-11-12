"use client";

import { useState, useEffect } from "react";
import HrmisSidebar from "@/components/shared/HrmisSidebar";
import TopBar from "@/components/shared/TopBar";

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

            {/* Main Application Container */}
            <div
                className="flex-1 flex flex-col min-w-0"
                style={{
                    marginLeft: isDesktop ? (collapsed ? 80 : 264) : 0,
                    transition: "margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
            >
                <TopBar onMenu={() => setMobileOpen(true)} />
                <main id="main" className="flex-1 w-full px-4 py-5 md:px-6 md:py-6 animate-fade-in">
                    <div className="mx-auto w-full max-w-[1600px]">{children}</div>
                </main>
            </div>
        </div>
    );
}
