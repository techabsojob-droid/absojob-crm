import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { storedFiles } from "@/lib/mock/data";
import { ALLOWED_MIME, fileUrl, MAX_FILE_BYTES } from "@/lib/mock/finance";
import { bad, body } from "@/lib/mock/fin/http";

// POST { name, mimeType, dataBase64, purpose } → stored file (max 5 MB; PDF, images, CSV, Word)
export async function POST(request: Request) {
    const auth = await requireRole();
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const b = await body(request);
    const data = String(b.dataBase64 ?? "").replace(/^data:[^;]+;base64,/, "");
    if (!b.name || !data) return bad("name and file data are required");
    if (!ALLOWED_MIME.includes(b.mimeType)) return bad("Unsupported file type (PDF, PNG, JPG, WEBP, CSV, DOC/DOCX)");
    const size = Math.floor((data.length * 3) / 4);
    if (size > MAX_FILE_BYTES) return bad("File is larger than 5 MB");
    const f = { id: `file-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, orgId: me.orgId, name: String(b.name).slice(0, 120), mimeType: b.mimeType, size, dataBase64: data, ownerUserId: me.id, purpose: String(b.purpose ?? "attachment"), createdAt: new Date().toISOString() };
    storedFiles.push(f);
    return NextResponse.json({ id: f.id, name: f.name, size, url: fileUrl(f.id) }, { status: 201 });
}
