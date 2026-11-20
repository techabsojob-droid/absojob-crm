"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

/** Shown to everyone except the Super Admin while Settings › Danger zone › Maintenance mode is on. */
export default function MaintenancePage() {
    const [reason, setReason] = useState("");

    useEffect(() => {
        let stop = false;
        const check = async () => {
            try {
                const res = await fetch("/api/status", { cache: "no-store" });
                const data = await res.json();
                if (stop) return;
                if (!data.maintenance) { window.location.href = "/"; return; }
                setReason(data.reason || "");
            } catch { /* keep showing the page */ }
        };
        check();
        // Come back automatically once maintenance ends
        const t = setInterval(check, 30000);
        return () => { stop = true; clearInterval(t); };
    }, []);

    const signOut = async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        window.location.href = "/login";
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-[460px] bg-white rounded-lg border border-neutral-200 p-8 text-center">
                <span className="mx-auto w-11 h-11 rounded-full bg-neutral-100 text-navy flex items-center justify-center"><Wrench size={20} /></span>
                <h1 className="mt-4 text-[22px] font-semibold text-navy">The CRM is under maintenance</h1>
                <p className="mt-2 text-[14px] text-neutral-600">
                    {reason || "We're making some changes. Sign-ins and submissions are paused for now."}
                </p>
                <p className="mt-2 text-[13px] text-neutral-500">This page reloads by itself when we&apos;re back.</p>
                <button onClick={signOut} className="mt-6 text-[13px] text-neutral-600 underline underline-offset-4 hover:text-navy">Sign out</button>
            </div>
        </div>
    );
}
