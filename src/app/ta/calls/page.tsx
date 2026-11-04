"use client";

import { Suspense, useDeferredValue, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Clock, ThumbsUp, AlarmClock, Download, Plus, Search, Users, ExternalLink, Database, Globe,
} from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { inputCls } from "@/components/finance/kit";
import {
    CallForm, CallDetails, CallHistory, callLabel, CALL_INTEREST, CALL_NEXT_ACTION, CALL_PURPOSE, CALL_RATING, CALL_ROLE_FIT, CALL_STATUS,
    type Call, type CallAppOption,
} from "@/components/ta/CallLog";
import { OutsideCallDialog, OutsideCallsLog } from "@/components/ta/OutsideCalls";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

interface LogData {
    scope: "mine" | "team";
    items: Call[];
    truncated: boolean;
    recruiters: { id: string; name: string }[];
    stats: {
        total: number; connected: number; connectRatePct: number | null; avgTalkMins: number | null; totalTalkMins: number;
        interested: number; notInterested: number; uniqueCandidates: number; followUpsOpen: number; followUpsOverdue: number;
        byStatus: { status: string; count: number }[];
    };
}
interface CandidateHit { id: string; name: string; candidateCode?: string; phone?: string; email?: string; currentDesignation?: string | null; currentCompany?: string | null; doNotContact?: boolean }
interface CandidateDetail {
    candidate: { id: string; name: string; phone: string; email: string; currentCtcLpa: number; expectedCtcLpa: number; noticePeriodDays: number; location: string; doNotContact?: boolean; doNotContactReason?: string | null };
    applications: { id: string; jobTitle: string; clientName: string; stage: string }[];
}

