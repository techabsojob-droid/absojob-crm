import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { assets, employees, addAudit, addNotification } from "@/lib/mock/data";
import type { AssetRecord } from "@/lib/types";

const CATEGORIES = ["LAPTOP", "DESKTOP", "MONITOR", "MOBILE", "ID_CARD", "ACCESSORY", "OTHER"];
const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "DAMAGED"];

// GET: list assets with category, status, employee and query filter
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const employeeId = url.searchParams.get("employeeId");
    const q = url.searchParams.get("q")?.toLowerCase();

    let list = assets.filter((a) => a.orgId === me.orgId);
    if (category && category !== "ALL") list = list.filter((a) => a.category === category);
    if (status && status !== "ALL") list = list.filter((a) => a.status === status);
    if (employeeId) list = list.filter((a) => a.assignedEmployeeId === employeeId);
    if (q) {
        list = list.filter(
            (a) =>
                a.name.toLowerCase().includes(q) ||
                a.assetTag.toLowerCase().includes(q) ||
                a.serialNumber.toLowerCase().includes(q) ||
                (a.assignedEmployeeName && a.assignedEmployeeName.toLowerCase().includes(q))
        );
    }
    return NextResponse.json(list);
}

// POST: register a new asset in inventory
export async function POST(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const serialNumber = String(body.serialNumber ?? "").trim();
    if (!name || !serialNumber || !CATEGORIES.includes(body.category)) {
        return NextResponse.json({ error: "name, category and serial number are required" }, { status: 400 });
    }
    if (assets.some((a) => a.orgId === me.orgId && a.serialNumber.toLowerCase() === serialNumber.toLowerCase())) {
        return NextResponse.json({ error: "An asset with this serial number already exists" }, { status: 409 });
    }
    const maxTag = assets.filter((a) => a.orgId === me.orgId).reduce((m, a) => Math.max(m, Number(a.assetTag.replace(/\D/g, "")) || 0), 0);
    const asset: AssetRecord = {
        id: `ast-${crypto.randomUUID().slice(0, 8)}`,
        orgId: me.orgId,
        assetTag: `AST-${String(maxTag + 1).padStart(3, "0")}`,
        name,
        category: body.category,
        serialNumber,
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        assignedDate: null,
        condition: CONDITIONS.includes(body.condition) ? body.condition : "EXCELLENT",
        status: "AVAILABLE",
        notes: body.notes || null,
        history: [{ action: "CREATED", byName: me.name, at: new Date().toISOString() }],
    };
    assets.unshift(asset);
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "ASSET_CREATED", entity: "Asset", entityId: asset.id, detail: `${asset.assetTag} ${asset.name} (${asset.serialNumber})` });
    return NextResponse.json(asset, { status: 201 });
}

// PATCH: assign / return / change status
export async function PATCH(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "HR_ADMIN");
    if ("error" in auth) return auth.error;
    const me = auth.user;

    const { id, action, employeeId, condition, notes, status } = await request.json();
    const asset = assets.find((a) => a.id === id && a.orgId === me.orgId);
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    if (!asset.history) asset.history = [];
    const now = new Date().toISOString();

    if (action === "assign") {
        if (asset.status !== "AVAILABLE") return NextResponse.json({ error: `Asset is ${asset.status.toLowerCase()}, not available` }, { status: 409 });
        const emp = employees.find((e) => e.id === employeeId && e.orgId === me.orgId && e.status !== "EXITED");
        if (!emp) return NextResponse.json({ error: "Employee not found or exited" }, { status: 400 });
        asset.assignedEmployeeId = emp.id;
        asset.assignedEmployeeName = emp.name;
        asset.assignedDate = now.split("T")[0];
        asset.status = "ASSIGNED";
        asset.history.unshift({ action: "ASSIGNED", employeeName: emp.name, note: notes || null, byName: me.name, at: now });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "ASSET_ASSIGNED", entity: "Asset", entityId: asset.id, detail: `${asset.assetTag} → ${emp.name} (${emp.employeeId})` });
        if (emp.userId) {
            addNotification({ orgId: me.orgId, userId: emp.userId, title: "Asset assigned to you", message: `${asset.name} (${asset.assetTag}, S/N ${asset.serialNumber})`, link: "/portal/profile?tab=assets" });
        }
        return NextResponse.json(asset);
    }

    if (action === "return") {
        if (asset.status !== "ASSIGNED") return NextResponse.json({ error: "Asset is not assigned" }, { status: 409 });
        const empName = asset.assignedEmployeeName;
        const emp = employees.find((e) => e.id === asset.assignedEmployeeId);
        if (condition && !CONDITIONS.includes(condition)) return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
        asset.condition = condition || asset.condition;
        asset.status = asset.condition === "DAMAGED" ? "MAINTENANCE" : "AVAILABLE";
        asset.assignedEmployeeId = null;
        asset.assignedEmployeeName = null;
        asset.assignedDate = null;
        asset.history.unshift({ action: "RETURNED", employeeName: empName, note: notes || `Condition: ${asset.condition}`, byName: me.name, at: now });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "ASSET_RETURNED", entity: "Asset", entityId: asset.id, detail: `${asset.assetTag} returned by ${empName} (${asset.condition})` });
        if (emp?.userId) {
            addNotification({ orgId: me.orgId, userId: emp.userId, title: "Asset return recorded", message: `${asset.name} (${asset.assetTag}) returned`, link: "/portal/profile?tab=assets" });
        }
        return NextResponse.json(asset);
    }

    if (action === "status") {
        if (!["AVAILABLE", "MAINTENANCE", "RETIRED"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        if (asset.status === "ASSIGNED") return NextResponse.json({ error: "Record the return before changing status" }, { status: 409 });
        const prev = asset.status;
        asset.status = status;
        if (notes) asset.notes = notes;
        asset.history.unshift({ action: "STATUS_CHANGED", note: `${prev} → ${status}${notes ? ` — ${notes}` : ""}`, byName: me.name, at: now });
        addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "ASSET_STATUS_CHANGED", entity: "Asset", entityId: asset.id, detail: `${asset.assetTag}: ${prev} → ${status}` });
        return NextResponse.json(asset);
    }

    return NextResponse.json({ error: "action must be assign, return or status" }, { status: 400 });
}
