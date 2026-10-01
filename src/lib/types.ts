// ─── AbsoJob CRM — Recruitment Platform Domain Model ──────────
// Multi-tenant: every entity is scoped to org_id.

export type UserRole = "SUPER_ADMIN" | "TA_MANAGER" | "TA_RECRUITER" | "AGENT" | "EMPLOYEE" | "HR_ADMIN" | "FINANCE_ADMIN";

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
  passwordHash?: string | null; // scrypt$salt$hash — set when the user chooses a password
  passwordChangedAt?: string | null;
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
  billing?: ClientBillingProfile;
  creditHold?: boolean;
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
  | "ON_HOLD"
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
  doNotContact?: boolean;
  doNotContactReason?: string | null;
  archived?: boolean;
  offers?: CandidateOffer[];
  clientSubmissions?: CandidateClientSubmission[];
  candidateTasks?: CandidateTaskItem[];
  internalAuditLogs?: CandidateAuditItem[];
  customFieldValues?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateOffer {
  id: string;
  jobId: string;
  jobTitle: string;
  clientId: string;
  clientName: string;
  offeredCtcLpa: number;
  fixedLpa: number;
  joiningBonusLpa?: number;
  offeredDate: string;
  joiningDate: string;
  expiryDate: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "SENT" | "VIEWED" | "NEGOTIATION" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "WITHDRAWN";
  applicationId?: string | null;
  respondedAt?: string | null;
  candidateResponse?: string;
  declineReason?: string;
  createdBy: string;
  createdAt: string;
}

export interface CandidateClientSubmission {
  id: string;
  jobId: string;
  jobTitle: string;
  clientId: string;
  clientName: string;
  submittedBy: string;
  submittedAt: string;
  status: "PENDING_REVIEW" | "SHORTLISTED" | "REJECTED" | "INTERVIEW_REQUESTED";
  applicationId?: string | null;
  emailedTo?: string[];
  clientFeedback?: string;
  responseDate?: string;
  rejectionReason?: string;
}

export interface CandidateTaskItem {
  id: string;
  title: string;
  description?: string;
  assignedToName: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  reminderDate?: string;
  relatedJobTitle?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

export interface CandidateAuditItem {
  id: string;
  action: string;
  fieldChanged?: string;
  previousValue?: string;
  newValue?: string;
  actorName: string;
  reason?: string;
  timestamp: string;
}

export interface CandidateSavedView {
  id: string;
  name: string;
  description?: string;
  filters: Record<string, any>;
  isDefault?: boolean;
  isShared?: boolean;
  createdAt: string;
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
  holdReason?: string | null;
  stageBeforeHold?: ApplicationStage | null;
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
  interviewerUserId?: string | null; // system user who gives feedback
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
  resumeFileId?: string | null;
  candidateConsent?: boolean;
  agentNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Finance — Commissions & Payouts ─────────────────────────

export type LedgerEntryType = "PLACEMENT_COMMISSION" | "REFERRAL_INCENTIVE" | "RECRUITER_INCENTIVE" | "CLAWBACK" | "PAYOUT" | "ADJUSTMENT";
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
  tdsAmount?: number; // 194H deducted on payout
  placementId?: string | null;
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
  mode?: "OFFICE" | "WFH";
  lateByMinutes?: number;
  workedOnOffDay?: boolean; // punched on a week-off / holiday → earns comp-off
}

export type LeaveType = "CASUAL" | "SICK" | "EARNED" | "UNPAID" | "COMP_OFF" | "MATERNITY" | "PATERNITY";
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
  halfDay?: "FIRST" | "SECOND" | null; // half-day leave on a single date
  days?: number; // working days charged (excludes week-offs and holidays)
  attachmentFileId?: string | null; // e.g. medical certificate
  cancelledAt?: string | null;
  cancelReason?: string | null;
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
  probationEndDate?: string | null;
  probationStatus?: "ON_PROBATION" | "CONFIRMED" | "EXTENDED";
  contractEndDate?: string | null;
  avatarUrl?: string | null;
  workMode?: "OFFICE" | "HYBRID" | "REMOTE";
  shiftId?: string | null;
  personalEmail?: string | null;
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
  submittedFileId?: string | null; // new joiner's upload, verified by HR
  submittedAt?: string | null;
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
  // statutory breakdown (employee side)
  pf?: number;
  esi?: number;
  pt?: number;
  lopDays?: number;
  lopAmount?: number;
  // employer cost
  employerPf?: number;
  employerEsi?: number;
  onHold?: boolean;
  holdReason?: string | null;
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
  history?: { action: "CREATED" | "ASSIGNED" | "RETURNED" | "STATUS_CHANGED"; employeeName?: string | null; note?: string | null; byName: string; at: string }[];
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
  completedEmployeeIds?: string[];
  selfEnrollOpen?: boolean;
  feedback?: { employeeId: string; rating: number; comment: string; at: string }[];
  status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED";
  description: string;
}

