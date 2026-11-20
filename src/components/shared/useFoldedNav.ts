"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

// ─── Sidebar categories folded by the user, remembered per browser ──
// Stored as "<workspace>:<category>" keys. Read through useSyncExternalStore so the
// server render (nothing folded) and the browser agree, and open tabs stay in sync.
const KEY = "absojob.sidebar.folded";
const EVENT = "absojob-sidebar-folded";

function read(): string {
    try { return localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; }
}
function write(keys: Set<string>) {
    try { localStorage.setItem(KEY, JSON.stringify([...keys])); } catch { /* private mode: fold for this page only */ }
    window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
    window.addEventListener("storage", cb);
    window.addEventListener(EVENT, cb);
    return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVENT, cb); };
}
function parse(raw: string): Set<string> {
    try { const v = JSON.parse(raw); return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []); } catch { return new Set(); }
}

/**
 * Fold state for one workspace's sidebar categories.
 * `activeCategory` (the category holding the current page) is reopened on arrival.
 */
export function useFoldedNav(workspace: string, activeCategory: string | null | undefined) {
    const raw = useSyncExternalStore(subscribe, read, () => "[]");
    const folded = useMemo(() => parse(raw), [raw]);
    const key = (category: string) => `${workspace}:${category}`;

    const activeKey = activeCategory ? `${workspace}:${activeCategory}` : null;
    useEffect(() => {
        if (!activeKey) return;
        const now = parse(read());
        if (now.delete(activeKey)) write(now);
    }, [activeKey]);

    return {
        isOpen: (category: string) => !folded.has(key(category)),
        toggle: (category: string) => {
            const next = parse(read());
            if (!next.delete(key(category))) next.add(key(category));
            write(next);
        },
    };
}
