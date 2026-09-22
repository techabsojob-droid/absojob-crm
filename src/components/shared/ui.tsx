"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

// ─── Page Header ─────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 mb-6">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">{title}</h1>
                {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

// ─── KPI Stat Card ───────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, tone = "primary", hint, href }: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    tone?: "primary" | "blue" | "amber" | "emerald" | "red" | "purple" | "neutral";
    hint?: string;
    href?: string;
}) {
    const tones: Record<string, string> = {
        primary: "bg-primary/5 text-primary",
        blue: "bg-blue-50 text-blue-600",
        amber: "bg-amber-50 text-amber-600",
        emerald: "bg-emerald-50 text-emerald-600",
        red: "bg-red-50 text-red-600",
        purple: "bg-purple-50 text-purple-600",
        neutral: "bg-neutral-100 text-neutral-600",
    };

    const inner = (
        <>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{label}</p>
                <h3 className="text-2xl font-extrabold text-neutral-900 mt-1">{value}</h3>
                {hint && <p className="text-[11px] text-neutral-400 mt-0.5">{hint}</p>}
                {href && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        View details <ChevronRight size={10} />
                    </span>
                )}
            </div>
            <div className={`w-12 h-12 rounded-xl ${tones[tone]} flex items-center justify-center shrink-0`}>
                <Icon size={22} />
            </div>
        </>
    );

    if (href) {
        return (
            <Link
                href={href}
                className="group bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center justify-between hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
                {inner}
            </Link>
        );
    }

    return (
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center justify-between">
            {inner}
        </div>
    );
}

