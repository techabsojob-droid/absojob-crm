"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Users, Search, Plus, Filter, Mail, Phone, Calendar,
    Building2, MapPin, Wallet, Award, Laptop, FileText,
    Clock, CheckCircle, AlertCircle, X, ChevronRight,
} from "lucide-react";
import { PageHeader, Badge, SectionCard, ModalShell, inr, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

const DEPARTMENTS = ["ALL", "Engineering", "Human Resources", "Talent Acquisition", "Operations", "Finance", "Sales", "Field", "Leadership"];

import { Suspense } from "react";
import { TempPasswordDialog, type IssuedLogin } from "@/components/shared/TempPasswordDialog";

export default function HrEmployeesPageWrapper() {
    return <Suspense><HrEmployeesPage /></Suspense>;
}

function HrEmployeesPage() {
    const searchParams = useSearchParams();
    const initialId = searchParams.get("id");
    const queryClient = useQueryClient();

    const [q, setQ] = useState("");
    const [deptFilter, setDeptFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedEmpId, setSelectedEmpId] = useState<string | null>(initialId);
    const [activeTab, setActiveTab] = useState<string>("overview");
    const [addModalOpen, setAddModalOpen] = useState(false);

    // New employee form state
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        department: "Engineering",
        designation: "",
        joiningDate: new Date().toISOString().split("T")[0],
        employmentType: "FULL_TIME",
        location: "Mumbai",
        salaryMonthly: 60000,
    });

    const { data: employeesList, isLoading } = useQuery({
        queryKey: ["hr-employees", q, deptFilter, statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (deptFilter !== "ALL") params.set("department", deptFilter);
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            const res = await fetch(`/api/hr/employees?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to load employees");
            return res.json();
        },
    });

    // Detailed employee 360 profile
    const { data: selectedEmployee, isLoading: profileLoading } = useQuery({
        queryKey: ["hr-employee-profile", selectedEmpId],
        queryFn: async () => {
            if (!selectedEmpId) return null;
            const res = await fetch(`/api/hr/employees?id=${selectedEmpId}`);
            if (!res.ok) throw new Error("Failed to load employee details");
            return res.json();
        },
        enabled: !!selectedEmpId,
    });

    const [issued, setIssued] = useState<IssuedLogin | null>(null);
    const addEmployeeMutation = useMutation({
        mutationFn: async (payload: typeof formData) => {
            const res = await fetch("/api/hr/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Failed");
            return res.json();
        },
        onSuccess: (newEmp) => {
            queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
            queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
            setAddModalOpen(false);
            setSelectedEmpId(newEmp.id);
            toast.success(`Employee ${newEmp.employeeId} registered.`);
            if (newEmp.tempPassword) setIssued({ name: newEmp.name, email: newEmp.loginEmail ?? newEmp.email, password: newEmp.tempPassword });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to add employee");
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-64" />
                <SkeletonPulse className="h-12 w-full" />
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-16 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <TempPasswordDialog login={issued} onClose={() => setIssued(null)} />
            <PageHeader
                title="Employee Directory"
                subtitle="Centralized personnel management, organizational hierarchy & 360° employee records"
                action={
                    <button
                        onClick={() => setAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary-dark transition-all"
                    >
                        <Plus size={16} /> Add Employee
                    </button>
                }
            />

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs">
                <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search name, ID, designation..."
                        className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                    <select
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                        className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                    >
                        {DEPARTMENTS.map((d) => (
                            <option key={d} value={d}>{d === "ALL" ? "All Departments" : d}</option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="ON_LEAVE">On Leave</option>
                        <option value="NOTICE_PERIOD">Notice Period</option>
                        <option value="EXITED">Exited</option>
                    </select>
                </div>
            </div>

            {/* Employees Table */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50/80 border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                            <tr>
                                <th className="py-3.5 px-5">Employee</th>
                                <th className="py-3.5 px-4">Role & Dept</th>
                                <th className="py-3.5 px-4">Reporting Manager</th>
                                <th className="py-3.5 px-4">Joining Date</th>
                                <th className="py-3.5 px-4">Type</th>
                                <th className="py-3.5 px-4">Status</th>
                                <th className="py-3.5 px-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-medium">
                            {employeesList?.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                                        No employees matching current filter.
                                    </td>
                                </tr>
                            ) : (
                                employeesList?.map((emp: any) => (
                                    <tr
                                        key={emp.id}
                                        onClick={() => setSelectedEmpId(emp.id)}
                                        className="hover:bg-neutral-50/80 cursor-pointer transition-colors group"
                                    >
                                        <td className="py-3.5 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-neutral-900 group-hover:text-primary transition-colors">{emp.name}</p>
                                                    <p className="text-[10px] font-mono text-neutral-400">{emp.employeeId} · {emp.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <p className="text-neutral-800 font-semibold">{emp.designation}</p>
                                            <p className="text-[11px] text-neutral-400">{emp.department}</p>
                                        </td>
                                        <td className="py-3.5 px-4 text-neutral-600">
                                            {emp.reportingManagerName || "—"}
                                        </td>
                                        <td className="py-3.5 px-4 text-neutral-600">
                                            {emp.joiningDate}
                                        </td>
                                        <td className="py-3.5 px-4 text-neutral-600">
                                            {emp.employmentType?.replace("_", " ")}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <Badge value={emp.status} />
                                        </td>
                                        <td className="py-3.5 px-5 text-right">
                                            <span className="text-primary font-bold text-[11px] group-hover:underline inline-flex items-center gap-0.5">
                                                View 360° <ChevronRight size={13} />
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 360 Employee Profile Drawer / Modal */}
            <ModalShell
                open={!!selectedEmpId}
                onClose={() => setSelectedEmpId(null)}
                title={selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.employeeId})` : "Employee Profile"}
                wide
            >
                {profileLoading || !selectedEmployee ? (
                    <div className="space-y-4 py-8">
                        <SkeletonPulse className="h-12 w-full" />
                        <SkeletonPulse className="h-48 w-full" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Header snippet */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-primary text-white font-black text-xl flex items-center justify-center shadow-md shadow-primary/20">
                                    {selectedEmployee.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-neutral-900">{selectedEmployee.name}</h3>
                                        <Badge value={selectedEmployee.status} />
                                    </div>
                                    <p className="text-xs font-semibold text-primary mt-0.5">
                                        {selectedEmployee.designation} · <span className="text-neutral-500 font-normal">{selectedEmployee.department}</span>
                                    </p>
                                    <p className="text-[11px] text-neutral-400 mt-0.5">
                                        Joined {selectedEmployee.joiningDate} · Reports to {selectedEmployee.reportingManagerName || "Aarav Mehta"}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right sm:border-l sm:border-neutral-200 sm:pl-4">
                                <p className="text-[10px] uppercase font-bold text-neutral-400">Net Compensation</p>
                                <p className="text-base font-extrabold text-neutral-900 mt-0.5">
                                    {selectedEmployee.salary ? inr(selectedEmployee.salary.netMonthly) : "—"}<span className="text-xs font-normal text-neutral-500">/mo</span>
                                </p>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex items-center gap-1 border-b border-neutral-200 overflow-x-auto pb-1 text-xs font-bold no-scrollbar">
                            {[
                                { id: "overview", label: "Overview" },
                                { id: "personal", label: "Personal Info" },
                                { id: "payroll", label: "Salary & Pay" },
                                { id: "attendance", label: "Attendance" },
                                { id: "performance", label: "Performance" },
                                { id: "assets", label: "Assigned Assets" },
                                { id: "docs", label: "Documents" },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                                        activeTab === tab.id
                                            ? "bg-primary text-white shadow-xs"
                                            : "text-neutral-500 hover:bg-neutral-100"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Contents */}
                        {activeTab === "overview" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 space-y-2">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Contact Channels</p>
                                    <p className="flex items-center gap-2 text-neutral-700"><Mail size={14} className="text-neutral-400" /> {selectedEmployee.email}</p>
                                    <p className="flex items-center gap-2 text-neutral-700"><Phone size={14} className="text-neutral-400" /> {selectedEmployee.phone}</p>
                                    <p className="flex items-center gap-2 text-neutral-700"><MapPin size={14} className="text-neutral-400" /> {selectedEmployee.location || "Mumbai, India"}</p>
                                </div>

                                <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 space-y-2">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Employment Metadata</p>
                                    <p><strong className="text-neutral-500">Employee ID:</strong> {selectedEmployee.employeeId}</p>
                                    <p><strong className="text-neutral-500">Employment Type:</strong> {selectedEmployee.employmentType?.replace("_", " ")}</p>
                                    <p><strong className="text-neutral-500">Department:</strong> {selectedEmployee.department}</p>
                                    <p><strong className="text-neutral-500">Reporting Manager:</strong> {selectedEmployee.reportingManagerName || "Aarav Mehta"}</p>
                                </div>
                            </div>
                        )}

                        {activeTab === "personal" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 space-y-2">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Identity & Demographic</p>
                                    <p><strong className="text-neutral-500">Date of Birth:</strong> {selectedEmployee.personalDetails?.dob || "1994-05-18"}</p>
                                    <p><strong className="text-neutral-500">Gender:</strong> {selectedEmployee.gender || "Prefer not to say"}</p>
                                    <p><strong className="text-neutral-500">Marital Status:</strong> {selectedEmployee.personalDetails?.maritalStatus || "Single"}</p>
                                    <p><strong className="text-neutral-500">Blood Group:</strong> {selectedEmployee.personalDetails?.bloodGroup || "O+"}</p>
                                </div>

                                <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 space-y-2">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">Bank & Statutory Accounts</p>
                                    <p><strong className="text-neutral-500">Bank Name:</strong> {selectedEmployee.bankDetails?.bankName || "HDFC Bank"}</p>
                                    <p><strong className="text-neutral-500">Account Number:</strong> {selectedEmployee.bankDetails?.accountNumber || "XXXX8892"}</p>
                                    <p><strong className="text-neutral-500">IFSC Code:</strong> {selectedEmployee.bankDetails?.ifscCode || "HDFC0001234"}</p>
                                </div>
                            </div>
                        )}

                        {activeTab === "payroll" && selectedEmployee.salary && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase">Basic Salary</p>
                                        <p className="text-base font-bold text-neutral-900 mt-1">{inr(selectedEmployee.salary.basic)}</p>
                                    </div>
                                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase">HRA</p>
                                        <p className="text-base font-bold text-neutral-900 mt-1">{inr(selectedEmployee.salary.hra)}</p>
                                    </div>
                                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase">Allowances</p>
                                        <p className="text-base font-bold text-neutral-900 mt-1">{inr(selectedEmployee.salary.allowances)}</p>
                                    </div>
                                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <p className="text-[10px] text-emerald-600 font-bold uppercase">Net Monthly</p>
                                        <p className="text-base font-bold text-emerald-800 mt-1">{inr(selectedEmployee.salary.netMonthly)}</p>
                                    </div>
                                </div>

                                <p className="text-xs text-neutral-500">
                                    Annual Cost to Company (CTC): <strong>{inr(selectedEmployee.salary.annualCtc)}</strong> / year
                                </p>
                            </div>
                        )}

                        {activeTab === "attendance" && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-neutral-600">Recent Attendance Logs</p>
                                <div className="max-h-48 overflow-y-auto divide-y divide-neutral-100 border border-neutral-100 rounded-xl">
                                    {selectedEmployee.attendanceHistory?.length === 0 ? (
                                        <p className="p-4 text-xs text-neutral-400 text-center">No attendance recorded yet</p>
                                    ) : (
                                        selectedEmployee.attendanceHistory?.map((a: any) => (
                                            <div key={a.id} className="p-2.5 flex items-center justify-between text-xs">
                                                <span className="font-mono text-neutral-600">{a.date}</span>
                                                <Badge value={a.status} />
                                                <span className="text-[11px] text-neutral-400">
                                                    {a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                                                    {" - "}
                                                    {a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === "assets" && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-neutral-600">Company Hardware & Assets</p>
                                {selectedEmployee.assignedAssets?.length === 0 ? (
                                    <p className="p-4 text-xs text-neutral-400 text-center bg-neutral-50 rounded-xl">No assets currently assigned</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {selectedEmployee.assignedAssets?.map((ast: any) => (
                                            <div key={ast.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center gap-3">
                                                <Laptop size={20} className="text-primary" />
                                                <div>
                                                    <p className="text-xs font-bold text-neutral-900">{ast.name}</p>
                                                    <p className="text-[10px] font-mono text-neutral-400">{ast.assetTag} · S/N: {ast.serialNumber}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "docs" && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-neutral-600">Employee Documents & Contracts</p>
                                {selectedEmployee.documents?.length === 0 ? (
                                    <p className="p-4 text-xs text-neutral-400 text-center bg-neutral-50 rounded-xl">No verified documents on file</p>
                                ) : (
                                    <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-xl">
                                        {selectedEmployee.documents?.map((doc: any) => (
                                            <div key={doc.id} className="p-3 flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2.5">
                                                    <FileText size={16} className="text-primary" />
                                                    <div>
                                                        <p className="font-bold text-neutral-900">{doc.title}</p>
                                                        <p className="text-[10px] text-neutral-400">{doc.category} · {doc.fileSize}</p>
                                                    </div>
                                                </div>
                                                <Badge value={doc.status} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </ModalShell>

            {/* Manual Add Employee Modal */}
            <ModalShell
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                title="Register New Employee"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        addEmployeeMutation.mutate(formData);
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-xs font-bold text-neutral-600 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                            placeholder="e.g. Rohini Gupta"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-neutral-600 mb-1">Work Email</label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                                placeholder="name@absojob.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-600 mb-1">Phone Number</label>
                            <input
                                type="tel"
                                required
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                                placeholder="+91 98000 00000"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-neutral-600 mb-1">Department</label>
                            <select
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                            >
                                {DEPARTMENTS.filter((d) => d !== "ALL").map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-600 mb-1">Designation</label>
                            <input
                                type="text"
                                required
                                value={formData.designation}
                                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                                placeholder="e.g. Senior Recruiter"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-neutral-600 mb-1">Joining Date</label>
                            <input
                                type="date"
                                required
                                value={formData.joiningDate}
                                onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-600 mb-1">Monthly Salary (INR)</label>
                            <input
                                type="number"
                                required
                                value={formData.salaryMonthly}
                                onChange={(e) => setFormData({ ...formData, salaryMonthly: Number(e.target.value) })}
                                className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                        <button
                            type="button"
                            onClick={() => setAddModalOpen(false)}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={addEmployeeMutation.isPending}
                            className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary-dark"
                        >
                            {addEmployeeMutation.isPending ? "Adding..." : "Register Employee"}
                        </button>
                    </div>
                </form>
            </ModalShell>
        </div>
    );
}
