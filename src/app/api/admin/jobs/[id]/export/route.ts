import { NextResponse } from "next/server";
import { GET as getJobDetail } from "../route";
import { requireRole } from "@/lib/mock/server";
import { addAudit } from "@/lib/mock/data";
import { EXPORT_FORMATS, renderExport, type ExportFormat, type ExportSection } from "@/lib/export-formats";
import { stageLabel } from "@/lib/types";

// GET ?type=<section|all>&format=<csv|xlsx|pdf> : one job opening's data as a download.
// "all" = every section: one sheet each in Excel, one report in PDF (CSV holds a single table).
// Built from the job detail API, so the same access rules apply: a recruiter can
// only export openings assigned to them.

const EXPORT_TYPES = {
    summary: "Opening summary",
    candidates: "Candidates",
    interviews: "Interviews",
    offers: "Offers",
    placements: "Placements",
    tasks: "Tasks",
    activity: "Activity log",
} as const;
type ExportType = keyof typeof EXPORT_TYPES;

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from the job detail JSON */
type Row = Record<string, unknown>;

/** Columns that fit a landscape PDF page; Excel and CSV get every column. */
const PDF_COLUMNS: Partial<Record<ExportType, string[]>> = {
    candidates: ["Candidate", "Phone", "Stage", "Days in stage", "Current company", "Experience (years)", "Current CTC (LPA)", "Expected CTC (LPA)", "Notice (days)", "Location", "Recruiter", "Next follow-up"],
    interviews: ["Candidate", "Round", "Scheduled", "Mode", "Interviewer", "Status", "Outcome", "Score (1-10)"],
    activity: ["When", "Action", "Detail", "By (role)"],
};

const date = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : "");
const dateTime = (v: unknown) => {
    if (typeof v !== "string" || !v) return "";
    const d = new Date(v);
    return Number.isNaN(+d) ? v : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
};
const words = (v: unknown) => (typeof v === "string" ? v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : v ?? "");

function summaryRows(d: any): Row[] {
    const j = d.job ?? {};
    const s = d.requisitionStats ?? {};
    const pairs: [string, unknown][] = [
        ["Requisition code", j.requisitionCode],
        ["Job title", j.title],
        ["Client", j.clientName],
        ["Status", words(j.status)],
        ["Priority", words(j.priority)],
        ["Location", j.location],
        ["Employment type", words(j.employmentType)],
        ["Experience (years)", j.experienceMinYears != null ? `${j.experienceMinYears}–${j.experienceMaxYears ?? ""}` : ""],
        ["Budget (LPA)", j.salaryMinLpa != null ? `${j.salaryMinLpa}–${j.salaryMaxLpa ?? ""}` : ""],
        ["Openings", j.openings],
        ["Filled", j.filledOpenings],
        ["Remaining", j.remainingOpenings],
        ["Primary recruiter", j.primaryRecruiterName],
        ["Recruiters", (d.recruiters ?? []).map((r: any) => r.name).join("; ")],
        ["TA manager", j.taManagerName],
        ["Account manager", j.accountManagerName],
        ["Created", date(j.createdAt)],
        ["Target close date", date(j.targetCloseDate)],
        ["Days open", j.daysOpen],
        ["SLA days", j.slaDays],
        ["SLA status", words(j.calculatedSlaStatus)],
        ["Fee (% of CTC)", j.feePercent],
        ["Candidates in total", s.totalCandidates],
        ["Sourced", s.sourced],
        ["Screening", s.screening],
        ["Submitted to client", s.submittedToClient],
        ["Shortlisted", s.shortlisted],
        ["In interviews", s.interviewScheduled],
        ["Interview completed", s.interviewCompleted],
        ["Selected", s.selected],
        ["Offered", s.offered],
        ["Joined", s.joined],
        ["Rejected", s.rejected],
        ["On hold", s.onHold],
        ["Withdrawn / backed out", s.withdrawn],
        ["Exported on", dateTime(new Date().toISOString())],
    ];
    return pairs.map(([Field, Value]) => ({ Field, Value: Value ?? "" }));
}

