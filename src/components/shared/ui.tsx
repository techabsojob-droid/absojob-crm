"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { X } from "lucide-react";
import { STAGE_LABELS, type ApplicationStage } from "@/lib/types";

// ─── Page Header ─────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
            <div className="min-w-0">
                <h1 className="text-[22px] leading-tight font-semibold text-neutral-900 tracking-tight">{title}</h1>
                {subtitle && <p className="text-[13px] text-neutral-500 mt-1">{subtitle}</p>}
            </div>
            {action && <div className="flex items-center gap-2 flex-wrap shrink-0">{action}</div>}
        </div>
    );
}

// ─── KPI Stat Card ───────────────────────────────────────────
// Compact metric: label, value, optional hint. Tone only marks attention (warning / danger);
// the icon is a quiet glyph, not a coloured tile.
export function StatCard({ label, value, icon: Icon, tone = "primary", hint, href }: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    tone?: "primary" | "blue" | "amber" | "emerald" | "red" | "purple" | "neutral";
    hint?: string;
    href?: string;
}) {
    const valueTone = tone === "red" ? "text-danger" : tone === "amber" ? "text-warning" : "text-neutral-900";
    const inner = (
        <>
            <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] font-medium text-neutral-500 leading-snug">{label}</p>
                <Icon size={15} className="text-neutral-300 shrink-0 mt-0.5" aria-hidden />
            </div>
            <p className={`text-[22px] leading-none font-semibold tabular-nums mt-2 ${valueTone}`}>{value}</p>
            {hint && <p className="text-[11.5px] text-neutral-500 mt-1.5 truncate">{hint}</p>}
        </>
    );
    const cls = "block bg-white px-4 py-3.5 rounded-xl border border-neutral-200 min-w-0";
    return href
        ? <Link href={href} className={`${cls} hover:border-neutral-300 hover:shadow-sm transition-[border-color,box-shadow] group`}>{inner}</Link>
        : <div className={cls}>{inner}</div>;
}

// ─── Status / Stage Badge ────────────────────────────────────
// Every status maps to one of six tones so colour always means the same thing.
const TONE = {
    neutral: "bg-neutral-100 text-neutral-600 border-neutral-200",
    info: "bg-info-light text-blue-700 border-blue-100",
    progress: "bg-violet-50 text-navy border-violet-100",
    warning: "bg-warning-light text-amber-700 border-amber-100",
    success: "bg-success-light text-emerald-700 border-emerald-100",
    danger: "bg-danger-light text-red-700 border-red-100",
} as const;
const STATUS_TONE: Record<string, keyof typeof TONE> = {
    // jobs
    DRAFT: "neutral", PENDING_APPROVAL: "warning", APPROVED: "info", SOURCING: "info", SCREENING: "info", CLIENT_REVIEW: "progress",
    INTERVIEWING: "progress", OFFER_STAGE: "warning", JOINING: "progress", FULFILLED: "success", ON_HOLD: "warning", CLOSED: "neutral", CANCELLED: "danger",
    // SLA
    ON_TRACK: "success", AT_RISK: "warning", OVERDUE: "danger", CRITICAL: "danger",
    // clients
    PROSPECT: "info", ONBOARDING: "warning", ACTIVE: "success", PAUSED: "warning", CHURNED: "neutral",
    // pipeline
    SOURCED: "neutral", CONTACTED: "info", SHORTLISTED: "progress", INTERVIEW_SCHEDULED: "progress", TECH_ROUND: "progress", CLIENT_ROUND: "progress",
    HR_ROUND: "progress", INTERVIEW_COMPLETED: "progress", SELECTED: "success", OFFER_SENT: "warning", OFFER_ACCEPTED: "success", JOINED: "success",
    REJECTED: "danger", BACKED_OUT: "danger", WITHDRAWN: "neutral", BLACKLISTED: "danger", NOT_INTERESTED: "neutral",
    // referrals / submissions
    SUBMITTED: "info", UNDER_REVIEW: "warning", HIRED: "success", PENDING_REVIEW: "warning", INTERVIEW_REQUESTED: "progress",
    // users & HR
    SUPER_ADMIN: "progress", HR_ADMIN: "progress", TA_MANAGER: "progress", TA_RECRUITER: "info", FINANCE_ADMIN: "progress", AGENT: "neutral", EMPLOYEE: "neutral",
    INVITED: "info", SUSPENDED: "danger", EXITED: "neutral", NOTICE_PERIOD: "warning", VERIFIED: "success",
    // priority
    URGENT: "danger", HIGH: "warning", MEDIUM: "info", LOW: "neutral",
    // generic workflow
    PENDING: "warning", IN_PROGRESS: "info", IN_REVIEW: "progress", DONE: "success", TODO: "neutral", BLOCKED: "danger",
    APPROVED_LEDGER: "info", PAID: "success", PROCESSING: "info", PROCESSED: "info", SENT: "info", PARTIALLY_PAID: "warning", WRITTEN_OFF: "neutral", FAILED: "danger",
    // attendance
    PRESENT: "success", ABSENT: "danger", LATE: "warning", HALF_DAY: "warning", ON_LEAVE: "info", WFH: "progress",
    // interviews
    SCHEDULED: "info", COMPLETED: "success", RESCHEDULED: "warning", NO_SHOW: "danger",
    STRONG_HIRE: "success", HIRE: "success", MAYBE: "warning", NO_HIRE: "danger",
    // calls
    CONNECTED: "success", NOT_ANSWERED: "neutral", BUSY: "warning", SWITCHED_OFF: "neutral", CALL_BACK: "info", WRONG_NUMBER: "danger", INTERESTED: "success",
    LISTED: "info", OPEN: "info", ACCEPTED: "success", DECLINED: "danger", EXPIRED: "neutral",
};

