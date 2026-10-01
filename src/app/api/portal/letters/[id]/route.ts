import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { employeeRequests, employees, exitRecords, organizationSettingsSeed } from "@/lib/mock/data";
import { employeeForUser } from "@/lib/mock/identity";
import { settingsFor } from "@/lib/mock/fin/core";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const long = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// GET — printable letter for an approved salary certificate / experience letter request, or an exit experience letter
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const isHR = ["SUPER_ADMIN", "HR_ADMIN"].includes(me.role);
    const req = employeeRequests.find((r) => r.id === id && r.orgId === me.orgId);
    const exit = !req ? exitRecords.find((x) => x.id === id && x.orgId === me.orgId) : undefined;
    const emp = employees.find((e) => e.id === (req?.employeeId ?? exit?.employeeId));
    if (!emp || (!isHR && employeeForUser(me.id)?.id !== emp.id)) return NextResponse.json({ error: "Letter not found" }, { status: 404 });
    if (req && (req.status !== "APPROVED" || !["SALARY_CERTIFICATE", "EXPERIENCE_LETTER"].includes(req.type))) return NextResponse.json({ error: "This letter is not approved yet" }, { status: 409 });
    if (exit && !exit.experienceLetterIssued) return NextResponse.json({ error: "Experience letter not issued yet" }, { status: 409 });

    const s = settingsFor(me.orgId);
    const org = organizationSettingsSeed[me.orgId] ?? {};
    const pronoun = emp.gender === "FEMALE" ? ["She", "her"] : emp.gender === "MALE" ? ["He", "his"] : ["They", "their"];
    const issuedOn = (req?.reviewedAt ?? new Date().toISOString()).slice(0, 10);
    const exited = exit ?? exitRecords.find((x) => x.employeeId === emp.id && ["SETTLED", "COMPLETED"].includes(x.status));
    let title: string, paragraphs: string[];
    if (req?.type === "SALARY_CERTIFICATE") {
        const sal = emp.salary;
        title = "Salary Certificate";
        paragraphs = [
            `This is to certify that ${emp.name} (Employee Code ${emp.employeeId}) is employed with ${s.companyLegalName} as ${emp.designation} in the ${emp.department} department since ${long(emp.joiningDate)}.`,
            sal ? `${pronoun[0]} current gross monthly salary is ${inr(sal.basic + sal.hra + sal.allowances)} (Basic ${inr(sal.basic)}, HRA ${inr(sal.hra)}, Special allowance ${inr(sal.allowances)}), and ${pronoun[1]} annual cost to company is ${inr(sal.annualCtc)}.` : "",
            `This certificate is issued at ${pronoun[1]} request${req.description ? ` for the purpose of ${req.description.replace(/\.$/, "")}` : ""}.`,
        ].filter(Boolean);
    } else if (exited) {
        title = "Experience Letter";
        paragraphs = [
            `This is to certify that ${emp.name} (Employee Code ${emp.employeeId}) was employed with ${s.companyLegalName} from ${long(emp.joiningDate)} to ${long(exited.lastWorkingDay)}.`,
            `At the time of leaving, ${pronoun[1]} designation was ${emp.designation} in the ${emp.department} department.`,
            `During ${pronoun[1]} tenure we found ${pronoun[1] === "their" ? "them" : pronoun[1] === "his" ? "him" : "her"} sincere and hardworking. We wish ${pronoun[1] === "their" ? "them" : pronoun[1] === "his" ? "him" : "her"} every success in future endeavours.`,
        ];
    } else {
        title = "Employment Certificate";
        paragraphs = [
            `This is to certify that ${emp.name} (Employee Code ${emp.employeeId}) has been working with ${s.companyLegalName} since ${long(emp.joiningDate)} and currently holds the position of ${emp.designation} in the ${emp.department} department.`,
            `This certificate is issued at ${pronoun[1]} request${req?.description ? ` for ${req.description.replace(/\.$/, "")}` : ""}.`,
        ];
    }
    return NextResponse.json({
        reference: `${(org.agencyName ?? "HR").split(" ")[0].toUpperCase()}/HR/${issuedOn.slice(0, 4)}/${id.slice(-6).toUpperCase()}`,
        issuedOn, title, addressee: "To whom it may concern", paragraphs,
        company: { name: s.companyLegalName, address: s.companyAddress, gstin: s.companyGstin },
        signatory: { name: req?.reviewedByName ?? "Human Resources", designation: "Human Resources" },
    });
}
