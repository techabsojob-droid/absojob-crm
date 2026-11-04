import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/mock/server";
import { jobs, candidates, clients, users, employees, referrals, applications, invoices, tasks } from "@/lib/mock/data";
import { canViewTask, ensureTaskKeys, taskLinkFor } from "@/lib/tasks";
import { canWorkOnApplication, isRecruitmentManager } from "@/lib/mock/pipeline";

// Global search, scoped to what the signed-in role may open, with deep links
export async function GET(request: Request) {
    const user = await getSessionUser();
    if (!user || user.status !== "ACTIVE") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const q = (new URL(request.url).searchParams.get("q") ?? "").toLowerCase().trim();
    if (q.length < 2) return NextResponse.json([]);

    const orgId = user.orgId;
    const role = user.role;
    const isSA = role === "SUPER_ADMIN";
    const isTA = role === "TA_MANAGER" || role === "TA_RECRUITER";
    const isHR = role === "HR_ADMIN";
    const results: { id: string; title: string; type: string; href: string }[] = [];

    if (isSA || isTA) {
        for (const j of jobs.filter((j) => j.orgId === orgId)) {
            const mine = isRecruitmentManager(user) || j.primaryRecruiterId === user.id || (j.assignedTas || []).includes(user.id) || j.requestedById === user.id;
            if (mine && j.title.toLowerCase().includes(q)) {
                results.push({ id: j.id, title: j.title, type: "Job", href: isSA ? `/admin/jobs/${j.id}` : `/ta/requisitions/${j.id}` });
            }
        }
    }
    if (isSA) {
        for (const c of clients.filter((c) => c.orgId === orgId)) {
            if (c.companyName.toLowerCase().includes(q)) {
                results.push({ id: c.id, title: c.companyName, type: "Client", href: `/admin/clients/${c.id}` });
            }
        }
    }
    if (isSA || isTA) {
        for (const c of candidates.filter((c) => c.orgId === orgId && !c.blacklisted)) {
            if (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) {
                results.push({ id: c.id, title: c.name, type: "Candidate", href: isSA ? `/admin/candidates/${c.id}` : `/ta/candidates/${c.id}` });
            }
        }
    } else if (role === "AGENT" || role === "EMPLOYEE") {
        // Portal users can find only the candidates they referred
        const mineIds = new Set(referrals.filter((r) => r.orgId === orgId && r.agentId === user.id).map((r) => r.candidateId));
        for (const c of candidates.filter((c) => mineIds.has(c.id))) {
            if (c.name.toLowerCase().includes(q)) results.push({ id: c.id, title: c.name, type: "Candidate", href: "/portal/referrals" });
        }
    }
    if (isSA || isHR) {
        for (const e of employees.filter((e) => e.orgId === orgId)) {
            if (e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)) {
                results.push({ id: e.id, title: `${e.name} · ${e.employeeId}`, type: "Team", href: `/hr/employees?id=${e.id}` });
            }
        }
    }
    if (isSA) {
        for (const u of users.filter((u) => u.orgId === orgId && u.role === "AGENT")) {
            if (u.name.toLowerCase().includes(q)) {
                results.push({ id: u.id, title: u.name, type: "Team", href: `/admin/team/${u.id}` });
            }
        }
    }
    if (role === "SUPER_ADMIN" || role === "FINANCE_ADMIN") {
        for (const i of invoices.filter((i) => i.orgId === orgId)) {
            if (i.invoiceNumber.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q)) {
                results.push({ id: i.id, title: `${i.invoiceNumber} · ${i.clientName} · ₹${i.total.toLocaleString("en-IN")}`, type: "Invoice", href: `/finance/invoices?id=${i.id}` });
            }
        }
    }
    if (role === "FINANCE_ADMIN") {
        for (const c of clients.filter((c) => c.orgId === orgId)) {
            if (c.companyName.toLowerCase().includes(q)) results.push({ id: c.id, title: c.companyName, type: "Client", href: "/finance/clients" });
        }
    }
    // Recruiters: surface candidates in their own pipeline first
    if (role === "TA_RECRUITER") {
        const mineCand = new Set(applications.filter((a) => canWorkOnApplication(user, a)).map((a) => a.candidateId));
        results.sort((a, b) => Number(mineCand.has(b.id)) - Number(mineCand.has(a.id)));
    }

    // Tasks the user can see, by key (ABS-12) or title
    ensureTaskKeys(tasks, orgId);
    const keyHit = /^[a-z]+-\d+$/.test(q);
    const taskHits = tasks
        .filter((t) => canViewTask(user, t, users) && (t.key?.toLowerCase() === q || (!keyHit && t.title.toLowerCase().includes(q))))
        .slice(0, 5)
        .map((t) => ({ id: t.id, title: `${t.key} · ${t.title}`, type: "Task", href: taskLinkFor(user.role, t.key) }));
    // An exact ticket key goes first
    if (keyHit) results.unshift(...taskHits); else results.push(...taskHits);

    return NextResponse.json(results.slice(0, 12));
}
