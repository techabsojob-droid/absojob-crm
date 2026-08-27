"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { PageHeader, SectionCard, Badge, EmptyState } from "@/components/shared/ui";

const ACTION_TONES: Record<string, string> = {
    JOB_APPROVED: "text-emerald-600 bg-emerald-50",
    USER_SUSPENDED: "text-red-500 bg-red-50",
    STAGE_MOVED: "text-blue-600 bg-blue-50",
    CLIENT_CREATED: "text-purple-600 bg-purple-50",
    INTERVIEW_SCHEDULED: "text-cyan-600 bg-cyan-50",
    PAYOUT_PROCESSED: "text-amber-600 bg-amber-50",
};

export default function AuditLogPage() {
    const { data: logs, isLoading } = useQuery({
        queryKey: ["audit"],
        queryFn: async () => (await fetch("/api/admin/audit")).json(),
        refetchInterval: 15000,
    });

    return (
        <div className="space-y-6">
            <PageHeader title="Audit Log" subtitle="Immutable trail of every sensitive action — who did what & when" />

            {isLoading ? (
                <SectionCard><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-neutral-50 rounded-xl animate-pulse" />)}</div></SectionCard>
            ) : !Array.isArray(logs) || logs.length === 0 ? (
                <SectionCard><EmptyState icon={ScrollText} message="No audit entries yet." /></SectionCard>
            ) : (
                <SectionCard>
                    <ol className="relative border-l-2 border-neutral-100 ml-2 space-y-6">
                        {logs.map((log: any) => (
                            <li key={log.id} className="ml-6">
                                <span className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 border-white ${log.action.includes("SUSPEND") || log.action.includes("REJECT") ? "bg-red-400" : log.action.includes("APPROV") || log.action.includes("PAID") ? "bg-emerald-500" : "bg-primary"} shadow`} />
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge value={log.action} label={log.action.replaceAll("_", " ")} />
                                            <span className="text-xs font-bold text-neutral-700">{log.actorName}</span>
                                            <span className="text-[10px] text-neutral-400 uppercase font-semibold">{log.actorRole.replaceAll("_", " ")}</span>
                                        </div>
                                        <p className="text-sm text-neutral-600 mt-1.5 leading-snug">{log.detail}</p>
                                    </div>
                                    <time className="text-[11px] text-neutral-400 whitespace-nowrap shrink-0">
                                        {new Date(log.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                                    </time>
                                </div>
                            </li>
                        ))}
                    </ol>
                </SectionCard>
            )}
        </div>
    );
}
