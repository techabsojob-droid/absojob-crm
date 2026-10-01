"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Mail, Phone, MapPin, Cake, Award, Users } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { inputCls } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Person { id: string; name: string; designation: string; department: string; email: string; phone: string; location: string | null; workMode: string | null; managerName: string | null; isMe: boolean }
interface Data { people: Person[]; departments: string[]; birthdays: { name: string; day: number }[]; anniversaries: { name: string; day: number; years: number }[] }

export default function DirectoryPage() {
    const [q, setQ] = useState("");
    const [dept, setDept] = useState("");
    const { data, isLoading } = useQuery<Data>({ queryKey: ["directory", q, dept], queryFn: () => api(`/api/portal/directory?q=${encodeURIComponent(q)}${dept ? `&department=${encodeURIComponent(dept)}` : ""}`) });
    const month = new Date().toLocaleDateString("en-IN", { month: "long" });
    return (
        <div className="space-y-6">
            <PageHeader title="People Directory" subtitle="Find colleagues — work contact details only" />
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[220px]"><Search size={14} className="absolute left-3 top-2.5 text-neutral-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, role, department, city" className={`${inputCls} pl-8`} /></div>
                <select value={dept} onChange={(e) => setDept(e.target.value)} className={`${inputCls} w-52`} aria-label="Department"><option value="">All departments</option>{data?.departments.map((d) => <option key={d}>{d}</option>)}</select>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    {isLoading || !data ? <SkeletonPulse className="h-64 w-full" /> : data.people.length === 0 ? <SectionCard><EmptyState icon={Users} message="No one matches your search." /></SectionCard> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {data.people.map((p) => (
                                <div key={p.id} className={`bg-white rounded-2xl border p-4 flex gap-3 ${p.isMe ? "border-primary" : "border-neutral-200/80"}`}>
                                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary font-black flex items-center justify-center shrink-0">{p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
                                    <div className="min-w-0 text-xs space-y-0.5">
                                        <p className="text-sm font-bold text-neutral-900">{p.name}{p.isMe ? " (you)" : ""}</p>
                                        <p className="text-neutral-600">{p.designation} · {p.department}</p>
                                        {p.managerName && <p className="text-neutral-400">Reports to {p.managerName}</p>}
                                        <a href={`mailto:${p.email}`} className="flex items-center gap-1 hover:text-primary truncate"><Mail size={11} />{p.email}</a>
                                        <a href={`tel:${p.phone}`} className="flex items-center gap-1 hover:text-primary"><Phone size={11} />{p.phone}</a>
                                        {p.location && <p className="flex items-center gap-1 text-neutral-500"><MapPin size={11} />{p.location}{p.workMode ? ` · ${p.workMode.toLowerCase()}` : ""}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="space-y-6">
                    <SectionCard title={`Birthdays in ${month}`}>{!data?.birthdays.length ? <p className="text-xs text-neutral-400">None this month.</p> : <ul className="space-y-1.5 text-sm">{data.birthdays.map((b) => <li key={b.name} className="flex justify-between"><span className="flex items-center gap-1.5"><Cake size={12} className="text-pink-500" />{b.name}</span><span className="text-xs text-neutral-500">{b.day} {month.slice(0, 3)}</span></li>)}</ul>}</SectionCard>
                    <SectionCard title="Work anniversaries">{!data?.anniversaries.length ? <p className="text-xs text-neutral-400">None this month.</p> : <ul className="space-y-1.5 text-sm">{data.anniversaries.map((b) => <li key={b.name} className="flex justify-between"><span className="flex items-center gap-1.5"><Award size={12} className="text-amber-500" />{b.name}</span><span className="text-xs text-neutral-500">{b.years} yr · {b.day} {month.slice(0, 3)}</span></li>)}</ul>}</SectionCard>
                </div>
            </div>
        </div>
    );
}
