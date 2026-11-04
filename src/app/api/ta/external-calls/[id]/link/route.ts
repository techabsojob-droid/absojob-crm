import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, externalCalls, addAudit } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { isRecruitmentManager } from "@/lib/mock/pipeline";
import { lastTen } from "@/lib/calls";

// POST { candidateId } — the person from an outside-data call is now in the candidate database.
// Links every outside call to the same number (or email) to that candidate, so the history follows them.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const row = externalCalls.find((c) => c.id === id && c.orgId === me.orgId);
    if (!row) return NextResponse.json({ error: "Call not found" }, { status: 404 });
    if (row.recruiterId !== me.id && !isRecruitmentManager(me)) return NextResponse.json({ error: "Only the recruiter who logged this call or a team lead can add it to the database" }, { status: 403 });

    const b = await body(request);
    const cand = candidates.find((c) => c.id === b.candidateId && c.orgId === me.orgId);
    if (!cand) return bad("Candidate not found", 404);
    // Only link the same person: phone or email must match
    const p10 = lastTen(row.phone);
    const samePerson = (p10.length === 10 && lastTen(cand.phone) === p10) || (!!row.email && cand.email?.toLowerCase() === row.email.toLowerCase());
    if (!samePerson) return bad("This candidate's phone and email don't match the person called", 422);

    const now = new Date().toISOString();
    const linked = externalCalls.filter((c) => c.orgId === me.orgId && !c.convertedCandidateId
        && ((p10.length === 10 && lastTen(c.phone) === p10) || (!!row.email && c.email?.toLowerCase() === row.email.toLowerCase())));
    for (const c of linked) { c.convertedCandidateId = cand.id; c.convertedAt = now; }

    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "EXTERNAL_CALLS_LINKED", entity: "Candidate", entityId: cand.id,
        detail: `${linked.length} outside-data call(s) to ${row.personName} linked to ${cand.name} (${cand.candidateCode})`,
    });
    return NextResponse.json({ candidateId: cand.id, linked: linked.length });
}