export type ExitStatus = "PENDING_APPROVAL" | "NOTICE_PERIOD" | "CLEARANCE" | "SETTLED" | "COMPLETED" | "WITHDRAWN";

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
  fnfSettled: boolean; // amount finalised by HR
  fnfAmountInr?: number | null;
  fnfPaid?: boolean; // released by Finance
  experienceLetterIssued: boolean;
  employeeFeedback?: { rating: number; wouldRecommend: boolean; reasonCategory: string; comments: string; at: string } | null;
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
  uploadedByName?: string | null;
  reviewedByName?: string | null;
  rejectionReason?: string | null;
  version?: number;
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

// ─── Pipeline state machine ──────────────────────────────────
// Single source of truth for which stage moves are allowed.
// ONBOARDING is entered only through the onboarding API (Start Onboarding),
// never by a direct stage move, so an onboarding record always exists.

export const INTERVIEW_STAGES: ApplicationStage[] = ["INTERVIEW_SCHEDULED", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND"];
export const TERMINAL_STAGES: ApplicationStage[] = ["JOINED", "REJECTED", "BACKED_OUT", "BLACKLISTED"];
const PRE_OFFER_STAGES: ApplicationStage[] = ["SOURCED", "SCREENING", ...INTERVIEW_STAGES];

const STAGE_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  SOURCED: ["SCREENING", ...INTERVIEW_STAGES, "ON_HOLD", "REJECTED", "BACKED_OUT"],
  SCREENING: ["SOURCED", ...INTERVIEW_STAGES, "ON_HOLD", "REJECTED", "BACKED_OUT"],
  INTERVIEW_SCHEDULED: ["SCREENING", "TECH_ROUND", "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT", "ON_HOLD", "REJECTED", "BACKED_OUT"],
  TECH_ROUND: ["INTERVIEW_SCHEDULED", "CLIENT_ROUND", "HR_ROUND", "OFFER_SENT", "ON_HOLD", "REJECTED", "BACKED_OUT"],
  CLIENT_ROUND: ["TECH_ROUND", "HR_ROUND", "OFFER_SENT", "ON_HOLD", "REJECTED", "BACKED_OUT"],
  HR_ROUND: ["CLIENT_ROUND", "OFFER_SENT", "ON_HOLD", "REJECTED", "BACKED_OUT"],
  OFFER_SENT: ["OFFER_ACCEPTED", "HR_ROUND", "ON_HOLD", "REJECTED", "BACKED_OUT"],
  OFFER_ACCEPTED: ["JOINED", "ON_HOLD", "BACKED_OUT"],
  ONBOARDING: ["JOINED", "BACKED_OUT"],
  ON_HOLD: [...PRE_OFFER_STAGES, "OFFER_SENT", "OFFER_ACCEPTED", "REJECTED", "BACKED_OUT"],
  REJECTED: ["SOURCED", "SCREENING"],
  BACKED_OUT: ["SOURCED", "SCREENING"],
  JOINED: [],
  BLACKLISTED: [],
};

export function allowedNextStages(from: ApplicationStage): ApplicationStage[] {
  return STAGE_TRANSITIONS[from] ?? [];
}

export function canTransition(from: ApplicationStage, to: ApplicationStage): boolean {
  return from !== to && allowedNextStages(from).includes(to);
}