// ─── Status / Stage Badge ────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
    // jobs
    DRAFT: "bg-neutral-100 text-neutral-600 border-neutral-200",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-100",
    APPROVED: "bg-blue-50 text-blue-700 border-blue-100",
    SOURCING: "bg-violet-50 text-violet-700 border-violet-100",
    CLIENT_REVIEW: "bg-indigo-50 text-indigo-700 border-indigo-100",
    INTERVIEWING: "bg-cyan-50 text-cyan-700 border-cyan-100",
    OFFER_STAGE: "bg-amber-50 text-amber-700 border-amber-100",
    JOINING: "bg-teal-50 text-teal-700 border-teal-100",
    FULFILLED: "bg-emerald-50 text-emerald-700 border-emerald-100",
    ON_HOLD: "bg-orange-50 text-orange-700 border-orange-100",
    CLOSED: "bg-neutral-100 text-neutral-500 border-neutral-200",
    CANCELLED: "bg-red-50 text-red-600 border-red-100",
    // SLA
    ON_TRACK: "bg-emerald-50 text-emerald-700 border-emerald-200",
    AT_RISK: "bg-amber-50 text-amber-700 border-amber-200 font-bold",
    OVERDUE: "bg-red-50 text-red-700 border-red-200 font-bold",
    // clients
    PROSPECT: "bg-blue-50 text-blue-700 border-blue-100",
    ONBOARDING: "bg-amber-50 text-amber-700 border-amber-100",
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
    PAUSED: "bg-orange-50 text-orange-700 border-orange-100",
    CHURNED: "bg-neutral-100 text-neutral-500 border-neutral-200",
    // pipeline stages
    SOURCED: "bg-neutral-100 text-neutral-600 border-neutral-200",
    SCREENING: "bg-sky-50 text-sky-700 border-sky-100",
    INTERVIEW_SCHEDULED: "bg-cyan-50 text-cyan-700 border-cyan-100",
    TECH_ROUND: "bg-violet-50 text-violet-700 border-violet-100",
    CLIENT_ROUND: "bg-indigo-50 text-indigo-700 border-indigo-100",
    HR_ROUND: "bg-purple-50 text-purple-700 border-purple-100",
    OFFER_SENT: "bg-amber-50 text-amber-700 border-amber-100",
    OFFER_ACCEPTED: "bg-teal-50 text-teal-700 border-teal-100",
    JOINED: "bg-emerald-50 text-emerald-700 border-emerald-100",
    REJECTED: "bg-red-50 text-red-600 border-red-100",
    BACKED_OUT: "bg-orange-50 text-orange-700 border-orange-100",
    BLACKLISTED: "bg-red-100 text-red-800 border-red-200",
    // referrals
    SUBMITTED: "bg-blue-50 text-blue-700 border-blue-100",
    UNDER_REVIEW: "bg-amber-50 text-amber-700 border-amber-100",
    SHORTLISTED: "bg-violet-50 text-violet-700 border-violet-100",
    HIRED: "bg-emerald-50 text-emerald-700 border-emerald-100",
    // users & hr
    SUPER_ADMIN: "bg-primary/10 text-primary border-primary/20",
    HR_ADMIN: "bg-emerald-50 text-emerald-800 border-emerald-200",
    TA_MANAGER: "bg-purple-50 text-purple-700 border-purple-100",
    TA_RECRUITER: "bg-blue-50 text-blue-700 border-blue-100",
    AGENT: "bg-emerald-50 text-emerald-700 border-emerald-100",
    EMPLOYEE: "bg-neutral-100 text-neutral-600 border-neutral-200",
    INVITED: "bg-blue-50 text-blue-700 border-blue-100",
    SUSPENDED: "bg-red-50 text-red-600 border-red-100",
    EXITED: "bg-neutral-100 text-neutral-500 border-neutral-200",
    NOTICE_PERIOD: "bg-amber-50 text-amber-800 border-amber-200",
    // priority
    URGENT: "bg-red-50 text-red-600 border-red-100",
    HIGH: "bg-orange-50 text-orange-700 border-orange-100",
    MEDIUM: "bg-blue-50 text-blue-700 border-blue-100",
    LOW: "bg-neutral-100 text-neutral-500 border-neutral-200",
    // generic
    PENDING: "bg-amber-50 text-amber-700 border-amber-100",
    APPROVED_LEDGER: "bg-blue-50 text-blue-700 border-blue-100",
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-100",
    PROCESSING: "bg-blue-50 text-blue-700 border-blue-100",
    PRESENT: "bg-emerald-50 text-emerald-700 border-emerald-100",
    ABSENT: "bg-red-50 text-red-600 border-red-100",
    LATE: "bg-orange-50 text-orange-700 border-orange-100",
    HALF_DAY: "bg-amber-50 text-amber-700 border-amber-100",
    ON_LEAVE: "bg-blue-50 text-blue-700 border-blue-100",
    WFH: "bg-violet-50 text-violet-700 border-violet-100",
    SCHEDULED: "bg-blue-50 text-blue-700 border-blue-100",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
    RESCHEDULED: "bg-amber-50 text-amber-700 border-amber-100",
    NO_SHOW: "bg-red-50 text-red-600 border-red-100",
    // interview outcomes
    STRONG_HIRE: "bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold",
    HIRE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    MAYBE: "bg-amber-50 text-amber-700 border-amber-200",
    NO_HIRE: "bg-red-50 text-red-700 border-red-200",
};

export function Badge({ value, label }: { value: string; label?: string }) {
    const style = BADGE_STYLES[value] ?? "bg-neutral-100 text-neutral-600 border-neutral-200";
    const display = label ?? value.replaceAll("_", " ");
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${style}`}>
            {display}
        </span>
    );
}

// ─── Empty State ─────────────────────────────────────────────
export function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
    return (
        <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center mx-auto mb-3">
                <Icon size={24} className="text-neutral-300" />
            </div>
            <p className="text-sm text-neutral-400 font-medium">{message}</p>
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
        <div className={`bg-white rounded-2xl border border-neutral-200/80 shadow-xs ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between px-5 pt-5 pb-1">
                    <div>
                        <h2 className="text-base font-bold text-neutral-900">{title}</h2>
                        {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
                    </div>
                    {action}
                </div>
            )}
            <div className="p-5">{children}</div>
        </div>
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
    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className={`bg-white rounded-3xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto animate-fade-in`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white/95 backdrop-blur px-6 py-4 border-b border-neutral-100 flex items-center justify-between z-10">
                    <h3 className="font-bold text-neutral-900">{title}</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors text-xl leading-none">×</button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}
