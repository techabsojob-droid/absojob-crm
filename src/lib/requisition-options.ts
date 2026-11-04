// ─── Requisition form options (shared by the wizard UI and server validation) ──

type Opt<T extends string = string> = readonly (readonly [T, string])[];

export const JOB_CATEGORIES = [
    ["INFORMATION_TECHNOLOGY", "Information Technology"], ["SOFTWARE_DEVELOPMENT", "Software Development"], ["FINANCE_ACCOUNTING", "Finance & Accounting"],
    ["HUMAN_RESOURCES", "Human Resources"], ["SALES_MARKETING", "Sales & Marketing"], ["OPERATIONS", "Operations"], ["CUSTOMER_SUPPORT", "Customer Support"],
    ["ENGINEERING", "Engineering"], ["ADMINISTRATION", "Administration"], ["OTHER", "Other"],
] as const satisfies Opt;

export const EMPLOYMENT_TYPES = [
    ["FULL_TIME", "Full-time"], ["PART_TIME", "Part-time"], ["CONTRACT", "Contract"], ["PERMANENT", "Permanent"], ["INTERNSHIP", "Internship"], ["FREELANCE", "Freelance"],
] as const satisfies Opt;
/** Older records may still carry these; they stay valid on edit. */
export const LEGACY_EMPLOYMENT_TYPES = ["REMOTE", "HYBRID", "TEMPORARY", "CONSULTANT"] as const;

export const REQUISITION_TYPES = [["NEW_POSITION", "New Position"], ["REPLACEMENT", "Replacement"], ["BACKFILL", "Backfill"], ["PROJECT_BASED", "Project-based Hiring"]] as const satisfies Opt;

export const PRIORITIES = [["URGENT", "Critical"], ["HIGH", "High"], ["MEDIUM", "Medium"], ["LOW", "Low"]] as const satisfies Opt;

export const SALARY_TYPES = [["ANNUAL_CTC", "Annual CTC"], ["MONTHLY", "Monthly Salary"], ["HOURLY", "Hourly Rate"]] as const satisfies Opt;

export const NOTICE_PERIODS = ["Immediate", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days", "Negotiable"] as const;
export const JOINING_TIMELINES = ["Immediate", "Within 15 Days", "Within 30 Days", "Within 45 Days", "Within 60 Days", "Flexible"] as const;

export const QUALIFICATIONS = [
    "Not required", "10th Pass", "12th Pass", "Diploma", "Any Graduate", "B.E. / B.Tech", "BCA", "B.Com", "B.Sc", "BBA", "B.A.",
    "Any Post Graduate", "M.E. / M.Tech", "MCA", "MBA / PGDM", "M.Com", "M.Sc", "M.A.", "CA / CS / CMA", "LLB / LLM", "PhD",
] as const;

export const WORK_MODES = [["ONSITE", "Work From Office"], ["WFH", "Work From Home"], ["HYBRID", "Hybrid"], ["REMOTE", "Remote"]] as const satisfies Opt;

export const HIRING_REASONS = [
    ["BUSINESS_EXPANSION", "Business Expansion"], ["EMPLOYEE_REPLACEMENT", "Employee Replacement"], ["NEW_PROJECT", "New Project"],
    ["ADDITIONAL_HEADCOUNT", "Additional Headcount"], ["URGENT_REQUIREMENT", "Urgent Business Requirement"], ["OTHER", "Other"],
] as const satisfies Opt;

export const BILLING_TYPES = [["PERCENTAGE", "Percentage Based"], ["FIXED_FEE", "Fixed Fee"], ["HOURLY", "Hourly"], ["MONTHLY_CONTRACT", "Monthly Contract"]] as const satisfies Opt;
export const CONTRACT_TYPES = [
    ["PERMANENT_PLACEMENT", "Permanent Placement"], ["CONTRACT_STAFFING", "Contract Staffing"], ["TEMPORARY_STAFFING", "Temporary Staffing"], ["RPO", "RPO"], ["OTHER", "Other"],
] as const satisfies Opt;

export const DEFAULT_DEPARTMENTS = [
    "Engineering", "Product", "Design", "Data & Analytics", "Quality Assurance", "DevOps & Cloud", "IT Infrastructure", "Information Security",
    "Sales", "Marketing", "Business Development", "Customer Support", "Operations", "Supply Chain & Logistics", "Finance & Accounts",
    "Human Resources", "Administration", "Legal & Compliance", "Manufacturing", "Healthcare", "Research & Development", "General",
] as const;

export const DEFAULT_INTERVIEW_ROUNDS = ["HR Screening", "Technical Round 1", "Technical Round 2", "Managerial Round", "Client Interview", "HR Discussion", "Final Offer"] as const;

/** Client-facing requisition status; the internal pipeline states are grouped under "Open". */
export const OPEN_JOB_STATUSES = ["APPROVED", "SOURCING", "SCREENING", "CLIENT_REVIEW", "INTERVIEWING", "OFFER_STAGE", "JOINING"] as const;
export function requisitionStatusLabel(status: string): string {
    if ((OPEN_JOB_STATUSES as readonly string[]).includes(status)) return "Open";
    return ({ DRAFT: "Draft", PENDING_APPROVAL: "Pending Approval", ON_HOLD: "On Hold", FULFILLED: "Closed", CLOSED: "Closed", CANCELLED: "Cancelled" } as Record<string, string>)[status] ?? status;
}
export const REQUISITION_STATUS_FILTERS = [["DRAFT", "Draft"], ["PENDING_APPROVAL", "Pending Approval"], ["OPEN", "Open"], ["ON_HOLD", "On Hold"], ["CLOSED", "Closed"], ["CANCELLED", "Cancelled"]] as const;
export function matchesStatusFilter(status: string, filter: string): boolean {
    if (filter === "OPEN") return (OPEN_JOB_STATUSES as readonly string[]).includes(status);
    if (filter === "CLOSED") return status === "CLOSED" || status === "FULFILLED";
    return status === filter;
}

export const optLabel = (list: Opt, v: string | null | undefined) => list.find(([k]) => k === v)?.[1] ?? (v ? v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "");
export const keys = <T extends string>(list: readonly (readonly [T, string])[]) => list.map(([k]) => k);

/** Salary entered in the chosen unit → LPA, which the rest of the CRM (fit scores, CTC filters) uses. */
export function toLpa(amount: number, type: string): number {
    if (type === "MONTHLY") return Math.round(((amount * 12) / 100000) * 100) / 100;
    if (type === "HOURLY") return Math.round(((amount * 176 * 12) / 100000) * 100) / 100; // 8 h × 22 days
    return amount;
}
export const salaryUnit = (type: string) => (type === "MONTHLY" ? "₹ / month" : type === "HOURLY" ? "₹ / hour" : "LPA");
