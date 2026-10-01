import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { employeeForUser } from "@/lib/mock/identity";
import { settingsFor } from "@/lib/mock/fin/core";
import { salaryRevisions } from "@/lib/mock/data";

// GET — my salary structure (monthly / annual) incl. employer PF and gratuity, plus revision history
export async function GET() {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const emp = employeeForUser(me.id);
    if (!emp?.salary) return NextResponse.json({ structure: null, revisions: [] });
    const cfg = settingsFor(me.orgId).payroll;
    const sal = emp.salary;
    const gross = sal.basic + sal.hra + sal.allowances;
    const employerPf = cfg.pfEnabled ? Math.round(Math.min(sal.basic, cfg.pfWageCeiling) * (cfg.pfRatePct / 100)) : 0;
    const gratuity = Math.round(sal.basic * 0.0481);
    const rows = [
        { component: "Basic", monthly: sal.basic, group: "Earnings" },
        { component: "House rent allowance", monthly: sal.hra, group: "Earnings" },
        { component: "Special allowance", monthly: sal.allowances, group: "Earnings" },
        { component: "Employer PF", monthly: employerPf, group: "Benefits" },
        { component: "Gratuity (4.81% of basic)", monthly: gratuity, group: "Benefits" },
    ].map((r) => ({ ...r, annual: r.monthly * 12 }));
    return NextResponse.json({
        structure: { rows, grossMonthly: gross, grossAnnual: gross * 12, ctcAnnual: (gross + employerPf + gratuity) * 12, recordedCtc: sal.annualCtc },
        revisions: salaryRevisions.filter((r) => r.employeeId === emp.id),
    });
}
