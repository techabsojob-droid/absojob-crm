import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, candidates, clients, commissionLedger, interviews, jobs, referralMessages, referrals } from "@/lib/mock/data";
import { referralIncentiveFor } from "@/lib/mock/pipeline";

const STAGE_LABEL: Record<string, string> = {
    SOURCED: "Added to pipeline", SCREENING: "Screening", INTERVIEW_SCHEDULED: "Interview scheduled", TECH_ROUND: "Technical round", CLIENT_ROUND: "Client round", HR_ROUND: "HR round",
    OFFER_SENT: "Offer released", OFFER_ACCEPTED: "Offer accepted", ONBOARDING: "Onboarding", JOINED: "Joined", REJECTED: "Not selected", BACKED_OUT: "Candidate backed out", ON_HOLD: "On hold", BLACKLISTED: "Closed",
};

// GET — one of my referrals with a partner-safe timeline (no interview feedback, CTC or internal notes)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const ref = referrals.find((r) => r.id === id && r.orgId === me.orgId && r.agentId === me.id);
    if (!ref) return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    const cand = candidates.find((c) => c.id === ref.candidateId);
    const job = ref.jobId ? jobs.find((j) => j.id === ref.jobId) : undefined;
    const app = applications.find((a) => a.candidateId === ref.candidateId && (!ref.jobId || a.jobId === ref.jobId));
    const ivs = app ? interviews.filter((i) => i.applicationId === app.id).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)) : [];
    const offer = app ? cand?.offers?.find((o) => o.applicationId === app.id) : undefined;
    const ledger = commissionLedger.filter((l) => l.userId === me.id && (app ? l.applicationId === app.id : false));

    const timeline: { date: string; title: string; detail?: string; tone: "done" | "info" | "bad" | "upcoming" }[] = [
        { date: ref.createdAt, title: "Referral submitted", detail: job ? `${job.title}` : "General referral", tone: "done" },
    ];
    if (app) timeline.push({ date: app.createdAt, title: "Accepted by recruitment team", detail: "Candidate added to the job pipeline", tone: "done" });
    ivs.forEach((i) => timeline.push({
        date: i.scheduledAt,
        title: `${i.round.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} interview`,
        detail: i.status === "SCHEDULED" ? `Scheduled (${i.mode.toLowerCase()})` : i.status === "COMPLETED" ? "Completed" : i.status.replace(/_/g, " ").toLowerCase(),
        tone: i.status === "SCHEDULED" ? "upcoming" : i.status === "COMPLETED" ? "done" : "bad",
    }));
    if (offer && !["DRAFT", "PENDING_APPROVAL"].includes(offer.status)) timeline.push({ date: offer.offeredDate, title: "Offer released", detail: offer.status === "ACCEPTED" ? `Accepted · joining ${offer.joiningDate}` : offer.status === "DECLINED" ? "Declined by candidate" : `Offer ${offer.status.toLowerCase()}`, tone: offer.status === "DECLINED" ? "bad" : "done" });
    if (app?.stage === "JOINED") timeline.push({ date: app.actualJoinDate ?? app.updatedAt, title: "Candidate joined 🎉", detail: `Incentive ₹${ref.incentiveAmount.toLocaleString("en-IN")}`, tone: "done" });
    if (ref.status === "REJECTED") timeline.push({ date: ref.updatedAt, title: "Not taken forward", detail: ref.reviewNotes ?? undefined, tone: "bad" });
    ledger.filter((l) => l.status === "PAID").forEach((l) => timeline.push({ date: l.paidAt ?? l.createdAt, title: l.type === "CLAWBACK" ? "Incentive clawed back" : "Incentive paid", detail: `₹${l.amountInr.toLocaleString("en-IN")}${l.tdsAmount ? ` (TDS ₹${l.tdsAmount.toLocaleString("en-IN")})` : ""}`, tone: l.type === "CLAWBACK" ? "bad" : "done" }));
    timeline.sort((a, b) => +new Date(a.date) - +new Date(b.date));

    return NextResponse.json({
        id: ref.id, status: ref.status, createdAt: ref.createdAt, reviewNotes: ref.status === "REJECTED" ? ref.reviewNotes : null, agentNotes: ref.agentNotes ?? null,
        resumeUrl: ref.resumeFileId ? `/api/files/${ref.resumeFileId}` : null,
        candidate: cand ? { name: cand.name, email: cand.email, phone: cand.phone, currentCompany: cand.currentCompany ?? null, totalExperienceYears: cand.totalExperienceYears, skills: cand.skills } : null,
        job: job ? { id: job.id, title: job.title, clientName: clients.find((c) => c.id === job.clientId)?.companyName ?? null, location: job.location } : null,
        stage: app ? { code: app.stage, label: STAGE_LABEL[app.stage] ?? app.stage } : null,
        nextInterview: ivs.find((i) => i.status === "SCHEDULED" && +new Date(i.scheduledAt) >= Date.now())?.scheduledAt ?? null,
        incentive: {
            amount: ref.incentiveAmount || null,
            estimate: ref.incentiveAmount || referralIncentiveFor(offer?.offeredCtcLpa ?? cand?.expectedCtcLpa ?? 0),
            status: ledger.find((l) => l.type === "REFERRAL_INCENTIVE")?.status ?? (ref.status === "HIRED" ? "PENDING" : null),
            paid: ref.incentivePaid,
        },
        timeline,
        messages: referralMessages.filter((m) => m.referralId === ref.id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    });
}
