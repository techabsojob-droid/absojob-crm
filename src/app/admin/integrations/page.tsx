"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, CheckCircle2, AlertTriangle, RefreshCw, Mail, MessageSquare, Calendar, Briefcase, CreditCard, Cloud, Zap, Power } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import type { IntegrationService } from "@/lib/types";

const ICONS: Record<string, any> = {
    Mail,
    MessageSquare,
    Calendar,
    Briefcase,
    CreditCard,
    Cloud,
    Zap,
};

export default function IntegrationsPage() {
    const qc = useQueryClient();

    const { data: services = [], isLoading } = useQuery<IntegrationService[]>({
        queryKey: ["admin-integrations"],
        queryFn: async () => {
            const res = await fetch("/api/admin/integrations");
            if (!res.ok) throw new Error();
            return res.json();
        },
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const res = await fetch("/api/admin/integrations", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(`Service status set to ${vars.status}`);
            qc.invalidateQueries({ queryKey: ["admin-integrations"] });
        },
        onError: () => toast.error("Action failed"),
    });

    const connectedCount = services.filter((s) => s.status === "CONNECTED").length;
    const attentionCount = services.filter((s) => s.status === "NEEDS_ATTENTION").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="System Integrations & API Hub"
                subtitle="Manage third-party connections: Job Portals (Naukri, LinkedIn), Email & Calendars, WhatsApp API & Razorpay Payouts"
            />

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Connected Services" value={connectedCount} icon={CheckCircle2} tone="emerald" hint="active live webhooks" />
                <StatCard label="Needs Attention" value={attentionCount} icon={AlertTriangle} tone={attentionCount > 0 ? "amber" : "blue"} hint="token refresh recommended" />
                <StatCard label="Monthly Syncs" value="18,420" icon={RefreshCw} tone="primary" hint="automated webhook events" />
                <StatCard label="Storage Vault" value="42 GB" icon={Cloud} tone="purple" hint="encrypted candidate resumes" />
            </div>

            {/* Service Cards Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-32 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map((srv) => {
                        const IconComponent = ICONS[srv.icon] || SlidersHorizontal;
                        return (
                            <div
                                key={srv.id}
                                className="p-5 bg-white rounded-2xl border border-neutral-100 shadow-sm flex flex-col justify-between gap-4 hover:border-neutral-200 transition-all"
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-primary shrink-0">
                                                <IconComponent size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-neutral-900">{srv.name}</h4>
                                                <span className="text-[10px] text-neutral-400 font-semibold">{srv.provider} · {srv.category}</span>
                                            </div>
                                        </div>
                                        <Badge value={srv.status} label={srv.status.replace("_", " ")} />
                                    </div>
                                    <p className="text-[11px] text-neutral-600 leading-relaxed mt-2">{srv.description}</p>
                                    {srv.configSummary && (
                                        <div className="p-2 bg-neutral-50 rounded-lg text-[10px] text-neutral-500 font-medium mt-2.5">
                                            {srv.configSummary}
                                        </div>
                                    )}
                                </div>
                                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                                    <span className="text-neutral-400">Account: <strong>{srv.connectedAccount}</strong></span>
                                    <button
                                        onClick={() => toggleMutation.mutate({
                                            id: srv.id,
                                            status: srv.status === "CONNECTED" ? "DISCONNECTED" : "CONNECTED"
                                        })}
                                        className={`px-3 py-1 font-bold rounded-lg text-xs transition-all ${
                                            srv.status === "CONNECTED"
                                                ? "text-red-600 bg-red-50 hover:bg-red-100"
                                                : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                        }`}
                                    >
                                        {srv.status === "CONNECTED" ? "Disconnect" : "Connect"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
