import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, clients, jobs, users } from "@/lib/mock/data";
import { isRecruitmentManager } from "@/lib/mock/pipeline";
import { creditStatusOf } from "@/lib/mock/fin/receivables";
import { needsApproval } from "@/lib/requisition-server";
import { DEFAULT_DEPARTMENTS } from "@/lib/requisition-options";

const uniqCi = (xs: (string | null | undefined)[]) => {
    const m = new Map<string, string>();
    for (const x of xs) { const t = String(x ?? "").trim(); if (t && !m.has(t.toLowerCase())) m.set(t.toLowerCase(), t); }
    return [...m.values()].sort((a, b) => a.localeCompare(b));
};
const topBy = (xs: string[], n: number) => {
    const count = new Map<string, { name: string; c: number }>();
    for (const x of xs) { const k = x.toLowerCase(); const e = count.get(k); if (e) e.c++; else count.set(k, { name: x, c: 1 }); }
    return [...count.values()].sort((a, b) => b.c - a.c || a.name.localeCompare(b.name)).slice(0, n).map((e) => e.name);
};

// GET — everything the requisition wizard's dropdowns need, from real records (no hard-coded people or clients)
export async function GET() {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const org = (x: { orgId: string }) => x.orgId === me.orgId;
    const orgJobs = jobs.filter(org);
    const ta = users.filter((u) => org(u) && u.status === "ACTIVE" && ["TA_RECRUITER", "TA_MANAGER", "SUPER_ADMIN"].includes(u.role));

    return NextResponse.json({
        isManager: isRecruitmentManager(me),
        needsApproval: needsApproval(me),
        me: { id: me.id, name: me.name, role: me.role },
        clients: clients.filter(org).filter((c) => c.status !== "CHURNED").map((c) => {
            const credit = creditStatusOf(me.orgId, c.id);
            // Contacts already on record for this client: its main contact, billing emails and contacts used on earlier requisitions
            const contacts = new Map<string, { name: string; email: string; phone: string; source: string }>();
            const add = (name: string | null | undefined, email: string | null | undefined, phone: string | null | undefined, source: string) => {
                const n = String(name ?? "").trim(); const e = String(email ?? "").trim().toLowerCase();
                if (!n && !e) return;
                const k = e || n.toLowerCase();
                if (!contacts.has(k)) contacts.set(k, { name: n, email: e, phone: String(phone ?? "").trim(), source });
            };
            add(c.contactPerson, c.contactEmail, c.contactPhone, "Primary contact");
            for (const j of orgJobs.filter((j) => j.clientId === c.id)) add(j.clientContactName, j.clientContactEmail, j.clientContactPhone, `Used on ${j.requisitionCode ?? j.title}`);
            for (const e of c.billing?.billingEmails ?? []) add("", e, "", "Billing email");
            return {
                id: c.id, name: c.companyName, industry: c.industry, status: c.status,
                creditHold: credit.onHold, creditReasons: credit.reasons,
                contacts: [...contacts.values()],
                defaults: {
                    billingType: c.billing?.feeModel === "FLAT" ? "FIXED_FEE" : "PERCENTAGE",
                    placementFeePct: c.billing?.feePercent ?? c.commissionRate ?? null,
                    replacementGuaranteeDays: c.billing?.guaranteeDays ?? null,
                },
            };
        }).sort((a, b) => a.name.localeCompare(b.name)),
        departments: uniqCi([...DEFAULT_DEPARTMENTS, ...orgJobs.map((j) => j.department)]),
        recruiterTeams: uniqCi([...ta.map((u) => u.department), ...orgJobs.map((j) => j.recruiterTeam), ...candidates.filter(org).map((c) => c.ownership?.recruitmentTeam)]),
        recruiters: ta.filter((u) => u.role !== "SUPER_ADMIN").map((u) => ({ id: u.id, name: u.name, role: u.role, designation: u.designation ?? null, department: u.department ?? null })),
        managers: ta.filter((u) => u.role === "TA_MANAGER" || u.role === "SUPER_ADMIN").map((u) => ({ id: u.id, name: u.name, role: u.role })),
        skillSuggestions: topBy([...orgJobs.flatMap((j) => [...(j.skills ?? []), ...(j.preferredSkills ?? [])]), ...candidates.filter(org).flatMap((c) => c.skills ?? [])], 400),
        certificationSuggestions: topBy([...orgJobs.flatMap((j) => j.certifications ?? []), ...candidates.filter(org).flatMap((c) => c.certifications ?? [])], 200),
        hiringManagers: uniqCi(orgJobs.map((j) => j.hiringManagerName)),
    });
}
