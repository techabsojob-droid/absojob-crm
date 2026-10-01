"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { api } from "@/lib/api";

interface Msg { id: string; to: string[]; subject: string; html: string; status: string; error?: string | null; sentByName: string; createdAt: string; relatedType?: string | null }

export default function OutboxPage() {
    const { data } = useQuery<{ provider: string; messages: Msg[] }>({ queryKey: ["finance-outbox"], queryFn: () => api("/api/finance/outbox"), refetchInterval: 15000 });
    const [open, setOpen] = useState<Msg | null>(null);
    return (
        <div className="space-y-6">
            <PageHeader title="Email Outbox" subtitle="Invoices, reminders and statements sent to clients" />
            {data?.provider === "none" && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">No email provider configured — messages are logged here but not delivered. Set RESEND_API_KEY (and MAIL_FROM) on the server to send for real.</p>}
            <SectionCard title={`${data?.messages.length ?? 0} message(s)`}>
                {!data?.messages.length ? <EmptyState icon={Mail} message="Nothing sent yet." /> : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.messages.map((m) => (
                            <li key={m.id} onClick={() => setOpen(m)} className="py-2.5 flex justify-between gap-3 cursor-pointer hover:bg-neutral-50 px-2 rounded-lg">
                                <span className="min-w-0"><span className="font-semibold truncate block">{m.subject}</span><span className="text-[11px] text-neutral-500">to {m.to.join(", ") || "—"} · {new Date(m.createdAt).toLocaleString("en-IN")} · {m.sentByName}{m.error ? ` · ${m.error}` : ""}</span></span>
                                <Badge value={m.status === "SENT" ? "PAID" : m.status === "FAILED" ? "REJECTED" : "PENDING"} label={m.status} />
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
            <ModalShell open={!!open} onClose={() => setOpen(null)} title={open?.subject ?? ""} wide>
                {open && <iframe title="Email preview" sandbox="" srcDoc={open.html} className="w-full h-[480px] border border-neutral-200 rounded-xl" />}
            </ModalShell>
        </div>
    );
}
