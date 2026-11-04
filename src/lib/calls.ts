// ─── Call input validation (shared by database and outside-data call logs) ──
import type { ExternalLeadSource, CallNextAction, CallPurpose, CallRating, CallRoleFit, CallStatus, CallYesNoMaybe, CandidateInterest } from "@/lib/types";

export const CALL_STATUSES: CallStatus[] = ["CONNECTED", "NOT_ANSWERED", "BUSY", "SWITCHED_OFF", "CALL_BACK", "WRONG_NUMBER"];
export const CALL_PURPOSES: CallPurpose[] = ["INITIAL_SCREENING", "FOLLOW_UP", "INTERVIEW_SCHEDULING", "INTERVIEW_FEEDBACK", "SALARY_DISCUSSION", "OFFER_DISCUSSION", "DOCUMENT_COLLECTION", "JOINING_CONFIRMATION", "OTHER"];
export const CALL_INTERESTS: CandidateInterest[] = ["INTERESTED", "NOT_INTERESTED", "MAYBE", "NOT_DISCUSSED"];
export const EXTERNAL_SOURCES: ExternalLeadSource[] = ["NAUKRI", "LINKEDIN", "INDEED", "MONSTER", "SHINE", "APNA", "EXCEL_SHEET", "REFERENCE", "WALK_IN", "SOCIAL_MEDIA", "OTHER_PORTAL", "OTHER"];
const RATINGS: CallRating[] = ["EXCELLENT", "GOOD", "MODERATE", "POOR"];
const FIT: CallRoleFit[] = ["STRONG_FIT", "GOOD_FIT", "AVERAGE_FIT", "NOT_FIT"];
const YNM: CallYesNoMaybe[] = ["YES", "NO", "MAYBE"];
const ACTIONS: CallNextAction[] = ["SCHEDULE_TECH_INTERVIEW", "SCHEDULE_HR_INTERVIEW", "SHARE_WITH_CLIENT", "CALL_BACK", "SEND_JD", "FOLLOW_UP", "COLLECT_DOCUMENTS", "REJECT", "NO_ACTION"];
const MAX_DURATION_MINS = 600;
const DAY = 86400000;

export const pick = <T extends string>(list: T[], v: unknown): T | null => (list.includes(v as T) ? (v as T) : null);
export const text = (v: unknown, max = 2000) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
};
export const num = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
const bool = (v: unknown) => (v === true || v === "true" || v === "YES" ? true : v === false || v === "false" || v === "NO" ? false : null);
export const list = (v: unknown, n = 25) =>
    (Array.isArray(v) ? v : String(v ?? "").split(","))
        .map((x) => String(x).trim().slice(0, 60))
        .filter(Boolean)
        .filter((x, i, a) => a.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i)
        .slice(0, n);
export const lastTen = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(s);

/** The call itself plus its feedback. Feedback fields are kept only when the call connected. */
export interface ParsedCall {
    calledAt: string;
    durationMins: number | null;
    callType: "INCOMING" | "OUTGOING";
    callStatus: CallStatus;
    purpose: CallPurpose;
    candidateInterest: CandidateInterest | null;
    communicationRating: CallRating | null;
    technicalRating: CallRating | null;
    attitudeRating: CallRating | null;
    overallRating: CallRating | null;
    roleFit: CallRoleFit | null;
    skillsAssessed: string[];
    strengths: string | null;
    concerns: string | null;
    screeningFeedback: string | null;
    reasonForJobChange: string | null;
    offerInHand: boolean | null;
    offerInHandCtcLpa: number | null;
    willingToRelocate: CallYesNoMaybe | null;
    currentLocation: string | null;
    interviewAvailability: string | null;
    recordingUrl: string | null;
    callOutcome: string | null;
    remarks: string;
    nextAction: CallNextAction | null;
    followUpDate: string | null;
    currentCtcLpa: number | null;
    expectedCtcLpa: number | null;
    noticePeriodDays: number | null;
}

