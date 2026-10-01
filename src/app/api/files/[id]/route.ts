import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { storedFiles } from "@/lib/mock/data";
import type { UserRole } from "@/lib/types";
import { approversFor } from "@/lib/mock/identity";

// Who besides the uploader may read a file, by purpose
const READERS: Record<string, UserRole[]> = {
    resume: ["SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER", "HR_ADMIN"],
    kyc: ["SUPER_ADMIN", "TA_MANAGER", "FINANCE_ADMIN"],
    "employee-doc": ["SUPER_ADMIN", "HR_ADMIN"],
    request: ["SUPER_ADMIN", "HR_ADMIN"],
    leave: ["SUPER_ADMIN", "HR_ADMIN"],
    "tax-proof": ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"],
};
const DEFAULT_READERS: UserRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN", "HR_ADMIN"];

// Download a stored file — the uploader, plus roles allowed for the file's purpose
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const f = storedFiles.find((x) => x.id === id && x.orgId === me.orgId);
    if (!f) return NextResponse.json({ error: "File not found" }, { status: 404 });
    // A leave attachment (medical certificate) is also visible to the uploader's reporting manager
    const isManager = f.purpose === "leave" && approversFor(f.ownerUserId).managerUserId === me.id;
    if (f.ownerUserId !== me.id && !isManager && !(READERS[f.purpose] ?? DEFAULT_READERS).includes(me.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return new NextResponse(Buffer.from(f.dataBase64, "base64"), {
        headers: { "Content-Type": f.mimeType, "Content-Disposition": `inline; filename="${f.name.replace(/"/g, "")}"`, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
}
