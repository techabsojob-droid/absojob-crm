// ─── AbsoJob CRM — In-memory mock database (multi-tenant) ─────
// Swappable with Prisma later: API routes only touch this module.

import type {
  Holiday, PolicyAcknowledgement, BenefitEnrollment, TaxDeclaration,
  Organization, User, Client, JobRequisition, Candidate, CandidateSource, Application,
  Interview, Referral, CommissionLedgerEntry, Payout, AttendanceRecord,
  LeaveRequest, Task, TaskComment, TaskActivity, Announcement, AuditLog, Notification,
  Employee, OnboardingRecord, PayrollRecord, PerformanceReview,
  AssetRecord, TrainingProgram, ExitRecord, DocumentRecord,
  PlacementRecord, ClientLead, ApprovalRequest, ComplianceItem, DataQualityIssue, IntegrationService,
  EmployeeRequest, ProbationRecord, PromotionRecord, TransferRecord, SalaryRevisionRecord, ShiftSchedule,
  AttendanceCorrectionRecord, WfhRecord, LeaveBalanceRecord, LeavePolicyConfig, GoalOkr, ReviewCycle,
  EmployeeBenefit, HrPolicyItem, WorkflowAutomationRule,
  Invoice, Expense, FinanceSettings, Receipt, RecurringInvoice, Vendor, VendorBill, ContractAssignment, Timesheet,
  FnfPayment, PayeeProfile, BankStatementLine, ManualJournal, Budget, EmailMessage, StoredFile,
  AgentProfile, ReferralMessage, MessageTemplate, ClientCommunication, RecruiterTarget,
} from "@/lib/types";

import { attachStore } from "@/lib/db/sync";

export { ACTIVE_STAGES, STAGE_ORDER } from "@/lib/types";


// ─── Process-wide store ───────────────────────────────────────
// Next.js can evaluate this module more than once (per route bundle / after
// hot reload). Keeping every collection on globalThis guarantees all routes,
// the proxy and helpers read and write the same data.
// With Supabase enabled (default) these collections are a cache: src/lib/db/sync.ts
// replaces their contents with the crm schema's rows and saves every change back.
// The seed below is only used for `npm run db:generate` and CRM_DATA_SOURCE=mock.
// Bump the version when seed data changes so a running dev server re-seeds
const STORE_KEY = "__absojobMockStore_v26__";
const store: Record<string, unknown> = ((globalThis as Record<string, unknown>)[STORE_KEY] ??= {}) as Record<string, unknown>;
function persist<T>(key: string, init: () => T): T {
  if (!(key in store)) store[key] = init();
  return store[key] as T;
}
attachStore(store);

// ─── Session helpers ──────────────────────────────────────────

export const MOCK_PASSWORD = "demo123";
export const SESSION_COOKIE = "absojob_session";

// ─── Date helpers ─────────────────────────────────────────────

const now = new Date();
const daysAgo = (d: number, hoursOffset = 0) =>
  new Date(now.getTime() - d * 86400000 + hoursOffset * 3600000).toISOString();
const daysAhead = (d: number, hour = 10, min = 0) => {
  const dt = new Date(now.getTime() + d * 86400000);
  dt.setHours(hour, min, 0, 0);
  return dt.toISOString();
};
const dateOnly = (offset = 0) =>
  new Date(now.getTime() + offset * 86400000).toISOString().split("T")[0];
export const todayStr = now.toISOString().split("T")[0];

// ─── Organizations ────────────────────────────────────────────

export const organizations: Organization[] = persist("organizations", () => ([
  { id: "org-1", name: "AbsoJob Staffing", slug: "absojob", plan: "GROWTH", status: "ACTIVE", industry: "IT & Tech Staffing", logoUrl: null, createdAt: daysAgo(500) },
  { id: "org-2", name: "PrimeHire Solutions", slug: "primehire", plan: "STARTER", status: "ACTIVE", industry: "BPO & Support Staffing", logoUrl: null, createdAt: daysAgo(180) },
]));

const ORG_1 = "org-1";

// ─── Users ────────────────────────────────────────────────────

export const users: User[] = persist("users", () => ([
  // Org 1
  { id: "usr-sa", orgId: ORG_1, name: "Aarav Mehta", email: "admin@absojob.com", phone: "+91 98200 11223", role: "SUPER_ADMIN", status: "ACTIVE", avatarUrl: null, department: "Leadership", designation: "Founder & CEO", location: "Mumbai", reportingTo: null, joinedAt: daysAgo(500), deactivatedAt: null },
  { id: "usr-fin1", orgId: ORG_1, name: "Rohit Bansal", email: "finance@absojob.com", phone: "+91 98111 44556", role: "FINANCE_ADMIN", status: "ACTIVE", avatarUrl: null, department: "Finance", designation: "Finance Manager", location: "Mumbai", reportingTo: "usr-sa", joinedAt: daysAgo(330), deactivatedAt: null },
  { id: "usr-hr1", orgId: ORG_1, name: "Ananya Sen", email: "hr@absojob.com", phone: "+91 98111 99887", role: "HR_ADMIN", status: "ACTIVE", avatarUrl: null, department: "Human Resources", designation: "HR Lead / People Ops", location: "Mumbai", reportingTo: "usr-sa", joinedAt: daysAgo(350), deactivatedAt: null },
  { id: "usr-tam", orgId: ORG_1, name: "Neha Kulkarni", email: "neha@absojob.com", phone: "+91 98111 22334", role: "TA_MANAGER", status: "ACTIVE", avatarUrl: null, department: "Talent Acquisition", designation: "TA Manager", location: "Mumbai", reportingTo: "usr-sa", joinedAt: daysAgo(420), deactivatedAt: null },
  { id: "usr-ta1", orgId: ORG_1, name: "Rahul Sharma", email: "rahul.ta@absojob.com", phone: "+91 98222 33445", role: "TA_RECRUITER", status: "ACTIVE", avatarUrl: null, department: "Talent Acquisition", designation: "Senior Recruiter", location: "Mumbai", reportingTo: "usr-tam", joinedAt: daysAgo(300), deactivatedAt: null },
  { id: "usr-ta2", orgId: ORG_1, name: "Priya Iyer", email: "priya.ta@absojob.com", phone: "+91 98333 44556", role: "TA_RECRUITER", status: "ACTIVE", avatarUrl: null, department: "Talent Acquisition", designation: "Recruiter", location: "Pune", reportingTo: "usr-tam", joinedAt: daysAgo(210), deactivatedAt: null },
  { id: "usr-ag1", orgId: ORG_1, name: "Vikram Singh", email: "vikram@absojob.com", phone: "+91 98444 55667", role: "AGENT", status: "ACTIVE", avatarUrl: null, department: "Field", designation: "Senior Talent Partner", location: "Bandra West, Mumbai", reportingTo: "usr-tam", joinedAt: daysAgo(280), deactivatedAt: null },
  { id: "usr-ag2", orgId: ORG_1, name: "Sneha Patil", email: "sneha@absojob.com", phone: "+91 98555 66778", role: "AGENT", status: "ACTIVE", avatarUrl: null, department: "Field", designation: "Talent Partner", location: "Andheri West, Mumbai", reportingTo: "usr-tam", joinedAt: daysAgo(190), deactivatedAt: null },
  { id: "usr-ag3", orgId: ORG_1, name: "Rohan Kapoor", email: "rohan@absojob.com", phone: "+91 98666 77889", role: "AGENT", status: "SUSPENDED", avatarUrl: null, department: "Field", designation: "Talent Partner", location: "Powai, Mumbai", reportingTo: "usr-tam", joinedAt: daysAgo(150), deactivatedAt: null },
  { id: "usr-em1", orgId: ORG_1, name: "Kavya Nair", email: "kavya@absojob.com", phone: "+91 98777 88990", role: "EMPLOYEE", status: "ACTIVE", avatarUrl: null, department: "Operations", designation: "Ops Executive", location: "Mumbai", reportingTo: "usr-sa", joinedAt: daysAgo(160), deactivatedAt: null },
  { id: "usr-em2", orgId: ORG_1, name: "Arjun Desai", email: "arjun@absojob.com", phone: "+91 98888 99001", role: "EMPLOYEE", status: "EXITED", avatarUrl: null, department: "Finance", designation: "Accounts Associate", location: "Mumbai", reportingTo: "usr-sa", joinedAt: daysAgo(480), deactivatedAt: daysAgo(40) },
  // Org 2 (proves multi-tenancy)
  { id: "org2-sa", orgId: "org-2", name: "Meera Joshi", email: "meera@primehire.com", phone: "+91 97000 11001", role: "SUPER_ADMIN", status: "ACTIVE", avatarUrl: null, department: "Leadership", designation: "Director", location: "Delhi", reportingTo: null, joinedAt: daysAgo(180), deactivatedAt: null },
]));

export function userById(id: string | null | undefined): User | undefined {
  if (!id) return undefined;
  return users.find((u) => u.id === id);
}

export function userName(id: string | null | undefined): string {
  return userById(id)?.name ?? "—";
}

// ─── Clients ──────────────────────────────────────────────────

export const clients: Client[] = persist("clients", () => ([
  { id: "cl-1", orgId: ORG_1, companyName: "TechNova Systems", industry: "IT Services", website: "https://technova.io", contactPerson: "Deepak Rao", contactEmail: "deepak.rao@technova.io", contactPhone: "+91 90011 22001", address: "Powai, Mumbai", status: "ACTIVE", agreementUrl: null, commissionRate: 8.33, creditDays: 30, accountManagerId: "usr-tam", estimatedValue: "₹42L", notes: "Premium client — fast turnaround expected.", createdAt: daysAgo(300), updatedAt: daysAgo(5) },
  { id: "cl-2", orgId: ORG_1, companyName: "FinEdge Capital", industry: "Fintech", website: "https://finedge.in", contactPerson: "Shalini Gupta", contactEmail: "shalini@finedge.in", contactPhone: "+91 90022 33002", address: "Lower Parel, Mumbai", status: "ACTIVE", agreementUrl: null, commissionRate: 10, creditDays: 45, accountManagerId: "usr-tam", estimatedValue: "₹28L", notes: null, createdAt: daysAgo(210), updatedAt: daysAgo(12) },
  { id: "cl-3", orgId: ORG_1, companyName: "MediCare Plus", industry: "Healthcare", website: null, contactPerson: "Dr. Imran Khan", contactEmail: "imran@medicareplus.co", contactPhone: "+91 90033 44003", address: "Bandra East, Mumbai", status: "ONBOARDING", agreementUrl: null, commissionRate: 12, creditDays: 30, accountManagerId: "usr-ta1", estimatedValue: "₹15L", notes: "Agreement under legal review.", createdAt: daysAgo(20), updatedAt: daysAgo(2) },
  { id: "cl-4", orgId: ORG_1, companyName: "RetailMart India", industry: "E-commerce", website: "https://retailmart.in", contactPerson: "Pooja Rathi", contactEmail: "pooja@retailmart.in", contactPhone: "+91 90044 55004", address: "Andheri East, Mumbai", status: "ACTIVE", agreementUrl: null, commissionRate: 8, creditDays: 60, accountManagerId: "usr-ta2", estimatedValue: "₹35L", notes: null, createdAt: daysAgo(150), updatedAt: daysAgo(8) },
  { id: "cl-5", orgId: ORG_1, companyName: "CloudLeap Technologies", industry: "SaaS", website: null, contactPerson: "Farhan Ali", contactEmail: "farhan@cloudleap.dev", contactPhone: "+91 90055 66005", address: "Pune", status: "PROSPECT", agreementUrl: null, commissionRate: 10, creditDays: 30, accountManagerId: "usr-ta2", estimatedValue: "₹18L", notes: "First meeting done, proposal sent.", createdAt: daysAgo(9), updatedAt: daysAgo(1) },
  { id: "cl-6", orgId: ORG_1, companyName: "LogiSwift Logistics", industry: "Logistics", website: null, contactPerson: "Sanjay Menon", contactEmail: "sanjay@logiswift.com", contactPhone: "+91 90066 77006", address: "Navi Mumbai", status: "PAUSED", agreementUrl: null, commissionRate: 9, creditDays: 45, accountManagerId: "usr-ta1", estimatedValue: "₹10L", notes: "Hiring freeze until next quarter.", createdAt: daysAgo(260), updatedAt: daysAgo(30) },
  // Org 2
  { id: "org2-cl-1", orgId: "org-2", companyName: "Delhi BPO Hub", industry: "BPO", website: null, contactPerson: "Anil Bansal", contactEmail: "anil@delhibpo.com", contactPhone: "+91 98000 10001", address: "Noida", status: "ACTIVE", agreementUrl: null, commissionRate: 7, creditDays: 30, accountManagerId: "org2-sa", estimatedValue: "₹12L", notes: null, createdAt: daysAgo(120), updatedAt: daysAgo(4) },
]));

// ─── Job Requisitions ─────────────────────────────────────────

