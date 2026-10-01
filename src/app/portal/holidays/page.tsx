"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PartyPopper, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, SectionCard, Badge, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { api } from "@/lib/api";

interface H { id: string; date: string; name: string; type: string; weekday: string; past: boolean }
interface Data { year: string; holidays: H[]; next: { name: string; date: string } | null }

export default function HolidaysPage() {
    const [year, setYear] = useState<number | null>(null);
    const { data, isLoading } = useQuery<Data>({ queryKey: ["holidays", year], queryFn: () => api(`/api/portal/holidays${year ? `?year=${year}` : ""}`) });
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const y = Number(data.year);
    const daysTo = data.next ? Math.round((+new Date(`${data.next.date}T00:00:00Z`) - +new Date(new Date().toISOString().slice(0, 10))) / 86400000) : null;
    return (
        <div className="space-y-6 max-w-3xl">
            <PageHeader title="Holiday Calendar" subtitle="Company holidays — optional holidays can be taken as casual leave" />
            {data.next && <div className="rounded-2xl bg-fuchsia-50 border border-fuchsia-100 p-4 text-sm text-fuchsia-900 flex items-center gap-2"><PartyPopper size={16} /> Next holiday: <b>{data.next.name}</b> on {data.next.date}{daysTo !== null ? ` — ${daysTo === 0 ? "today" : `in ${daysTo} day(s)`}` : ""}</div>}
            <SectionCard title={`Holidays ${y}`} action={<div className="flex gap-1"><button onClick={() => setYear(y - 1)} className="p-1.5 rounded-lg border border-neutral-200" aria-label="Previous year"><ChevronLeft size={14} /></button><button onClick={() => setYear(y + 1)} className="p-1.5 rounded-lg border border-neutral-200" aria-label="Next year"><ChevronRight size={14} /></button></div>}>
                {data.holidays.length === 0 ? <EmptyState icon={PartyPopper} message="No holidays published for this year yet." /> : (
                    <ul className="divide-y divide-neutral-100">
                        {data.holidays.map((h) => (
                            <li key={h.id} className={`py-3 flex items-center justify-between text-sm ${h.past ? "opacity-50" : ""}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 text-center rounded-xl bg-neutral-50 py-1"><p className="text-[10px] font-bold text-neutral-400 uppercase">{new Date(`${h.date}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</p><p className="text-lg font-extrabold leading-none">{Number(h.date.slice(8))}</p></div>
                                    <div><p className="font-semibold">{h.name}</p><p className="text-[11px] text-neutral-500">{h.weekday}</p></div>
                                </div>
                                <Badge value={h.type === "OPTIONAL" ? "PENDING" : "VERIFIED"} label={h.type === "OPTIONAL" ? "Optional" : h.type === "NATIONAL" ? "National" : "Festival"} />
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </div>
    );
}