/** Validates a call form body; returns the cleaned call or a user-facing error. */
export function parseCall(b: Record<string, unknown>): { ok: true; call: ParsedCall } | { ok: false; error: string } {
    const fail = (error: string) => ({ ok: false as const, error });
    const callStatus = pick(CALL_STATUSES, b.callStatus);
    if (!callStatus) return fail("Call status is required");
    if (b.purpose && !pick(CALL_PURPOSES, b.purpose)) return fail("Unknown call purpose");
    const purpose = pick(CALL_PURPOSES, b.purpose) ?? "OTHER";
    const remarks = text(b.remarks, 5000);
    if (!remarks) return fail("Recruiter remarks are required");
    const calledAt = b.calledAt ? new Date(String(b.calledAt)) : new Date();
    if (Number.isNaN(+calledAt)) return fail("Invalid call date / time");
    if (+calledAt > Date.now() + 5 * 60_000) return fail("Call date / time cannot be in the future");
    if (+calledAt < Date.now() - 90 * DAY) return fail("Calls older than 90 days cannot be logged");
    const followUpDate = b.followUpDate ? String(b.followUpDate) : null;
    if (followUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)) return fail("Invalid follow-up date");
    if (followUpDate && followUpDate < new Date(Date.now() - DAY).toISOString().slice(0, 10)) return fail("Follow-up date cannot be in the past");
    const nextAction = pick(ACTIONS, b.nextAction);
    if ((nextAction === "CALL_BACK" || nextAction === "FOLLOW_UP") && !followUpDate) return fail("Pick a follow-up date for this next action");
    const connected = callStatus === "CONNECTED";

    const durationMins = connected ? num(b.durationMins) : null;
    if (durationMins !== null && (durationMins <= 0 || durationMins > MAX_DURATION_MINS)) return fail(`Duration must be between 1 and ${MAX_DURATION_MINS} minutes`);
    const candidateInterest = connected ? pick(CALL_INTERESTS, b.candidateInterest) : null;
    if (connected && !candidateInterest) return fail("Select the candidate's interest for a connected call");
    const currentCtcLpa = connected ? num(b.currentCtcLpa) : null;
    const expectedCtcLpa = connected ? num(b.expectedCtcLpa) : null;
    const offerCtc = num(b.offerInHandCtcLpa);
    for (const [v, n] of [[currentCtcLpa, "Current CTC"], [expectedCtcLpa, "Expected CTC"], [offerCtc, "Offer CTC"]] as const) {
        if (v !== null && v > 500) return fail(`${n} looks wrong — enter it in lakhs per annum (LPA)`);
    }
    const noticePeriodDays = connected ? num(b.noticePeriodDays) : null;
    if (noticePeriodDays !== null && noticePeriodDays > 365) return fail("Notice period cannot be more than 365 days");
    const offerInHand = connected ? bool(b.offerInHand) : null;
    const recordingUrl = text(b.recordingUrl, 500);
    if (recordingUrl && !/^https:\/\/[^\s]+\.[^\s]+$/i.test(recordingUrl)) return fail("Recording link must be an https:// URL");

    return {
        ok: true,
        call: {
            calledAt: calledAt.toISOString(),
            durationMins,
            callType: b.callType === "INCOMING" ? "INCOMING" : "OUTGOING",
            callStatus,
            purpose,
            // Interest, ratings and screening only make sense when the candidate was actually reached
            candidateInterest,
            communicationRating: connected ? pick(RATINGS, b.communicationRating) : null,
            technicalRating: connected ? pick(RATINGS, b.technicalRating) : null,
            attitudeRating: connected ? pick(RATINGS, b.attitudeRating) : null,
            overallRating: connected ? pick(RATINGS, b.overallRating) : null,
            roleFit: connected ? pick(FIT, b.roleFit) : null,
            skillsAssessed: connected ? list(b.skillsAssessed) : [],
            strengths: connected ? text(b.strengths, 1000) : null,
            concerns: connected ? text(b.concerns, 1000) : null,
            screeningFeedback: connected ? text(b.screeningFeedback) : null,
            reasonForJobChange: connected ? text(b.reasonForJobChange, 500) : null,
            offerInHand,
            offerInHandCtcLpa: offerInHand ? offerCtc : null,
            willingToRelocate: connected ? pick(YNM, b.willingToRelocate) : null,
            currentLocation: connected ? text(b.currentLocation, 120) : null,
            interviewAvailability: connected ? text(b.interviewAvailability, 200) : null,
            recordingUrl,
            callOutcome: text(b.callOutcome, 300),
            remarks,
            nextAction,
            followUpDate,
            currentCtcLpa,
            expectedCtcLpa,
            noticePeriodDays,
        },
    };
}

/** Calls are dated on the team's working day (IST). */
export const istDay = (iso: string) => new Date(+new Date(iso) + 330 * 60000).toISOString().slice(0, 10);
