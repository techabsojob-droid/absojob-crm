// ─── AbsoJob CRM — Recruitment Platform Domain Model ──────────
// Multi-tenant: every entity is scoped to org_id.

export type UserRole = "SUPER_ADMIN" | "TA_MANAGER" | "TA_RECRUITER" | "AGENT" | "EMPLOYEE" | "HR_ADMIN";

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

export type JobStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SOURCING"
  | "SCREENING"
  | "CLIENT_REVIEW"
  | "INTERVIEWING"
  | "OFFER_STAGE"
  | "JOINING"
  | "FULFILLED"
  | "ON_HOLD"
  | "CLOSED"
  | "CANCELLED";

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "REMOTE" | "HYBRID" | "TEMPORARY" | "INTERNSHIP" | "CONSULTANT";
export type JobPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type WorkMode = "ONSITE" | "HYBRID" | "REMOTE" | "FIELD";

export interface JobOpeningItem {
  id: string;
  openingNumber: number;
  status: "OPEN" | "SOURCING" | "INTERVIEWING" | "OFFER_EXTENDED" | "JOINING_PENDING" | "FILLED" | "CANCELLED";
  assignedCandidateId?: string | null;
  assignedCandidateName?: string | null;
  targetJoiningDate?: string | null;
  actualJoiningDate?: string | null;
  notes?: string;
}

export interface JobRequirementVersion {
  version: number;
  openings: number;
  salaryMinLpa: number;
  salaryMaxLpa: number;
  experienceMinYears: number;
  experienceMaxYears: number;
  skills: string[];
  preferredSkills?: string[];
  location: string;
  workMode?: WorkMode;
  changedById: string;
  changedByName: string;
  changedAt: string;
  changeSummary: string;
}

export interface JobAssignmentRecord {
  id: string;
  recruiterId: string;
  recruiterName: string;
  role: "PRIMARY_RECRUITER" | "SECONDARY_RECRUITER" | "TA_MANAGER" | "SOURCER";
  assignedById: string;
  assignedByName: string;
  assignedAt: string;
  active: boolean;
  unassignedAt?: string | null;
  unassignedReason?: string | null;
}

export interface JobApprovalRecord {
  id: string;
  jobId: string;
  approvalType: "REQUISITION_CREATION" | "SALARY_EXCEPTION" | "REQUIREMENT_CHANGE" | "OFFER_RELEASE" | "JOB_CLOSURE";
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  approverId: string;
  approverName: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  decidedAt?: string | null;
  comments?: string;
  rejectionReason?: string;
}

export interface JobDocumentItem {
  id: string;
  name: string;
  type: "JD" | "CLIENT_REQUIREMENT" | "RATE_CARD" | "SOW" | "CONTRACT" | "INTERVIEW_GUIDE" | "OTHER";
  fileUrl: string;
  fileSizeKb: number;
  version: number;
  uploadedById: string;
  uploadedByName: string;
  uploadedAt: string;
  status: "ACTIVE" | "ARCHIVED";
}

export interface JobSlaConfig {
  slaDays: number;
  slaStartDate: string;
  targetShortlistDate?: string | null;
  targetInterviewDate?: string | null;
  targetOfferDate?: string | null;
  targetJoiningDate?: string | null;
  status: "ON_TRACK" | "AT_RISK" | "OVERDUE" | "COMPLETED";
}

