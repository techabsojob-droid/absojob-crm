// ─── AbsoJob CRM — In-memory mock database (multi-tenant) ─────
// Swappable with Prisma later: API routes only touch this module.

import type {
  Organization, User, Client, JobRequisition, Candidate, Application,
  Interview, Referral, CommissionLedgerEntry, Payout, AttendanceRecord,
  LeaveRequest, Task, Announcement, AuditLog, Notification,
} from "@/lib/types";

export { ACTIVE_STAGES, STAGE_ORDER } from "@/lib/types";

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

export const organizations: Organization[] = [
  { id: "org-1", name: "AbsoJob Staffing", slug: "absojob", plan: "GROWTH", status: "ACTIVE", industry: "IT & Tech Staffing", logoUrl: null, createdAt: daysAgo(500) },
  { id: "org-2", name: "PrimeHire Solutions", slug: "primehire", plan: "STARTER", status: "ACTIVE", industry: "BPO & Support Staffing", logoUrl: null, createdAt: daysAgo(180) },
];

const ORG_1 = "org-1";

// ─── Users ────────────────────────────────────────────────────

export const users: User[] = [
  // Org 1
  { id: "usr-sa", orgId: ORG_1, name: "Aarav Mehta", email: "admin@absojob.com", phone: "+91 98200 11223", role: "SUPER_ADMIN", status: "ACTIVE", avatarUrl: null, department: "Leadership", designation: "Founder & CEO", location: "Mumbai", reportingTo: null, joinedAt: daysAgo(500), deactivatedAt: null },
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
];

export function userById(id: string | null | undefined): User | undefined {
  if (!id) return undefined;
  return users.find((u) => u.id === id);
}

export function userName(id: string | null | undefined): string {
  return userById(id)?.name ?? "—";
}

// ─── Clients ──────────────────────────────────────────────────

export const clients: Client[] = [
  { id: "cl-1", orgId: ORG_1, companyName: "TechNova Systems", industry: "IT Services", website: "https://technova.io", contactPerson: "Deepak Rao", contactEmail: "deepak.rao@technova.io", contactPhone: "+91 90011 22001", address: "Powai, Mumbai", status: "ACTIVE", agreementUrl: null, commissionRate: 8.33, creditDays: 30, accountManagerId: "usr-tam", estimatedValue: "₹42L", notes: "Premium client — fast turnaround expected.", createdAt: daysAgo(300), updatedAt: daysAgo(5) },
  { id: "cl-2", orgId: ORG_1, companyName: "FinEdge Capital", industry: "Fintech", website: "https://finedge.in", contactPerson: "Shalini Gupta", contactEmail: "shalini@finedge.in", contactPhone: "+91 90022 33002", address: "Lower Parel, Mumbai", status: "ACTIVE", agreementUrl: null, commissionRate: 10, creditDays: 45, accountManagerId: "usr-tam", estimatedValue: "₹28L", notes: null, createdAt: daysAgo(210), updatedAt: daysAgo(12) },
  { id: "cl-3", orgId: ORG_1, companyName: "MediCare Plus", industry: "Healthcare", website: null, contactPerson: "Dr. Imran Khan", contactEmail: "imran@medicareplus.co", contactPhone: "+91 90033 44003", address: "Bandra East, Mumbai", status: "ONBOARDING", agreementUrl: null, commissionRate: 12, creditDays: 30, accountManagerId: "usr-ta1", estimatedValue: "₹15L", notes: "Agreement under legal review.", createdAt: daysAgo(20), updatedAt: daysAgo(2) },
  { id: "cl-4", orgId: ORG_1, companyName: "RetailMart India", industry: "E-commerce", website: "https://retailmart.in", contactPerson: "Pooja Rathi", contactEmail: "pooja@retailmart.in", contactPhone: "+91 90044 55004", address: "Andheri East, Mumbai", status: "ACTIVE", agreementUrl: null, commissionRate: 8, creditDays: 60, accountManagerId: "usr-ta2", estimatedValue: "₹35L", notes: null, createdAt: daysAgo(150), updatedAt: daysAgo(8) },
  { id: "cl-5", orgId: ORG_1, companyName: "CloudLeap Technologies", industry: "SaaS", website: null, contactPerson: "Farhan Ali", contactEmail: "farhan@cloudleap.dev", contactPhone: "+91 90055 66005", address: "Pune", status: "PROSPECT", agreementUrl: null, commissionRate: 10, creditDays: 30, accountManagerId: "usr-ta2", estimatedValue: "₹18L", notes: "First meeting done, proposal sent.", createdAt: daysAgo(9), updatedAt: daysAgo(1) },
  { id: "cl-6", orgId: ORG_1, companyName: "LogiSwift Logistics", industry: "Logistics", website: null, contactPerson: "Sanjay Menon", contactEmail: "sanjay@logiswift.com", contactPhone: "+91 90066 77006", address: "Navi Mumbai", status: "PAUSED", agreementUrl: null, commissionRate: 9, creditDays: 45, accountManagerId: "usr-ta1", estimatedValue: "₹10L", notes: "Hiring freeze until next quarter.", createdAt: daysAgo(260), updatedAt: daysAgo(30) },
  // Org 2
  { id: "org2-cl-1", orgId: "org-2", companyName: "Delhi BPO Hub", industry: "BPO", website: null, contactPerson: "Anil Bansal", contactEmail: "anil@delhibpo.com", contactPhone: "+91 98000 10001", address: "Noida", status: "ACTIVE", agreementUrl: null, commissionRate: 7, creditDays: 30, accountManagerId: "org2-sa", estimatedValue: "₹12L", notes: null, createdAt: daysAgo(120), updatedAt: daysAgo(4) },
];

