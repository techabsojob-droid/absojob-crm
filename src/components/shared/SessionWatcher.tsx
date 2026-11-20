"use client";

import { useEffect } from "react";

const PING_EVERY_MS = 60_000;
const OPEN_PATHS = ["/login", "/register", "/maintenance"];

/**
 * Keeps the server's inactivity timeout honest:
 * - pings /api/auth/activity (at most once a minute) only when the person actually
 *   types, clicks or scrolls, so background polling never keeps a session alive;
 * - sends the browser to /login once a session has ended (timed out or signed out
 *   by an admin), and to /maintenance when maintenance mode starts.
 */
export default function SessionWatcher() {
    useEffect(() => {
        const onOpenPage = () => OPEN_PATHS.some((p) => window.location.pathname.startsWith(p));
        let last = 0;
        let leaving = false;

        const leave = (to: string) => {
            if (leaving || onOpenPage()) return;
            leaving = true;
            window.location.href = to;
        };

        const ping = () => {
            if (onOpenPage() || Date.now() - last < PING_EVERY_MS) return;
            last = Date.now();
            fetch("/api/auth/activity", { method: "POST" }).then((r) => {
                if (r.status === 401) leave("/login?reason=signed-out");
                else if (r.status === 503) leave("/maintenance");
            }).catch(() => {});
        };
        const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
        events.forEach((e) => window.addEventListener(e, ping, { passive: true }));

        // Watch every same-origin API response for "signed out" / "maintenance"
        const original = window.fetch;
        window.fetch = async (...args: Parameters<typeof fetch>) => {
            const res = await original(...args);
            try {
                const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
                const path = new URL(url, window.location.origin);
                if (path.origin === window.location.origin && path.pathname.startsWith("/api/") && !path.pathname.startsWith("/api/auth/login")) {
                    if (res.status === 401) leave("/login?reason=signed-out");
                    else if (res.status === 503) {
                        const body = await res.clone().json().catch(() => null);
                        if (body?.code === "MAINTENANCE") leave("/maintenance");
                    }
                }
            } catch { /* never break the caller */ }
            return res;
        };

        return () => {
            events.forEach((e) => window.removeEventListener(e, ping));
            window.fetch = original;
        };
    }, []);

    return null;
}