const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 330 * 60000 - n * 86400000).toISOString().slice(0, 10);
const PERIODS = [["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["all", "All time"], ["custom", "Custom"]] as const;
type Period = (typeof PERIODS)[number][0];
const sel = "px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 outline-none focus:border-primary";

export default function TaCallsPageRoute() {
    return <Suspense fallback={null}><TaCallsPage /></Suspense>;
}

function TaCallsPage() {
    const { user } = useAuth();
    const manager = user?.role === "SUPER_ADMIN" || user?.role === "TA_MANAGER";
    const [scope, setScope] = useState<"mine" | "team">("mine");
    const [period, setPeriod] = useState<Period>("7d");
    const [custom, setCustom] = useState({ from: daysAgo(30), to: istToday() });
    const [status, setStatus] = useState("");
    const [interest, setInterest] = useState("");
    const [purpose, setPurpose] = useState("");
    const [recruiterId, setRecruiterId] = useState("");
    const [search, setSearch] = useState("");
    const q = useDeferredValue(search.trim());
    const [detail, setDetail] = useState<Call | null>(null);
    const [logOpen, setLogOpen] = useState(false);
    const [logFor, setLogFor] = useState<string | null>(null); // candidate id preselected in the log modal
    // Two separate logs: candidates in the database, and people called from outside data (portals, sheets, references)
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<"database" | "outside">(searchParams.get("tab") === "outside" ? "outside" : "database");
    const [outsideOpen, setOutsideOpen] = useState<null | { phone?: string }>(null);
    const useDatabase = (candidateId: string) => { setOutsideOpen(null); setTab("database"); setLogFor(candidateId); setLogOpen(true); };

    const range = period === "today" ? { from: istToday(), to: istToday() }
        : period === "7d" ? { from: daysAgo(6), to: istToday() }
            : period === "30d" ? { from: daysAgo(29), to: istToday() }
                : period === "custom" ? custom : { from: "", to: "" };
    const params = useMemo(() => {
        const p = new URLSearchParams({ view: "log", scope });
        if (range.from) p.set("from", range.from);
        if (range.to) p.set("to", range.to);
        if (status) p.set("status", status);
        if (interest) p.set("interest", interest);
        if (purpose) p.set("purpose", purpose);
        if (scope === "team" && recruiterId) p.set("recruiterId", recruiterId);
        if (q.length >= 2) p.set("q", q);
        return p.toString();
    }, [scope, range.from, range.to, status, interest, purpose, recruiterId, q]);

    const { data, isLoading, isError, error } = useQuery<LogData>({ queryKey: ["ta-calls-log", params], queryFn: () => api(`/api/ta/calls?${params}`) });
    const s = data?.stats;
    const team = data?.scope === "team";
    const filtersOn = !!(status || interest || purpose || recruiterId || q.length >= 2);

    return (
        <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
            <PageHeader
                title="Calls"
                subtitle="Log every call with structured feedback — database candidates and outside data (portals, sheets, references) are kept in separate logs."
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setOutsideOpen({})} className="px-4 py-2 rounded-xl border border-primary/30 bg-white text-primary text-xs font-bold hover:bg-primary/5 flex items-center gap-1.5">
                            <Globe size={14} /> Log call · Outside data
                        </button>
                        <button type="button" onClick={() => { setLogFor(null); setLogOpen(true); }} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 flex items-center gap-1.5">
                            <Plus size={14} /> Log call · Database candidate
                        </button>
                    </div>
                }
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200/60">
                    {([["database", "Database candidates", Database], ["outside", "Outside data", Globe]] as const).map(([k, l, I]) => (
                        <button key={k} type="button" onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${tab === k ? "bg-white shadow-2xs text-neutral-900" : "text-neutral-500 hover:text-neutral-800"}`}>
                            <I size={13} /> {l}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={sel} aria-label="Period">
                        {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    {period === "custom" && (
                        <>
                            <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={sel} aria-label="From" />
                            <span className="text-xs text-neutral-400">to</span>
                            <input type="date" value={custom.to} min={custom.from} max={istToday()} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={sel} aria-label="To" />
                        </>
                    )}
                </div>
            </div>

            {tab === "outside" ? (
                <OutsideCallsLog manager={manager} range={range} onLog={(prefill) => setOutsideOpen(prefill ?? {})} onUseDatabase={useDatabase} />
            ) : (<>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-2xl border border-neutral-200/70">
                {manager && (
                    <div className="flex bg-neutral-100 p-0.5 rounded-lg">
                        {(["mine", "team"] as const).map((v) => (
                            <button key={v} type="button" onClick={() => { setScope(v); setRecruiterId(""); }} className={`px-3 py-1 rounded-md text-xs font-bold ${scope === v ? "bg-white shadow-2xs text-neutral-900" : "text-neutral-500"}`}>
                                {v === "mine" ? "My calls" : "Team calls"}
                            </button>
                        ))}
                    </div>
                )}
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel} aria-label="Call status">
                    <option value="">All statuses</option>
                    {CALL_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <select value={interest} onChange={(e) => setInterest(e.target.value)} className={sel} aria-label="Interest">
                    <option value="">Any interest</option>
                    {CALL_INTEREST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={sel} aria-label="Purpose">
                    <option value="">All purposes</option>
                    {CALL_PURPOSE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {team && (
                    <select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)} className={sel} aria-label="Recruiter">
                        <option value="">All recruiters</option>
                        {data?.recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                )}
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidate, phone, job or outcome" className={`${sel} w-full pl-8`} />
                </div>
                {filtersOn && (
                    <button type="button" onClick={() => { setStatus(""); setInterest(""); setPurpose(""); setRecruiterId(""); setSearch(""); }} className="text-xs font-bold text-primary px-2">Clear</button>
                )}
                <a href={`/api/ta/calls?${params}&format=csv`} className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-bold text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5">
                    <Download size={13} /> Export CSV
                </a>
            </div>

            {/* KPIs */}
            {isLoading || !s ? (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <SkeletonPulse key={i} className="h-24 rounded-2xl" />)}</div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard label="Calls" value={s.total} icon={PhoneCall} hint={`${s.uniqueCandidates} candidate(s)`} />
                    <StatCard label="Connected" value={s.connectRatePct == null ? "—" : `${s.connectRatePct}%`} icon={Phone} tone="emerald" hint={`${s.connected} of ${s.total} calls`} />
                    <StatCard label="Avg talk time" value={s.avgTalkMins == null ? "—" : `${s.avgTalkMins} min`} icon={Clock} tone="blue" hint={`${s.totalTalkMins} min in total`} />
                    <StatCard label="Interested" value={s.interested} icon={ThumbsUp} tone="purple" hint={`${s.notInterested} not interested`} />
                    <StatCard label="Open follow-ups" value={s.followUpsOpen} icon={AlarmClock} tone={s.followUpsOverdue ? "red" : "amber"} hint={s.followUpsOverdue ? `${s.followUpsOverdue} overdue` : "none overdue"} />
                </div>
            )}

            {/* Call log */}
            <SectionCard title={team ? "Team call log" : "My call log"} subtitle={data ? `${data.items.length}${data.truncated ? "+" : ""} call(s)${data.truncated ? " — showing the latest 500; narrow the filters or export" : ""}` : undefined}>
                {isError ? (
                    <p className="text-xs text-red-600 py-6 text-center">{(error as Error).message}</p>
                ) : isLoading ? (
                    <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonPulse key={i} className="h-12 rounded-xl" />)}</div>
                ) : !data?.items.length ? (
                    <EmptyState icon={PhoneCall} message={filtersOn || period !== "all" ? "No calls match these filters." : "No calls logged yet."}
                        action={<button type="button" onClick={() => { setLogFor(null); setLogOpen(true); }} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">Log your first call</button>} />
                ) : (
                    <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                                    <th className="px-2 py-2">When</th>
                                    <th className="px-2 py-2">Candidate</th>
                                    <th className="px-2 py-2">Job</th>
                                    <th className="px-2 py-2">Status</th>
                                    <th className="px-2 py-2">Feedback</th>
                                    <th className="px-2 py-2">Outcome</th>
                                    <th className="px-2 py-2">Next step</th>
                                    {team && <th className="px-2 py-2">Recruiter</th>}
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
                                            <td className="px-2 py-2.5">
                                                <Link href={`/ta/candidates/${c.candidateId}`} onClick={(e) => e.stopPropagation()} className="font-bold text-neutral-900 hover:text-primary">{c.candidateName}</Link>
                                                <p className="text-neutral-400">{c.candidatePhone}</p>
                                            </td>
                                            <td className="px-2 py-2.5 max-w-[180px]">
                                                <p className="text-neutral-700 truncate">{c.jobTitle ?? <span className="text-neutral-400">General</span>}</p>
                                                {c.clientName && <p className="text-neutral-400 truncate">{c.clientName}</p>}
                                            </td>
                                            <td className="px-2 py-2.5 space-y-1">
                                                <Badge value={c.callStatus} label={callLabel(CALL_STATUS, c.callStatus)} />
                                                {c.candidateInterest && <div><Badge value={c.candidateInterest} label={callLabel(CALL_INTEREST, c.candidateInterest)} /></div>}
                                            </td>
                                            <td className="px-2 py-2.5 text-neutral-600 whitespace-nowrap">
                                                {c.overallRating ? <p>Overall <b>{callLabel(CALL_RATING, c.overallRating)}</b></p> : null}
                                                {c.roleFit ? <p className={c.roleFit === "NOT_FIT" ? "text-red-600" : ""}>{callLabel(CALL_ROLE_FIT, c.roleFit)}</p> : null}
                                                {!c.overallRating && !c.roleFit && <span className="text-neutral-300">—</span>}
                                            </td>
                                            <td className="px-2 py-2.5 max-w-[240px]">
                                                <p className="text-neutral-700 line-clamp-2">{c.callOutcome || c.remarks}</p>
                                            </td>
                                            <td className="px-2 py-2.5 whitespace-nowrap">
                                                {c.nextAction ? <p className="font-semibold text-primary">{callLabel(CALL_NEXT_ACTION, c.nextAction)}</p> : <span className="text-neutral-300">—</span>}
                                                {c.followUpDate && <p className={c.followUpDate < istToday() ? "text-red-600 font-semibold" : "text-neutral-400"}>by {new Date(c.followUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>}
                                            </td>
                                            {team && <td className="px-2 py-2.5 whitespace-nowrap text-neutral-600">{c.recruiterName}</td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            </>)}

            {detail && (
                <ModalShell title={`Call · ${detail.candidateName}`} onClose={() => setDetail(null)} wide>
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge value={detail.callStatus} label={callLabel(CALL_STATUS, detail.callStatus)} />
                            {detail.candidateInterest && <Badge value={detail.candidateInterest} label={callLabel(CALL_INTEREST, detail.candidateInterest)} />}
                            <span className="text-neutral-500">{callLabel(CALL_PURPOSE, detail.purpose)} · {detail.callType === "INCOMING" ? "Incoming" : "Outgoing"}</span>
                        </div>
                        <p className="text-xs text-neutral-500">
                            {new Date(detail.calledAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}{detail.durationMins ? ` · ${detail.durationMins} min` : ""} · by {detail.recruiterName}
                            {detail.jobTitle ? ` · re ${detail.jobTitle}${detail.clientName ? ` (${detail.clientName})` : ""}` : ""}
                        </p>
                        <CallDetails c={detail} />
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-neutral-100">
                            <Link href={`/ta/candidates/${detail.candidateId}`} className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5"><ExternalLink size={13} /> Candidate profile</Link>
                            <button type="button" onClick={() => { setLogFor(detail.candidateId); setDetail(null); setLogOpen(true); }} className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5"><Phone size={13} /> Log another call</button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {logOpen && <LogCallDialog initialCandidateId={logFor} onClose={() => setLogOpen(false)} />}
            {outsideOpen && <OutsideCallDialog prefill={outsideOpen} onClose={() => setOutsideOpen(null)} onUseDatabase={useDatabase} />}
        </div>
    );
}

/** Pick any candidate (search by name, phone, email or code), then log the call with full feedback. */
function LogCallDialog({ initialCandidateId, onClose }: { initialCandidateId: string | null; onClose: () => void }) {
    const [candidateId, setCandidateId] = useState<string | null>(initialCandidateId);
    const [term, setTerm] = useState("");
    const t = useDeferredValue(term.trim());
    const hits = useQuery<CandidateHit[]>({
        queryKey: ["call-cand-search", t],
        queryFn: () => api(`/api/admin/candidates?q=${encodeURIComponent(t)}`),
        enabled: !candidateId && t.length >= 2,
    });
    const detail = useQuery<CandidateDetail>({
        queryKey: ["ta-candidate-detail", candidateId],
        queryFn: () => api(`/api/admin/candidates/${candidateId}`),
        enabled: !!candidateId,
    });
    const history = useQuery<Call[]>({
        queryKey: ["cand-calls", candidateId],
        queryFn: () => api(`/api/ta/calls?candidateId=${candidateId}`),
        enabled: !!candidateId,
    });
    const cand = detail.data?.candidate;
    const apps: CallAppOption[] = (detail.data?.applications ?? []).map((a) => ({ id: a.id, jobTitle: a.jobTitle, clientName: a.clientName, stage: a.stage }));

    return (
        <ModalShell title={cand ? `Log call · ${cand.name}` : "Log a call"} onClose={onClose} wide>
            {!candidateId ? (
                <div className="space-y-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search candidate by name, phone, email or code" className={`${inputCls} pl-9`} />
                    </div>
                    {t.length < 2 ? (
                        <p className="text-xs text-neutral-400 text-center py-6">Type at least 2 characters to find the candidate you spoke to.</p>
                    ) : hits.isFetching && !hits.data ? (
                        <p className="text-xs text-neutral-400 text-center py-6">Searching…</p>
                    ) : !hits.data?.length ? (
                        <p className="text-xs text-neutral-400 text-center py-6">No candidate found. Add them from Candidates or a job&apos;s Add Candidate first.</p>
                    ) : (
                        <ul className="divide-y divide-neutral-100 max-h-80 overflow-y-auto">
                            {hits.data.slice(0, 25).map((c) => (
                                <li key={c.id}>
                                    <button type="button" disabled={c.doNotContact} onClick={() => setCandidateId(c.id)} className="w-full text-left py-2.5 px-1 flex items-center justify-between gap-3 text-xs hover:bg-neutral-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                        <span className="min-w-0">
                                            <span className="font-bold text-neutral-900">{c.name}</span>{c.candidateCode && <span className="text-neutral-400"> · {c.candidateCode}</span>}
                                            <span className="block text-neutral-500 truncate">{[c.phone, [c.currentDesignation, c.currentCompany].filter(Boolean).join(" at ")].filter(Boolean).join(" · ")}</span>
                                        </span>
                                        {c.doNotContact ? <span className="text-red-600 font-bold shrink-0">Do not contact</span> : <Phone size={14} className="text-primary shrink-0" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : detail.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonPulse key={i} className="h-10 rounded-xl" />)}</div>
            ) : detail.isError || !cand ? (
                <p className="text-xs text-red-600 py-6 text-center">{(detail.error as Error)?.message ?? "Could not load the candidate"}</p>
            ) : cand.doNotContact ? (
                <p className="text-xs text-red-600 py-6 text-center">{cand.name} is marked Do Not Contact{cand.doNotContactReason ? ` — ${cand.doNotContactReason}` : ""}.</p>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                    <div className="lg:col-span-3 space-y-3">
                        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100 text-xs">
                            <div className="min-w-0">
                                <p className="font-bold text-neutral-900">{cand.name}</p>
                                <p className="text-neutral-500 truncate">{cand.phone} · {cand.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {cand.phone && <a href={`tel:${cand.phone.replace(/\s/g, "")}`} className="px-2.5 py-1.5 rounded-lg bg-primary text-white font-bold flex items-center gap-1"><Phone size={12} /> Dial</a>}
                                {!initialCandidateId && <button type="button" onClick={() => setCandidateId(null)} className="px-2.5 py-1.5 rounded-lg border border-neutral-200 font-bold text-neutral-600">Change</button>}
                            </div>
                        </div>
                        <CallForm
                            key={cand.id}
                            candidateId={cand.id}
                            applications={apps}
                            defaults={{ currentCtcLpa: cand.currentCtcLpa || undefined, expectedCtcLpa: cand.expectedCtcLpa || undefined, noticePeriodDays: cand.noticePeriodDays, location: cand.location || undefined }}
                            onDone={onClose}
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <p className="text-xs font-bold text-neutral-500 mb-2 flex items-center gap-1.5"><Users size={13} /> Earlier calls ({history.data?.length ?? 0})</p>
                        <CallHistory key={history.data?.[0]?.id ?? "none"} calls={(history.data ?? []).slice(0, 8)} />
                    </div>
                </div>
            )}
        </ModalShell>
    );
}
