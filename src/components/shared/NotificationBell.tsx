"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AtSign, Bell, Briefcase, Calendar, CheckCheck, CheckSquare, FileText, Gift, Megaphone, MessageSquare, UserCheck, Wallet,
} from "lucide-react";

interface Notification { id: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: string }

// Icon and colour by what the notification is about
function kindOf(n: Notification): { icon: typeof Bell; tone: string } {
    const t = `${n.title} ${n.message}`.toLowerCase();
    if (t.includes("mention")) return { icon: AtSign, tone: "bg-blue-50 text-blue-600" };
    if (t.includes("comment")) return { icon: MessageSquare, tone: "bg-sky-50 text-sky-600" };
    if (t.includes("task")) return { icon: CheckSquare, tone: "bg-violet-50 text-violet-600" };
    if (t.includes("leave") || t.includes("attendance") || t.includes("holiday")) return { icon: Calendar, tone: "bg-amber-50 text-amber-600" };
    if (t.includes("interview")) return { icon: UserCheck, tone: "bg-teal-50 text-teal-600" };
    if (t.includes("referral") || t.includes("partner")) return { icon: Gift, tone: "bg-pink-50 text-pink-600" };
    if (t.includes("invoice") || t.includes("payout") || t.includes("payment") || t.includes("expense") || t.includes("salary")) return { icon: Wallet, tone: "bg-emerald-50 text-emerald-600" };
    if (t.includes("job") || t.includes("requisition") || t.includes("candidate")) return { icon: Briefcase, tone: "bg-indigo-50 text-indigo-600" };
    if (t.includes("announcement")) return { icon: Megaphone, tone: "bg-orange-50 text-orange-600" };
    if (t.includes("document") || t.includes("letter")) return { icon: FileText, tone: "bg-slate-100 text-slate-600" };
    return { icon: Bell, tone: "bg-neutral-100 text-neutral-500" };
}

function ago(iso: string): string {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function NotificationBell() {
    const router = useRouter();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<"all" | "unread">("all");
    const ref = useRef<HTMLDivElement>(null);

    const { data: list = [] } = useQuery<Notification[]>({
        queryKey: ["notifications"],
        queryFn: async () => {
            const res = await fetch("/api/notifications");
            const data = await res.json().catch(() => []);
            return Array.isArray(data) ? data : [];
        },
        refetchInterval: 15000,
    });

    useEffect(() => {
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const unread = list.filter((n) => !n.isRead).length;
    const shown = tab === "unread" ? list.filter((n) => !n.isRead) : list;
    const today = new Date().toDateString();
    const groups = [
        { label: "Today", items: shown.filter((n) => new Date(n.createdAt).toDateString() === today) },
        { label: "Earlier", items: shown.filter((n) => new Date(n.createdAt).toDateString() !== today) },
    ].filter((g) => g.items.length);

    const mark = async (body: Record<string, unknown>) => {
        qc.setQueryData<Notification[]>(["notifications"], (old) => old?.map((n) => (body.all || n.id === body.id ? { ...n, isRead: true } : n)));
        await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                className={`relative p-2.5 rounded-full transition-colors ${open ? "bg-primary/10 text-primary" : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"}`}
            >
                <Bell size={20} />
                {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 bg-danger text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-neutral-100 animate-fade-in origin-top-right overflow-hidden">
                    <div className="px-4 pt-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-neutral-900">Notifications</p>
                        {unread > 0 && (
                            <button onClick={() => mark({ all: true })} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                                <CheckCheck size={13} /> Mark all read
                            </button>
                        )}
                    </div>
                    <div className="px-4 flex gap-4 border-b border-neutral-100 mt-2">
                        {(["all", "unread"] as const).map((t) => (
                            <button key={t} onClick={() => setTab(t)} className={`pb-2 text-xs font-semibold capitalize border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-neutral-500"}`}>
                                {t}{t === "unread" && unread ? ` (${unread})` : ""}
                            </button>
                        ))}
                    </div>
                    <div className="max-h-[440px] overflow-y-auto">
                        {groups.length === 0 && (
                            <div className="px-4 py-12 text-center">
                                <Bell size={30} className="mx-auto text-neutral-200 mb-3" />
                                <p className="text-sm text-neutral-400 font-medium">{tab === "unread" ? "You're all caught up" : "No notifications yet"}</p>
                            </div>
                        )}
                        {groups.map((g) => (
                            <div key={g.label}>
                                <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">{g.label}</p>
                                {g.items.map((n) => {
                                    const { icon: Icon, tone } = kindOf(n);
                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => { if (!n.isRead) mark({ id: n.id }); if (n.link) router.push(n.link); setOpen(false); }}
                                            className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors ${!n.isRead ? "bg-primary/[0.03]" : ""}`}
                                        >
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tone}`}><Icon size={15} /></span>
                                            <span className="flex-1 min-w-0">
                                                <span className="flex items-start justify-between gap-2">
                                                    <span className={`text-xs ${!n.isRead ? "font-bold text-neutral-900" : "font-semibold text-neutral-600"}`}>{n.title}</span>
                                                    <span className="text-[10px] text-neutral-400 whitespace-nowrap">{ago(n.createdAt)}</span>
                                                </span>
                                                <span className="block text-[11px] text-neutral-500 leading-snug line-clamp-2 mt-0.5">{n.message}</span>
                                            </span>
                                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
