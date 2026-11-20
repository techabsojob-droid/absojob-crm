"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Phone, PhoneIncoming, PhoneOutgoing, CalendarClock, ChevronDown, ExternalLink, Star,
    PhoneOff, PhoneMissed, Ban, Clock3, CircleSlash, ThumbsUp, ThumbsDown, HelpCircle,
} from "lucide-react";
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
    ["CONNECTED", "Connected"], ["NOT_ANSWERED", "No answer"], ["BUSY", "Busy"],
    ["SWITCHED_OFF", "Switched off"], ["CALL_BACK", "Call back later"], ["WRONG_NUMBER", "Wrong number"],
] as const;
export const CALL_PURPOSE = [
    ["INITIAL_SCREENING", "Initial screening"], ["FOLLOW_UP", "Follow-up"], ["INTERVIEW_SCHEDULING", "Interview scheduling"],
    ["INTERVIEW_FEEDBACK", "Interview feedback"], ["SALARY_DISCUSSION", "Salary discussion"], ["OFFER_DISCUSSION", "Offer discussion"],
    ["DOCUMENT_COLLECTION", "Document collection"], ["JOINING_CONFIRMATION", "Joining confirmation"], ["OTHER", "Other"],
] as const;
export const CALL_INTEREST = [["INTERESTED", "Interested"], ["MAYBE", "Maybe"], ["NOT_INTERESTED", "Not interested"], ["NOT_DISCUSSED", "Not discussed"]] as const;
export const CALL_RATING = [["EXCELLENT", "Excellent"], ["GOOD", "Good"], ["MODERATE", "Moderate"], ["POOR", "Poor"]] as const;
export const CALL_ROLE_FIT = [["STRONG_FIT", "Strong fit"], ["GOOD_FIT", "Good fit"], ["AVERAGE_FIT", "Average fit"], ["NOT_FIT", "Not a fit"]] as const;
export const CALL_YNM = [["YES", "Yes"], ["MAYBE", "Maybe"], ["NO", "No"]] as const;
export const CALL_NEXT_ACTION = [
    ["SHARE_WITH_CLIENT", "Share with client"], ["SCHEDULE_TECH_INTERVIEW", "Tech interview"], ["SCHEDULE_HR_INTERVIEW", "HR interview"],
    ["SEND_JD", "Send JD"], ["FOLLOW_UP", "Follow up"], ["CALL_BACK", "Call back"],
    ["COLLECT_DOCUMENTS", "Collect documents"], ["REJECT", "Reject"], ["NO_ACTION", "Nothing"],
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
const nextMonday = () => {
    const d = new Date();
    return ((8 - d.getDay()) % 7) || 7;
};
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** The call's likely purpose from where the candidate is on this job (editable under More details). */
function purposeFor(stage?: string): string {
    if (!stage || ["SOURCED", "CONTACTED", "SCREENING"].includes(stage)) return "INITIAL_SCREENING";
    if (["SHORTLISTED", "INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"].includes(stage)) return "INTERVIEW_SCHEDULING";
    if (["INTERVIEW_COMPLETED", "SELECTED"].includes(stage)) return "INTERVIEW_FEEDBACK";
    if (stage === "OFFER_SENT") return "OFFER_DISCUSSION";
    if (["OFFER_ACCEPTED", "ONBOARDING"].includes(stage)) return "JOINING_CONFIRMATION";
    return "FOLLOW_UP";
}

const blank = (d: CallCandidateDefaults = {}, purpose = "INITIAL_SCREENING") => ({
    // Empty call time = "just now", taken at the moment of saving
    calledAt: "", durationMins: "", callType: "OUTGOING", callStatus: "", purpose,
    candidateInterest: "", communicationRating: "", technicalRating: "", attitudeRating: "", overallRating: "", roleFit: "",
    skillsAssessed: "", strengths: "", concerns: "", screeningFeedback: "", reasonForJobChange: "",
    offerInHand: "", offerInHandCtcLpa: "", willingToRelocate: "", currentLocation: d.location ?? "", interviewAvailability: "",
    callOutcome: "", remarks: "", nextAction: "", followUpDate: "", recordingUrl: "",
    currentCtcLpa: d.currentCtcLpa ? String(d.currentCtcLpa) : "", expectedCtcLpa: d.expectedCtcLpa ? String(d.expectedCtcLpa) : "",
    noticePeriodDays: d.noticePeriodDays != null ? String(d.noticePeriodDays) : "",
});
type FormState = ReturnType<typeof blank>;
const lbl = "block text-[12px] font-medium text-neutral-600 space-y-1";
const q = "text-[13px] font-semibold text-neutral-800";

// For calls that didn't connect: when to try again by default
const RETRY_DAYS: Record<string, number | null> = { NOT_ANSWERED: 1, BUSY: 0, SWITCHED_OFF: 1, CALL_BACK: 0, WRONG_NUMBER: null };

const STATUS_CHOICES: { id: string; label: string; icon: typeof Phone; tone: "good" | "neutral" | "bad" }[] = [
    { id: "CONNECTED", label: "Connected", icon: Phone, tone: "good" },
    { id: "NOT_ANSWERED", label: "No answer", icon: PhoneMissed, tone: "neutral" },
    { id: "BUSY", label: "Busy", icon: Clock3, tone: "neutral" },
    { id: "SWITCHED_OFF", label: "Switched off", icon: PhoneOff, tone: "neutral" },
    { id: "CALL_BACK", label: "Call back later", icon: CalendarClock, tone: "neutral" },
    { id: "WRONG_NUMBER", label: "Wrong number", icon: Ban, tone: "bad" },
];
const INTEREST_CHOICES = [
    { id: "INTERESTED", label: "Interested", icon: ThumbsUp, tone: "good" as const },
    { id: "MAYBE", label: "Maybe", icon: HelpCircle, tone: "neutral" as const },
    { id: "NOT_INTERESTED", label: "Not interested", icon: ThumbsDown, tone: "bad" as const },
    { id: "NOT_DISCUSSED", label: "Didn't discuss", icon: CircleSlash, tone: "neutral" as const },
];
const TONE_ON = {
    good: "bg-emerald-50 border-emerald-400 text-emerald-800",
    neutral: "bg-navy/5 border-navy text-navy",
    bad: "bg-red-50 border-red-300 text-red-700",
};

/** A row of one-tap choices (radio group). Tapping the chosen one again clears it when `clearable`. */
function Choice({ options, value, onChange, name, clearable, cols }: {
    options: { id: string; label: string; icon?: typeof Phone; tone?: "good" | "neutral" | "bad" }[];
    value: string; onChange: (v: string) => void; name: string; clearable?: boolean; cols?: string;
}) {
    return (
        <div role="radiogroup" aria-label={name} className={cols ?? "flex flex-wrap gap-1.5"}>
            {options.map((o) => {
                const on = value === o.id;
                const Icon = o.icon;
                return (
                    <button key={o.id} type="button" role="radio" aria-checked={on}
                        onClick={() => onChange(on && clearable ? "" : o.id)}
                        className={`min-h-9 px-3 py-1.5 rounded-md border text-[12.5px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer
                            ${on ? TONE_ON[o.tone ?? "neutral"] : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"}`}>
                        {Icon && <Icon size={14} />} {o.label}
                    </button>
                );
            })}
        </div>
    );
}

function RatingPicker({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
    return (
        <Choice name={name} value={value} onChange={onChange} clearable
            options={CALL_RATING.map(([k, v]) => ({ id: k, label: v, tone: k === "POOR" ? "bad" as const : k === "MODERATE" ? "neutral" as const : "good" as const }))} />
    );
}

/** "When?" picker for a reminder: quick days plus any date. */
function WhenPicker({ value, onChange, allowNone, required }: { value: string; onChange: (v: string) => void; allowNone?: boolean; required?: boolean }) {
    const quick = [
        { id: localDate(0), label: "Later today" },
        { id: localDate(1), label: "Tomorrow" },
        { id: localDate(2), label: "In 2 days" },
        { id: localDate(nextMonday()), label: "Next Monday" },
    ].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i);
    const custom = value && !quick.some((x) => x.id === value);
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <Choice name="Reminder date" value={value} onChange={onChange} options={[...quick, ...(allowNone ? [{ id: "", label: "No reminder" }] : [])]} />
            <label className={`min-h-9 px-2 rounded-md border flex items-center gap-1 text-[12.5px] ${custom ? TONE_ON.neutral : "border-neutral-200 text-neutral-600"}`}>
                <CalendarClock size={14} />
                <input type="date" min={localDate()} value={value} required={required} onChange={(e) => onChange(e.target.value)}
                    aria-label="Pick a date" className="bg-transparent outline-none text-[12.5px] w-[118px]" />
            </label>
        </div>
    );
}

