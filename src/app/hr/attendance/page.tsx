"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    Calendar, Clock, UserCheck, UserX, AlertCircle, Search, Filter,
    ShieldAlert, Laptop, FileEdit, Plus, CheckCircle2, XCircle,
    CalendarDays, Layers, X
} from "lucide-react";
import type { ShiftSchedule, AttendanceCorrectionRecord, WfhRecord } from "@/lib/types";

interface AttendanceRecordEnriched {
    id: string;
    userId: string;
    date: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_LEAVE" | "WFH";
    checkIn: string | null;
    checkOut: string | null;
    employeeName: string;
    department: string;
    employeeCode: string;
    hoursWorked: number;
    isLate: boolean;
    overtimeHours: number;
}

function AttendanceContent() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const statusParam = searchParams.get("status");
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<"REGISTER" | "CALENDAR" | "EXCEPTIONS" | "WFH" | "CORRECTIONS" | "SHIFTS">("REGISTER");

    const today = new Date().toISOString().split("T")[0];
    const [date, setDate] = useState(today);
    const [department, setDepartment] = useState("ALL");
    const [status, setStatus] = useState("ALL");
    const [search, setSearch] = useState("");

    // Modal state for creating shift
    const [shiftModalOpen, setShiftModalOpen] = useState(false);
    const [shiftName, setShiftName] = useState("");
    const [shiftStart, setShiftStart] = useState("09:30");
    const [shiftEnd, setShiftEnd] = useState("18:30");

    useEffect(() => {
        if (tabParam === "calendar") setActiveTab("CALENDAR");
        else if (tabParam === "exceptions" || statusParam === "LATE") setActiveTab("EXCEPTIONS");
        else if (tabParam === "wfh" || statusParam === "WFH") setActiveTab("WFH");
        else if (tabParam === "corrections") setActiveTab("CORRECTIONS");
        else if (tabParam === "shifts") setActiveTab("SHIFTS");
    }, [tabParam, statusParam]);

    // 1. Fetch Attendance Records
    const { data: records = [], isLoading } = useQuery<AttendanceRecordEnriched[]>({
        queryKey: ["hr-attendance", date, department, status, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (date) params.set("date", date);
            if (department !== "ALL") params.set("department", department);
            if (status !== "ALL") params.set("status", status);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/attendance?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch attendance");
            return res.json();
        },
    });

    // 2. Fetch Shifts
    const { data: shifts = [] } = useQuery<ShiftSchedule[]>({
        queryKey: ["hr-shifts"],
        queryFn: async () => {
            const res = await fetch("/api/hr/shifts");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Create shift mutation
    const createShiftMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/hr/shifts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to create shift");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-shifts"] });
            toast.success("Shift schedule configured");
            setShiftModalOpen(false);
            setShiftName("");
        },
    });

    const presentCount = records.filter((r) => r.status === "PRESENT" || r.status === "WFH").length;
    const absentCount = records.filter((r) => r.status === "ABSENT").length;
    const lateCount = records.filter((r) => r.isLate || r.status === "LATE").length;
    const leaveCount = records.filter((r) => r.status === "ON_LEAVE" || r.status === "HALF_DAY").length;
    const wfhCount = records.filter((r) => r.status === "WFH").length;

    const departmentsList = ["ALL", "Engineering", "Human Resources", "Talent Acquisition", "Operations", "Finance", "Sales", "Field", "Leadership"];
    const statusList = ["ALL", "PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE", "WFH"];

    const formatTime = (iso: string | null) => {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        } catch {
            return "—";
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Time & Attendance Management"
                subtitle="Daily registers, interactive shift schedules, biometric logs, exception handling, and remote work audits."
                action={
                    activeTab === "SHIFTS" && (
                        <button
                            onClick={() => setShiftModalOpen(true)}
                            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                        >
                            <Plus size={16} /> New Shift
                        </button>
                    )
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Present / On Duty" value={presentCount} icon={UserCheck} tone="emerald" hint="Check-ins recorded today" />
                <StatCard label="Absent" value={absentCount} icon={UserX} tone="red" hint="Unexcused absences" />
                <StatCard label="Late Arrivals" value={lateCount} icon={ShieldAlert} tone="amber" hint="Check-in after grace period" />
                <StatCard label="Remote / WFH" value={wfhCount} icon={Laptop} tone="blue" hint="Approved telecommute" />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
                {(
                    [
                        { id: "REGISTER", label: "Daily Register" },
                        { id: "CALENDAR", label: "Attendance Calendar" },
                        { id: "EXCEPTIONS", label: `Late & Exceptions (${lateCount})` },
                        { id: "WFH", label: `WFH / Remote (${wfhCount})` },
                        { id: "CORRECTIONS", label: "Attendance Corrections" },
                        { id: "SHIFTS", label: `Shifts & Schedules (${shifts.length})` },
                    ] as const
                ).map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                            activeTab === t.id
                                ? "bg-primary text-white shadow-xs"
                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: DAILY REGISTER (Existing Preserved) */}
            {activeTab === "REGISTER" && (
                <div className="space-y-6">
                    <SectionCard>
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                                    <Calendar size={16} className="text-neutral-500" />
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                                    <Filter size={16} className="text-neutral-500" />
                                    <select
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                                    >
                                        <option value="ALL">All Departments</option>
                                        {departmentsList.filter((d) => d !== "ALL").map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                                    >
                                        <option value="ALL">All Statuses</option>
                                        {statusList.filter((s) => s !== "ALL").map((s) => (
                                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="relative w-full md:w-64">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Search employee..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title={`Attendance Records (${records.length})`}>
                        {isLoading ? (
                            <SkeletonPulse className="h-40 w-full" />
                        ) : records.length === 0 ? (
                            <EmptyState icon={AlertCircle} message="No attendance records found for the selected date and filters." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                            <th className="py-3 px-2">Employee</th>
                                            <th className="py-3 px-2">Code</th>
                                            <th className="py-3 px-2">Department</th>
                                            <th className="py-3 px-2">Check In</th>
                                            <th className="py-3 px-2">Check Out</th>
                                            <th className="py-3 px-2">Hours</th>
                                            <th className="py-3 px-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {records.map((r) => (
                                            <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                                                <td className="py-3.5 px-2 font-bold text-neutral-900 flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-extrabold flex items-center justify-center text-xs">
                                                        {r.employeeName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-neutral-900">{r.employeeName}</div>
                                                        {r.isLate && <span className="text-[10px] text-amber-600 font-bold">Late Arrival</span>}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-2 font-mono text-xs text-neutral-500">{r.employeeCode}</td>
                                                <td className="py-3.5 px-2 text-neutral-600 font-medium">{r.department}</td>
                                                <td className="py-3.5 px-2 font-medium text-neutral-800">{formatTime(r.checkIn)}</td>
                                                <td className="py-3.5 px-2 font-medium text-neutral-800">{formatTime(r.checkOut)}</td>
                                                <td className="py-3.5 px-2 font-semibold text-neutral-900">
                                                    {r.hoursWorked > 0 ? `${r.hoursWorked} hrs` : "—"}
                                                </td>
                                                <td className="py-3.5 px-2">
                                                    <Badge value={r.status} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* TAB 2: ATTENDANCE CALENDAR (Section 12) */}
            {activeTab === "CALENDAR" && (
                <SectionCard title="Monthly Team Attendance Matrix">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> Present (P)</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> Late (L)</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> WFH</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500" /> Leave</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> Absent (A)</span>
                        </div>

                        <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                            <table className="w-full text-center text-xs">
                                <thead>
                                    <tr className="bg-neutral-50 border-b border-neutral-200">
                                        <th className="py-2.5 px-3 text-left font-bold text-neutral-700 min-w-36">Employee</th>
                                        {Array.from({ length: 14 }).map((_, i) => (
                                            <th key={i} className="py-2 px-1 font-semibold text-neutral-600 border-l border-neutral-100">
                                                Sep {i + 12}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 font-medium">
                                    {records.slice(0, 8).map((r) => (
                                        <tr key={r.id} className="hover:bg-neutral-50">
                                            <td className="py-2 px-3 text-left font-bold text-neutral-900 truncate">
                                                {r.employeeName}
                                            </td>
                                            {Array.from({ length: 14 }).map((_, i) => {
                                                const day = i + 12;
                                                const isWeekend = day % 7 === 0 || day % 7 === 6;
                                                if (isWeekend) {
                                                    return (
                                                        <td key={i} className="py-2 px-1 bg-neutral-100 text-neutral-400 text-[10px]">
                                                            OFF
                                                        </td>
                                                    );
                                                }
                                                const stat = i === 3 ? "L" : i === 7 ? "WFH" : i === 11 ? "A" : "P";
                                                return (
                                                    <td key={i} className="py-2 px-1 border-l border-neutral-100">
                                                        <span
                                                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                                                                stat === "P"
                                                                    ? "bg-emerald-100 text-emerald-800"
                                                                    : stat === "L"
                                                                    ? "bg-amber-100 text-amber-800"
                                                                    : stat === "WFH"
                                                                    ? "bg-blue-100 text-blue-800"
                                                                    : "bg-red-100 text-red-800"
                                                            }`}
                                                        >
                                                            {stat}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB 3: LATE & EXCEPTIONS (Section 13) */}
            {activeTab === "EXCEPTIONS" && (
                <SectionCard title="Attendance Discrepancies & Exceptions Log">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Date</th>
                                    <th className="py-3 px-2">Exception Category</th>
                                    <th className="py-3 px-2">Check In Time</th>
                                    <th className="py-3 px-2">Grace Breach</th>
                                    <th className="py-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {records
                                    .filter((r) => r.isLate || r.status === "LATE")
                                    .map((r) => (
                                        <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="py-3.5 px-2 font-bold text-neutral-900">{r.employeeName}</td>
                                            <td className="py-3.5 px-2 text-xs text-neutral-600">{r.date}</td>
                                            <td className="py-3.5 px-2">
                                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-xs">
                                                    Late Entry Check-In
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-2 font-mono text-xs font-bold text-neutral-800">{formatTime(r.checkIn)}</td>
                                            <td className="py-3.5 px-2 text-xs font-bold text-red-600">+35 mins late</td>
                                            <td className="py-3.5 px-2 text-right">
                                                <button
                                                    onClick={() => toast.success(`Regularized punch for ${r.employeeName}`)}
                                                    className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20"
                                                >
                                                    Regularize
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* TAB 4: WFH (Section 14) */}
            {activeTab === "WFH" && (
                <SectionCard title="Remote Work (WFH) Approvals">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                    <th className="py-3 px-2">Employee</th>
                                    <th className="py-3 px-2">Department</th>
                                    <th className="py-3 px-2">Check In</th>
                                    <th className="py-3 px-2">Hours Worked</th>
                                    <th className="py-3 px-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {records
                                    .filter((r) => r.status === "WFH")
                                    .map((r) => (
                                        <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="py-3.5 px-2 font-bold text-neutral-900">{r.employeeName}</td>
                                            <td className="py-3.5 px-2 text-neutral-600">{r.department}</td>
                                            <td className="py-3.5 px-2 font-mono text-xs text-neutral-800">{formatTime(r.checkIn)}</td>
                                            <td className="py-3.5 px-2 font-bold text-neutral-900">{r.hoursWorked} hrs</td>
                                            <td className="py-3.5 px-2">
                                                <Badge value="WFH" />
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* TAB 5: CORRECTIONS (Section 15) */}
            {activeTab === "CORRECTIONS" && (
                <SectionCard title="Attendance Punch Correction Requests">
                    <div className="space-y-3">
                        <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between">
                            <div>
                                <span className="font-bold text-xs text-neutral-900">Rahul Sharma • Sep 22</span>
                                <p className="text-xs text-neutral-500">Requested Check-In: 09:25 AM (Original: Missed). Biometric power failure.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => toast.success("Punch correction approved")} className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs">
                                    Approve
                                </button>
                                <button onClick={() => toast.error("Punch correction rejected")} className="px-3 py-1 rounded-lg bg-red-100 text-red-700 font-bold text-xs">
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* TAB 6: SHIFTS (Section 16) */}
            {activeTab === "SHIFTS" && (
                <SectionCard title="Configured Shifts & Rosters">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {shifts.map((s) => (
                            <div key={s.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-sm text-neutral-900">{s.name}</h4>
                                    <Badge value={s.status} />
                                </div>
                                <div className="text-xs font-mono font-bold text-primary">
                                    {s.startTime} – {s.endTime} ({s.workingHours} hrs)
                                </div>
                                <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
                                    <span>Grace: {s.graceMinutes} mins</span>
                                    <span className="font-bold text-neutral-700">{s.assignedCount} Employees</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Create Shift Modal */}
            {shiftModalOpen && (
                <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-100 p-6 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <h3 className="font-bold text-base text-neutral-900">Create Shift Schedule</h3>
                            <button onClick={() => setShiftModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Shift Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Afternoon Client Support"
                                    value={shiftName}
                                    onChange={(e) => setShiftName(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Start Time</label>
                                    <input
                                        type="time"
                                        value={shiftStart}
                                        onChange={(e) => setShiftStart(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">End Time</label>
                                    <input
                                        type="time"
                                        value={shiftEnd}
                                        onChange={(e) => setShiftEnd(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShiftModalOpen(false)} className="px-4 py-2 text-sm font-bold text-neutral-600">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!shiftName) return;
                                    createShiftMutation.mutate({ name: shiftName, startTime: shiftStart, endTime: shiftEnd });
                                }}
                                className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-xs hover:bg-primary/90"
                            >
                                Save Shift
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HRAttendancePage() {
    return (
        <Suspense fallback={<SkeletonPulse className="h-96 w-full" />}>
            <AttendanceContent />
        </Suspense>
    );
}
