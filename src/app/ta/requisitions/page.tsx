"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    AlertTriangle, Briefcase, ChevronLeft, ChevronRight, Clock, Copy, Download, Eye, Flame, MoreHorizontal, Pause, Pencil, Play,
    Plus, Search, ShieldCheck, Users, UserCog, XCircle, Archive, SlidersHorizontal, LayoutGrid, List, MapPin, CalendarClock, GitBranch, IndianRupee,
} from "lucide-react";
import { Badge, StatCard } from "@/components/shared/ui";
import { ActionDialog, StatusPill, type ActionKind } from "@/components/ta/requisition/RequisitionActions";
import { useAuth } from "@/lib/auth";
import { canCreateRequisition } from "@/lib/access";
import { api } from "@/lib/api";
import { requisitionLabel } from "@/lib/fit";
import {
    EMPLOYMENT_TYPES, OPEN_JOB_STATUSES, PRIORITIES, REQUISITION_STATUS_FILTERS, matchesStatusFilter, optLabel, requisitionStatusLabel,
} from "@/lib/requisition-options";

interface Row {
    id: string; requisitionCode?: string; title: string; clientId: string; clientName: string; department: string; location: string; city?: string;
    locationState?: string | null; locationStateCode?: string | null; locationCityId?: string | null; locationLocality?: string | null;
    openings: number; filled: number; remainingOpenings: number; experienceMinYears: number; experienceMaxYears: number; salaryMinLpa: number; salaryMaxLpa: number;
    priority: string; employmentType: string; primaryRecruiterId?: string | null; primaryRecruiterName?: string | null; assignedTas: string[];
    targetCloseDate?: string | null; status: string; statusReason?: string; createdAt: string; requestedById: string | null; requestedByName?: string | null;
    inPipeline: number; totalCandidates: number; canEdit: boolean; daysRemaining: number; workMode?: string;
    clientIndustry?: string; publishedAt?: string | null; approvedAt?: string | null;
}

