import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { payrollRecords } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { fyOf, fyRange, settingsFor } from "@/lib/mock/fin/core";

// GET — one of my payslips with statutory breakdown, employer details and financial-year-to-date totals
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const emp = employeeForUser(me.id);
    const p = payrollRecords.find((x) => x.id === id && x.orgId === me.orgId);
    if (!p || !emp || p.employeeId !== emp.id || p.status === "DRAFT") return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    const s = settingsFor(me.orgId);
    const fy = fyOf(`${p.month}-01`);
    const { from } = fyRange(fy);
    const ytdRecs = payrollRecords.filter((x) => x.employeeId === emp.id && x.status !== "DRAFT" && `${x.month}-01` >= from && x.month <= p.month);
    const gross = (x: typeof p) => x.basicSalary + x.hra + x.allowances + x.bonuses + x.overtime;
    const ytd = {
        gross: ytdRecs.reduce((t, x) => t + gross(x) - (x.lopAmount ?? 0), 0),
        pf: ytdRecs.reduce((t, x) => t + (x.pf ?? 0), 0),
        pt: ytdRecs.reduce((t, x) => t + (x.pt ?? 0), 0),
        tds: ytdRecs.reduce((t, x) => t + x.tax, 0),
        net: ytdRecs.reduce((t, x) => t + x.netSalary, 0),
    };
    const earnings = [["Basic", p.basicSalary], ["HRA", p.hra], ["Special allowance", p.allowances], ["Bonus", p.bonuses], ["Overtime", p.overtime]].filter(([, v]) => Number(v) > 0);
    const statutory = (p.pf ?? 0) + (p.esi ?? 0) + (p.pt ?? 0) + (p.lopAmount ?? 0);
    const other = Math.max(0, p.deductions - statutory);
    const deductions = [["Provident fund (employee)", p.pf ?? 0], ["ESI (employee)", p.esi ?? 0], ["Professional tax", p.pt ?? 0], [`Loss of pay (${p.lopDays ?? 0} day(s))`, p.lopAmount ?? 0], ["Other deductions", other], ["Income tax (TDS)", p.tax]].filter(([, v]) => Number(v) > 0);
    return NextResponse.json({
        id: p.id, month: p.month, status: p.status, paymentDate: p.paymentDate ?? null, paymentMethod: p.paymentMethod ?? null, onHold: !!p.onHold,
        employer: { name: s.companyLegalName, address: s.companyAddress, pan: s.companyPan },
        employee: { name: emp.name, code: emp.employeeId, designation: emp.designation, department: emp.department, joiningDate: emp.joiningDate, pan: emp.bankDetails?.panNumber ?? null, bank: emp.bankDetails?.bankName ?? null, account: emp.bankDetails?.accountNumber ? `XXXX${emp.bankDetails.accountNumber.slice(-4)}` : null, location: emp.location ?? null },
        earnings, deductions,
        grossEarnings: gross(p), totalDeductions: p.deductions + p.tax, netPay: p.netSalary,
        employerContributions: [["Employer PF", p.employerPf ?? 0], ["Employer ESI", p.employerEsi ?? 0]].filter(([, v]) => Number(v) > 0),
        ytd: { fy, ...ytd },
    });
}
