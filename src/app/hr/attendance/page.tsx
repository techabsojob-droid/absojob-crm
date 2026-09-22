"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { Calendar, Clock, UserCheck, UserX, AlertCircle, Search, Filter, ShieldAlert } from "lucide-react";

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

export default function HRAttendancePage() {
    const today = new Date().toISOString().split("T")[0];
    const [date, setDate] = useState(today);
    const [department, setDepartment] = useState("ALL");
    const [status, setStatus] = useState("ALL");
    const [search, setSearch] = useState("");

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

    const presentCount = records.filter((r) => r.status === "PRESENT" || r.status === "WFH").length;
    const absentCount = records.filter((r) => r.status === "ABSENT").length;
    const lateCount = records.filter((r) => r.isLate || r.status === "LATE").length;
    const leaveCount = records.filter((r) => r.status === "ON_LEAVE" || r.status === "HALF_DAY").length;

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
                title="Daily Attendance Register"
                subtitle="Track daily check-ins, work hours, late arrivals, and absence records across departments."
            />

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Present / On Duty" value={presentCount} icon={UserCheck} tone="emerald" hint="Check-ins recorded today" />
                <StatCard label="Absent" value={absentCount} icon={UserX} tone="red" hint="Unexcused absences" />
                <StatCard label="Late Arrivals" value={lateCount} icon={ShieldAlert} tone="amber" hint="Check-in after 09:30 AM" />
                <StatCard label="On Leave / Half Day" value={leaveCount} icon={Clock} tone="blue" hint="Approved leave requests" />
            </div>

            {/* Filter Controls */}
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
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
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
                                    <option key={s} value={s}>
                                        {s.replace("_", " ")}
                                    </option>
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

            {/* Attendance Table */}
            <SectionCard title={`Attendance Records (${records.length})`}>
                {isLoading ? (
                    <div className="space-y-3 py-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100">
                                <SkeletonPulse className="w-10 h-10 rounded-full" />
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-24" />
                                <SkeletonPulse className="h-4 w-20" />
                            </div>
                        ))}
                    </div>
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
    );
}