export const jobs: JobRequisition[] = persist("jobs", () => ([
  {
    id: "job-101",
    orgId: ORG_1,
    clientId: "cl-1",
    title: "Senior Backend Engineer (Node.js)",
    department: "Engineering",
    location: "Powai, Mumbai",
    workMode: "HYBRID",
    city: "Mumbai",
    country: "India",
    employmentType: "FULL_TIME",
    priority: "URGENT",
    priorityReason: "Business Critical — core payment gateway migration",
    openings: 3,
    filled: 1,
    salaryMinLpa: 18,
    salaryMaxLpa: 28,
    salaryCurrency: "INR",
    fixedSalaryLpa: 22,
    variableSalaryLpa: 4,
    bonusDetails: "10% performance bonus + retention incentive",
    benefits: "Comprehensive health insurance, flexible hybrid policy, learning stipend",
    experienceMinYears: 4,
    experienceMaxYears: 8,
    skills: ["Node.js", "PostgreSQL", "AWS", "Microservices"],
    preferredSkills: ["Redis", "Kafka", "Docker", "Kubernetes"],
    education: "B.Tech / B.E. / M.Tech in Computer Science or equivalent",
    certifications: ["AWS Certified Developer", "AWS Solutions Architect"],
    languages: ["English", "Hindi"],
    noticePeriodPreference: "Immediate to 30 Days",
    description: "Own backend services for payments platform. Strong system design, database tuning and microservices experience needed.",
    aboutCompany: "TechNova Solutions is a Tier-1 Fintech powerhouse serving 10M+ daily transactions.",
    responsibilities: "Architect fault-tolerant APIs, scale payment distributed queues, mentor junior engineers.",
    status: "INTERVIEWING",
    requestedById: "usr-tam",
    approvedById: "usr-sa",
    assignedTas: ["usr-ta1", "usr-ta2"],
    primaryRecruiterId: "usr-ta1",
    taManagerId: "usr-tam",
    accountManagerId: "usr-sa",
    targetCloseDate: daysAhead(21),
    targetJoiningDate: daysAhead(45),
    slaDays: 30,
    sla: {
      slaDays: 30,
      slaStartDate: daysAgo(45),
      targetShortlistDate: daysAgo(38),
      targetInterviewDate: daysAgo(25),
      targetOfferDate: daysAhead(10),
      targetJoiningDate: daysAhead(35),
      status: "AT_RISK"
    },
    tags: ["Urgent", "Leadership", "VIP Client"],
    openingsList: [
      { id: "opn-101-1", openingNumber: 1, status: "FILLED", assignedCandidateId: "cand-010", assignedCandidateName: "Pooja Hegde", targetJoiningDate: daysAgo(10), actualJoiningDate: daysAgo(5), notes: "Successfully onboarded" },
      { id: "opn-101-2", openingNumber: 2, status: "INTERVIEWING", assignedCandidateId: "cand-001", assignedCandidateName: "Amit Verma", targetJoiningDate: daysAhead(25), notes: "Client round interview completed" },
      { id: "opn-101-3", openingNumber: 3, status: "SOURCING", notes: "Shortlisting candidate profiles" }
    ],
    requirementVersions: [
      { version: 1, openings: 2, salaryMinLpa: 16, salaryMaxLpa: 24, experienceMinYears: 4, experienceMaxYears: 7, skills: ["Node.js", "PostgreSQL"], location: "Powai, Mumbai", workMode: "HYBRID", changedById: "usr-tam", changedByName: "Amit Joshi", changedAt: daysAgo(45), changeSummary: "Initial requisition created" },
      { version: 2, openings: 3, salaryMinLpa: 18, salaryMaxLpa: 28, experienceMinYears: 4, experienceMaxYears: 8, skills: ["Node.js", "PostgreSQL", "AWS", "Microservices"], location: "Powai, Mumbai", workMode: "HYBRID", changedById: "usr-sa", changedByName: "Super Admin", changedAt: daysAgo(20), changeSummary: "Increased openings to 3 and raised budget band to attract senior talent" }
    ],
    assignmentHistory: [
      { id: "asg-1", recruiterId: "usr-ta1", recruiterName: "Neha Sharma", role: "PRIMARY_RECRUITER", assignedById: "usr-tam", assignedByName: "Amit Joshi", assignedAt: daysAgo(44), active: true },
      { id: "asg-2", recruiterId: "usr-ta2", recruiterName: "Rahul Saxena", role: "SECONDARY_RECRUITER", assignedById: "usr-tam", assignedByName: "Amit Joshi", assignedAt: daysAgo(30), active: true }
    ],
    documents: [
      { id: "doc-j1", name: "TechNova_Sr_Backend_JD_v2.pdf", type: "JD", fileUrl: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf", fileSizeKb: 310, version: 2, uploadedById: "usr-tam", uploadedByName: "Amit Joshi", uploadedAt: daysAgo(45), status: "ACTIVE" },
      { id: "doc-j2", name: "TechNova_RateCard_2026.pdf", type: "RATE_CARD", fileUrl: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf", fileSizeKb: 185, version: 1, uploadedById: "usr-sa", uploadedByName: "Super Admin", uploadedAt: daysAgo(40), status: "ACTIVE" }
    ],
    approvals: [
      { id: "appr-j1", jobId: "job-101", approvalType: "REQUISITION_CREATION", requestedById: "usr-tam", requestedByName: "Amit Joshi", requestedAt: daysAgo(45), approverId: "usr-sa", approverName: "Super Admin", status: "APPROVED", decidedAt: daysAgo(44), comments: "Approved for immediate aggressive sourcing" }
    ],
    createdAt: daysAgo(45),
    updatedAt: daysAgo(1)
  },
  {
    id: "job-102",
    orgId: ORG_1,
    clientId: "cl-2",
    title: "Risk Analyst",
    department: "Risk",
    location: "Lower Parel, Mumbai",
    workMode: "ONSITE",
    city: "Mumbai",
    country: "India",
    employmentType: "FULL_TIME",
    priority: "HIGH",
    priorityReason: "Client Escalation — regulatory compliance audit approaching",
    openings: 2,
    filled: 0,
    salaryMinLpa: 10,
    salaryMaxLpa: 16,
    salaryCurrency: "INR",
    experienceMinYears: 2,
    experienceMaxYears: 5,
    skills: ["SQL", "Excel", "Risk Modelling", "Python"],
    preferredSkills: ["R", "Tableau", "Credit Risk Modeling"],
    education: "B.Com / B.Sc Stats / MBA Finance",
    noticePeriodPreference: "30 Days or Serving Notice",
    description: "Credit risk analytics for lending portfolio. High exposure to credit scoring models.",
    aboutCompany: "FinEdge Capital is an NBFC revolutionizing MSME credit lines.",
    responsibilities: "Perform default probability estimation, portfolio stress testing, regulatory reports.",
    status: "SOURCING",
    requestedById: "usr-ag1",
    approvedById: "usr-sa",
    assignedTas: ["usr-ta2"],
    primaryRecruiterId: "usr-ta2",
    taManagerId: "usr-tam",
    accountManagerId: "usr-sa",
    targetCloseDate: daysAhead(30),
    targetJoiningDate: daysAhead(50),
    slaDays: 25,
    sla: {
      slaDays: 25,
      slaStartDate: daysAgo(22),
      status: "ON_TRACK"
    },
    tags: ["Volume Hiring", "Finance"],
    openingsList: [
      { id: "opn-102-1", openingNumber: 1, status: "SOURCING" },
      { id: "opn-102-2", openingNumber: 2, status: "SOURCING" }
    ],
    createdAt: daysAgo(22),
    updatedAt: daysAgo(2)
  },
  {
    id: "job-103",
    orgId: ORG_1,
    clientId: "cl-1",
    title: "DevOps Engineer",
    department: "Platform",
    location: "Remote (India)",
    workMode: "REMOTE",
    city: "Bengaluru",
    country: "India",
    employmentType: "REMOTE",
    priority: "HIGH",
    openings: 1,
    filled: 1,
    salaryMinLpa: 14,
    salaryMaxLpa: 22,
    salaryCurrency: "INR",
    experienceMinYears: 3,
    experienceMaxYears: 7,
    skills: ["Kubernetes", "Terraform", "CI/CD", "Docker"],
    preferredSkills: ["Helm", "ArgoCD", "Prometheus"],
    education: "B.Tech / B.E. in IT or CS",
    description: "Infra automation and release engineering.",
    status: "FULFILLED",
    requestedById: "usr-tam",
    approvedById: "usr-sa",
    assignedTas: ["usr-ta1"],
    primaryRecruiterId: "usr-ta1",
    taManagerId: "usr-tam",
    accountManagerId: "usr-sa",
    targetCloseDate: null,
    slaDays: 30,
    sla: {
      slaDays: 30,
      slaStartDate: daysAgo(70),
      status: "COMPLETED"
    },
    tags: ["Remote"],
    openingsList: [
      { id: "opn-103-1", openingNumber: 1, status: "FILLED", assignedCandidateId: "cand-010", assignedCandidateName: "Fatima Sheikh", actualJoiningDate: daysAgo(12) }
    ],
    createdAt: daysAgo(70),
    updatedAt: daysAgo(10)
  },
  {
    id: "job-104",
    orgId: ORG_1,
    clientId: "cl-4",
    title: "Category Manager",
    department: "Catalog",
    location: "Andheri East, Mumbai",
    workMode: "HYBRID",
    employmentType: "FULL_TIME",
    priority: "MEDIUM",
    openings: 2,
    filled: 0,
    salaryMinLpa: 12,
    salaryMaxLpa: 18,
    salaryCurrency: "INR",
    experienceMinYears: 4,
    experienceMaxYears: 9,
    skills: ["Category Management", "Vendor Negotiation", "Analytics"],
    description: "Own P&L for home category.",
    status: "INTERVIEWING",
    requestedById: "usr-ag2",
    approvedById: "usr-sa",
    assignedTas: ["usr-ta2"],
    primaryRecruiterId: "usr-ta2",
    taManagerId: "usr-tam",
    accountManagerId: "usr-sa",
    targetCloseDate: daysAhead(25),
    slaDays: 35,
    sla: {
      slaDays: 35,
      slaStartDate: daysAgo(33),
      status: "AT_RISK"
    },
    tags: ["Retail"],
    openingsList: [
      { id: "opn-104-1", openingNumber: 1, status: "INTERVIEWING" },
      { id: "opn-104-2", openingNumber: 2, status: "SOURCING" }
    ],
    createdAt: daysAgo(33),
    updatedAt: daysAgo(3)
  },
  {
    id: "job-105",
    orgId: ORG_1,
    clientId: "cl-3",
    title: "Staff Nurse (ICU)",
    department: "Clinical",
    location: "Bandra East, Mumbai",
    workMode: "ONSITE",
    employmentType: "FULL_TIME",
    priority: "URGENT",
    priorityReason: "Replacement — critical hospital ward vacancy",
    openings: 5,
    filled: 0,
    salaryMinLpa: 3.5,
    salaryMaxLpa: 6,
    salaryCurrency: "INR",
    experienceMinYears: 1,
    experienceMaxYears: 6,
    skills: ["ICU", "BSc Nursing", "Patient Care"],
    description: "Night shifts rotation, 26 bed ICU.",
    status: "PENDING_APPROVAL",
    requestedById: "usr-ag1",
    approvedById: null,
    assignedTas: [],
    targetCloseDate: daysAhead(45),
    slaDays: 20,
    tags: ["Urgent", "Healthcare"],
    openingsList: [
      { id: "opn-105-1", openingNumber: 1, status: "OPEN" },
      { id: "opn-105-2", openingNumber: 2, status: "OPEN" },
      { id: "opn-105-3", openingNumber: 3, status: "OPEN" },
      { id: "opn-105-4", openingNumber: 4, status: "OPEN" },
      { id: "opn-105-5", openingNumber: 5, status: "OPEN" }
    ],
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4)
  },
  {
    id: "job-106",
    orgId: ORG_1,
    clientId: "cl-2",
    title: "Compliance Manager",
    department: "Legal",
    location: "Lower Parel, Mumbai",
    workMode: "ONSITE",
    employmentType: "FULL_TIME",
    priority: "MEDIUM",
    openings: 1,
    filled: 0,
    salaryMinLpa: 16,
    salaryMaxLpa: 24,
    salaryCurrency: "INR",
    experienceMinYears: 6,
    experienceMaxYears: 12,
    skills: ["SEBI", "Compliance", "Audit"],
    description: "Regulatory compliance for broking arm.",
    status: "APPROVED",
    requestedById: "usr-tam",
    approvedById: "usr-sa",
    assignedTas: [],
    targetCloseDate: daysAhead(40),
    slaDays: 30,
    tags: ["Legal", "Compliance"],
    createdAt: daysAgo(6),
    updatedAt: daysAgo(5)
  },
  {
    id: "job-107",
    orgId: ORG_1,
    clientId: "cl-4",
    title: "Customer Support Lead",
    department: "Support",
    location: "Malad, Mumbai",
    workMode: "HYBRID",
    employmentType: "HYBRID",
    priority: "LOW",
    openings: 1,
    filled: 0,
    salaryMinLpa: 6,
    salaryMaxLpa: 9,
    salaryCurrency: "INR",
    experienceMinYears: 3,
    experienceMaxYears: 6,
    skills: ["Team Handling", "CRM", "Escalations"],
    description: "Lead 12-member support pod.",
    status: "CANCELLED",
    cancelReason: "Client restructured internal support team into Bangalore shared service center.",
    requestedById: "usr-ag2",
    approvedById: "usr-sa",
    assignedTas: [],
    targetCloseDate: null,
    createdAt: daysAgo(55),
    updatedAt: daysAgo(20)
  },
  {
    id: "job-108",
    orgId: ORG_1,
    clientId: "cl-1",
    title: "QA Automation Engineer",
    department: "Engineering",
    location: "Powai, Mumbai",
    workMode: "HYBRID",
    employmentType: "CONTRACT",
    priority: "MEDIUM",
    openings: 2,
    filled: 0,
    salaryMinLpa: 9,
    salaryMaxLpa: 14,
    salaryCurrency: "INR",
    experienceMinYears: 2,
    experienceMaxYears: 6,
    skills: ["Playwright", "TypeScript", "API Testing"],
    description: "12-month renewable contract for automated regression test suite.",
    status: "SOURCING",
    requestedById: "usr-ta1",
    approvedById: "usr-sa",
    assignedTas: ["usr-ta1", "usr-ta2"],
    primaryRecruiterId: "usr-ta1",
    taManagerId: "usr-tam",
    accountManagerId: "usr-sa",
    targetCloseDate: daysAhead(18),
    slaDays: 20,
    tags: ["Contract", "QA"],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(1)
  },
  // Org 2
  {
    id: "org2-job-201",
    orgId: "org-2",
    clientId: "org2-cl-1",
    title: "Voice Process Executive",
    department: "Operations",
    location: "Noida",
    workMode: "ONSITE",
    employmentType: "FULL_TIME",
    priority: "HIGH",
    openings: 20,
    filled: 4,
    salaryMinLpa: 2.4,
    salaryMaxLpa: 3.6,
    salaryCurrency: "INR",
    experienceMinYears: 0,
    experienceMaxYears: 3,
    skills: ["English", "Hindi", "Communication"],
    description: "International voice process, rotational shifts.",
    status: "SOURCING",
    requestedById: "org2-sa",
    approvedById: "org2-sa",
    assignedTas: [],
    targetCloseDate: daysAhead(30),
    createdAt: daysAgo(15),
    updatedAt: daysAgo(2)
  },
]));

// ─── Candidates ───────────────────────────────────────────────

let candSeq = 1;
function mkCandidate(c: Partial<Candidate> & { name: string; email: string; phone: string; totalExperienceYears: number; relevantExperienceYears: number; currentCtcLpa: number; expectedCtcLpa: number; noticePeriodDays: number; location: string; skills: string[]; source: CandidateSource }): Candidate {
  const currentSeq = candSeq++;
  const defaultCode = `CAN-${String(8900 + currentSeq)}`;
  return {
    id: `cand-${String(currentSeq).padStart(3, "0")}`,
    candidateCode: c.candidateCode || defaultCode,
    orgId: ORG_1,
    status: c.status || "ACTIVE",
    tags: c.tags || ["Immediate Joiner", "Screened"],
    blacklisted: false,
    blacklistReason: null,
    rating: c.rating ?? 4,
    referredByUserId: c.referredByUserId ?? null,
    createdAt: daysAgo(60 - currentSeq),
    updatedAt: daysAgo(Math.max(0, 50 - currentSeq)),
    profileCompletionScore: c.profileCompletionScore ?? 85,
    ...c,
  } as Candidate;
}

export const candidates: Candidate[] = persist("candidates", () => ([
  mkCandidate({
    candidateCode: "CAN-8901",
    name: "Amit Verma",
    email: "amit.verma@gmail.com",
    alternateEmail: "amit.tech.v@outlook.com",
    phone: "+91 90111 10101",
    alternatePhone: "+91 98200 44551",
    whatsappNumber: "+91 90111 10101",
    gender: "Male",
    dateOfBirth: "1994-06-18",
    nationality: "Indian",
    maritalStatus: "Single",
    currentCity: "Mumbai",
    currentState: "Maharashtra",
    currentCountry: "India",
    permanentAddress: "Flat 402, Sea Breeze Apts, Bandra West, Mumbai 400050",
    pinCode: "400050",
    headline: "Senior Backend Architect | Node.js, Distributed Systems & Cloud",
    bio: "Passionate backend engineer with 6+ years specializing in high-throughput microservices, fintech payment gateways, and PostgreSQL query optimization. Proven track record leading a squad of 6 engineers.",
    currentCompany: "Tata Consultancy Services (TCS)",
    currentDesignation: "Sr. Software Engineer",
    previousCompany: "Accenture India",
    totalExperienceYears: 6,
    relevantExperienceYears: 5,
    industry: "Information Technology & Services",
    functionalArea: "Software Engineering & Architecture",
    employmentType: "Full-Time",
    seniorityLevel: "Senior",
    currentCtcLpa: 16,
    expectedCtcLpa: 24,
    noticePeriodDays: 60,
    location: "Mumbai",
    status: "QUALIFIED",
    tags: ["Immediate Joiner", "Top Tech", "Verified", "High Priority", "Fintech Ready"],
    skills: ["Node.js", "PostgreSQL", "AWS", "Redis", "Kafka", "Docker", "TypeScript", "Kubernetes", "Next.js"],
    primarySkills: ["Node.js", "PostgreSQL", "AWS"],
    secondarySkills: ["Kafka", "Redis", "Docker", "Kubernetes"],
    detailedSkills: [
      { name: "Node.js", category: "Programming Languages", experienceYears: 6, proficiency: "Expert", primary: true, verified: true, lastUsedYear: 2026 },
      { name: "PostgreSQL", category: "Databases", experienceYears: 5, proficiency: "Expert", primary: true, verified: true, lastUsedYear: 2026 },
      { name: "AWS (ECS, Lambda, RDS)", category: "Cloud & DevOps", experienceYears: 4, proficiency: "Advanced", primary: true, verified: true, lastUsedYear: 2026 },
      { name: "Redis", category: "Databases", experienceYears: 4, proficiency: "Advanced", primary: false, verified: true, lastUsedYear: 2026 },
      { name: "Apache Kafka", category: "Architecture & Tools", experienceYears: 3, proficiency: "Advanced", primary: false, verified: true, lastUsedYear: 2026 },
      { name: "TypeScript", category: "Programming Languages", experienceYears: 4, proficiency: "Advanced", primary: false, verified: true, lastUsedYear: 2026 },
      { name: "Docker & K8s", category: "Cloud & DevOps", experienceYears: 3, proficiency: "Intermediate", primary: false, verified: false, lastUsedYear: 2025 }
    ],
    certifications: ["AWS Certified Solutions Architect - Associate", "PostgreSQL Certified Professional"],
    preferences: {
      preferredJobTitles: ["Staff Backend Engineer", "Lead Backend Architect", "Engineering Manager"],
      preferredIndustries: ["Fintech", "E-Commerce", "SaaS", "Enterprise Tech"],
      preferredWorkMode: "HYBRID",
      preferredLocations: ["Mumbai", "Bengaluru", "Pune", "Remote"],
      willingToRelocate: true,
      relocationPreference: "Willing to relocate to Bengaluru or Pune for right compensation package",
      preferredShift: "Day",
      travelAvailability: "Occasional (up to 20%)",
      visaSponsorshipRequired: false,
      workAuthorization: "Indian Citizen (No Visa Required)"
    },
    compensationDetails: {
      currentFixedLpa: 14.5,
      currentVariableLpa: 1.5,
      currentBonusLpa: 0.8,
      currentCtcLpa: 16.0,
      expectedFixedLpa: 22.0,
      expectedVariableLpa: 2.0,
      expectedCtcLpa: 24.0,
      salaryCurrency: "INR",
      negotiableSalary: true,
      minimumAcceptableLpa: 21.5,
      buyoutAvailable: true
    },
    availabilityDetails: {
      noticePeriodDays: 60,
      noticePeriodUnit: "Days",
      servingNotice: true,
      noticeStartDate: "2026-08-01",
      lastWorkingDay: "2026-09-30",
      availableFrom: "2026-10-01",
      immediateJoiner: false,
      joiningFlexibility: "Buyout available - current employer willing to release early for 1 month buyout",
      buyoutPossible: true,
      availabilityStatus: "Available in 15 Days"
    },
    documents: [
      {
        id: "doc-101",
        name: "Amit_Verma_Resume_v3_2026.pdf",
        type: "RESUME",
        fileUrl: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf",
        fileSizeKb: 342,
        version: 3,
        uploadedBy: "Vikram Singh (Agent)",
        uploadDate: "2026-08-15",
        verified: true,
        verifiedBy: "Neha Sharma (TA)",
        verificationDate: "2026-08-16"
      },
      {
        id: "doc-102",
        name: "AWS_Solutions_Architect_Certificate.pdf",
        type: "CERTIFICATE",
        fileUrl: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf",
        fileSizeKb: 512,
        version: 1,
        uploadedBy: "Amit Verma",
        uploadDate: "2026-08-18",
        verified: true,
        verifiedBy: "Neha Sharma (TA)",
        verificationDate: "2026-08-19"
      },
      {
        id: "doc-103",
        name: "TCS_Latest_Salary_Slip_July_2026.pdf",
        type: "SALARY_SLIP",
        fileUrl: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf",
        fileSizeKb: 180,
        version: 1,
        uploadedBy: "Amit Verma",
        uploadDate: "2026-08-20",
        verified: true,
        verifiedBy: "Pooja Mehta (HR)",
        verificationDate: "2026-08-21"
      }
    ],
    communications: [
      {
        id: "comm-01",
        type: "PHONE",
        direction: "OUTGOING",
        subject: "Initial Screening & CTC alignment call",
        message: "Discussed role at TechNova. Candidate is keen on high-throughput backend scaling challenges. Confirmed last working day is Sep 30.",
        outcome: "Connected",
        nextFollowUpDate: "2026-09-25",
        createdByName: "Neha Sharma (TA Recruiter)",
        createdAt: "2026-08-15T11:30:00Z"
      },
      {
        id: "comm-02",
        type: "WHATSAPP",
        direction: "OUTGOING",
        subject: "Shared Client Round prep material",
        message: "Sent architecture overview of TechNova's Core Payment Gateway and system design guidelines.",
        outcome: "Connected",
        createdByName: "Neha Sharma (TA Recruiter)",
        createdAt: "2026-08-22T14:15:00Z"
      },
      {
        id: "comm-03",
        type: "EMAIL",
        direction: "INCOMING",
        subject: "Re: Client Interview Confirmation",
        message: "Candidate confirmed availability for Friday 3:00 PM video round.",
        outcome: "Interview Confirmed",
        createdByName: "Amit Verma",
        createdAt: "2026-08-23T09:40:00Z"
      }
    ],
    notes: [
      {
        id: "not-01",
        category: "Screening",
        text: "Very strong on distributed transactions and idempotent API patterns. Communicates with great clarity and owns end-to-end incident management.",
        authorName: "Neha Sharma (TA Recruiter)",
        isPrivate: false,
        createdAt: "2026-08-15T12:00:00Z"
      },
      {
        id: "not-02",
        category: "Salary",
        text: "Candidate has another competing offer discussion at 22 LPA. To secure acceptance, recommended budget is 23.5 - 24 LPA fixed.",
        authorName: "Amit Joshi (TA Manager)",
        isPrivate: true,
        createdAt: "2026-08-20T16:20:00Z"
      }
    ],
    screeningEvaluation: {
      communicationRating: 5,
      technicalRating: 5,
      relevantExperienceFit: 5,
      cultureFit: 4,
      salaryFit: 4,
      overallFitRating: 5,
      recruiterRecommendation: "Strong Recommend",
      screeningNotes: "Candidate is a high-conviction hire for Senior Backend. Outstanding problem-solving in data caching and transactional integrity.",
      evaluatedByName: "Neha Sharma (TA Recruiter)",
      evaluatedAt: "2026-08-15"
    },
    referenceChecks: [
      {
        id: "ref-01",
        name: "Siddharth Rao",
        company: "Accenture",
        designation: "Engineering Director",
        relationship: "Former Reporting Manager",
        phone: "+91 98200 99881",
        email: "siddharth.r@accenture.com",
        status: "VERIFIED",
        feedback: "Amit was one of our top 5% backend engineers. Highly autonomous and dependable in mission-critical releases.",
        verifiedByName: "Amit Joshi",
        verifiedAt: "2026-08-21"
      }
    ],
    compliance: {
      dataProcessingConsent: true,
      communicationConsent: true,
      resumeSharingConsent: true,
      clientSubmissionConsent: true,
      consentDate: "2026-08-14",
      consentSource: "Candidate Portal Sign-up & Referral",
      dataRetentionUntil: "2028-08-14",
      anonymizationStatus: "ACTIVE"
    },
    ownership: {
      assignedRecruiterId: "usr-ta1",
      assignedRecruiterName: "Neha Sharma",
      taManagerName: "Amit Joshi",
      accountManagerName: "Rahul Saxena",
      recruitmentTeam: "Fintech & Enterprise Tech Squad",
      assignedAt: "2026-08-14"
    },
    profileCompletionScore: 95,
    workExperience: [
      {
        id: "exp-1",
        company: "Tata Consultancy Services (TCS)",
        designation: "Sr. Software Engineer",
        startDate: "2022-03",
        currentlyWorking: true,
        location: "Mumbai",
        description: "Architected distributed transaction engine handling 12,000 req/sec with 99.98% uptime. Scaled Redis caching layers and reduced DB latency by 45%."
      },
      {
        id: "exp-2",
        company: "Accenture India",
        designation: "Software Engineer",
        startDate: "2019-06",
        endDate: "2022-02",
        location: "Pune",
        description: "Built RESTful API services for European banking client. Implemented CI/CD pipelines with GitHub Actions and AWS ECS."
      }
    ],
    education: [
      {
        id: "edu-1",
        degree: "B.Tech",
        fieldOfStudy: "Computer Science & Engineering",
        institution: "Veermata Jijabai Technological Institute (VJTI)",
        startYear: 2015,
        endYear: 2019,
        grade: "8.6 CGPA"
      },
      {
        id: "edu-2",
        degree: "HSC (Class XII)",
        fieldOfStudy: "Science (PCM)",
        institution: "R.D. National College, Bandra",
        startYear: 2013,
        endYear: 2015,
        grade: "89.4%"
      }
    ],
    linkedinUrl: "https://linkedin.com/in/amit-verma-sample",
    githubUrl: "https://github.com/amit-verma-dev",
    portfolioUrl: "https://amitverma.tech",
    resumeUrl: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf",
    rating: 5,
    source: "AGENT_REFERRAL",
    referredByUserId: "usr-ag1",
    offers: [
      {
        id: "ofr-101",
        jobId: "job-101",
        jobTitle: "Senior Backend Engineer",
        clientId: "cl-1",
        clientName: "TechNova Solutions",
        offeredCtcLpa: 23.5,
        fixedLpa: 21.5,
        joiningBonusLpa: 2.0,
        offeredDate: "2026-08-25",
        joiningDate: "2026-10-01",
        expiryDate: "2026-09-30",
        status: "SENT",
        candidateResponse: "Reviewing terms with current team buyout clause.",
        createdBy: "Amit Joshi",
        createdAt: "2026-08-25T10:00:00Z"
      }
    ],
    clientSubmissions: [
      {
        id: "sub-101",
        jobId: "job-101",
        jobTitle: "Senior Backend Engineer",
        clientId: "cl-1",
        clientName: "TechNova Solutions",
        submittedBy: "Neha Sharma",
        submittedAt: "2026-08-16T15:00:00Z",
        status: "SHORTLISTED",
        clientFeedback: "Profile endorsed by VP Eng. Proceed to Client Round directly.",
        responseDate: "2026-08-17"
      }
    ],
    candidateTasks: [
      {
        id: "tsk-101",
        title: "Collect joining confirmation & resign proof",
        description: "Verify formal acceptance of offer letter and copy of resignation acceptance from TCS HR.",
        assignedToName: "Neha Sharma",
        dueDate: "2026-09-28",
        priority: "HIGH",
        relatedJobTitle: "Senior Backend Engineer",
        status: "IN_PROGRESS",
        createdAt: "2026-08-26T09:00:00Z"
      },
      {
        id: "tsk-102",
        title: "Schedule onboarding briefing call",
        description: "Walk through day-1 requirements and laptop provisioning.",
        assignedToName: "Pooja Mehta",
        dueDate: "2026-09-30",
        priority: "MEDIUM",
        relatedJobTitle: "Senior Backend Engineer",
        status: "PENDING",
        createdAt: "2026-08-26T11:00:00Z"
      }
    ],
    internalAuditLogs: [
      {
        id: "aud-01",
        action: "STAGE_MOVED",
        fieldChanged: "pipelineStage",
        previousValue: "TECH_ROUND",
        newValue: "CLIENT_ROUND",
        actorName: "Neha Sharma",
        reason: "Cleared Tech Round 2 with 9/10 score",
        timestamp: "2026-08-22T17:00:00Z"
      },
      {
        id: "aud-02",
        action: "CTC_UPDATED",
        fieldChanged: "expectedCtcLpa",
        previousValue: "22 LPA",
        newValue: "24 LPA",
        actorName: "Amit Joshi",
        reason: "Competing offer from multinational fintech firm",
        timestamp: "2026-08-20T16:30:00Z"
      }
    ]
  }),
  mkCandidate({
    name: "Divya Sharma",
    email: "divya.s@outlook.com",
    phone: "+91 90122 20202",
    headline: "Full Stack Engineer | MERN & GraphQL",
    bio: "Full Stack developer experienced in Next.js, Express, and MongoDB. Strong focus on clean architecture and test coverage.",
    currentCompany: "Infosys",
    currentDesignation: "Software Engineer",
    totalExperienceYears: 4,
    relevantExperienceYears: 4,
    currentCtcLpa: 12,
    expectedCtcLpa: 19,
    noticePeriodDays: 90,
    location: "Thane",
    skills: ["Node.js", "Express", "MongoDB", "React", "TypeScript", "Tailwind CSS"],
    primarySkills: ["React", "Node.js", "MongoDB"],
    secondarySkills: ["GraphQL", "Next.js"],
    certifications: ["MongoDB Certified Developer Associate"],
    workExperience: [
      {
        id: "exp-3",
        company: "Infosys Technologies",
        designation: "Software Engineer",
        startDate: "2021-08",
        currentlyWorking: true,
        location: "Thane",
        description: "Developed core dashboard components and backend REST endpoints for e-commerce client portals."
      }
    ],
    education: [
      {
        id: "edu-3",
        degree: "Bachelor of Engineering (B.E.)",
        fieldOfStudy: "Information Technology",
        institution: "Thadomal Shahani Engineering College",
        startYear: 2017,
        endYear: 2021,
        grade: "8.2 CGPA"
      }
    ],
    linkedinUrl: "https://linkedin.com/in/divya-sharma-sample",
    resumeUrl: null,
    rating: 4,
    source: "LINKEDIN",
    referredByUserId: null
  }),
  mkCandidate({ name: "Karan Malhotra", email: "karan.m@gmail.com", phone: "+91 90133 30303", currentCompany: "Accenture", currentDesignation: "Technology Lead", totalExperienceYears: 8, relevantExperienceYears: 7, currentCtcLpa: 22, expectedCtcLpa: 30, noticePeriodDays: 30, location: "Mumbai", skills: ["Node.js", "Microservices", "Kafka", "AWS"], resumeUrl: null, rating: 4, source: "DATABASE", referredByUserId: null }),
  mkCandidate({ name: "Ritika Bansal", email: "ritika.b@yahoo.in", phone: "+91 90144 40404", currentCompany: "HDFC Bank", currentDesignation: "Risk Analyst II", totalExperienceYears: 3, relevantExperienceYears: 3, currentCtcLpa: 9, expectedCtcLpa: 14, noticePeriodDays: 60, location: "Mumbai", skills: ["SQL", "Python", "Risk Modelling"], resumeUrl: null, rating: 4, source: "AGENT_REFERRAL", referredByUserId: "usr-ag2" }),
  mkCandidate({ name: "Suresh Naidu", email: "suresh.n@gmail.com", phone: "+91 90155 50505", currentCompany: "ICICI", currentDesignation: "Credit Analyst", totalExperienceYears: 5, relevantExperienceYears: 5, currentCtcLpa: 11, expectedCtcLpa: 15, noticePeriodDays: 30, location: "Navi Mumbai", skills: ["SQL", "Excel", "Underwriting"], resumeUrl: null, rating: 3, source: "JOB_PORTAL", referredByUserId: null }),
  mkCandidate({ name: "Anjali Deshmukh", email: "anjali.d@gmail.com", phone: "+91 90166 60606", currentCompany: "Amazon", currentDesignation: "Program Manager", totalExperienceYears: 7, relevantExperienceYears: 5, currentCtcLpa: 26, expectedCtcLpa: 32, noticePeriodDays: 75, location: "Mumbai", skills: ["Category Management", "Analytics", "Vendor Management"], resumeUrl: null, rating: 5, source: "LINKEDIN", referredByUserId: null }),
  mkCandidate({ name: "Mohit Sinha", email: "mohit.sinha@gmail.com", phone: "+91 90177 70707", currentCompany: "Flipkart", currentDesignation: "Category Manager 2", totalExperienceYears: 6, relevantExperienceYears: 6, currentCtcLpa: 18, expectedCtcLpa: 24, noticePeriodDays: 60, location: "Bengaluru", skills: ["Category Management", "P&L", "Negotiation"], resumeUrl: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf", rating: 4, source: "AGENT_REFERRAL", referredByUserId: "usr-ag1" }),
  mkCandidate({ name: "Priyanka Rao", email: "priyanka.r@gmail.com", phone: "+91 90188 80808", currentCompany: "Wipro", currentDesignation: "Test Lead", totalExperienceYears: 5, relevantExperienceYears: 5, currentCtcLpa: 10, expectedCtcLpa: 13, noticePeriodDays: 60, location: "Pune", skills: ["Playwright", "TypeScript", "API Testing", "Jenkins"], resumeUrl: null, rating: 4, source: "JOB_PORTAL", referredByUserId: null }),
  mkCandidate({ name: "Aditya Rane", email: "aditya.rane@gmail.com", phone: "+91 90199 90909", currentCompany: "Persistent Systems", currentDesignation: "Sr. QA Engineer", totalExperienceYears: 3, relevantExperienceYears: 3, currentCtcLpa: 7, expectedCtcLpa: 10, noticePeriodDays: 45, location: "Pune", skills: ["Playwright", "JavaScript", "REST Assured"], resumeUrl: null, rating: 3, source: "DATABASE", referredByUserId: null }),
  mkCandidate({ name: "Fatima Sheikh", email: "fatima.s@gmail.com", phone: "+91 90200 11010", currentCompany: "CloudLeap Technologies", currentDesignation: "DevOps Engineer", totalExperienceYears: 4, relevantExperienceYears: 4, currentCtcLpa: 15, expectedCtcLpa: 20, noticePeriodDays: 30, location: "Remote", skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"], resumeUrl: null, rating: 5, source: "OTHER", referredByUserId: null }),
  mkCandidate({ name: "Nikhil Joshi", email: "nikhil.j@gmail.com", phone: "+91 90211 12011", currentCompany: "Zoho", currentDesignation: "DevOps Engineer II", totalExperienceYears: 5, relevantExperienceYears: 5, currentCtcLpa: 17, expectedCtcLpa: 23, noticePeriodDays: 60, location: "Chennai", skills: ["Kubernetes", "Docker", "Azure", "Ansible"], resumeUrl: null, rating: 4, source: "LINKEDIN", referredByUserId: null }),
  { ...mkCandidate({ name: "Sameer Khan", email: "sameer.k@gmail.com", phone: "+91 90222 13012", currentCompany: "Freelancer", currentDesignation: "Backend Consultant", totalExperienceYears: 7, relevantExperienceYears: 6, currentCtcLpa: 0, expectedCtcLpa: 26, noticePeriodDays: 15, location: "Mumbai", skills: ["Node.js", "GraphQL", "PostgreSQL"], resumeUrl: null, rating: 3, source: "WALK_IN", referredByUserId: null }), blacklisted: true, blacklistReason: "Failed background verification — falsified previous experience certificates." },
]));

// ─── Applications (pipeline) ──────────────────────────────────

type AppSeed = [candidateIdx: number, jobId: string, stage: Application["stage"], recruiterId: string, fit: number];
const appSeeds: AppSeed[] = [
  [0, "job-101", "CLIENT_ROUND", "usr-ta1", 92],
  [1, "job-101", "TECH_ROUND", "usr-ta1", 78],
  [2, "job-101", "OFFER_SENT", "usr-ta1", 95],
  [3, "job-102", "SCREENING", "usr-ta2", 81],
  [4, "job-102", "SOURCED", "usr-ta2", 65],
  [5, "job-104", "HR_ROUND", "usr-ta2", 88],
  [6, "job-104", "CLIENT_ROUND", "usr-ta2", 84],
  [7, "job-108", "INTERVIEW_SCHEDULED", "usr-ta1", 76],
  [8, "job-108", "SCREENING", "usr-ta2", 70],
  [9, "job-103", "JOINED", "usr-ta1", 97],
  [10, "job-101", "SOURCED", "usr-ta1", 74],
  [11, "job-102", "REJECTED", "usr-ta2", 40],
];

let appSeq = 1;
export const applications: Application[] = persist("applications", () => (appSeeds.map(([ci, jobId, stage, recruiterId, fit]) => {
  const c = candidates[ci];
  return {
    id: `app-${String(appSeq++).padStart(3, "0")}`,
    orgId: ORG_1,
    candidateId: c.id,
    jobId,
    stage,
    recruiterId,
    fitScore: fit,
    screeningNotes: stage === "REJECTED" ? "Salary expectation too high; weak SQL fundamentals." : null,
    rejectionReason: stage === "REJECTED" ? "Skill mismatch — no risk modelling exposure." : null,
    expectedJoinDate: stage === "OFFER_SENT" || stage === "JOINED" ? dateOnly(30) : null,
    actualJoinDate: stage === "JOINED" ? dateOnly(-12) : null,
    createdAt: daysAgo(40 - appSeq),
    updatedAt: daysAgo(Math.max(0, 30 - appSeq * 2)),
  };
})));

export const joinedApplication = applications.find((a) => a.stage === "JOINED")!;

// ─── Interviews ───────────────────────────────────────────────

let itrSeq = 1;
function mkInterview(i: Omit<Interview, "id" | "orgId" | "createdAt">): Interview {
  return { ...i, id: `itr-${String(itrSeq++).padStart(3, "0")}`, orgId: ORG_1, createdAt: daysAgo(10) };
}

export const interviews: Interview[] = persist("interviews", () => ([
  mkInterview({ applicationId: "app-001", round: "CLIENT_ROUND", mode: "VIDEO", scheduledAt: daysAhead(0, 11, 0), durationMins: 60, interviewerName: "Deepak Rao (TechNova)", status: "SCHEDULED", outcome: "PENDING", score: null, feedback: null, meetingLink: "https://meet.google.com/abc-defg-hij", createdBy: "usr-ta1" }),
  mkInterview({ applicationId: "app-002", round: "TECH_1", mode: "VIDEO", scheduledAt: daysAhead(0, 14, 30), durationMins: 45, interviewerName: "Rahul Sharma", status: "SCHEDULED", outcome: "PENDING", score: null, feedback: null, meetingLink: "https://meet.google.com/xyz-pqrs-tuv", createdBy: "usr-ta1" }),
  mkInterview({ applicationId: "app-007", round: "CLIENT_ROUND", mode: "ONSITE", scheduledAt: daysAhead(0, 16, 0), durationMins: 60, interviewerName: "RetailMart HR Head", status: "SCHEDULED", outcome: "PENDING", score: null, feedback: null, meetingLink: null, createdBy: "usr-ta2" }),
  mkInterview({ applicationId: "app-008", round: "SCREENING_CALL", mode: "PHONE", scheduledAt: daysAhead(0, 10, 0), durationMins: 30, interviewerName: "Rahul Sharma", status: "COMPLETED", outcome: "HIRE", score: 8, feedback: "Good hands-on with Playwright. Communication above average.", meetingLink: null, createdBy: "usr-ta1" }),
  mkInterview({ applicationId: "app-003", round: "FINAL", mode: "VIDEO", scheduledAt: daysAgo(1, 14), durationMins: 60, interviewerName: "Deepak Rao (TechNova)", status: "COMPLETED", outcome: "STRONG_HIRE", score: 9, feedback: null, meetingLink: null, createdBy: "usr-ta1" }),
  mkInterview({ applicationId: "app-005", round: "SCREENING_CALL", mode: "PHONE", scheduledAt: daysAhead(1, 12, 0), durationMins: 30, interviewerName: "Priya Iyer", status: "RESCHEDULED", outcome: "PENDING", score: null, feedback: null, meetingLink: null, createdBy: "usr-ta2" }),
  mkInterview({ applicationId: "app-006", round: "HR_ROUND", mode: "VIDEO", scheduledAt: daysAgo(2), durationMins: 45, interviewerName: "RetailMart HR Head", status: "COMPLETED", outcome: "HIRE", score: 8, feedback: "Culture fit strong. Compensation discussion pending.", meetingLink: null, createdBy: "usr-ta2" }),
  mkInterview({ applicationId: "app-002", round: "TECH_1", mode: "VIDEO", scheduledAt: daysAhead(0, 14, 45), durationMins: 45, interviewerName: "Rahul Sharma", status: "SCHEDULED", outcome: "PENDING", score: null, feedback: null, meetingLink: "https://meet.google.com/conflict-test", createdBy: "usr-ta1" }),
]));

// ─── Referrals (agent-submitted candidates) ───────────────────

export const referrals: Referral[] = persist("referrals", () => ([
  { id: "ref-001", orgId: ORG_1, agentId: "usr-ag1", candidateId: candidates[0].id, jobId: "job-101", status: "SHORTLISTED", incentiveAmount: 15000, incentivePaid: false, reviewNotes: "Strong profile, moved to pipeline.", createdAt: daysAgo(25), updatedAt: daysAgo(6) },
  { id: "ref-002", orgId: ORG_1, agentId: "usr-ag2", candidateId: candidates[3].id, jobId: "job-102", status: "UNDER_REVIEW", incentiveAmount: 10000, incentivePaid: false, reviewNotes: null, createdAt: daysAgo(12), updatedAt: daysAgo(3) },
  { id: "ref-003", orgId: ORG_1, agentId: "usr-ag1", candidateId: candidates[6].id, jobId: "job-104", status: "HIRED", incentiveAmount: 25000, incentivePaid: true, reviewNotes: "Joined via RetailMart category role.", createdAt: daysAgo(48), updatedAt: daysAgo(10) },
  { id: "ref-004", orgId: ORG_1, agentId: "usr-ag2", candidateId: candidates[11].id, jobId: null, status: "SUBMITTED", incentiveAmount: 0, incentivePaid: false, reviewNotes: "Awaiting job mapping.", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { id: "ref-005", orgId: ORG_1, agentId: "usr-ag1", candidateId: candidates[2].id, jobId: "job-101", status: "SUBMITTED", incentiveAmount: 0, incentivePaid: false, reviewNotes: null, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { id: "ref-006", orgId: ORG_1, agentId: "usr-ag3", candidateId: candidates[5].id, jobId: "job-104", status: "REJECTED", incentiveAmount: 0, incentivePaid: false, reviewNotes: "Already in database from last quarter.", createdAt: daysAgo(30), updatedAt: daysAgo(28) },
]));

// ─── Finance — ledger & payouts ───────────────────────────────

export const commissionLedger: CommissionLedgerEntry[] = persist("commissionLedger", () => ([
  { id: "led-001", orgId: ORG_1, userId: null, clientId: "cl-1", applicationId: joinedApplication.id, type: "PLACEMENT_COMMISSION", amountInr: 187000, status: "PENDING", description: "Placement: DevOps Engineer @ CloudLeap (Fatima Sheikh)", invoiceNumber: "INV-2026-041", dueDate: dateOnly(18), paidAt: null, createdAt: daysAgo(12) },
  { id: "led-002", orgId: ORG_1, userId: "usr-ag1", clientId: null, applicationId: null, type: "REFERRAL_INCENTIVE", amountInr: 25000, status: "PAID", description: "Referral incentive — Mohit Sinha joined RetailMart", invoiceNumber: null, dueDate: null, paidAt: daysAgo(8), createdAt: daysAgo(15) },
  { id: "led-003", orgId: ORG_1, userId: null, clientId: "cl-4", applicationId: null, type: "PLACEMENT_COMMISSION", amountInr: 144000, status: "PAID", description: "Q1 bulk placements — support vertical", invoiceNumber: "INV-2026-032", dueDate: dateOnly(-10), paidAt: daysAgo(20), createdAt: daysAgo(45) },
  { id: "led-004", orgId: ORG_1, userId: "usr-ag2", clientId: null, applicationId: null, type: "REFERRAL_INCENTIVE", amountInr: 10000, status: "APPROVED", description: "Referral incentive — Ritika Bansal (FinEdge)", invoiceNumber: null, dueDate: dateOnly(10), paidAt: null, createdAt: daysAgo(5) },
  { id: "led-005", orgId: ORG_1, userId: null, clientId: "cl-2", applicationId: null, type: "PLACEMENT_COMMISSION", amountInr: 96000, status: "APPROVED", description: "Placement: Risk Analyst offer stage (partial billing on joining)", invoiceNumber: "INV-2026-044", dueDate: dateOnly(25), paidAt: null, createdAt: daysAgo(3) },
  { id: "led-006", orgId: ORG_1, userId: null, clientId: "cl-6", applicationId: null, type: "ADJUSTMENT", amountInr: -32000, status: "PAID", description: "Credit note — candidate backed out within 30 days", invoiceNumber: "CN-2026-004", dueDate: null, paidAt: daysAgo(22), createdAt: daysAgo(24) },
]));

export const payouts: Payout[] = persist("payouts", () => ([
  { id: "pay-001", orgId: ORG_1, userId: "usr-ag1", amountInr: 25000, periodLabel: "Jul 2026", status: "PAID", method: "BANK_TRANSFER", reference: "NEFT-889123", processedAt: daysAgo(8), createdAt: daysAgo(10) },
  { id: "pay-002", orgId: ORG_1, userId: "usr-ag2", amountInr: 10000, periodLabel: "Aug 2026", status: "PROCESSING", method: "UPI", reference: null, processedAt: null, createdAt: daysAgo(2) },
  { id: "pay-003", orgId: ORG_1, userId: "usr-ta1", amountInr: 40000, periodLabel: "Jul 2026", status: "PAID", method: "BANK_TRANSFER", reference: "NEFT-889010", processedAt: daysAgo(12), createdAt: daysAgo(14) },
]));

// ─── Attendance (current month) ───────────────────────────────

// Holidays for FY 2026-27 (HR maintains this list under HRMIS → Holidays)
const HOLIDAY_SEED = [
  ["2026-01-26", "Republic Day", "NATIONAL"], ["2026-03-04", "Holi", "FESTIVAL"], ["2026-03-20", "Eid-ul-Fitr", "OPTIONAL"],
  ["2026-04-03", "Good Friday", "FESTIVAL"], ["2026-05-01", "Maharashtra Day", "FESTIVAL"], ["2026-08-15", "Independence Day", "NATIONAL"],
  ["2026-08-28", "Raksha Bandhan", "OPTIONAL"], ["2026-09-14", "Ganesh Chaturthi", "FESTIVAL"], ["2026-10-02", "Gandhi Jayanti", "NATIONAL"],
  ["2026-10-20", "Dussehra", "FESTIVAL"], ["2026-11-09", "Diwali (Lakshmi Puja)", "FESTIVAL"], ["2026-11-10", "Diwali (Balipratipada)", "FESTIVAL"],
  ["2026-11-24", "Guru Nanak Jayanti", "OPTIONAL"], ["2026-12-25", "Christmas", "FESTIVAL"], ["2027-01-26", "Republic Day", "NATIONAL"],
  ["2027-03-22", "Holi", "FESTIVAL"],
] as const;

function seedAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const activeUsers = users.filter((u) => u.orgId === ORG_1 && u.status === "ACTIVE");
  let seq = 1;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split("T")[0];
    const dow = d.getDay();
    // Mon–Fri working week; nobody punches on company holidays in the seed data
    if (dow === 0 || dow === 6 || HOLIDAY_SEED.some(([date, , type]) => date === iso && type !== "OPTIONAL")) continue;

    for (const u of activeUsers) {
      const seedVal = (u.id.charCodeAt(u.id.length - 1) * 31 + d.getDate() * 17) % 10;
      let status: AttendanceRecord["status"] = "PRESENT";
      if (seedVal === 0 && u.role !== "SUPER_ADMIN") status = "ON_LEAVE";
      else if (seedVal === 1) status = "ABSENT";
      else if (seedVal === 2) status = "HALF_DAY";
      else if (seedVal === 3 && u.role === "EMPLOYEE") status = "WFH";

      const isToday = iso === todayStr;
      const checkIn = status === "ABSENT" || status === "ON_LEAVE"
        ? null
        : `${iso}T${seedVal % 2 === 0 ? "09" : "10"}:${String((seedVal * 7) % 60).padStart(2, "0")}:00`;

      records.push({
        id: `att-${seq++}`,
        orgId: ORG_1,
        userId: u.id,
        date: iso,
        status,
        checkIn,
        checkOut: isToday ? null : checkIn ? `${iso}T18:${String((seedVal * 13) % 60).padStart(2, "0")}:00` : null,
      });
    }
  }
  return records;
}

export const attendance: AttendanceRecord[] = persist("attendance", () => (seedAttendance()));

/** Hours between check-in & check-out, rounded to 1 decimal. */
export function hoursWorkedOf(a: AttendanceRecord): number {
  if (!a.checkIn || !a.checkOut) return 0;
  const h = (new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime()) / 3600000;
  return h > 0 ? Math.round(h * 10) / 10 : 0;
}

// ─── Leave requests ───────────────────────────────────────────

export const leaveRequests: LeaveRequest[] = persist("leaveRequests", () => ([
  { id: "lv-001", orgId: ORG_1, userId: "usr-ag1", leaveType: "CASUAL", fromDate: dateOnly(4), toDate: dateOnly(5), reason: "Family function out of town.", status: "PENDING", approverId: null, decisionNote: null, createdAt: daysAgo(1) },
  { id: "lv-002", orgId: ORG_1, userId: "usr-ta2", leaveType: "SICK", fromDate: dateOnly(-3), toDate: dateOnly(-2), reason: "Viral fever, doctor advised rest.", status: "APPROVED", approverId: "usr-tam", decisionNote: "Get well soon.", createdAt: daysAgo(6) },
  { id: "lv-003", orgId: ORG_1, userId: "usr-em1", leaveType: "EARNED", fromDate: dateOnly(12), toDate: dateOnly(16), reason: "Planned vacation — Goa trip.", status: "PENDING", approverId: null, decisionNote: null, createdAt: daysAgo(0, -3) },
  { id: "lv-004", orgId: ORG_1, userId: "usr-ag2", leaveType: "UNPAID", fromDate: dateOnly(-15), toDate: dateOnly(-15), reason: "Personal work.", status: "REJECTED", approverId: "usr-tam", decisionNote: "Month-end closing week — please plan later.", createdAt: daysAgo(20) },
]));

// ─── Tasks ────────────────────────────────────────────────────

export const tasks: Task[] = persist("tasks", () => ([
  { id: "tsk-001", orgId: ORG_1, key: "ABS-1", type: "DOCUMENTS", status: "IN_PROGRESS", assignedToId: "usr-ta1", createdById: "usr-tam", title: "Collect documents from Karan Malhotra", description: "Offer released — need PAN, degree certificates and last 3 payslips before joining.\nShare the checklist on WhatsApp and track receipt here.", labels: ["joining", "documents"], watcherIds: ["usr-hr1"], startDate: dateOnly(-1), dueDate: dateOnly(1), estimateHours: 2, priority: "URGENT", relatedType: "CANDIDATE", relatedId: "cand-003", linkedApplicationId: "app-003", completed: false, createdAt: daysAgo(2), updatedAt: daysAgo(0, -2) },
  { id: "tsk-002", orgId: ORG_1, key: "ABS-2", type: "FOLLOW_UP", status: "TODO", assignedToId: "usr-ta1", createdById: "usr-tam", title: "Follow up: Amit Verma client round feedback", description: "TechNova promised feedback within 48 hours of the client round.", labels: ["client-feedback", "technova"], watcherIds: [], startDate: null, dueDate: dateOnly(0), estimateHours: 0.5, priority: "HIGH", relatedType: "CANDIDATE", relatedId: "cand-001", linkedApplicationId: "app-001", completed: false, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { id: "tsk-003", orgId: ORG_1, key: "ABS-3", type: "TASK", status: "IN_REVIEW", assignedToId: "usr-ta2", createdById: "usr-tam", title: "Source 5 more profiles for Risk Analyst", description: "FinEdge wants diverse banking backgrounds — at least 2 from cooperative banks.", labels: ["sourcing", "finedge"], watcherIds: ["usr-sa"], startDate: dateOnly(-3), dueDate: dateOnly(2), estimateHours: 6, priority: "HIGH", relatedType: "JOB", relatedId: "job-102", linkedApplicationId: null, completed: false, createdAt: daysAgo(3), updatedAt: daysAgo(0, -5) },
  { id: "tsk-004", orgId: ORG_1, key: "ABS-4", type: "TASK", status: "BLOCKED", assignedToId: "usr-ag1", createdById: "usr-tam", title: "Refer 3 candidates for ICU Nurse (MediCare)", description: "Urgent requisition pending approval — gather interest first, don't share salary yet.", labels: ["sourcing", "healthcare"], watcherIds: [], startDate: dateOnly(-1), dueDate: dateOnly(3), estimateHours: 4, priority: "MEDIUM", relatedType: "JOB", relatedId: "job-105", linkedApplicationId: null, completed: false, createdAt: daysAgo(1), updatedAt: daysAgo(0, -8) },
  { id: "tsk-005", orgId: ORG_1, key: "ABS-5", type: "TASK", status: "DONE", assignedToId: "usr-ta2", createdById: "usr-ta2", title: "Update candidate tracker sheet", description: null, labels: ["reporting"], watcherIds: [], startDate: null, dueDate: dateOnly(-1), estimateHours: 1, priority: "LOW", relatedType: null, relatedId: null, linkedApplicationId: null, completed: true, completedAt: daysAgo(1), createdAt: daysAgo(5), updatedAt: daysAgo(1) },
  { id: "tsk-006", orgId: ORG_1, key: "ABS-6", type: "DOCUMENTS", status: "TODO", assignedToId: "usr-em1", createdById: "usr-sa", title: "Prepare monthly ops report draft", description: "Cover placements, open requisitions and collections for September. Use last month's deck as the template.", labels: ["reporting", "monthly"], watcherIds: ["usr-fin1"], startDate: dateOnly(1), dueDate: dateOnly(4), estimateHours: 3, priority: "MEDIUM", relatedType: null, relatedId: null, linkedApplicationId: null, completed: false, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { id: "tsk-007", orgId: ORG_1, key: "ABS-7", type: "MEETING", status: "TODO", assignedToId: "usr-tam", createdById: "usr-sa", title: "Quarterly business review with TechNova", description: "Agenda: Q3 hiring numbers, SLA misses, renewal of the 8.33% commercial.", labels: ["client", "technova"], watcherIds: ["usr-fin1"], startDate: null, dueDate: dateOnly(5), estimateHours: 1.5, priority: "HIGH", relatedType: "CLIENT", relatedId: "cl-1", linkedApplicationId: null, completed: false, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { id: "tsk-008", orgId: ORG_1, key: "ABS-8", type: "TASK", status: "IN_PROGRESS", assignedToId: "usr-hr1", createdById: "usr-sa", title: "Roll out new leave policy for 2027", description: "Align casual/sick split with the Shops & Establishments Act and publish on the portal.", labels: ["policy", "hr"], watcherIds: ["usr-em1"], startDate: dateOnly(-2), dueDate: dateOnly(7), estimateHours: 8, priority: "MEDIUM", relatedType: null, relatedId: null, linkedApplicationId: null, completed: false, createdAt: daysAgo(4), updatedAt: daysAgo(0, -3) },
]));

export const taskComments: TaskComment[] = persist("taskComments", () => ([
  { id: "tcm-001", orgId: ORG_1, taskId: "tsk-001", authorId: "usr-tam", body: "Karan joins on the 15th, so we need everything by Friday latest.", mentionIds: [], createdAt: daysAgo(2, 1) },
  { id: "tcm-002", orgId: ORG_1, taskId: "tsk-001", authorId: "usr-ta1", body: "PAN and degree received. Waiting on payslips — he says his current employer is slow to issue them.", mentionIds: [], createdAt: daysAgo(0, -2) },
  { id: "tcm-003", orgId: ORG_1, taskId: "tsk-001", authorId: "usr-hr1", body: "@Rahul Sharma a bank statement showing salary credits works too if payslips are delayed.", mentionIds: ["usr-ta1"], createdAt: daysAgo(0, -1) },
  { id: "tcm-004", orgId: ORG_1, taskId: "tsk-003", authorId: "usr-ta2", body: "Shared 5 profiles in the tracker — 2 from Saraswat Bank, 1 from Cosmos. Ready for your review.", mentionIds: [], createdAt: daysAgo(0, -5) },
  { id: "tcm-005", orgId: ORG_1, taskId: "tsk-004", authorId: "usr-ag1", body: "Blocked until the requisition is approved — two nurses asked about salary and I couldn't confirm.", mentionIds: [], createdAt: daysAgo(0, -8) },
  { id: "tcm-006", orgId: ORG_1, taskId: "tsk-008", authorId: "usr-hr1", body: "First draft done. @Aarav Mehta please review the carry-forward rule before I publish.", mentionIds: ["usr-sa"], createdAt: daysAgo(0, -3) },
]));

export const taskActivity: TaskActivity[] = persist("taskActivity", () => ([
  { id: "tac-001", orgId: ORG_1, taskId: "tsk-001", actorId: "usr-tam", action: "CREATED", field: null, fromValue: null, toValue: null, createdAt: daysAgo(2) },
  { id: "tac-002", orgId: ORG_1, taskId: "tsk-001", actorId: "usr-ta1", action: "UPDATED", field: "status", fromValue: "TODO", toValue: "IN_PROGRESS", createdAt: daysAgo(1) },
  { id: "tac-003", orgId: ORG_1, taskId: "tsk-002", actorId: "usr-tam", action: "CREATED", field: null, fromValue: null, toValue: null, createdAt: daysAgo(1) },
  { id: "tac-004", orgId: ORG_1, taskId: "tsk-003", actorId: "usr-tam", action: "CREATED", field: null, fromValue: null, toValue: null, createdAt: daysAgo(3) },
  { id: "tac-005", orgId: ORG_1, taskId: "tsk-003", actorId: "usr-ta2", action: "UPDATED", field: "status", fromValue: "IN_PROGRESS", toValue: "IN_REVIEW", createdAt: daysAgo(0, -5) },
  { id: "tac-006", orgId: ORG_1, taskId: "tsk-004", actorId: "usr-tam", action: "CREATED", field: null, fromValue: null, toValue: null, createdAt: daysAgo(1) },
  { id: "tac-007", orgId: ORG_1, taskId: "tsk-004", actorId: "usr-ag1", action: "UPDATED", field: "status", fromValue: "TODO", toValue: "BLOCKED", createdAt: daysAgo(0, -8) },
  { id: "tac-008", orgId: ORG_1, taskId: "tsk-005", actorId: "usr-ta2", action: "CREATED", field: null, fromValue: null, toValue: null, createdAt: daysAgo(5) },
  { id: "tac-009", orgId: ORG_1, taskId: "tsk-005", actorId: "usr-ta2", action: "UPDATED", field: "status", fromValue: "TODO", toValue: "DONE", createdAt: daysAgo(1) },
  { id: "tac-010", orgId: ORG_1, taskId: "tsk-006", actorId: "usr-sa", action: "CREATED", field: null, fromValue: null, toValue: null, createdAt: daysAgo(2) },
  { id: "tac-011", orgId: ORG_1, taskId: "tsk-007", actorId: "usr-sa", action: "CREATED", field: null, fromValue: null, toValue: null, createdAt: daysAgo(1) },
  { id: "tac-012", orgId: ORG_1, taskId: "tsk-008", actorId: "usr-sa", action: "CREATED", field: null, fromValue: null, toValue: null, createdAt: daysAgo(4) },
  { id: "tac-013", orgId: ORG_1, taskId: "tsk-008", actorId: "usr-hr1", action: "UPDATED", field: "status", fromValue: "TODO", toValue: "IN_PROGRESS", createdAt: daysAgo(2) },
]));

// ─── Announcements ────────────────────────────────────────────

export const announcements: Announcement[] = persist("announcements", () => ([
  { id: "ann-001", orgId: ORG_1, title: "New referral incentive structure 🎉", body: "Effective immediately: ₹15,000 per successful IT placement referral and ₹25,000 for leadership roles. Payouts within 15 days of candidate completing 30 days.", audience: ["ALL"], pinned: true, createdById: "usr-sa", createdAt: daysAgo(7) },
  { id: "ann-002", orgId: ORG_1, title: "Office closed on Independence Day", body: "Mumbai office will remain closed on 15th August. Field visits can be scheduled with prior approval.", audience: ["AGENTS", "EMPLOYEES", "TA"], pinned: false, createdById: "usr-sa", createdAt: daysAgo(12) },
  { id: "ann-003", orgId: ORG_1, title: "MediCare Plus onboarding kickoff", body: "New healthcare client. TA team to complete agreement formalities by Friday. Requisitions will open next week.", audience: ["TA"], pinned: true, createdById: "usr-tam", createdAt: daysAgo(3) },
]));

// ─── Audit logs ───────────────────────────────────────────────

export const auditLogs: AuditLog[] = persist("auditLogs", () => ([
  { id: "aud-001", orgId: ORG_1, actorUserId: "usr-sa", actorRole: "SUPER_ADMIN", action: "JOB_APPROVED", entity: "JobRequisition", entityId: "job-102", detail: "Approved Risk Analyst requisition raised by Vikram Singh", createdAt: daysAgo(22) },
  { id: "aud-002", orgId: ORG_1, actorUserId: "usr-ta1", actorRole: "TA_RECRUITER", action: "STAGE_MOVED", entity: "Application", entityId: "app-003", detail: "Karan Malhotra: TECH_ROUND → OFFER_SENT", createdAt: daysAgo(5) },
  { id: "aud-003", orgId: ORG_1, actorUserId: "usr-sa", actorRole: "SUPER_ADMIN", action: "USER_SUSPENDED", entity: "User", entityId: "usr-ag3", detail: "Rohan Kapoor suspended — repeated fake referrals", createdAt: daysAgo(9) },
  { id: "aud-004", orgId: ORG_1, actorUserId: "usr-tam", actorRole: "TA_MANAGER", action: "CLIENT_CREATED", entity: "Client", entityId: "cl-3", detail: "Onboarded MediCare Plus (healthcare vertical)", createdAt: daysAgo(20) },
  { id: "aud-005", orgId: ORG_1, actorUserId: "usr-ta2", actorRole: "TA_RECRUITER", action: "INTERVIEW_SCHEDULED", entity: "Interview", entityId: "itr-003", detail: "Client round scheduled for Anjali Deshmukh @ RetailMart", createdAt: daysAgo(4) },
  { id: "aud-006", orgId: ORG_1, actorUserId: "usr-sa", actorRole: "SUPER_ADMIN", action: "PAYOUT_PROCESSED", entity: "Payout", entityId: "pay-001", detail: "₹25,000 referral payout to Vikram Singh (NEFT-889123)", createdAt: daysAgo(8) },
]));

// ─── Notifications ────────────────────────────────────────────

export const notifications: Notification[] = persist("notifications", () => ([
  { id: "ntf-1", orgId: ORG_1, userId: "usr-sa", title: "Job approval pending", message: "MediCare Plus raised 'Staff Nurse (ICU)' — needs your approval", link: "/admin/jobs", isRead: false, createdAt: daysAgo(0, 2) },
  { id: "ntf-2", orgId: ORG_1, userId: "usr-sa", title: "New referral submitted", message: "Vikram Singh referred Sameer Khan for Senior Backend Engineer", link: "/admin/referrals", isRead: false, createdAt: daysAgo(0, 5) },
  { id: "ntf-3", orgId: ORG_1, userId: "usr-sa", title: "Invoice overdue reminder", message: "INV-2026-041 (TechNova) payment due in 18 days", link: "/admin/finance", isRead: true, createdAt: daysAgo(3) },
  { id: "ntf-4", orgId: ORG_1, userId: "usr-ag1", title: "Referral shortlisted!", message: "Your referral Amit Verma moved to CLIENT_ROUND at TechNova", link: "/portal/referrals", isRead: false, createdAt: daysAgo(0, 1) },
  { id: "ntf-5", orgId: ORG_1, userId: "usr-ag1", title: "New task assigned", message: "Neha assigned you: Refer candidates for ICU Nurse", link: "/portal/tasks", isRead: false, createdAt: daysAgo(1) },
  { id: "ntf-6", orgId: ORG_1, userId: "usr-ta1", title: "Interview tomorrow", message: "Client round — Amit Verma @ 3:00 PM (video)", link: "/ta/interviews", isRead: false, createdAt: daysAgo(0, 3) },
]));

// ─── Sequence generators ──────────────────────────────────────


/** Next free "<prefix><n>" id in a collection (never collides, survives module re-evaluation). */
function nextId(prefix: string, list: { id: string }[], pad = 3): string {
  const max = list.reduce((m, x) => {
    if (!x.id.startsWith(prefix)) return m;
    const n = Number(x.id.slice(prefix.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(pad, "0")}`;
}

export const nextIds = {
  job: () => nextId("job-", jobs),
  client: () => nextId("cl-", clients),
  candidate: () => nextId("cand-", candidates),
  application: () => nextId("app-", applications),
  interview: () => nextId("itr-", interviews),
  referral: () => nextId("ref-", referrals),
  ledger: () => nextId("led-", commissionLedger),
  payout: () => nextId("pay-", payouts),
  attendance: () => nextId("att-", attendance, 1),
  task: () => nextId("tsk-", tasks),
  employee: () => nextId("emp-", employees),
  onboarding: () => nextId("onb-", onboardingRecords),
  payroll: () => nextId("prl-", payrollRecords),
  performance: () => nextId("perf-", performanceReviews),
  asset: () => nextId("ast-", assets),
  training: () => nextId("trn-", trainingPrograms),
  exit: () => nextId("ext-", exitRecords),
  document: () => nextId("doc-", documents),
};

export function addAudit(entry: Omit<AuditLog, "id" | "createdAt">) {
  auditLogs.unshift({ ...entry, id: `aud-${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString() });
}

export function addNotification(n: Omit<Notification, "id" | "createdAt" | "isRead">) {
  notifications.unshift({ ...n, id: `ntf-${crypto.randomUUID().slice(0, 8)}`, isRead: false, createdAt: new Date().toISOString() });
}

// ─── HRMIS Mock Data ─────────────────────────────────────────

export const departments = ["Engineering", "Human Resources", "Talent Acquisition", "Operations", "Finance", "Sales", "Marketing", "Leadership"];
export const designations = ["CEO", "CTO", "HR Lead", "HR Executive", "TA Manager", "Senior Recruiter", "Recruiter", "Talent Partner", "Ops Executive", "Accounts Associate", "Software Engineer", "Senior Developer", "Product Manager", "Designer"];

export const employees: Employee[] = persist("employees", () => ([
  { id: "emp-001", orgId: ORG_1, employeeId: "EMP-001", userId: "usr-sa", candidateId: null, name: "Aarav Mehta", email: "admin@absojob.com", phone: "+91 98200 11223", department: "Leadership", designation: "Founder & CEO", reportingManagerId: null, reportingManagerName: null, joiningDate: daysAgo(500).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "MALE", location: "Mumbai", workMode: "OFFICE", probationStatus: "CONFIRMED", personalDetails: { dob: "1988-03-15", maritalStatus: "Married", bloodGroup: "B+", currentAddress: "Andheri West, Mumbai", permanentAddress: "Andheri West, Mumbai" }, bankDetails: { accountName: "Aarav Mehta", accountNumber: "XXXX4421", bankName: "HDFC Bank", ifscCode: "HDFC0001234", panNumber: "XXXXX1234A" }, emergencyContact: { name: "Priya Mehta", relationship: "Spouse", phone: "+91 98200 11224" }, salary: { basic: 250000, hra: 100000, allowances: 50000, deductions: 45000, netMonthly: 355000, annualCtc: 4800000 }, createdAt: daysAgo(500), updatedAt: daysAgo(5) },
  { id: "emp-002", orgId: ORG_1, employeeId: "EMP-002", userId: "usr-hr1", candidateId: null, name: "Ananya Sen", email: "hr@absojob.com", phone: "+91 98111 99887", department: "Human Resources", designation: "HR Lead / People Ops", reportingManagerId: "emp-001", reportingManagerName: "Aarav Mehta", joiningDate: daysAgo(350).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "FEMALE", location: "Mumbai", workMode: "HYBRID", probationStatus: "CONFIRMED", personalDetails: { dob: "1992-07-22", maritalStatus: "Single", bloodGroup: "O+", currentAddress: "Lower Parel, Mumbai", permanentAddress: "Kolkata, WB" }, bankDetails: { accountName: "Ananya Sen", accountNumber: "XXXX5532", bankName: "ICICI Bank", ifscCode: "ICIC0002345", panNumber: "XXXXX2345B" }, emergencyContact: { name: "Ritu Sen", relationship: "Mother", phone: "+91 90001 11001" }, salary: { basic: 85000, hra: 34000, allowances: 15000, deductions: 14000, netMonthly: 120000, annualCtc: 1608000 }, createdAt: daysAgo(350), updatedAt: daysAgo(3) },
  { id: "emp-003", orgId: ORG_1, employeeId: "EMP-003", userId: "usr-tam", candidateId: null, name: "Neha Kulkarni", email: "neha@absojob.com", phone: "+91 98111 22334", department: "Talent Acquisition", designation: "TA Manager", reportingManagerId: "emp-001", reportingManagerName: "Aarav Mehta", joiningDate: daysAgo(420).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "FEMALE", location: "Mumbai", workMode: "OFFICE", probationStatus: "CONFIRMED", salary: { basic: 70000, hra: 28000, allowances: 12000, deductions: 12000, netMonthly: 98000, annualCtc: 1320000 }, createdAt: daysAgo(420), updatedAt: daysAgo(10) },
  { id: "emp-004", orgId: ORG_1, employeeId: "EMP-004", userId: "usr-ta1", candidateId: null, name: "Rahul Sharma", email: "rahul.ta@absojob.com", phone: "+91 98222 33445", department: "Talent Acquisition", designation: "Senior Recruiter", reportingManagerId: "emp-003", reportingManagerName: "Neha Kulkarni", joiningDate: daysAgo(300).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "MALE", location: "Mumbai", workMode: "HYBRID", probationStatus: "CONFIRMED", salary: { basic: 50000, hra: 20000, allowances: 8000, deductions: 8500, netMonthly: 69500, annualCtc: 936000 }, createdAt: daysAgo(300), updatedAt: daysAgo(8) },
  { id: "emp-005", orgId: ORG_1, employeeId: "EMP-005", userId: "usr-ta2", candidateId: null, name: "Priya Iyer", email: "priya.ta@absojob.com", phone: "+91 98333 44556", department: "Talent Acquisition", designation: "Recruiter", reportingManagerId: "emp-003", reportingManagerName: "Neha Kulkarni", joiningDate: daysAgo(210).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "FEMALE", location: "Pune", workMode: "REMOTE", probationStatus: "CONFIRMED", salary: { basic: 40000, hra: 16000, allowances: 6000, deductions: 7000, netMonthly: 55000, annualCtc: 744000 }, createdAt: daysAgo(210), updatedAt: daysAgo(5) },
  { id: "emp-006", orgId: ORG_1, employeeId: "EMP-006", userId: "usr-ag1", candidateId: null, name: "Vikram Singh", email: "vikram@absojob.com", phone: "+91 98444 55667", department: "Field", designation: "Senior Talent Partner", reportingManagerId: "emp-003", reportingManagerName: "Neha Kulkarni", joiningDate: daysAgo(280).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "MALE", location: "Bandra West, Mumbai", workMode: "OFFICE", probationStatus: "CONFIRMED", salary: { basic: 35000, hra: 14000, allowances: 5000, deductions: 6000, netMonthly: 48000, annualCtc: 648000 }, createdAt: daysAgo(280), updatedAt: daysAgo(6) },
  { id: "emp-007", orgId: ORG_1, employeeId: "EMP-007", userId: "usr-ag2", candidateId: null, name: "Sneha Patil", email: "sneha@absojob.com", phone: "+91 98555 66778", department: "Field", designation: "Talent Partner", reportingManagerId: "emp-003", reportingManagerName: "Neha Kulkarni", joiningDate: daysAgo(75).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "FEMALE", location: "Andheri West, Mumbai", workMode: "HYBRID", probationStatus: "ON_PROBATION", probationEndDate: dateOnly(15), salary: { basic: 30000, hra: 12000, allowances: 4000, deductions: 5000, netMonthly: 41000, annualCtc: 552000 }, createdAt: daysAgo(75), updatedAt: daysAgo(4) },
  { id: "emp-008", orgId: ORG_1, employeeId: "EMP-008", userId: "usr-em1", candidateId: null, name: "Kavya Nair", email: "kavya@absojob.com", phone: "+91 98777 88990", department: "Operations", designation: "Ops Executive", reportingManagerId: "emp-001", reportingManagerName: "Aarav Mehta", joiningDate: daysAgo(50).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "FEMALE", location: "Mumbai", workMode: "OFFICE", probationStatus: "ON_PROBATION", probationEndDate: dateOnly(40), salary: { basic: 28000, hra: 11200, allowances: 4000, deductions: 4800, netMonthly: 38400, annualCtc: 518400 }, createdAt: daysAgo(50), updatedAt: daysAgo(7) },
  { id: "emp-009", orgId: ORG_1, employeeId: "EMP-009", userId: "usr-em2", candidateId: null, name: "Arjun Desai", email: "arjun@absojob.com", phone: "+91 98888 99001", department: "Finance", designation: "Accounts Associate", reportingManagerId: "emp-001", reportingManagerName: "Aarav Mehta", joiningDate: daysAgo(480).split("T")[0], employmentType: "FULL_TIME", status: "EXITED", gender: "MALE", location: "Mumbai", workMode: "OFFICE", probationStatus: "CONFIRMED", salary: { basic: 32000, hra: 12800, allowances: 5000, deductions: 5500, netMonthly: 44300, annualCtc: 597600 }, createdAt: daysAgo(480), updatedAt: daysAgo(40) },
  { id: "emp-010", orgId: ORG_1, employeeId: "EMP-010", userId: null, candidateId: "can-01", name: "Rohan Verma", email: "rohan.v@absojob.com", phone: "+91 98666 11223", department: "Engineering", designation: "Full Stack Engineer", reportingManagerId: "emp-001", reportingManagerName: "Aarav Mehta", joiningDate: daysAgo(12).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "MALE", location: "Mumbai", workMode: "HYBRID", probationStatus: "ON_PROBATION", probationEndDate: dateOnly(78), salary: { basic: 65000, hra: 26000, allowances: 12000, deductions: 10000, netMonthly: 93000, annualCtc: 1250000 }, createdAt: daysAgo(12), updatedAt: daysAgo(2) },
  { id: "emp-011", orgId: ORG_1, employeeId: "EMP-011", userId: null, candidateId: "can-02", name: "Simran Kaur", email: "simran.k@absojob.com", phone: "+91 98777 22334", department: "Engineering", designation: "QA Automation Engineer", reportingManagerId: "emp-001", reportingManagerName: "Aarav Mehta", joiningDate: daysAgo(5).split("T")[0], employmentType: "FULL_TIME", status: "ACTIVE", gender: "FEMALE", location: "Pune", workMode: "REMOTE", probationStatus: "ON_PROBATION", probationEndDate: dateOnly(85), salary: { basic: 45000, hra: 18000, allowances: 8000, deductions: 7500, netMonthly: 63500, annualCtc: 850000 }, createdAt: daysAgo(5), updatedAt: daysAgo(1) },
]));

// ─── Onboarding Records ──────────────────────────────────────

export const onboardingRecords: OnboardingRecord[] = persist("onboardingRecords", () => ([
  {
    id: "onb-001", orgId: ORG_1, candidateId: candidates[2].id, applicationId: "app-003", jobId: "job-101",
    candidateName: candidates[2].name, candidateEmail: candidates[2].email, candidatePhone: candidates[2].phone,
    position: "Senior Backend Engineer", department: "Engineering", expectedJoiningDate: dateOnly(14), actualJoiningDate: null,
    status: "IN_PROGRESS", progressPercent: 55, assignedHrId: "usr-hr1", createdEmployeeId: null,
    checklist: [
      { id: "ck-1", title: "Personal Information", completed: true, completedAt: daysAgo(3) },
      { id: "ck-2", title: "Identity Documents", completed: true, requiredDoc: "PAN, Aadhaar", completedAt: daysAgo(2) },
      { id: "ck-3", title: "Address Verification", completed: true, completedAt: daysAgo(2) },
      { id: "ck-4", title: "Bank Details", completed: false },
      { id: "ck-5", title: "Employment Documents", completed: true, requiredDoc: "Relieving letter, payslips", completedAt: daysAgo(1) },
      { id: "ck-6", title: "Offer Acceptance", completed: true, completedAt: daysAgo(4) },
      { id: "ck-7", title: "Joining Formalities", completed: false },
      { id: "ck-8", title: "Asset Allocation", completed: false },
      { id: "ck-9", title: "Employee Account Creation", completed: false },
    ],
    notes: "Offer accepted. Awaiting bank details and joining formalities.",
    createdAt: daysAgo(5), updatedAt: daysAgo(1),
  },
  {
    id: "onb-002", orgId: ORG_1, candidateId: candidates[5].id, applicationId: "app-006", jobId: "job-104",
    candidateName: candidates[5].name, candidateEmail: candidates[5].email, candidatePhone: candidates[5].phone,
    position: "Category Manager", department: "Catalog", expectedJoiningDate: dateOnly(21), actualJoiningDate: null,
    status: "PENDING", progressPercent: 10, assignedHrId: "usr-hr1", createdEmployeeId: null,
    checklist: [
      { id: "ck-1", title: "Personal Information", completed: true, completedAt: daysAgo(1) },
      { id: "ck-2", title: "Identity Documents", completed: false },
      { id: "ck-3", title: "Address Verification", completed: false },
      { id: "ck-4", title: "Bank Details", completed: false },
      { id: "ck-5", title: "Employment Documents", completed: false },
      { id: "ck-6", title: "Offer Acceptance", completed: false },
      { id: "ck-7", title: "Joining Formalities", completed: false },
      { id: "ck-8", title: "Asset Allocation", completed: false },
      { id: "ck-9", title: "Employee Account Creation", completed: false },
    ],
    notes: null,
    createdAt: daysAgo(2), updatedAt: daysAgo(1),
  },
]));

// ─── Payroll Records ─────────────────────────────────────────

function seedPayroll(): PayrollRecord[] {
  const records: PayrollRecord[] = [];
  const months = ["2026-07", "2026-08", "2026-09"];
  const activeEmps = employees.filter((e) => e.status === "ACTIVE" && e.salary);
  let seq = 1;
  for (const month of months) {
    for (const emp of activeEmps) {
      const s = emp.salary!;
      const isPaid = month < "2026-09";
      records.push({
        id: `prl-${String(seq++).padStart(3, "0")}`,
        orgId: ORG_1,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employeeId,
        department: emp.department,
        month,
        basicSalary: s.basic,
        hra: s.hra,
        allowances: s.allowances,
        bonuses: 0,
        overtime: 0,
        deductions: s.deductions,
        tax: Math.round(s.basic * 0.1),
        netSalary: s.netMonthly,
        status: isPaid ? "PAID" : "DRAFT",
        paymentDate: isPaid ? `${month}-28` : null,
        paymentMethod: isPaid ? "BANK_TRANSFER" : null,
        payslipUrl: null,
      });
    }
  }
  return records;
}

export const payrollRecords: PayrollRecord[] = persist("payrollRecords", () => (seedPayroll()));

// ─── Performance Reviews ─────────────────────────────────────

export const performanceReviews: PerformanceReview[] = persist("performanceReviews", () => ([
  {
    id: "perf-001", orgId: ORG_1, employeeId: "emp-004", employeeName: "Rahul Sharma", department: "Talent Acquisition",
    reviewCycle: "H1 2026",
    goals: [
      { id: "g1", title: "Close 15 positions", description: "Fill open requisitions across clients", progress: 80, weightage: 40 },
      { id: "g2", title: "Reduce time-to-fill by 20%", description: "Improve sourcing efficiency", progress: 60, weightage: 30 },
      { id: "g3", title: "Build talent pipeline of 100+ candidates", description: "Database growth", progress: 90, weightage: 30 },
    ],
    managerFeedback: "Rahul has shown strong performance in closing positions. Needs improvement in candidate experience.",
    employeeFeedback: "I feel supported by the team. Would like more training opportunities.",
    rating: 4, status: "COMPLETED", promotionRecommended: false, incrementPercent: 12, updatedAt: daysAgo(15),
  },
  {
    id: "perf-002", orgId: ORG_1, employeeId: "emp-005", employeeName: "Priya Iyer", department: "Talent Acquisition",
    reviewCycle: "H1 2026",
    goals: [
      { id: "g1", title: "Source 50 qualified candidates", description: "Quality sourcing across job boards", progress: 70, weightage: 50 },
      { id: "g2", title: "Conduct 30 screening calls", description: "First-round assessments", progress: 85, weightage: 50 },
    ],
    managerFeedback: null, employeeFeedback: null, rating: null, status: "SELF_REVIEW",
    promotionRecommended: false, incrementPercent: null, updatedAt: daysAgo(5),
  },
]));

// ─── Assets ──────────────────────────────────────────────────

export const assets: AssetRecord[] = persist("assets", () => ([
  { id: "ast-001", orgId: ORG_1, assetTag: "AST-001", name: "MacBook Pro 16\" M3", category: "LAPTOP", serialNumber: "C02XG0ABCDEF", assignedEmployeeId: "emp-001", assignedEmployeeName: "Aarav Mehta", assignedDate: daysAgo(400).split("T")[0], condition: "EXCELLENT", status: "ASSIGNED", notes: null },
  { id: "ast-002", orgId: ORG_1, assetTag: "AST-002", name: "MacBook Air 13\" M2", category: "LAPTOP", serialNumber: "C02YD0GHIJKL", assignedEmployeeId: "emp-002", assignedEmployeeName: "Ananya Sen", assignedDate: daysAgo(340).split("T")[0], condition: "GOOD", status: "ASSIGNED", notes: null },
  { id: "ast-003", orgId: ORG_1, assetTag: "AST-003", name: "Dell XPS 15", category: "LAPTOP", serialNumber: "DELLXPS12345", assignedEmployeeId: "emp-004", assignedEmployeeName: "Rahul Sharma", assignedDate: daysAgo(290).split("T")[0], condition: "GOOD", status: "ASSIGNED", notes: null },
  { id: "ast-004", orgId: ORG_1, assetTag: "AST-004", name: "Dell Monitor 27\" 4K", category: "MONITOR", serialNumber: "DELLMON54321", assignedEmployeeId: "emp-001", assignedEmployeeName: "Aarav Mehta", assignedDate: daysAgo(400).split("T")[0], condition: "EXCELLENT", status: "ASSIGNED", notes: null },
  { id: "ast-005", orgId: ORG_1, assetTag: "AST-005", name: "iPhone 15 Pro", category: "MOBILE", serialNumber: "APL15P98765", assignedEmployeeId: "emp-003", assignedEmployeeName: "Neha Kulkarni", assignedDate: daysAgo(180).split("T")[0], condition: "EXCELLENT", status: "ASSIGNED", notes: "Company phone for TA calls" },
  { id: "ast-006", orgId: ORG_1, assetTag: "AST-006", name: "Lenovo ThinkPad", category: "LAPTOP", serialNumber: "LENVTP67890", assignedEmployeeId: null, assignedEmployeeName: null, assignedDate: null, condition: "GOOD", status: "AVAILABLE", notes: "Returned by Arjun Desai" },
  { id: "ast-007", orgId: ORG_1, assetTag: "AST-007", name: "Logitech MX Keys + Mouse", category: "ACCESSORY", serialNumber: "LOGMX11223", assignedEmployeeId: "emp-008", assignedEmployeeName: "Kavya Nair", assignedDate: daysAgo(150).split("T")[0], condition: "GOOD", status: "ASSIGNED", notes: null },
  { id: "ast-008", orgId: ORG_1, assetTag: "AST-008", name: "Employee ID Card", category: "ID_CARD", serialNumber: "ID-EMP-006", assignedEmployeeId: "emp-006", assignedEmployeeName: "Vikram Singh", assignedDate: daysAgo(270).split("T")[0], condition: "GOOD", status: "ASSIGNED", notes: null },
]));

// ─── Training Programs ───────────────────────────────────────

export const trainingPrograms: TrainingProgram[] = persist("trainingPrograms", () => ([
  { id: "trn-001", orgId: ORG_1, title: "Advanced Sourcing Techniques", course: "Recruitment Mastery", trainer: "External - LinkedIn Learning", startDate: dateOnly(7), endDate: dateOnly(14), enrolledEmployeeIds: ["emp-004", "emp-005", "emp-006", "emp-007"], status: "UPCOMING", selfEnrollOpen: true, description: "Improve Boolean search, X-ray search, and passive candidate engagement." },
  { id: "trn-002", orgId: ORG_1, title: "HR Compliance & Labour Law", course: "Legal & Compliance", trainer: "Ananya Sen", startDate: daysAgo(30).split("T")[0], endDate: daysAgo(28).split("T")[0], enrolledEmployeeIds: ["emp-002", "emp-003"], status: "COMPLETED", description: "Indian labour law basics, PF/ESI compliance, and documentation requirements." },
  { id: "trn-003", orgId: ORG_1, title: "Leadership Development Program", course: "Management", trainer: "External - Dale Carnegie", startDate: dateOnly(30), endDate: dateOnly(60), enrolledEmployeeIds: ["emp-003", "emp-004"], status: "UPCOMING", selfEnrollOpen: false, description: "Building leadership competencies for emerging managers." },
]));

// ─── Exit Records ────────────────────────────────────────────

export const exitRecords: ExitRecord[] = persist("exitRecords", () => ([
  {
    id: "ext-001", orgId: ORG_1, employeeId: "emp-009", employeeName: "Arjun Desai", department: "Finance",
    resignationDate: daysAgo(70).split("T")[0], noticePeriodDays: 30, lastWorkingDay: daysAgo(40).split("T")[0],
    reason: "Personal reasons — relocating to Bangalore.",
    status: "COMPLETED",
    exitInterviewNotes: "Good experience with the team. Leaving due to personal relocation. Would recommend AbsoJob.",
    clearanceChecklist: [
      { department: "Finance", cleared: true, clearedBy: "Aarav Mehta", clearedAt: daysAgo(42).split("T")[0], notes: null },
      { department: "IT", cleared: true, clearedBy: "Aarav Mehta", clearedAt: daysAgo(41).split("T")[0], notes: "Laptop returned" },
      { department: "HR", cleared: true, clearedBy: "Ananya Sen", clearedAt: daysAgo(40).split("T")[0], notes: null },
      { department: "Admin", cleared: true, clearedBy: "Kavya Nair", clearedAt: daysAgo(40).split("T")[0], notes: "ID card collected" },
    ],
    fnfSettled: true, fnfAmountInr: 87000, experienceLetterIssued: true,
  },
]));

// ─── Documents ───────────────────────────────────────────────

export const documents: DocumentRecord[] = persist("documents", () => ([
  { id: "doc-001", orgId: ORG_1, employeeId: "emp-001", employeeName: "Aarav Mehta", title: "PAN Card", category: "IDENTITY", fileUrl: "/docs/pan-aarav.pdf", fileSize: "420 KB", status: "VERIFIED", expiryDate: null, uploadedAt: daysAgo(490) },
  { id: "doc-002", orgId: ORG_1, employeeId: "emp-001", employeeName: "Aarav Mehta", title: "Aadhaar Card", category: "IDENTITY", fileUrl: "/docs/aadhaar-aarav.pdf", fileSize: "380 KB", status: "VERIFIED", expiryDate: null, uploadedAt: daysAgo(490) },
  { id: "doc-003", orgId: ORG_1, employeeId: "emp-002", employeeName: "Ananya Sen", title: "Offer Letter", category: "OFFER_LETTER", fileUrl: "/docs/offer-ananya.pdf", fileSize: "250 KB", status: "VERIFIED", expiryDate: null, uploadedAt: daysAgo(345) },
  { id: "doc-004", orgId: ORG_1, employeeId: "emp-004", employeeName: "Rahul Sharma", title: "Appointment Letter", category: "APPOINTMENT_LETTER", fileUrl: "/docs/appointment-rahul.pdf", fileSize: "310 KB", status: "VERIFIED", expiryDate: null, uploadedAt: daysAgo(295) },
  { id: "doc-005", orgId: ORG_1, employeeId: "emp-009", employeeName: "Arjun Desai", title: "Experience Letter", category: "EXPERIENCE_LETTER", fileUrl: "/docs/exp-arjun.pdf", fileSize: "280 KB", status: "VERIFIED", expiryDate: null, uploadedAt: daysAgo(38) },
  { id: "doc-006", orgId: ORG_1, employeeId: "emp-006", employeeName: "Vikram Singh", title: "Bank Account Proof", category: "BANK_DOC", fileUrl: "/docs/bank-vikram.pdf", fileSize: "190 KB", status: "PENDING", expiryDate: null, uploadedAt: daysAgo(2) },
  { id: "doc-007", orgId: ORG_1, employeeId: null, employeeName: null, title: "Employee Handbook 2026", category: "POLICY", fileUrl: "/docs/handbook-2026.pdf", fileSize: "2.1 MB", status: "VERIFIED", expiryDate: null, uploadedAt: daysAgo(60) },
]));

// ─── Placements (Recruitment Lifecycle Completion) ────────────

export const placements: PlacementRecord[] = persist("placements", () => ([
  {
    id: "plc-001",
    orgId: ORG_1,
    candidateId: candidates[0]?.id || "can-1",
    candidateName: candidates[0]?.name || "Amit Verma",
    clientId: "cl-1",
    clientName: "TechNova Systems",
    jobId: "job-101",
    jobTitle: "Senior Backend Engineer (Node.js)",
    recruiterId: "usr-ta1",
    recruiterName: "Rahul Sharma",
    accountManagerName: "Neha Kulkarni",
    placementDate: daysAgo(12),
    offeredPosition: "Lead Backend Developer",
    offeredSalaryLpa: 24.5,
    joiningDate: daysAhead(10),
    joiningStatus: "JOINING_PENDING",
    revenueInr: 204000,
    invoiceId: "inv-2026-051",
    invoiceNumber: "INV-2026-051",
    guaranteePeriodDays: 90,
    guaranteeEndDate: daysAhead(100),
    replacementStatus: "NO_REPLACEMENT",
    notes: "Offer accepted; pre-boarding kit dispatched.",
    createdAt: daysAgo(12),
  },
  {
    id: "plc-002",
    orgId: ORG_1,
    candidateId: candidates[2]?.id || "can-3",
    candidateName: candidates[2]?.name || "Fatima Sheikh",
    clientId: "cl-1",
    clientName: "TechNova Systems",
    jobId: "job-103",
    jobTitle: "DevOps Engineer",
    recruiterId: "usr-ta1",
    recruiterName: "Rahul Sharma",
    accountManagerName: "Neha Kulkarni",
    placementDate: daysAgo(35),
    offeredPosition: "DevOps Engineer",
    offeredSalaryLpa: 19.0,
    joiningDate: daysAgo(15),
    joiningStatus: "JOINED",
    revenueInr: 187000,
    invoiceId: "led-001",
    invoiceNumber: "INV-2026-041",
    guaranteePeriodDays: 90,
    guaranteeEndDate: daysAhead(75),
    replacementStatus: "NO_REPLACEMENT",
    notes: "Successfully completed 2 weeks; client feedback outstanding.",
    createdAt: daysAgo(35),
  },
  {
    id: "plc-003",
    orgId: ORG_1,
    candidateId: candidates[6]?.id || "can-7",
    candidateName: candidates[6]?.name || "Mohit Sinha",
    clientId: "cl-4",
    clientName: "RetailMart India",
    jobId: "job-104",
    jobTitle: "Category Manager",
    recruiterId: "usr-ta2",
    recruiterName: "Priya Iyer",
    accountManagerName: "Neha Kulkarni",
    placementDate: daysAgo(50),
    offeredPosition: "Senior Category Specialist",
    offeredSalaryLpa: 16.5,
    joiningDate: daysAgo(25),
    joiningStatus: "JOINED",
    revenueInr: 144000,
    invoiceId: "led-003",
    invoiceNumber: "INV-2026-032",
    guaranteePeriodDays: 60,
    guaranteeEndDate: daysAhead(35),
    replacementStatus: "NO_REPLACEMENT",
    notes: "Candidate relocated to Mumbai and commenced role.",
    createdAt: daysAgo(50),
  },
  {
    id: "plc-004",
    orgId: ORG_1,
    candidateId: candidates[3]?.id || "can-4",
    candidateName: candidates[3]?.name || "Ritika Bansal",
    clientId: "cl-2",
    clientName: "FinEdge Capital",
    jobId: "job-102",
    jobTitle: "Risk Analyst",
    recruiterId: "usr-ta2",
    recruiterName: "Priya Iyer",
    accountManagerName: "Neha Kulkarni",
    placementDate: daysAgo(5),
    offeredPosition: "Risk Analyst II",
    offeredSalaryLpa: 14.0,
    joiningDate: daysAhead(18),
    joiningStatus: "JOINING_PENDING",
    revenueInr: 140000,
    invoiceId: null,
    invoiceNumber: null,
    guaranteePeriodDays: 90,
    guaranteeEndDate: daysAhead(108),
    replacementStatus: "NO_REPLACEMENT",
    notes: "Serving notice at current employer until end of month.",
    createdAt: daysAgo(5),
  },
  {
    id: "plc-005",
    orgId: ORG_1,
    candidateId: candidates[5]?.id || "can-6",
    candidateName: candidates[5]?.name || "Vikramaditya Roy",
    clientId: "cl-6",
    clientName: "LogiSwift Logistics",
    jobId: "job-107",
    jobTitle: "Logistics Analyst",
    recruiterId: "usr-ta1",
    recruiterName: "Rahul Sharma",
    accountManagerName: "Neha Kulkarni",
    placementDate: daysAgo(60),
    offeredPosition: "Fleet Analytics Associate",
    offeredSalaryLpa: 8.5,
    joiningDate: daysAgo(40),
    joiningStatus: "CANCELLED",
    revenueInr: 0,
    invoiceId: "led-006",
    invoiceNumber: "CN-2026-004",
    guaranteePeriodDays: 45,
    guaranteeEndDate: daysAgo(5),
    replacementStatus: "REPLACEMENT_IN_PROGRESS",
    notes: "Candidate backed out on Day 14 due to competing counter-offer; replacement candidate sourcing active.",
    createdAt: daysAgo(60),
  }
]));

// ─── Client Leads (Sales Pipeline) ────────────────────────────

export const clientLeads: ClientLead[] = persist("clientLeads", () => ([
  {
    id: "lead-001",
    orgId: ORG_1,
    companyName: "Nexus HealthTech",
    contactPerson: "Dr. Alok Verma",
    email: "alok@nexushealth.in",
    phone: "+91 99200 44551",
    industry: "HealthTech / SaaS",
    location: "Bangalore",
    leadSource: "LINKEDIN",
    assignedToName: "Neha Kulkarni",
    assignedToId: "usr-tam",
    stage: "PROPOSAL",
    expectedPositions: 8,
    expectedAnnualValueLpa: 36.0,
    priority: "HIGH",
    nextFollowUpDate: daysAhead(2),
    notes: "Need tech squad hiring for Series-A expansion. Commercial proposal sent for 8.33% CTC fee.",
    createdAt: daysAgo(14),
    updatedAt: daysAgo(1),
  },
  {
    id: "lead-002",
    orgId: ORG_1,
    companyName: "Zenith Wealth Management",
    contactPerson: "Preeti Shenoy",
    email: "preeti@zenithwealth.com",
    phone: "+91 98210 77889",
    industry: "Financial Services",
    location: "Mumbai (BKC)",
    leadSource: "OUTBOUND",
    assignedToName: "Aarav Mehta",
    assignedToId: "usr-sa",
    stage: "NEGOTIATION",
    expectedPositions: 4,
    expectedAnnualValueLpa: 28.5,
    priority: "URGENT",
    nextFollowUpDate: daysAhead(1),
    notes: "MSA under contract review. Negotiating 45-day credit period vs requested 60-day.",
    createdAt: daysAgo(21),
    updatedAt: daysAgo(2),
  },
  {
    id: "lead-003",
    orgId: ORG_1,
    companyName: "HyperDrive Logistics",
    contactPerson: "Vikrant Sawant",
    email: "vikrant@hyperdrive.ai",
    phone: "+91 97690 33112",
    industry: "Logistics & Supply Chain",
    location: "Pune",
    leadSource: "INBOUND_WEB",
    assignedToName: "Neha Kulkarni",
    assignedToId: "usr-tam",
    stage: "QUALIFIED",
    expectedPositions: 12,
    expectedAnnualValueLpa: 22.0,
    priority: "MEDIUM",
    nextFollowUpDate: daysAhead(4),
    notes: "Warehouse supervisors and backend Python engineers needed next quarter.",
    createdAt: daysAgo(8),
    updatedAt: daysAgo(3),
  },
  {
    id: "lead-004",
    orgId: ORG_1,
    companyName: "KuberPay Microfinance",
    contactPerson: "Ganesh Kadam",
    email: "gkadam@kuberpay.co",
    phone: "+91 98199 00112",
    industry: "Banking / Fintech",
    location: "Navi Mumbai",
    leadSource: "REFERRAL",
    assignedToName: "Aarav Mehta",
    assignedToId: "usr-sa",
    stage: "CONVERTED",
    expectedPositions: 6,
    expectedAnnualValueLpa: 18.0,
    priority: "MEDIUM",
    nextFollowUpDate: daysAgo(5),
    notes: "Successfully signed agreement! Account active in CRM.",
    convertedClientId: "cl-2",
    createdAt: daysAgo(45),
    updatedAt: daysAgo(5),
  },
  {
    id: "lead-005",
    orgId: ORG_1,
    companyName: "QuickMart Quick Commerce",
    contactPerson: "Tanvi Saraf",
    email: "tanvi.s@quickmart.in",
    phone: "+91 99300 12345",
    industry: "Retail / E-commerce",
    location: "Gurgaon",
    leadSource: "EVENT",
    assignedToName: "Neha Kulkarni",
    assignedToId: "usr-tam",
    stage: "MEETING",
    expectedPositions: 15,
    expectedAnnualValueLpa: 42.0,
    priority: "HIGH",
    nextFollowUpDate: daysAhead(3),
    notes: "Exploratory call scheduled with Head of TA for pan-India store operations.",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
  },
]));

// ─── Approvals (Control Center) ───────────────────────────────

export const approvals: ApprovalRequest[] = persist("approvals", () => ([
  {
    id: "appr-001",
    orgId: ORG_1,
    type: "JOB_REQUISITION",
    title: "Requisition Sign-off: Staff Nurse (ICU) — 5 Openings",
    requestedById: "usr-ag1",
    requestedByName: "Vikram Singh",
    requestedByRole: "Talent Partner / Agent",
    date: daysAgo(2),
    priority: "URGENT",
    relatedRecordType: "JOB",
    relatedRecordId: "job-105",
    relatedRecordName: "Staff Nurse (ICU) @ MediCare Plus",
    description: "Urgent healthcare client request with 5 openings. Minimum budget 3.5 LPA - Max 6 LPA.",
    status: "PENDING",
  },
  {
    id: "appr-002",
    orgId: ORG_1,
    type: "SALARY_EXCEPTION",
    title: "Salary Band Exception: Senior Backend Engineer (Node.js)",
    requestedById: "usr-ta1",
    requestedByName: "Rahul Sharma",
    requestedByRole: "Senior Recruiter",
    date: daysAgo(1),
    priority: "HIGH",
    relatedRecordType: "CANDIDATE",
    relatedRecordId: "can-1",
    relatedRecordName: "Amit Verma (TechNova)",
    description: "Candidate counter-offered at 24.5 LPA which exceeds standard median band (22 LPA) by 11.3%. Justified by tier-1 tech lead rating.",
    status: "PENDING",
  },
  {
    id: "appr-003",
    orgId: ORG_1,
    type: "INVOICE_APPROVAL",
    title: "Invoice Generation: INV-2026-051 (TechNova ₹2,04,000)",
    requestedById: "usr-tam",
    requestedByName: "Neha Kulkarni",
    requestedByRole: "TA Manager",
    date: daysAgo(0, -5),
    priority: "MEDIUM",
    relatedRecordType: "INVOICE",
    relatedRecordId: "led-001",
    relatedRecordName: "TechNova Systems (Amit Verma Placement)",
    description: "Placement billing at 8.33% on offered CTC ₹24.5L with standard 30-day payment term.",
    status: "PENDING",
  },
  {
    id: "appr-004",
    orgId: ORG_1,
    type: "JOB_REQUISITION",
    title: "Requisition Sign-off: QA Automation Engineer — 2 Openings",
    requestedById: "usr-ta1",
    requestedByName: "Rahul Sharma",
    requestedByRole: "Senior Recruiter",
    date: daysAgo(8),
    priority: "MEDIUM",
    relatedRecordType: "JOB",
    relatedRecordId: "job-108",
    relatedRecordName: "QA Automation Engineer @ TechNova",
    description: "Approved for contract hire 12-month tenure.",
    status: "APPROVED",
    reviewedById: "usr-sa",
    reviewedByName: "Aarav Mehta",
    reviewedAt: daysAgo(7),
    reviewComment: "Approved. Prioritize immediate joiners.",
  },
  {
    id: "appr-005",
    orgId: ORG_1,
    type: "EXPENSE_APPROVAL",
    title: "Subscription Renewal: LinkedIn Recruiter Corporate Seat (Q3)",
    requestedById: "usr-tam",
    requestedByName: "Neha Kulkarni",
    requestedByRole: "TA Manager",
    date: daysAgo(14),
    priority: "HIGH",
    relatedRecordType: "EXPENSE",
    relatedRecordId: "exp-rec-09",
    relatedRecordName: "LinkedIn Talent Solutions ₹85,000",
    description: "Quarterly seat license renewal for TA Squad.",
    status: "APPROVED",
    reviewedById: "usr-sa",
    reviewedByName: "Aarav Mehta",
    reviewedAt: daysAgo(13),
    reviewComment: "Processed via HDFC Corporate Card.",
  },
]));

// ─── Compliance Center ────────────────────────────────────────

export const complianceItems: ComplianceItem[] = persist("complianceItems", () => ([
  {
    id: "cmp-001",
    orgId: ORG_1,
    category: "DOCUMENT_EXPIRY",
    title: "Medical Certificate / Nursing Council Registration Expiring",
    entityType: "CANDIDATE",
    entityId: "can-8",
    entityName: "Sister Mary Thomas",
    severity: "CRITICAL",
    dueDate: daysAhead(5),
    status: "OPEN",
    detail: "State Nursing Council registration validity expires within 10 days. Renewal proof needed before client hospital onboarding.",
    lastUpdated: daysAgo(1),
  },
  {
    id: "cmp-002",
    orgId: ORG_1,
    category: "CONSENT",
    title: "Explicit Data Processing Consent Awaiting Renewal",
    entityType: "CANDIDATE",
    entityId: "can-4",
    entityName: "Ritika Bansal",
    severity: "WARNING",
    dueDate: daysAhead(14),
    status: "OPEN",
    detail: "Candidate profile older than 180 days requires re-affirmation of DPDP Act 2023 candidate consent before next banking submission.",
    lastUpdated: daysAgo(3),
  },
  {
    id: "cmp-003",
    orgId: ORG_1,
    category: "MISSING_DOC",
    title: "PAN & Relieving Letter Missing from Ex-Employee",
    entityType: "EMPLOYEE",
    entityId: "emp-009",
    entityName: "Arjun Desai",
    severity: "WARNING",
    dueDate: daysAhead(8),
    status: "OPEN",
    detail: "Signed physical clearance form pending archiving for statutory audit compliance.",
    lastUpdated: daysAgo(4),
  },
  {
    id: "cmp-004",
    orgId: ORG_1,
    category: "DATA_REQUEST",
    title: "Right to be Forgotten (Data Erasure Request)",
    entityType: "CANDIDATE",
    entityId: "can-11",
    entityName: "Candidate CAN-0992",
    severity: "CRITICAL",
    dueDate: daysAhead(3),
    status: "OPEN",
    detail: "Candidate requested erasure of resume and phone records via privacy contact channel.",
    lastUpdated: daysAgo(1),
  },
  {
    id: "cmp-005",
    orgId: ORG_1,
    category: "RETENTION",
    title: "Archival Policy Audit: 2024 Inactive Profiles (140 records)",
    entityType: "CANDIDATE",
    entityId: "batch-2024",
    entityName: "Batch 2024 Candidates",
    severity: "PENDING",
    dueDate: daysAhead(30),
    status: "IN_REVIEW",
    detail: "Statutory 2-year retention period expiring for candidates with no interview activity.",
    lastUpdated: daysAgo(7),
  },
]));

// ─── Data Quality Center ──────────────────────────────────────

export const dataQualityIssues: DataQualityIssue[] = persist("dataQualityIssues", () => ([
  {
    id: "dq-001",
    orgId: ORG_1,
    type: "DUPLICATE_CANDIDATE",
    title: "Potential Duplicate Candidate Profile (Email & Phone match)",
    entityType: "CANDIDATE",
    entityId: "can-2",
    entityName: "Divya Sharma",
    severity: "HIGH",
    details: "Detected second profile entered via external job board matching +91 90122 20202 and divya.s@outlook.com.",
    suggestedAction: "Merge profiles and consolidate application history into CAN-8922.",
    createdAt: daysAgo(2),
  },
  {
    id: "dq-002",
    orgId: ORG_1,
    type: "MISSING_RESUME",
    title: "Candidate Active in Pipeline Without Attached Resume",
    entityType: "CANDIDATE",
    entityId: "can-5",
    entityName: "Karan Malhotra",
    severity: "HIGH",
    details: "Candidate moved to Interview stage without downloadable PDF/DOC resume in system.",
    suggestedAction: "Request recruiter Rahul Sharma to upload latest verified resume.",
    createdAt: daysAgo(1),
  },
  {
    id: "dq-003",
    orgId: ORG_1,
    type: "INCOMPLETE_PROFILE",
    title: "Incomplete Compensation and Notice Period Details",
    entityType: "CANDIDATE",
    entityId: "can-9",
    entityName: "Anil Kulkarni",
    severity: "MEDIUM",
    details: "Current fixed CTC and notice period left blank during rapid bulk import.",
    suggestedAction: "Update candidate card before submitting to TechNova requisition.",
    createdAt: daysAgo(4),
  },
  {
    id: "dq-004",
    orgId: ORG_1,
    type: "INVALID_CONTACT",
    title: "Invalid Phone Number Format",
    entityType: "CANDIDATE",
    entityId: "can-10",
    entityName: "Rajesh Rao",
    severity: "LOW",
    details: "Phone number contains 9 digits without country code: 981122334.",
    suggestedAction: "Verify contact and format to standard +91 10-digit mobile number.",
    createdAt: daysAgo(5),
  },
  {
    id: "dq-005",
    orgId: ORG_1,
    type: "DUPLICATE_CLIENT",
    title: "Duplicate Client Entry: TechNova vs TechNova Systems Pvt Ltd",
    entityType: "CLIENT",
    entityId: "cl-1",
    entityName: "TechNova Systems",
    severity: "MEDIUM",
    details: "Second draft client profile registered with matching domain technova.io.",
    suggestedAction: "Merge client contacts into primary master account cl-1.",
    createdAt: daysAgo(6),
  },
]));

// ─── Integrations Hub ─────────────────────────────────────────

export const integrationServices: IntegrationService[] = persist("integrationServices", () => ([
  {
    id: "int-001",
    orgId: ORG_1,
    name: "Google Workspace / Gmail",
    category: "COMMUNICATION",
    provider: "Google",
    status: "CONNECTED",
    connectedAccount: "admin@absojob.com",
    lastSyncAt: daysAgo(0, -1),
    icon: "Mail",
    description: "Two-way email synchronization for candidate outreach and automated client communications.",
    configSummary: "Sync enabled for 6 recruiters · OAuth 2.0 active",
  },
  {
    id: "int-002",
    orgId: ORG_1,
    name: "WhatsApp Business API",
    category: "COMMUNICATION",
    provider: "Meta",
    status: "CONNECTED",
    connectedAccount: "+91 98200 11223 (Verified Business)",
    lastSyncAt: daysAgo(0, -2),
    icon: "MessageSquare",
    description: "Automated candidate interview reminders, offer dispatch alerts, and chatbot screening.",
    configSummary: "Template messages approved · 1,420 monthly credits used",
  },
  {
    id: "int-003",
    orgId: ORG_1,
    name: "Google Meet & Calendar",
    category: "CALENDAR",
    provider: "Google",
    status: "CONNECTED",
    connectedAccount: "calendar@absojob.com",
    lastSyncAt: daysAgo(0, -1),
    icon: "Calendar",
    description: "Direct generation of video interview links and recruiter schedule synchronization.",
    configSummary: "Auto-generate video links enabled",
  },
  {
    id: "int-004",
    orgId: ORG_1,
    name: "Naukri.com / Job Portal Bridge",
    category: "RECRUITMENT",
    provider: "Info Edge",
    status: "NEEDS_ATTENTION",
    connectedAccount: "absojob_recruiter_super",
    lastSyncAt: daysAgo(1),
    icon: "Briefcase",
    description: "Candidate CV search and job requisition multi-posting bridge.",
    configSummary: "Daily quota: 180 / 250 CV views used · Token refresh recommended",
  },
  {
    id: "int-005",
    orgId: ORG_1,
    name: "LinkedIn Talent Hub / InMail",
    category: "RECRUITMENT",
    provider: "LinkedIn",
    status: "CONNECTED",
    connectedAccount: "company/absojob",
    lastSyncAt: daysAgo(0, -3),
    icon: "Linkedin",
    description: "Candidate profile auto-import and direct recruiter InMail messaging.",
    configSummary: "Enterprise Recruiter seat connected",
  },
  {
    id: "int-006",
    orgId: ORG_1,
    name: "Razorpay / Bank Payouts Gateway",
    category: "FINANCE",
    provider: "Razorpay",
    status: "CONNECTED",
    connectedAccount: "acc_AbsoJob_Live_9821",
    lastSyncAt: daysAgo(0, -4),
    icon: "CreditCard",
    description: "Automated agent referral incentive payouts and placement commission invoicing.",
    configSummary: "Instant IMPS/UPI transfers enabled",
  },
  {
    id: "int-007",
    orgId: ORG_1,
    name: "AWS S3 Cloud Storage",
    category: "STORAGE",
    provider: "Amazon Web Services",
    status: "CONNECTED",
    connectedAccount: "s3://absojob-prod-resumes-ap-south-1",
    lastSyncAt: daysAgo(0, -1),
    icon: "Cloud",
    description: "Encrypted candidate resume storage, government ID proof vault, and compliance archives.",
    configSummary: "AES-256 server-side encryption · 42 GB stored",
  },
  {
    id: "int-008",
    orgId: ORG_1,
    name: "Webhook Dispatcher & Zapier",
    category: "TECHNICAL",
    provider: "Custom Webhook",
    status: "CONNECTED",
    connectedAccount: "https://hooks.absojob.com/v1/events",
    lastSyncAt: daysAgo(0, -1),
    icon: "Zap",
    description: "Real-time event streaming for Candidate Joined, Offer Released, and Invoices Paid.",
    configSummary: "3 active webhooks · 100% delivery rate",
  },
]));

// ─── Organization Settings Seed ──────────────────────────────

export const organizationSettingsSeed: Record<string, any> = persist("organizationSettingsSeed", () => ({
  [ORG_1]: {
    orgId: ORG_1,
    agencyName: "AbsoJob Global Workforce Ltd",
    legalName: "AbsoJob Human Resources Technologies Private Limited",
    registrationNumber: "U74999MH2024PTC398210",
    gstin: "27AABCA1234F1Z8",
    panNumber: "AABCA1234F",
    website: "https://absojob.com",
    primaryEmail: "admin@absojob.com",
    billingEmail: "accounts@absojob.com",
    supportPhone: "+91 98765 43210",
    registeredAddress: "BKC Horizon Tower, 8th Floor, Bandra Kurla Complex, Mumbai, Maharashtra 400051",
    country: "India",
    city: "Mumbai",
    postalCode: "400051",
    businessType: "Recruitment & Staffing Agency",
    timezone: "Asia/Kolkata (IST +05:30)",
    primaryCurrency: "INR",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12 Hours (AM/PM)",
    fiscalYearStart: "April",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    workStartTime: "09:30",
    workEndTime: "18:30",
    gracePeriodMinutes: 15,
    defaultSlaDays: 30,
    interviewFeedbackSlaHours: 24,
    candidateSubmissionSlaDays: 2,
    autoShortlistThresholdScore: 75,
    duplicateCandidateMatchBy: "EMAIL_PHONE",
    defaultCommissionRate: 8.33,
    invoicePrefix: "ABS-INV-2026-",
    defaultCreditPeriodDays: 30,
    taxGstRatePercent: 18.0,
    bankAccountName: "AbsoJob Global Workforce Ltd - Current A/c",
    bankAccountNumber: "50200088912345",
    bankIfscCode: "HDFC0000060",
    bankName: "HDFC Bank, BKC Branch",
    paymentInstructions: "Payment due within 30 days of invoice date. Remit via NEFT/RTGS to the stated account.",
    mfaEnforcement: "ADMINS_ONLY",
    minPasswordLength: 8,
    sessionTimeoutMinutes: 120,
    failedLoginLockoutAttempts: 5,
    maintenanceMode: false,
    maintenanceReason: "",
    branches: [
      {
        id: "br-mum",
        name: "Mumbai Headquarters",
        code: "BOM-HQ",
        address: "BKC Horizon Tower, 8th Floor, Mumbai",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        phone: "+91 98200 11223",
        email: "mumbai@absojob.com",
        timezone: "Asia/Kolkata",
        currency: "INR",
        branchHeadName: "Aarav Mehta",
        status: "ACTIVE"
      },
      {
        id: "br-blr",
        name: "Bengaluru Tech Hub",
        code: "BLR-01",
        address: "Prestige Tech Park, Marathahalli-Sarjapur Ring Rd, Bengaluru",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        phone: "+91 80220 99881",
        email: "bangalore@absojob.com",
        timezone: "Asia/Kolkata",
        currency: "INR",
        branchHeadName: "Vikram Rao",
        status: "ACTIVE"
      },
      {
        id: "br-dxb",
        name: "Dubai Executive Branch",
        code: "DXB-01",
        address: "DIFC Gate Avenue, Level 4, Dubai",
        city: "Dubai",
        state: "Dubai",
        country: "United Arab Emirates",
        phone: "+971 4 312 9988",
        email: "middleeast@absojob.com",
        timezone: "Asia/Dubai",
        currency: "AED",
        branchHeadName: "Tariq Mansoor",
        status: "ACTIVE"
      }
    ],
    commissionRules: [
      { id: "cm-01", clientType: "ALL", placementType: "PERMANENT", ratePercent: 8.33, guaranteePeriodDays: 90, replacementWindowDays: 30, effectiveFrom: "2026-01-01", notes: "Standard 1-month CTC permanent placement tier" },
      { id: "cm-02", clientType: "ENTERPRISE", placementType: "EXECUTIVE", ratePercent: 12.5, guaranteePeriodDays: 120, replacementWindowDays: 45, effectiveFrom: "2026-01-01", notes: "Leadership & VP+ retained search fee" },
      { id: "cm-03", clientType: "STAFFING", placementType: "CONTRACT", ratePercent: 15.0, guaranteePeriodDays: 30, replacementWindowDays: 15, effectiveFrom: "2026-01-01", notes: "Monthly contract pass-through margin" }
    ],
    pipelineStages: [
      { id: "stg-1", name: "Sourced", code: "SOURCED", order: 1, color: "#64748b", active: true, requiresReason: false, requiresFeedback: false, slaHours: 24 },
      { id: "stg-2", name: "Screening", code: "SCREENING", order: 2, color: "#0284c7", active: true, requiresReason: false, requiresFeedback: true, slaHours: 48 },
      { id: "stg-3", name: "Interview Scheduled", code: "INTERVIEW_SCHEDULED", order: 3, color: "#0891b2", active: true, requiresReason: false, requiresFeedback: true, slaHours: 72 },
      { id: "stg-4", name: "Technical Evaluation", code: "TECH_ROUND", order: 4, color: "#7c3aed", active: true, requiresReason: false, requiresFeedback: true, slaHours: 48 },
      { id: "stg-5", name: "Client Interview", code: "CLIENT_ROUND", order: 5, color: "#4f46e5", active: true, requiresReason: false, requiresFeedback: true, slaHours: 48 },
      { id: "stg-6", name: "Offer Released", code: "OFFER_SENT", order: 6, color: "#d97706", active: true, requiresReason: false, requiresFeedback: false, slaHours: 48 },
      { id: "stg-7", name: "Placement Joined", code: "JOINED", order: 7, color: "#059669", active: true, requiresReason: false, requiresFeedback: false, slaHours: 0 }
    ],
    customFields: [
      { id: "cf-1", module: "CANDIDATE", label: "Willingness to Relocate Overseas", key: "willing_relocate_overseas", fieldType: "BOOLEAN", required: false, defaultValue: "false" },
      { id: "cf-2", module: "JOB", label: "Client Rate Card Category", key: "rate_card_category", fieldType: "DROPDOWN", required: false, options: ["Tier-1 Strategic", "Standard", "Volume Staffing"] },
      { id: "cf-3", module: "CANDIDATE", label: "Target Tech Stack Specialty", key: "tech_stack_specialty", fieldType: "TEXT", required: false }
    ],
    masterData: [
      { id: "md-1", category: "CANDIDATE_SOURCE", label: "LinkedIn Direct", value: "LINKEDIN", active: true },
      { id: "md-2", category: "CANDIDATE_SOURCE", label: "Naukri / Job Portal", value: "JOB_PORTAL", active: true },
      { id: "md-3", category: "CANDIDATE_SOURCE", label: "Channel Partner / Agent Referral", value: "AGENT_REFERRAL", active: true },
      { id: "md-4", category: "CANDIDATE_SOURCE", label: "Internal Database Pool", value: "DATABASE", active: true },
      { id: "md-5", category: "REJECTION_REASON", label: "Technical Competency Gap", value: "TECH_GAP", active: true },
      { id: "md-6", category: "REJECTION_REASON", label: "Compensation Band Budget Mismatch", value: "COMP_MISMATCH", active: true },
      { id: "md-7", category: "REJECTION_REASON", label: "Notice Period Too High", value: "NOTICE_HIGH", active: true },
      { id: "md-8", category: "INDUSTRY", label: "Fintech & Banking", value: "FINTECH", active: true },
      { id: "md-9", category: "INDUSTRY", label: "Enterprise SaaS & Cloud", value: "SAAS", active: true },
      { id: "md-10", category: "INDUSTRY", label: "Healthcare & Life Sciences", value: "HEALTHCARE", active: true }
    ]
  }
}));

// ─── Enterprise HRMIS Master Seed Data ──────────────────────────

export const employeeRequests: EmployeeRequest[] = persist("employeeRequests", () => ([
  {
    id: "req-001",
    orgId: ORG_1,
    employeeId: "emp-004",
    employeeName: "Rahul Sharma",
    department: "Talent Acquisition",
    type: "WFH",
    description: "Requesting remote work due to family function in hometown.",
    priority: "MEDIUM",
    status: "PENDING",
    requestedAt: daysAgo(1),
    reviewedAt: null,
    reviewedByName: null,
    comments: "Will be available on Slack and mobile throughout work hours.",
    attachmentName: null,
  },
  {
    id: "req-002",
    orgId: ORG_1,
    employeeId: "emp-005",
    employeeName: "Pooja Hegde",
    department: "Operations",
    type: "ATTENDANCE_CORRECTION",
    description: "Forgot biometric check-in on Sep 22 due to client site visit.",
    priority: "HIGH",
    status: "APPROVED",
    requestedAt: daysAgo(3),
    reviewedAt: daysAgo(2),
    reviewedByName: "Ananya Sen",
    comments: "Verified client meeting log with team lead.",
    attachmentName: "visit-log.pdf",
  },
  {
    id: "req-003",
    orgId: ORG_1,
    employeeId: "emp-006",
    employeeName: "Vikram Singh",
    department: "Engineering",
    type: "SALARY_CERTIFICATE",
    description: "Required for home loan pre-approval with HDFC Bank.",
    priority: "MEDIUM",
    status: "PENDING",
    requestedAt: daysAgo(2),
    reviewedAt: null,
    reviewedByName: null,
    comments: null,
    attachmentName: null,
  },
  {
    id: "req-004",
    orgId: ORG_1,
    employeeId: "emp-008",
    employeeName: "Sneha Patil",
    department: "Sales",
    type: "ADDRESS_CHANGE",
    description: "Relocated to new permanent residence in Bandra West, Mumbai.",
    priority: "LOW",
    status: "APPROVED",
    requestedAt: daysAgo(10),
    reviewedAt: daysAgo(9),
    reviewedByName: "Ananya Sen",
    comments: "Electricity bill address proof verified and updated.",
    attachmentName: "address-proof.pdf",
  },
]));

export const probationRecords: ProbationRecord[] = persist("probationRecords", () => ([
  {
    id: "prb-001",
    orgId: ORG_1,
    employeeId: "emp-007",
    employeeName: "Kavita Nair",
    department: "Human Resources",
    designation: "HR Executive",
    startDate: daysAgo(75),
    probationMonths: 3,
    expectedEndDate: daysAhead(15),
    status: "REVIEW_PENDING",
    managerName: "Ananya Sen",
    reviewScore: 4.2,
    decisionReason: "Strong candidate pipeline management and documentation adherence.",
  },
  {
    id: "prb-002",
    orgId: ORG_1,
    employeeId: "emp-008",
    employeeName: "Sneha Patil",
    department: "Sales",
    designation: "Business Development Manager",
    startDate: daysAgo(120),
    probationMonths: 6,
    expectedEndDate: daysAhead(60),
    status: "ON_TRACK",
    managerName: "Vikram Singh",
    reviewScore: 4.5,
    decisionReason: null,
  },
  {
    id: "prb-003",
    orgId: ORG_1,
    employeeId: "emp-004",
    employeeName: "Rahul Sharma",
    department: "Talent Acquisition",
    designation: "Senior Recruiter",
    startDate: daysAgo(300),
    probationMonths: 3,
    expectedEndDate: daysAgo(210),
    actualEndDate: daysAgo(210),
    status: "CONFIRMED",
    managerName: "Neha Kulkarni",
    reviewScore: 4.8,
    decisionReason: "Exceptional target delivery and placement conversion rate.",
  },
]));

export const promotions: PromotionRecord[] = persist("promotions", () => ([
  {
    id: "prm-001",
    orgId: ORG_1,
    employeeId: "emp-004",
    employeeName: "Rahul Sharma",
    currentDesignation: "Senior Recruiter",
    newDesignation: "Lead Talent Partner",
    currentDepartment: "Talent Acquisition",
    newDepartment: "Talent Acquisition",
    currentCtcLpa: 12.0,
    newCtcLpa: 15.0,
    effectiveDate: "2026-10-01",
    reason: "Consistent quarterly top performer with zero candidate attrition during guarantee periods.",
    status: "PENDING",
    requestedByName: "Neha Kulkarni",
    approvedByName: null,
  },
  {
    id: "prm-002",
    orgId: ORG_1,
    employeeId: "emp-006",
    employeeName: "Vikram Singh",
    currentDesignation: "Senior Developer",
    newDesignation: "Engineering Tech Lead",
    currentDepartment: "Engineering",
    newDepartment: "Engineering",
    currentCtcLpa: 18.0,
    newCtcLpa: 22.5,
    effectiveDate: "2026-08-01",
    reason: "Architectural ownership of multi-tenant ATS portal and high code quality score.",
    status: "APPLIED",
    requestedByName: "Aarav Mehta",
    approvedByName: "Ananya Sen",
  },
]));

export const transfers: TransferRecord[] = persist("transfers", () => ([
  {
    id: "trf-001",
    orgId: ORG_1,
    employeeId: "emp-005",
    employeeName: "Pooja Hegde",
    fromDepartment: "Operations",
    toDepartment: "Talent Acquisition",
    fromLocation: "Mumbai - HQ",
    toLocation: "Pune - Branch",
    fromManager: "Aarav Mehta",
    toManager: "Neha Kulkarni",
    effectiveDate: "2026-10-15",
    reason: "Strategic redeployment to support high volume tech recruitment drive.",
    status: "PENDING",
  },
  {
    id: "trf-002",
    orgId: ORG_1,
    employeeId: "emp-008",
    employeeName: "Sneha Patil",
    fromDepartment: "Sales",
    toDepartment: "Enterprise Growth",
    fromLocation: "Bengaluru",
    toLocation: "Mumbai - HQ",
    fromManager: "Vikram Singh",
    toManager: "Aarav Mehta",
    effectiveDate: "2026-07-01",
    reason: "Internal mobility based on key enterprise client wins.",
    status: "COMPLETED",
  },
]));

export const salaryRevisions: SalaryRevisionRecord[] = persist("salaryRevisions", () => ([
  {
    id: "srev-001",
    orgId: ORG_1,
    employeeId: "emp-004",
    employeeName: "Rahul Sharma",
    currentCtc: 1200000,
    newCtc: 1450000,
    incrementPercent: 20.8,
    revisionType: "ANNUAL_INCREMENT",
    effectiveDate: "2026-10-01",
    reason: "Annual appraisal increment cycle FY26.",
    status: "PENDING",
    requestedByName: "Neha Kulkarni",
  },
  {
    id: "srev-002",
    orgId: ORG_1,
    employeeId: "emp-006",
    employeeName: "Vikram Singh",
    currentCtc: 1800000,
    newCtc: 2250000,
    incrementPercent: 25.0,
    revisionType: "PROMOTION",
    effectiveDate: "2026-08-01",
    reason: "Role elevation to Engineering Tech Lead.",
    status: "PROCESSED",
    requestedByName: "Aarav Mehta",
  },
]));

export const shifts: ShiftSchedule[] = persist("shifts", () => ([
  {
    id: "shf-1",
    orgId: ORG_1,
    name: "General Day Shift",
    code: "GEN_DAY",
    startTime: "09:30",
    endTime: "18:30",
    graceMinutes: 15,
    workingHours: 9.0,
    assignedCount: 42,
    isRotational: false,
    status: "ACTIVE",
  },
  {
    id: "shf-2",
    orgId: ORG_1,
    name: "Early Morning Support",
    code: "EARLY_MORNING",
    startTime: "07:00",
    endTime: "16:00",
    graceMinutes: 10,
    workingHours: 9.0,
    assignedCount: 8,
    isRotational: true,
    status: "ACTIVE",
  },
  {
    id: "shf-3",
    orgId: ORG_1,
    name: "Night Operations Shift",
    code: "NIGHT_OPS",
    startTime: "21:30",
    endTime: "06:30",
    graceMinutes: 15,
    workingHours: 9.0,
    assignedCount: 5,
    isRotational: true,
    status: "ACTIVE",
  },
]));

export const attendanceCorrections: AttendanceCorrectionRecord[] = persist("attendanceCorrections", () => ([
  {
    id: "cor-001",
    orgId: ORG_1,
    employeeId: "emp-004",
    employeeName: "Rahul Sharma",
    date: daysAgo(2).split("T")[0],
    originalCheckIn: null,
    originalCheckOut: "18:45",
    requestedCheckIn: "09:25",
    requestedCheckOut: "18:45",
    reason: "Biometric scanner power outage during morning entry.",
    status: "PENDING",
    reviewedByName: null,
  },
  {
    id: "cor-002",
    orgId: ORG_1,
    employeeId: "emp-007",
    employeeName: "Kavita Nair",
    date: daysAgo(5).split("T")[0],
    originalCheckIn: "10:15",
    originalCheckOut: "19:00",
    requestedCheckIn: "09:30",
    requestedCheckOut: "19:00",
    reason: "Traffic diversion on Western Express Highway.",
    status: "APPROVED",
    reviewedByName: "Ananya Sen",
  },
]));

export const wfhRequests: WfhRecord[] = persist("wfhRequests", () => ([
  {
    id: "wfh-001",
    orgId: ORG_1,
    employeeId: "emp-006",
    employeeName: "Vikram Singh",
    department: "Engineering",
    startDate: daysAhead(2).split("T")[0],
    endDate: daysAhead(3).split("T")[0],
    days: 2,
    reason: "Sprint delivery focus without commute distraction.",
    status: "PENDING",
    reviewedByName: null,
  },
  {
    id: "wfh-002",
    orgId: ORG_1,
    employeeId: "emp-005",
    employeeName: "Pooja Hegde",
    department: "Operations",
    startDate: daysAgo(4).split("T")[0],
    endDate: daysAgo(4).split("T")[0],
    days: 1,
    reason: "Severe rain and local transport disruption.",
    status: "APPROVED",
    reviewedByName: "Ananya Sen",
  },
]));

export const leaveBalances: LeaveBalanceRecord[] = persist("leaveBalances", () => ([
  {
    id: "lb-001",
    orgId: ORG_1,
    employeeId: "emp-001",
    employeeName: "Aarav Mehta",
    department: "Leadership",
    casualAllowance: 12,
    casualUsed: 2,
    sickAllowance: 15,
    sickUsed: 1,
    earnedAllowance: 10,
    earnedUsed: 4,
    carryForward: 5,
  },
  {
    id: "lb-002",
    orgId: ORG_1,
    employeeId: "emp-002",
    employeeName: "Ananya Sen",
    department: "Human Resources",
    casualAllowance: 12,
    casualUsed: 4,
    sickAllowance: 15,
    sickUsed: 2,
    earnedAllowance: 10,
    earnedUsed: 3,
    carryForward: 8,
  },
  {
    id: "lb-003",
    orgId: ORG_1,
    employeeId: "emp-004",
    employeeName: "Rahul Sharma",
    department: "Talent Acquisition",
    casualAllowance: 12,
    casualUsed: 3,
    sickAllowance: 15,
    sickUsed: 1,
    earnedAllowance: 10,
    earnedUsed: 2,
    carryForward: 4,
  },
  {
    id: "lb-004",
    orgId: ORG_1,
    employeeId: "emp-006",
    employeeName: "Vikram Singh",
    department: "Engineering",
    casualAllowance: 12,
    casualUsed: 5,
    sickAllowance: 15,
    sickUsed: 3,
    earnedAllowance: 10,
    earnedUsed: 5,
    carryForward: 2,
  },
]));

export const leavePolicies: LeavePolicyConfig[] = persist("leavePolicies", () => ([
  {
    id: "lp-1",
    leaveType: "CASUAL",
    annualAllowance: 12,
    carryForwardMax: 4,
    encashmentAllowed: false,
    minNoticeDays: 2,
    maxConsecutiveDays: 3,
    probationAllowed: true,
  },
  {
    id: "lp-2",
    leaveType: "SICK",
    annualAllowance: 15,
    carryForwardMax: 0,
    encashmentAllowed: false,
    minNoticeDays: 0,
    maxConsecutiveDays: 7,
    probationAllowed: true,
  },
  {
    id: "lp-3",
    leaveType: "EARNED",
    annualAllowance: 18,
    carryForwardMax: 15,
    encashmentAllowed: true,
    minNoticeDays: 14,
    maxConsecutiveDays: 21,
    probationAllowed: false,
  },
]));

export const goals: GoalOkr[] = persist("goals", () => ([
  {
    id: "g-001",
    orgId: ORG_1,
    title: "Close 35 Enterprise Tech Positions in Q3",
    description: "Fill open senior backend, cloud architect, and DevOps mandates for strategic fintech clients.",
    ownerId: "usr-tam",
    ownerName: "Neha Kulkarni",
    department: "Talent Acquisition",
    type: "DEPARTMENT",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    weight: 40,
    progress: 82,
    status: "IN_PROGRESS",
  },
  {
    id: "g-002",
    orgId: ORG_1,
    title: "Reduce Average Candidate Time-To-Submit to < 72h",
    description: "Streamline initial screening workflows and candidate profile dossiers for prompt client review.",
    ownerId: "usr-ta1",
    ownerName: "Rahul Sharma",
    department: "Talent Acquisition",
    type: "INDIVIDUAL",
    startDate: "2026-08-01",
    endDate: "2026-10-31",
    weight: 30,
    progress: 90,
    status: "IN_PROGRESS",
  },
  {
    id: "g-003",
    orgId: ORG_1,
    title: "Automate Employee Onboarding Checklist & Provisioning",
    description: "Zero manual friction for asset allocation and identity document verification on Day 1.",
    ownerId: "usr-hr1",
    ownerName: "Ananya Sen",
    department: "Human Resources",
    type: "TEAM",
    startDate: "2026-06-01",
    endDate: "2026-09-30",
    weight: 30,
    progress: 100,
    status: "COMPLETED",
  },
]));

export const reviewCycles: ReviewCycle[] = persist("reviewCycles", () => ([
  {
    id: "rc-1",
    orgId: ORG_1,
    title: "Mid-Year Performance Review 2026",
    period: "Apr 2026 – Sep 2026",
    type: "ANNUAL",
    status: "ACTIVE",
    deadline: "2026-10-15",
    participantsCount: 48,
  },
  {
    id: "rc-2",
    orgId: ORG_1,
    title: "Q3 Recruiter Sprint Evaluation",
    period: "Jul 2026 – Sep 2026",
    type: "QUARTERLY",
    status: "COMPLETED",
    deadline: "2026-09-20",
    participantsCount: 16,
  },
  {
    id: "rc-3",
    orgId: ORG_1,
    title: "Probation Clearance Assessment - Batch 4",
    period: "Jun 2026 – Aug 2026",
    type: "PROBATION",
    status: "UPCOMING",
    deadline: "2026-10-30",
    participantsCount: 6,
  },
]));

export const benefits: EmployeeBenefit[] = persist("benefits", () => ([
  {
    id: "ben-1",
    orgId: ORG_1,
    title: "Comprehensive Group Health Insurance (GMC)",
    category: "INSURANCE",
    provider: "Star Health & Allied Insurance",
    coverageAmount: "₹5,00,000 Sum Insured",
    enrolledCount: 52,
    status: "ACTIVE",
    description: "Cashless in-patient hospitalization covering employee, spouse, and up to 2 dependent children.",
  },
  {
    id: "ben-2",
    orgId: ORG_1,
    title: "Group Term Life Insurance (GTL)",
    category: "INSURANCE",
    provider: "HDFC Life",
    coverageAmount: "3x Annual CTC",
    enrolledCount: 52,
    status: "ACTIVE",
    description: "Pure term life protection policy covering all confirmed and probation employees.",
  },
  {
    id: "ben-3",
    orgId: ORG_1,
    title: "Annual Wellness & Preventive Health Checkup",
    category: "WELLNESS",
    provider: "Apollo Diagnostics Network",
    coverageAmount: "Comprehensive Full Body Panel",
    enrolledCount: 38,
    status: "ACTIVE",
    description: "Annual sponsored biometric health screening at accredited partner diagnostic centers.",
  },
  {
    id: "ben-4",
    orgId: ORG_1,
    title: "Monthly Tax-Free Meal Card Allowance",
    category: "MEAL",
    provider: "Sodexo / Pluxee India",
    coverageAmount: "₹2,200 / month",
    enrolledCount: 46,
    status: "ACTIVE",
    description: "Preloaded digital food card accepted across partner food merchants and grocery stores.",
  },
]));

export const hrPolicies: HrPolicyItem[] = persist("hrPolicies", () => ([
  {
    id: "pol-1",
    orgId: ORG_1,
    title: "Comprehensive Annual & Sick Leave Policy",
    category: "LEAVE",
    version: "v3.2",
    effectiveDate: "2026-01-01",
    acknowledgementCount: 52,
    summary: "Clear guidelines on casual, earned, and medical leave entitlements, carry forward, and approval SLAs.",
    status: "PUBLISHED",
  },
  {
    id: "pol-2",
    orgId: ORG_1,
    title: "Hybrid Work & Remote Office Protocol",
    category: "WFH",
    version: "v2.0",
    effectiveDate: "2026-03-15",
    acknowledgementCount: 49,
    summary: "Standards for remote connectivity, data confidentiality, work hour adherence, and core collaboration hours.",
    status: "PUBLISHED",
  },
  {
    id: "pol-3",
    orgId: ORG_1,
    title: "Prevention of Sexual Harassment (POSH) & Ethics",
    category: "CODE_OF_CONDUCT",
    version: "v4.1",
    effectiveDate: "2026-01-01",
    acknowledgementCount: 52,
    summary: "Internal Complaints Committee details, grievance redressal procedure, and zero tolerance conduct policy.",
    status: "PUBLISHED",
  },
]));

export const workflows: WorkflowAutomationRule[] = persist("workflows", () => ([
  {
    id: "wf-1",
    orgId: ORG_1,
    name: "Auto-Approve Casual Leaves <= 1 Day",
    trigger: "LEAVE_SUBMITTED",
    condition: "type == 'CASUAL' && days <= 1 && balance >= 1",
    approvalRole: "SYSTEM_AUTO",
    action: "APPROVE_AND_DEDUCT_BALANCE",
    active: true,
  },
  {
    id: "wf-2",
    orgId: ORG_1,
    name: "Notify HR Lead on 3 Consecutive Lates",
    trigger: "LATE_CHECKIN_RECORDED",
    condition: "consecutiveLateCount >= 3",
    approvalRole: "HR_ADMIN",
    action: "DISPATCH_ALERT_NOTIFICATION",
    active: true,
  },
  {
    id: "wf-3",
    orgId: ORG_1,
    name: "Generate Onboarding Checklist on Candidate Joined",
    trigger: "CANDIDATE_OFFER_JOINED",
    condition: "stage == 'JOINED'",
    approvalRole: "HR_ADMIN",
    action: "CREATE_EMPLOYEE_AND_PROVISION_TASKS",
    active: true,
  },
]));





// ─── Finance ─────────────────────────────────────────────────

export const financeSettings: FinanceSettings[] = persist("financeSettings", () => ([
  {
    orgId: ORG_1, gstRate: 18, companyStateCode: "27", sacCode: "998512",
    invoicePrefix: "INV/", creditNotePrefix: "CN/", debitNotePrefix: "DN/", receiptPrefix: "RCPT/", defaultCreditDays: 30,
    companyLegalName: "AbsoJob Staffing Solutions Pvt Ltd", companyAddress: "4th Floor, Trade Centre, Andheri East, Mumbai 400069",
    companyGstin: "27AABCA1234F1Z5", companyPan: "AABCA1234F", lutNumber: "AD270326000123X",
    bankName: "HDFC Bank", bankAccountNumber: "50200012345678", bankIfsc: "HDFC0000123",
    bankAccounts: [
      { id: "bank-1", name: "HDFC Current", bankName: "HDFC Bank", accountNumber: "50200012345678", ifsc: "HDFC0000123", openingBalance: 2500000, isDefault: true },
      { id: "bank-2", name: "ICICI Payroll", bankName: "ICICI Bank", accountNumber: "000405012345", ifsc: "ICIC0000004", openingBalance: 800000, isDefault: false },
    ],
    reimbursementLimitInr: 25000, invoiceApprovalThresholdInr: 500000, vendorPaymentApprovalThresholdInr: 100000,
    reminderDays: [-3, 7, 15, 30],
    expenseCategoryLimits: { MEALS: 5000, TRAVEL: 20000, OFFICE: 15000 },
    commissionTdsPct: 2, recruiterIncentivePct: 5, guaranteeDaysDefault: 90, creditHoldOverdueDays: 60,
    lockedUntil: null, eInvoiceEnabled: false,
    payroll: { pfEnabled: true, pfRatePct: 12, pfWageCeiling: 15000, esiEnabled: true, esiEmployeePct: 0.75, esiEmployerPct: 3.25, esiWageCeiling: 21000, ptState: "MH", taxRegime: "NEW" },
  },
]));

// Billing profiles for seeded clients (GST registration, terms, fee model)
const CLIENT_BILLING_SEED: Record<string, Partial<Client["billing"]> & { stateCode: string }> = {
  "cl-1": { gstin: "29AAECT1234K1Z2", stateCode: "29", billingAddress: "Whitefield, Bengaluru 560066", guaranteeDays: 90, splitOnOfferPct: 0 },
  "cl-2": { gstin: "27AAFCF5678L1Z9", stateCode: "27", billingAddress: "Lower Parel, Mumbai 400013", guaranteeDays: 60, splitOnOfferPct: 50 },
  "cl-3": { gstin: "27AAGCM9012M1Z4", stateCode: "27", billingAddress: "Bandra East, Mumbai 400051", guaranteeDays: 90, splitOnOfferPct: 0, feeModel: "SLAB", feeSlabs: [{ uptoLpa: 10, percent: 8.33 }, { uptoLpa: 25, percent: 10 }, { uptoLpa: 999, percent: 12 }] },
  "cl-4": { gstin: "27AAHCR3456N1Z1", stateCode: "27", billingAddress: "Goregaon, Mumbai 400063", guaranteeDays: 45, splitOnOfferPct: 0, feeModel: "FLAT", flatFee: 25000, creditLimit: 1500000 },
  "cl-5": { gstin: "27AAICC7890P1Z6", stateCode: "27", billingAddress: "Hinjewadi, Pune 411057", guaranteeDays: 90, splitOnOfferPct: 0 },
  "cl-6": { gstin: "27AAJCL2345Q1Z3", stateCode: "27", billingAddress: "Vashi, Navi Mumbai 400703", guaranteeDays: 30, splitOnOfferPct: 0 },
  "org2-cl-1": { gstin: "09AAKCD6789R1Z8", stateCode: "09", billingAddress: "Sector 62, Noida 201309", guaranteeDays: 90, splitOnOfferPct: 0 },
};
persist("clientBillingSeeded", () => {
  clients.forEach((c) => {
    const seed = CLIENT_BILLING_SEED[c.id];
    if (c.billing || !seed) return;
    c.billing = {
      gstin: seed.gstin ?? null, pan: seed.gstin ? seed.gstin.slice(2, 12) : null, billingAddress: seed.billingAddress ?? c.address ?? null,
      stateCode: seed.stateCode, country: "India", currency: "INR", billingEmails: [c.contactEmail].filter(Boolean),
      feeModel: seed.feeModel ?? "PERCENT", feePercent: c.commissionRate, flatFee: seed.flatFee ?? null, feeSlabs: seed.feeSlabs ?? [],
      splitOnOfferPct: seed.splitOnOfferPct ?? 0, guaranteeDays: seed.guaranteeDays ?? 90, creditLimit: seed.creditLimit ?? null,
    };
  });
  return true;
});

const fyOf = (d: string) => { const dt = new Date(d); const y = dt.getMonth() >= 3 ? dt.getFullYear() : dt.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };

// Invoices are seeded from the placement-commission ledger so both views agree
export const invoices: Invoice[] = persist("invoices", () =>
  commissionLedger
    .filter((l) => (l.type === "PLACEMENT_COMMISSION" || l.type === "ADJUSTMENT") && l.invoiceNumber && l.clientId)
    .map((l) => {
      const client = clients.find((c) => c.id === l.clientId);
      const isCredit = l.type === "ADJUSTMENT";
      const subtotal = Math.abs(l.amountInr);
      const intra = (client?.billing?.stateCode ?? "27") === "27";
      const taxAmount = Math.round(subtotal * 0.18);
      const total = subtotal + taxAmount;
      const paid = l.status === "PAID";
      const issue = l.createdAt.split("T")[0];
      return {
        id: `inv-${l.id.replace("led-", "")}`, orgId: l.orgId, invoiceNumber: l.invoiceNumber!, financialYear: fyOf(issue), kind: isCredit ? "CREDIT_NOTE" : "INVOICE",
        clientId: l.clientId!, clientName: client?.companyName ?? "—", clientGstin: client?.billing?.gstin ?? null, placeOfSupply: client?.billing?.stateCode ?? "27",
        placementId: null, placementIds: [], applicationId: l.applicationId, candidateName: null, jobTitle: null, milestone: "FULL", creditNoteForId: null, recurringId: null,
        lineItems: [{ description: l.description, amount: subtotal, sacCode: "998512" }], currency: "INR", fxRate: 1, discount: 0, subtotal, taxRate: 18,
        tax: intra ? { cgst: taxAmount / 2, sgst: taxAmount / 2, igst: 0, zeroRated: false } : { cgst: 0, sgst: 0, igst: taxAmount, zeroRated: false },
        taxAmount, roundOff: 0, total, amountPaid: paid ? total : 0, writtenOff: 0,
        status: isCredit ? "PAID" : paid ? "PAID" : "SENT",
        issueDate: issue, dueDate: l.dueDate ?? issue, sentAt: l.createdAt, paidAt: l.paidAt ?? null,
        payments: paid && !isCredit ? [{ id: `pmt-${l.id}`, receiptId: `rcpt-${l.id}`, amount: total, tdsAmount: 0, date: (l.paidAt ?? l.createdAt).split("T")[0], method: "BANK_TRANSFER", reference: null, recordedByName: "System", recordedAt: l.paidAt ?? l.createdAt }] : [],
        reminders: [], approvedByName: null, irn: null, ledgerId: l.id, notes: null, createdByName: "System", createdAt: l.createdAt, updatedAt: l.paidAt ?? l.createdAt,
      } as Invoice;
    })
);

export const receipts: Receipt[] = persist("receipts", () =>
  invoices
    .filter((i) => i.kind === "INVOICE" && i.payments.length)
    .map((i, k) => ({
      id: i.payments[0].receiptId!, orgId: i.orgId, receiptNumber: `RCPT/${i.financialYear}/${String(k + 1).padStart(3, "0")}`, clientId: i.clientId, clientName: i.clientName,
      date: i.payments[0].date, amount: i.total, tdsAmount: 0, method: "BANK_TRANSFER" as const, reference: null, bankAccountId: "bank-1",
      allocations: [{ invoiceId: i.id, invoiceNumber: i.invoiceNumber, amount: i.total, tds: 0 }], unapplied: 0, reconciled: false,
      recordedByName: "System", createdAt: i.payments[0].recordedAt,
    }))
);

export const recurringInvoices: RecurringInvoice[] = persist("recurringInvoices", () => ([
  { id: "rec-001", orgId: ORG_1, clientId: "cl-3", description: "RPO retainer — dedicated recruiter pod (monthly)", amount: 150000, frequency: "MONTHLY", nextDate: dateOnly(12), endDate: null, autoSend: false, active: true, createdByName: "Rohit Bansal", createdAt: daysAgo(40) },
]));

export const expenses: Expense[] = persist("expenses", () => ([
  { id: "exp-001", orgId: ORG_1, category: "JOB_BOARDS", description: "Naukri RMS quarterly subscription", amount: 100300, gstAmount: 15300, vendor: "Info Edge", expenseDate: dateOnly(-20), isReimbursement: false, submittedById: "usr-fin1", submittedByName: "Rohit Bansal", receiptUrl: null, billable: false, status: "PAID", approvedByName: "Aarav Mehta", approvedAt: daysAgo(19), paidAt: daysAgo(18), paymentReference: "NEFT-771201", createdAt: daysAgo(20) },
  { id: "exp-003", orgId: ORG_1, category: "TRAVEL", description: "Client visit — CloudLeap Pune", amount: 6400, gstAmount: 0, vendor: null, expenseDate: dateOnly(-3), isReimbursement: true, submittedById: "usr-ta1", submittedByName: "Rahul Sharma", receiptUrl: null, billable: true, clientId: "cl-5", status: "PENDING_MANAGER", approvedByName: null, approvedAt: null, paidAt: null, paymentReference: null, createdAt: daysAgo(3) },
  { id: "exp-004", orgId: ORG_1, category: "MEALS", description: "Campus drive team lunch", amount: 3200, gstAmount: 152, vendor: null, expenseDate: dateOnly(-2), isReimbursement: true, submittedById: "usr-tam", submittedByName: "Neha Kulkarni", receiptUrl: null, billable: false, status: "PENDING", managerApprovedByName: "Aarav Mehta", approvedByName: null, approvedAt: null, paidAt: null, paymentReference: null, createdAt: daysAgo(2) },
]));

export const vendors: Vendor[] = persist("vendors", () => ([
  { id: "ven-001", orgId: ORG_1, name: "Skyline Properties", category: "RENT", gstin: "27AAMCS1111A1Z5", pan: "AAMCS1111A", email: "accounts@skyline.in", phone: null, bankName: "Axis Bank", bankAccountNumber: "917020012345678", bankIfsc: "UTIB0000123", tdsSection: "194I", paymentTermsDays: 7, active: true, createdAt: daysAgo(300) },
  { id: "ven-002", orgId: ORG_1, name: "Info Edge (Naukri)", category: "JOB_BOARDS", gstin: "07AAACI1234B1Z1", pan: "AAACI1234B", email: "billing@naukri.com", phone: null, bankName: "ICICI Bank", bankAccountNumber: "000105000123", bankIfsc: "ICIC0000001", tdsSection: "194J", paymentTermsDays: 30, active: true, createdAt: daysAgo(400) },
  { id: "ven-003", orgId: ORG_1, name: "BrightPixel Studio", category: "MARKETING", gstin: null, pan: "ABCPB9876K", email: "hello@brightpixel.in", phone: null, bankName: "HDFC Bank", bankAccountNumber: "50100098765432", bankIfsc: "HDFC0000456", tdsSection: "194C", paymentTermsDays: 15, active: true, createdAt: daysAgo(90) },
]));

export const vendorBills: VendorBill[] = persist("vendorBills", () => ([
  { id: "vb-001", orgId: ORG_1, vendorId: "ven-001", vendorName: "Skyline Properties", billNumber: "SKY/26/09", billDate: dateOnly(-5), dueDate: dateOnly(2), category: "RENT", description: "Office rent — Andheri (monthly)", amount: 150000, gstAmount: 27000, tdsSection: "194I", tdsAmount: 15000, total: 177000, payable: 162000, amountPaid: 0, payments: [], status: "APPROVED", recurring: true, recurringNextDate: dateOnly(25), approvedByName: "Aarav Mehta", createdByName: "Rohit Bansal", createdAt: daysAgo(5) },
  { id: "vb-002", orgId: ORG_1, vendorId: "ven-003", vendorName: "BrightPixel Studio", billNumber: "BP-0142", billDate: dateOnly(-2), dueDate: dateOnly(13), category: "MARKETING", description: "LinkedIn campaign creatives", amount: 40000, gstAmount: 0, tdsSection: "194C", tdsAmount: 800, total: 40000, payable: 39200, amountPaid: 0, payments: [], status: "PENDING_APPROVAL", recurring: false, recurringNextDate: null, approvedByName: null, createdByName: "Rohit Bansal", createdAt: daysAgo(2) },
]));

export const contractAssignments: ContractAssignment[] = persist("contractAssignments", () => ([
  { id: "ctr-001", orgId: ORG_1, clientId: "cl-1", clientName: "TechNova Systems", workerName: "Suresh Pillai", workerEmail: "suresh.p@contractor.in", candidateId: null, role: "QA Contractor", rateType: "DAILY", billRate: 6000, payRate: 4500, startDate: dateOnly(-75), endDate: null, status: "ACTIVE", recruiterId: "usr-ta1", createdByName: "Neha Kulkarni", createdAt: daysAgo(75) },
  { id: "ctr-002", orgId: ORG_1, clientId: "cl-4", clientName: "RetailMart India", workerName: "Anjali Rao", workerEmail: "anjali.r@contractor.in", candidateId: null, role: "Warehouse Supervisor", rateType: "MONTHLY", billRate: 85000, payRate: 62000, startDate: dateOnly(-120), endDate: null, status: "ACTIVE", recruiterId: "usr-ta2", createdByName: "Neha Kulkarni", createdAt: daysAgo(120) },
]));

export const timesheets: Timesheet[] = persist("timesheets", () => {
  const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1);
  const m = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  return [
    { id: "ts-001", orgId: ORG_1, assignmentId: "ctr-001", month: m, units: 21, status: "APPROVED", billAmount: 126000, payAmount: 94500, invoiceId: null, contractorPaid: false, approvedByName: "Deepak Rao (client)", submittedByName: "Suresh Pillai", createdAt: daysAgo(3) },
    { id: "ts-002", orgId: ORG_1, assignmentId: "ctr-002", month: m, units: 1, status: "SUBMITTED", billAmount: 85000, payAmount: 62000, invoiceId: null, contractorPaid: false, approvedByName: null, submittedByName: "Anjali Rao", createdAt: daysAgo(2) },
  ] as Timesheet[];
});

export const fnfPayments: FnfPayment[] = persist("fnfPayments", () => []);
export const payeeProfiles: PayeeProfile[] = persist("payeeProfiles", () => ([
  { userId: "usr-ag1", pan: "ABCPS1234V", bankName: "SBI", bankAccountNumber: "30123456789", bankIfsc: "SBIN0000456", upiId: "vikram@okhdfc" },
  { userId: "usr-ag2", pan: "ABCPP5678S", bankName: "Kotak", bankAccountNumber: "1234567890", bankIfsc: "KKBK0000123", upiId: null },
]));
export const bankStatementLines: BankStatementLine[] = persist("bankStatementLines", () => []);
export const manualJournals: ManualJournal[] = persist("manualJournals", () => []);
export const budgets: Budget[] = persist("budgets", () => {
  const m = new Date().toISOString().slice(0, 7);
  return [
    { id: "bud-1", orgId: ORG_1, month: m, category: "REVENUE", amount: 1500000 },
    { id: "bud-2", orgId: ORG_1, month: m, category: "MARKETING", amount: 60000 },
    { id: "bud-3", orgId: ORG_1, month: m, category: "TRAVEL", amount: 40000 },
    { id: "bud-4", orgId: ORG_1, month: m, category: "JOB_BOARDS", amount: 120000 },
  ];
});
export const emailOutbox: EmailMessage[] = persist("emailOutbox", () => []);
export const storedFiles: StoredFile[] = persist("storedFiles", () => []);

// ─── Partner programme & recruiter workspace ─────────────────

export const agentProfiles: AgentProfile[] = persist("agentProfiles", () => ([
  { userId: "usr-ag1", orgId: ORG_1, city: "Mumbai", pan: "ABCPS1234V", idProofFileId: null, kycStatus: "VERIFIED", kycNote: null, specialization: ["IT", "Fintech"], experienceYears: 6, sourcingChannels: ["LinkedIn", "Referrals"], agreementAcceptedAt: daysAgo(280), verifiedByName: "Neha Kulkarni", verifiedAt: daysAgo(279), createdAt: daysAgo(280) },
  { userId: "usr-ag2", orgId: ORG_1, city: "Mumbai", pan: "ABCPP5678S", idProofFileId: null, kycStatus: "VERIFIED", kycNote: null, specialization: ["Retail", "BPO"], experienceYears: 3, sourcingChannels: ["Walk-ins", "Campus"], agreementAcceptedAt: daysAgo(190), verifiedByName: "Neha Kulkarni", verifiedAt: daysAgo(189), createdAt: daysAgo(190) },
  { userId: "usr-ag3", orgId: ORG_1, city: "Mumbai", pan: null, idProofFileId: null, kycStatus: "REJECTED", kycNote: "PAN not provided", specialization: ["Healthcare"], experienceYears: 2, sourcingChannels: ["Referrals"], agreementAcceptedAt: daysAgo(150), verifiedByName: null, verifiedAt: null, createdAt: daysAgo(150) },
]));

export const referralMessages: ReferralMessage[] = persist("referralMessages", () => ([
  { id: "rmsg-1", orgId: ORG_1, referralId: "ref-001", fromUserId: "usr-ag1", fromName: "Vikram Singh", fromRole: "AGENT", text: "Candidate is available for interviews any weekday after 5 PM.", createdAt: daysAgo(20) },
  { id: "rmsg-2", orgId: ORG_1, referralId: "ref-001", fromUserId: "usr-ta1", fromName: "Rahul Sharma", fromRole: "TA_RECRUITER", text: "Thanks — tech round being scheduled this week.", createdAt: daysAgo(19) },
]));

export const messageTemplates: MessageTemplate[] = persist("messageTemplates", () => ([
  { id: "tpl-1", orgId: ORG_1, name: "Interview invite", channel: "EMAIL", audience: "CANDIDATE", subject: "Interview for {{jobTitle}} — {{interviewDate}}", body: "Hi {{candidateName}},\n\nYour interview for {{jobTitle}} at {{clientName}} is scheduled on {{interviewDate}}. Please confirm your availability.\n\nRegards,\n{{recruiterName}}\n{{companyName}}", createdByName: "Neha Kulkarni", createdAt: daysAgo(100) },
  { id: "tpl-2", orgId: ORG_1, name: "Interview reminder (WhatsApp)", channel: "WHATSAPP", audience: "CANDIDATE", subject: null, body: "Hi {{candidateName}}, reminder: your {{jobTitle}} interview is on {{interviewDate}}. All the best! — {{recruiterName}}, {{companyName}}", createdByName: "Neha Kulkarni", createdAt: daysAgo(100) },
  { id: "tpl-3", orgId: ORG_1, name: "Documents pending", channel: "EMAIL", audience: "CANDIDATE", subject: "Documents needed for your {{jobTitle}} offer", body: "Hi {{candidateName}},\n\nTo complete your offer for {{jobTitle}}, please share: last 3 payslips, relieving letter, PAN and Aadhaar.\n\nThanks,\n{{recruiterName}}", createdByName: "Neha Kulkarni", createdAt: daysAgo(80) },
  { id: "tpl-4", orgId: ORG_1, name: "Profile shared (WhatsApp)", channel: "WHATSAPP", audience: "CANDIDATE", subject: null, body: "Hi {{candidateName}}, I have shared your profile with {{clientName}} for the {{jobTitle}} role. I will update you on feedback soon. — {{recruiterName}}", createdByName: "Neha Kulkarni", createdAt: daysAgo(60) },
  { id: "tpl-5", orgId: ORG_1, name: "Client — feedback follow-up", channel: "EMAIL", audience: "CLIENT", subject: "Feedback on profiles shared for {{jobTitle}}", body: "Hi {{contactPerson}},\n\nFollowing up on the profiles we shared for {{jobTitle}}. Could you share feedback or interview slots?\n\nRegards,\n{{recruiterName}}\n{{companyName}}", createdByName: "Neha Kulkarni", createdAt: daysAgo(60) },
]));

export const clientCommunications: ClientCommunication[] = persist("clientCommunications", () => ([
  { id: "ccm-1", orgId: ORG_1, clientId: "cl-1", channel: "MEETING", direction: "OUTGOING", subject: "Hiring plan Q3", body: "Discussed 4 backend openings; client wants profiles within a week.", jobId: null, nextFollowUpDate: null, byUserId: "usr-ta1", byName: "Rahul Sharma", createdAt: daysAgo(14) },
]));

export const recruiterTargets: RecruiterTarget[] = persist("recruiterTargets", () => {
  const m = new Date().toISOString().slice(0, 7);
  return [
    { id: "tgt-1", orgId: ORG_1, userId: "usr-ta1", month: m, submissions: 20, interviews: 10, offers: 4, joinings: 3, revenue: 500000, setByName: "Neha Kulkarni" },
    { id: "tgt-2", orgId: ORG_1, userId: "usr-ta2", month: m, submissions: 15, interviews: 8, offers: 3, joinings: 2, revenue: 350000, setByName: "Neha Kulkarni" },
  ];
});

// ─── Employee self-service ───────────────────────────────────

// Holidays for FY 2026-27 (HR maintains this list under HRMIS → Holidays)
export const holidays: Holiday[] = persist("holidays", () => (HOLIDAY_SEED.map(([date, name, type], i) => ({ id: `hol-${String(i + 1).padStart(2, "0")}`, orgId: ORG_1, date, name, type, locations: [] }))));

export const policyAcknowledgements: PolicyAcknowledgement[] = persist("policyAcknowledgements", () => ([
  { id: "pack-1", orgId: ORG_1, policyId: "pol-1", version: "v3.2", userId: "usr-tam", acknowledgedAt: daysAgo(40) },
]));

export const benefitEnrollments: BenefitEnrollment[] = persist("benefitEnrollments", () => ([
  { id: "benr-1", orgId: ORG_1, benefitId: "ben-1", employeeId: "emp-004", status: "ENROLLED", dependents: [{ name: "Meera Sharma", relation: "Spouse" }], updatedAt: daysAgo(200) },
]));

export const taxDeclarations: TaxDeclaration[] = persist("taxDeclarations", () => ([
  { id: "tdec-1", orgId: ORG_1, employeeId: "emp-004", fy: "2026-27", regime: "OLD", sec80C: 90000, sec80D: 25000, hraRentPaid: 300000, metroCity: true, homeLoanInterest: 0, nps80CCD1B: 0, otherDeductions: 0, proofFileIds: [], status: "SUBMITTED", reviewNote: null, reviewedByName: null, submittedAt: daysAgo(60), updatedAt: daysAgo(60) },
]));
