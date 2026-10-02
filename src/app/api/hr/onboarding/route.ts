import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import {
    onboardingRecords, candidates, jobs, employees, applications, users, addNotification,
    addAudit, nextIds, todayStr,
} from "@/lib/mock/data";
import { markApplicationJoined, notifyRoles } from "@/lib/mock/pipeline";
import { ensureUserForEmployee, issueTempPassword, nextEmployeeCode, uniqueEmployeeId } from "@/lib/mock/identity";
import type { OnboardingRecord, Employee } from "@/lib/types";

// Checklist items completed as part of the "Create Employee" step itself;
// every other item must be done before conversion is allowed.
const CONVERSION_STEP_ITEMS = new Set(["ck-7", "ck-8", "ck-9"]);

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
            assignedHrName: users.find((u) => u.id === record.assignedHrId)?.name ?? null,
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
    if (applicationId && !app) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    if (app && app.candidateId !== cand.id) {
        return NextResponse.json({ error: "Application does not belong to this candidate" }, { status: 400 });
    }
    // Recruitment users can only hand over candidates who accepted the offer
    if (app && app.stage !== "OFFER_ACCEPTED") {
        return NextResponse.json(
            { error: `Onboarding can start only after the offer is accepted (current stage: ${app.stage.replace(/_/g, " ")})` },
            { status: 422 }
        );
    }
    if (!app && !["SUPER_ADMIN", "HR_ADMIN"].includes(me.role)) {
        return NextResponse.json({ error: "Start onboarding from the recruitment pipeline" }, { status: 400 });
    }

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
        progressPercent: app ? 22 : 11,
        checklist: [
            { id: "ck-1", title: "Personal Information", completed: true, completedAt: new Date().toISOString() },
            { id: "ck-2", title: "Identity Documents (PAN / Aadhaar)", completed: false, requiredDoc: "PAN, Aadhaar" },
            { id: "ck-3", title: "Address Verification Proof", completed: false, requiredDoc: "Utility bill or Passport" },
            { id: "ck-4", title: "Bank Account Details", completed: false, requiredDoc: "Cancelled cheque / Passbook" },
            { id: "ck-5", title: "Previous Employment & Relieving Docs", completed: false, requiredDoc: "Relieving letter, 3 mo payslips" },
            { id: "ck-6", title: "Offer Acceptance Sign-off", completed: !!app, completedAt: app ? new Date().toISOString() : null },
            { id: "ck-7", title: "Joining Formalities & NDA Signing", completed: false },
            { id: "ck-8", title: "Asset Allocation (Laptop / Accessories)", completed: false },
            { id: "ck-9", title: "Employee Account & Email Provisioning", completed: false },
        ],
        assignedHrId: me.role === "HR_ADMIN" ? me.id : null,
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

    notifyRoles(me.orgId, ["HR_ADMIN"], {
        title: "New onboarding handover",
        message: `${me.name} started onboarding for ${cand.name} (${newRecord.position}). Review checklist in HRMIS.`,
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
    const {
        id, checklistItemId, completed, createEmployee, joiningDate, department, designation, salaryMonthly,
        reportingManagerId, bankDetails, employmentType,
    } = body;

    const record = onboardingRecords.find((o) => o.id === id && o.orgId === me.orgId);
    if (!record) return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 });

    // Assign / reassign the HR owner (or reschedule joining) — allowed while onboarding is open
    if (body.assignedHrId !== undefined || body.expectedJoiningDate !== undefined) {
        if (record.status === "COMPLETED") {
            return NextResponse.json({ error: "Onboarding is already completed" }, { status: 409 });
        }
        if (body.assignedHrId !== undefined) {
            const owner = body.assignedHrId
                ? users.find((u) => u.id === body.assignedHrId && u.orgId === me.orgId && u.status === "ACTIVE" && ["HR_ADMIN", "SUPER_ADMIN"].includes(u.role))
                : null;
            if (body.assignedHrId && !owner) {
                return NextResponse.json({ error: "HR owner must be an active HR admin" }, { status: 400 });
            }
            record.assignedHrId = owner?.id ?? null;
            if (owner && owner.id !== me.id) {
                addNotification({
                    orgId: me.orgId, userId: owner.id,
                    title: "Onboarding assigned to you",
                    message: `${record.candidateName} (${record.position}) — joining ${record.expectedJoiningDate}`,
                    link: "/hr/onboarding",
                });
            }
        }
        if (body.expectedJoiningDate !== undefined) {
            if (Number.isNaN(new Date(body.expectedJoiningDate).getTime())) {
                return NextResponse.json({ error: "Invalid joining date" }, { status: 400 });
            }
            record.expectedJoiningDate = body.expectedJoiningDate;
            const app = record.applicationId ? applications.find((a) => a.id === record.applicationId) : undefined;
            if (app) app.expectedJoinDate = body.expectedJoiningDate;
        }
        record.updatedAt = new Date().toISOString();
        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: "ONBOARDING_UPDATED", entity: "OnboardingRecord", entityId: record.id,
            detail: `${record.candidateName}: owner ${users.find((u) => u.id === record.assignedHrId)?.name ?? "unassigned"}, joining ${record.expectedJoiningDate}`,
        });
        if (checklistItemId === undefined && !createEmployee) return NextResponse.json(record);
    }

    if (record.status === "COMPLETED" || record.createdEmployeeId) {
        return NextResponse.json(
            { error: "Onboarding is already completed and the employee profile exists", employeeId: record.createdEmployeeId },
            { status: 409 }
        );
    }
    if (record.status === "REJECTED") {
        return NextResponse.json({ error: "This onboarding record was rejected" }, { status: 422 });
    }

    // Toggle checklist item
    if (checklistItemId !== undefined) {
        const item = record.checklist.find((c) => c.id === checklistItemId);
        if (!item) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
        item.completed = !!completed;
        item.completedAt = completed ? new Date().toISOString() : null;
        if (record.status === "PENDING") record.status = "IN_PROGRESS";

        addAudit({
            orgId: me.orgId, actorUserId: me.id, actorRole: me.role,
            action: completed ? "ONBOARDING_ITEM_COMPLETED" : "ONBOARDING_ITEM_REOPENED",
            entity: "OnboardingRecord", entityId: record.id,
            detail: `${record.candidateName}: ${item.title}`,
        });

        // recalculate progress
        const doneCount = record.checklist.filter((c) => c.completed).length;
        record.progressPercent = Math.round((doneCount / record.checklist.length) * 100);
        record.updatedAt = new Date().toISOString();
    }

    // Convert Candidate to Employee Profile
    if (createEmployee) {
        const pending = record.checklist.filter((c) => !c.completed && !CONVERSION_STEP_ITEMS.has(c.id));
        if (pending.length > 0) {
            return NextResponse.json(
                { error: `Complete these checklist items first: ${pending.map((c) => c.title).join(", ")}`, pendingItems: pending.map((c) => c.id) },
                { status: 422 }
            );
        }
        const existingEmp = employees.find(
            (e) => e.orgId === me.orgId && (e.candidateId === record.candidateId || e.email.toLowerCase() === record.candidateEmail.toLowerCase())
        );
        if (existingEmp) {
            return NextResponse.json({ error: `An employee profile already exists (${existingEmp.employeeId})`, employeeId: existingEmp.id }, { status: 409 });
        }

        const cand = candidates.find((c) => c.id === record.candidateId);
        const finalJoining = joiningDate || record.expectedJoiningDate || todayStr;
        if (Number.isNaN(new Date(finalJoining).getTime())) {
            return NextResponse.json({ error: "Invalid joining date" }, { status: 400 });
        }
        const finalDept = department || record.department;
        const finalDesig = designation || record.position;
        const acceptedOffer = cand?.offers?.find((o) => o.jobId === record.jobId && o.status === "ACCEPTED");
        const offerCtcLpa = acceptedOffer?.offeredCtcLpa ?? cand?.expectedCtcLpa ?? 0;
        const monthly = Number(salaryMonthly) || Math.round((offerCtcLpa * 100000) / 12);
        const manager = reportingManagerId
            ? employees.find((e) => e.id === reportingManagerId && e.orgId === me.orgId)
            : undefined;
        if (reportingManagerId && !manager) {
            return NextResponse.json({ error: "Reporting manager not found" }, { status: 400 });
        }

        const newEmp: Employee = {
            id: uniqueEmployeeId(),
            orgId: me.orgId,
            employeeId: nextEmployeeCode(me.orgId),
            candidateId: record.candidateId,
            name: record.candidateName,
            email: record.candidateEmail,
            phone: record.candidatePhone,
            department: finalDept,
            designation: finalDesig,
            reportingManagerId: manager?.id ?? null,
            reportingManagerName: manager?.name ?? null,
            joiningDate: finalJoining,
            employmentType: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].includes(employmentType) ? employmentType : "FULL_TIME",
            status: "ACTIVE",
            location: cand?.location || null,
            personalDetails: {
                currentAddress: cand?.location || undefined,
                permanentAddress: cand?.permanentAddress || undefined,
            },
            // Bank details come only from HR input — never fabricated
            bankDetails: {
                accountName: bankDetails?.accountName || record.candidateName,
                accountNumber: bankDetails?.accountNumber || "",
                bankName: bankDetails?.bankName || "",
                ifscCode: bankDetails?.ifscCode || "",
                panNumber: bankDetails?.panNumber || "",
            },
            salary: monthly > 0 ? {
                basic: Math.round(monthly * 0.5),
                hra: Math.round(monthly * 0.2),
                allowances: Math.round(monthly * 0.3),
                deductions: 0,
                netMonthly: monthly,
                annualCtc: monthly * 12,
            } : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        employees.unshift(newEmp);
        // Provision the employee's self-service login (checklist: "Employee Account")
        const login = ensureUserForEmployee(newEmp);
        const tempPassword = login.passwordHash ? null : issueTempPassword(login);

        record.status = "COMPLETED";
        record.progressPercent = 100;
        record.createdEmployeeId = newEmp.id;
        record.actualJoiningDate = finalJoining;
        record.checklist.forEach((c) => { c.completed = true; });
        record.updatedAt = new Date().toISOString();

        // Close the recruitment loop: JOINED + job fill count + placement
        if (record.applicationId) {
            const app = applications.find((a) => a.id === record.applicationId && a.orgId === me.orgId);
            if (app) markApplicationJoined(app, me, finalJoining);
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

        notifyRoles(me.orgId, ["HR_ADMIN"], {
            title: "Employee profile created 🎉",
            message: `${newEmp.name} joined as ${newEmp.designation} (${newEmp.employeeId})`,
            link: `/hr/employees?id=${newEmp.id}`,
        });

        return NextResponse.json({ success: true, employee: newEmp, onboarding: record, login: { email: login.email, tempPassword } });
    }

    return NextResponse.json(record);
}
