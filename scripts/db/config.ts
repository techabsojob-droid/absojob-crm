// ─── Supabase schema layout ───────────────────────────────────
// Hand-maintained input for scripts/db/generate.ts. Every in-memory
// collection in src/lib/mock/data.ts maps to exactly one table here.

export const SCHEMA = "crm";

export interface DomainFile {
    file: string; // supabase/schema/<file>
    title: string;
    about: string;
    tables: string[]; // collection keys (as passed to persist("…"))
}

// Order matters: a table can only reference tables created in an earlier file.
export const DOMAINS: DomainFile[] = [
    {
        file: "01_core.sql",
        title: "Core — organizations, logins, settings",
        about: "Tenants, every staff/partner login, and per-org settings blobs.",
        tables: ["organizations", "users", "organizationSettingsSeed"],
    },
    {
        file: "02_recruitment.sql",
        title: "Recruitment — clients, jobs, candidates, pipeline",
        about: "The TA workspace: client accounts, requisitions, the candidate bank, applications moving through stages, interviews and placements.",
        tables: ["clients", "clientLeads", "clientCommunications", "jobs", "candidates", "applications", "interviews", "placements", "messageTemplates", "recruiterTargets"],
    },
    {
        file: "03_partners.sql",
        title: "Partners — field agents, referrals, commissions",
        about: "External talent partners (AGENT role): their KYC profile, referrals they submit, the referral chat thread, commission ledger and payouts.",
        tables: ["agentProfiles", "referrals", "referralMessages", "commissionLedger", "payouts", "payeeProfiles"],
    },
    {
        file: "04_hr_people.sql",
        title: "HR — employee records and lifecycle",
        about: "The HR record behind every staff login, plus onboarding, documents, assets, probation, promotions, transfers, salary revisions and exits.",
        tables: ["employees", "onboardingRecords", "documents", "assets", "probationRecords", "promotions", "transfers", "salaryRevisions", "exitRecords", "employeeRequests"],
    },
    {
        file: "05_hr_time.sql",
        title: "HR — attendance, shifts, leave, holidays",
        about: "Daily attendance, shift rosters, regularisation and WFH requests, leave requests / balances / policies and the holiday calendar.",
        tables: ["attendance", "shifts", "attendanceCorrections", "wfhRequests", "leaveRequests", "leaveBalances", "leavePolicies", "holidays"],
    },
    {
        file: "06_hr_pay_growth.sql",
        title: "HR — payroll, performance, learning, benefits",
        about: "Monthly payroll runs, reviews and review cycles, goals/OKRs, training, benefits and enrolments, tax declarations and policy acknowledgements.",
        tables: ["payrollRecords", "performanceReviews", "reviewCycles", "goals", "trainingPrograms", "benefits", "benefitEnrollments", "taxDeclarations", "hrPolicies", "policyAcknowledgements"],
    },
    {
        file: "07_finance.sql",
        title: "Finance — billing, payables, ledger",
        about: "Finance settings, invoices and receipts, recurring billing, expenses, vendors and bills, contractor assignments and timesheets, F&F, bank lines, journals and budgets.",
        tables: ["financeSettings", "invoices", "receipts", "recurringInvoices", "expenses", "vendors", "vendorBills", "contractAssignments", "timesheets", "fnfPayments", "bankStatementLines", "manualJournals", "budgets"],
    },
    {
        file: "08_workspace.sql",
        title: "Workspace — tasks, approvals, notifications, audit",
        about: "Cross-role plumbing: Jira-style tasks with comments and history, announcements, in-app notifications, approval requests, audit trail, compliance, data quality, integrations, workflow rules, outgoing email and uploaded files.",
        tables: ["tasks", "taskComments", "taskActivity", "announcements", "notifications", "approvals", "auditLogs", "complianceItems", "dataQualityIssues", "integrationServices", "workflows", "emailOutbox", "storedFiles"],
    },
];

// Collections that are not data (seed-time flags) and are never stored.
export const SKIP = ["clientBillingSeeded"];

// Table names that differ from snake_case(collection key)
export const TABLE_NAMES: Record<string, string> = {
    organizationSettingsSeed: "organization_settings",
    attendance: "attendance_records",
    documents: "employee_documents",
    assets: "employee_assets",
    benefits: "employee_benefits",
    shifts: "shift_schedules",
    workflows: "workflow_rules",
    approvals: "approval_requests",
    promotions: "promotion_records",
    transfers: "transfer_records",
    goals: "goals_okrs",
};

