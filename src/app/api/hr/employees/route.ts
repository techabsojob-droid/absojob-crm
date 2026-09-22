import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { employees, users, attendance, leaveRequests, payrollRecords, performanceReviews, assets, documents, addAudit, nextIds, todayStr } from "@/lib/mock/data";
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

// POST: create new employee manually
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { name, email, phone, department, designation, joiningDate, employmentType, location, salaryMonthly, reportingManagerId } = body;

    if (!name || !email || !department || !designation) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const monthly = Number(salaryMonthly) || 50000;
    const empCode = `EMP-${String(employees.length + 1).padStart(3, "0")}`;

    const newEmp: Employee = {
        id: nextIds.employee(),
        orgId: me.orgId,
        employeeId: empCode,
        name,
        email,
        phone: phone || "+91 99000 00000",
        department,
        designation,
        reportingManagerId: reportingManagerId || "emp-001",
        reportingManagerName: employees.find((e) => e.id === reportingManagerId)?.name || "Aarav Mehta",
        joiningDate: joiningDate || todayStr,
        employmentType: employmentType || "FULL_TIME",
        status: "ACTIVE",
        location: location || "Mumbai",
        personalDetails: {
            currentAddress: location ? `${location}, India` : "Mumbai, India",
            permanentAddress: location ? `${location}, India` : "Mumbai, India",
        },
        bankDetails: {
            accountName: name,
            accountNumber: "XXXX" + Math.floor(1000 + Math.random() * 9000),
            bankName: "HDFC Bank",
            ifscCode: "HDFC0001000",
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

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "EMPLOYEE_CREATED",
        entity: "Employee",
        entityId: newEmp.id,
        detail: `Added new employee ${newEmp.name} (${newEmp.employeeId}) in ${newEmp.department}`,
    });

    return NextResponse.json(newEmp, { status: 201 });
}

// PATCH: update employee profile
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { id, ...updates } = body;

    const emp = employees.find((e) => e.id === id && e.orgId === me.orgId);
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    Object.assign(emp, updates, { updatedAt: new Date().toISOString() });

    addAudit({
        orgId: me.orgId,
        actorUserId: me.id,
        actorRole: me.role,
        action: "EMPLOYEE_UPDATED",
        entity: "Employee",
        entityId: emp.id,
        detail: `Updated employee profile for ${emp.name} (${emp.employeeId})`,
    });

    return NextResponse.json(emp);
}
