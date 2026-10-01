"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Phone, MapPin, CalendarDays, ShieldCheck, Building2, UserCircle, Briefcase, Users, FileText, Laptop, Upload, Eye } from "lucide-react";
import { PageHeader, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { api } from "@/lib/api";
import Link from "next/link";
import { uploadFile, useAct } from "@/components/finance/kit";
import PayoutKyc from "@/components/portal/PayoutKyc";
import ChangePasswordModal from "@/components/shared/ChangePasswordModal";

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    HR_ADMIN: "HR Admin",
    TA_MANAGER: "Talent Acquisition Manager",
    TA_RECRUITER: "Recruiter",
    AGENT: "Channel Agent (Referral Partner)",
    EMPLOYEE: "Employee",
};
const SELF_UPLOAD_CATEGORIES = ["IDENTITY", "ADDRESS", "BANK_DOC", "EMPLOYMENT", "RESUME"];
const inputCls = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none";

interface MeResponse {
    user: { name: string; email: string; phone: string; role: string; department?: string | null; designation?: string | null; location?: string | null; joinedAt: string };
    employee: null | {
        employeeId: string; department: string; designation: string; joiningDate: string; employmentType: string; status: string;
        location?: string | null; workMode?: string; probationStatus?: string;
        bankDetails?: { bankName?: string; accountNumber?: string; ifscCode?: string };
        emergencyContact?: { name?: string; relationship?: string; phone?: string };
        personalDetails?: { dob?: string; maritalStatus?: string; bloodGroup?: string; currentAddress?: string; permanentAddress?: string };
        personalEmail?: string | null; phone?: string; probationEndDate?: string | null;
    };
    shift?: { name: string; startTime: string; endTime: string } | null;
    managerName: string | null;
    directReports: { id: string; name: string; designation: string }[];
    documents: { id: string; title: string; category: string; status: string; fileUrl: string; uploadedAt: string; rejectionReason?: string | null; expiryDate?: string | null }[];
    assets: { id: string; assetTag: string; name: string; category: string; serialNumber: string; assignedDate?: string | null; condition: string }[];
}