const PAGE_SIZE = 25;
const sel = "h-9 px-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 outline-none hover:border-neutral-300 focus:border-primary";
const isOpen = (s: string) => (OPEN_JOB_STATUSES as readonly string[]).includes(s);
const isClosed = (s: string) => ["CLOSED", "CANCELLED", "FULFILLED"].includes(s);
/** When the opening went live: published, else approved, else created. */
const postedOf = (j: Pick<Row, "publishedAt" | "approvedAt" | "createdAt">) => (j.publishedAt ?? j.approvedAt ?? j.createdAt).slice(0, 10);
const industryOf = (j: Pick<Row, "clientIndustry">) => j.clientIndustry || "Other";
const fmtDate = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export default function TaRequisitionsPage() {
    const router = useRouter();
    const qc = useQueryClient();
    const { user } = useAuth();
    const isManager = user?.role === "SUPER_ADMIN" || user?.role === "TA_MANAGER";

    // Filters
    const [q, setQ] = useState("");
    const [status, setStatus] = useState("ACTIVE");
    const [clientId, setClientId] = useState("");
    const [department, setDepartment] = useState("");
    const [stateCode, setStateCode] = useState("");
    const [city, setCity] = useState("");
    const [priority, setPriority] = useState("");
    const [employmentType, setEmploymentType] = useState("");
    const [recruiterId, setRecruiterId] = useState("");
    const [industry, setIndustry] = useState("");
    const [experience, setExperience] = useState("");
    const [createdFrom, setCreatedFrom] = useState("");
    const [createdTo, setCreatedTo] = useState("");
    const [closeFrom, setCloseFrom] = useState("");
    const [closeTo, setCloseTo] = useState("");
    const [moreFilters, setMoreFilters] = useState(false);
    const [sort, setSort] = useState<{ key: keyof Row; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
    const [page, setPage] = useState(1);
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [action, setAction] = useState<{ kind: ActionKind; job: Row } | null>(null);
    const [view, setView] = useState<"table" | "cards">("table");

    const { data, isLoading, isError, error } = useQuery<Row[]>({ queryKey: ["ta-jobs"], queryFn: () => api("/api/admin/jobs"), refetchInterval: 30000 });
    const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);

    // Filter option lists come from the requisitions themselves
    const facet = <T,>(f: (j: Row) => T | null | undefined, label: (j: Row) => string) => {
        const m = new Map<string, string>();
        for (const j of all) { const v = f(j); if (v != null && v !== "") m.set(String(v), label(j)); }
        return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    };
    const clients = facet((j) => j.clientId, (j) => j.clientName);
    const departments = facet((j) => j.department, (j) => j.department);
    const states = facet((j) => j.locationStateCode, (j) => j.locationState ?? "");
    const cities = facet((j) => (!stateCode || j.locationStateCode === stateCode ? j.city : null), (j) => j.city ?? "");
    const recruiters = facet((j) => j.primaryRecruiterId, (j) => j.primaryRecruiterName ?? "");
    const industries = facet((j) => industryOf(j), (j) => industryOf(j));

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        const list = all.filter((j) =>
            (status === "ALL" || (status === "ACTIVE" ? !isClosed(j.status) : matchesStatusFilter(j.status, status)))
            && (!t || j.title.toLowerCase().includes(t) || (j.requisitionCode ?? j.id).toLowerCase().includes(t))
            && (!clientId || j.clientId === clientId)
            && (!department || j.department === department)
            && (!stateCode || j.locationStateCode === stateCode)
            && (!city || j.city === city)
            && (!priority || j.priority === priority)
            && (!employmentType || j.employmentType === employmentType)
            && (!recruiterId || j.primaryRecruiterId === recruiterId || j.assignedTas?.includes(recruiterId))
            && (!industry || industryOf(j) === industry)
            // Candidate's experience must fit the opening's range
            && (experience === "" || (Number(experience) >= j.experienceMinYears && Number(experience) <= j.experienceMaxYears))
            && (!createdFrom || postedOf(j) >= createdFrom) && (!createdTo || postedOf(j) <= createdTo)
            && (!closeFrom || (j.targetCloseDate ?? "") >= closeFrom) && (!closeTo || (!!j.targetCloseDate && j.targetCloseDate <= closeTo)));
        return list.sort((a, b) => {
            const x = a[sort.key] ?? "", y = b[sort.key] ?? "";
            return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
        });
    }, [all, q, status, clientId, department, stateCode, city, priority, employmentType, recruiterId, industry, experience, createdFrom, createdTo, closeFrom, closeTo, sort]);

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    const filtersOn = !!(q || status !== "ACTIVE" || clientId || department || stateCode || city || priority || employmentType || recruiterId || industry || experience || createdFrom || createdTo || closeFrom || closeTo);
    const resetFilters = () => { setQ(""); setStatus("ACTIVE"); setClientId(""); setDepartment(""); setStateCode(""); setCity(""); setPriority(""); setEmploymentType(""); setRecruiterId(""); setIndustry(""); setExperience(""); setCreatedFrom(""); setCreatedTo(""); setCloseFrom(""); setCloseTo(""); setPage(1); };
    // Open openings per industry (respecting every filter except industry itself) for the quick chips
    const industryCounts = useMemo(() => {
        const m = new Map<string, number>();
        for (const j of all) if (isOpen(j.status)) m.set(industryOf(j), (m.get(industryOf(j)) ?? 0) + 1);
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }, [all]);

    const metrics = useMemo(() => {
        const open = all.filter((j) => isOpen(j.status));
        return {
            open: open.length,
            openings: open.reduce((s, j) => s + (j.openings || 0), 0),
            filled: open.reduce((s, j) => s + (j.filled || 0), 0),
            critical: all.filter((j) => j.priority === "URGENT" && !isClosed(j.status)).length,
            pending: all.filter((j) => j.status === "PENDING_APPROVAL").length,
            drafts: all.filter((j) => j.status === "DRAFT").length,
            overdue: open.filter((j) => j.targetCloseDate && j.targetCloseDate < new Date().toISOString().slice(0, 10)).length,
        };
    }, [all]);

    const exportCsv = () => {
        if (!filtered.length) return toast.error("No requisitions to export");
        const head = ["Requisition ID", "Job Title", "Client", "Industry", "Department", "Location", "State", "Openings", "Filled", "Experience", "Salary (LPA)", "Priority", "Employment Type", "Assigned Recruiter", "Target Closure", "Status", "Created"];
        const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
        const lines = filtered.map((j) => [requisitionLabel(j), j.title, j.clientName, industryOf(j), j.department, j.location, j.locationState ?? "", j.openings, j.filled, `${j.experienceMinYears}-${j.experienceMaxYears} yrs`,
            `${j.salaryMinLpa}-${j.salaryMaxLpa}`, optLabel(PRIORITIES, j.priority), optLabel(EMPLOYMENT_TYPES, j.employmentType), j.primaryRecruiterName ?? "", j.targetCloseDate ?? "", requisitionStatusLabel(j.status), j.createdAt.slice(0, 10)].map(cell).join(","));
        const blob = new Blob([`﻿${[head.join(","), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `all-openings-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const sortBy = (key: keyof Row) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
    const th = { sort, onSort: sortBy };
    return (
        <div className="space-y-5 pb-16 max-w-[1600px] mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-neutral-900">All Openings</h1>
                    <p className="text-[13px] text-neutral-500 mt-1">Every opening you can work on — by industry, client and location, with ownership, approval and hiring progress.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={exportCsv} className="h-10 px-3.5 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5"><Download size={15} /> Export</button>
                    {canCreateRequisition(user?.role) && <Link href="/ta/requisitions/new" className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm hover:bg-primary-dark flex items-center gap-1.5"><Plus size={15} /> New Requisition</Link>}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <StatCard label="Open requisitions" value={metrics.open} icon={Briefcase} hint={`${metrics.openings} openings`} />
                <StatCard label="Filled / openings" value={`${metrics.filled}/${metrics.openings}`} icon={Users} tone="blue" hint={`${Math.round((metrics.filled / Math.max(1, metrics.openings)) * 100)}% filled`} />
                <StatCard label="Critical" value={metrics.critical} icon={Flame} tone="red" hint="Active, critical priority" />
                <StatCard label="Pending approval" value={metrics.pending} icon={ShieldCheck} tone="amber" hint={isManager ? "Awaiting your decision" : "Awaiting team lead"} />
                <StatCard label="Past target date" value={metrics.overdue} icon={AlertTriangle} tone="purple" hint="Open, target closure passed" />
                <StatCard label="My drafts" value={metrics.drafts} icon={Clock} tone="neutral" hint="Not yet submitted" />
            </div>

            {/* Filters */}
            <div className="bg-white p-3 rounded-2xl border border-neutral-200/80 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search job title or requisition ID" className={`${sel} w-full pl-9 font-medium`} />
                    </div>
                    <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={sel} aria-label="Status">
                        <option value="ACTIVE">Active (not closed)</option>
                        {REQUISITION_STATUS_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        <option value="ALL">All statuses</option>
                    </select>
                    <select value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }} className={`${sel} max-w-[180px]`} aria-label="Client">
                        <option value="">All clients</option>{clients.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1); }} className={`${sel} max-w-[170px]`} aria-label="Industry">
                        <option value="">All industries</option>{industries.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className={sel} aria-label="Priority">
                        <option value="">All priorities</option>{PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <select value={recruiterId} onChange={(e) => { setRecruiterId(e.target.value); setPage(1); }} className={`${sel} max-w-[170px]`} aria-label="Recruiter">
                        <option value="">All recruiters</option>{recruiters.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <div className="flex items-center bg-neutral-100 rounded-xl p-0.5" role="group" aria-label="View">
                        {([["table", List, "Table"], ["cards", LayoutGrid, "Cards"]] as const).map(([v, Icon, l]) => (
                            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                                className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${view === v ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"}`}>
                                <Icon size={13} /> {l}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => setMoreFilters((v) => !v)} className={`${sel} flex items-center gap-1.5 ${moreFilters ? "border-primary text-primary" : ""}`}><SlidersHorizontal size={13} /> More filters</button>
                    {filtersOn && <button type="button" onClick={resetFilters} className="text-xs font-semibold text-red-600 hover:underline px-1">Reset</button>}
                </div>
                {moreFilters && (
                    <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-9 gap-2 pt-2 border-t border-neutral-100">
                        <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} className={sel} aria-label="Department"><option value="">All departments</option>{departments.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        <select value={stateCode} onChange={(e) => { setStateCode(e.target.value); setCity(""); setPage(1); }} className={sel} aria-label="State"><option value="">All states</option>{states.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        <select value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} className={sel} aria-label="City"><option value="">All cities</option>{cities.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        <select value={employmentType} onChange={(e) => { setEmploymentType(e.target.value); setPage(1); }} className={sel} aria-label="Employment type"><option value="">All employment types</option>{EMPLOYMENT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                        <label className="flex flex-col text-[10px] font-bold uppercase tracking-wide text-neutral-400">Candidate exp (yrs)<input type="number" min="0" max="50" value={experience} onChange={(e) => { setExperience(e.target.value); setPage(1); }} placeholder="e.g. 3" className={sel} /></label>
                        <label className="flex flex-col text-[10px] font-bold uppercase tracking-wide text-neutral-400">Posted from<input type="date" value={createdFrom} onChange={(e) => { setCreatedFrom(e.target.value); setPage(1); }} className={sel} /></label>
                        <label className="flex flex-col text-[10px] font-bold uppercase tracking-wide text-neutral-400">Posted to<input type="date" value={createdTo} min={createdFrom} onChange={(e) => { setCreatedTo(e.target.value); setPage(1); }} className={sel} /></label>
                        <label className="flex flex-col text-[10px] font-bold uppercase tracking-wide text-neutral-400">Closure from<input type="date" value={closeFrom} onChange={(e) => { setCloseFrom(e.target.value); setPage(1); }} className={sel} /></label>
                        <label className="flex flex-col text-[10px] font-bold uppercase tracking-wide text-neutral-400">Closure to<input type="date" value={closeTo} min={closeFrom} onChange={(e) => { setCloseTo(e.target.value); setPage(1); }} className={sel} /></label>
                    </div>
                )}
            </div>

            {industryCounts.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => { setIndustry(""); setPage(1); }} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${!industry ? "bg-primary text-white border-primary" : "bg-white border-neutral-200 text-neutral-600 hover:border-primary/40"}`}>All industries</button>
                    {industryCounts.map(([name, n]) => (
                        <button key={name} type="button" onClick={() => { setIndustry(industry === name ? "" : name); setPage(1); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${industry === name ? "bg-primary text-white border-primary" : "bg-white border-neutral-200 text-neutral-600 hover:border-primary/40"}`}>
                            {name} <span className="opacity-70">· {n} open</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Table / cards */}
            <div className={view === "table" || !filtered.length || isLoading || isError ? "bg-white rounded-2xl border border-neutral-200/80 overflow-hidden" : ""}>
                {isError ? <p className="p-10 text-center text-sm text-red-600">{(error as Error).message}</p>
                    : isLoading ? <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-neutral-100 animate-pulse" />)}</div>
                        : !filtered.length ? (
                            <div className="p-14 text-center space-y-3">
                                <Briefcase size={28} className="mx-auto text-neutral-300" />
                                <p className="text-sm text-neutral-500">{filtersOn ? "No requisitions match these filters." : "No requisitions yet."}</p>
                                {filtersOn ? <button type="button" onClick={resetFilters} className="text-sm font-semibold text-primary">Reset filters</button>
                                    : canCreateRequisition(user?.role) ? <Link href="/ta/requisitions/new" className="inline-flex h-9 px-4 items-center rounded-xl bg-primary text-white text-sm font-semibold">Create requisition</Link>
                                        : <p className="text-xs text-neutral-400">Requisitions assigned to you will appear here.</p>}
                            </div>
                        ) : (
                            <>
                                {view === "cards" ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                        {rows.map((j) => (
                                            <JobCard key={j.id} job={j}
                                                menu={<RowMenu job={j} open={menuFor === j.id} onToggle={() => setMenuFor(menuFor === j.id ? null : j.id)} onClose={() => setMenuFor(null)} isManager={isManager}
                                                    onAction={(kind) => { setMenuFor(null); setAction({ kind, job: j }); }}
                                                    onNavigate={(href) => { setMenuFor(null); router.push(href); }} />} />
                                        ))}
                                    </div>
                                ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs min-w-[1400px]">
                                        <thead>
                                            <tr className="bg-neutral-50/80 border-b border-neutral-200/70 text-neutral-400 uppercase tracking-wider text-[10px]">
                                                <Th {...th} k="requisitionCode">Req ID</Th><Th {...th} k="title">Job Title</Th><Th {...th} k="clientName">Client</Th><Th {...th} k="department">Department</Th><Th {...th} k="location">Location</Th>
                                                <Th {...th} k="openings">Openings</Th><Th {...th} k="experienceMinYears">Experience</Th><Th {...th} k="salaryMinLpa">Salary (LPA)</Th><Th {...th} k="priority">Priority</Th>
                                                <Th {...th} k="primaryRecruiterName">Recruiter</Th><Th {...th} k="targetCloseDate">Target Closure</Th><Th {...th} k="status">Status</Th><Th {...th} k="createdAt">Posted</Th><Th {...th} className="text-right">Actions</Th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-100">
                                            {rows.map((j) => {
                                                const pct = Math.min(100, Math.round(((j.filled || 0) / Math.max(1, j.openings || 1)) * 100));
                                                const late = isOpen(j.status) && j.targetCloseDate && j.targetCloseDate < new Date().toISOString().slice(0, 10);
                                                return (
                                                    <tr key={j.id} className="hover:bg-neutral-50/60 align-top">
                                                        <td className="py-3 px-3 font-mono text-[11px] font-bold text-neutral-500 whitespace-nowrap">{requisitionLabel(j)}</td>
                                                        <td className="py-3 px-3 min-w-[200px]">
                                                            <Link href={`/ta/requisitions/${j.id}`} className="font-bold text-[13px] text-neutral-900 hover:text-primary line-clamp-1">{j.title}</Link>
                                                            <p className="text-[11px] text-neutral-400">{optLabel(EMPLOYMENT_TYPES, j.employmentType)} · {j.totalCandidates} candidate(s)</p>
                                                        </td>
                                                        <td className="py-3 px-3 max-w-[160px]"><span className="block font-semibold text-neutral-800 truncate">{j.clientName}</span><span className="block text-[11px] text-neutral-400 truncate">{industryOf(j)}</span></td>
                                                        <td className="py-3 px-3 text-neutral-600 max-w-[130px] truncate">{j.department}</td>
                                                        <td className="py-3 px-3 text-neutral-600 max-w-[170px]"><span className="line-clamp-1">{j.location || "—"}</span>{j.locationState && <span className="block text-[11px] text-neutral-400">{j.locationState}</span>}</td>
                                                        <td className="py-3 px-3 min-w-[110px]">
                                                            <p className="font-bold text-neutral-800">{j.filled}/{j.openings} <span className="font-medium text-neutral-400">filled</span></p>
                                                            <div className="h-1.5 bg-neutral-100 rounded-full mt-1 overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
                                                        </td>
                                                        <td className="py-3 px-3 whitespace-nowrap text-neutral-600">{j.experienceMinYears}–{j.experienceMaxYears} yrs</td>
                                                        <td className="py-3 px-3 whitespace-nowrap text-neutral-600">₹{j.salaryMinLpa}–{j.salaryMaxLpa}</td>
                                                        <td className="py-3 px-3"><Badge value={j.priority} label={optLabel(PRIORITIES, j.priority)} /></td>
                                                        <td className="py-3 px-3 whitespace-nowrap text-neutral-700">{j.primaryRecruiterName ?? <span className="text-neutral-400">Unassigned</span>}</td>
                                                        <td className={`py-3 px-3 whitespace-nowrap ${late ? "text-red-600 font-semibold" : "text-neutral-600"}`}>{fmtDate(j.targetCloseDate)}</td>
                                                        <td className="py-3 px-3"><StatusPill status={j.status} /></td>
                                                        <td className="py-3 px-3 whitespace-nowrap text-neutral-500">{fmtDate(postedOf(j))}</td>
                                                        <td className="py-3 px-3 text-right">
                                                            <RowMenu job={j} open={menuFor === j.id} onToggle={() => setMenuFor(menuFor === j.id ? null : j.id)} onClose={() => setMenuFor(null)} isManager={isManager}
                                                                onAction={(kind) => { setMenuFor(null); setAction({ kind, job: j }); }}
                                                                onNavigate={(href) => { setMenuFor(null); router.push(href); }} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                )}
                                <div className={`flex items-center justify-between px-4 py-3 text-xs text-neutral-500 ${view === "cards" ? "mt-4 bg-white rounded-2xl border border-neutral-200/80" : "border-t border-neutral-100"}`}>
                                    <span>{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                                    <div className="flex items-center gap-1">
                                        <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)} className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button>
                                        <span className="px-2 font-semibold text-neutral-700">Page {current} of {pages}</span>
                                        <button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)} className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button>
                                    </div>
                                </div>
                            </>
                        )}
            </div>

            {action && <ActionDialog kind={action.kind} job={action.job} onClose={() => setAction(null)} onDone={() => { setAction(null); qc.invalidateQueries({ queryKey: ["ta-jobs"] }); qc.invalidateQueries({ queryKey: ["job-360", action.job.id] }); }} />}
        </div>
    );
}

// ─── Card view ────────────────────────────────────────────────
function JobCard({ job: j, menu }: { job: Row; menu: React.ReactNode }) {
    const pct = Math.min(100, Math.round(((j.filled || 0) / Math.max(1, j.openings || 1)) * 100));
    const today = new Date().toISOString().slice(0, 10);
    const late = isOpen(j.status) && !!j.targetCloseDate && j.targetCloseDate < today;
    const accent = j.priority === "URGENT" ? "border-t-red-500" : j.priority === "HIGH" ? "border-t-amber-500" : j.priority === "MEDIUM" ? "border-t-blue-500" : "border-t-neutral-300";
    return (
        <div className={`bg-white rounded-2xl border border-neutral-200/80 border-t-4 ${accent} p-4 flex flex-col gap-3 hover:shadow-md hover:border-neutral-300 transition-all`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-neutral-500">{requisitionLabel(j)}</span>
                    <Badge value={j.priority} label={optLabel(PRIORITIES, j.priority)} />
                </div>
                <div className="flex items-center gap-1 shrink-0"><StatusPill status={j.status} />{menu}</div>
            </div>

            <div className="min-w-0">
                <Link href={`/ta/requisitions/${j.id}`} className="block font-bold text-[15px] text-neutral-900 hover:text-primary leading-snug line-clamp-2">{j.title}</Link>
                <p className="text-xs text-neutral-500 mt-0.5 truncate"><span className="font-semibold text-neutral-700">{j.clientName}</span> · {industryOf(j)} · {j.department || "—"} · {optLabel(EMPLOYMENT_TYPES, j.employmentType)}</p>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-neutral-600">
                <span className="flex items-center gap-1.5 min-w-0" title={[j.location, j.locationState].filter(Boolean).join(", ")}><MapPin size={12} className="text-neutral-400 shrink-0" /><span className="truncate">{j.location || "—"}</span></span>
                <span className="flex items-center gap-1.5"><Briefcase size={12} className="text-neutral-400 shrink-0" />{j.experienceMinYears}–{j.experienceMaxYears} yrs</span>
                <span className="flex items-center gap-1.5"><IndianRupee size={12} className="text-neutral-400 shrink-0" />{j.salaryMinLpa}–{j.salaryMaxLpa} LPA</span>
                <span className="flex items-center gap-1.5"><GitBranch size={12} className="text-neutral-400 shrink-0" />{j.inPipeline} in pipeline</span>
            </div>

            <div>
                <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-800">{j.filled}/{j.openings} <span className="font-medium text-neutral-400">filled</span></span>
                    <span className="text-neutral-400">{j.totalCandidates} candidate{j.totalCandidates === 1 ? "" : "s"}</span>
                </div>
                <div className="h-1.5 bg-neutral-100 rounded-full mt-1.5 overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
            </div>

            <div className="mt-auto pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{(j.primaryRecruiterName ?? "?").charAt(0)}</span>
                    <span className={`truncate ${j.primaryRecruiterName ? "text-neutral-700 font-semibold" : "text-amber-700 font-bold"}`}>{j.primaryRecruiterName ?? "Unassigned"}</span>
                </span>
                <span className={`flex items-center gap-1 whitespace-nowrap ${late ? "text-red-600 font-semibold" : "text-neutral-500"}`} title="Target closure">
                    <CalendarClock size={12} />{fmtDate(j.targetCloseDate)}{late ? " · overdue" : ""}
                </span>
            </div>
        </div>
    );
}

// ─── Row actions ──────────────────────────────────────────────
function RowMenu({ job, open, onToggle, onClose, onAction, onNavigate, isManager }: {
    job: Row; open: boolean; onToggle: () => void; onClose: () => void; onAction: (k: ActionKind) => void; onNavigate: (href: string) => void; isManager: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open, onClose]);
    const closed = isClosed(job.status);
    const items: { label: string; icon: typeof Eye; run: () => void; show: boolean; danger?: boolean }[] = [
        { label: "View details", icon: Eye, run: () => onNavigate(`/ta/requisitions/${job.id}`), show: true },
        { label: "Edit", icon: Pencil, run: () => onNavigate(`/ta/requisitions/${job.id}/edit`), show: job.canEdit },
        { label: "Duplicate requisition", icon: Copy, run: () => onNavigate(`/ta/requisitions/new?from=${job.id}`), show: isManager },
        { label: "Assign recruiter", icon: UserCog, run: () => onAction("assign"), show: isManager && !closed && job.status !== "DRAFT" },
        { label: "Change status", icon: SlidersHorizontal, run: () => onAction("status"), show: isManager && !closed && job.status !== "DRAFT" && job.status !== "PENDING_APPROVAL" },
        { label: "Review approval", icon: ShieldCheck, run: () => onNavigate("/ta/approvals"), show: isManager && job.status === "PENDING_APPROVAL" },
        { label: "Put on hold", icon: Pause, run: () => onAction("hold"), show: isManager && isOpen(job.status) },
        { label: "Resume sourcing", icon: Play, run: () => onAction("resume"), show: isManager && job.status === "ON_HOLD" },
        { label: "Close requisition", icon: Archive, run: () => onAction("close"), show: isManager && !closed && job.status !== "DRAFT" },
        { label: "Cancel requisition", icon: XCircle, run: () => onAction("cancel"), show: isManager && !closed, danger: true },
    ];
    return (
        <div ref={ref} className="relative inline-block text-left">
            <button type="button" onClick={onToggle} aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${job.title}`} className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"><MoreHorizontal size={16} /></button>
            {open && (
                <div role="menu" className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-neutral-200 bg-white shadow-lg py-1">
                    {items.filter((i) => i.show).map((i) => (
                        <button key={i.label} type="button" role="menuitem" onClick={i.run} className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 hover:bg-neutral-50 ${i.danger ? "text-red-600" : "text-neutral-700"}`}>
                            <i.icon size={14} /> {i.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function Th({ k, children, className = "", sort, onSort }: { k?: keyof Row; children: React.ReactNode; className?: string; sort: { key: keyof Row; dir: 1 | -1 }; onSort: (k: keyof Row) => void }) {
    return (
        <th className={`py-2.5 px-3 font-bold whitespace-nowrap ${className}`}>
            {k ? <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-neutral-700">{children}{sort.key === k && <span>{sort.dir === 1 ? "↑" : "↓"}</span>}</button> : children}
        </th>
    );
}
