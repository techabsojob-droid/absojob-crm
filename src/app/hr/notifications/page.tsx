"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    Bell, CheckCheck, Inbox, ArrowRight, Clock,
    AlertCircle, FileText, CalendarCheck, ShieldCheck,
    Briefcase, Wallet, Users
} from "lucide-react";

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    link?: string;
    is_read?: boolean;
    isRead?: boolean;
    created_at?: string;
    createdAt?: string;
}

export default function HRNotificationsPage() {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<"ALL" | "UNREAD" | "READ">("ALL");

    const { data: notifications = [], isLoading } = useQuery<NotificationItem[]>({
        queryKey: ["hr-notifications"],
        queryFn: async () => {
            const res = await fetch("/api/notifications");
            if (!res.ok) throw new Error("Failed to fetch notifications");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
    });

    const markReadMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error("Failed to mark as read");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-notifications"] });
        },
    });

    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            // mark all pending as read
            const unreadItems = notifications.filter((n) => !n.is_read && !n.isRead);
            await Promise.all(
                unreadItems.map((n) =>
                    fetch("/api/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: n.id }),
                    })
                )
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-notifications"] });
            toast.success("All notifications marked as read");
        },
    });

    const unreadCount = notifications.filter((n) => !n.is_read && !n.isRead).length;
    const readCount = notifications.length - unreadCount;

    let displayed = notifications;
    if (tab === "UNREAD") displayed = notifications.filter((n) => !n.is_read && !n.isRead);
    if (tab === "READ") displayed = notifications.filter((n) => n.is_read || n.isRead);

    const getIcon = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes("leave")) return CalendarCheck;
        if (t.includes("approval")) return ShieldCheck;
        if (t.includes("candidate") || t.includes("interview")) return Briefcase;
        if (t.includes("payroll") || t.includes("salary")) return Wallet;
        if (t.includes("onboarding") || t.includes("employee")) return Users;
        return FileText;
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="HR Notification Center"
                subtitle="Real-time system events, approval requests, candidate milestones, and compliance alerts."
                action={
                    unreadCount > 0 && (
                        <button
                            onClick={() => markAllReadMutation.mutate()}
                            disabled={markAllReadMutation.isPending}
                            className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs transition-colors flex items-center gap-2"
                        >
                            <CheckCheck size={16} /> Mark All as Read
                        </button>
                    )
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Total Notifications" value={notifications.length} icon={Bell} tone="primary" hint="Lifetime alerts" />
                <StatCard label="Unread Notifications" value={unreadCount} icon={AlertCircle} tone="red" hint="Actionable items" />
                <StatCard label="Archived / Read" value={readCount} icon={CheckCheck} tone="emerald" hint="Completed items" />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
                <button
                    onClick={() => setTab("ALL")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        tab === "ALL" ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                >
                    All ({notifications.length})
                </button>
                <button
                    onClick={() => setTab("UNREAD")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        tab === "UNREAD" ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                >
                    Unread ({unreadCount})
                </button>
                <button
                    onClick={() => setTab("READ")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        tab === "READ" ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                >
                    Read ({readCount})
                </button>
            </div>

            {/* Notifications Feed */}
            <SectionCard>
                {isLoading ? (
                    <div className="space-y-4 py-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-full" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-20" />
                            </div>
                        ))}
                    </div>
                ) : displayed.length === 0 ? (
                    <EmptyState icon={Inbox} message="No notifications found in this view." />
                ) : (
                    <div className="divide-y divide-neutral-100">
                        {displayed.map((n) => {
                            const isRead = n.is_read || n.isRead;
                            const Icon = getIcon(n.title);
                            const dateStr = n.created_at || n.createdAt;

                            return (
                                <div
                                    key={n.id}
                                    className={`py-4 px-3 flex items-start gap-4 rounded-xl transition-colors hover:bg-neutral-50/80 ${
                                        !isRead ? "bg-primary/[0.03]" : ""
                                    }`}
                                >
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            !isRead
                                                ? "bg-primary/10 text-primary"
                                                : "bg-neutral-100 text-neutral-400"
                                        }`}
                                    >
                                        <Icon size={18} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`text-sm ${!isRead ? "font-bold text-neutral-900" : "font-semibold text-neutral-700"}`}>
                                                {n.title}
                                            </p>
                                            {!isRead && (
                                                <span className="w-2 h-2 rounded-full bg-primary" />
                                            )}
                                        </div>
                                        <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                                            {n.message}
                                        </p>
                                        {dateStr && (
                                            <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
                                                <Clock size={11} /> {new Date(dateStr).toLocaleString()}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-center">
                                        {n.link && (
                                            <Link
                                                href={n.link}
                                                className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-primary hover:text-white text-neutral-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                                            >
                                                <span>View</span>
                                                <ArrowRight size={13} />
                                            </Link>
                                        )}
                                        {!isRead && (
                                            <button
                                                onClick={() => markReadMutation.mutate(n.id)}
                                                className="p-1.5 rounded-lg text-neutral-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                                title="Mark as read"
                                            >
                                                <CheckCheck size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
