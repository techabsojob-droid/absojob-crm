"use client";

import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, CheckCircle2, AlertTriangle, Mail, MessageSquare, Calendar, Briefcase, CreditCard, Clock } from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import type { IntegrationStatus } from "@/lib/integrations";

const ICONS: Record<string, typeof Mail> = { Mail, MessageSquare, Calendar, Briefcase, CreditCard };

const AVAILABILITY: Record<IntegrationStatus["availability"], { label: string; cls: string }> = {
    LIVE: { label: "Live", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    NEEDS_SETUP: { label: "Needs setup", cls: "bg-amber-50 text-amber-800 border-amber-200" },
    NOT_BUILT: { label: "Not built yet", cls: "bg-neutral-100 text-neutral-600 border-neutral-200" },
};

export default function IntegrationsPage() {
    const { data: services = [], isLoading } = useQuery<IntegrationStatus[]>({
        queryKey: ["admin-integrations"],
        queryFn: async () => {
            const res = await fetch("/api/admin/integrations");
            if (!res.ok) throw new Error();
            return res.json();
        },
    });

    const live = services.filter((s) => s.availability === "LIVE").length;
    const setup = services.filter((s) => s.availability === "NEEDS_SETUP").length;
    const planned = services.filter((s) => s.availability === "NOT_BUILT").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Integrations"
                subtitle="What the CRM actually exchanges with outside services. Status comes from the server's configuration, not a switch."
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Live" value={live} icon={CheckCircle2} tone="emerald" hint="working now" />
                <StatCard label="Needs setup" value={setup} icon={AlertTriangle} tone={setup > 0 ? "amber" : "blue"} hint="built, missing server keys" />
                <StatCard label="Not built yet" value={planned} icon={Clock} tone="purple" hint="planned, no data exchanged" />
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonPulse key={i} className="h-32 rounded-2xl" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map((srv) => {
                        const Icon = ICONS[srv.icon] || SlidersHorizontal;
                        const a = AVAILABILITY[srv.availability];
                        return (
                            <div key={srv.id} className="p-5 bg-white rounded-2xl border border-neutral-100 shadow-sm space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-primary shrink-0">
                                            <Icon size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-bold text-neutral-900">{srv.name}</h4>
                                            <span className="text-[10px] text-neutral-400 font-semibold">{srv.provider}</span>
                                        </div>
                                    </div>
                                    <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold ${a.cls}`}>{a.label}</span>
                                </div>
                                <p className="text-[11px] text-neutral-600 leading-relaxed">{srv.description}</p>
                                <p className="p-2 bg-neutral-50 rounded-lg text-[11px] text-neutral-600">{srv.detail}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
