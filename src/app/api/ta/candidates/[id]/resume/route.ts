import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { candidates, storedFiles, addAudit } from "@/lib/mock/data";
import { bad, body } from "@/lib/mock/fin/http";
import { fileUrl, MAX_FILE_BYTES } from "@/lib/mock/finance";

const RESUME_MIME = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

// POST { name, mimeType, dataBase64 } — upload a new resume version to the candidate record
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const { id } = await params;
    const cand = candidates.find((c) => c.id === id && c.orgId === me.orgId);
    if (!cand) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    const b = await body(request);
    const data = String(b.dataBase64 ?? "").replace(/^data:[^;]+;base64,/, "");
    if (!b.name || !data) return bad("Choose a resume file");
    if (!RESUME_MIME.includes(b.mimeType)) return bad("Resume must be PDF or Word");
    const size = Math.floor((data.length * 3) / 4);
    if (size > MAX_FILE_BYTES) return bad("Resume is larger than 5 MB");
    const f = { id: `file-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, orgId: me.orgId, name: String(b.name).slice(0, 120), mimeType: b.mimeType, size, dataBase64: data, ownerUserId: me.id, purpose: "resume", createdAt: new Date().toISOString() };
    storedFiles.push(f);
    const version = Math.max(0, ...(cand.documents ?? []).filter((d) => d.type === "RESUME").map((d) => d.version)) + 1;
    cand.documents = [{ id: `cdoc-${crypto.randomUUID().slice(0, 8)}`, name: f.name, type: "RESUME", fileUrl: fileUrl(f.id), fileSizeKb: Math.ceil(size / 1024), version, uploadedBy: me.name, uploadDate: f.createdAt, verified: false }, ...(cand.documents ?? [])];
    cand.resumeUrl = fileUrl(f.id);
    cand.updatedAt = f.createdAt;
    addAudit({ orgId: me.orgId, actorUserId: me.id, actorRole: me.role, action: "RESUME_UPLOADED", entity: "Candidate", entityId: cand.id, detail: `${cand.name} resume v${version}` });
    return NextResponse.json({ url: fileUrl(f.id), version }, { status: 201 });
}
