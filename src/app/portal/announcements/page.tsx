"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone, Pin } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { ago } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface A { id: string; title: string; body: string; pinned: boolean; createdAt: string; author: string }

export default function AnnouncementsPage() {
    const { data, isLoading } = useQuery<A[]>({ queryKey: ["my-announcements"], queryFn: () => api("/api/portal/announcements") });
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    return (
        <div className="space-y-6 max-w-3xl">
            <PageHeader title="Announcements" subtitle="Company news and notices" />
            {data.length === 0 ? <SectionCard><EmptyState icon={Megaphone} message="Nothing new right now." /></SectionCard> : data.map((a) => (
                <div key={a.id} className={`rounded-2xl border p-5 ${a.pinned ? "bg-amber-50/60 border-amber-200" : "bg-white border-neutral-200/80"}`}>
                    <div className="flex items-center justify-between gap-2"><p className="font-extrabold text-neutral-900 flex items-center gap-2">{a.pinned && <Pin size={14} className="text-amber-600" />}{a.title}</p><span className="text-[11px] text-neutral-400 shrink-0">{a.author} · {ago(a.createdAt)}</span></div>
                    <p className="text-sm text-neutral-700 mt-2 whitespace-pre-line">{a.body}</p>
                </div>
            ))}
        </div>
    );
}
