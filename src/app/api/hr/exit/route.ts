import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { exitRecords, employees, assets, applications, jobs, tasks, documents, addAudit, addNotification } from "@/lib/mock/data";
import { approversFor, employeeForUser, syncEmployeeToUser } from "@/lib/mock/identity";
import { notifyRoles } from "@/lib/mock/pipeline";
import { queueFnf } from "@/lib/mock/finance";
import type { ExitRecord } from "@/lib/types";

const isHR = (role: string) => role === "SUPER_ADMIN" || role === "HR_ADMIN";
const CLEARANCE_DEPTS = ["Reporting Manager", "IT / Assets", "Finance", "HR"];
const OPEN = ["PENDING_APPROVAL", "NOTICE_PERIOD", "CLEARANCE", "SETTLED"];

// GET: HR sees all exits; staff see their own resignation
export async function GET(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase();
    const mine = url.searchParams.get("mine") === "1";

    let list = exitRecords.filter((e) => e.orgId === me.orgId);
    if (!isHR(me.role) || mine) {
        const emp = employeeForUser(me.id);
        list = emp ? list.filter((e) => e.employeeId === emp.id) : [];
    }
    if (status && status !== "ALL") list = list.filter((e) => e.status === status);
    if (q) list = list.filter((e) => e.employeeName.toLowerCase().includes(q) || e.department.toLowerCase().includes(q));

    // Show HR what still blocks clearance
    return NextResponse.json(list.map((e) => ({
        ...e,
        pendingAssets: assets.filter((a) => a.assignedEmployeeId === e.employeeId && a.status === "ASSIGNED").map((a) => `${a.assetTag} ${a.name}`),
    })));
}

