import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { attendance, employees, exitRecords, leaveBalances, payrollRecords, performanceReviews, users, addAudit } from "@/lib/mock/data";
import { csvDownload } from "@/lib/csv";

const REPORTS: Record<string, string> = {
    "rpt-1": "employee-master",
    "rpt-2": "attendance-log",
    "rpt-3": "payroll-register",
    "rpt-4": "leave-balances",
    "rpt-5": "performance-appraisals",
    "rpt-6": "attrition-audit",
};

// GET /api/hr/reports/export?report=rpt-1 — CSV built from live HR records
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const id = new URL(request.url).searchParams.get("report") ?? "";
    const name = REPORTS[id];
    if (!name) return NextResponse.json({ error: "Unknown report" }, { status: 400 });

    const org = <T extends { orgId: string }>(list: T[]) => list.filter((x) => x.orgId === me.orgId);
    const today = new Date().toISOString().slice(0, 10);
    let rows: Record<string, unknown>[] = [];

    if (id === "rpt-1") {
        rows = org(employees).map((e) => ({
            "Employee ID": e.employeeId, Name: e.name, Email: e.email, Phone: e.phone, Department: e.department, Designation: e.designation,
            Manager: e.reportingManagerName ?? "", "Joining Date": e.joiningDate, "Employment Type": e.employmentType, Status: e.status,
            Location: e.location ?? "", "Work Mode": e.workMode ?? "", Probation: e.probationStatus ?? "", "Annual CTC": e.salary?.annualCtc ?? "",
        }));
    } else if (id === "rpt-2") {
        rows = org(attendance)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((a) => {
                const u = users.find((x) => x.id === a.userId);
                return { Date: a.date, Employee: u?.name ?? a.userId, Department: u?.department ?? "", Status: a.status, Mode: a.mode ?? "", "Check In": a.checkIn ?? "", "Check Out": a.checkOut ?? "", "Late By (min)": a.lateByMinutes ?? 0 };
            });
    } else if (id === "rpt-3") {
        const months = [...new Set(org(payrollRecords).map((p) => p.month))].sort();
        const month = months.at(-1);
        rows = org(payrollRecords).filter((p) => p.month === month).map((p) => ({
            Month: p.month, "Employee ID": p.employeeCode, Name: p.employeeName, Department: p.department, Basic: p.basicSalary, HRA: p.hra,
            Allowances: p.allowances, Bonuses: p.bonuses, Overtime: p.overtime, PF: p.pf ?? 0, ESI: p.esi ?? 0, Tax: p.tax, Deductions: p.deductions,
            "Net Salary": p.netSalary, Status: p.status, "Paid On": p.paymentDate ?? "",
        }));
    } else if (id === "rpt-4") {
        rows = org(leaveBalances).map((b) => ({
            Employee: b.employeeName, Department: b.department,
            "Casual (used/allowed)": `${b.casualUsed}/${b.casualAllowance}`, "Sick (used/allowed)": `${b.sickUsed}/${b.sickAllowance}`,
            "Earned (used/allowed)": `${b.earnedUsed}/${b.earnedAllowance}`, "Carry Forward": b.carryForward,
            "Total Available": b.casualAllowance - b.casualUsed + b.sickAllowance - b.sickUsed + b.earnedAllowance - b.earnedUsed + b.carryForward,
        }));
    } else if (id === "rpt-5") {
        rows = org(performanceReviews).map((r) => ({
            Employee: r.employeeName, Department: r.department, Cycle: r.reviewCycle, Rating: r.rating ?? "", Status: r.status,
            "Goals Met": `${r.goals.filter((g) => g.progress >= 100).length}/${r.goals.length}`,
            "Promotion Recommended": r.promotionRecommended ? "Yes" : "No", "Increment %": r.incrementPercent ?? "", "Manager Feedback": r.managerFeedback ?? "",
        }));
    } else if (id === "rpt-6") {
        rows = org(exitRecords).map((x) => ({
            Employee: x.employeeName, Department: x.department, "Resignation Date": x.resignationDate, "Notice (days)": x.noticePeriodDays,
            "Last Working Day": x.lastWorkingDay, Reason: x.reason, Status: x.status, "F&F Settled": x.fnfSettled ? "Yes" : "No",
            "F&F Amount": x.fnfAmountInr ?? "", "Experience Letter": x.experienceLetterIssued ? "Issued" : "Pending",
        }));
    }

    if (!rows.length) rows = [{ Note: "No records for this report yet" }];
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "REPORT_EXPORTED", entity: "Report", entityId: id, detail: `${name} (${rows.length} rows)` });
    return csvDownload(rows, `${name}-${today}.csv`);
}
