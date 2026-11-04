"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, AlarmClock, Clock, Database, ExternalLink, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Search, ThumbsUp, UserPlus } from "lucide-react";
import { Badge, EmptyState, ModalShell, SectionCard, StatCard } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { inputCls } from "@/components/finance/kit";
import {
    CallForm, CallDetails, CallHistory, callLabel, CALL_INTEREST, CALL_NEXT_ACTION, CALL_RATING, CALL_ROLE_FIT, CALL_STATUS, type Call,
} from "@/components/ta/CallLog";
import { api } from "@/lib/api";

export const LEAD_SOURCES = [
    ["NAUKRI", "Naukri"], ["LINKEDIN", "LinkedIn"], ["INDEED", "Indeed"], ["MONSTER", "Monster / Foundit"], ["SHINE", "Shine"], ["APNA", "Apna"],
    ["EXCEL_SHEET", "Excel / data sheet"], ["REFERENCE", "Reference"], ["WALK_IN", "Walk-in"], ["SOCIAL_MEDIA", "Social media"],
    ["OTHER_PORTAL", "Other job portal"], ["OTHER", "Other"],
] as const;

export interface OutsideCall extends Omit<Call, "candidateId" | "candidateName" | "candidatePhone"> {
    personName: string; phone: string; email: string | null; source: string; sourceDetail: string | null;
    currentCompany: string | null; currentDesignation: string | null; totalExperienceYears: number | null; skills: string[];
    jobId: string | null; convertedCandidateId: string | null; convertedCandidateName: string | null;
}
interface OutsideLog {
    scope: "mine" | "team"; items: OutsideCall[]; truncated: boolean; recruiters: { id: string; name: string }[];
    stats: {
        total: number; people: number; connected: number; connectRatePct: number | null; avgTalkMins: number | null; interested: number;
        toAdd: number; addedToDatabase: number; followUpsOpen: number; followUpsOverdue: number;
    };
}
interface Lookup { inDatabase: { id: string; name: string; candidateCode: string; phone: string; email: string } | null; previous: OutsideCall[] }

const sel = "px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 outline-none focus:border-primary";
const lbl = "block text-[11px] font-bold text-neutral-600 space-y-1";
const head = "text-[10px] font-black uppercase tracking-wider text-neutral-400";
const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

/** Outside call → the shape the shared call history / detail components render. */
export const asCall = (c: OutsideCall): Call => ({ ...c, candidateId: c.convertedCandidateId ?? "", candidateName: c.personName, candidatePhone: c.phone, applicationId: null });

const EMPTY_PERSON = { personName: "", phone: "", email: "", source: "", sourceDetail: "", currentCompany: "", currentDesignation: "", totalExperienceYears: "", skills: "", jobId: "" };

