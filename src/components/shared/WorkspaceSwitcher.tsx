"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { workspaceOfPath, workspacesFor, WORKSPACE_LABEL, WORKSPACE_PREFIX, type Workspace } from "@/lib/access";
import { roleHome } from "@/lib/types";

const HINT: Record<Workspace, string> = {
    ADMIN: "Whole company, settings and control",
    TA: "Openings, pipeline, calls, interviews",
    HR: "Employees, leave, payroll, onboarding",
    FINANCE: "Billing, invoices, payments, books",
    PORTAL: "Your own profile, leave and payslips",
};

const homeOf = (ws: Workspace) => `${WORKSPACE_PREFIX[ws]}/dashboard`;

/**
 * Sits under the sidebar brand for anyone with more than one workspace.
 * Says which workspace you're in, switches between them, and — when you've
 * stepped out of your home workspace — offers a one-click way back.
 */
export default function WorkspaceSwitcher({ narrow = false }: { narrow?: boolean }) {
    const { user } = useAuth();
    const pathname = usePathname() ?? "";
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);
        return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
    }, [open]);

    if (!user?.role) return null;
    const list = workspacesFor(user.role);
    if (list.length < 2) return null;

    const current = workspaceOfPath(pathname);
    const home = workspaceOfPath(roleHome(user.role));
    const away = !!current && !!home && current !== home;

    if (narrow) {
        return away ? (
            <div className="px-2 pt-2">
                <Link href={homeOf(home!)} title={`Back to ${WORKSPACE_LABEL[home!]}`} aria-label={`Back to ${WORKSPACE_LABEL[home!]}`}
                    className="h-9 rounded-md flex items-center justify-center bg-accent text-white hover:bg-accent/90">
                    <ArrowLeft size={16} />
                </Link>
            </div>
        ) : null;
    }

    return (
        <div ref={ref} className="relative px-3 pt-3 space-y-1.5">
            {away && (
                <Link href={homeOf(home!)}
                    className="flex items-center gap-2 h-9 px-3 rounded-md bg-accent text-white text-[13px] font-medium hover:bg-accent/90 transition-colors">
                    <ArrowLeft size={15} className="shrink-0" />
                    <span className="truncate">Back to {WORKSPACE_LABEL[home!]}</span>
                </Link>
            )}
            <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
                className="w-full flex items-center gap-2.5 h-10 px-3 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-left cursor-pointer transition-colors">
                <LayoutGrid size={15} className="shrink-0 text-[#94A6C3]" />
                <span className="flex-1 min-w-0 leading-tight">
                    <span className="block text-[10px] uppercase tracking-[0.08em] text-[#6A82A6]">You are in</span>
                    <span className="block text-[13px] font-medium text-white truncate">{current ? WORKSPACE_LABEL[current] : "Workspace"}</span>
                </span>
                <ChevronsUpDown size={14} className="shrink-0 text-[#94A6C3]" />
            </button>

            {open && (
                <div role="menu" className="sidebar-pop absolute left-3 right-3 top-full mt-1 z-[70] bg-white rounded-lg border border-neutral-200 shadow-xl py-1">
                    <p className="px-3 pt-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Switch workspace</p>
                    {list.map((ws) => {
                        const active = ws === current;
                        return (
                            <Link key={ws} role="menuitem" href={homeOf(ws)} onClick={() => setOpen(false)}
                                className={`flex items-start gap-2.5 px-3 py-2 hover:bg-neutral-50 ${active ? "bg-neutral-50" : ""}`}>
                                <span className="flex-1 min-w-0">
                                    <span className={`block text-[13px] ${active ? "font-semibold text-navy" : "font-medium text-neutral-800"}`}>
                                        {WORKSPACE_LABEL[ws]}{ws === home && <span className="ml-1.5 text-[10.5px] font-normal text-neutral-400">home</span>}
                                    </span>
                                    <span className="block text-[11px] text-neutral-500 truncate">{HINT[ws]}</span>
                                </span>
                                {active && <Check size={14} className="mt-0.5 shrink-0 text-accent" />}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