/**
 * Recruiter call form. Asks only what matters, in order:
 * what happened → (if connected) interest, notes, quick details check → next step and reminder.
 * Ratings, skills, offer and the rest sit under "More details".
 * Database calls pass candidateId + applications; outside-data calls pass endpoint, the person's details
 * in `extra` and render their own fields as `children` at the top.
 */
export function CallForm({ candidateId, applications = [], defaultApplicationId, defaults, onDone, endpoint = "/api/ta/calls", extra, children, hideJob }: {
    candidateId?: string; applications?: CallAppOption[]; defaultApplicationId?: string; defaults?: CallCandidateDefaults; onDone?: () => void;
    endpoint?: string; extra?: Record<string, unknown>; children?: React.ReactNode; hideJob?: boolean;
}) {
    const openApps = applications.filter((a) => !["REJECTED", "JOINED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN"].includes(a.stage));
    const [appId, setAppId] = useState(defaultApplicationId ?? openApps[0]?.id ?? "");
    const stageOf = (id: string) => applications.find((a) => a.id === id)?.stage;
    const [f, setF] = useState<FormState>(() => blank(defaults, purposeFor(stageOf(appId))));
    const [more, setMore] = useState(false);
    const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
    const setV = (k: keyof FormState) => (v: string) => setF((p) => ({ ...p, [k]: v }));
    const save = useAct<{ followUpTaskId: string | null; closedFollowUps?: number }>(endpoint, "POST",
        ["cand-calls", "job-calls", "job-360", "ta-candidate-detail", "ta-calls-log", "ta-follow-ups", "ta-external-calls", "xcall-lookup"],
        (r) => ["Call saved", r.followUpTaskId && "reminder set", r.closedFollowUps && `${r.closedFollowUps} earlier reminder${r.closedFollowUps > 1 ? "s" : ""} done`].filter(Boolean).join(" · "));
    const connected = f.callStatus === "CONNECTED";
    const dateRequired = NEEDS_DATE.includes(f.nextAction);

    const pickStatus = (st: string) => {
        if (st === "CONNECTED") {
            setF({ ...f, callStatus: st, nextAction: f.callStatus && f.callStatus !== "CONNECTED" ? "" : f.nextAction, followUpDate: f.callStatus && f.callStatus !== "CONNECTED" ? "" : f.followUpDate });
            return;
        }
        // Not reached: suggest a retry reminder (the recruiter can change or remove it)
        const days = RETRY_DAYS[st];
        setF({ ...f, callStatus: st, nextAction: days == null ? "NO_ACTION" : "CALL_BACK", followUpDate: days == null ? "" : localDate(days) });
    };
    const pickNext = (a: string) => setF({ ...f, nextAction: a, followUpDate: ["REJECT", "NO_ACTION", ""].includes(a) ? "" : f.followUpDate || (NEEDS_DATE.includes(a) ? localDate(1) : "") });

    const missing = !f.callStatus ? "Choose what happened on the call"
        : connected && !f.candidateInterest ? "Choose whether they're interested"
        : connected && !f.remarks.trim() ? "Add a short note"
        : dateRequired && !f.followUpDate ? "Pick when to follow up"
        : null;

    const submit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (missing || save.isPending) return;
        save.mutate({
            ...(candidateId ? { candidateId, applicationId: appId || undefined } : {}), ...extra, ...f,
            calledAt: f.calledAt ? new Date(f.calledAt).toISOString() : new Date().toISOString(),
            nextAction: f.nextAction || undefined,
            followUpDate: f.followUpDate || undefined,
            skillsAssessed: f.skillsAssessed.split(",").map((x) => x.trim()).filter(Boolean),
            offerInHand: f.offerInHand === "" ? undefined : f.offerInHand === "YES",
        }, {
            onSuccess: () => {
                setF(blank({ currentCtcLpa: Number(f.currentCtcLpa) || undefined, expectedCtcLpa: Number(f.expectedCtcLpa) || undefined, noticePeriodDays: f.noticePeriodDays ? Number(f.noticePeriodDays) : undefined, location: f.currentLocation || undefined }, f.purpose));
                setMore(false);
                onDone?.();
            },
        });
    };

    const reminderText = f.followUpDate ? `reminder ${f.followUpDate === localDate() ? "today" : shortDate(f.followUpDate)}` : null;

    return (
        <form className="space-y-5 text-sm" onSubmit={submit}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}>
            {children}

            {!hideJob && applications.length > 0 && (
                <label className={lbl}>About which job?
                    <select value={appId} onChange={(e) => { setAppId(e.target.value); setF((p) => ({ ...p, purpose: purposeFor(stageOf(e.target.value)) })); }} className={inputCls}>
                        <option value="">General (no specific job)</option>
                        {applications.map((a) => <option key={a.id} value={a.id}>{a.jobTitle}{a.clientName ? ` · ${a.clientName}` : ""}</option>)}
                    </select>
                </label>
            )}

            {/* 1. What happened */}
            <div className="space-y-2">
                <p className={q}>What happened?</p>
                <Choice name="Call result" value={f.callStatus} onChange={pickStatus} options={STATUS_CHOICES} cols="grid grid-cols-2 sm:grid-cols-3 gap-1.5" />
            </div>

            {connected && (
                <>
                    {/* 2. Interest */}
                    <div className="space-y-2">
                        <p className={q}>Is the candidate interested?</p>
                        <Choice name="Candidate interest" value={f.candidateInterest} onChange={setV("candidateInterest")} options={INTEREST_CHOICES} cols="grid grid-cols-2 sm:grid-cols-4 gap-1.5" />
                    </div>

                    {/* 3. Notes */}
                    <label className="block space-y-2">
                        <span className={q}>What did you discuss?</span>
                        <textarea rows={3} maxLength={5000} value={f.remarks} onChange={set("remarks")} className={inputCls}
                            placeholder="e.g. Open to the role, wants 20 LPA, can join in 30 days. Prefers hybrid in Pune." />
                    </label>

                    {/* 4. Quick details check */}
                    <div className="space-y-2">
                        <p className={q}>Quick check <span className="font-normal text-neutral-500 text-[12px]">· pre-filled from the profile, change if needed</span></p>
                        <div className="grid grid-cols-3 gap-2">
                            <label className={lbl}>Current CTC (LPA)<input type="number" inputMode="decimal" step="0.1" min="0" max="500" value={f.currentCtcLpa} onChange={set("currentCtcLpa")} className={inputCls} /></label>
                            <label className={lbl}>Expected CTC (LPA)<input type="number" inputMode="decimal" step="0.1" min="0" max="500" value={f.expectedCtcLpa} onChange={set("expectedCtcLpa")} className={inputCls} /></label>
                            <label className={lbl}>Notice (days)<input type="number" inputMode="numeric" min="0" max="365" value={f.noticePeriodDays} onChange={set("noticePeriodDays")} className={inputCls} placeholder="0 = immediate" /></label>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-neutral-500">
                            Notice:
                            {[["0", "Immediate"], ["15", "15 d"], ["30", "30 d"], ["60", "60 d"], ["90", "90 d"]].map(([v, l]) => (
                                <button key={v} type="button" onClick={() => setV("noticePeriodDays")(v)}
                                    className={`px-2 py-0.5 rounded border ${f.noticePeriodDays === v ? TONE_ON.neutral : "border-neutral-200 hover:border-neutral-300"}`}>{l}</button>
                            ))}
                            <span className="mx-1 text-neutral-300">|</span> Talked:
                            {["2", "5", "10", "20"].map((m) => (
                                <button key={m} type="button" onClick={() => setV("durationMins")(f.durationMins === m ? "" : m)}
                                    className={`px-2 py-0.5 rounded border ${f.durationMins === m ? TONE_ON.neutral : "border-neutral-200 hover:border-neutral-300"}`}>{m} min</button>
                            ))}
                        </div>
                    </div>

                    {/* 5. Next step */}
                    <div className="space-y-2">
                        <p className={q}>Next step</p>
                        <Choice name="Next step" value={f.nextAction} onChange={pickNext} clearable
                            options={CALL_NEXT_ACTION.map(([k, v]) => ({ id: k, label: v, tone: k === "REJECT" ? "bad" as const : "neutral" as const }))} />
                        {f.nextAction && !["REJECT", "NO_ACTION"].includes(f.nextAction) && (
                            <div className="space-y-1.5 pt-1">
                                <p className="text-[12px] text-neutral-600">Remind me{dateRequired ? "" : " (optional)"}</p>
                                <WhenPicker value={f.followUpDate} onChange={setV("followUpDate")} allowNone={!dateRequired} required={dateRequired} />
                            </div>
                        )}
                    </div>
                </>
            )}

            {f.callStatus && !connected && (
                <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
                    <div className="space-y-1.5">
                        <p className={q}>Try again?</p>
                        <WhenPicker value={f.followUpDate} allowNone
                            onChange={(v) => setF((p) => ({ ...p, followUpDate: v, nextAction: v ? "CALL_BACK" : "NO_ACTION" }))} />
                    </div>
                    <label className={lbl}>Note (optional)
                        <input maxLength={500} value={f.remarks} onChange={set("remarks")} className={inputCls} placeholder={f.callStatus === "CALL_BACK" ? "e.g. Asked to call after 6 PM" : "e.g. Try in the evening"} />
                    </label>
                </div>
            )}

            {/* More details */}
            {f.callStatus && (
                <div className="border-t border-neutral-100 pt-3">
                    <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="text-[12.5px] font-medium text-navy flex items-center gap-1 cursor-pointer">
                        <ChevronDown size={14} className={`transition-transform ${more ? "rotate-180" : ""}`} />
                        {more ? "Fewer details" : connected ? "More details (ratings, skills, offer, call time…)" : "More details (call time, purpose…)"}
                    </button>
                    {more && (
                        <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <label className={lbl}>Call time<input type="datetime-local" max={localNow()} value={f.calledAt} onChange={set("calledAt")} className={inputCls} /><span className="text-[11px] text-neutral-400">{f.calledAt ? "" : "Empty = just now"}</span></label>
                                <label className={lbl}>Direction<select value={f.callType} onChange={set("callType")} className={inputCls}><option value="OUTGOING">I called them</option><option value="INCOMING">They called me</option></select></label>
                                <label className={lbl}>Purpose<select value={f.purpose} onChange={set("purpose")} className={inputCls}>{CALL_PURPOSE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                                {connected && <label className={lbl}>Duration (min)<input type="number" min="1" max="600" value={f.durationMins} onChange={set("durationMins")} className={inputCls} /></label>}
                            </div>
                            {connected && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                                        <div className="space-y-1"><span className="text-[12px] font-medium text-neutral-600">Fit for the role</span>
                                            <Choice name="Fit for the role" value={f.roleFit} onChange={setV("roleFit")} clearable options={CALL_ROLE_FIT.map(([k, v]) => ({ id: k, label: v, tone: k === "NOT_FIT" ? "bad" as const : "good" as const }))} />
                                        </div>
                                        {([["overallRating", "Overall"], ["communicationRating", "Communication"], ["technicalRating", "Technical"], ["attitudeRating", "Attitude"]] as const).map(([k, l]) => (
                                            <div key={k} className="space-y-1"><span className="text-[12px] font-medium text-neutral-600">{l}</span><RatingPicker name={l} value={f[k]} onChange={setV(k)} /></div>
                                        ))}
                                    </div>
                                    <label className={lbl}>Skills checked (comma separated)<input value={f.skillsAssessed} onChange={set("skillsAssessed")} className={inputCls} placeholder="Java, Spring Boot, SQL" /></label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <label className={lbl}>Strengths<textarea rows={2} maxLength={1000} value={f.strengths} onChange={set("strengths")} className={inputCls} /></label>
                                        <label className={lbl}>Concerns<textarea rows={2} maxLength={1000} value={f.concerns} onChange={set("concerns")} className={inputCls} /></label>
                                    </div>
                                    <label className={lbl}>Summary for the client / team lead<textarea rows={2} maxLength={2000} value={f.screeningFeedback} onChange={set("screeningFeedback")} className={inputCls} /></label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className={lbl}>Why changing job<input maxLength={500} value={f.reasonForJobChange} onChange={set("reasonForJobChange")} className={inputCls} /></label>
                                        <label className={lbl}>Current location<input maxLength={120} value={f.currentLocation} onChange={set("currentLocation")} className={inputCls} /></label>
                                        <label className={lbl}>Offer in hand?<select value={f.offerInHand} onChange={set("offerInHand")} className={inputCls}><option value="">Not asked</option><option value="YES">Yes</option><option value="NO">No</option></select></label>
                                        {f.offerInHand === "YES"
                                            ? <label className={lbl}>Offer CTC (LPA)<input type="number" step="0.1" min="0" max="500" value={f.offerInHandCtcLpa} onChange={set("offerInHandCtcLpa")} className={inputCls} /></label>
                                            : <label className={lbl}>Willing to relocate<select value={f.willingToRelocate} onChange={set("willingToRelocate")} className={inputCls}><option value="">Not asked</option>{CALL_YNM.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
                                        <label className={lbl}>Free for interviews<input maxLength={200} value={f.interviewAvailability} onChange={set("interviewAvailability")} className={inputCls} placeholder="Weekdays after 6 PM" /></label>
                                        <label className={lbl}>One-line outcome<input maxLength={300} value={f.callOutcome} onChange={set("callOutcome")} className={inputCls} placeholder="Shortlisted for tech round" /></label>
                                    </div>
                                    <p className="text-[11px] text-neutral-400">CTC, notice, location and new skills saved here also update the candidate profile.</p>
                                </>
                            )}
                            <label className={lbl}>Call recording link<input type="url" pattern="https://.*" value={f.recordingUrl} onChange={set("recordingUrl")} className={inputCls} placeholder="https://… (optional)" /></label>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-1.5">
                <button disabled={!!missing || save.isPending}
                    className="w-full h-11 rounded-md bg-primary text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer">
                    <Phone size={14} /> {save.isPending ? "Saving…" : `Save call${reminderText ? ` · ${reminderText}` : ""}`}
                </button>
                <p className="text-[11.5px] text-center text-neutral-500">{missing ?? "Ctrl + Enter to save"}</p>
            </div>
        </form>
    );
}

/** Quick filters for call logs: one tap instead of separate status / interest dropdowns. */
export const QUICK_FILTERS = [
    { id: "", label: "All calls", params: {} },
    { id: "connected", label: "Connected", params: { status: "CONNECTED" } },
    { id: "not-reached", label: "Not reached", params: { status: "NOT_REACHED" } },
    { id: "interested", label: "Interested", params: { interest: "INTERESTED" } },
    { id: "maybe", label: "Maybe", params: { interest: "MAYBE" } },
    { id: "not-interested", label: "Not interested", params: { interest: "NOT_INTERESTED" } },
] as const;
export type QuickFilter = (typeof QUICK_FILTERS)[number]["id"];

export function QuickFilterChips({ value, onChange }: { value: QuickFilter; onChange: (v: QuickFilter) => void }) {
    return (
        <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1">
            {QUICK_FILTERS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={value === f.id} onClick={() => onChange(f.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer ${value === f.id ? "bg-navy text-white border-navy" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"}`}>
                    {f.label}
                </button>
            ))}
        </div>
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
