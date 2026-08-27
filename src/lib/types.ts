// ─── AbsoJob CRM — Recruitment Platform Domain Model ──────────
// Multi-tenant: every entity is scoped to org_id.

export type UserRole = "SUPER_ADMIN" | "TA_MANAGER" | "TA_RECRUITER" | "AGENT" | "EMPLOYEE";

export type UserStatus = "ACTIVE" | "INVITED" | "SUSPENDED" | "EXITED";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: "TRIAL" | "STARTER" | "GROWTH" | "ENTERPRISE";
  status: "ACTIVE" | "SUSPENDED";
  industry: string;
  logoUrl?: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  orgId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string | null;
  department?: string | null;
  designation?: string | null;
  location?: string | null;
  reportingTo?: string | null; // user id
  joinedAt: string;
  deactivatedAt?: string | null;
}

// ─── Clients (companies whose positions we fill) ──────────────

export type ClientStatus = "PROSPECT" | "ONBOARDING" | "ACTIVE" | "PAUSED" | "CHURNED";

export interface Client {
  id: string;
  orgId: string;
  companyName: string;
  industry: string;
  website?: string | null;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  address?: string | null;
  status: ClientStatus;
  agreementUrl?: string | null;
  commissionRate: number; // % of annual CTC
  creditDays: number; // payment terms
  accountManagerId: string | null; // TA_MANAGER / SUPER_ADMIN user
  estimatedValue: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Job Requisitions ─────────────────────────────────────────

export type JobStatus = "PENDING_APPROVAL" | "APPROVED" | "SOURCING" | "INTERVIEWING" | "OFFER_STAGE" | "FULFILLED" | "CLOSED" | "CANCELLED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "REMOTE" | "HYBRID";
export type JobPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface JobRequisition {
  id: string;
  orgId: string;
  clientId: string;
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  priority: JobPriority;
  openings: number;
  filled: number;
  salaryMinLpa: number; // LPA
  salaryMaxLpa: number;
  experienceMinYears: number;
  experienceMaxYears: number;
  skills: string[];
  description: string;
  status: JobStatus;
  requestedById: string | null; // agent/TA who raised
  approvedById: string | null;
  assignedTas: string[]; // user ids
  targetCloseDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Candidates & Applications ────────────────────────────────

export type CandidateSource = "AGENT_REFERRAL" | "JOB_PORTAL" | "LINKEDIN" | "WALK_IN" | "DATABASE" | "CAMPUS" | "OTHER";
export type ApplicationStage =
  | "SOURCED"
  | "SCREENING"
  | "INTERVIEW_SCHEDULED"
  | "TECH_ROUND"
  | "CLIENT_ROUND"
  | "HR_ROUND"
  | "OFFER_SENT"
  | "JOINED"
  | "REJECTED"
  | "BACKED_OUT"
  | "BLACKLISTED";

export interface Candidate {
  id: string;
  orgId: string;
  name: string;
  email: string;
  phone: string;
  currentCompany?: string | null;
  currentDesignation?: string | null;
  totalExperienceYears: number;
  relevantExperienceYears: number;
  currentCtcLpa: number;
  expectedCtcLpa: number;
  noticePeriodDays: number;
  location: string;
  skills: string[];
  resumeUrl?: string | null;
  rating: number; // 1-5
  source: CandidateSource;
  referredByUserId?: string | null; // AGENT referral
  blacklisted: boolean;
  blacklistReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  orgId: string;
  candidateId: string;
  jobId: string;
  stage: ApplicationStage;
  recruiterId: string; // TA owner
  fitScore: number; // 0-100
  screeningNotes?: string | null;
  rejectionReason?: string | null;
  expectedJoinDate?: string | null;
  actualJoinDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Interviews ───────────────────────────────────────────────

export type InterviewRound = "SCREENING_CALL" | "TECH_1" | "TECH_2" | "CLIENT_ROUND" | "HR_ROUND" | "FINAL";
export type InterviewMode = "PHONE" | "VIDEO" | "ONSITE";
export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "RESCHEDULED";
export type InterviewOutcome = "PENDING" | "STRONG_HIRE" | "HIRE" | "MAYBE" | "NO_HIRE";

export interface Interview {
  id: string;
  orgId: string;
  applicationId: string;
  round: InterviewRound;
  mode: InterviewMode;
  scheduledAt: string; // ISO datetime
  durationMins: number;
  interviewerName: string;
  status: InterviewStatus;
  outcome: InterviewOutcome;
  score?: number | null; // 1-10
  feedback?: string | null;
  meetingLink?: string | null;
  createdBy: string;
  createdAt: string;
}

// ─── Referrals (Agent → Company candidates) ───────────────────

export type ReferralStatus = "SUBMITTED" | "UNDER_REVIEW" | "SHORTLISTED" | "HIRED" | "REJECTED";

export interface Referral {
  id: string;
  orgId: string;
  agentId: string;
  candidateId: string;
  jobId: string | null;
  status: ReferralStatus;
  incentiveAmount: number; // INR
  incentivePaid: boolean;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Finance — Commissions & Payouts ─────────────────────────

export type LedgerEntryType = "PLACEMENT_COMMISSION" | "REFERRAL_INCENTIVE" | "PAYOUT" | "ADJUSTMENT";
export type LedgerStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

export interface CommissionLedgerEntry {
  id: string;
  orgId: string;
  userId: string | null; // earner (agent referral incentive)
  clientId: string | null; // billing client for placement commission
  applicationId: string | null;
  type: LedgerEntryType;
  amountInr: number;
  status: LedgerStatus;
  description: string;
  invoiceNumber?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface Payout {
  id: string;
  orgId: string;
  userId: string;
  amountInr: number;
  periodLabel: string; // e.g. "Aug 2026"
  status: "PROCESSING" | "PAID" | "ON_HOLD";
  method: "BANK_TRANSFER" | "UPI" | "CHEQUE";
  reference?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

// ─── Workforce — Attendance & Leave ──────────────────────────

export interface AttendanceRecord {
  id: string;
  orgId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_LEAVE" | "WFH";
  checkIn: string | null;
  checkOut: string | null;
}

export type LeaveType = "CASUAL" | "SICK" | "EARNED" | "UNPAID" | "COMP_OFF";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  orgId: string;
  userId: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  approverId?: string | null;
  decisionNote?: string | null;
  createdAt: string;
}

// ─── Tasks, Announcements, Audit ─────────────────────────────

export interface Task {
  id: string;
  orgId: string;
  assignedToId: string;
  createdById: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: JobPriority;
  linkedApplicationId?: string | null;
  completed: boolean;
  completedAt?: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  orgId: string;
  title: string;
  body: string;
  audience: ("ALL" | "TA" | "AGENTS" | "EMPLOYEES")[];
  pinned: boolean;
  createdById: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  orgId: string;
  actorUserId: string;
  actorRole: UserRole;
  action: string; // e.g. "USER_CREATED", "STAGE_MOVED", "JOB_APPROVED"
  entity: string; // e.g. "User", "Application"
  entityId: string;
  detail: string;
  createdAt: string;
}

// ─── Notifications ───────────────────────────────────────────

export interface Notification {
  id: string;
  orgId: string;
  userId: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// ─── Shared helpers ──────────────────────────────────────────

export const STAGE_ORDER: ApplicationStage[] = [
  "SOURCED",
  "SCREENING",
  "INTERVIEW_SCHEDULED",
  "TECH_ROUND",
  "CLIENT_ROUND",
  "HR_ROUND",
  "OFFER_SENT",
  "JOINED",
];

export const ACTIVE_STAGES: ApplicationStage[] = [
  "SOURCED",
  "SCREENING",
  "INTERVIEW_SCHEDULED",
  "TECH_ROUND",
  "CLIENT_ROUND",
  "HR_ROUND",
  "OFFER_SENT",
];

export function roleHome(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin/dashboard";
    case "TA_MANAGER":
    case "TA_RECRUITER":
      return "/ta/dashboard";
    default:
      return "/portal/dashboard";
  }
}