export function roleHome(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin/dashboard";
    case "HR_ADMIN":
      return "/hr/dashboard";
    case "FINANCE_ADMIN":
      return "/finance/dashboard";
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

// ─── Enterprise HRMIS Master Domain Models ───────────────────────

export type EmployeeRequestType =
  | "LEAVE"
  | "ATTENDANCE_CORRECTION"
  | "WFH"
  | "SALARY_CERTIFICATE"
  | "EXPERIENCE_LETTER"
  | "ADDRESS_CHANGE"
  | "BANK_CHANGE"
  | "NAME_CHANGE"
  | "ID_CARD"
  | "IT_SUPPORT"
  | "GRIEVANCE"
  | "OTHER";

export interface EmployeeRequest {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  type: EmployeeRequestType;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING" | "APPROVED" | "REJECTED" | "IN_REVIEW" | "WITHDRAWN";
  payload?: Record<string, string> | null; // structured change applied on approval (bank / name)
  attachmentFileId?: string | null;
  confidential?: boolean; // grievances: HR only
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedByName?: string | null;
  comments?: string | null;
  attachmentName?: string | null;
}

export interface ProbationRecord {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  startDate: string;
  probationMonths: number;
  expectedEndDate: string;
  actualEndDate?: string | null;
  status: "ON_TRACK" | "REVIEW_PENDING" | "CONFIRMED" | "EXTENDED" | "TERMINATED";
  managerName: string;
  reviewScore?: number | null;
  decisionReason?: string | null;
}

export interface PromotionRecord {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  currentDesignation: string;
  newDesignation: string;
  currentDepartment: string;
  newDepartment: string;
  currentCtcLpa: number;
  newCtcLpa: number;
  effectiveDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";
  requestedByName: string;
  approvedByName?: string | null;
}

export interface TransferRecord {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  fromDepartment: string;
  toDepartment: string;
  fromLocation: string;
  toLocation: string;
  fromManager: string;
  toManager: string;
  effectiveDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
}

export interface SalaryRevisionRecord {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  currentCtc: number;
  newCtc: number;
  incrementPercent: number;
  revisionType: "ANNUAL_INCREMENT" | "PROMOTION" | "MARKET_ADJUSTMENT" | "CORRECTION";
  effectiveDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";
  requestedByName: string;
}

export interface ShiftSchedule {
  id: string;
  orgId: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  workingHours: number;
  assignedCount: number;
  isRotational: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export interface AttendanceCorrectionRecord {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  originalCheckIn: string | null;
  originalCheckOut: string | null;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedByName?: string | null;
}

export interface WfhRecord {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedByName?: string | null;
}

export interface LeaveBalanceRecord {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  casualAllowance: number;
  casualUsed: number;
  sickAllowance: number;
  sickUsed: number;
  earnedAllowance: number;
  earnedUsed: number;
  carryForward: number;
}

export interface LeavePolicyConfig {
  id: string;
  leaveType: "CASUAL" | "SICK" | "EARNED" | "MATERNITY" | "PATERNITY" | "UNPAID";
  annualAllowance: number;
  carryForwardMax: number;
  encashmentAllowed: boolean;
  minNoticeDays: number;
  maxConsecutiveDays: number;
  probationAllowed: boolean;
}

export interface GoalOkr {
  id: string;
  orgId: string;
  title: string;
  description: string;
  ownerId: string;
  ownerName: string;
  department: string;
  type: "INDIVIDUAL" | "TEAM" | "DEPARTMENT";
  startDate: string;
  endDate: string;
  weight: number;
  progress: number; // 0 - 100
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "AT_RISK";
}

export interface ReviewCycle {
  id: string;
  orgId: string;
  title: string;
  period: string;
  type: "ANNUAL" | "QUARTERLY" | "PROBATION";
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  deadline: string;
  participantsCount: number;
}

export interface EmployeeBenefit {
  id: string;
  orgId: string;
  title: string;
  category: "INSURANCE" | "WELLNESS" | "MEAL" | "ALLOWANCE" | "COMMUTE";
  provider: string;
  coverageAmount: string;
  enrolledCount: number;
  status: "ACTIVE" | "INACTIVE";
  description: string;
}

export interface HrPolicyItem {
  id: string;
  orgId: string;
  title: string;
  category: "LEAVE" | "ATTENDANCE" | "WFH" | "PAYROLL" | "CODE_OF_CONDUCT" | "BENEFITS";
  version: string;
  effectiveDate: string;
  acknowledgementCount: number;
  summary: string;
  status: "PUBLISHED" | "DRAFT" | "ARCHIVED";
}

export interface WorkflowAutomationRule {
  id: string;
  orgId: string;
  name: string;
  trigger: string;
  condition: string;
  approvalRole: string;
  action: string;
  active: boolean;
}




// ─── Finance workspace ────────────────────────────────────────

export type Currency = "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD";
export type InvoiceStatus = "DRAFT" | "PENDING_APPROVAL" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "WRITTEN_OFF" | "CANCELLED";
export type PaymentMethod = "BANK_TRANSFER" | "UPI" | "CHEQUE" | "CASH" | "CARD";
export type InvoiceKind = "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE";
export type BillingMilestone = "FULL" | "ON_OFFER" | "ON_JOINING" | "RETAINER" | "TIMESHEET" | "REBILL" | "MANUAL";

export interface InvoiceLineItem {
  description: string;
  amount: number; // pre-tax, in invoice currency
  sacCode?: string;
  placementId?: string | null;
  timesheetId?: string | null;
  expenseId?: string | null;
}

/** Legacy per-invoice payment line (kept for display); money is tracked through receipts. */
export interface InvoicePayment {
  id: string;
  receiptId?: string | null;
  amount: number;
  tdsAmount: number;
  date: string;
  method: PaymentMethod;
  reference?: string | null;
  recordedByName: string;
  recordedAt: string;
}

export interface TaxBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  zeroRated: boolean; // export of services under LUT
}

export interface InvoiceReminder {
  at: string;
  stage: string; // e.g. "DUE_IN_3", "OVERDUE_7", "MANUAL"
  sentTo: string;
  byName: string;
}

export interface Invoice {
  id: string;
  orgId: string;
  invoiceNumber: string;
  financialYear: string; // "2026-27"
  kind: InvoiceKind;
  clientId: string;
  clientName: string;
  clientGstin?: string | null;
  placeOfSupply?: string | null; // state code
  placementId?: string | null;
  placementIds?: string[];
  applicationId?: string | null;
  candidateName?: string | null;
  jobTitle?: string | null;
  milestone?: BillingMilestone;
  creditNoteForId?: string | null; // credit / debit note → original invoice
  recurringId?: string | null;
  lineItems: InvoiceLineItem[];
  currency: Currency;
  fxRate: number; // 1 unit of currency in INR
  discount: number;
  subtotal: number; // after discount
  taxRate: number; // %
  tax: TaxBreakdown;
  taxAmount: number;
  roundOff: number;
  total: number;
  amountPaid: number; // cash + TDS + credits applied
  writtenOff: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  sentAt?: string | null;
  paidAt?: string | null;
  payments: InvoicePayment[];
  reminders: InvoiceReminder[];
  approvedByName?: string | null;
  irn?: string | null; // e-invoice reference (from GSP)
  ledgerId?: string | null;
  notes?: string | null;
  createdById?: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptAllocation { invoiceId: string; invoiceNumber: string; amount: number; tds: number }

export interface Receipt {
  id: string;
  orgId: string;
  receiptNumber: string;
  clientId: string;
  clientName: string;
  date: string;
  amount: number; // cash received (INR)
  tdsAmount: number; // TDS the client deducted (claim via 26AS)
  method: PaymentMethod;
  reference?: string | null;
  bankAccountId?: string | null;
  allocations: ReceiptAllocation[];
  unapplied: number; // advance / on-account balance
  reconciled: boolean;
  recordedByName: string;
  createdAt: string;
}

export interface RecurringInvoice {
  id: string;
  orgId: string;
  clientId: string;
  description: string;
  amount: number;
  frequency: "MONTHLY" | "QUARTERLY";
  nextDate: string;
  endDate?: string | null;
  autoSend: boolean;
  active: boolean;
  createdByName: string;
  createdAt: string;
}

export type ExpenseCategory = "TRAVEL" | "SOFTWARE" | "RENT" | "MARKETING" | "JOB_BOARDS" | "OFFICE" | "UTILITIES" | "MEALS" | "TRAINING" | "OTHER";
export type ExpenseStatus = "PENDING_MANAGER" | "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export interface Expense {
  id: string;
  orgId: string;
  category: ExpenseCategory;
  description: string;
  amount: number; // incl. GST
  gstAmount: number; // input tax credit
  vendor?: string | null;
  expenseDate: string;
  isReimbursement: boolean;
  submittedById: string;
  submittedByName: string;
  receiptUrl?: string | null;
  receiptFileId?: string | null;
  billable: boolean; // re-bill to a client
  clientId?: string | null;
  rebilledInvoiceId?: string | null;
  policyFlag?: string | null; // over category limit, etc.
  status: ExpenseStatus;
  managerApprovedByName?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  createdAt: string;
}

export interface Vendor {
  id: string;
  orgId: string;
  name: string;
  category: ExpenseCategory;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  tdsSection?: "194C" | "194J" | "194I" | "NONE";
  paymentTermsDays: number;
  active: boolean;
  createdAt: string;
}

export type VendorBillStatus = "PENDING_APPROVAL" | "APPROVED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";

export interface VendorBill {
  id: string;
  orgId: string;
  vendorId: string;
  vendorName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number; // taxable value
  gstAmount: number;
  tdsSection: "194C" | "194J" | "194I" | "NONE";
  tdsAmount: number;
  total: number; // amount + gst
  payable: number; // total − tds
  amountPaid: number;
  payments: { id: string; amount: number; date: string; method: PaymentMethod; reference?: string | null; byName: string }[];
  status: VendorBillStatus;
  recurring: boolean;
  recurringNextDate?: string | null;
  fileId?: string | null;
  approvedByName?: string | null;
  createdByName: string;
  createdAt: string;
}

export interface ContractAssignment {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  workerName: string;
  workerEmail?: string | null;
  candidateId?: string | null;
  role: string;
  rateType: "DAILY" | "HOURLY" | "MONTHLY";
  billRate: number; // charged to client
  payRate: number; // paid to contractor
  startDate: string;
  endDate?: string | null;
  status: "ACTIVE" | "ENDED";
  recruiterId?: string | null;
  createdByName: string;
  createdAt: string;
}

export interface Timesheet {
  id: string;
  orgId: string;
  assignmentId: string;
  month: string; // YYYY-MM
  units: number; // days / hours / months
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "INVOICED";
  billAmount: number;
  payAmount: number;
  invoiceId?: string | null;
  contractorPaid: boolean;
  approvedByName?: string | null;
  submittedByName: string;
  createdAt: string;
}

export interface FnfPayment {
  id: string;
  orgId: string;
  exitId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  status: "PENDING" | "PAID";
  paidAt?: string | null;
  reference?: string | null;
  createdAt: string;
}

export interface PayeeProfile {
  userId: string;
  pan?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
}

export interface BankAccount {
  id: string;
  name: string; // "HDFC Current"
  bankName: string;
  accountNumber: string;
  ifsc: string;
  openingBalance: number;
  isDefault: boolean;
}

export interface BankStatementLine {
  id: string;
  orgId: string;
  bankAccountId: string;
  date: string;
  description: string;
  reference?: string | null;
  debit: number;
  credit: number;
  matchedType?: "RECEIPT" | "PAYMENT" | "JOURNAL" | null;
  matchedId?: string | null;
  importedAt: string;
}

export interface JournalLine { account: string; debit: number; credit: number; memo?: string }

export interface ManualJournal {
  id: string;
  orgId: string;
  date: string;
  narration: string;
  lines: JournalLine[];
  createdByName: string;
  createdAt: string;
}

export interface Budget { id: string; orgId: string; month: string; category: string; amount: number }

export interface EmailMessage {
  id: string;
  orgId: string;
  to: string[];
  subject: string;
  html: string;
  relatedType?: string | null;
  relatedId?: string | null;
  attachments?: string[]; // file names
  status: "SENT" | "QUEUED" | "FAILED" | "LOGGED";
  providerId?: string | null;
  error?: string | null;
  sentByName: string;
  createdAt: string;
}

export interface StoredFile {
  id: string;
  orgId: string;
  name: string;
  mimeType: string;
  size: number;
  dataBase64: string;
  ownerUserId: string;
  purpose: string;
  createdAt: string;
}

export interface FinanceSettings {
  orgId: string;
  gstRate: number;
  companyStateCode: string; // "27" Maharashtra
  sacCode: string; // 998512 — recruitment services
  invoicePrefix: string; // e.g. "INV/" → INV/2026-27/001
  creditNotePrefix: string;
  debitNotePrefix: string;
  receiptPrefix: string;
  defaultCreditDays: number;
  companyLegalName: string;
  companyAddress: string;
  companyGstin: string;
  companyPan: string;
  lutNumber: string; // for zero-rated exports
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccounts: BankAccount[];
  reimbursementLimitInr: number;
  invoiceApprovalThresholdInr: number; // maker-checker above this
  vendorPaymentApprovalThresholdInr: number;
  reminderDays: number[]; // negative = before due, positive = after due
  expenseCategoryLimits: Partial<Record<ExpenseCategory, number>>;
  commissionTdsPct: number; // 194H
  recruiterIncentivePct: number; // % of collected placement fee
  guaranteeDaysDefault: number;
  creditHoldOverdueDays: number;
  lockedUntil: string | null; // period close
  eInvoiceEnabled: boolean;
  payroll: {
    pfEnabled: boolean; pfRatePct: number; pfWageCeiling: number;
    esiEnabled: boolean; esiEmployeePct: number; esiEmployerPct: number; esiWageCeiling: number;
    ptState: "MH" | "KA" | "NONE";
    taxRegime: "NEW" | "OLD";
  };
}

export interface ClientBillingProfile {
  gstin?: string | null;
  pan?: string | null;
  billingAddress?: string | null;
  stateCode?: string | null; // "27"
  country: string; // "India"
  currency: Currency;
  billingEmails: string[];
  feeModel: "PERCENT" | "FLAT" | "SLAB";
  feePercent?: number | null;
  flatFee?: number | null;
  feeSlabs?: { uptoLpa: number; percent: number }[];
  splitOnOfferPct: number; // 0 = bill 100% on joining
  guaranteeDays: number;
  creditLimit?: number | null;
}


// ─── Partner (agent) programme ────────────────────────────────

export type KycStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface AgentProfile {
  userId: string;
  orgId: string;
  city: string;
  pan?: string | null;
  idProofFileId?: string | null;
  kycStatus: KycStatus;
  kycNote?: string | null;
  specialization: string[]; // e.g. ["IT", "BPO"]
  experienceYears: number;
  sourcingChannels: string[]; // e.g. ["LinkedIn", "Campus"]
  agreementAcceptedAt: string;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface ReferralMessage {
  id: string;
  orgId: string;
  referralId: string;
  fromUserId: string;
  fromName: string;
  fromRole: UserRole;
  text: string;
  createdAt: string;
}

// ─── Recruiter workspace ──────────────────────────────────────

export type MessageChannel = "EMAIL" | "WHATSAPP" | "SMS";

export interface MessageTemplate {
  id: string;
  orgId: string;
  name: string;
  channel: MessageChannel;
  audience: "CANDIDATE" | "CLIENT";
  subject?: string | null;
  body: string; // supports {{candidateName}} {{jobTitle}} {{clientName}} {{interviewDate}} {{recruiterName}} {{companyName}} {{contactPerson}}
  createdByName: string;
  createdAt: string;
}

export interface ClientCommunication {
  id: string;
  orgId: string;
  clientId: string;
  channel: "EMAIL" | "PHONE" | "MEETING" | "WHATSAPP";
  direction: "INCOMING" | "OUTGOING";
  subject: string;
  body: string;
  jobId?: string | null;
  nextFollowUpDate?: string | null;
  byUserId: string;
  byName: string;
  createdAt: string;
}

export interface RecruiterTarget {
  id: string;
  orgId: string;
  userId: string;
  month: string; // YYYY-MM
  submissions: number;
  interviews: number;
  offers: number;
  joinings: number;
  revenue: number;
  setByName: string;
}

// ─── Employee self-service ───────────────────────────────────

export interface Holiday {
  id: string;
  orgId: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: "NATIONAL" | "FESTIVAL" | "OPTIONAL";
  locations?: string[]; // empty = all locations
}

export interface PolicyAcknowledgement {
  id: string;
  orgId: string;
  policyId: string;
  version: string;
  userId: string;
  acknowledgedAt: string;
}

export interface BenefitEnrollment {
  id: string;
  orgId: string;
  benefitId: string;
  employeeId: string;
  status: "ENROLLED" | "OPTED_OUT";
  dependents: { name: string; relation: string; dob?: string }[];
  updatedAt: string;
}

export type TaxRegime = "NEW" | "OLD";

export interface TaxDeclaration {
  id: string;
  orgId: string;
  employeeId: string;
  fy: string; // "2026-27"
  regime: TaxRegime;
  sec80C: number; // LIC, ELSS, PPF, tuition (excl. employee PF, added automatically)
  sec80D: number; // health insurance premium
  hraRentPaid: number; // annual rent
  metroCity: boolean;
  homeLoanInterest: number; // sec 24(b)
  nps80CCD1B: number;
  otherDeductions: number; // 80E, 80G …
  proofFileIds: string[];
  status: "DRAFT" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  reviewNote?: string | null;
  reviewedByName?: string | null;
  submittedAt?: string | null;
  updatedAt: string;
}