export interface JobRequisition {
  id: string;
  orgId: string;
  clientId: string;
  title: string;
  department: string;
  location: string;
  workMode?: WorkMode;
  city?: string;
  country?: string;
  employmentType: EmploymentType;
  priority: JobPriority;
  priorityReason?: string;
  openings: number;
  filled: number;
  salaryMinLpa: number; // LPA
  salaryMaxLpa: number;
  salaryCurrency?: string;
  fixedSalaryLpa?: number;
  variableSalaryLpa?: number;
  bonusDetails?: string;
  benefits?: string;
  experienceMinYears: number;
  experienceMaxYears: number;
  skills: string[];
  preferredSkills?: string[];
  education?: string;
  certifications?: string[];
  languages?: string[];
  noticePeriodPreference?: string;
  description: string;
  aboutCompany?: string;
  responsibilities?: string;
  status: JobStatus;
  statusReason?: string;
  holdResumeDate?: string | null;
  closureReason?: string | null;
  cancelReason?: string | null;
  requestedById: string | null; // agent/TA who raised
  approvedById: string | null;
  assignedTas: string[]; // user ids
  primaryRecruiterId?: string | null;
  taManagerId?: string | null;
  accountManagerId?: string | null;
  targetCloseDate?: string | null;
  targetJoiningDate?: string | null;
  slaDays?: number;
  sla?: JobSlaConfig;
  tags?: string[];
  openingsList?: JobOpeningItem[];
  requirementVersions?: JobRequirementVersion[];
  assignmentHistory?: JobAssignmentRecord[];
  documents?: JobDocumentItem[];
  approvals?: JobApprovalRecord[];
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
  | "OFFER_ACCEPTED"
  | "ONBOARDING"
  | "JOINED"
  | "REJECTED"
  | "BACKED_OUT"
  | "BLACKLISTED";

export interface WorkExperienceItem {
  id: string;
  company: string;
  designation: string;
  employmentType?: "Full-Time" | "Contract" | "Part-Time" | "Internship";
  startDate: string;
  endDate?: string | null;
  currentlyWorking?: boolean;
  location?: string;
  department?: string;
  responsibilities?: string[];
  keyAchievements?: string[];
  technologiesUsed?: string[];
  teamSize?: number;
  reasonForLeaving?: string;
  description?: string;
}

export interface EducationItem {
  id: string;
  degree: string;
  fieldOfStudy: string;
  specialization?: string;
  institution: string;
  college?: string;
  educationType?: "Full-Time" | "Distance" | "Executive";
  startYear?: string | number;
  endYear?: string | number;
  grade?: string;
  location?: string;
  isHighestQualification?: boolean;
}

export interface CandidateSkillItem {
  name: string;
  category: "Programming Languages" | "Frameworks" | "Databases" | "Cloud & DevOps" | "Testing" | "Architecture & Tools" | "Domain Skills" | "Soft Skills";
  experienceYears: number;
  proficiency: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  lastUsedYear?: number;
  primary?: boolean;
  verified?: boolean;
}

export interface CandidatePreference {
  preferredJobTitles?: string[];
  preferredIndustries?: string[];
  preferredWorkMode: "REMOTE" | "HYBRID" | "ONSITE" | "ANY";
  preferredLocations: string[];
  willingToRelocate: boolean;
  relocationPreference?: string;
  preferredShift?: "Day" | "Night" | "Rotational" | "Flexible";
  travelAvailability?: "No Travel" | "Occasional (up to 20%)" | "Frequent (50%+)";
  visaSponsorshipRequired: boolean;
  workAuthorization?: string;
}

export interface CandidateCompensation {
  currentFixedLpa: number;
  currentVariableLpa: number;
  currentBonusLpa?: number;
  currentCtcLpa: number;
  expectedFixedLpa: number;
  expectedVariableLpa: number;
  expectedCtcLpa: number;
  salaryCurrency: string;
  negotiableSalary: boolean;
  minimumAcceptableLpa: number;
  buyoutAvailable: boolean;
}

export interface CandidateAvailability {
  noticePeriodDays: number;
  noticePeriodUnit: "Days" | "Weeks" | "Months";
  servingNotice: boolean;
  noticeStartDate?: string;
  lastWorkingDay?: string;
  availableFrom?: string;
  immediateJoiner: boolean;
  joiningFlexibility?: string;
  buyoutPossible: boolean;
  availabilityStatus: "Immediate" | "Available in 15 Days" | "Available in 30 Days" | "Available in 60 Days" | "Available in 90 Days" | "Currently Unavailable";
}

export interface CandidateDocument {
  id: string;
  name: string;
  type: "RESUME" | "COVER_LETTER" | "EXPERIENCE_LETTER" | "SALARY_SLIP" | "OFFER_LETTER" | "CERTIFICATE" | "ID_PROOF" | "OTHER";
  fileUrl: string;
  fileSizeKb: number;
  version: number;
  uploadedBy: string;
  uploadDate: string;
  verified: boolean;
  verifiedBy?: string;
  verificationDate?: string;
  expiryDate?: string;
}

export interface CandidateCommunicationLog {
  id: string;
  type: "PHONE" | "WHATSAPP" | "EMAIL" | "MEETING" | "LINKEDIN";
  direction: "INCOMING" | "OUTGOING";
  subject: string;
  message: string;
  outcome: "Connected" | "No Answer" | "Interested" | "Not Interested" | "Call Back" | "Interview Confirmed" | "Documents Pending" | "Salary Discussion" | "Offer Discussion";
  nextFollowUpDate?: string;
  createdByName: string;
  createdAt: string;
}

export interface CandidateRecruiterNote {
  id: string;
  category: "General" | "Screening" | "Salary" | "Client Feedback" | "Interview" | "Compliance";
  text: string;
  authorName: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface CandidateScreeningEvaluation {
  communicationRating: number; // 1-5
  technicalRating: number; // 1-5
  relevantExperienceFit: number; // 1-5
  cultureFit: number; // 1-5
  salaryFit: number; // 1-5
  overallFitRating: number; // 1-5
  recruiterRecommendation: "Strong Recommend" | "Recommend" | "Hold" | "Do Not Recommend";
  screeningNotes: string;
  evaluatedByName: string;
  evaluatedAt: string;
}

export interface CandidateReferenceCheck {
  id: string;
  name: string;
  company: string;
  designation: string;
  relationship: string;
  phone: string;
  email: string;
  status: "PENDING" | "VERIFIED" | "FLAGGED";
  feedback?: string;
  verifiedByName?: string;
  verifiedAt?: string;
}

export interface CandidateConsentCompliance {
  dataProcessingConsent: boolean;
  communicationConsent: boolean;
  resumeSharingConsent: boolean;
  clientSubmissionConsent: boolean;
  consentDate: string;
  consentSource: string;
  dataRetentionUntil: string;
  anonymizationStatus: "ACTIVE" | "REQUESTED" | "ANONYMIZED";
}

export interface CandidateOwnership {
  assignedRecruiterId: string;
  assignedRecruiterName: string;
  taManagerName: string;
  accountManagerName?: string;
  recruitmentTeam: string;
  assignedAt: string;
}

export interface Candidate {
  id: string;
  candidateCode: string; // e.g. "CAN-8921"
  orgId: string;
  name: string;
  email: string;
  alternateEmail?: string;
  phone: string;
  alternatePhone?: string;
  whatsappNumber?: string;
  gender?: "Male" | "Female" | "Non-Binary" | "Prefer not to say";
  dateOfBirth?: string;
  nationality?: string;
  maritalStatus?: string;
  currentCity?: string;
  currentState?: string;
  currentCountry?: string;
  permanentAddress?: string;
  pinCode?: string;
  bio?: string | null;
  headline?: string | null;
  currentCompany?: string | null;
  currentDesignation?: string | null;
  previousCompany?: string | null;
  totalExperienceYears: number;
  relevantExperienceYears: number;
  industry?: string;
  functionalArea?: string;
  employmentType?: string;
  seniorityLevel?: "Junior" | "Mid-Level" | "Senior" | "Lead" | "Staff" | "Principal" | "Executive";
  currentCtcLpa: number;
  expectedCtcLpa: number;
  noticePeriodDays: number;
  location: string;
  status: "NEW" | "ACTIVE" | "CONTACTED" | "QUALIFIED" | "AVAILABLE" | "ON_HOLD" | "PLACED" | "JOINED" | "REJECTED" | "BLACKLISTED" | "ARCHIVED";
  tags: string[];
  skills: string[];
  primarySkills?: string[];
  secondarySkills?: string[];
  detailedSkills?: CandidateSkillItem[];
  certifications?: string[];
  education?: EducationItem[];
  workExperience?: WorkExperienceItem[];
  preferences?: CandidatePreference;
  compensationDetails?: CandidateCompensation;
  availabilityDetails?: CandidateAvailability;
  documents?: CandidateDocument[];
  communications?: CandidateCommunicationLog[];
  notes?: CandidateRecruiterNote[];
  screeningEvaluation?: CandidateScreeningEvaluation;
  referenceChecks?: CandidateReferenceCheck[];
  compliance?: CandidateConsentCompliance;
  ownership?: CandidateOwnership;
  resumeUrl?: string | null;
  portfolioUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  rating: number; // 1-5
  profileCompletionScore?: number; // 0-100
  source: CandidateSource;
  sourceCampaign?: string;
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

// ─── HRMIS Domain Model ──────────────────────────────────────

export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "NOTICE_PERIOD" | "EXITED";
export type EmploymentTypeHR = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";

export interface Employee {
  id: string;
  orgId: string;
  employeeId: string; // EMP-001
  userId?: string | null;
  candidateId?: string | null;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  reportingManagerId: string | null;
  reportingManagerName?: string | null;
  joiningDate: string;
  employmentType: EmploymentTypeHR;
  status: EmployeeStatus;
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  location?: string | null;
  personalDetails?: {
    dob?: string;
    maritalStatus?: string;
    bloodGroup?: string;
    currentAddress?: string;
    permanentAddress?: string;
  };
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
    panNumber?: string;
  };
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  salary?: {
    basic: number;
    hra: number;
    allowances: number;
    deductions: number;
    netMonthly: number;
    annualCtc: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type OnboardingStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

export interface OnboardingChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  requiredDoc?: string;
  completedAt?: string | null;
}

export interface OnboardingRecord {
  id: string;
  orgId: string;
  candidateId: string;
  applicationId?: string | null;
  jobId?: string | null;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  position: string;
  department: string;
  expectedJoiningDate: string;
  actualJoiningDate?: string | null;
  status: OnboardingStatus;
  progressPercent: number;
  checklist: OnboardingChecklistItem[];
  assignedHrId: string | null;
  createdEmployeeId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PayrollStatus = "DRAFT" | "PROCESSED" | "PAID";

export interface PayrollRecord {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  month: string; // YYYY-MM
  basicSalary: number;
  hra: number;
  allowances: number;
  bonuses: number;
  overtime: number;
  deductions: number;
  tax: number;
  netSalary: number;
  status: PayrollStatus;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  payslipUrl?: string | null;
}

export type ReviewStatus = "GOALS_SET" | "SELF_REVIEW" | "MANAGER_REVIEW" | "COMPLETED";

export interface PerformanceGoal {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-100
  weightage: number; // %
}

export interface PerformanceReview {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  reviewCycle: string; // e.g. "Q3 2026", "Annual 2026"
  goals: PerformanceGoal[];
  managerFeedback?: string | null;
  employeeFeedback?: string | null;
  rating?: number | null; // 1-5
  status: ReviewStatus;
  promotionRecommended: boolean;
  incrementPercent?: number | null;
  updatedAt: string;
}

export type AssetCategory = "LAPTOP" | "DESKTOP" | "MONITOR" | "MOBILE" | "ID_CARD" | "ACCESSORY" | "OTHER";
export type AssetStatus = "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "RETIRED";

export interface AssetRecord {
  id: string;
  orgId: string;
  assetTag: string; // AST-001
  name: string;
  category: AssetCategory;
  serialNumber: string;
  assignedEmployeeId: string | null;
  assignedEmployeeName?: string | null;
  assignedDate?: string | null;
  condition: "EXCELLENT" | "GOOD" | "FAIR" | "DAMAGED";
  status: AssetStatus;
  notes?: string | null;
}

export interface TrainingProgram {
  id: string;
  orgId: string;
  title: string;
  course: string;
  trainer: string;
  startDate: string;
  endDate: string;
  enrolledEmployeeIds: string[];
  status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED";
  description: string;
}

export type ExitStatus = "PENDING_APPROVAL" | "NOTICE_PERIOD" | "CLEARANCE" | "SETTLED" | "COMPLETED";

export interface ClearanceItem {
  department: string;
  cleared: boolean;
  clearedBy?: string | null;
  clearedAt?: string | null;
  notes?: string | null;
}

export interface ExitRecord {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  resignationDate: string;
  noticePeriodDays: number;
  lastWorkingDay: string;
  reason: string;
  status: ExitStatus;
  exitInterviewNotes?: string | null;
  clearanceChecklist: ClearanceItem[];
  fnfSettled: boolean;
  fnfAmountInr?: number | null;
  experienceLetterIssued: boolean;
}

export type DocumentCategory =
  | "IDENTITY"
  | "ADDRESS"
  | "OFFER_LETTER"
  | "APPOINTMENT_LETTER"
  | "EXPERIENCE_LETTER"
  | "SALARY_CERTIFICATE"
  | "BANK_DOC"
  | "EMPLOYMENT"
  | "RESUME"
  | "POLICY";

export interface DocumentRecord {
  id: string;
  orgId: string;
  employeeId?: string | null;
  employeeName?: string | null;
  title: string;
  category: DocumentCategory;
  fileUrl: string;
  fileSize?: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  expiryDate?: string | null;
  uploadedAt: string;
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
  "OFFER_ACCEPTED",
  "ONBOARDING",
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
  "OFFER_ACCEPTED",
  "ONBOARDING",
];

export function roleHome(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin/dashboard";
    case "HR_ADMIN":
      return "/hr/dashboard";
    case "TA_MANAGER":
    case "TA_RECRUITER":
      return "/ta/dashboard";
    default:
      return "/portal/dashboard";
  }
}

// ─── Super Admin New Modules (Part B of update.md) ───────────

export type PlacementJoiningStatus = "JOINING_PENDING" | "JOINED" | "NO_SHOW" | "DEFERRED" | "CANCELLED";
export type ReplacementStatus = "NO_REPLACEMENT" | "REPLACEMENT_REQUESTED" | "REPLACEMENT_IN_PROGRESS" | "REPLACEMENT_COMPLETED" | "CLOSED";

export interface PlacementRecord {
  id: string; // e.g. "PLC-101"
  orgId: string;
  candidateId: string;
  candidateName: string;
  clientId: string;
  clientName: string;
  jobId: string;
  jobTitle: string;
  recruiterId: string;
  recruiterName: string;
  accountManagerName?: string;
  placementDate: string;
  offeredPosition: string;
  offeredSalaryLpa: number;
  joiningDate: string;
  joiningStatus: PlacementJoiningStatus;
  revenueInr: number;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  guaranteePeriodDays: number;
  guaranteeEndDate: string;
  replacementStatus: ReplacementStatus;
  notes?: string | null;
  createdAt: string;
}

export type ClientLeadStage = "NEW" | "CONTACTED" | "QUALIFIED" | "MEETING" | "PROPOSAL" | "NEGOTIATION" | "CONVERTED" | "LOST";

export interface ClientLead {
  id: string;
  orgId: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  industry: string;
  location: string;
  leadSource: "OUTBOUND" | "INBOUND_WEB" | "LINKEDIN" | "REFERRAL" | "EVENT";
  assignedToName: string;
  assignedToId: string;
  stage: ClientLeadStage;
  expectedPositions: number;
  expectedAnnualValueLpa: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  nextFollowUpDate: string;
  notes: string;
  convertedClientId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalType = 
  | "JOB_REQUISITION" 
  | "OFFER_APPROVAL" 
  | "SALARY_EXCEPTION" 
  | "CANDIDATE_EXCEPTION" 
  | "CLIENT_APPROVAL" 
  | "INVOICE_APPROVAL" 
  | "EXPENSE_APPROVAL" 
  | "USER_ACCESS";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "CANCELLED";

export interface ApprovalRequest {
  id: string;
  orgId: string;
  type: ApprovalType;
  title: string;
  requestedById: string;
  requestedByName: string;
  requestedByRole: string;
  date: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedRecordType: "JOB" | "CANDIDATE" | "CLIENT" | "INVOICE" | "USER" | "EXPENSE";
  relatedRecordId: string;
  relatedRecordName: string;
  description: string;
  supportingDocUrl?: string | null;
  status: ApprovalStatus;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
}

export type ComplianceSeverity = "CRITICAL" | "WARNING" | "PENDING" | "COMPLETED";

export interface ComplianceItem {
  id: string;
  orgId: string;
  category: "CONSENT" | "DOCUMENT_EXPIRY" | "MISSING_DOC" | "RETENTION" | "DATA_REQUEST";
  title: string;
  entityType: "CANDIDATE" | "CLIENT" | "EMPLOYEE";
  entityId: string;
  entityName: string;
  severity: ComplianceSeverity;
  dueDate: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "IGNORED";
  detail: string;
  lastUpdated: string;
}

export interface DataQualityIssue {
  id: string;
  orgId: string;
  type: "DUPLICATE_CANDIDATE" | "DUPLICATE_CLIENT" | "DUPLICATE_JOB" | "INCOMPLETE_PROFILE" | "MISSING_RESUME" | "INVALID_CONTACT";
  title: string;
  entityType: "CANDIDATE" | "CLIENT" | "JOB";
  entityId: string;
  entityName: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  details: string;
  suggestedAction: string;
  createdAt: string;
}

export interface IntegrationService {
  id: string;
  orgId: string;
  name: string;
  category: "COMMUNICATION" | "RECRUITMENT" | "CALENDAR" | "STORAGE" | "FINANCE" | "TECHNICAL";
  provider: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR" | "NEEDS_ATTENTION";
  connectedAccount?: string | null;
  lastSyncAt?: string | null;
  icon: string;
  description: string;
  configSummary?: string | null;
}

// ─── Production Agency Settings Models ─────────────────────────

export interface AgencyBranch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  branchHeadName: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface CommissionRuleItem {
  id: string;
  clientType: "ALL" | "DIRECT" | "ENTERPRISE" | "STAFFING";
  placementType: "PERMANENT" | "CONTRACT" | "EXECUTIVE";
  ratePercent: number;
  guaranteePeriodDays: number;
  replacementWindowDays: number;
  effectiveFrom: string;
  notes?: string;
}

export interface PipelineStageConfig {
  id: string;
  name: string;
  code: string;
  order: number;
  color: string;
  active: boolean;
  requiresReason: boolean;
  requiresFeedback: boolean;
  slaHours: number;
}

export interface CustomFieldConfig {
  id: string;
  module: "CANDIDATE" | "JOB" | "CLIENT" | "EMPLOYEE";
  label: string;
  key: string;
  fieldType: "TEXT" | "NUMBER" | "DATE" | "DROPDOWN" | "BOOLEAN" | "CURRENCY";
  required: boolean;
  options?: string[];
  defaultValue?: string;
}

export interface MasterDataItem {
  id: string;
  category: "CANDIDATE_SOURCE" | "REJECTION_REASON" | "INDUSTRY" | "SKILL" | "DEPARTMENT" | "WORK_MODE" | "CLOSURE_REASON";
  label: string;
  value: string;
  active: boolean;
  isDefault?: boolean;
}

export interface OrganizationSettingsFull {
  orgId: string;
  // Agency Profile
  agencyName: string;
  legalName: string;
  registrationNumber: string;
  gstin: string;
  panNumber: string;
  website: string;
  primaryEmail: string;
  billingEmail: string;
  supportPhone: string;
  registeredAddress: string;
  country: string;
  city: string;
  postalCode: string;
  businessType: string;
  // Regional & Preferences
  timezone: string;
  primaryCurrency: string;
  dateFormat: string;
  timeFormat: string;
  fiscalYearStart: string;
  workingDays: string[];
  workStartTime: string;
  workEndTime: string;
  gracePeriodMinutes: number;
  // Recruitment Defaults
  defaultSlaDays: number;
  interviewFeedbackSlaHours: number;
  candidateSubmissionSlaDays: number;
  autoShortlistThresholdScore: number;
  duplicateCandidateMatchBy: "EMAIL_PHONE" | "EMAIL_ONLY" | "PHONE_ONLY";
  // Finance & Invoicing
  defaultCommissionRate: number;
  invoicePrefix: string;
  defaultCreditPeriodDays: number;
  taxGstRatePercent: number;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  bankName: string;
  paymentInstructions: string;
  // Security
  mfaEnforcement: "OPTIONAL" | "ADMINS_ONLY" | "ALL_USERS";
  minPasswordLength: number;
  sessionTimeoutMinutes: number;
  failedLoginLockoutAttempts: number;
  maintenanceMode: boolean;
  maintenanceReason?: string;
  // Custom Lists
  branches: AgencyBranch[];
  commissionRules: CommissionRuleItem[];
  pipelineStages: PipelineStageConfig[];
  customFields: CustomFieldConfig[];
  masterData: MasterDataItem[];
}