function ProfileContent() {
    const params = useSearchParams();
    const router = useRouter();
    const tab = (params.get("tab") ?? "overview") as "overview" | "personal" | "documents" | "assets" | "payouts" | "security";
    const [pwOpen, setPwOpen] = useState(false);
    const qc = useQueryClient();
    const [uploadOpen, setUploadOpen] = useState(false);
    const [form, setForm] = useState({ title: "", category: "IDENTITY", fileUrl: "", expiryDate: "" });
    const [uploading, setUploading] = useState(false);

    const { data, isLoading } = useQuery<MeResponse>({ queryKey: ["portal-me"], queryFn: () => api<MeResponse>("/api/portal/me") });

    const upload = useMutation({
        mutationFn: () => api("/api/hr/documents", "POST", { ...form, expiryDate: form.expiryDate || null }),
        onSuccess: () => {
            toast.success("Document uploaded — HR will verify it");
            setUploadOpen(false);
            setForm({ title: "", category: "IDENTITY", fileUrl: "", expiryDate: "" });
            qc.invalidateQueries({ queryKey: ["portal-me"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    if (isLoading || !data) return <SkeletonPulse className="h-64 w-full max-w-3xl" />;
    const { user, employee: emp } = data;

    const details = [
        { icon: Mail, label: "Email", value: user.email },
        { icon: Phone, label: "Phone", value: user.phone || "—" },
        { icon: ShieldCheck, label: "Role", value: ROLE_LABELS[user.role] ?? user.role },
        { icon: Building2, label: "Department", value: emp?.department ?? user.department ?? "—" },
        { icon: Briefcase, label: "Designation", value: emp?.designation ?? user.designation ?? "—" },
        { icon: UserCircle, label: "Reporting manager", value: data.managerName ?? "—" },
        { icon: MapPin, label: "Location", value: emp?.location ?? user.location ?? "—" },
        { icon: CalendarDays, label: "Joined", value: emp?.joiningDate ?? new Date(user.joinedAt).toLocaleDateString("en-IN") },
        ...(emp ? [
            { icon: Briefcase, label: "Employment type", value: emp.employmentType.replace(/_/g, " ").toLowerCase() },
            { icon: MapPin, label: "Work mode", value: (emp.workMode ?? "OFFICE").toLowerCase() },
            { icon: CalendarDays, label: "Shift", value: data.shift ? `${data.shift.name} (${data.shift.startTime}–${data.shift.endTime})` : "—" },
            { icon: ShieldCheck, label: "Probation", value: emp.probationStatus === "ON_PROBATION" ? `till ${emp.probationEndDate ?? "—"}` : (emp.probationStatus ?? "—").toLowerCase() },
        ] : []),
    ];

    return (
        <div className="space-y-6 max-w-4xl">
            <PageHeader title="My Profile" subtitle={user.role === "AGENT" ? "Your partner account, KYC and payout details" : "Your employment record, documents and company assets"} />

            <div className="bg-gradient-to-br from-primary to-[#0f2e1e] p-6 rounded-3xl text-white shadow-xl shadow-primary/20">
                <div className="flex items-center gap-5 flex-wrap">
                    <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center text-3xl font-black">
                        {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold">{user.name}</h2>
                        <p className="text-sm font-semibold text-white/70 mt-0.5">{emp?.designation ?? ROLE_LABELS[user.role]}{emp ? ` · ${emp.employeeId}` : ""}</p>
                        {emp && <span className="inline-block mt-2"><Badge value={emp.status} /></span>}
                    </div>
                </div>
            </div>

            <div className="flex gap-2 border-b border-neutral-200 pb-3">
                {([["overview", "Overview"], ...(user.role === "AGENT" ? [["payouts", "Payouts & KYC"]] as const : [["personal", "Personal"], ["documents", `Documents (${data.documents.length})`], ["assets", `Assets (${data.assets.length})`], ["payouts", "Referral payouts"]] as const), ["security", "Security"]] as const).map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => router.replace(`/portal/profile${id === "overview" ? "" : `?tab=${id}`}`)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${tab === id ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === "payouts" && <PayoutKyc />}

            {tab === "personal" && emp && <PersonalForm emp={emp} onSaved={() => qc.invalidateQueries({ queryKey: ["portal-me"] })} />}

            {tab === "security" && (
                <SectionCard title="Password" subtitle="Keep your account secure — use a password you don't use elsewhere">
                    <button onClick={() => setPwOpen(true)} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold">Change password</button>
                    <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
                </SectionCard>
            )}

            {tab === "overview" && (
                <>
                    <SectionCard title="Employment Details">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y divide-neutral-50">
                            {details.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="py-3 flex items-center justify-between gap-4">
                                    <dt className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider"><Icon size={14} /> {label}</dt>
                                    <dd className="text-sm font-bold text-neutral-900 text-right truncate">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </SectionCard>
                    {emp && (
                        <SectionCard title="Bank & Emergency Contact" subtitle="Emergency contact is editable under Personal; salary bank changes need HR verification" action={<Link href="/portal/requests?new=BANK_CHANGE" className="text-xs font-bold text-primary">Change bank</Link>}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-xs font-bold text-neutral-400 uppercase mb-1">Bank</p>
                                    <p className="font-semibold">{emp.bankDetails?.bankName || "Not provided"}</p>
                                    <p className="text-neutral-500">{emp.bankDetails?.accountNumber || "—"} · {emp.bankDetails?.ifscCode || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-neutral-400 uppercase mb-1">Emergency contact</p>
                                    <p className="font-semibold">{emp.emergencyContact?.name || "Not provided"}</p>
                                    <p className="text-neutral-500">{emp.emergencyContact?.relationship || ""} {emp.emergencyContact?.phone || ""}</p>
                                </div>
                            </div>
                        </SectionCard>
                    )}
                    {data.directReports.length > 0 && (
                        <SectionCard title={`My Team (${data.directReports.length})`}>
                            <ul className="divide-y divide-neutral-100">
                                {data.directReports.map((r) => (
                                    <li key={r.id} className="py-2.5 flex items-center gap-2 text-sm"><Users size={14} className="text-neutral-400" /> <strong>{r.name}</strong> <span className="text-neutral-500">· {r.designation}</span></li>
                                ))}
                            </ul>
                        </SectionCard>
                    )}
                    {!emp && (
                        <p className="text-xs text-neutral-500">You are registered as an external partner, so there is no HR employment record for your account.</p>
                    )}
                </>
            )}

            {tab === "documents" && (
                <SectionCard
                    title="My Documents"
                    action={emp ? <button onClick={() => setUploadOpen(true)} className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5"><Upload size={13} /> Upload</button> : undefined}
                >
                    {data.documents.length === 0 ? (
                        <EmptyState icon={FileText} message="No documents yet." />
                    ) : (
                        <ul className="divide-y divide-neutral-100">
                            {data.documents.map((d) => (
                                <li key={d.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                                    <div>
                                        <p className="font-semibold text-neutral-900">{d.title}</p>
                                        <p className="text-[11px] text-neutral-400">{d.category.replace(/_/g, " ")} · {d.uploadedAt.split("T")[0]}{d.expiryDate ? ` · expires ${d.expiryDate}` : ""}</p>
                                        {d.rejectionReason && <p className="text-[11px] text-rose-600">Rejected: {d.rejectionReason} — please upload again</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge value={d.status} />
                                        {d.fileUrl && d.fileUrl !== "#" && <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-neutral-500 hover:text-primary"><Eye size={15} /></a>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            {tab === "assets" && (
                <SectionCard title="Company Assets With Me" subtitle="Returned at exit as part of IT clearance">
                    {data.assets.length === 0 ? (
                        <EmptyState icon={Laptop} message="No company assets are assigned to you." />
                    ) : (
                        <ul className="divide-y divide-neutral-100">
                            {data.assets.map((a) => (
                                <li key={a.id} className="py-3 flex items-center justify-between text-sm">
                                    <div>
                                        <p className="font-semibold">{a.name} <span className="text-xs font-mono text-primary">{a.assetTag}</span></p>
                                        <p className="text-[11px] text-neutral-400">{a.category.replace("_", " ")} · S/N {a.serialNumber} · since {a.assignedDate ?? "—"}</p>
                                    </div>
                                    <span className="text-xs font-bold text-neutral-600">{a.condition}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            <ModalShell open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Document">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); upload.mutate(); }}>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                        {SELF_UPLOAD_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                    </select>
                    <input required placeholder="Title (e.g. PAN Card)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
                    <label className="block text-xs font-bold text-neutral-600">File (PDF / image, max 5 MB)
                        <input type="file" accept="application/pdf,image/*" disabled={uploading} className="block text-xs font-normal mt-1" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { const up = await uploadFile(f, "employee-doc"); setForm((x) => ({ ...x, fileUrl: up.url, title: x.title || f.name.replace(/\.[^.]+$/, "") })); } catch (err) { toast.error((err as Error).message); } finally { setUploading(false); } }} />
                        {form.fileUrl && <span className="text-emerald-700 text-[11px]">✓ attached</span>}
                    </label>
                    <label className="block text-xs font-bold text-neutral-600">Expiry date (passport, visa…)<input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputCls} /></label>
                    <button disabled={upload.isPending || uploading || !form.fileUrl} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Submit for verification</button>
                </form>
            </ModalShell>
        </div>
    );
}

type Emp = NonNullable<MeResponse["employee"]>;

function PersonalForm({ emp, onSaved }: { emp: Emp; onSaved: () => void }) {
    const pd = emp.personalDetails ?? {};
    const [f, setF] = useState({
        phone: emp.phone ?? "", personalEmail: emp.personalEmail ?? "",
        maritalStatus: pd.maritalStatus ?? "", bloodGroup: pd.bloodGroup ?? "", currentAddress: pd.currentAddress ?? "", permanentAddress: pd.permanentAddress ?? "",
        ecName: emp.emergencyContact?.name ?? "", ecRelationship: emp.emergencyContact?.relationship ?? "", ecPhone: emp.emergencyContact?.phone ?? "",
    });
    const save = useAct("/api/portal/me", "PATCH", ["portal-me", "portal-dashboard"], "Profile updated");
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
    return (
        <SectionCard title="Personal details" subtitle={`Date of birth ${pd.dob ?? "not recorded"} · legal name, DOB and bank are changed via HR requests`}>
            <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm" onSubmit={(e) => { e.preventDefault(); save.mutate({ phone: f.phone, personalEmail: f.personalEmail, personalDetails: { maritalStatus: f.maritalStatus, bloodGroup: f.bloodGroup, currentAddress: f.currentAddress, permanentAddress: f.permanentAddress }, emergencyContact: { name: f.ecName, relationship: f.ecRelationship, phone: f.ecPhone } }, { onSuccess: onSaved }); }}>
                <label className="text-xs font-bold text-neutral-600">Mobile<input required value={f.phone} onChange={set("phone")} className={inputCls} /></label>
                <label className="text-xs font-bold text-neutral-600">Personal email<input type="email" value={f.personalEmail} onChange={set("personalEmail")} className={inputCls} /></label>
                <label className="text-xs font-bold text-neutral-600">Marital status<select value={f.maritalStatus} onChange={set("maritalStatus")} className={inputCls}><option value="">—</option>{["Single", "Married", "Divorced", "Widowed"].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="text-xs font-bold text-neutral-600">Blood group<select value={f.bloodGroup} onChange={set("bloodGroup")} className={inputCls}><option value="">—</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="text-xs font-bold text-neutral-600 sm:col-span-2">Current address<textarea rows={2} value={f.currentAddress} onChange={set("currentAddress")} className={inputCls} /></label>
                <label className="text-xs font-bold text-neutral-600 sm:col-span-2">Permanent address<textarea rows={2} value={f.permanentAddress} onChange={set("permanentAddress")} className={inputCls} /></label>
                <p className="sm:col-span-2 text-xs font-bold text-neutral-800 pt-2">Emergency contact</p>
                <label className="text-xs font-bold text-neutral-600">Name<input required value={f.ecName} onChange={set("ecName")} className={inputCls} /></label>
                <label className="text-xs font-bold text-neutral-600">Relationship<input required value={f.ecRelationship} onChange={set("ecRelationship")} className={inputCls} /></label>
                <label className="text-xs font-bold text-neutral-600">Phone<input required value={f.ecPhone} onChange={set("ecPhone")} className={inputCls} /></label>
                <div className="sm:col-span-2"><button disabled={save.isPending} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save changes</button></div>
            </form>
        </SectionCard>
    );
}

export default function PortalProfilePage() {
    return (
        <Suspense fallback={<SkeletonPulse className="h-64 w-full max-w-3xl" />}>
            <ProfileContent />
        </Suspense>
    );
}
