"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr, ModalShell } from "@/components/shared/ui";
import { api, useEmployeeOptions } from "@/lib/api";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { LogOut, Calendar, CheckCircle2, Clock, FileText, Search, UserMinus, ShieldAlert, Filter, AlertCircle } from "lucide-react";

interface ClearanceItem {
    department: string;
    cleared: boolean;
    clearedBy?: string | null;
    clearedAt?: string | null;
    notes?: string | null;
}

interface ExitRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    department: string;
    resignationDate: string;
    noticePeriodDays: number;
    lastWorkingDay: string;
    reason: string;
    status: "PENDING_APPROVAL" | "NOTICE_PERIOD" | "CLEARANCE" | "SETTLED" | "COMPLETED" | "WITHDRAWN";
    exitInterviewNotes?: string | null;
    clearanceChecklist: ClearanceItem[];
    fnfSettled: boolean;
    fnfAmountInr?: number | null;
    fnfPaid?: boolean;
    experienceLetterIssued: boolean;
    pendingAssets?: string[];
}

const inputCls = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none";
const btn = "px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap";

export default function HRExitPage() {
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const qc = useQueryClient();
    const { data: employeeOptions = [] } = useEmployeeOptions();
    const [recordOpen, setRecordOpen] = useState(false);
    const [form, setForm] = useState({ employeeId: "", reason: "", noticePeriodDays: "30", resignationDate: "" });
    const [detail, setDetail] = useState<ExitRecord | null>(null);

    const act = useMutation({
        mutationFn: (body: Record<string, unknown>) => api<ExitRecord>("/api/hr/exit", body.id ? "PATCH" : "POST", body),
        onSuccess: (rec) => {
            toast.success("Exit record updated");
            setRecordOpen(false);
            setForm({ employeeId: "", reason: "", noticePeriodDays: "30", resignationDate: "" });
            setDetail((d) => (d && d.id === rec.id ? { ...d, ...rec } : d));
            qc.invalidateQueries({ queryKey: ["hr-exit"] });
            qc.invalidateQueries({ queryKey: ["hr-employee-options"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const run = (id: string, action: string, extra: Record<string, unknown> = {}) => act.mutate({ id, action, ...extra });

    const { data: exits = [], isLoading } = useQuery<ExitRecord[]>({
        queryKey: ["hr-exit", statusFilter, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/exit?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch exit records");
            return res.json();
        },
    });

    const activeNotice = exits.filter((e) => e.status === "NOTICE_PERIOD" || e.status === "CLEARANCE").length;
    const fnfSettledCount = exits.filter((e) => e.fnfSettled).length;
    const completedExits = exits.filter((e) => e.status === "COMPLETED" || e.status === "SETTLED").length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Employee Offboarding & Exit Management"
                subtitle="Manage resignations, notice periods, departmental clearances, exit interviews, and F&F settlements."
                action={
                    <button onClick={() => setRecordOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2">
                        <UserMinus size={15} /> Record Resignation
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Resignations" value={exits.length} icon={LogOut} tone="primary" hint="All recorded exits" />
                <StatCard label="Serving Notice Period" value={activeNotice} icon={Clock} tone="amber" hint="Active offboarding" />
                <StatCard label="F&F Settled" value={fnfSettledCount} icon={CheckCircle2} tone="emerald" hint="Financial dues cleared" />
                <StatCard label="Completed Exits" value={completedExits} icon={UserMinus} tone="purple" hint="Offboarding complete" />
            </div>

            {/* Filters */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <Filter size={16} className="text-neutral-500" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                            >
                                <option value="ALL">All Exit Statuses</option>
                                <option value="NOTICE_PERIOD">Notice Period</option>
                                <option value="CLEARANCE">Clearance</option>
                                <option value="SETTLED">Settled</option>
                                <option value="PENDING_APPROVAL">Pending Approval</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="WITHDRAWN">Withdrawn</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search employee or dept..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Resignation Table */}
            <SectionCard title={`Offboarding Register (${exits.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-full" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-24" />
                                <SkeletonPulse className="h-4 w-20" />
                            </div>
                        ))}
                    </div>
                ) : exits.length === 0 ? (
                    <EmptyState icon={AlertCircle} message="No resignation or exit records found." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Department</th>
                                    <th className="py-3 px-2">Resignation Date</th>
                                    <th className="py-3 px-2">Notice Period</th>
                                    <th className="py-3 px-2">Last Working Day</th>
                                    <th className="py-3 px-2">Clearance Progress</th>
                                    <th className="py-3 px-2">F&F Settlement</th>
                                    <th className="py-3 px-2">Status</th>
                                    <th className="py-3 px-2 text-right">Next Step</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {exits.map((ext) => {
                                    const clearedCount = ext.clearanceChecklist?.filter((c) => c.cleared).length || 0;
                                    const totalDepts = ext.clearanceChecklist?.length || 1;
                                    const progressPercent = Math.round((clearedCount / totalDepts) * 100);

                                    return (
                                        <tr key={ext.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="py-3.5 px-2 font-bold text-neutral-900 flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 font-extrabold flex items-center justify-center text-xs">
                                                    {ext.employeeName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-neutral-900">{ext.employeeName}</div>
                                                    <div className="text-[11px] text-neutral-400 font-normal truncate max-w-xs">{ext.reason}</div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-2 text-neutral-600 font-medium">{ext.department}</td>
                                            <td className="py-3.5 px-2 text-neutral-800">{ext.resignationDate}</td>
                                            <td className="py-3.5 px-2 font-medium text-neutral-800">{ext.noticePeriodDays} Days</td>
                                            <td className="py-3.5 px-2 font-semibold text-neutral-900">{ext.lastWorkingDay}</td>
                                            <td className="py-3.5 px-2 min-w-35">
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[11px] font-bold text-neutral-600">
                                                        <span>{clearedCount}/{totalDepts} Cleared</span>
                                                        <span>{progressPercent}%</span>
                                                    </div>
                                                    <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                                                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${progressPercent}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-2">
                                                {ext.fnfSettled ? (
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                        Settled {ext.fnfAmountInr ? `(${inr(ext.fnfAmountInr)})` : ""}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-2">
                                                <Badge value={ext.status} />
                                            </td>
                                            <td className="py-3.5 px-2 text-right space-x-1.5 whitespace-nowrap">
                                                {ext.status === "PENDING_APPROVAL" && (
                                                    <>
                                                        <button onClick={() => run(ext.id, "approve")} className={`${btn} bg-primary text-white`}>Approve</button>
                                                        <button onClick={() => { const note = window.prompt("Withdrawal note?"); if (note !== null) run(ext.id, "withdraw", { note }); }} className={`${btn} border border-neutral-200 text-neutral-700`}>Withdraw</button>
                                                    </>
                                                )}
                                                {["NOTICE_PERIOD", "CLEARANCE", "SETTLED"].includes(ext.status) && (
                                                    <button onClick={() => setDetail(ext)} className={`${btn} bg-primary/10 text-primary`}>Manage exit</button>
                                                )}
                                                {["COMPLETED", "WITHDRAWN"].includes(ext.status) && (
                                                    <button onClick={() => setDetail(ext)} className={`${btn} text-neutral-500`}>View</button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <ModalShell open={recordOpen} onClose={() => setRecordOpen(false)} title="Record Resignation">
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act.mutate({ ...form, noticePeriodDays: Number(form.noticePeriodDays) }); }}>
                    <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={inputCls}>
                        <option value="">Select employee</option>
                        {employeeOptions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.employeeId} · {e.department}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={form.resignationDate} onChange={(e) => setForm({ ...form, resignationDate: e.target.value })} className={inputCls} />
                        <input type="number" min="0" placeholder="Notice days" value={form.noticePeriodDays} onChange={(e) => setForm({ ...form, noticePeriodDays: e.target.value })} className={inputCls} />
                    </div>
                    <textarea required placeholder="Reason" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={inputCls} />
                    <button disabled={act.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save</button>
                </form>
            </ModalShell>

            <ModalShell open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.employeeName} — exit` : ""} wide>
                {detail && (
                    <div className="space-y-5 text-sm">
                        <div className="flex flex-wrap gap-4 text-neutral-600">
                            <span>Status: <Badge value={detail.status} /></span>
                            <span>Last working day: <strong>{detail.lastWorkingDay}</strong></span>
                        </div>
                        {(detail.pendingAssets ?? []).length > 0 && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                Assets still with employee: {detail.pendingAssets!.join(", ")} — record their return on the Assets page before IT clearance.
                            </p>
                        )}
                        <div>
                            <h4 className="text-xs font-bold uppercase text-neutral-400 mb-2">Department clearance</h4>
                            <ul className="space-y-1.5">
                                {detail.clearanceChecklist.map((c) => (
                                    <li key={c.department} className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
                                        <span>{c.cleared ? "✅" : "⏳"} {c.department}{c.clearedBy ? <span className="text-[11px] text-neutral-400"> · {c.clearedBy} {c.clearedAt}</span> : null}</span>
                                        {!c.cleared && ["NOTICE_PERIOD", "CLEARANCE"].includes(detail.status) && (
                                            <button onClick={() => run(detail.id, "clear", { department: c.department })} className={`${btn} bg-emerald-50 text-emerald-700`}>Mark cleared</button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold uppercase text-neutral-400 mb-1">Exit interview</h4>
                            <p className="text-neutral-700">{detail.exitInterviewNotes || <span className="italic text-neutral-400">Not recorded</span>}</p>
                            {detail.status !== "COMPLETED" && (
                                <button onClick={() => { const notes = window.prompt("Exit interview notes", detail.exitInterviewNotes ?? ""); if (notes) run(detail.id, "exit_interview", { notes }); }} className={`${btn} mt-1.5 border border-neutral-200 text-neutral-700`}>Record interview</button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
                            {!detail.fnfSettled && detail.status !== "WITHDRAWN" && (
                                <button onClick={() => { const amt = window.prompt("Full & final amount (₹) — Finance will release it"); if (amt !== null) run(detail.id, "settle", { fnfAmountInr: Number(amt) }); }} className={`${btn} bg-primary text-white`}>Finalise F&F → Finance</button>
                            )}
                            {detail.fnfSettled && !detail.experienceLetterIssued && (
                                <button onClick={() => run(detail.id, "issue_letter")} className={`${btn} bg-primary text-white`}>Issue experience letter</button>
                            )}
                            {detail.fnfSettled && !detail.fnfPaid && <span className="text-xs text-amber-700 font-bold">Waiting for Finance to release the F&F payment</span>}
                            {detail.status === "SETTLED" && detail.experienceLetterIssued && detail.fnfPaid && (
                                <button onClick={() => { if (window.confirm(`Complete exit for ${detail.employeeName}? Their login will be deactivated.`)) run(detail.id, "complete"); }} className={`${btn} bg-rose-600 text-white`}>Complete exit</button>
                            )}
                            {detail.fnfSettled && <span className="text-xs text-emerald-700 font-bold">F&F {detail.fnfAmountInr != null ? inr(detail.fnfAmountInr) : ""} {detail.fnfPaid ? "paid by Finance" : "finalised"}</span>}
                        </div>
                    </div>
                )}
            </ModalShell>
        </div>
    );
}