// POST: an employee resigns (or HR records a resignation for an employee)
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const emp = isHR(me.role) && body.employeeId
        ? employees.find((e) => e.id === body.employeeId && e.orgId === me.orgId)
        : employeeForUser(me.id);
    if (!emp) return NextResponse.json({ error: "Employee profile not found" }, { status: 400 });
    if (emp.status === "EXITED") return NextResponse.json({ error: "Employee has already exited" }, { status: 409 });
    if (exitRecords.some((x) => x.employeeId === emp.id && OPEN.includes(x.status))) {
        return NextResponse.json({ error: "A resignation is already in progress" }, { status: 409 });
    }
    const reason = String(body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "Please provide a reason" }, { status: 400 });

    const resignationDate = body.resignationDate || new Date().toISOString().split("T")[0];
    const noticePeriodDays = Math.max(0, Number(body.noticePeriodDays ?? 30) || 0);
    const lastWorkingDay = new Date(new Date(resignationDate).getTime() + noticePeriodDays * 86400000).toISOString().split("T")[0];

    const rec: ExitRecord = {
        id: `ext-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        resignationDate,
        noticePeriodDays,
        lastWorkingDay,
        reason,
        status: "PENDING_APPROVAL",
        exitInterviewNotes: null,
        clearanceChecklist: CLEARANCE_DEPTS.map((department) => ({ department, cleared: false, clearedBy: null, clearedAt: null, notes: null })),
        fnfSettled: false,
        fnfAmountInr: null,
        experienceLetterIssued: false,
    };
    exitRecords.unshift(rec);

    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "RESIGNATION_SUBMITTED", entity: "ExitRecord", entityId: rec.id, detail: `${emp.name}: LWD ${lastWorkingDay} — ${reason}` });
    notifyRoles(me.orgId, ["HR_ADMIN"], { title: "Resignation submitted", message: `${emp.name} (${emp.designation}) — last working day ${lastWorkingDay}`, link: "/hr/exit" });
    const { managerUserId } = emp.userId ? approversFor(emp.userId) : { managerUserId: null };
    if (managerUserId && managerUserId !== me.id) {
        addNotification({ orgId: me.orgId, userId: managerUserId, title: "Team member resigned", message: `${emp.name} — last working day ${lastWorkingDay}`, link: null });
    }
    return NextResponse.json(rec, { status: 201 });
}

// PATCH: HR drives the exit workflow
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const { id, action } = body;
    const rec = exitRecords.find((x) => x.id === id && x.orgId === me.orgId);
    if (!rec) return NextResponse.json({ error: "Exit record not found" }, { status: 404 });
    const emp = employees.find((e) => e.id === rec.employeeId);
    const now = new Date().toISOString();
    const notifyEmp = (title: string, message: string) => {
        if (emp?.userId) addNotification({ orgId: me.orgId, userId: emp.userId, title, message, link: "/portal/requests" });
    };
    const fail = (error: string, status = 409) => NextResponse.json({ error }, { status });
    let detail = "";

    switch (action) {
        case "approve": {
            if (rec.status !== "PENDING_APPROVAL") return fail("Resignation is not awaiting approval");
            rec.status = "NOTICE_PERIOD";
            if (body.lastWorkingDay) rec.lastWorkingDay = body.lastWorkingDay;
            if (emp) { emp.status = "NOTICE_PERIOD"; emp.updatedAt = now; }
            detail = `approved; LWD ${rec.lastWorkingDay}`;
            notifyEmp("Resignation accepted", `Your last working day is ${rec.lastWorkingDay}`);
            break;
        }
        case "withdraw": {
            if (!["PENDING_APPROVAL", "NOTICE_PERIOD"].includes(rec.status)) return fail("Cannot withdraw at this stage");
            rec.status = "WITHDRAWN";
            if (emp && emp.status === "NOTICE_PERIOD") { emp.status = "ACTIVE"; emp.updatedAt = now; }
            detail = `withdrawn${body.note ? ` — ${body.note}` : ""}`;
            notifyEmp("Resignation withdrawn", body.note || "Your resignation has been withdrawn");
            break;
        }
        case "start_clearance": {
            if (rec.status !== "NOTICE_PERIOD") return fail("Clearance starts after the resignation is approved");
            rec.status = "CLEARANCE";
            detail = "clearance started";
            break;
        }
        case "clear": {
            if (!["NOTICE_PERIOD", "CLEARANCE"].includes(rec.status)) return fail("Clearance is not open");
            const item = rec.clearanceChecklist.find((c) => c.department === body.department);
            if (!item) return fail("Unknown clearance department", 400);
            if (/asset|it/i.test(item.department)) {
                const pending = assets.filter((a) => a.assignedEmployeeId === rec.employeeId && a.status === "ASSIGNED");
                if (pending.length) return fail(`Return assets first: ${pending.map((a) => a.assetTag).join(", ")}`, 422);
            }
            item.cleared = true;
            item.clearedBy = me.name;
            item.clearedAt = now.split("T")[0];
            item.notes = body.note || null;
            if (rec.status === "NOTICE_PERIOD") rec.status = "CLEARANCE";
            detail = `${item.department} cleared`;
            break;
        }
        case "exit_interview": {
            if (!String(body.notes ?? "").trim()) return fail("Interview notes are required", 400);
            rec.exitInterviewNotes = String(body.notes).trim();
            detail = "exit interview recorded";
            break;
        }
        case "settle": {
            if (rec.clearanceChecklist.some((c) => !c.cleared)) return fail("All departments must clear before F&F settlement", 422);
            const amount = Number(body.fnfAmountInr);
            if (!Number.isFinite(amount) || amount < 0) return fail("Valid F&F amount is required", 400);
            rec.fnfSettled = true;
            rec.fnfAmountInr = amount;
            rec.fnfPaid = amount === 0;
            rec.status = "SETTLED";
            // Finance releases the money; HR only finalises the amount
            if (amount > 0) queueFnf(me, rec.id, amount);
            detail = `F&F finalised ₹${amount}${amount > 0 ? " — sent to Finance for payment" : ""}`;
            notifyEmp("Full & final finalised", `₹${amount.toLocaleString("en-IN")} — Finance will release the payment`);
            break;
        }
        case "issue_letter": {
            if (!rec.fnfSettled) return fail("Settle F&F before issuing the experience letter", 422);
            rec.experienceLetterIssued = true;
            documents.unshift({
                id: `doc-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, employeeId: rec.employeeId, employeeName: rec.employeeName,
                title: `Experience Letter — ${rec.employeeName}`, category: "EXPERIENCE_LETTER", fileUrl: body.fileUrl || "#",
                status: "VERIFIED", expiryDate: null, uploadedAt: now, uploadedByName: me.name, version: 1,
            });
            detail = "experience letter issued";
            notifyEmp("Experience letter issued", "Your experience letter is available in My Documents");
            break;
        }
        case "complete": {
            if (rec.status !== "SETTLED") return fail("Settle F&F before completing the exit", 422);
            if (!rec.fnfPaid) return fail("Finance has not released the F&F payment yet", 422);
            if (!rec.experienceLetterIssued) return fail("Issue the experience letter before completing the exit", 422);
            rec.status = "COMPLETED";
            if (emp) {
                emp.status = "EXITED";
                emp.updatedAt = now;
                syncEmployeeToUser(emp); // revokes login
            }
            // Hand over anything the leaver still owns
            const uid = emp?.userId;
            const openApps = uid ? applications.filter((a) => a.recruiterId === uid && !["JOINED", "REJECTED", "BACKED_OUT", "BLACKLISTED"].includes(a.stage)).length : 0;
            const openJobs = uid ? jobs.filter((j) => (j.primaryRecruiterId === uid || (j.assignedTas || []).includes(uid)) && !["CLOSED", "CANCELLED", "FULFILLED"].includes(j.status)).length : 0;
            const openTasks = uid ? tasks.filter((t) => t.assignedToId === uid && !t.completed).length : 0;
            if (openApps || openJobs || openTasks) {
                notifyRoles(me.orgId, ["TA_MANAGER", "SUPER_ADMIN"], {
                    title: "Reassign work of exited employee",
                    message: `${rec.employeeName} left with ${openJobs} job(s), ${openApps} candidate(s), ${openTasks} task(s) still assigned`,
                    link: "/admin/team",
                });
            }
            detail = "exit completed; access revoked";
            break;
        }
        default:
            return fail("Unknown action", 400);
    }

    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: `EXIT_${String(action).toUpperCase()}`, entity: "ExitRecord", entityId: rec.id, detail: `${rec.employeeName}: ${detail}` });
    return NextResponse.json(rec);
}
