"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, Search, UserCheck, Clock, AlertTriangle, ShieldCheck, ChevronRight, FileText, CheckCircle2, Building2, Briefcase, IndianRupee, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import type { PlacementRecord } from "@/lib/types";
import InvoiceDetailsDialog, { type InvoiceDetailsInput } from "@/components/shared/InvoiceDetailsDialog";
import { EMPLOYEE_TYPES, invoiceTat } from "@/lib/invoicing-details";

type Row = PlacementRecord & { missingInvoiceDetails?: string[] };
const detailsOf = (p: PlacementRecord): InvoiceDetailsInput => ({
    placementId: p.id, candidateName: p.candidateName, employeeCode: p.employeeCode, workLocation: p.workLocation, joiningDate: p.joiningDate,
    offeredPosition: p.offeredPosition, grade: p.grade, offeredSalaryLpa: p.offeredSalaryLpa, employeeType: p.employeeType,
    invoiceNumber: p.invoiceNumber, feeInr: p.revenueInr,
});

export default function PlacementsPage() {
    const qc = useQueryClient();
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedPlacement, setSelectedPlacement] = useState<Row | null>(null);
    const [details, setDetails] = useState<InvoiceDetailsInput | null>(null);
    const [exporting, setExporting] = useState<string | null>(null);

    // "Candidate information for invoicing" sheet, same filters as the table
    const exportSheet = async (format: "xlsx" | "csv" | "pdf") => {
        setExporting(format);
        try {
            const res = await fetch(`/api/admin/placements/export?format=${format}&status=${statusFilter}&q=${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Export failed");
            const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `candidate-invoicing-details.${format}`;
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement("a");
            a.href = url; a.download = name; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setExporting(null);
        }
    };

    const [form, setForm] = useState({
        candidateId: "",
        jobId: "",
        offeredPosition: "",
        offeredSalaryLpa: "",
        joiningDate: "",
        revenueInr: "",
        notes: "",
        employeeCode: "",
        workLocation: "",
        grade: "",
        employeeType: "",
    });

    const { data: placements = [], isLoading } = useQuery<Row[]>({
        queryKey: ["admin-placements", q, statusFilter],
        queryFn: async () => {
            const res = await fetch(`/api/admin/placements?q=${encodeURIComponent(q)}&status=${statusFilter}`);
            if (!res.ok) throw new Error("Failed to load placements");
            return res.json();
        },
    });

    // Pickers for the create form: real openings, then candidates in that opening's pipeline
    const { data: jobOptions = [] } = useQuery<{ id: string; title: string; clientName: string; reqNumber?: string }[]>({
        queryKey: ["placement-job-options"],
        enabled: createOpen,
        queryFn: async () => { const r = await fetch("/api/admin/jobs"); return r.ok ? r.json() : []; },
    });
    const { data: jobDetail } = useQuery<{ candidates?: { candidateId: string; candidateName: string; stage: string }[] }>({
        queryKey: ["placement-job-candidates", form.jobId],
        enabled: createOpen && !!form.jobId,
        queryFn: async () => { const r = await fetch(`/api/admin/jobs/${form.jobId}`); return r.ok ? r.json() : {}; },
    });
    const candidateOptions = jobDetail?.candidates ?? [];

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/placements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || "Failed to create placement");
            return d;
        },
        onSuccess: () => {
            toast.success("Placement recorded successfully.");
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-placements"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const patchMutation = useMutation({
        mutationFn: async ({ id, joiningStatus, replacementStatus }: { id: string; joiningStatus?: string; replacementStatus?: string }) => {
            const res = await fetch("/api/admin/placements", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, joiningStatus, replacementStatus }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: () => {
            toast.success("Placement updated");
            qc.invalidateQueries({ queryKey: ["admin-placements"] });
            setSelectedPlacement(null);
        },
        onError: () => toast.error("Failed to update"),
    });

    const joinedCount = placements.filter((p) => p.joiningStatus === "JOINED").length;
    const pendingCount = placements.filter((p) => p.joiningStatus === "JOINING_PENDING").length;
    const totalRev = placements.reduce((acc, p) => acc + (p.revenueInr || 0), 0);
    const replacementCount = placements.filter((p) => p.replacementStatus === "REPLACEMENT_IN_PROGRESS").length;
    const needDetails = placements.filter((p) => p.joiningStatus === "JOINED" && !p.invoiceNumber && (p.missingInvoiceDetails?.length ?? 0) > 0).length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Placements & Executive Joining"
                subtitle="End-to-end post-offer candidate lifecycle, guarantee tracking, billing & replacement management"
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center rounded-md border border-neutral-200 bg-white overflow-hidden text-xs" role="group" aria-label="Export candidate invoicing details">
                            <span className="px-2.5 py-2 text-neutral-500 flex items-center gap-1.5 border-r border-neutral-200"><Download size={13} /> Invoicing sheet</span>
                            {(["xlsx", "csv", "pdf"] as const).map((f) => (
                                <button key={f} type="button" disabled={!!exporting} onClick={() => exportSheet(f)}
                                    className="px-2.5 py-2 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 border-r last:border-r-0 border-neutral-200">
                                    {exporting === f ? "…" : f === "xlsx" ? "Excel" : f.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setCreateOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-medium rounded-md shadow-xs hover:bg-primary/95 transition-all"
                        >
                            <Plus size={16} /> Record Placement
                        </button>
                    </div>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Placed" value={joinedCount} icon={UserCheck} tone="emerald" hint="active joined employees" />
                <StatCard label="Joining Pending" value={pendingCount} icon={Clock} tone="amber" hint="serving notice period" />
                <StatCard label="Placement Revenue" value={inr(totalRev)} icon={IndianRupee} tone="primary" hint="total verified commission" />
                <StatCard label="Replacement Cases" value={replacementCount} icon={AlertTriangle} tone={replacementCount > 0 ? "red" : "blue"} hint="within 90-day guarantee" />
            </div>

            {needDetails > 0 && (
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    {needDetails} joined placement{needDetails > 1 ? "s are" : " is"} missing invoicing details (employee code, grade, FLS/NFLS…). Finance can&apos;t invoice them until these are added.
                </div>
            )}

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-100 shadow-sm">
                <div className="relative w-full sm:w-72">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search candidate, client, job..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                    {["ALL", "JOINING_PENDING", "JOINED", "CANCELLED"].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                statusFilter === s
                                    ? "bg-primary text-white shadow-sm"
                                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                            }`}
                        >
                            {s.replace("_", " ")}
                        </button>
                    ))}
                </div>
            </div>

            {/* Placements Table */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-16 rounded-2xl" />
                    ))}
                </div>
            ) : placements.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={Award} message="No placements found matching current filters." />
                </SectionCard>
            ) : (
                <SectionCard>
                    <div className="overflow-x-auto -m-5">
                        <table className="w-full text-xs min-w-[980px]">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                                    <th className="px-5 py-3.5">Candidate / Role</th>
                                    <th className="px-3 py-3.5">Client & Job</th>
                                    <th className="px-3 py-3.5">Joining Date</th>
                                    <th className="px-3 py-3.5">Package (CTC)</th>
                                    <th className="px-3 py-3.5">Agency Fee</th>
                                    <th className="px-3 py-3.5">Joining Status</th>
                                    <th className="px-3 py-3.5">Guarantee & Replacement</th>
                                    <th className="px-3 py-3.5">Invoicing details</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {placements.map((p) => (
                                    <tr key={p.id} className="hover:bg-neutral-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <p className="font-bold text-neutral-900 text-xs">{p.candidateName}</p>
                                            <p className="text-[11px] text-neutral-500 font-medium">{p.offeredPosition}</p>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <p className="font-semibold text-neutral-900">{p.clientName}</p>
                                            <p className="text-[10px] text-neutral-400">{p.jobTitle}</p>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="font-medium text-neutral-700">
                                                {new Date(p.joiningDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="font-bold text-neutral-900">₹{p.offeredSalaryLpa} LPA</span>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <span className="font-bold text-emerald-600">{inr(p.revenueInr)}</span>
                                            {p.invoiceNumber && (
                                                <p className="text-[10px] text-neutral-400 font-medium">{p.invoiceNumber}</p>
                                            )}
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <Badge
                                                value={p.joiningStatus}
                                                label={p.joiningStatus.replace("_", " ")}
                                            />
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <div className="space-y-0.5">
                                                <span className="text-[10px] font-bold text-neutral-600">
                                                    {p.guaranteePeriodDays} Days Guarantee
                                                </span>
                                                {p.replacementStatus !== "NO_REPLACEMENT" ? (
                                                    <span className="block text-[10px] font-bold text-amber-600">
                                                        ⚠️ {p.replacementStatus.replace("_", " ")}
                                                    </span>
                                                ) : (
                                                    <span className="block text-[10px] text-emerald-600 font-semibold">
                                                        Active Guarantee
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            {(p.missingInvoiceDetails?.length ?? 0) === 0 ? (
                                                <button onClick={() => setDetails(detailsOf(p))} className="text-left">
                                                    <span className="block text-[11px] font-semibold text-emerald-700">Complete</span>
                                                    <span className="block text-[10px] text-neutral-500">{[p.employeeCode, p.grade, p.employeeType].filter(Boolean).join(" · ")}</span>
                                                </button>
                                            ) : (
                                                <button onClick={() => setDetails(detailsOf(p))} title={`Missing: ${p.missingInvoiceDetails!.join(", ")}`}
                                                    className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">
                                                    Add {p.missingInvoiceDetails!.length} missing
                                                </button>
                                            )}
                                            {p.joiningStatus === "JOINED" && (() => { const t = invoiceTat(p.joiningDate, null); return !p.invoiceNumber && t.days != null ? <span className="block mt-0.5 text-[10px] text-neutral-500">Not invoiced · {t.days}d since joining</span> : null; })()}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {p.joiningStatus === "JOINING_PENDING" && (
                                                    <button
                                                        onClick={() => patchMutation.mutate({ id: p.id, joiningStatus: "JOINED" })}
                                                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 border border-emerald-200"
                                                    >
                                                        Confirm Joined
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedPlacement(p)}
                                                    className="px-2.5 py-1 text-[11px] font-bold text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200"
                                                >
                                                    Manage
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Manage Modal */}
            {selectedPlacement && (
                <ModalShell
                    title={`Manage Placement: ${selectedPlacement.candidateName}`}
                    onClose={() => setSelectedPlacement(null)}
                >
                    <div className="space-y-4">
                        <div className="p-3 bg-neutral-50 rounded-xl space-y-1.5 text-xs text-neutral-600">
                            <p><strong>Candidate:</strong> {selectedPlacement.candidateName}</p>
                            <p><strong>Client:</strong> {selectedPlacement.clientName} · {selectedPlacement.jobTitle}</p>
                            <p><strong>Offered CTC:</strong> ₹{selectedPlacement.offeredSalaryLpa} LPA</p>
                            <p><strong>Agency Commission:</strong> {inr(selectedPlacement.revenueInr)}</p>
                            <p><strong>Joining Date:</strong> {selectedPlacement.joiningDate}</p>
                            <p><strong>Recruiter Owner:</strong> {selectedPlacement.recruiterName}</p>
                        </div>

                        <div className="p-3 rounded-xl border border-neutral-200 text-xs space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-neutral-700">Invoicing details</span>
                                <button type="button" onClick={() => { const d = detailsOf(selectedPlacement); setSelectedPlacement(null); setDetails(d); }} className="px-2.5 py-1 rounded-lg bg-primary text-white font-medium">
                                    {(selectedPlacement.missingInvoiceDetails?.length ?? 0) ? "Add details" : "Edit"}
                                </button>
                            </div>
                            <p className="text-neutral-600">
                                Emp. code <b>{selectedPlacement.employeeCode || "—"}</b> · Location <b>{selectedPlacement.workLocation || "—"}</b> · Grade <b>{selectedPlacement.grade || "—"}</b> · Type <b>{selectedPlacement.employeeType || "—"}</b>
                            </p>
                            {(selectedPlacement.missingInvoiceDetails?.length ?? 0) > 0 && <p className="text-amber-700">Missing: {selectedPlacement.missingInvoiceDetails!.join(", ")}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-neutral-700">Update Joining Status</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(["JOINED", "JOINING_PENDING", "NO_SHOW", "CANCELLED"] as const).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => patchMutation.mutate({ id: selectedPlacement.id, joiningStatus: s })}
                                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                                            selectedPlacement.joiningStatus === s
                                                ? "bg-primary text-white border-primary shadow-sm"
                                                : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                                        }`}
                                    >
                                        {s.replace("_", " ")}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-neutral-100">
                            <label className="text-xs font-bold text-neutral-700">Replacement Guarantee Status</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(["NO_REPLACEMENT", "REPLACEMENT_REQUESTED", "REPLACEMENT_IN_PROGRESS", "REPLACEMENT_COMPLETED"] as const).map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => patchMutation.mutate({ id: selectedPlacement.id, replacementStatus: r })}
                                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                                            selectedPlacement.replacementStatus === r
                                                ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                                                : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                                        }`}
                                    >
                                        {r.replace("_", " ")}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </ModalShell>
            )}

            {details && <InvoiceDetailsDialog p={details} onClose={() => setDetails(null)} />}

            {/* Create Placement Modal */}
            {createOpen && (
                <ModalShell
                    title="Record Direct Placement"
                    onClose={() => setCreateOpen(false)}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            createMutation.mutate();
                        }}
                        className="space-y-3.5"
                    >
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Opening</label>
                            <select
                                required
                                value={form.jobId}
                                onChange={(e) => {
                                    const j = jobOptions.find((x) => x.id === e.target.value);
                                    setForm({ ...form, jobId: e.target.value, candidateId: "", offeredPosition: j?.title ?? "" });
                                }}
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            >
                                <option value="">Select the opening…</option>
                                {jobOptions.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.clientName}{j.reqNumber ? ` (${j.reqNumber})` : ""}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Candidate</label>
                                <select
                                    required
                                    disabled={!form.jobId}
                                    value={form.candidateId}
                                    onChange={(e) => setForm({ ...form, candidateId: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl disabled:opacity-60"
                                >
                                    <option value="">{!form.jobId ? "Pick the opening first" : candidateOptions.length ? "Select the candidate…" : "No candidates in this opening"}</option>
                                    {candidateOptions.map((c) => <option key={c.candidateId} value={c.candidateId}>{c.candidateName} · {c.stage.replaceAll("_", " ").toLowerCase()}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Designation / Role</label>
                                <input
                                    required
                                    value={form.offeredPosition}
                                    onChange={(e) => setForm({ ...form, offeredPosition: e.target.value })}
                                    placeholder="Position Title"
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Offered CTC (LPA)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    required
                                    value={form.offeredSalaryLpa}
                                    onChange={(e) => setForm({ ...form, offeredSalaryLpa: e.target.value })}
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700">Agency Fee (₹)</label>
                                <input
                                    type="number"
                                    value={form.revenueInr}
                                    onChange={(e) => setForm({ ...form, revenueInr: e.target.value })}
                                    placeholder="Blank = from client's fee terms"
                                    className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-neutral-700">Joining Date</label>
                            <input
                                type="date"
                                required
                                value={form.joiningDate}
                                onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                                className="w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"
                            />
                            <p className="text-[11px] text-neutral-500 mt-1">The replacement guarantee period comes from the client&rsquo;s billing terms.</p>
                        </div>
                        <div className="pt-2 border-t border-neutral-100">
                            <p className="text-xs font-bold text-neutral-700">Invoicing details <span className="font-normal text-neutral-500">(can be added later, needed before invoicing)</span></p>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} placeholder="Employee code" aria-label="Employee code" className="w-full p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl" />
                                <input value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} placeholder="Location (defaults to the job's)" aria-label="Location" className="w-full p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl" />
                                <input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="Grade" aria-label="Grade" className="w-full p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl" />
                                <select value={form.employeeType} onChange={(e) => setForm({ ...form, employeeType: e.target.value })} aria-label="Employee type" className="w-full p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl">
                                    <option value="">Employee type (FLS / NFLS)</option>
                                    {EMPLOYEE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                            <button
                                type="button"
                                onClick={() => setCreateOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-md shadow-xs hover:bg-primary/95"
                            >
                                {createMutation.isPending ? "Saving..." : "Save Placement"}
                            </button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
