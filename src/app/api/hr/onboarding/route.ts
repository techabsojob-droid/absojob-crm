import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    onboardingRecords, candidates, jobs, employees, applications,
    addAudit, addNotification, nextIds, todayStr,
} from "@/lib/mock/data";
import type { OnboardingRecord, OnboardingStatus, Employee } from "@/lib/types";

// GET: list all onboarding records
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    let list = onboardingRecords.filter((o) => o.orgId === me.orgId);
    if (status) {
        list = list.filter((o) => o.status === status);
    }

    const enriched = list.map((record) => {
        const cand = candidates.find((c) => c.id === record.candidateId);
        const job = jobs.find((j) => j.id === record.jobId);
        return {
            ...record,
            candidateLocation: cand?.location || "—",
            candidateSkills: cand?.skills || [],
            source: cand?.source || "DIRECT",
            jobClient: job?.clientId || "—",
        };
    });

    return NextResponse.json(enriched);
}

// POST: start onboarding for a candidate (from TA pipeline or HR)
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { candidateId, jobId, applicationId, expectedJoiningDate } = body;

    const cand = candidates.find((c) => c.id === candidateId && c.orgId === me.orgId);
    if (!cand) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    const job = jobId ? jobs.find((j) => j.id === jobId && j.orgId === me.orgId) : undefined;
    const app = applicationId ? applications.find((a) => a.id === applicationId && a.orgId === me.orgId) : undefined;

    // Check if onboarding already exists
    const existing = onboardingRecords.find(
        (o) => o.orgId === me.orgId && o.candidateId === candidateId && o.status !== "REJECTED"
    );
    if (existing) {
        return NextResponse.json({ error: "Onboarding record already exists for this candidate", id: existing.id }, { status: 409 });
    }

    const newRecord: OnboardingRecord = {
        id: nextIds.onboarding(),
        orgId: me.orgId,
        candidateId: cand.id,
        applicationId: app?.id || null,
        jobId: job?.id || null,
        candidateName: cand.name,
        candidateEmail: cand.email,
        candidatePhone: cand.phone,
        position: job?.title || cand.currentDesignation || "Team Member",
        department: job?.department || "Operations",
        expectedJoiningDate: expectedJoiningDate || todayStr,
        status: "IN_PROGRESS",
        progressPercent: 20,
        checklist: [
            { id: "ck-1", title: "Personal Information", completed: true, completedAt: new Date().toISOString() },
            { id: "ck-2", title: "Identity Documents (PAN / Aadhaar)", completed: false, requiredDoc: "PAN, Aadhaar" },
            { id: "ck-3", title: "Address Verification Proof", completed: false, requiredDoc: "Utility bill or Passport" },
            { id: "ck-4", title: "Bank Account Details", completed: false, requiredDoc: "Cancelled cheque / Passbook" },
            { id: "ck-5", title: "Previous Employment & Relieving Docs", completed: false, requiredDoc: "Relieving letter, 3 mo payslips" },
            { id: "ck-6", title: "Offer Acceptance Sign-off", completed: true, completedAt: new Date().toISOString() },
            { id: "ck-7", title: "Joining Formalities & NDA Signing", completed: false },
            { id: "ck-8", title: "Asset Allocation (Laptop / Accessories)", completed: false },
            { id: "ck-9", title: "Employee Account & Email Provisioning", completed: false },
        ],
        assignedHrId: me.id,
        notes: `Initiated by ${me.name} from recruitment pipeline`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    onboardingRecords.unshift(newRecord);

    // Update application stage to ONBOARDING if linked
    if (app) {
        app.stage = "ONBOARDING";
        app.updatedAt = new Date().toISOString();
    }

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "ONBOARDING_STARTED",
        entity: "OnboardingRecord",
        entityId: newRecord.id,
        detail: `Started onboarding process for ${cand.name} (${newRecord.position})`,
    });

    addNotification({
        orgId: me.orgId,
        userId: me.id,
        title: "Onboarding initiated",
        message: `Onboarding initialized for ${cand.name}. Review checklist in HRMIS.`,
        link: "/hr/onboarding",
    });

    return NextResponse.json(newRecord, { status: 201 });
}

