import { NextResponse } from "next/server";
import { billingOf, balanceDue, creditStatusOf, inrOf, isOpen } from "@/lib/mock/finance";
import { requireRole } from "@/lib/mock/server";
import { getClientsFromDb, getJobsFromDb, logAudit } from "@/lib/supabase/db";
import { canAccessClient, canAccessJob, mappedClientIds, validTaManagerIds } from "@/lib/mock/pipeline";
import {
    users,
    candidates as mockCandidates,
    applications as mockApplications,
    interviews as mockInterviews,
    placements as mockPlacements,
    tasks as mockTasks,
    invoices as finInvoices,
    clientCommunications,
    addAudit,
} from "@/lib/mock/data";
import { statusOf } from "@/lib/tasks";
import { OPEN_JOB_STATUSES } from "@/lib/requisition-options";

type ClientNote = { id: string; text: string; authorName: string; authorId: string; createdAt: string };
const notesOf = (c: object) => ((c as { noteLog?: ClientNote[] }).noteLog ?? []);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clientId: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { clientId } = await params;

    // 1. Fetch Client Details
    const dbClients = await getClientsFromDb(me.orgId);
    const client = dbClients.find((c) => c.id === clientId);

    if (!client || !canAccessClient(me, client.id)) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 2. Fetch Jobs for this client (only requisitions the user may open)
    const allJobs = await getJobsFromDb(me.orgId);
    const clientJobs = allJobs.filter((j) => j.clientId === clientId && canAccessJob(me, j));
    const clientJobIds = clientJobs.map((j) => j.id);

    // 3. Applications & Candidates
    let clientApplications = mockApplications
        .filter((a) => clientJobIds.includes(a.jobId))
        .map((a) => {
            const cand = mockCandidates.find((c) => c.id === a.candidateId);
            const job = clientJobs.find((j) => j.id === a.jobId);
            return {
                id: a.id,
                candidateId: a.candidateId,
                candidateName: cand?.name || "Candidate",
                candidateEmail: cand?.email || "",
                candidatePhone: cand?.phone || "",
                candidateTitle: cand?.currentDesignation || "—",
                experience: cand?.totalExperienceYears || 0,
                skills: cand?.skills || [],
                jobId: a.jobId,
                jobTitle: job?.title || "Job Position",
                stage: a.stage,
                status: ["JOINED"].includes(a.stage) ? "JOINED" : ["REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "BLACKLISTED"].includes(a.stage) ? "CLOSED" : "IN_PROGRESS",
                matchScore: a.fitScore ?? null,
                expectedCtcLpa: cand?.expectedCtcLpa ?? null,
                ...(() => {
                    const offer = [...(cand?.offers ?? [])].reverse().find((o) => o.applicationId === a.id || o.jobId === a.jobId);
                    return { offeredCtcLpa: offer?.offeredCtcLpa ?? null, offerStatus: offer?.status ?? null, joiningDate: offer?.joiningDate ?? null };
                })(),
                appliedAt: a.createdAt,
            };
        });

    // 4. Interviews for this client
    const clientInterviews = mockInterviews
        .filter((iv) => {
            const app = mockApplications.find((a) => a.id === iv.applicationId);
            return app && clientJobIds.includes(app.jobId);
        })
        .map((iv) => {
            const app = mockApplications.find((a) => a.id === iv.applicationId);
            const cand = mockCandidates.find((c) => c.id === app?.candidateId);
            const job = clientJobs.find((j) => j.id === app?.jobId);
            return {
                ...iv,
                candidateName: cand?.name || "Candidate",
                jobTitle: job?.title || "Position",
            };
        });

    // 5. Placements for this client
    const clientPlacements = mockPlacements.filter((p) => p.clientId === clientId);

    // 6. Invoices: the Finance workspace's real invoices (amounts in INR, incl. GST)
    const clientInvoices = finInvoices
        .filter((i) => i.orgId === me.orgId && i.clientId === clientId && !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(i.status))
        .sort((x, y) => y.issueDate.localeCompare(x.issueDate));
    const sign = (i: (typeof clientInvoices)[number]) => (i.kind === "CREDIT_NOTE" ? -1 : 1);
    const invoices = clientInvoices.map((i) => ({
        id: i.invoiceNumber,
        invoiceId: i.id,
        kind: i.kind,
        jobTitle: [i.candidateName, i.jobTitle].filter(Boolean).join(" · ") || i.lineItems[0]?.description || "—",
        issueDate: i.issueDate,
        dueDate: i.dueDate,
        total: sign(i) * inrOf(i, i.total),
        balance: isOpen(i) ? inrOf(i, balanceDue(i)) : 0,
        status: i.status,
        paidAt: i.paidAt ?? null,
    }));
    const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
    const pendingReceivables = invoices.reduce((s, i) => s + i.balance, 0);
    const totalIncome = clientInvoices.reduce((s, i) => s + (i.kind === "CREDIT_NOTE" ? 0 : inrOf(i, i.amountPaid)), 0);

    // 7. Contacts: the client's primary contact plus the billing mailbox(es) from Finance
    const billing = billingOf(client);
    const contacts = [
        { id: "primary", name: client.contactPerson || "—", jobTitle: "Primary contact", email: client.contactEmail || "", phone: client.contactPhone || "", isPrimary: true },
        ...billing.billingEmails
            .filter((e) => e && e.toLowerCase() !== (client.contactEmail ?? "").toLowerCase())
            .map((e, idx) => ({ id: `billing-${idx}`, name: "Accounts / billing", jobTitle: "Invoices are emailed here", email: e, phone: "", isPrimary: false })),
    ];

    // 8. Terms & credit (from the client's billing profile and live invoices)
    const credit = creditStatusOf(me.orgId, clientId);
    const paidInvoices = clientInvoices.filter((i) => i.kind !== "CREDIT_NOTE" && i.status === "PAID" && i.paidAt);
    const paidOnTime = paidInvoices.filter((i) => i.paidAt!.slice(0, 10) <= i.dueDate).length;
    const terms = {
        feeModel: billing.feeModel,
        feePercent: billing.feePercent ?? client.commissionRate ?? null,
        flatFee: billing.flatFee ?? null,
        feeSlabs: billing.feeSlabs ?? [],
        splitOnOfferPct: billing.splitOnOfferPct,
        guaranteeDays: billing.guaranteeDays,
        creditDays: client.creditDays ?? null,
        creditLimit: credit.limit,
        outstanding: credit.outstanding,
        maxOverdueDays: credit.maxOverdue,
        onHold: credit.onHold,
        holdReasons: credit.reasons,
        gstin: billing.gstin ?? null,
        billingAddress: billing.billingAddress ?? null,
        paidInvoices: paidInvoices.length,
        paidOnTime,
    };

    // 9. Communication log (logged from Recruitment › My Clients)
    const communications = clientCommunications
        .filter((c) => c.orgId === me.orgId && c.clientId === clientId)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
        .map((c) => ({ id: c.id, type: c.channel, direction: c.direction, subject: c.subject, summary: c.body, date: c.createdAt, userName: c.byName, nextFollowUpDate: c.nextFollowUpDate ?? null }));

    // 10. Internal notes saved on the client
    const notes = [...notesOf(client)].sort((x, y) => y.createdAt.localeCompare(x.createdAt));

    // 11. Open tasks linked to this client
    const tasks = mockTasks.filter((t) => t.orgId === me.orgId && statusOf(t) !== "DONE" && t.relatedType === "CLIENT" && t.relatedId === clientId);

    const activeJobs = clientJobs.filter((j) => (OPEN_JOB_STATUSES as readonly string[]).includes(j.status));

    const accountManager = users.find((u) => u.id === client!.accountManagerId);

    return NextResponse.json({
        client: {
            ...client,
            accountManagerName: accountManager?.name ?? null,
            accountManagerDesignation: accountManager?.designation ?? null,
            accountManagerEmail: accountManager?.email ?? null,
            accountManagerPhone: accountManager?.phone ?? null,
            taManagerIds: client.taManagerIds ?? [],
            taManagers: (client.taManagerIds ?? []).map((id) => users.find((u) => u.id === id)).filter(Boolean).map((u) => ({ id: u!.id, name: u!.name })),
        },
        stats: {
            totalJobs: clientJobs.length,
            openJobs: activeJobs.length,
            totalOpenings: clientJobs.reduce((s, j) => s + (j.openings || 1), 0),
            placements: clientPlacements.length || clientApplications.filter((a) => a.stage === "JOINED").length,
            inPipeline: clientApplications.filter((a) => !["JOINED", "REJECTED"].includes(a.stage)).length,
            totalIncome,
            pendingReceivables,
            totalInvoiced,
            interviewCount: clientInterviews.length,
        },
        jobs: clientJobs.map((j) => ({
            ...j,
            inPipeline: clientApplications.filter((a) => a.jobId === j.id && !["JOINED", "REJECTED"].includes(a.stage)).length,
            placements: clientPlacements.filter((p) => p.jobId === j.id).length,
        })),
        candidates: clientApplications,
        interviews: clientInterviews,
        placements: clientPlacements,
        invoices,
        contacts,
        terms,
        communications,
        notes,
        tasks,
    });
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clientId: string }> }
) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { clientId } = await params;

    const body = await request.json();
    const dbClients = await getClientsFromDb(me.orgId);
    const client = dbClients.find((c) => c.id === clientId);
    if (!client || !mappedClientIds(me).has(client.id)) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    // Internal note: appended to the client's note log (saved to Supabase with the client)
    if (typeof body.addNote === "string") {
        const text = body.addNote.trim().slice(0, 2000);
        if (!text) return NextResponse.json({ error: "Write the note first" }, { status: 400 });
        const note: ClientNote = { id: `cnote-${crypto.randomUUID().slice(0, 8)}`, text, authorName: me.name, authorId: me.id, createdAt: new Date().toISOString() };
        (client as { noteLog?: ClientNote[] }).noteLog = [note, ...notesOf(client)];
        client.updatedAt = note.createdAt;
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "CLIENT_NOTE_ADDED", entity: "Client", entityId: client.id, detail: `${me.name} added a note on ${client.companyName}` });
        return NextResponse.json(note, { status: 201 });
    }
    if ((body.accountManagerId !== undefined || body.taManagerIds !== undefined) && me.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Only Super Admin can change who is assigned to a client" }, { status: 403 });
    }
    if (body.taManagerIds !== undefined) {
        const v = validTaManagerIds(me.orgId, body.taManagerIds);
        if (v.invalid.length) return NextResponse.json({ error: `Not an active TA Manager: ${v.invalid.join(", ")}` }, { status: 400 });
        client.taManagerIds = v.ok;
    }

    if (body.status) client.status = body.status;
    if (body.companyName) client.companyName = body.companyName;
    if (body.industry) client.industry = body.industry;
    if (body.contactPerson) client.contactPerson = body.contactPerson;
    if (body.contactEmail) client.contactEmail = body.contactEmail;
    if (body.contactPhone) client.contactPhone = body.contactPhone;
    if (body.address) client.address = body.address;
    if (body.website) client.website = body.website;
    if (body.commissionRate !== undefined) client.commissionRate = Number(body.commissionRate);
    if (body.creditDays !== undefined) client.creditDays = Number(body.creditDays);
    if (body.accountManagerId) client.accountManagerId = body.accountManagerId;
    if (body.notes !== undefined) client.notes = body.notes;
    client.updatedAt = new Date().toISOString();

    await logAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "CLIENT_UPDATED",
        entity: "Client",
        entityId: client.id,
        detail: `${me.name} updated details for client ${client.companyName}`,
    });

    return NextResponse.json(client);
}
