"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PartyPopper, Trash2 } from "lucide-react";
import { PageHeader, SectionCard, Badge, EmptyState } from "@/components/shared/ui";
import { btn, inputCls, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface H { id: string; date: string; name: string; type: string; locations?: string[] }

export default function HrHolidaysPage() {
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const { data = [] } = useQuery<H[]>({ queryKey: ["hr-holidays", year], queryFn: () => api(`/api/hr/holidays?year=${year}`) });
    const [f, setF] = useState({ date: "", name: "", type: "FESTIVAL", locations: "" });
    const add = useAct("/api/hr/holidays", "POST", ["hr-holidays"], "Holiday added — employees notified");
    const del = useAct("/api/hr/holidays", "DELETE", ["hr-holidays"], "Holiday removed");
    return (
        <div className="space-y-6 max-w-4xl">
            <PageHeader title="Holiday Calendar" subtitle="Holidays are excluded from leave and marked on every employee's attendance calendar" />
            <SectionCard title="Add holiday">
                <form className="grid grid-cols-1 sm:grid-cols-5 gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate({ ...f, locations: f.locations.split(",").map((x) => x.trim()).filter(Boolean) }, { onSuccess: () => setF({ date: "", name: "", type: "FESTIVAL", locations: "" }) }); }}>
                    <input required type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} aria-label="Date" />
                    <input required placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`${inputCls} sm:col-span-2`} />
                    <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inputCls} aria-label="Type"><option value="NATIONAL">National</option><option value="FESTIVAL">Festival</option><option value="OPTIONAL">Optional</option></select>
                    <button disabled={add.isPending} className="rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Add</button>
                    <input placeholder="Only for locations (comma separated, blank = all)" value={f.locations} onChange={(e) => setF({ ...f, locations: e.target.value })} className={`${inputCls} sm:col-span-5`} />
                </form>
            </SectionCard>
            <SectionCard title={`Holidays ${year} (${data.length})`} action={<select value={year} onChange={(e) => setYear(e.target.value)} className={`${inputCls} w-28`} aria-label="Year">{[0, 1, 2].map((n) => String(new Date().getFullYear() - 1 + n)).map((y) => <option key={y}>{y}</option>)}</select>}>
                {data.length === 0 ? <EmptyState icon={PartyPopper} message="No holidays for this year." /> : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                        {data.map((h) => <li key={h.id} className="py-2.5 flex items-center justify-between"><span><b>{h.date}</b> · {h.name}{h.locations?.length ? <span className="text-xs text-neutral-500"> · {h.locations.join(", ")}</span> : null}</span><span className="flex items-center gap-2"><Badge value={h.type === "OPTIONAL" ? "PENDING" : "VERIFIED"} label={h.type.toLowerCase()} /><button disabled={del.isPending} onClick={() => { if (window.confirm(`Remove ${h.name}?`)) del.mutate({ id: h.id }); }} className={btn.danger} aria-label="Remove"><Trash2 size={12} /></button></span></li>)}
                    </ul>
                )}
            </SectionCard>
        </div>
    );
}
