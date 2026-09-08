"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, MapPin, IndianRupee, Clock, CheckCircle2, XCircle, Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function AdminJobsPage() {
    const qc = useQueryClient();
    const [filter, setFilter] = useState("ALL");
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<any>(null);

    const [form, setForm] = useState({
        clientId: "",
        title: "",
        department: "",
        location: "",
        openings: "1",
        salaryMinLpa: "",
        salaryMaxLpa: "",
        experienceMinYears: "",
        experienceMaxYears: "",
        skills: "",
        priority: "MEDIUM",
        description: "",
        status: "APPROVED"
    });

    const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: async () => (await fetch("/api/admin/clients")).json() });
    const { data: jobs, isLoading } = useQuery({
        queryKey: ["admin-jobs"],
        queryFn: async () => (await fetch("/api/admin/jobs")).json(),
        refetchInterval: 20000,
    });

    // Create Job Mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Requisition created successfully.");
            setCreateModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Update Job Mutation
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!selectedJob?.id) return;
            const res = await fetch("/api/admin/jobs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedJob.id,
                    ...form,
                }),
            });
            if (!res.ok) throw new Error("Failed to update job");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Job updated successfully.");
            setEditModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: () => toast.error("Failed to update job"),
    });

    // Quick Status / Approval Patch Mutation
    const patchStatusMutation = useMutation({
        mutationFn: async ({ id, action, status }: { id: string; action?: string; status?: string }) => {
            const res = await fetch("/api/admin/jobs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action, status }),
            });
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.action === "approve" ? "Requisition approved & published." : "Job updated.");
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: () => toast.error("Update failed"),
    });

    // Delete Job Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/admin/jobs?id=${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete job");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Job deleted successfully.");
            setDeleteModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: () => toast.error("Failed to delete job"),
    });

    const openEdit = (job: any) => {
        setSelectedJob(job);
        setForm({
            clientId: job.clientId || "",
            title: job.title || "",
            department: job.department || "",
            location: job.location || "",
            openings: String(job.openings || "1"),
            salaryMinLpa: String(job.salaryMinLpa || ""),
            salaryMaxLpa: String(job.salaryMaxLpa || ""),
            experienceMinYears: String(job.experienceMinYears || ""),
            experienceMaxYears: String(job.experienceMaxYears || ""),
            skills: Array.isArray(job.skills) ? job.skills.join(", ") : (job.skills || ""),
            priority: job.priority || "MEDIUM",
            description: job.description || "",
            status: job.status || "APPROVED",
        });
        setEditModalOpen(true);
    };

    const openCreate = () => {
        setForm({
            clientId: "",
            title: "",
            department: "",
            location: "",
            openings: "1",
            salaryMinLpa: "",
            salaryMaxLpa: "",
            experienceMinYears: "",
            experienceMaxYears: "",
            skills: "",
            priority: "MEDIUM",
            description: "",
            status: "APPROVED",
        });
        setCreateModalOpen(true);
    };

    const all = Array.isArray(jobs) ? jobs : [];
    const filtered = filter === "ALL" ? all : all.filter((j: any) => j.status === filter);
    const pending = all.filter((j: any) => j.status === "PENDING_APPROVAL");

    return (
        <div className="space-y-6">
            <PageHeader
                title="Job Requisitions"
                subtitle="Create, edit, delete and manage the lifecycle of job openings"
                action={
                    <button
                        onClick={openCreate}
                        className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2"
                    >
                        <Plus size={16} /> New Requisition
                    </button>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pending Approval" value={pending.length} icon={Clock} tone={pending.length ? "amber" : "emerald"} />
                <StatCard label="Sourcing / Interviewing" value={all.filter((j: any) => ["SOURCING", "INTERVIEWING"].includes(j.status)).length} icon={Briefcase} tone="blue" />
                <StatCard label="Fulfilled" value={all.filter((j: any) => j.status === "FULFILLED").length} icon={CheckCircle2} tone="emerald" />
                <StatCard label="Cancelled / Closed" value={all.filter((j: any) => ["CANCELLED", "CLOSED"].includes(j.status)).length} icon={XCircle} tone="red" />
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap">
                {["ALL", "PENDING_APPROVAL", "APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE", "FULFILLED", "CLOSED", "CANCELLED"].map((s) => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                            filter === s
                                ? "bg-primary text-white shadow-md shadow-primary/20"
                                : "bg-white border border-neutral-200 text-neutral-500 hover:border-neutral-300"
                        }`}
                    >
                        {s.replaceAll("_", " ")}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={Briefcase} message="No requisitions in this view." />
                </SectionCard>
            ) : (
                <div className="space-y-3">
                    {filtered.map((j: any) => (
                        <div
                            key={j.id}
                            className={`bg-white p-5 rounded-2xl border shadow-xs space-y-3 transition-all hover:border-neutral-300 ${
                                j.status === "PENDING_APPROVAL" ? "border-amber-200 bg-amber-50/30" : "border-neutral-200/80"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-neutral-900 text-base">{j.title}</h3>
                                        <Badge value={j.status} />
                                        <Badge value={j.priority} />
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1 flex items-center gap-3 flex-wrap">
                                        <span className="font-bold text-primary">{j.clientName}</span>
                                        <span className="flex items-center gap-1">
                                            <MapPin size={12} /> {j.location || "Remote"}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <IndianRupee size={12} /> {j.salaryMinLpa}–{j.salaryMaxLpa} LPA
                                        </span>
                                        <span>
                                            {j.openings} opening{j.openings > 1 ? "s" : ""} · filled {j.filled}
                                        </span>
                                        <span>
                                            Exp: {j.experienceMinYears}–{j.experienceMaxYears} yrs
                                        </span>
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => openEdit(j)}
                                        className="p-2 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-primary transition-colors"
                                        title="Edit Job"
                                    >
                                        <Edit2 size={15} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedJob(j);
                                            setDeleteModalOpen(true);
                                        }}
                                        className="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                                        title="Delete Job"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                    <div className="text-right pl-3 border-l border-neutral-100">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Days open</p>
                                        <p className="text-base font-extrabold text-neutral-900">{j.daysOpen}</p>
                                    </div>
                                </div>
                            </div>

                            {j.skills?.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                    {j.skills.map((s: string) => (
                                        <span key={s} className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md text-[10px] font-semibold">
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-neutral-100 flex-wrap gap-3">
                                <div className="flex items-center gap-4 text-xs text-neutral-500">
                                    <span>
                                        Pipeline: <strong className="text-neutral-800">{j.inPipeline}</strong>
                                    </span>
                                    <span>
                                        Joined: <strong className="text-emerald-600">{j.joinedCount}</strong>
                                    </span>
                                    {j.requestedByName && (
                                        <span>
                                            Raised by <strong className="text-neutral-700">{j.requestedByName}</strong>
                                        </span>
                                    )}
                                    {j.approvedByName && (
                                        <span>
                                            · Approved by <strong className="text-neutral-700">{j.approvedByName}</strong>
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {j.status === "PENDING_APPROVAL" ? (
                                        <>
                                            <button
                                                onClick={() => patchStatusMutation.mutate({ id: j.id, action: "approve" })}
                                                disabled={patchStatusMutation.isPending}
                                                className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors flex items-center gap-1.5 shadow-md shadow-primary/20 disabled:opacity-50"
                                            >
                                                <CheckCircle2 size={14} /> Approve
                                            </button>
                                            <button
                                                onClick={() => patchStatusMutation.mutate({ id: j.id, status: "CANCELLED" })}
                                                disabled={patchStatusMutation.isPending}
                                                className="px-4 py-1.5 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                <XCircle size={14} /> Reject
                                            </button>
                                        </>
                                    ) : (
                                        <select
                                            value={j.status}
                                            onChange={(e) => patchStatusMutation.mutate({ id: j.id, status: e.target.value })}
                                            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-neutral-200 bg-white outline-none focus:border-primary"
                                        >
                                            {["APPROVED", "SOURCING", "INTERVIEWING", "OFFER_STAGE", "FULFILLED", "CLOSED", "CANCELLED"].map((s) => (
                                                <option key={s} value={s}>
                                                    {s.replaceAll("_", " ")}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Job Modal */}
            <ModalShell open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Job Requisition" wide>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        createMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Client / Company *</span>
                        <select
                            required
                            value={form.clientId}
                            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white"
                        >
                            <option value="">Select client…</option>
                            {(Array.isArray(clients) ? clients : []).map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.companyName}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Title *</span>
                            <input
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Location</span>
                            <input
                                value={form.location}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Openings</span>
                            <input
                                type="number"
                                min="1"
                                value={form.openings}
                                onChange={(e) => setForm({ ...form, openings: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Priority</span>
                            <select
                                value={form.priority}
                                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white"
                            >
                                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Min (LPA)</span>
                            <input
                                type="number"
                                value={form.salaryMinLpa}
                                onChange={(e) => setForm({ ...form, salaryMinLpa: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Max (LPA)</span>
                            <input
                                type="number"
                                value={form.salaryMaxLpa}
                                onChange={(e) => setForm({ ...form, salaryMaxLpa: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Exp Min (yrs)</span>
                            <input
                                type="number"
                                value={form.experienceMinYears}
                                onChange={(e) => setForm({ ...form, experienceMinYears: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Exp Max (yrs)</span>
                            <input
                                type="number"
                                value={form.experienceMaxYears}
                                onChange={(e) => setForm({ ...form, experienceMaxYears: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                    </div>
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Skills (comma separated)</span>
                        <input
                            value={form.skills}
                            onChange={(e) => setForm({ ...form, skills: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            placeholder="Node.js, SQL, AWS"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Description</span>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="mt-1 w-full px-4 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            placeholder="Detailed requirements and responsibilities..."
                        />
                    </label>
                    <button
                        disabled={createMutation.isPending}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
                    >
                        {createMutation.isPending ? "Creating..." : "Create Requisition"}
                    </button>
                </form>
            </ModalShell>

            {/* Edit Job Modal */}
            <ModalShell open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Job Requisition" wide>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        updateMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Client / Company</span>
                        <select
                            value={form.clientId}
                            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white"
                        >
                            {(Array.isArray(clients) ? clients : []).map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.companyName}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Title *</span>
                            <input
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Location</span>
                            <input
                                value={form.location}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Openings</span>
                            <input
                                type="number"
                                min="1"
                                value={form.openings}
                                onChange={(e) => setForm({ ...form, openings: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Priority</span>
                            <select
                                value={form.priority}
                                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none bg-white"
                            >
                                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Min (LPA)</span>
                            <input
                                type="number"
                                value={form.salaryMinLpa}
                                onChange={(e) => setForm({ ...form, salaryMinLpa: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Salary Max (LPA)</span>
                            <input
                                type="number"
                                value={form.salaryMaxLpa}
                                onChange={(e) => setForm({ ...form, salaryMaxLpa: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Exp Min (yrs)</span>
                            <input
                                type="number"
                                value={form.experienceMinYears}
                                onChange={(e) => setForm({ ...form, experienceMinYears: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Exp Max (yrs)</span>
                            <input
                                type="number"
                                value={form.experienceMaxYears}
                                onChange={(e) => setForm({ ...form, experienceMaxYears: e.target.value })}
                                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                            />
                        </label>
                    </div>
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Skills (comma separated)</span>
                        <input
                            value={form.skills}
                            onChange={(e) => setForm({ ...form, skills: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Job Description</span>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="mt-1 w-full px-4 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                        />
                    </label>
                    <button
                        disabled={updateMutation.isPending}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
                    >
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </ModalShell>

            {/* Delete Confirmation Modal */}
            <ModalShell open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Job Requisition">
                <div className="space-y-4">
                    <p className="text-sm text-neutral-600">
                        Kya aap sure hain ki aap job <strong className="text-neutral-900">{selectedJob?.title}</strong> ko delete karna chahte hain?
                        Ye job Supabase database se permanently delete ho jayegi.
                    </p>
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={() => setDeleteModalOpen(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => selectedJob?.id && deleteMutation.mutate(selectedJob.id)}
                            disabled={deleteMutation.isPending}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-900/20 disabled:opacity-50"
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Job"}
                        </button>
                    </div>
                </div>
            </ModalShell>
        </div>
    );
}
