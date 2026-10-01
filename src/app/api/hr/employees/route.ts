import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { employees, users, attendance, leaveRequests, payrollRecords, performanceReviews, assets, documents, addAudit, addNotification, todayStr } from "@/lib/mock/data";
import { canManageUser, ensureUserForEmployee, nextEmployeeCode, syncEmployeeToUser, uniqueEmployeeId, userForEmployee } from "@/lib/mock/identity";
import type { Employee } from "@/lib/types";

// GET: list employees or get single employee details by id
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const q = url.searchParams.get("q")?.toLowerCase();
    const department = url.searchParams.get("department");
    const status = url.searchParams.get("status");

    if (id) {
        const emp = employees.find((e) => e.id === id && e.orgId === me.orgId);
        if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        // Enriched 360 profile
        const empAttendance = attendance.filter((a) => a.userId === emp.userId || a.userId === emp.id).slice(-30);
        const empLeaves = leaveRequests.filter((l) => l.userId === emp.userId);
        const empPayroll = payrollRecords.filter((p) => p.employeeId === emp.id);
        const empPerformance = performanceReviews.filter((p) => p.employeeId === emp.id);
        const empAssets = assets.filter((a) => a.assignedEmployeeId === emp.id);
        const empDocs = documents.filter((d) => d.employeeId === emp.id);

        return NextResponse.json({
            ...emp,
            attendanceHistory: empAttendance,
            leaveHistory: empLeaves,
            payrollHistory: empPayroll,
            performanceReviews: empPerformance,
            assignedAssets: empAssets,
            documents: empDocs,
        });
    }

    let list = employees.filter((e) => e.orgId === me.orgId);

    if (q) {
        list = list.filter(
            (e) =>
                e.name.toLowerCase().includes(q) ||
                e.employeeId.toLowerCase().includes(q) ||
                e.email.toLowerCase().includes(q) ||
                e.designation.toLowerCase().includes(q)
        );
    }
    if (department && department !== "ALL") {
        list = list.filter((e) => e.department === department);
    }
    if (status && status !== "ALL") {
        list = list.filter((e) => e.status === status);
    }

    return NextResponse.json(list);
}

// POST: create new employee manually (also provisions their self-service login)
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { name, phone, department, designation, joiningDate, employmentType, location, salaryMonthly, reportingManagerId } = body;
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!name || !email || !department || !designation) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (employees.some((e) => e.orgId === me.orgId && e.email.toLowerCase() === email)) {
        return NextResponse.json({ error: "An employee with this email already exists" }, { status: 409 });
    }
    const manager = reportingManagerId ? employees.find((e) => e.id === reportingManagerId && e.orgId === me.orgId) : undefined;
    if (reportingManagerId && !manager) {
        return NextResponse.json({ error: "Reporting manager not found" }, { status: 400 });
    }

    const monthly = Number(salaryMonthly) || 0;

    const newEmp: Employee = {
        id: uniqueEmployeeId(),
        orgId: me.orgId,
        employeeId: nextEmployeeCode(me.orgId),
        name,
        email,
        phone: phone || "",
        department,
        designation,
        reportingManagerId: manager?.id ?? null,
        reportingManagerName: manager?.name ?? null,
        joiningDate: joiningDate || todayStr,
        employmentType: employmentType || "FULL_TIME",
        status: "ACTIVE",
        location: location || null,
        personalDetails: {
            currentAddress: body.currentAddress || undefined,
            permanentAddress: body.permanentAddress || undefined,
        },
        // Bank details only from HR input — never fabricated
        bankDetails: {
            accountName: body.bankDetails?.accountName || name,
            accountNumber: body.bankDetails?.accountNumber || "",
            bankName: body.bankDetails?.bankName || "",
            ifscCode: body.bankDetails?.ifscCode || "",
            panNumber: body.bankDetails?.panNumber || "",
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
    const login = ensureUserForEmployee(newEmp);

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "EMPLOYEE_CREATED",
        entity: "Employee",
        entityId: newEmp.id,
        detail: `Added new employee ${newEmp.name} (${newEmp.employeeId}) in ${newEmp.department}; login ${login.email}`,
    });

    if (manager?.userId) {
        addNotification({
            orgId: me.orgId, userId: manager.userId,
            title: "New direct report",
            message: `${newEmp.name} (${newEmp.designation}) now reports to you`,
            link: null,
        });
    }

    return NextResponse.json(newEmp, { status: 201 });
}

// Fields HR may edit on an employee record
const EDITABLE_FIELDS = [
    "name", "phone", "department", "designation", "reportingManagerId", "joiningDate", "employmentType",
    "status", "gender", "location", "personalDetails", "bankDetails", "emergencyContact", "salary",
    "probationEndDate", "probationStatus", "contractEndDate", "avatarUrl", "workMode",
] as const;

// PATCH: update employee profile
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { id } = body;

    const emp = employees.find((e) => e.id === id && e.orgId === me.orgId);
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const linkedUser = userForEmployee(emp);
    if (linkedUser && !canManageUser(me, linkedUser)) {
        return NextResponse.json({ error: "You are not allowed to modify this employee" }, { status: 403 });
    }
    if (body.status && !["ACTIVE", "ON_LEAVE", "NOTICE_PERIOD", "EXITED"].includes(body.status)) {
        return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }
    if (body.reportingManagerId) {
        if (body.reportingManagerId === emp.id) return NextResponse.json({ error: "An employee cannot report to themselves" }, { status: 400 });
        const mgr = employees.find((e) => e.id === body.reportingManagerId && e.orgId === me.orgId);
        if (!mgr) return NextResponse.json({ error: "Reporting manager not found" }, { status: 400 });
    }

    const changed: string[] = [];
    for (const k of EDITABLE_FIELDS) {
        if (body[k] === undefined) continue;
        if (JSON.stringify((emp as any)[k] ?? null) !== JSON.stringify(body[k] ?? null)) changed.push(k);
        (emp as any)[k] = body[k];
    }
    if (body.reportingManagerId !== undefined) {
        emp.reportingManagerName = employees.find((e) => e.id === emp.reportingManagerId)?.name ?? null;
    }
    emp.updatedAt = new Date().toISOString();
    syncEmployeeToUser(emp);

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: changed.includes("salary") ? "EMPLOYEE_SALARY_UPDATED" : "EMPLOYEE_UPDATED",
        entity: "Employee",
        entityId: emp.id,
        detail: `Updated ${emp.name} (${emp.employeeId}): ${changed.join(", ") || "no changes"}`,
    });

    return NextResponse.json(emp);
}