// Primary key when the row has no `id`
export const PRIMARY_KEYS: Record<string, string[]> = {
    financeSettings: ["orgId"],
    payeeProfiles: ["userId"],
    agentProfiles: ["userId"],
};

// Relationships. Each is only emitted if every seeded value resolves,
// so a bad hint never blocks the seed. Format: field → target collection.
export const REFERENCES: Record<string, Record<string, string>> = {
    "*": { orgId: "organizations" },
    users: { reportingTo: "users" },
    clients: { accountManagerId: "users" },
    clientLeads: { assignedToId: "users" },
    clientCommunications: { clientId: "clients" },
    jobs: { clientId: "clients" },
    candidates: { referredByUserId: "users" },
    applications: { candidateId: "candidates", jobId: "jobs", recruiterId: "users" },
    interviews: { applicationId: "applications" },
    placements: { candidateId: "candidates", jobId: "jobs", clientId: "clients" },
    recruiterTargets: { recruiterId: "users" },
    agentProfiles: { userId: "users" },
    referrals: { agentId: "users", candidateId: "candidates", jobId: "jobs" },
    referralMessages: { referralId: "referrals" },
    commissionLedger: { agentId: "users", referralId: "referrals", clientId: "clients" },
    payouts: { agentId: "users" },
    payeeProfiles: { userId: "users" },
    employees: { userId: "users", candidateId: "candidates", reportingManagerId: "employees" },
    onboardingRecords: { employeeId: "employees", candidateId: "candidates" },
    documents: { employeeId: "employees" },
    assets: { employeeId: "employees" },
    probationRecords: { employeeId: "employees" },
    promotions: { employeeId: "employees" },
    transfers: { employeeId: "employees" },
    salaryRevisions: { employeeId: "employees" },
    exitRecords: { employeeId: "employees" },
    employeeRequests: { employeeId: "employees" },
    attendance: { userId: "users" },
    shifts: { employeeId: "employees" },
    attendanceCorrections: { employeeId: "employees" },
    wfhRequests: { employeeId: "employees" },
    leaveRequests: { userId: "users" },
    leaveBalances: { employeeId: "employees" },
    payrollRecords: { employeeId: "employees" },
    performanceReviews: { employeeId: "employees" },
    goals: { employeeId: "employees" },
    benefitEnrollments: { userId: "users" },
    taxDeclarations: { userId: "users" },
    policyAcknowledgements: { userId: "users" },
    invoices: { clientId: "clients" },
    receipts: { clientId: "clients" },
    recurringInvoices: { clientId: "clients" },
    vendorBills: { vendorId: "vendors" },
    contractAssignments: { clientId: "clients", recruiterId: "users" },
    timesheets: { assignmentId: "contractAssignments" },
    tasks: { assignedToId: "users", createdById: "users" },
    taskComments: { taskId: "tasks", authorId: "users" },
    taskActivity: { taskId: "tasks", actorId: "users" },
    announcements: { createdById: "users" },
    notifications: { userId: "users" },
    storedFiles: { ownerUserId: "users" },
};

export const TABLE_COMMENTS: Record<string, string> = {
    organizations: "One row per tenant (staffing agency).",
    users: "Every login: admins, HR, finance, TA, field agents, employees. password_hash is NULL for seeded demo users (they use the demo password).",
    organizationSettingsSeed: "Agency profile and preferences, one JSON document per organization.",
    employees: "HR record behind each staff login (agents excluded). employee_id is the human code, e.g. EMP-001.",
    attendance: "One row per user per day; check_in / check_out keep the exact string the app writes.",
    tasks: "Jira-style tasks: key (ABS-12), type, status workflow, assignee, reporter (created_by_id), watchers, labels. Shown on Admin, HR, TA and Portal › Tasks.",
    taskComments: "Comments on a task. mention_ids lists users @mentioned in the body.",
    taskActivity: "Task history: creation, every field change (field / from_value / to_value) and comments.",
    notifications: "In-app bell notifications, one row per recipient.",
    auditLogs: "Append-only trail of who did what.",
};