export function Badge({ value, label }: { value: string; label?: string }) {
    const style = TONE[STATUS_TONE[value] ?? "neutral"];
    const display = label ?? STAGE_LABELS[value as ApplicationStage] ?? value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
    return (
        <span className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium border whitespace-nowrap ${style}`}>
            {display}
        </span>
    );
}

// ─── Empty State ─────────────────────────────────────────────
export function EmptyState({ icon: Icon, message, action }: { icon: LucideIcon; message: string; action?: React.ReactNode }) {
    return (
        <div className="py-10 px-4 text-center">
            <Icon size={22} className="text-neutral-300 mx-auto mb-2.5" aria-hidden />
            <p className="text-[13px] text-neutral-500 max-w-sm mx-auto">{message}</p>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}

// ─── Section Card ────────────────────────────────────────────
export function SectionCard({ title, subtitle, children, action, className = "" }: {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={`bg-white rounded-xl border border-neutral-200 min-w-0 ${className}`}>
            {(title || action) && (
                <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-neutral-100">
                    <div className="min-w-0">
                        {title && <h2 className="text-[14px] font-semibold text-neutral-900">{title}</h2>}
                        {subtitle && <p className="text-[12px] text-neutral-500 mt-0.5">{subtitle}</p>}
                    </div>
                    {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
                </header>
            )}
            <div className="p-5">{children}</div>
        </section>
    );
}

// ─── Money formatting ────────────────────────────────────────
export function inr(amount: number): string {
    return `₹${Math.abs(amount).toLocaleString("en-IN")}`;
}

// ─── Modal Shell ─────────────────────────────────────────────
export function ModalShell({ open = true, onClose, title, children, wide }: {
    open?: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    wide?: boolean;
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-navy-deep/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
            <div
                role="dialog" aria-modal="true" aria-label={title}
                className={`bg-white rounded-t-xl sm:rounded-xl w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92vh] overflow-y-auto shadow-2xl animate-fade-in`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 z-10">
                    <h3 className="text-[15px] font-semibold text-neutral-900 truncate">{title}</h3>
                    <button onClick={onClose} aria-label="Close" className="w-8 h-8 -mr-1.5 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center"><X size={17} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}
