"use client";

import { AlertTriangle, RefreshCw, Search, Home, Users, Calendar, BarChart3, FileText, Inbox } from "lucide-react";

// ─── Skeleton Building Blocks ──────────────────────────────
export function SkeletonPulse({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
    return <div className={`animate-pulse bg-neutral-200/60 rounded-xl ${className}`} style={style} />;
}

// ─── Card Skeleton ──────────────────────────────
export function CardSkeleton() {
    return (
        <div className="bg-white border border-neutral-100 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
                <SkeletonPulse className="w-12 h-12 rounded-2xl" />
                <div className="flex-1 space-y-2">
                    <SkeletonPulse className="h-4 w-3/4" />
                    <SkeletonPulse className="h-3 w-1/2" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <SkeletonPulse className="h-14 rounded-xl" />
                <SkeletonPulse className="h-14 rounded-xl" />
            </div>
            <SkeletonPulse className="h-10 rounded-xl" />
        </div>
    );
}

// ─── Property Card Skeleton ──────────────────────────────
export function PropertyCardSkeleton() {
    return (
        <div className="bg-white border border-neutral-100 rounded-xl overflow-hidden shadow-sm">
            <SkeletonPulse className="h-44 w-full rounded-none" />
            <div className="p-5 space-y-3">
                <SkeletonPulse className="h-5 w-3/4" />
                <SkeletonPulse className="h-3 w-1/2" />
                <div className="flex gap-3">
                    <SkeletonPulse className="h-7 w-16 rounded-lg" />
                    <SkeletonPulse className="h-7 w-16 rounded-lg" />
                    <SkeletonPulse className="h-7 w-16 rounded-lg" />
                </div>
                <div className="pt-4 border-t border-neutral-100 flex justify-between">
                    <SkeletonPulse className="h-6 w-24" />
                    <SkeletonPulse className="h-8 w-8 rounded-full" />
                </div>
            </div>
        </div>
    );
}

// ─── Table Row Skeleton ──────────────────────────────
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
    return (
        <div className="flex items-center gap-4 p-4 border-b border-neutral-50">
            <SkeletonPulse className="w-10 h-10 rounded-full shrink-0" />
            {Array.from({ length: cols }).map((_, i) => (
                <SkeletonPulse key={i} className={`h-4 flex-1 ${i === 0 ? "max-w-[200px]" : "max-w-[100px]"}`} />
            ))}
        </div>
    );
}

// ─── Stat Card Skeleton ──────────────────────────────
export function StatCardSkeleton() {
    return (
        <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm space-y-3">
            <SkeletonPulse className="w-9 h-9 rounded-xl" />
            <SkeletonPulse className="h-7 w-20" />
            <SkeletonPulse className="h-3 w-24" />
        </div>
    );
}

// ─── Chart Skeleton ──────────────────────────────
export function ChartSkeleton({ height = "h-[300px]" }: { height?: string }) {
    return (
        <div className="bg-white border border-neutral-100 rounded-xl p-6 shadow-sm">
            <SkeletonPulse className="h-5 w-40 mb-6" />
            <div className={`${height} w-full flex items-end gap-2 px-4`}>
                {[40, 65, 35, 80, 55, 70, 45, 90, 50, 75, 60, 85].map((h, i) => (
                    <SkeletonPulse key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
                ))}
            </div>
        </div>
    );
}

// ─── Page Loading Skeleton ──────────────────────────────
export function PageLoadingSkeleton({ type = "cards" }: { type?: "cards" | "table" | "dashboard" }) {
    if (type === "dashboard") {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <SkeletonPulse className="h-7 w-48" />
                        <SkeletonPulse className="h-4 w-64" />
                    </div>
                    <SkeletonPulse className="h-10 w-32 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ChartSkeleton />
                    <ChartSkeleton />
                </div>
            </div>
        );
    }

    if (type === "table") {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <SkeletonPulse className="h-7 w-48" />
                    <div className="flex gap-3">
                        <SkeletonPulse className="h-10 w-56 rounded-xl" />
                        <SkeletonPulse className="h-10 w-24 rounded-xl" />
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
                    {Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <SkeletonPulse className="h-7 w-48" />
                    <SkeletonPulse className="h-4 w-64" />
                </div>
                <div className="flex gap-3">
                    <SkeletonPulse className="h-10 w-56 rounded-xl" />
                    <SkeletonPulse className="h-10 w-24 rounded-xl" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
        </div>
    );
}

// ─── Empty State ──────────────────────────────
const emptyIcons: Record<string, React.ElementType> = {
    leads: Users,
    properties: Home,
    visits: Calendar,
    reports: BarChart3,
    agents: Users,
    notes: FileText,
    search: Search,
    default: Inbox,
};

interface EmptyStateProps {
    type?: string;
    title?: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({ type = "default", title = "Nothing here yet", description = "Data will appear here once available.", actionLabel, onAction }: EmptyStateProps) {
    const Icon = emptyIcons[type] || emptyIcons.default;
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-20 h-20 bg-neutral-100 rounded-xl flex items-center justify-center mb-5 relative">
                <Icon size={32} className="text-neutral-300" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-primary text-xs font-bold">0</span>
                </div>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">{title}</h3>
            <p className="text-sm text-neutral-400 max-w-[320px] mb-5">{description}</p>
            {actionLabel && onAction && (
                <button onClick={onAction} className="px-5 py-2.5 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg">{actionLabel}</button>
            )}
        </div>
    );
}

// ─── Error State ──────────────────────────────
interface ErrorStateProps {
    title?: string;
    description?: string;
    onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", description = "We couldn't load this data. Please try again.", onRetry }: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-20 h-20 bg-red-50 rounded-xl flex items-center justify-center mb-5">
                <AlertTriangle size={32} className="text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">{title}</h3>
            <p className="text-sm text-neutral-400 max-w-[320px] mb-5">{description}</p>
            {onRetry && (
                <button onClick={onRetry} className="flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-md text-sm font-semibold hover:bg-neutral-800 transition-colors">
                    <RefreshCw size={16} /> Try Again
                </button>
            )}
        </div>
    );
}

// ─── No Search Results ──────────────────────────────
export function NoSearchResults({ query = "" }: { query?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-20 h-20 bg-blue-50 rounded-xl flex items-center justify-center mb-5">
                <Search size={32} className="text-blue-300" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">No results found</h3>
            <p className="text-sm text-neutral-400 max-w-[320px]">
                {query ? `No matches for "${query}". Try adjusting your search or filters.` : "Try adjusting your search or filters."}
            </p>
        </div>
    );
}
