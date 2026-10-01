import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { applications, candidates, clients, jobs, placements, users } from "@/lib/mock/data";
import { canWorkOnApplication } from "@/lib/mock/pipeline";

// GET — offers out, accepted offers awaiting joining (with dropout risk), recent joinings and fall-throughs
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const today = new Date().toISOString().slice(0, 10);
    const days = (d?: string | null) => (d ? Math.round((+new Date(d) - +new Date(today)) / 86400000) : null);

    const rows = applications.filter((a) => a.orgId === me.orgId && canWorkOnApplication(me, a) && ["OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED", "BACKED_OUT"].includes(a.stage)).map((a) => {
        const cand = candidates.find((c) => c.id === a.candidateId);
        const job = jobs.find((j) => j.id === a.jobId);
        const offer = cand?.offers?.filter((o) => o.applicationId === a.id).sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt))[0];
        const plc = placements.find((p) => p.candidateId === a.candidateId && p.jobId === a.jobId);
        const joinDate = a.actualJoinDate ?? plc?.joiningDate ?? a.expectedJoinDate ?? offer?.joiningDate ?? null;
        const d = days(joinDate);
        const lastTouch = cand?.communications?.[0]?.createdAt;
        const silentDays = lastTouch ? Math.floor((Date.now() - +new Date(lastTouch)) / 86400000) : null;
        // Heuristic dropout risk for accepted offers not yet joined
        let risk: "LOW" | "MEDIUM" | "HIGH" | null = null;
        if (["OFFER_ACCEPTED", "ONBOARDING"].includes(a.stage)) {
            risk = (d !== null && d < 0) || (silentDays !== null && silentDays > 14) ? "HIGH" : (cand?.noticePeriodDays ?? 0) >= 60 || (silentDays ?? 99) > 7 ? "MEDIUM" : "LOW";
        }
        return {
            applicationId: a.id, stage: a.stage, candidateId: a.candidateId, candidateName: cand?.name ?? "—", candidatePhone: cand?.phone ?? "",
            jobTitle: job?.title ?? "—", clientName: clients.find((c) => c.id === job?.clientId)?.companyName ?? "—",
            recruiterName: users.find((u) => u.id === a.recruiterId)?.name ?? "—",
            offerStatus: offer?.status ?? null, offeredCtcLpa: offer?.offeredCtcLpa ?? null, offerExpiry: offer?.expiryDate ?? null,
            joinDate, daysToJoin: d, noticePeriodDays: cand?.noticePeriodDays ?? null, lastContactAt: lastTouch ?? null, silentDays, risk,
            placementStatus: plc?.joiningStatus ?? null, guaranteeEndDate: plc?.guaranteeEndDate ?? null, updatedAt: a.updatedAt,
        };
    });

    const recentCut = Date.now() - 90 * 86400000;
    return NextResponse.json({
        offersOut: rows.filter((r) => r.stage === "OFFER_SENT"),
        awaitingJoin: rows.filter((r) => ["OFFER_ACCEPTED", "ONBOARDING"].includes(r.stage)).sort((a, b) => (a.daysToJoin ?? 999) - (b.daysToJoin ?? 999)),
        joined: rows.filter((r) => r.stage === "JOINED" && +new Date(r.joinDate ?? r.updatedAt) >= recentCut).sort((a, b) => String(b.joinDate).localeCompare(String(a.joinDate))),
        backedOut: rows.filter((r) => r.stage === "BACKED_OUT" && +new Date(r.updatedAt) >= recentCut),
    });
}
