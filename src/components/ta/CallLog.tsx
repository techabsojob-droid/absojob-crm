"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneIncoming, PhoneOutgoing, CalendarClock, ChevronDown, ExternalLink, Star } from "lucide-react";
import { SectionCard, Badge, ModalShell } from "@/components/shared/ui";
import { ago, inputCls, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

export interface Call {
    id: string; candidateId: string; applicationId: string | null; jobTitle: string | null; clientName?: string | null; recruiterName: string;
    candidateName?: string; candidatePhone?: string | null;
    calledAt: string; durationMins: number | null; callType: string; callStatus: string; purpose: string;
    candidateInterest: string | null; communicationRating: string | null; technicalRating: string | null;
    attitudeRating?: string | null; overallRating?: string | null; roleFit?: string | null; skillsAssessed?: string[];
    strengths?: string | null; concerns?: string | null;
    screeningFeedback: string | null; reasonForJobChange: string | null; callOutcome?: string | null; remarks: string; nextAction: string | null;
    followUpDate: string | null; currentCtcLpa: number | null; expectedCtcLpa: number | null; noticePeriodDays: number | null;
    offerInHand?: boolean | null; offerInHandCtcLpa?: number | null; willingToRelocate?: string | null;
    currentLocation?: string | null; interviewAvailability?: string | null; recordingUrl?: string | null;
}
export interface CallAppOption { id: string; jobTitle: string; clientName?: string | null; stage: string }
export interface CallCandidateDefaults { currentCtcLpa?: number; expectedCtcLpa?: number; noticePeriodDays?: number; location?: string }

export const CALL_STATUS = [
    ["CONNECTED", "Connected"], ["NOT_ANSWERED", "Not answered"], ["BUSY", "Busy"],
    ["SWITCHED_OFF", "Switched off"], ["CALL_BACK", "Asked to call back"], ["WRONG_NUMBER", "Wrong number"],
] as const;
export const CALL_PURPOSE = [
    ["INITIAL_SCREENING", "Initial screening"], ["FOLLOW_UP", "Follow-up"], ["INTERVIEW_SCHEDULING", "Interview scheduling"],
    ["INTERVIEW_FEEDBACK", "Interview feedback"], ["SALARY_DISCUSSION", "Salary discussion"], ["OFFER_DISCUSSION", "Offer discussion"],
    ["DOCUMENT_COLLECTION", "Document collection"], ["JOINING_CONFIRMATION", "Joining confirmation"], ["OTHER", "Other"],
] as const;
export const CALL_INTEREST = [["INTERESTED", "Interested"], ["MAYBE", "Maybe / thinking"], ["NOT_INTERESTED", "Not interested"], ["NOT_DISCUSSED", "Not discussed"]] as const;
export const CALL_RATING = [["EXCELLENT", "Excellent"], ["GOOD", "Good"], ["MODERATE", "Moderate"], ["POOR", "Poor"]] as const;
export const CALL_ROLE_FIT = [["STRONG_FIT", "Strong fit"], ["GOOD_FIT", "Good fit"], ["AVERAGE_FIT", "Average fit"], ["NOT_FIT", "Not a fit"]] as const;
export const CALL_YNM = [["YES", "Yes"], ["MAYBE", "Maybe"], ["NO", "No"]] as const;
export const CALL_NEXT_ACTION = [
    ["SCHEDULE_TECH_INTERVIEW", "Schedule technical interview"], ["SCHEDULE_HR_INTERVIEW", "Schedule HR interview"],
    ["CALL_BACK", "Call back"], ["SEND_JD", "Share job description"], ["FOLLOW_UP", "Follow up"],
    ["SHARE_WITH_CLIENT", "Share profile with client"], ["COLLECT_DOCUMENTS", "Collect documents"],
    ["REJECT", "Reject candidate"], ["NO_ACTION", "No action"],
] as const;
const NEEDS_DATE = ["CALL_BACK", "FOLLOW_UP"];
type Pairs = readonly (readonly [string, string])[];
export const callLabel = (list: Pairs, v: string | null | undefined) => list.find(([k]) => k === v)?.[1] ?? v ?? "";
const label = callLabel;

const localNow = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};
const localDate = (offsetDays = 0) => {
    const d = new Date(Date.now() + offsetDays * 86400000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};
const blank = (d: CallCandidateDefaults = {}) => ({
    calledAt: localNow(), durationMins: "", callType: "OUTGOING", callStatus: "CONNECTED", purpose: "INITIAL_SCREENING",
    candidateInterest: "", communicationRating: "", technicalRating: "", attitudeRating: "", overallRating: "", roleFit: "",
    skillsAssessed: "", strengths: "", concerns: "", screeningFeedback: "", reasonForJobChange: "",
    offerInHand: "", offerInHandCtcLpa: "", willingToRelocate: "", currentLocation: d.location ?? "", interviewAvailability: "",
    callOutcome: "", remarks: "", nextAction: "", followUpDate: "", recordingUrl: "",
    currentCtcLpa: d.currentCtcLpa ? String(d.currentCtcLpa) : "", expectedCtcLpa: d.expectedCtcLpa ? String(d.expectedCtcLpa) : "",
    noticePeriodDays: d.noticePeriodDays != null ? String(d.noticePeriodDays) : "",
});
type FormState = ReturnType<typeof blank>;
const lbl = "block text-[11px] font-bold text-neutral-600 space-y-1";
const head = "text-[10px] font-black uppercase tracking-wider text-neutral-400";

// Suggested next step and follow-up date for an unanswered call, so the recruiter doesn't forget to retry
const RETRY: Record<string, { nextAction: string; days: number }> = {
    NOT_ANSWERED: { nextAction: "CALL_BACK", days: 1 }, BUSY: { nextAction: "CALL_BACK", days: 0 },
    SWITCHED_OFF: { nextAction: "CALL_BACK", days: 1 }, CALL_BACK: { nextAction: "CALL_BACK", days: 0 },
};

function RatingPicker({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
    return (
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={name}>
            {CALL_RATING.map(([k, v]) => (
                <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(value === k ? "" : k)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${value === k
                        ? k === "POOR" ? "bg-red-50 border-red-300 text-red-700" : k === "MODERATE" ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}>
                    {v}
                </button>
            ))}
        </div>
    );
}

/**
 * Recruiter call form: structured feedback plus free-text remarks. Each submit appends a new call record.
 * Database calls pass candidateId + applications; outside-data calls pass endpoint, the person's details in `extra`
 * and render their own fields as `children` at the top.
 */
export function CallForm({ candidateId, applications = [], defaultApplicationId, defaults, onDone, endpoint = "/api/ta/calls", extra, children, hideJob }: {
    candidateId?: string; applications?: CallAppOption[]; defaultApplicationId?: string; defaults?: CallCandidateDefaults; onDone?: () => void;
    endpoint?: string; extra?: Record<string, unknown>; children?: React.ReactNode; hideJob?: boolean;
}) {
    const [appId, setAppId] = useState(defaultApplicationId ?? applications.find((a) => !["REJECTED", "JOINED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN"].includes(a.stage))?.id ?? "");
    const [f, setF] = useState<FormState>(() => blank(defaults));
    const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
    const setV = (k: keyof FormState) => (v: string) => setF({ ...f, [k]: v });
    const save = useAct<{ followUpTaskId: string | null }>(endpoint, "POST", ["cand-calls", "job-calls", "job-360", "ta-candidate-detail", "ta-calls-log", "ta-follow-ups", "ta-external-calls", "xcall-lookup"], (r) => `Call logged${r.followUpTaskId ? " · follow-up reminder created" : ""}`);
    const connected = f.callStatus === "CONNECTED";

    const changeStatus = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const st = e.target.value;
        const retry = RETRY[st];
        // Pre-fill a retry reminder for unanswered calls (the recruiter can change it)
        setF({ ...f, callStatus: st, ...(retry && !f.nextAction ? { nextAction: retry.nextAction, followUpDate: f.followUpDate || localDate(retry.days) } : {}) });
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        save.mutate({
            ...(candidateId ? { candidateId, applicationId: appId || undefined } : {}), ...extra, ...f,
            calledAt: new Date(f.calledAt).toISOString(),
            followUpDate: f.followUpDate || undefined,
            skillsAssessed: f.skillsAssessed.split(",").map((x) => x.trim()).filter(Boolean),
            offerInHand: f.offerInHand === "" ? undefined : f.offerInHand === "YES",
        }, {
            onSuccess: () => {
                setF(blank({ currentCtcLpa: Number(f.currentCtcLpa) || undefined, expectedCtcLpa: Number(f.expectedCtcLpa) || undefined, noticePeriodDays: f.noticePeriodDays ? Number(f.noticePeriodDays) : undefined, location: f.currentLocation || undefined }));
                onDone?.();
            },
        });
    };

    return (
        <form className="space-y-4 text-sm" onSubmit={submit}>
            {children}
            <div className="space-y-2">
                <p className={head}>Call details</p>
                <div className="grid grid-cols-2 gap-2">
                    <label className={lbl}>Call date & time *<input type="datetime-local" required max={localNow()} value={f.calledAt} onChange={set("calledAt")} className={inputCls} /></label>
                    <label className={lbl}>Call type<select value={f.callType} onChange={set("callType")} className={inputCls}><option value="OUTGOING">Outgoing</option><option value="INCOMING">Incoming</option></select></label>
                    <label className={lbl}>Call status *<select value={f.callStatus} onChange={changeStatus} className={inputCls}>{CALL_STATUS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    <label className={lbl}>Call purpose<select value={f.purpose} onChange={set("purpose")} className={inputCls}>{CALL_PURPOSE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    {connected && <label className={lbl}>Duration (min)<input type="number" min="1" max="600" value={f.durationMins} onChange={set("durationMins")} className={inputCls} placeholder="e.g. 8" /></label>}
                    {!hideJob && <label className={`${lbl} ${connected ? "" : "col-span-2"}`}>Regarding job<select value={appId} onChange={(e) => setAppId(e.target.value)} className={inputCls}><option value="">General (no specific job)</option>{applications.map((a) => <option key={a.id} value={a.id}>{a.jobTitle}{a.clientName ? ` · ${a.clientName}` : ""}</option>)}</select></label>}
                </div>
            </div>

            {connected && (
                <div className="space-y-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
                    <p className={head}>Screening feedback</p>
                    <div className="grid grid-cols-2 gap-2">
                        <label className={lbl}>Candidate interest *
                            <select required value={f.candidateInterest} onChange={set("candidateInterest")} className={inputCls}>
                                <option value="">Select…</option>
                                {CALL_INTEREST.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </label>
                        <label className={lbl}>Fit for the role<select value={f.roleFit} onChange={set("roleFit")} className={inputCls}><option value="">Not assessed</option>{CALL_ROLE_FIT.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                        {([["communicationRating", "Communication"], ["technicalRating", "Technical knowledge"], ["attitudeRating", "Professionalism & attitude"], ["overallRating", "Overall rating"]] as const).map(([k, l]) => (
                            <div key={k} className="space-y-1"><span className="text-[11px] font-bold text-neutral-600">{l}</span><RatingPicker name={l} value={f[k]} onChange={setV(k)} /></div>
                        ))}
                    </div>
                    <label className={lbl}>Skills assessed (comma separated)<input value={f.skillsAssessed} onChange={set("skillsAssessed")} className={inputCls} placeholder="Java, Spring Boot, SQL" /></label>
                    <div className="grid grid-cols-2 gap-2">
                        <label className={lbl}>Strengths<textarea rows={2} maxLength={1000} value={f.strengths} onChange={set("strengths")} className={inputCls} placeholder="Strong in microservices, clear communicator" /></label>
                        <label className={lbl}>Concerns / gaps<textarea rows={2} maxLength={1000} value={f.concerns} onChange={set("concerns")} className={inputCls} placeholder="Limited cloud exposure, 90-day notice" /></label>
                    </div>
                    <label className={lbl}>Screening feedback<textarea rows={2} maxLength={2000} value={f.screeningFeedback} onChange={set("screeningFeedback")} className={inputCls} placeholder="Summary of the screening for the team lead / client" /></label>
                    <label className={lbl}>Reason for job change<input maxLength={500} value={f.reasonForJobChange} onChange={set("reasonForJobChange")} className={inputCls} placeholder="Better opportunity and salary hike" /></label>

                    <p className={`${head} pt-1`}>Details confirmed on the call</p>
                    <div className="grid grid-cols-3 gap-2">
                        <label className={lbl}>Current CTC (LPA)<input type="number" step="0.1" min="0" max="500" value={f.currentCtcLpa} onChange={set("currentCtcLpa")} className={inputCls} /></label>
                        <label className={lbl}>Expected CTC (LPA)<input type="number" step="0.1" min="0" max="500" value={f.expectedCtcLpa} onChange={set("expectedCtcLpa")} className={inputCls} /></label>
                        <label className={lbl}>Notice (days)<input type="number" min="0" max="365" value={f.noticePeriodDays} onChange={set("noticePeriodDays")} className={inputCls} /></label>
                        <label className={lbl}>Offer in hand?<select value={f.offerInHand} onChange={set("offerInHand")} className={inputCls}><option value="">Not asked</option><option value="YES">Yes</option><option value="NO">No</option></select></label>
                        {f.offerInHand === "YES"
                            ? <label className={lbl}>Offer CTC (LPA)<input type="number" step="0.1" min="0" max="500" value={f.offerInHandCtcLpa} onChange={set("offerInHandCtcLpa")} className={inputCls} /></label>
                            : <span />}
                        <label className={lbl}>Willing to relocate<select value={f.willingToRelocate} onChange={set("willingToRelocate")} className={inputCls}><option value="">Not asked</option>{CALL_YNM.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <label className={lbl}>Current location<input maxLength={120} value={f.currentLocation} onChange={set("currentLocation")} className={inputCls} placeholder="Pune" /></label>
                        <label className={lbl}>Interview availability<input maxLength={200} value={f.interviewAvailability} onChange={set("interviewAvailability")} className={inputCls} placeholder="Weekdays after 6 PM" /></label>
                    </div>
                    <p className="text-[11px] text-neutral-400">CTC, notice, location and new skills entered here also update the candidate profile.</p>
                </div>
            )}

            <div className="space-y-2">
                <p className={head}>Outcome & next steps</p>
                <label className={lbl}>Call outcome<input value={f.callOutcome} onChange={set("callOutcome")} maxLength={300} className={inputCls} placeholder={connected ? "e.g. Screened — shortlisted for technical round" : "e.g. Not reachable"} /></label>
                <label className={lbl}>Recruiter remarks *<textarea required rows={3} maxLength={5000} value={f.remarks} onChange={set("remarks")} className={inputCls} placeholder={connected ? "What was discussed, what the candidate wants…" : "e.g. No answer, will try after 6 PM"} /></label>
                <div className="grid grid-cols-2 gap-2">
                    <label className={lbl}>Next action<select value={f.nextAction} onChange={set("nextAction")} className={inputCls}><option value="">—</option>{CALL_NEXT_ACTION.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    <label className={lbl}>Follow-up date{NEEDS_DATE.includes(f.nextAction) ? " *" : ""}<input type="date" required={NEEDS_DATE.includes(f.nextAction)} min={localDate()} value={f.followUpDate} onChange={set("followUpDate")} className={inputCls} title="Creates a reminder task" /></label>
                </div>
                <label className={lbl}>Call recording link<input type="url" pattern="https://.*" value={f.recordingUrl} onChange={set("recordingUrl")} className={inputCls} placeholder="https://… (optional)" /></label>
            </div>
            <button disabled={save.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"><Phone size={14} /> {save.isPending ? "Saving…" : "Save call"}</button>
        </form>
    );
}

const RATING_TONE: Record<string, string> = { EXCELLENT: "text-emerald-700", GOOD: "text-emerald-600", MODERATE: "text-amber-600", POOR: "text-red-600" };

/** Every detail of one call, grouped the same way as the form. */
export function CallDetails({ c }: { c: Call }) {
    const ratings = ([["Communication", c.communicationRating], ["Technical", c.technicalRating], ["Attitude", c.attitudeRating], ["Overall", c.overallRating]] as [string, string | null | undefined][])
        .filter((r): r is [string, string] => !!r[1]);
    const confirmed = [
        c.currentCtcLpa != null && `Current CTC ${c.currentCtcLpa} L`,
        c.expectedCtcLpa != null && `Expects ${c.expectedCtcLpa} L`,
        c.noticePeriodDays != null && `Notice ${c.noticePeriodDays === 0 ? "immediate" : `${c.noticePeriodDays} days`}`,
        c.offerInHand != null && (c.offerInHand ? `Offer in hand${c.offerInHandCtcLpa != null ? ` (${c.offerInHandCtcLpa} L)` : ""}` : "No offer in hand"),
        c.willingToRelocate && `Relocate: ${label(CALL_YNM, c.willingToRelocate).toLowerCase()}`,
        c.currentLocation && `In ${c.currentLocation}`,
        c.interviewAvailability && `Available ${c.interviewAvailability}`,
    ].filter((x): x is string => !!x);
    return (
        <div className="space-y-1.5 text-xs">
            {c.callOutcome && <p className="text-neutral-800 font-semibold">Outcome: {c.callOutcome}</p>}
            <p className="text-neutral-700 whitespace-pre-line">{c.remarks}</p>
            {(ratings.length > 0 || c.roleFit) && (
                <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-neutral-500">
                    {ratings.map(([k, v]) => <span key={k}><Star size={10} className="inline -mt-0.5" /> {k}: <b className={RATING_TONE[v] ?? ""}>{label(CALL_RATING, v)}</b></span>)}
                    {c.roleFit && <span>Fit: <b className={c.roleFit === "NOT_FIT" ? "text-red-600" : "text-neutral-700"}>{label(CALL_ROLE_FIT, c.roleFit)}</b></span>}
                </p>
            )}
            {!!c.skillsAssessed?.length && <p className="flex flex-wrap gap-1">{c.skillsAssessed.map((s) => <span key={s} className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 text-[10px] font-bold">{s}</span>)}</p>}
            {c.strengths && <p className="text-neutral-600"><b className="text-emerald-700">Strengths:</b> {c.strengths}</p>}
            {c.concerns && <p className="text-neutral-600"><b className="text-amber-700">Concerns:</b> {c.concerns}</p>}
            {c.screeningFeedback && <p className="text-neutral-600"><b>Screening:</b> {c.screeningFeedback}</p>}
            {c.reasonForJobChange && <p className="text-neutral-600"><b>Why change:</b> {c.reasonForJobChange}</p>}
            {confirmed.length > 0 && <p className="text-neutral-500">{confirmed.join(" · ")}</p>}
            {(c.nextAction || c.followUpDate) && (
                <p className="text-primary font-semibold flex items-center gap-1"><CalendarClock size={11} />
                    {[c.nextAction && label(CALL_NEXT_ACTION, c.nextAction), c.followUpDate && `follow up ${c.followUpDate}`].filter(Boolean).join(" · ")}
                </p>
            )}
            {c.recordingUrl && <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"><ExternalLink size={11} /> Call recording</a>}
        </div>
    );
}

/** Chronological call records, newest first; the latest call opens expanded. */
export function CallHistory({ calls, showCandidate }: { calls: Call[]; showCandidate?: boolean }) {
    const [open, setOpen] = useState<string | null>(calls[0]?.id ?? null);
    if (!calls.length) return <p className="text-xs text-neutral-400 py-6 text-center">No calls logged yet.</p>;
    return (
        <ul className="space-y-3 text-xs">
            {calls.map((c) => {
                const Icon = c.callType === "INCOMING" ? PhoneIncoming : PhoneOutgoing;
                const expanded = open === c.id;
                return (
                    <li key={c.id} className={`border-l-2 pl-3 ${c.callStatus === "CONNECTED" ? "border-emerald-300" : "border-neutral-200"}`}>
                        <button type="button" onClick={() => setOpen(expanded ? null : c.id)} aria-expanded={expanded} className="w-full text-left">
                            <p className="font-bold text-neutral-800 flex items-center gap-1.5 flex-wrap">
                                <Icon size={12} className="text-neutral-400" />
                                {showCandidate && c.candidateName ? `${c.candidateName} · ` : ""}{label(CALL_PURPOSE, c.purpose)}
                                <Badge value={c.callStatus} label={label(CALL_STATUS, c.callStatus)} />
                                {c.candidateInterest && <Badge value={c.candidateInterest} label={label(CALL_INTEREST, c.candidateInterest)} />}
                                {c.jobTitle && <span className="font-normal text-neutral-400">re {c.jobTitle}</span>}
                                <ChevronDown size={12} className={`ml-auto text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </p>
                            <p className="text-neutral-400 mt-0.5">{c.recruiterName} · {new Date(c.calledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} ({ago(c.calledAt)}){c.durationMins ? ` · ${c.durationMins} min` : ""}</p>
                            {!expanded && <p className="text-neutral-600 truncate mt-0.5">{c.callOutcome || c.remarks}</p>}
                        </button>
                        {expanded && <div className="mt-1.5"><CallDetails c={c} /></div>}
                    </li>
                );
            })}
        </ul>
    );
}

/** Calls tab on the candidate profile: form on the left, full call history on the right. */
export default function CandidateCalls({ candidateId, applications, defaults }: { candidateId: string; applications: CallAppOption[]; defaults?: CallCandidateDefaults }) {
    const { data } = useQuery<Call[]>({ queryKey: ["cand-calls", candidateId], queryFn: () => api(`/api/ta/calls?candidateId=${candidateId}`) });
    const calls = data ?? [];
    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <SectionCard title="Log a call" className="lg:col-span-2"><CallForm candidateId={candidateId} applications={applications} defaults={defaults} /></SectionCard>
            <SectionCard title="Call history" subtitle={`${calls.length} call(s) · ${calls.filter((c) => c.callStatus === "CONNECTED").length} connected`} className="lg:col-span-3">
                <CallHistory key={calls[0]?.id ?? "none"} calls={calls} />
            </SectionCard>
        </div>
    );
}

/** Quick "Log call" from a list (e.g. a requisition's applications) with that candidate's earlier calls below. */
export function LogCallModal({ candidateId, candidateName, application, defaults, onClose }: {
    candidateId: string; candidateName: string; application: CallAppOption; defaults?: CallCandidateDefaults; onClose: () => void;
}) {
    const { data } = useQuery<Call[]>({ queryKey: ["cand-calls", candidateId], queryFn: () => api(`/api/ta/calls?candidateId=${candidateId}`) });
    return (
        <ModalShell title={`Log call · ${candidateName}`} onClose={onClose} wide>
            <CallForm candidateId={candidateId} applications={[application]} defaultApplicationId={application.id} defaults={defaults} onDone={onClose} />
            {!!data?.length && (
                <div className="mt-5 pt-4 border-t border-neutral-100">
                    <p className="text-xs font-bold text-neutral-500 mb-2">Earlier calls ({data.length})</p>
                    <CallHistory key={data[0]?.id ?? "none"} calls={data.slice(0, 5)} />
                </div>
            )}
        </ModalShell>
    );
}
