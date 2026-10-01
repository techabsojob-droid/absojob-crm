// ─── Single identity: User (login) ↔ Employee (HR record) ─────
// Every internal staff login has an Employee record, and every Employee
// has a login. All creation / update paths go through these helpers so the
// two records never drift apart.

import type { Employee, EmployeeStatus, User, UserRole, UserStatus } from "@/lib/types";
import { employees, nextIds, users } from "./data";

export const ALL_ROLES: UserRole[] = ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "TA_MANAGER", "TA_RECRUITER", "AGENT", "EMPLOYEE"];

// Field agents are external partners: they log in but are not on HR payroll.
const ROLES_WITH_EMPLOYEE_RECORD: UserRole[] = ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "TA_MANAGER", "TA_RECRUITER", "EMPLOYEE"];

/** Which roles an actor may grant. HR cannot create or promote Super Admins / other HR admins. */
export function assignableRoles(actor: User): UserRole[] {
    if (actor.role === "SUPER_ADMIN") return ALL_ROLES;
    if (actor.role === "HR_ADMIN") return ["TA_MANAGER", "TA_RECRUITER", "AGENT", "EMPLOYEE"];
    return [];
}

/** Whether an actor may edit a given user's account at all. */
export function canManageUser(actor: User, target: User): boolean {
    if (actor.orgId !== target.orgId) return false;
    if (actor.role === "SUPER_ADMIN") return true;
    if (actor.role === "HR_ADMIN") return !["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"].includes(target.role) || target.id === actor.id;
    return false;
}

export function employeeForUser(userId: string | null | undefined): Employee | undefined {
    if (!userId) return undefined;
    return employees.find((e) => e.userId === userId);
}

export function userForEmployee(emp: Employee): User | undefined {
    return emp.userId ? users.find((u) => u.id === emp.userId) : users.find((u) => u.orgId === emp.orgId && u.email.toLowerCase() === emp.email.toLowerCase());
}

export function nextEmployeeCode(orgId: string): string {
    const max = employees
        .filter((e) => e.orgId === orgId)
        .reduce((m, e) => Math.max(m, Number(e.employeeId.replace(/\D/g, "")) || 0), 0);
    return `EMP-${String(max + 1).padStart(3, "0")}`;
}

export function uniqueEmployeeId(): string {
    let id = nextIds.employee();
    while (employees.some((e) => e.id === id)) id = `emp-${crypto.randomUUID().slice(0, 8)}`;
    return id;
}

export function uniqueUserId(): string {
    return `usr-${crypto.randomUUID().slice(0, 8)}`;
}

function toEmployeeStatus(s: UserStatus, current?: EmployeeStatus): EmployeeStatus {
    if (s === "EXITED") return "EXITED";
    if (current && current !== "EXITED") return current;
    return "ACTIVE";
}

/** Creates the HR record for a staff login if it doesn't exist yet. */
export function ensureEmployeeForUser(user: User): Employee | undefined {
    if (!ROLES_WITH_EMPLOYEE_RECORD.includes(user.role)) return undefined;
    const existing = employeeForUser(user.id)
        ?? employees.find((e) => e.orgId === user.orgId && e.email.toLowerCase() === user.email.toLowerCase());
    if (existing) {
        existing.userId = user.id;
        return existing;
    }
    const manager = employeeForUser(user.reportingTo);
    const emp: Employee = {
        id: uniqueEmployeeId(),
        orgId: user.orgId,
        employeeId: nextEmployeeCode(user.orgId),
        userId: user.id,
        candidateId: null,
        name: user.name,
        email: user.email,
        phone: user.phone,
        department: user.department || "General",
        designation: user.designation || "Team Member",
        reportingManagerId: manager?.id ?? null,
        reportingManagerName: manager?.name ?? null,
        joiningDate: (user.joinedAt || new Date().toISOString()).split("T")[0],
        employmentType: "FULL_TIME",
        status: toEmployeeStatus(user.status),
        location: user.location ?? null,
        bankDetails: { accountName: user.name, accountNumber: "", bankName: "", ifscCode: "", panNumber: "" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    employees.unshift(emp);
    return emp;
}

/** Creates the self-service login for an employee if it doesn't exist yet. */
export function ensureUserForEmployee(emp: Employee, role: UserRole = "EMPLOYEE"): User {
    const existing = userForEmployee(emp);
    if (existing) {
        emp.userId = existing.id;
        return existing;
    }
    const managerEmp = emp.reportingManagerId ? employees.find((e) => e.id === emp.reportingManagerId) : undefined;
    const user: User = {
        id: uniqueUserId(),
        orgId: emp.orgId,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        role,
        status: emp.status === "EXITED" ? "EXITED" : "ACTIVE",
        avatarUrl: null,
        department: emp.department,
        designation: emp.designation,
        location: emp.location ?? null,
        reportingTo: managerEmp?.userId ?? null,
        joinedAt: new Date(emp.joiningDate || Date.now()).toISOString(),
        deactivatedAt: null,
    };
    users.push(user);
    emp.userId = user.id;
    return user;
}

/** Push login-side changes (profile, status, manager) onto the HR record. */
export function syncUserToEmployee(user: User) {
    const emp = employeeForUser(user.id);
    if (!emp) return;
    emp.name = user.name;
    emp.phone = user.phone;
    if (user.department) emp.department = user.department;
    if (user.designation) emp.designation = user.designation;
    if (user.location !== undefined) emp.location = user.location ?? null;
    emp.status = toEmployeeStatus(user.status, emp.status);
    const manager = employeeForUser(user.reportingTo);
    emp.reportingManagerId = manager?.id ?? null;
    emp.reportingManagerName = manager?.name ?? null;
    emp.updatedAt = new Date().toISOString();
}

/** Push HR-side changes onto the login (profile, manager, exit → access revoked). */
export function syncEmployeeToUser(emp: Employee) {
    const user = userForEmployee(emp);
    if (!user) return;
    user.name = emp.name;
    user.phone = emp.phone;
    user.department = emp.department;
    user.designation = emp.designation;
    user.location = emp.location ?? null;
    const managerEmp = emp.reportingManagerId ? employees.find((e) => e.id === emp.reportingManagerId) : undefined;
    user.reportingTo = managerEmp?.userId ?? null;
    if (emp.status === "EXITED" && user.status !== "EXITED") {
        user.status = "EXITED";
        user.deactivatedAt = new Date().toISOString();
    }
}

/** HR admins and the employee's reporting manager (as user ids). */
export function approversFor(userId: string): { hrIds: string[]; managerUserId: string | null } {
    const user = users.find((u) => u.id === userId);
    if (!user) return { hrIds: [], managerUserId: null };
    const hrIds = users
        .filter((u) => u.orgId === user.orgId && u.status === "ACTIVE" && u.role === "HR_ADMIN")
        .map((u) => u.id);
    const emp = employeeForUser(userId);
    const managerUserId = user.reportingTo
        ?? (emp?.reportingManagerId ? employees.find((e) => e.id === emp.reportingManagerId)?.userId ?? null : null);
    return { hrIds, managerUserId: managerUserId && managerUserId !== userId ? managerUserId : null };
}

// Bootstrap: make sure every existing staff login already has its HR record.
users.forEach((u) => { ensureEmployeeForUser(u); });