// ─── Job Requisitions ─────────────────────────────────────────

export const jobs: JobRequisition[] = [
  { id: "job-101", orgId: ORG_1, clientId: "cl-1", title: "Senior Backend Engineer (Node.js)", department: "Engineering", location: "Powai, Mumbai (Hybrid)", employmentType: "FULL_TIME", priority: "URGENT", openings: 3, filled: 1, salaryMinLpa: 18, salaryMaxLpa: 28, experienceMinYears: 4, experienceMaxYears: 8, skills: ["Node.js", "PostgreSQL", "AWS", "Microservices"], description: "Own backend services for payments platform. Strong system design needed.", status: "INTERVIEWING", requestedById: "usr-tam", approvedById: "usr-sa", assignedTas: ["usr-ta1"], targetCloseDate: daysAhead(21), createdAt: daysAgo(45), updatedAt: daysAgo(1) },
  { id: "job-102", orgId: ORG_1, clientId: "cl-2", title: "Risk Analyst", department: "Risk", location: "Lower Parel, Mumbai", employmentType: "FULL_TIME", priority: "HIGH", openings: 2, filled: 0, salaryMinLpa: 10, salaryMaxLpa: 16, experienceMinYears: 2, experienceMaxYears: 5, skills: ["SQL", "Excel", "Risk Modelling", "Python"], description: "Credit risk analytics for lending portfolio.", status: "SOURCING", requestedById: "usr-ag1", approvedById: "usr-sa", assignedTas: ["usr-ta2"], targetCloseDate: daysAhead(30), createdAt: daysAgo(22), updatedAt: daysAgo(2) },
  { id: "job-103", orgId: ORG_1, clientId: "cl-1", title: "DevOps Engineer", department: "Platform", location: "Remote (India)", employmentType: "REMOTE", priority: "HIGH", openings: 1, filled: 1, salaryMinLpa: 14, salaryMaxLpa: 22, experienceMinYears: 3, experienceMaxYears: 7, skills: ["Kubernetes", "Terraform", "CI/CD", "Docker"], description: "Infra automation and release engineering.", status: "FULFILLED", requestedById: "usr-tam", approvedById: "usr-sa", assignedTas: ["usr-ta1"], targetCloseDate: null, createdAt: daysAgo(70), updatedAt: daysAgo(10) },
  { id: "job-104", orgId: ORG_1, clientId: "cl-4", title: "Category Manager", department: "Catalog", location: "Andheri East, Mumbai", employmentType: "FULL_TIME", priority: "MEDIUM", openings: 2, filled: 0, salaryMinLpa: 12, salaryMaxLpa: 18, experienceMinYears: 4, experienceMaxYears: 9, skills: ["Category Management", "Vendor Negotiation", "Analytics"], description: "Own P&L for home category.", status: "INTERVIEWING", requestedById: "usr-ag2", approvedById: "usr-sa", assignedTas: ["usr-ta2"], targetCloseDate: daysAhead(25), createdAt: daysAgo(33), updatedAt: daysAgo(3) },
  { id: "job-105", orgId: ORG_1, clientId: "cl-3", title: "Staff Nurse (ICU)", department: "Clinical", location: "Bandra East, Mumbai", employmentType: "FULL_TIME", priority: "URGENT", openings: 5, filled: 0, salaryMinLpa: 3.5, salaryMaxLpa: 6, experienceMinYears: 1, experienceMaxYears: 6, skills: ["ICU", "BSc Nursing", "Patient Care"], description: "Night shifts rotation, 26 bed ICU.", status: "PENDING_APPROVAL", requestedById: "usr-ag1", approvedById: null, assignedTas: [], targetCloseDate: daysAhead(45), createdAt: daysAgo(4), updatedAt: daysAgo(4) },
  { id: "job-106", orgId: ORG_1, clientId: "cl-2", title: "Compliance Manager", department: "Legal", location: "Lower Parel, Mumbai", employmentType: "FULL_TIME", priority: "MEDIUM", openings: 1, filled: 0, salaryMinLpa: 16, salaryMaxLpa: 24, experienceMinYears: 6, experienceMaxYears: 12, skills: ["SEBI", "Compliance", "Audit"], description: "Regulatory compliance for broking arm.", status: "APPROVED", requestedById: "usr-tam", approvedById: "usr-sa", assignedTas: [], targetCloseDate: daysAhead(40), createdAt: daysAgo(6), updatedAt: daysAgo(5) },
  { id: "job-107", orgId: ORG_1, clientId: "cl-4", title: "Customer Support Lead", department: "Support", location: "Malad, Mumbai", employmentType: "HYBRID", priority: "LOW", openings: 1, filled: 0, salaryMinLpa: 6, salaryMaxLpa: 9, experienceMinYears: 3, experienceMaxYears: 6, skills: ["Team Handling", "CRM", "Escalations"], description: "Lead 12-member support pod.", status: "CANCELLED", requestedById: "usr-ag2", approvedById: "usr-sa", assignedTas: [], targetCloseDate: null, createdAt: daysAgo(55), updatedAt: daysAgo(20) },
  { id: "job-108", orgId: ORG_1, clientId: "cl-1", title: "QA Automation Engineer", department: "Engineering", location: "Powai, Mumbai (Hybrid)", employmentType: "CONTRACT", priority: "MEDIUM", openings: 2, filled: 0, salaryMinLpa: 9, salaryMaxLpa: 14, experienceMinYears: 2, experienceMaxYears: 6, skills: ["Playwright", "TypeScript", "API Testing"], description: "12-month renewable contract.", status: "SOURCING", requestedById: "usr-ta1", approvedById: "usr-sa", assignedTas: ["usr-ta1", "usr-ta2"], targetCloseDate: daysAhead(18), createdAt: daysAgo(12), updatedAt: daysAgo(1) },
  // Org 2
  { id: "org2-job-201", orgId: "org-2", clientId: "org2-cl-1", title: "Voice Process Executive", department: "Operations", location: "Noida", employmentType: "FULL_TIME", priority: "HIGH", openings: 20, filled: 4, salaryMinLpa: 2.4, salaryMaxLpa: 3.6, experienceMinYears: 0, experienceMaxYears: 3, skills: ["English", "Hindi", "Communication"], description: "International voice process, rotational shifts.", status: "SOURCING", requestedById: "org2-sa", approvedById: "org2-sa", assignedTas: [], targetCloseDate: daysAhead(30), createdAt: daysAgo(15), updatedAt: daysAgo(2) },
];