// PATCH: update checklist, progress, or complete conversion to Employee
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { id, checklistItemId, completed, createEmployee, joiningDate, department, designation, salaryMonthly } = body;

    const record = onboardingRecords.find((o) => o.id === id && o.orgId === me.orgId);
    if (!record) return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 });

    // Toggle checklist item
    if (checklistItemId !== undefined) {
        const item = record.checklist.find((c) => c.id === checklistItemId);
        if (item) {
            item.completed = !!completed;
            item.completedAt = completed ? new Date().toISOString() : null;
        }

        // recalculate progress
        const doneCount = record.checklist.filter((c) => c.completed).length;
        record.progressPercent = Math.round((doneCount / record.checklist.length) * 100);
        record.updatedAt = new Date().toISOString();
    }

    // Convert Candidate to Employee Profile
    if (createEmployee) {
        const cand = candidates.find((c) => c.id === record.candidateId);
        const empCode = `EMP-${String(employees.length + 1).padStart(3, "0")}`;
        const finalJoining = joiningDate || record.expectedJoiningDate || todayStr;
        const finalDept = department || record.department;
        const finalDesig = designation || record.position;
        const monthly = Number(salaryMonthly) || (cand?.expectedCtcLpa ? Math.round((cand.expectedCtcLpa * 100000) / 12) : 65000);

        const newEmp: Employee = {
            id: nextIds.employee(),
            orgId: me.orgId,
            employeeId: empCode,
            candidateId: record.candidateId,
            name: record.candidateName,
            email: record.candidateEmail,
            phone: record.candidatePhone,
            department: finalDept,
            designation: finalDesig,
            reportingManagerId: "emp-001",
            reportingManagerName: "Aarav Mehta",
            joiningDate: finalJoining,
            employmentType: "FULL_TIME",
            status: "ACTIVE",
            location: cand?.location || "Mumbai",
            personalDetails: {
                currentAddress: cand?.location ? `${cand.location}, India` : "Mumbai, India",
                permanentAddress: cand?.location ? `${cand.location}, India` : "Mumbai, India",
            },
            bankDetails: {
                accountName: record.candidateName,
                accountNumber: "XXXX" + Math.floor(1000 + Math.random() * 9000),
                bankName: "HDFC Bank",
                ifscCode: "HDFC0001928",
            },
            salary: {
                basic: Math.round(monthly * 0.5),
                hra: Math.round(monthly * 0.2),
                allowances: Math.round(monthly * 0.2),
                deductions: Math.round(monthly * 0.1),
                netMonthly: Math.round(monthly * 0.9),
                annualCtc: monthly * 12,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        employees.unshift(newEmp);

        record.status = "COMPLETED";
        record.progressPercent = 100;
        record.createdEmployeeId = newEmp.id;
        record.actualJoiningDate = finalJoining;
        record.checklist.forEach((c) => { c.completed = true; });
        record.updatedAt = new Date().toISOString();

        // Update application to JOINED if linked
        if (record.applicationId) {
            const app = applications.find((a) => a.id === record.applicationId);
            if (app) {
                app.stage = "JOINED";
                app.actualJoinDate = finalJoining;
                app.updatedAt = new Date().toISOString();
            }
        }

        addAudit({
            orgId: me.orgId,
            actorUserId: me.id,
            actorRole: me.role,
            action: "EMPLOYEE_CREATED",
            entity: "Employee",
            entityId: newEmp.id,
            detail: `Created Employee Profile ${newEmp.employeeId} (${newEmp.name}) from onboarding`,
        });

        addNotification({
            orgId: me.orgId,
            userId: me.id,
            title: "Employee profile created 🎉",
            message: `${newEmp.name} joined as ${newEmp.designation} (${newEmp.employeeId})`,
            link: `/hr/employees?id=${newEmp.id}`,
        });

        return NextResponse.json({ success: true, employee: newEmp, onboarding: record });
    }

    return NextResponse.json(record);
}