const builders: Record<Exclude<ExportType, "summary">, (d: any) => Row[]> = {
    candidates: (d) => (d.candidates ?? []).map((a: any) => ({
        "Candidate": a.candidateName,
        "Email": a.candidateEmail,
        "Phone": a.candidatePhone,
        "Stage": stageLabel(a.stage),
        "Days in stage": a.daysInStage,
        "Current company": a.candidateCurrentCompany,
        "Headline": a.candidateHeadline,
        "Experience (years)": a.candidateTotalExp,
        "Current CTC (LPA)": a.candidateCurrentCtc,
        "Expected CTC (LPA)": a.candidateExpectedCtc,
        "Notice (days)": a.candidateNoticeDays,
        "Location": a.candidateLocation,
        "Skills": a.candidateSkills,
        "Source": words(a.candidateSource),
        "Recruiter": a.recruiterName,
        "Interviews": a.interviewsCount,
        "Calls": a.callsCount,
        "Last call": dateTime(a.lastCall?.calledAt),
        "Last call result": words(a.lastCall?.callStatus),
        "Next follow-up": date(a.lastCall?.followUpDate),
        "Rejection / hold reason": a.rejectionReason ?? a.holdReason ?? "",
        "Added": date(a.createdAt),
        "Last updated": date(a.updatedAt),
    })),
    interviews: (d) => (d.interviews ?? []).map((i: any) => ({
        "Candidate": i.candidateName,
        "Round": words(i.round),
        "Scheduled": dateTime(i.scheduledAt),
        "Duration (min)": i.durationMins,
        "Mode": words(i.mode),
        "Interviewer": i.interviewerName,
        "Status": words(i.status),
        "Outcome": words(i.outcome),
        "Score (1-10)": i.score ?? "",
        "Feedback": i.feedback ?? "",
    })),
    offers: (d) => (d.offers ?? []).map((o: any) => ({
        "Candidate": o.candidateName,
        "Status": words(o.status),
        "Offered CTC (LPA)": o.offeredSalaryLpa ?? "",
        "Offer date": date(o.offeredDate),
        "Expected joining": date(o.expectedJoiningDate),
    })),
    placements: (d) => (d.placements ?? []).map((p: any) => ({
        "Candidate": p.candidateName,
        "Client": p.clientName,
        "Recruiter": p.recruiterName ?? "",
        "Joining date": date(p.joiningDate),
        "Status": words(p.joiningStatus ?? p.status),
        "CTC (LPA)": p.offeredSalaryLpa ?? p.ctcLpa ?? "",
        "Placement fee (₹)": p.revenueInr ?? p.placementFeeInr ?? "",
        "Invoice": p.invoiceNumber ?? "",
        "Guarantee ends": date(p.guaranteeEndDate),
        "Replacement": words(p.replacementStatus),
    })),
    tasks: (d) => (d.tasks ?? []).map((t: any) => ({
        "Key": t.key ?? "",
        "Task": t.title,
        "Candidate": t.candidateName ?? "",
        "Assigned to": t.assignedToName,
        "Priority": words(t.priority),
        "Status": words(t.status ?? (t.completed ? "DONE" : "TODO")),
        "Due": date(t.dueDate),
        "Completed": date(t.completedAt),
    })),
    activity: (d) => (d.auditLogs ?? [])
        .slice()
        .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((l: any) => ({
            "When": dateTime(l.createdAt),
            "Action": words(l.action),
            "Detail": l.detail ?? "",
            "By (role)": words(l.actorRole),
        })),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const url = new URL(request.url);
    const type = (url.searchParams.get("type") ?? "") as ExportType | "all";
    const format = (url.searchParams.get("format") ?? "csv") as ExportFormat;
    if (type !== "all" && !(type in EXPORT_TYPES)) {
        return NextResponse.json({ error: `Choose what to export: all, ${Object.keys(EXPORT_TYPES).join(", ")}` }, { status: 400 });
    }
    if (!EXPORT_FORMATS.includes(format)) {
        return NextResponse.json({ error: `Format must be one of: ${EXPORT_FORMATS.join(", ")}` }, { status: 400 });
    }
    if (type === "all" && format === "csv") {
        return NextResponse.json({ error: "A CSV file holds one table. Choose Excel or PDF to export everything." }, { status: 400 });
    }

    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    // Same data and access checks as the job page itself
    const detail = await getJobDetail(request, ctx);
    if (!detail.ok) return detail;
    const data = await detail.json();
    const job = data.job ?? {};

    const keys = (type === "all" ? Object.keys(EXPORT_TYPES) : [type]) as ExportType[];
    const sections: ExportSection[] = keys.map((k) => ({
        key: k,
        title: EXPORT_TYPES[k],
        rows: k === "summary" ? summaryRows(data) : builders[k](data),
        pdfColumns: PDF_COLUMNS[k],
    }));
    if (type !== "all" && !sections[0].rows.length) {
        return NextResponse.json({ error: `No ${EXPORT_TYPES[type].toLowerCase()} to export for this opening yet` }, { status: 404 });
    }

    const what = type === "all" ? "full report" : EXPORT_TYPES[type].toLowerCase();
    const rowCount = sections.filter((x) => x.key !== "summary").reduce((n, x) => n + x.rows.length, 0);
    addAudit({
        orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
        action: "JOB_DATA_EXPORTED", entity: "JobRequisition", entityId: job.id ?? "",
        detail: `${me.name} exported ${what} as ${format.toUpperCase()} (${rowCount} rows) for ${job.requisitionCode ?? ""} ${job.title ?? ""}`.trim(),
    });

    const slug = String(job.requisitionCode || job.title || "job").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return renderExport(format, {
        title: [job.requisitionCode, job.title].filter(Boolean).join(" · ") || "Job opening",
        subtitle: `${job.clientName ?? ""}${job.clientName ? " · " : ""}${type === "all" ? "Full report" : EXPORT_TYPES[type]} · exported ${dateTime(new Date().toISOString())} IST by ${me.name}`,
        filename: `${slug}-${type === "all" ? "full-report" : type}-${today}`,
        sections,
    });
}
