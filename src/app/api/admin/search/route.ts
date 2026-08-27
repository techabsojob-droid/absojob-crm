import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/mock/server";
import { jobs, candidates, clients, users, commissionLedger } from "@/lib/mock/data";

export async function GET(request: Request) {
    const user = await getSessionUser();
    if (!user || user.status !== "ACTIVE") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const q = (new URL(request.url).searchParams.get("q") ?? "").toLowerCase();
    if (q.length < 2) return NextResponse.json([]);

    const orgId = user.orgId;
    const results: { id: string; title: string; type: string; href: string }[] = [];

    for (const j of jobs.filter((j) => j.orgId === orgId)) {
        if (j.title.toLowerCase().includes(q)) {
            const base = user.role === "SUPER_ADMIN" ? "/admin/jobs" : "/ta/requisitions";
            results.push({ id: j.id, title: j.title, type: "Job", href: base });
        }
    }
    for (const c of clients.filter((c) => c.orgId === orgId)) {
        if (c.companyName.toLowerCase().includes(q)) {
            results.push({ id: c.id, title: c.companyName, type: "Client", href: "/admin/clients" });
        }
    }
    for (const c of candidates.filter((c) => c.orgId === orgId && !c.blacklisted)) {
        if (c.name.toLowerCase().includes(q)) {
            const base = user.role === "SUPER_ADMIN" ? "/admin/candidates" : user.role.startsWith("TA_") ? "/ta/candidates" : "/portal/referrals";
            results.push({ id: c.id, title: c.name, type: "Candidate", href: base });
        }
    }
    if (user.role === "SUPER_ADMIN") {
        for (const u of users.filter((u) => u.orgId === orgId)) {
            if (u.name.toLowerCase().includes(q)) {
                results.push({ id: u.id, title: u.name, type: "Team", href: "/admin/team" });
            }
        }
        for (const l of commissionLedger.filter((l) => l.orgId === orgId && l.invoiceNumber)) {
            if ((l.invoiceNumber ?? "").toLowerCase().includes(q)) {
                results.push({ id: l.id, title: `${l.invoiceNumber} — ₹${Math.abs(l.amountInr).toLocaleString("en-IN")}`, type: "Invoice", href: "/admin/finance" });
            }
        }
    }

    return NextResponse.json(results.slice(0, 8));
}