/** Log a call to someone who is not in the candidate database (numbers from portals, sheets, references). */
export function OutsideCallDialog({ onClose, onUseDatabase, prefill }: { onClose: () => void; onUseDatabase: (candidateId: string) => void; prefill?: Partial<typeof EMPTY_PERSON> }) {
    const [p, setP] = useState({ ...EMPTY_PERSON, ...prefill });
    const set = (k: keyof typeof EMPTY_PERSON) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setP({ ...p, [k]: e.target.value });
    const phone10 = useDeferredValue(p.phone.replace(/\D/g, "").slice(-10));
    const email = useDeferredValue(p.email.trim());
    const lookupKey = phone10.length === 10 ? `phone=${phone10}` : /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email) ? `email=${encodeURIComponent(email)}` : null;
    const lookup = useQuery<Lookup>({ queryKey: ["xcall-lookup", lookupKey], queryFn: () => api(`/api/ta/external-calls?${lookupKey}`), enabled: !!lookupKey });
    const { data: jobsData } = useQuery<{ id: string; title: string; requisitionCode?: string; status: string; clientName?: string }[]>({ queryKey: ["ta-jobs-lite"], queryFn: () => api("/api/admin/jobs") });
    const openJobs = (Array.isArray(jobsData) ? jobsData : []).filter((j) => !["CLOSED", "CANCELLED", "FULFILLED"].includes(j.status));
    const last = lookup.data?.previous?.[0];
    const inDb = lookup.data?.inDatabase;

    const useLast = () => last && setP({
        ...p, personName: p.personName || last.personName, email: p.email || last.email || "", source: p.source || last.source, sourceDetail: p.sourceDetail || last.sourceDetail || "",
        currentCompany: p.currentCompany || last.currentCompany || "", currentDesignation: p.currentDesignation || last.currentDesignation || "",
        totalExperienceYears: p.totalExperienceYears || (last.totalExperienceYears != null ? String(last.totalExperienceYears) : ""),
        skills: p.skills || (last.skills ?? []).join(", "), jobId: p.jobId || last.jobId || "",
    });
    const extra = useMemo(() => ({
        ...p, skills: p.skills.split(",").map((x) => x.trim()).filter(Boolean), jobId: p.jobId || undefined,
    }), [p]);

    return (
        <ModalShell title="Log call · Outside data" onClose={onClose} wide>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3">
                    <CallForm endpoint="/api/ta/external-calls" extra={extra} hideJob onDone={onClose}>
                        <div className="space-y-2">
                            <p className={head}>Person called (not in the candidate database)</p>
                            <div className="grid grid-cols-2 gap-2">
                                <label className={lbl}>Name *<input required maxLength={120} value={p.personName} onChange={set("personName")} className={inputCls} placeholder="Full name" /></label>
                                <label className={lbl}>Phone *<input required type="tel" maxLength={20} value={p.phone} onChange={set("phone")} className={inputCls} placeholder="+91 98765 43210" /></label>
                                <label className={lbl}>Email<input type="email" maxLength={160} value={p.email} onChange={set("email")} className={inputCls} placeholder="optional" /></label>
                                <label className={lbl}>Source *
                                    <select required value={p.source} onChange={set("source")} className={inputCls}>
                                        <option value="">Where is this contact from?</option>
                                        {LEAD_SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                    </select>
                                </label>
                                <label className={`${lbl} col-span-2`}>Source detail<input maxLength={200} value={p.sourceDetail} onChange={set("sourceDetail")} className={inputCls} placeholder="Sheet name, portal profile link, or who referred" /></label>
                                <label className={lbl}>Current company<input maxLength={160} value={p.currentCompany} onChange={set("currentCompany")} className={inputCls} /></label>
                                <label className={lbl}>Designation<input maxLength={120} value={p.currentDesignation} onChange={set("currentDesignation")} className={inputCls} /></label>
                                <label className={lbl}>Total experience (yrs)<input type="number" min="0" max="60" step="0.1" value={p.totalExperienceYears} onChange={set("totalExperienceYears")} className={inputCls} /></label>
                                <label className={lbl}>Skills (comma separated)<input value={p.skills} onChange={set("skills")} className={inputCls} placeholder="Java, SQL" /></label>
                                <label className={`${lbl} col-span-2`}>Regarding job
                                    <select value={p.jobId} onChange={set("jobId")} className={inputCls}>
                                        <option value="">General (no specific job)</option>
                                        {openJobs.map((j) => <option key={j.id} value={j.id}>{j.requisitionCode ? `${j.requisitionCode} · ` : ""}{j.title}{j.clientName ? ` · ${j.clientName}` : ""}</option>)}
                                    </select>
                                </label>
                            </div>
                            {inDb && (
                                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> <b>{inDb.name}</b> ({inDb.candidateCode}) is already in your database. Log it there so the history stays together.</span>
                                    <button type="button" onClick={() => onUseDatabase(inDb.id)} className="px-2.5 py-1.5 bg-amber-600 text-white rounded-lg font-bold shrink-0">Log as database call</button>
                                </div>
                            )}
                            {!inDb && last && (
                                <div className="p-3 rounded-xl border border-sky-200 bg-sky-50 text-xs text-sky-800 flex items-center justify-between gap-3">
                                    <span>Called {lookup.data!.previous.length} time(s) before — last on {new Date(last.calledAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} by {last.recruiterName}.</span>
                                    <button type="button" onClick={useLast} className="px-2.5 py-1.5 bg-sky-600 text-white rounded-lg font-bold shrink-0">Use saved details</button>
                                </div>
                            )}
                        </div>
                    </CallForm>
                </div>
                <div className="lg:col-span-2">
                    <p className="text-xs font-bold text-neutral-500 mb-2">Earlier calls to this number ({lookup.data?.previous.length ?? 0})</p>
                    {!lookupKey ? <p className="text-xs text-neutral-400">Enter the phone number to see earlier calls.</p>
                        : <CallHistory key={last?.id ?? "none"} calls={(lookup.data?.previous ?? []).slice(0, 8).map(asCall)} />}
                </div>
            </div>
        </ModalShell>
    );
}

const toCandidateSource = (s: string) => (["NAUKRI", "INDEED", "MONSTER", "SHINE", "APNA", "OTHER_PORTAL"].includes(s) ? "JOB_PORTAL" : s === "LINKEDIN" ? "LINKEDIN" : s === "WALK_IN" ? "WALK_IN" : "OTHER");
const NOTICE = [["0", "Immediate"], ["15", "15 days"], ["30", "30 days"], ["60", "60 days"], ["90", "90 days"]];

/** Turn an outside-data contact into a database candidate (and optionally add them to the job the call was about). */
export function AddToDatabaseDialog({ call, onClose }: { call: OutsideCall; onClose: () => void }) {
    const qc = useQueryClient();
    const [f, setF] = useState({
        name: call.personName, phone: call.phone, email: call.email ?? "", currentCompany: call.currentCompany ?? "", currentDesignation: call.currentDesignation ?? "",
        totalExperienceYears: call.totalExperienceYears != null ? String(call.totalExperienceYears) : "", location: call.currentLocation ?? "",
        skills: [...new Set([...(call.skills ?? []), ...(call.skillsAssessed ?? [])])].join(", "),
        currentCtcLpa: call.currentCtcLpa != null ? String(call.currentCtcLpa) : "", expectedCtcLpa: call.expectedCtcLpa != null ? String(call.expectedCtcLpa) : "",
        noticePeriodDays: call.noticePeriodDays != null ? String(call.noticePeriodDays) : "",
    });
    const [addToJob, setAddToJob] = useState(!!call.jobId);
    const [existing, setExisting] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

    async function finish(candidateId: string) {
        await api(`/api/ta/external-calls/${call.id}/link`, "POST", { candidateId });
        if (addToJob && call.jobId) {
            try { await api("/api/ta/applications", "POST", { candidateId, jobId: call.jobId, screeningNotes: call.screeningFeedback ?? call.callOutcome ?? null }); }
            catch (e) { toast.warning(`Added to database, but not to the job: ${(e as Error).message}`); }
        }
        toast.success("Added to the candidate database — call history moved with them");
        ["ta-external-calls", "ta-follow-ups", "ta-calls-log", "pipeline"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        onClose();
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await fetch("/api/admin/candidates", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...f, source: toCandidateSource(call.source), preferredLocation: "",
                    skills: f.skills.split(",").map((x) => x.trim()).filter(Boolean),
                    bio: [call.screeningFeedback, call.strengths && `Strengths: ${call.strengths}`, call.concerns && `Concerns: ${call.concerns}`].filter(Boolean).join("\n") || null,
                }),
            });
            const d = await res.json().catch(() => ({}));
            if (res.status === 409 && d.candidateId) { setExisting(d.candidateId); toast.error(d.error); return; }
            if (!res.ok) throw new Error(d.error ?? "Could not create the candidate");
            await finish(d.id);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalShell title={`Add to database · ${call.personName}`} onClose={onClose} wide>
            <form onSubmit={submit} className="space-y-3 text-sm">
                <p className="text-xs text-neutral-500">Details are filled from the call. Check them — every outside call to this number will move to the new candidate profile.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className={lbl}>Name *<input required value={f.name} onChange={set("name")} className={inputCls} /></label>
                    <label className={lbl}>Phone *<input required type="tel" value={f.phone} onChange={set("phone")} className={inputCls} /></label>
                    <label className={lbl}>Email *<input required type="email" value={f.email} onChange={set("email")} className={inputCls} placeholder="needed for a candidate profile" /></label>
                    <label className={lbl}>Current company<input value={f.currentCompany} onChange={set("currentCompany")} className={inputCls} /></label>
                    <label className={lbl}>Designation<input value={f.currentDesignation} onChange={set("currentDesignation")} className={inputCls} /></label>
                    <label className={lbl}>Total exp (yrs)<input type="number" min="0" max="60" step="0.1" value={f.totalExperienceYears} onChange={set("totalExperienceYears")} className={inputCls} /></label>
                    <label className={lbl}>Current CTC (LPA)<input type="number" min="0" max="500" step="0.1" value={f.currentCtcLpa} onChange={set("currentCtcLpa")} className={inputCls} /></label>
                    <label className={lbl}>Expected CTC (LPA)<input type="number" min="0" max="500" step="0.1" value={f.expectedCtcLpa} onChange={set("expectedCtcLpa")} className={inputCls} /></label>
                    <label className={lbl}>Notice period *
                        <select required value={f.noticePeriodDays} onChange={set("noticePeriodDays")} className={inputCls}>
                            {!f.noticePeriodDays && <option value="">Confirm with candidate</option>}
                            {NOTICE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            {f.noticePeriodDays && !NOTICE.some(([v]) => v === f.noticePeriodDays) && <option value={f.noticePeriodDays}>{f.noticePeriodDays} days</option>}
                        </select>
                    </label>
                    <label className={lbl}>Location<input value={f.location} onChange={set("location")} className={inputCls} /></label>
                    <label className={`${lbl} sm:col-span-2`}>Skills<input value={f.skills} onChange={set("skills")} className={inputCls} /></label>
                </div>
                {call.jobId && (
                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-700">
                        <input type="checkbox" checked={addToJob} onChange={(e) => setAddToJob(e.target.checked)} />
                        Also add to the pipeline for {call.jobTitle}
                    </label>
                )}
                {existing && (
                    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-center justify-between gap-3">
                        <span>This person is already a candidate. Link these calls to the existing profile instead.</span>
                        <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await finish(existing); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); } }} className="px-2.5 py-1.5 bg-amber-600 text-white rounded-lg font-bold shrink-0 disabled:opacity-50">Link to existing profile</button>
                    </div>
                )}
                <button disabled={busy} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"><UserPlus size={14} /> {busy ? "Saving…" : "Create candidate"}</button>
            </form>
        </ModalShell>
    );
}