// ─── Candidates ───────────────────────────────────────────────

let candSeq = 1;
function mkCandidate(c: Omit<Candidate, "id" | "orgId" | "createdAt" | "updatedAt" | "blacklisted" | "blacklistReason">): Candidate {
  return {
    ...c,
    id: `cand-${String(candSeq++).padStart(3, "0")}`,
    orgId: ORG_1,
    blacklisted: false,
    blacklistReason: null,
    createdAt: daysAgo(60 - candSeq),
    updatedAt: daysAgo(Math.max(0, 50 - candSeq)),
  };
}

export const candidates: Candidate[] = [
  mkCandidate({ name: "Amit Verma", email: "amit.verma@gmail.com", phone: "+91 90111 10101", currentCompany: "TCS", currentDesignation: "Sr. Software Engineer", totalExperienceYears: 6, relevantExperienceYears: 5, currentCtcLpa: 16, expectedCtcLpa: 24, noticePeriodDays: 60, location: "Mumbai", skills: ["Node.js", "PostgreSQL", "AWS", "Redis"], resumeUrl: null, rating: 5, source: "AGENT_REFERRAL", referredByUserId: "usr-ag1" }),
  mkCandidate({ name: "Divya Sharma", email: "divya.s@outlook.com", phone: "+91 90122 20202", currentCompany: "Infosys", currentDesignation: "Software Engineer", totalExperienceYears: 4, relevantExperienceYears: 4, currentCtcLpa: 12, expectedCtcLpa: 19, noticePeriodDays: 90, location: "Thane", skills: ["Node.js", "Express", "MongoDB"], resumeUrl: null, rating: 4, source: "LINKEDIN", referredByUserId: null }),
  mkCandidate({ name: "Karan Malhotra", email: "karan.m@gmail.com", phone: "+91 90133 30303", currentCompany: "Accenture", currentDesignation: "Technology Lead", totalExperienceYears: 8, relevantExperienceYears: 7, currentCtcLpa: 22, expectedCtcLpa: 30, noticePeriodDays: 30, location: "Mumbai", skills: ["Node.js", "Microservices", "Kafka", "AWS"], resumeUrl: null, rating: 4, source: "DATABASE", referredByUserId: null }),
  mkCandidate({ name: "Ritika Bansal", email: "ritika.b@yahoo.in", phone: "+91 90144 40404", currentCompany: "HDFC Bank", currentDesignation: "Risk Analyst II", totalExperienceYears: 3, relevantExperienceYears: 3, currentCtcLpa: 9, expectedCtcLpa: 14, noticePeriodDays: 60, location: "Mumbai", skills: ["SQL", "Python", "Risk Modelling"], resumeUrl: null, rating: 4, source: "AGENT_REFERRAL", referredByUserId: "usr-ag2" }),
  mkCandidate({ name: "Suresh Naidu", email: "suresh.n@gmail.com", phone: "+91 90155 50505", currentCompany: "ICICI", currentDesignation: "Credit Analyst", totalExperienceYears: 5, relevantExperienceYears: 5, currentCtcLpa: 11, expectedCtcLpa: 15, noticePeriodDays: 30, location: "Navi Mumbai", skills: ["SQL", "Excel", "Underwriting"], resumeUrl: null, rating: 3, source: "JOB_PORTAL", referredByUserId: null }),
  mkCandidate({ name: "Anjali Deshmukh", email: "anjali.d@gmail.com", phone: "+91 90166 60606", currentCompany: "Amazon", currentDesignation: "Program Manager", totalExperienceYears: 7, relevantExperienceYears: 5, currentCtcLpa: 26, expectedCtcLpa: 32, noticePeriodDays: 75, location: "Mumbai", skills: ["Category Management", "Analytics", "Vendor Management"], resumeUrl: null, rating: 5, source: "LINKEDIN", referredByUserId: null }),
  mkCandidate({ name: "Mohit Sinha", email: "mohit.sinha@gmail.com", phone: "+91 90177 70707", currentCompany: "Flipkart", currentDesignation: "Category Manager 2", totalExperienceYears: 6, relevantExperienceYears: 6, currentCtcLpa: 18, expectedCtcLpa: 24, noticePeriodDays: 60, location: "Bengaluru", skills: ["Category Management", "P&L", "Negotiation"], resumeUrl: null, rating: 4, source: "AGENT_REFERRAL", referredByUserId: "usr-ag1" }),
  mkCandidate({ name: "Priyanka Rao", email: "priyanka.r@gmail.com", phone: "+91 90188 80808", currentCompany: "Wipro", currentDesignation: "Test Lead", totalExperienceYears: 5, relevantExperienceYears: 5, currentCtcLpa: 10, expectedCtcLpa: 13, noticePeriodDays: 60, location: "Pune", skills: ["Playwright", "TypeScript", "API Testing", "Jenkins"], resumeUrl: null, rating: 4, source: "JOB_PORTAL", referredByUserId: null }),
  mkCandidate({ name: "Aditya Rane", email: "aditya.rane@gmail.com", phone: "+91 90199 90909", currentCompany: "Persistent Systems", currentDesignation: "Sr. QA Engineer", totalExperienceYears: 3, relevantExperienceYears: 3, currentCtcLpa: 7, expectedCtcLpa: 10, noticePeriodDays: 45, location: "Pune", skills: ["Playwright", "JavaScript", "REST Assured"], resumeUrl: null, rating: 3, source: "DATABASE", referredByUserId: null }),
  mkCandidate({ name: "Fatima Sheikh", email: "fatima.s@gmail.com", phone: "+91 90200 11010", currentCompany: "CloudLeap Technologies", currentDesignation: "DevOps Engineer", totalExperienceYears: 4, relevantExperienceYears: 4, currentCtcLpa: 15, expectedCtcLpa: 20, noticePeriodDays: 30, location: "Remote", skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"], resumeUrl: null, rating: 5, source: "OTHER", referredByUserId: null }),
  mkCandidate({ name: "Nikhil Joshi", email: "nikhil.j@gmail.com", phone: "+91 90211 12011", currentCompany: "Zoho", currentDesignation: "DevOps Engineer II", totalExperienceYears: 5, relevantExperienceYears: 5, currentCtcLpa: 17, expectedCtcLpa: 23, noticePeriodDays: 60, location: "Chennai", skills: ["Kubernetes", "Docker", "Azure", "Ansible"], resumeUrl: null, rating: 4, source: "LINKEDIN", referredByUserId: null }),
  mkCandidate({ name: "Sameer Khan", email: "sameer.k@gmail.com", phone: "+91 90222 13012", currentCompany: "Freelancer", currentDesignation: "Backend Consultant", totalExperienceYears: 7, relevantExperienceYears: 6, currentCtcLpa: 0, expectedCtcLpa: 26, noticePeriodDays: 15, location: "Mumbai", skills: ["Node.js", "GraphQL", "PostgreSQL"], resumeUrl: null, rating: 3, source: "WALK_IN", referredByUserId: null }),
];

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
export const applications: Application[] = appSeeds.map(([ci, jobId, stage, recruiterId, fit]) => {
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
});

export const joinedApplication = applications.find((a) => a.stage === "JOINED")!;

// ─── Interviews ───────────────────────────────────────────────

let itrSeq = 1;
function mkInterview(i: Omit<Interview, "id" | "orgId" | "createdAt">): Interview {
  return { ...i, id: `itr-${String(itrSeq++).padStart(3, "0")}`, orgId: ORG_1, createdAt: daysAgo(10) };
}

export const interviews: Interview[] = [
  mkInterview({ applicationId: "app-001", round: "CLIENT_ROUND", mode: "VIDEO", scheduledAt: daysAhead(1, 15, 0), durationMins: 60, interviewerName: "Deepak Rao (TechNova)", status: "SCHEDULED", outcome: "PENDING", score: null, feedback: null, meetingLink: "https://meet.google.com/abc-defg-hij", createdBy: "usr-ta1" }),
  mkInterview({ applicationId: "app-002", round: "TECH_1", mode: "VIDEO", scheduledAt: daysAhead(2, 11, 30), durationMins: 45, interviewerName: "TechNova Panel", status: "SCHEDULED", outcome: "PENDING", score: null, feedback: null, meetingLink: "https://meet.google.com/xyz-pqrs-tuv", createdBy: "usr-ta1" }),
  mkInterview({ applicationId: "app-007", round: "CLIENT_ROUND", mode: "ONSITE", scheduledAt: daysAhead(3, 14, 0), durationMins: 90, interviewerName: "RetailMart HR + Category Head", status: "SCHEDULED", outcome: "PENDING", score: null, feedback: null, meetingLink: null, createdBy: "usr-ta2" }),
  mkInterview({ applicationId: "app-008", round: "SCREENING_CALL", mode: "PHONE", scheduledAt: daysAgo(2), durationMins: 30, interviewerName: "Rahul Sharma", status: "COMPLETED", outcome: "HIRE", score: 7, feedback: "Good hands-on with Playwright. Communication above average.", meetingLink: null, createdBy: "usr-ta1" }),
  mkInterview({ applicationId: "app-003", round: "FINAL", mode: "VIDEO", scheduledAt: daysAgo(5), durationMins: 60, interviewerName: "CTO FinEdge… actually TechNova CTO", status: "COMPLETED", outcome: "STRONG_HIRE", score: 9, feedback: "Excellent system design. Offer recommended at top of band.", meetingLink: null, createdBy: "usr-ta1" }),
  mkInterview({ applicationId: "app-005", round: "SCREENING_CALL", mode: "PHONE", scheduledAt: daysAhead(1, 12, 0), durationMins: 30, interviewerName: "Priya Iyer", status: "RESCHEDULED", outcome: "PENDING", score: null, feedback: null, meetingLink: null, createdBy: "usr-ta2" }),
  mkInterview({ applicationId: "app-006", round: "HR_ROUND", mode: "VIDEO", scheduledAt: daysAgo(1), durationMins: 45, interviewerName: "RetailMart HR Head", status: "COMPLETED", outcome: "HIRE", score: 8, feedback: "Culture fit strong. Compensation discussion pending.", meetingLink: null, createdBy: "usr-ta2" }),
];

// ─── Referrals (agent-submitted candidates) ───────────────────

export const referrals: Referral[] = [
  { id: "ref-001", orgId: ORG_1, agentId: "usr-ag1", candidateId: candidates[0].id, jobId: "job-101", status: "SHORTLISTED", incentiveAmount: 15000, incentivePaid: false, reviewNotes: "Strong profile, moved to pipeline.", createdAt: daysAgo(25), updatedAt: daysAgo(6) },
  { id: "ref-002", orgId: ORG_1, agentId: "usr-ag2", candidateId: candidates[3].id, jobId: "job-102", status: "UNDER_REVIEW", incentiveAmount: 10000, incentivePaid: false, reviewNotes: null, createdAt: daysAgo(12), updatedAt: daysAgo(3) },
  { id: "ref-003", orgId: ORG_1, agentId: "usr-ag1", candidateId: candidates[6].id, jobId: "job-104", status: "HIRED", incentiveAmount: 25000, incentivePaid: true, reviewNotes: "Joined via RetailMart category role.", createdAt: daysAgo(48), updatedAt: daysAgo(10) },
  { id: "ref-004", orgId: ORG_1, agentId: "usr-ag2", candidateId: candidates[11].id, jobId: null, status: "SUBMITTED", incentiveAmount: 0, incentivePaid: false, reviewNotes: "Awaiting job mapping.", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { id: "ref-005", orgId: ORG_1, agentId: "usr-ag1", candidateId: candidates[2].id, jobId: "job-101", status: "SUBMITTED", incentiveAmount: 0, incentivePaid: false, reviewNotes: null, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { id: "ref-006", orgId: ORG_1, agentId: "usr-ag3", candidateId: candidates[5].id, jobId: "job-104", status: "REJECTED", incentiveAmount: 0, incentivePaid: false, reviewNotes: "Already in database from last quarter.", createdAt: daysAgo(30), updatedAt: daysAgo(28) },
];

// ─── Finance — ledger & payouts ───────────────────────────────

export const commissionLedger: CommissionLedgerEntry[] = [
  { id: "led-001", orgId: ORG_1, userId: null, clientId: "cl-1", applicationId: joinedApplication.id, type: "PLACEMENT_COMMISSION", amountInr: 187000, status: "PENDING", description: "Placement: DevOps Engineer @ CloudLeap (Fatima Sheikh)", invoiceNumber: "INV-2026-041", dueDate: dateOnly(18), paidAt: null, createdAt: daysAgo(12) },
  { id: "led-002", orgId: ORG_1, userId: "usr-ag1", clientId: null, applicationId: null, type: "REFERRAL_INCENTIVE", amountInr: 25000, status: "PAID", description: "Referral incentive — Mohit Sinha joined RetailMart", invoiceNumber: null, dueDate: null, paidAt: daysAgo(8), createdAt: daysAgo(15) },
  { id: "led-003", orgId: ORG_1, userId: null, clientId: "cl-4", applicationId: null, type: "PLACEMENT_COMMISSION", amountInr: 144000, status: "PAID", description: "Q1 bulk placements — support vertical", invoiceNumber: "INV-2026-032", dueDate: dateOnly(-10), paidAt: daysAgo(20), createdAt: daysAgo(45) },
  { id: "led-004", orgId: ORG_1, userId: "usr-ag2", clientId: null, applicationId: null, type: "REFERRAL_INCENTIVE", amountInr: 10000, status: "APPROVED", description: "Referral incentive — Ritika Bansal (FinEdge)", invoiceNumber: null, dueDate: dateOnly(10), paidAt: null, createdAt: daysAgo(5) },
  { id: "led-005", orgId: ORG_1, userId: null, clientId: "cl-2", applicationId: null, type: "PLACEMENT_COMMISSION", amountInr: 96000, status: "APPROVED", description: "Placement: Risk Analyst offer stage (partial billing on joining)", invoiceNumber: "INV-2026-044", dueDate: dateOnly(25), paidAt: null, createdAt: daysAgo(3) },
  { id: "led-006", orgId: ORG_1, userId: null, clientId: "cl-6", applicationId: null, type: "ADJUSTMENT", amountInr: -32000, status: "PAID", description: "Credit note — candidate backed out within 30 days", invoiceNumber: "CN-2026-004", dueDate: null, paidAt: daysAgo(22), createdAt: daysAgo(24) },
];

export const payouts: Payout[] = [
  { id: "pay-001", orgId: ORG_1, userId: "usr-ag1", amountInr: 25000, periodLabel: "Jul 2026", status: "PAID", method: "BANK_TRANSFER", reference: "NEFT-889123", processedAt: daysAgo(8), createdAt: daysAgo(10) },
  { id: "pay-002", orgId: ORG_1, userId: "usr-ag2", amountInr: 10000, periodLabel: "Aug 2026", status: "PROCESSING", method: "UPI", reference: null, processedAt: null, createdAt: daysAgo(2) },
  { id: "pay-003", orgId: ORG_1, userId: "usr-ta1", amountInr: 40000, periodLabel: "Jul 2026", status: "PAID", method: "BANK_TRANSFER", reference: "NEFT-889010", processedAt: daysAgo(12), createdAt: daysAgo(14) },
];

// ─── Attendance (current month) ───────────────────────────────

function seedAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const activeUsers = users.filter((u) => u.orgId === ORG_1 && u.status === "ACTIVE");
  let seq = 1;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split("T")[0];
    const dow = d.getDay();
    if (dow === 0) continue;

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

export const attendance: AttendanceRecord[] = seedAttendance();
let attSeq = attendance.length + 1;

/** Hours between check-in & check-out, rounded to 1 decimal. */
export function hoursWorkedOf(a: AttendanceRecord): number {
  if (!a.checkIn || !a.checkOut) return 0;
  const h = (new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime()) / 3600000;
  return h > 0 ? Math.round(h * 10) / 10 : 0;
}

// ─── Leave requests ───────────────────────────────────────────

export const leaveRequests: LeaveRequest[] = [
  { id: "lv-001", orgId: ORG_1, userId: "usr-ag1", leaveType: "CASUAL", fromDate: dateOnly(4), toDate: dateOnly(5), reason: "Family function out of town.", status: "PENDING", approverId: null, decisionNote: null, createdAt: daysAgo(1) },
  { id: "lv-002", orgId: ORG_1, userId: "usr-ta2", leaveType: "SICK", fromDate: dateOnly(-3), toDate: dateOnly(-2), reason: "Viral fever, doctor advised rest.", status: "APPROVED", approverId: "usr-tam", decisionNote: "Get well soon.", createdAt: daysAgo(6) },
  { id: "lv-003", orgId: ORG_1, userId: "usr-em1", leaveType: "EARNED", fromDate: dateOnly(12), toDate: dateOnly(16), reason: "Planned vacation — Goa trip.", status: "PENDING", approverId: null, decisionNote: null, createdAt: daysAgo(0, -3) },
  { id: "lv-004", orgId: ORG_1, userId: "usr-ag2", leaveType: "UNPAID", fromDate: dateOnly(-15), toDate: dateOnly(-15), reason: "Personal work.", status: "REJECTED", approverId: "usr-tam", decisionNote: "Month-end closing week — please plan later.", createdAt: daysAgo(20) },
];

// ─── Tasks ────────────────────────────────────────────────────

export const tasks: Task[] = [
  { id: "tsk-001", orgId: ORG_1, assignedToId: "usr-ta1", createdById: "usr-tam", title: "Collect documents from Karan Malhotra", description: "Offer released — need PAN, degree certs before joining.", dueDate: dateOnly(1), priority: "URGENT", linkedApplicationId: "app-003", completed: false, createdAt: daysAgo(2) },
  { id: "tsk-002", orgId: ORG_1, assignedToId: "usr-ta1", createdById: "usr-tam", title: "Follow up: Amit Verma client round feedback", description: null, dueDate: dateOnly(0), priority: "HIGH", linkedApplicationId: "app-001", completed: false, createdAt: daysAgo(1) },
  { id: "tsk-003", orgId: ORG_1, assignedToId: "usr-ta2", createdById: "usr-tam", title: "Source 5 more profiles for Risk Analyst", description: "FinEdge wants diverse banking backgrounds.", dueDate: dateOnly(2), priority: "HIGH", linkedApplicationId: null, completed: false, createdAt: daysAgo(3) },
  { id: "tsk-004", orgId: ORG_1, assignedToId: "usr-ag1", createdById: "usr-tam", title: "Refer 3 candidates for ICU Nurse (MediCare)", description: "Urgent requisition pending approval — gather interest first.", dueDate: dateOnly(3), priority: "MEDIUM", linkedApplicationId: null, completed: false, createdAt: daysAgo(1) },
  { id: "tsk-005", orgId: ORG_1, assignedToId: "usr-ta2", createdById: "usr-ta2", title: "Update candidate tracker sheet", description: null, dueDate: dateOnly(-1), priority: "LOW", linkedApplicationId: null, completed: true, createdAt: daysAgo(5) },
  { id: "tsk-006", orgId: ORG_1, assignedToId: "usr-em1", createdById: "usr-sa", title: "Prepare monthly ops report draft", description: null, dueDate: dateOnly(4), priority: "MEDIUM", linkedApplicationId: null, completed: false, createdAt: daysAgo(2) },
];

// ─── Announcements ────────────────────────────────────────────

export const announcements: Announcement[] = [
  { id: "ann-001", orgId: ORG_1, title: "New referral incentive structure 🎉", body: "Effective immediately: ₹15,000 per successful IT placement referral and ₹25,000 for leadership roles. Payouts within 15 days of candidate completing 30 days.", audience: ["ALL"], pinned: true, createdById: "usr-sa", createdAt: daysAgo(7) },
  { id: "ann-002", orgId: ORG_1, title: "Office closed on Independence Day", body: "Mumbai office will remain closed on 15th August. Field visits can be scheduled with prior approval.", audience: ["AGENTS", "EMPLOYEES", "TA"], pinned: false, createdById: "usr-sa", createdAt: daysAgo(12) },
  { id: "ann-003", orgId: ORG_1, title: "MediCare Plus onboarding kickoff", body: "New healthcare client. TA team to complete agreement formalities by Friday. Requisitions will open next week.", audience: ["TA"], pinned: true, createdById: "usr-tam", createdAt: daysAgo(3) },
];

// ─── Audit logs ───────────────────────────────────────────────

export const auditLogs: AuditLog[] = [
  { id: "aud-001", orgId: ORG_1, actorUserId: "usr-sa", actorRole: "SUPER_ADMIN", action: "JOB_APPROVED", entity: "JobRequisition", entityId: "job-102", detail: "Approved Risk Analyst requisition raised by Vikram Singh", createdAt: daysAgo(22) },
  { id: "aud-002", orgId: ORG_1, actorUserId: "usr-ta1", actorRole: "TA_RECRUITER", action: "STAGE_MOVED", entity: "Application", entityId: "app-003", detail: "Karan Malhotra: TECH_ROUND → OFFER_SENT", createdAt: daysAgo(5) },
  { id: "aud-003", orgId: ORG_1, actorUserId: "usr-sa", actorRole: "SUPER_ADMIN", action: "USER_SUSPENDED", entity: "User", entityId: "usr-ag3", detail: "Rohan Kapoor suspended — repeated fake referrals", createdAt: daysAgo(9) },
  { id: "aud-004", orgId: ORG_1, actorUserId: "usr-tam", actorRole: "TA_MANAGER", action: "CLIENT_CREATED", entity: "Client", entityId: "cl-3", detail: "Onboarded MediCare Plus (healthcare vertical)", createdAt: daysAgo(20) },
  { id: "aud-005", orgId: ORG_1, actorUserId: "usr-ta2", actorRole: "TA_RECRUITER", action: "INTERVIEW_SCHEDULED", entity: "Interview", entityId: "itr-003", detail: "Client round scheduled for Anjali Deshmukh @ RetailMart", createdAt: daysAgo(4) },
  { id: "aud-006", orgId: ORG_1, actorUserId: "usr-sa", actorRole: "SUPER_ADMIN", action: "PAYOUT_PROCESSED", entity: "Payout", entityId: "pay-001", detail: "₹25,000 referral payout to Vikram Singh (NEFT-889123)", createdAt: daysAgo(8) },
];

// ─── Notifications ────────────────────────────────────────────

export const notifications: Notification[] = [
  { id: "ntf-1", orgId: ORG_1, userId: "usr-sa", title: "Job approval pending", message: "MediCare Plus raised 'Staff Nurse (ICU)' — needs your approval", link: "/admin/jobs", isRead: false, createdAt: daysAgo(0, 2) },
  { id: "ntf-2", orgId: ORG_1, userId: "usr-sa", title: "New referral submitted", message: "Vikram Singh referred Sameer Khan for Senior Backend Engineer", link: "/admin/referrals", isRead: false, createdAt: daysAgo(0, 5) },
  { id: "ntf-3", orgId: ORG_1, userId: "usr-sa", title: "Invoice overdue reminder", message: "INV-2026-041 (TechNova) payment due in 18 days", link: "/admin/finance", isRead: true, createdAt: daysAgo(3) },
  { id: "ntf-4", orgId: ORG_1, userId: "usr-ag1", title: "Referral shortlisted!", message: "Your referral Amit Verma moved to CLIENT_ROUND at TechNova", link: "/portal/referrals", isRead: false, createdAt: daysAgo(0, 1) },
  { id: "ntf-5", orgId: ORG_1, userId: "usr-ag1", title: "New task assigned", message: "Neha assigned you: Refer candidates for ICU Nurse", link: "/portal/tasks", isRead: false, createdAt: daysAgo(1) },
  { id: "ntf-6", orgId: ORG_1, userId: "usr-ta1", title: "Interview tomorrow", message: "Client round — Amit Verma @ 3:00 PM (video)", link: "/ta/interviews", isRead: false, createdAt: daysAgo(0, 3) },
];

// ─── Sequence generators ──────────────────────────────────────

let jobSeq = 200;
let clientSeq = 20;
let refSeq = 10;

export const nextIds = {
  job: () => `job-${++jobSeq}`,
  client: () => `cl-${++clientSeq}`,
  candidate: () => `cand-${String(candSeq++).padStart(3, "0")}`,
  application: () => `app-${String(appSeq++).padStart(3, "0")}`,
  interview: () => `itr-${String(itrSeq++).padStart(3, "0")}`,
  referral: () => `ref-${String(refSeq++).padStart(3, "0")}`,
  ledger: () => `led-${String(commissionLedger.length + 1).padStart(3, "0")}`,
  payout: () => `pay-${String(payouts.length + 1).padStart(3, "0")}`,
  attendance: () => `att-${++attSeq}`,
  task: () => `tsk-${String(tasks.length + 1).padStart(3, "0")}`,
};

export function addAudit(entry: Omit<AuditLog, "id" | "createdAt">) {
  auditLogs.unshift({ ...entry, id: `aud-${String(auditLogs.length + 1).padStart(3, "0")}`, createdAt: new Date().toISOString() });
}

export function addNotification(n: Omit<Notification, "id" | "createdAt" | "isRead">) {
  notifications.unshift({ ...n, id: `ntf-${notifications.length + 1}`, isRead: false, createdAt: new Date().toISOString() });
}