/** The outside-data call log: its own filters, numbers and list, separate from database calls. */
export function OutsideCallsLog({ manager, range, onLog, onUseDatabase }: {
    manager: boolean; range: { from: string; to: string }; onLog: (prefill?: Partial<typeof EMPTY_PERSON>) => void; onUseDatabase: (candidateId: string) => void;
}) {
    const [scope, setScope] = useState<"mine" | "team">("mine");
    const [status, setStatus] = useState("");
    const [interest, setInterest] = useState("");
    const [source, setSource] = useState("");
    const [converted, setConverted] = useState("");
    const [recruiterId, setRecruiterId] = useState("");
    const [search, setSearch] = useState("");
    const q = useDeferredValue(search.trim());
    const [detail, setDetail] = useState<OutsideCall | null>(null);
    const [adding, setAdding] = useState<OutsideCall | null>(null);

    const params = useMemo(() => {
        const p = new URLSearchParams({ scope });
        if (range.from) p.set("from", range.from);
        if (range.to) p.set("to", range.to);
        for (const [k, v] of [["status", status], ["interest", interest], ["source", source], ["converted", converted]] as const) if (v) p.set(k, v);
        if (scope === "team" && recruiterId) p.set("recruiterId", recruiterId);
        if (q.length >= 2) p.set("q", q);
        return p.toString();
    }, [scope, range.from, range.to, status, interest, source, converted, recruiterId, q]);
    const { data, isLoading, isError, error } = useQuery<OutsideLog>({ queryKey: ["ta-external-calls", params], queryFn: () => api(`/api/ta/external-calls?${params}`) });
    const s = data?.stats;
    const team = data?.scope === "team";
    const filtersOn = !!(status || interest || source || converted || recruiterId || q.length >= 2);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-2xl border border-neutral-200/70">
                {manager && (
                    <div className="flex bg-neutral-100 p-0.5 rounded-lg">
                        {(["mine", "team"] as const).map((v) => (
                            <button key={v} type="button" onClick={() => { setScope(v); setRecruiterId(""); }} className={`px-3 py-1 rounded-md text-xs font-bold ${scope === v ? "bg-white shadow-2xs text-neutral-900" : "text-neutral-500"}`}>{v === "mine" ? "My calls" : "Team calls"}</button>
                        ))}
                    </div>
                )}
                <select value={source} onChange={(e) => setSource(e.target.value)} className={sel} aria-label="Source"><option value="">All sources</option>{LEAD_SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel} aria-label="Call status"><option value="">All statuses</option>{CALL_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <select value={interest} onChange={(e) => setInterest(e.target.value)} className={sel} aria-label="Interest"><option value="">Any interest</option>{CALL_INTEREST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <select value={converted} onChange={(e) => setConverted(e.target.value)} className={sel} aria-label="In database"><option value="">In database: any</option><option value="no">Not added yet</option><option value="yes">Added to database</option></select>
                {team && <select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)} className={sel} aria-label="Recruiter"><option value="">All recruiters</option>{data?.recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email, company or outcome" className={`${sel} w-full pl-8`} />
                </div>
                {filtersOn && <button type="button" onClick={() => { setStatus(""); setInterest(""); setSource(""); setConverted(""); setRecruiterId(""); setSearch(""); }} className="text-xs font-bold text-primary px-2">Clear</button>}
                <a href={`/api/ta/external-calls?${params}&format=csv`} className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-bold text-neutral-700 hover:bg-neutral-50">Export CSV</a>
            </div>

            {isLoading || !s ? (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <SkeletonPulse key={i} className="h-24 rounded-2xl" />)}</div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard label="Outside calls" value={s.total} icon={PhoneCall} hint={`${s.people} people`} />
                    <StatCard label="Connected" value={s.connectRatePct == null ? "—" : `${s.connectRatePct}%`} icon={Phone} tone="emerald" hint={`${s.connected} of ${s.total} · avg ${s.avgTalkMins ?? "—"} min`} />
                    <StatCard label="Interested" value={s.interested} icon={ThumbsUp} tone="purple" hint={`${s.toAdd} still to add to database`} />
                    <StatCard label="Added to database" value={s.addedToDatabase} icon={Database} tone="blue" hint="now candidates" />
                    <StatCard label="Open call-backs" value={s.followUpsOpen} icon={AlarmClock} tone={s.followUpsOverdue ? "red" : "amber"} hint={s.followUpsOverdue ? `${s.followUpsOverdue} overdue` : "none overdue"} />
                </div>
            )}

            <SectionCard title={team ? "Team outside-data calls" : "My outside-data calls"} subtitle={data ? `${data.items.length}${data.truncated ? "+" : ""} call(s) to people not in the candidate database` : undefined}>
                {isError ? <p className="text-xs text-red-600 py-6 text-center">{(error as Error).message}</p>
                    : isLoading ? <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonPulse key={i} className="h-12 rounded-xl" />)}</div>
                        : !data?.items.length ? (
                            <EmptyState icon={PhoneCall} message={filtersOn ? "No outside calls match these filters." : "No outside-data calls yet. Log calls to numbers from Naukri, LinkedIn, sheets or references here."}
                                action={<button type="button" onClick={() => onLog()} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">Log an outside call</button>} />
                        ) : (
                            <div className="overflow-x-auto -mx-2">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                                            <th className="px-2 py-2">When</th><th className="px-2 py-2">Person</th><th className="px-2 py-2">Source</th><th className="px-2 py-2">Job</th>
                                            <th className="px-2 py-2">Status</th><th className="px-2 py-2">Feedback</th><th className="px-2 py-2">Outcome</th><th className="px-2 py-2">Next step</th>
                                            {team && <th className="px-2 py-2">Recruiter</th>}<th className="px-2 py-2">Database</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {data.items.map((c) => {
                                            const Icon = c.callType === "INCOMING" ? PhoneIncoming : PhoneOutgoing;
                                            return (
                                                <tr key={c.id} onClick={() => setDetail(c)} className="hover:bg-neutral-50 cursor-pointer align-top">
                                                    <td className="px-2 py-2.5 whitespace-nowrap">
                                                        <p className="font-bold text-neutral-800 flex items-center gap-1"><Icon size={12} className="text-neutral-400" />{new Date(c.calledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                                                        <p className="text-neutral-400">{new Date(c.calledAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}{c.durationMins ? ` · ${c.durationMins} min` : ""}</p>
                                                    </td>
                                                    <td className="px-2 py-2.5"><p className="font-bold text-neutral-900">{c.personName}</p><p className="text-neutral-400">{c.phone}</p>{(c.currentDesignation || c.currentCompany) && <p className="text-neutral-500 truncate max-w-[180px]">{[c.currentDesignation, c.currentCompany].filter(Boolean).join(" at ")}</p>}</td>
                                                    <td className="px-2 py-2.5 whitespace-nowrap"><p className="text-neutral-700">{callLabel(LEAD_SOURCES, c.source)}</p>{c.sourceDetail && <p className="text-neutral-400 truncate max-w-[140px]">{c.sourceDetail}</p>}</td>
                                                    <td className="px-2 py-2.5 max-w-[160px]"><p className="text-neutral-700 truncate">{c.jobTitle ?? <span className="text-neutral-400">General</span>}</p></td>
                                                    <td className="px-2 py-2.5 space-y-1"><Badge value={c.callStatus} label={callLabel(CALL_STATUS, c.callStatus)} />{c.candidateInterest && <div><Badge value={c.candidateInterest} label={callLabel(CALL_INTEREST, c.candidateInterest)} /></div>}</td>
                                                    <td className="px-2 py-2.5 text-neutral-600 whitespace-nowrap">
                                                        {c.overallRating && <p>Overall <b>{callLabel(CALL_RATING, c.overallRating)}</b></p>}
                                                        {c.roleFit && <p className={c.roleFit === "NOT_FIT" ? "text-red-600" : ""}>{callLabel(CALL_ROLE_FIT, c.roleFit)}</p>}
                                                        {!c.overallRating && !c.roleFit && <span className="text-neutral-300">—</span>}
                                                    </td>
                                                    <td className="px-2 py-2.5 max-w-[220px]"><p className="text-neutral-700 line-clamp-2">{c.callOutcome || c.remarks}</p></td>
                                                    <td className="px-2 py-2.5 whitespace-nowrap">
                                                        {c.nextAction ? <p className="font-semibold text-primary">{callLabel(CALL_NEXT_ACTION, c.nextAction)}</p> : <span className="text-neutral-300">—</span>}
                                                        {c.followUpDate && <p className={c.followUpDate < istToday() ? "text-red-600 font-semibold" : "text-neutral-400"}>by {new Date(c.followUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>}
                                                    </td>
                                                    {team && <td className="px-2 py-2.5 whitespace-nowrap text-neutral-600">{c.recruiterName}</td>}
                                                    <td className="px-2 py-2.5 whitespace-nowrap">
                                                        {c.convertedCandidateId
                                                            ? <Link href={`/ta/candidates/${c.convertedCandidateId}`} onClick={(e) => e.stopPropagation()} className="font-bold text-emerald-700 hover:underline">✓ Added</Link>
                                                            : <button type="button" onClick={(e) => { e.stopPropagation(); setAdding(c); }} className="px-2 py-1 rounded-lg border border-primary/30 text-primary font-bold hover:bg-primary/5">Add</button>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
            </SectionCard>

            {detail && (
                <ModalShell title={`Outside call · ${detail.personName}`} onClose={() => setDetail(null)} wide>
                    <div className="space-y-4">
                        <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 text-xs space-y-0.5">
                            <p className="font-bold text-neutral-900">{detail.personName} · {detail.phone}{detail.email ? ` · ${detail.email}` : ""}</p>
                            <p className="text-neutral-500">{callLabel(LEAD_SOURCES, detail.source)}{detail.sourceDetail ? ` — ${detail.sourceDetail}` : ""}</p>
                            {(detail.currentDesignation || detail.currentCompany || detail.totalExperienceYears != null) && (
                                <p className="text-neutral-500">{[[detail.currentDesignation, detail.currentCompany].filter(Boolean).join(" at "), detail.totalExperienceYears != null && `${detail.totalExperienceYears} yrs`].filter(Boolean).join(" · ")}</p>
                            )}
                            {!!detail.skills?.length && <p className="text-neutral-500">Skills: {detail.skills.join(", ")}</p>}
                        </div>
                        <p className="text-xs text-neutral-500">
                            {new Date(detail.calledAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}{detail.durationMins ? ` · ${detail.durationMins} min` : ""} · by {detail.recruiterName}
                            {detail.jobTitle ? ` · re ${detail.jobTitle}${detail.clientName ? ` (${detail.clientName})` : ""}` : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge value={detail.callStatus} label={callLabel(CALL_STATUS, detail.callStatus)} />
                            {detail.candidateInterest && <Badge value={detail.candidateInterest} label={callLabel(CALL_INTEREST, detail.candidateInterest)} />}
                        </div>
                        <CallDetails c={asCall(detail)} />
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-neutral-100">
                            {detail.convertedCandidateId ? (
                                <>
                                    <Link href={`/ta/candidates/${detail.convertedCandidateId}`} className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5"><ExternalLink size={13} /> {detail.convertedCandidateName ?? "Candidate"} profile</Link>
                                    <button type="button" onClick={() => { const id = detail.convertedCandidateId!; setDetail(null); onUseDatabase(id); }} className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5"><Phone size={13} /> Log next call (database)</button>
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={() => { setAdding(detail); setDetail(null); }} className="px-3 py-2 rounded-xl border border-primary/30 text-primary text-xs font-bold hover:bg-primary/5 flex items-center gap-1.5"><UserPlus size={13} /> Add to database</button>
                                    <button type="button" onClick={() => { const d = detail; setDetail(null); onLog({ phone: d.phone }); }} className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5"><Clock size={13} /> Log another call</button>
                                </>
                            )}
                        </div>
                    </div>
                </ModalShell>
            )}
            {adding && <AddToDatabaseDialog call={adding} onClose={() => setAdding(null)} />}
        </div>
    );
}
