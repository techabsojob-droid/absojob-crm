"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    ArrowLeft, Mail, Phone, MapPin, Building2, Briefcase, Award,
    CheckCircle2, Clock, Calendar, Shield, Users, Network, FileText,
    TrendingUp, CheckSquare, ShieldCheck, History, Edit3, Ban, RotateCcw,
    UserCheck, ChevronRight, AlertCircle, ExternalLink, Download, Layers,
    UserX, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { StatCard, Badge, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";
import { useAuth } from "@/lib/auth";
import { TempPasswordDialog, type IssuedLogin } from "@/components/shared/TempPasswordDialog";
import { KeyRound } from "lucide-react";

export default function Employee360ProfilePage({
    params,
}: {
    params: Promise<{ memberId: string }>;
}) {
    const resolvedParams = use(params);
    const memberId = resolvedParams.memberId;
    const qc = useQueryClient();

    const [activeTab, setActiveTab] = useState<
        "overview" | "employment" | "organization" | "recruitment" | "performance" | "attendance" | "promotions" | "compensation" | "tasks" | "documents" | "permissions" | "timeline" | "audit"
    >("overview");

    const [editRoleModal, setEditRoleModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState("");
    const [selectedDept, setSelectedDept] = useState("");

    const { data, isLoading, error } = useQuery<{
        user: any;
        reporting: {
            primaryManager: any;
            secondaryManager: any;
            directReports: any[];
        };
        metrics: any;
        jobs: any[];
        candidates: any[];
        interviews: any[];
        placements: any[];
        tasks: any[];
        auditLogs: any[];
        attendance?: any[];
        leaves?: any[];
        promotions?: any[];
        compensation?: any;
        pipeline?: any;
    }>({
        queryKey: ["employee-360", memberId],
        queryFn: async () => {
            const res = await fetch(`/api/admin/users/${memberId}`);
            if (!res.ok) throw new Error("Failed to load employee profile");
            return res.json();
        },
    });

    const { user: viewer } = useAuth();
    const canResetPassword = viewer?.role === "SUPER_ADMIN" || viewer?.role === "HR_ADMIN";
    const [issued, setIssued] = useState<IssuedLogin | null>(null);
    const resetPasswordMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: memberId, resetPassword: true }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error ?? "Could not reset the password");
            return d;
        },
        onSuccess: (d) => setIssued({ name: d.name, email: d.email, password: d.tempPassword }),
        onError: (e: Error) => toast.error(e.message),
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ status, role, department }: { status?: string; role?: string; department?: string }) => {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: memberId,
                    ...(status && { status }),
                    ...(role && { role }),
                    ...(department && { department }),
                }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error ?? "Failed to update member");
            return d;
        },
        onSuccess: () => {
            toast.success("Employee details updated successfully");
            qc.invalidateQueries({ queryKey: ["employee-360", memberId] });
            qc.invalidateQueries({ queryKey: ["team"] });
            setEditRoleModal(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update employee");
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-44 bg-white border border-gray-200 rounded-2xl p-6 flex gap-6 items-center animate-pulse">
                    <div className="w-20 h-20 rounded-full bg-gray-200" />
                    <div className="space-y-3 flex-1">
                        <div className="h-6 w-48 bg-gray-200 rounded" />
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 bg-white border border-gray-200 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !data?.user) {
        return (
            <div className="max-w-4xl mx-auto py-12">
                <SectionCard>
                    <EmptyState
                        icon={UserX}
                        message="Employee profile not found or does not belong to your organization."
                    />
                    <div className="text-center mt-4">
                        <Link
                            href="/admin/team"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Return to Team Directory
                        </Link>
                    </div>
                </SectionCard>
            </div>
        );
    }

    const { user, reporting, metrics, jobs, candidates, interviews, placements, tasks, auditLogs } = data;
    const pipeline = data.pipeline ?? {};
    const comp = data.compensation;

    // 360° timeline from real records, newest first
    const when = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
    const timeline = [
        ...(data.attendance ?? []).filter((a: any) => a.checkIn).slice(-3).map((a: any) => ({
            at: a.checkIn.length > 10 ? a.checkIn : a.date, badge: "ATTENDANCE", badgeTone: "bg-emerald-50 text-emerald-800 border-emerald-200",
            title: a.status === "LATE" ? "Checked in late" : "Checked in", desc: `${a.mode === "WFH" ? "Working from home" : "Office"} · ${a.date}`, icon: Clock,
        })),
        ...candidates.map((c: any) => ({
            at: c.updatedAt || c.createdAt, badge: "RECRUITMENT", badgeTone: "bg-blue-50 text-blue-700 border-blue-200",
            title: `${c.candidateName} at ${String(c.stage).replaceAll("_", " ").toLowerCase()}`, desc: `${c.jobTitle} · ${c.clientName}${c.fitScore != null ? ` · fit ${c.fitScore}%` : ""}`, icon: TrendingUp,
        })),
        ...tasks.filter((t: any) => t.completed && t.completedAt).map((t: any) => ({
            at: t.completedAt, badge: "TASK", badgeTone: "bg-purple-50 text-purple-700 border-purple-200",
            title: `Completed ${t.key ? `${t.key}: ` : ""}${t.title}`, desc: t.description || "Task marked done", icon: CheckSquare,
        })),
        ...placements.map((pl: any) => ({
            at: pl.placementDate || pl.joiningDate, badge: "PLACEMENT", badgeTone: "bg-amber-50 text-amber-800 border-amber-200",
            title: `Placed ${pl.candidateName} at ${pl.clientName}`, desc: `${pl.jobTitle} · ₹${(pl.revenueInr ?? 0).toLocaleString("en-IN")} billed`, icon: Award,
        })),
        ...(data.promotions ?? []).filter((p: any) => p.fromRole !== "—").map((p: any) => ({
            at: new Date(p.date).toISOString(), badge: "PROMOTION", badgeTone: "bg-emerald-50 text-emerald-800 border-emerald-200",
            title: `${p.fromRole} → ${p.toRole}`, desc: `${p.reason} · approved by ${p.approvedBy}`, icon: Award,
        })),
        ...(user.joiningDate ? [{
            at: user.joiningDate, badge: "ONBOARDING", badgeTone: "bg-gray-100 text-gray-800 border-gray-200",
            title: "Joined the organisation", desc: user.reportingToName ? `Reporting to ${user.reportingToName}` : "", icon: Briefcase,
        }] : []),
        ...auditLogs.slice(0, 10).map((a: any) => ({
            at: a.createdAt, badge: "AUDIT", badgeTone: "bg-neutral-50 text-neutral-700 border-neutral-200",
            title: String(a.action).replaceAll("_", " ").toLowerCase().replace(/^./, (c: string) => c.toUpperCase()), desc: a.detail, icon: History,
        })),
    ]
        .filter((e) => e.at && !Number.isNaN(when(e.at).getTime()))
        .sort((a, b) => when(b.at).getTime() - when(a.at).getTime())
        .slice(0, 30)
        .map((e) => ({ ...e, date: when(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: e.at.length > 10 ? "2-digit" : undefined, minute: e.at.length > 10 ? "2-digit" : undefined }) }));

    const tenure = (() => {
        if (!user.joiningDate) return "—";
        const months = Math.max(0, Math.floor((Date.now() - when(user.joiningDate).getTime()) / (30.44 * 86400000)));
        const y = Math.floor(months / 12), m = months % 12;
        return [y ? `${y} Year${y > 1 ? "s" : ""}` : "", m || !y ? `${m} Month${m === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
    })();
    const isSuspended = user.status === "SUSPENDED" || user.status === "Archived";

    const tabs: Array<{
        id: "overview" | "employment" | "organization" | "recruitment" | "performance" | "attendance" | "promotions" | "compensation" | "tasks" | "documents" | "permissions" | "timeline" | "audit";
        label: string;
        icon: any;
        badge?: number;
    }> = [
        { id: "overview", label: "Overview", icon: Layers },
        { id: "employment", label: "Employment & Identity", icon: Briefcase },
        { id: "organization", label: "Organization & Reporting", icon: Network, badge: (reporting.directReports?.length || 0) + (reporting.primaryManager ? 1 : 0) },
        { id: "recruitment", label: "Recruitment Activity", icon: TrendingUp, badge: jobs.length + candidates.length },
        { id: "performance", label: "Performance", icon: Award },
        { id: "attendance", label: "Attendance & Leaves", icon: Clock, badge: metrics.lateArrivalsCount ? metrics.lateArrivalsCount : undefined },
        { id: "promotions", label: "Role & Promotions", icon: TrendingUp, badge: data.promotions?.length ?? 0 },
        { id: "compensation", label: "Compensation", icon: DollarSign },
        { id: "tasks", label: "Tasks", icon: CheckSquare, badge: tasks.length },
        { id: "documents", label: "Documents", icon: FileText, badge: 3 },
        { id: "permissions", label: "Security & Access", icon: ShieldCheck },
        { id: "timeline", label: "360° Timeline", icon: History, badge: (jobs.length + candidates.length + (data.promotions?.length ?? 0) + 2) },
        { id: "audit", label: "Audit Log", icon: Shield, badge: auditLogs.length },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            <TempPasswordDialog login={issued} onClose={() => setIssued(null)} />
            {/* Top Breadcrumb & Return Link */}
            <div className="flex items-center justify-between">
                <Link
                    href="/admin/team"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 hover:text-emerald-700 bg-white border border-gray-300 hover:border-emerald-300 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                    <ArrowLeft className="w-4 h-4 text-emerald-700" />
                    Back to Team Directory
                </Link>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-700 font-mono">ID: {user.employeeId || user.id}</span>
                    <Badge value={user.status || "ACTIVE"} />
                </div>
            </div>

            {/* Employee 360 Header Profile Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full blur-3xl -z-0 opacity-70 pointer-events-none" />

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-start md:items-center gap-5">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-center font-bold text-2xl shadow-md border-2 border-white ring-2 ring-emerald-100">
                                {user.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span
                                className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
                                    isSuspended ? "bg-red-500" : "bg-emerald-700"
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            </span>
                        </div>

                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{user.name}</h1>
                                <Badge value={user.role} />
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-50 text-purple-700 border-purple-200">
                                    {user.department || "—"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-emerald-700" />
                                    {user.designation || "—"}
                                    <span className="text-gray-300">•</span>
                                    <span className="text-gray-700">{user.team || "—"}</span>
                                </p>
                                
                                {/* Prominent & Clickable Reports To Pill right in the Header */}
                                <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-xs">
                                    <Network className="w-3.5 h-3.5 text-emerald-700" />
                                    <span className="text-emerald-700 text-[11px] font-medium">Reports to:</span>
                                    {reporting.primaryManager?.id ? (
                                        <Link
                                            href={`/admin/team/${reporting.primaryManager.id}`}
                                            className="font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 flex items-center gap-0.5"
                                            title="Click to view manager's profile"
                                        >
                                            {reporting.primaryManager.name}
                                            <ExternalLink className="w-3 h-3 text-emerald-600 inline" />
                                        </Link>
                                    ) : user.reportingTo ? (
                                        <Link
                                            href={`/admin/team/${user.reportingTo}`}
                                            className="font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 flex items-center gap-0.5"
                                            title="Click to view manager's profile"
                                        >
                                            {user.reportingToName || "Reporting Manager"}
                                            <ExternalLink className="w-3 h-3 text-emerald-600 inline" />
                                        </Link>
                                    ) : (
                                        <span className="font-bold text-gray-600">Top-level / Leadership</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700 mt-3">
                                <span className="inline-flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-gray-700" />
                                    {user.workEmail || user.email}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-gray-700" />
                                    {user.workPhone || user.phone || "—"}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-gray-700" />
                                    {user.location || "—"} ({user.workMode || "—"})
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2.5 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0">
                        <button
                            onClick={() => {
                                setSelectedRole(user.role);
                                setSelectedDept(user.department || "Talent Acquisition");
                                setEditRoleModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:border-gray-400 px-3 py-2 rounded-xl transition-colors shadow-sm"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            Role & Dept
                        </button>

                        {canResetPassword && viewer?.id !== memberId && (
                            <button
                                onClick={() => { if (confirm(`Reset ${user.name}'s password? Their current password will stop working.`)) resetPasswordMutation.mutate(); }}
                                disabled={resetPasswordMutation.isPending}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:border-gray-400 px-3 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-60"
                            >
                                <KeyRound className="w-3.5 h-3.5" />
                                Reset password
                            </button>
                        )}

                        <button
                            onClick={() => {
                                updateStatusMutation.mutate({
                                    status: isSuspended ? "ACTIVE" : "SUSPENDED",
                                });
                            }}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors shadow-sm ${
                                isSuspended
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                            }`}
                        >
                            {isSuspended ? (
                                <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Restore Active Access
                                </>
                            ) : (
                                <>
                                    <Ban className="w-3.5 h-3.5" />
                                    Suspend Account
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Solid Line vs Dotted Line Manager Summary Strip */}
                <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                            S
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                <Network className="w-3 h-3" /> Solid-Line Manager (Direct)
                            </div>
                            <div className="text-xs font-bold text-gray-900 truncate">
                                {reporting.primaryManager?.id || user.reportingTo ? (
                                    <Link
                                        href={`/admin/team/${reporting.primaryManager?.id || user.reportingTo}`}
                                        className="hover:underline text-emerald-800 flex items-center gap-1"
                                        title="Click to view manager's profile"
                                    >
                                        {reporting.primaryManager?.name || user.reportingToName || "Manager"}
                                        <ExternalLink className="w-3 h-3 text-emerald-600 inline" />
                                    </Link>
                                ) : (
                                    user.reportingToName || "No manager"
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-purple-50/80 rounded-xl border border-purple-100">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                            D
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                                <Users className="w-3 h-3" /> Dotted-Line / Functional Manager
                            </div>
                            <div className="text-xs font-bold text-gray-900 truncate">
                                {reporting.secondaryManager?.id ? (
                                    <Link
                                        href={`/admin/team/${reporting.secondaryManager.id}`}
                                        className="hover:underline text-purple-700 flex items-center gap-1"
                                        title="Click to view functional manager's profile"
                                    >
                                        {reporting.secondaryManager.name}
                                        <ExternalLink className="w-3 h-3 text-purple-600 inline" />
                                    </Link>
                                ) : (
                                    user.secondaryManagerName || "None assigned"
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-blue-50/80 rounded-xl border border-blue-100">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            {reporting.directReports?.length || 0}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                Direct Reports
                            </div>
                            <div className="text-xs font-semibold text-gray-800 truncate">
                                {reporting.directReports?.length > 0
                                    ? `${reporting.directReports.length} team member(s) reporting`
                                    : "Individual Contributor"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick 360 KPIs Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <StatCard
                    label="Assigned Jobs"
                    value={metrics.assignedJobsCount || 0}
                    tone="blue"
                    icon={Briefcase}
                    hint="Active requisitions"
                />
                <StatCard
                    label="Active Pipeline"
                    value={metrics.assignedCandidatesCount || 0}
                    tone="purple"
                    icon={Users}
                    hint="Candidates in process"
                />
                <StatCard
                    label="Interviews Held"
                    value={metrics.interviewsCount || 0}
                    tone="amber"
                    icon={Calendar}
                    hint="Evaluations coordinated"
                />
                <StatCard
                    label="Total Placements"
                    value={metrics.placementsCount || 0}
                    tone="emerald"
                    icon={Award}
                    hint="Confirmed offers joined"
                />
                <StatCard
                    label="Pending Tasks"
                    value={metrics.pendingTasksCount || 0}
                    tone={metrics.pendingTasksCount > 3 ? "red" : "neutral"}
                    icon={CheckSquare}
                    hint="Action items open"
                />
                <StatCard
                    label="Placement Revenue"
                    value={`₹${((metrics.revenueGeneratedInr ?? 0) / 100000).toFixed(1)}L`}
                    tone="emerald"
                    icon={DollarSign}
                    hint="Agency billing generated"
                />
            </div>

            {/* Alert Center Bar (Section 48 & 57 of Master Spec) */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" /> Action Required
                    </span>
                    <span className="text-gray-700 font-medium">
                        {metrics.pendingTasksCount > 0 ? `${metrics.pendingTasksCount} pending tasks open` : "All assigned tasks up to date"} • 1 quarterly appraisal review scheduled • 2 documents verified
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab("tasks")}
                        className="font-bold text-amber-800 hover:text-amber-950 underline underline-offset-2 flex items-center gap-0.5"
                    >
                        View Tasks <ChevronRight className="w-3 h-3" />
                    </button>
                    <span className="text-amber-300">•</span>
                    <button
                        onClick={() => setActiveTab("timeline")}
                        className="font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 flex items-center gap-0.5"
                    >
                        Full Timeline <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* 360° Profile Sub-navigation Bar */}
            <div className="flex items-center gap-1.5 border-b border-gray-200 overflow-x-auto pb-1 scrollbar-none">
                {tabs.map((t) => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
                                isActive
                                    ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                                    : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
                            {t.label}
                            {t.badge !== undefined && (
                                <span
                                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                                    }`}
                                >
                                    {t.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* TAB CONTENTS */}

            {/* 1. OVERVIEW */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <SectionCard
                            title="Recruitment & Operational Summary"
                            subtitle="Real-time performance summary and active agency engagements."
                        >
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Conversion Ratio</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">{metrics.conversionRate ?? 0}%</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{pipeline.joined ?? 0} joined of {pipeline.applications ?? 0} profiles</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Avg Turnaround (TAT)</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">{pipeline.avgDaysToFirstInterview != null ? `${pipeline.avgDaysToFirstInterview} Days` : "—"}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Profile to first interview</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Offer Acceptance</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">{pipeline.offerAcceptancePct != null ? `${pipeline.offerAcceptancePct}%` : "—"}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{pipeline.offersAccepted ?? 0} of {pipeline.offersReleased ?? 0} offers accepted</p>
                                </div>
                            </div>

                            <div className="mt-6">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">
                                    Current High-Priority Assignments ({jobs.length})
                                </h3>
                                {jobs.length === 0 ? (
                                    <div className="p-4 bg-white border border-gray-200 rounded-xl text-center text-xs text-gray-500">
                                        No active job requisitions assigned to this recruiter.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {jobs.slice(0, 3).map((j: any) => (
                                            <div
                                                key={j.id}
                                                className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between hover:border-emerald-300 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 truncate">{j.title}</p>
                                                    <p className="text-[11px] text-gray-500">
                                                        {j.department || "General"} • {j.location || "—"} • {j.experienceMinYears ?? 0}+ yrs
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge value={j.status || "ACTIVE"} />
                                                    <Link
                                                        href={`/admin/jobs/${j.id}`}
                                                        className="text-gray-400 hover:text-emerald-600 p-1"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </SectionCard>

                        {/* Recent Tasks */}
                        <SectionCard
                            title="Recent Action Items & Deadlines"
                            subtitle="Outstanding recruiter follow-ups and candidate submissions."
                        >
                            {tasks.length === 0 ? (
                                <p className="text-xs text-gray-500">No open tasks assigned to this employee.</p>
                            ) : (
                                <div className="space-y-2">
                                    {tasks.slice(0, 4).map((t: any) => (
                                        <div
                                            key={t.id}
                                            className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between text-xs"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div
                                                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                        t.completed
                                                            ? "bg-emerald-600 border-emerald-600 text-white"
                                                            : "border-gray-300 bg-white"
                                                    }`}
                                                >
                                                    {t.completed && <CheckCircle2 className="w-3 h-3" />}
                                                </div>
                                                <span className={`font-medium ${t.completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                                                    {t.title}
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-gray-500">
                                                Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "This week"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* Right Rail: Identity & Shift Card */}
                    <div className="space-y-6">
                        <SectionCard title="Employment Details" subtitle="Official company record">
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Employee Code</span>
                                    <span className="font-mono font-bold text-gray-900">{user.employeeId || "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Department</span>
                                    <span className="font-semibold text-gray-900">{user.department}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Team / Squad</span>
                                    <span className="font-semibold text-gray-900">{user.team || "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Employment Type</span>
                                    <span className="font-semibold text-gray-900">{user.employmentType || "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Joining Date</span>
                                    <span className="font-semibold text-gray-900">
                                        {user.joiningDate ? new Date(user.joiningDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Jan 15, 2024"}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100 items-center">
                                    <span className="text-gray-500">Reports To (Manager)</span>
                                    {reporting.primaryManager?.id || user.reportingTo ? (
                                        <Link
                                            href={`/admin/team/${reporting.primaryManager?.id || user.reportingTo}`}
                                            className="font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 flex items-center gap-1"
                                            title="View manager profile"
                                        >
                                            {reporting.primaryManager?.name || user.reportingToName || "Manager"}
                                            <ExternalLink className="w-3 h-3 text-emerald-600 inline" />
                                        </Link>
                                    ) : (
                                        <span className="font-semibold text-gray-900">{user.reportingToName || "—"}</span>
                                    )}
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Shift Schedule</span>
                                    <span className="font-semibold text-gray-900">{user.shift || "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-gray-500">Work Mode</span>
                                    <span className="font-semibold text-gray-900">{user.workMode || "—"}</span>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Contact & Emergency" subtitle="Confidential directory data">
                            <div className="space-y-3 text-xs">
                                <div>
                                    <p className="text-[11px] text-gray-400">Work Email</p>
                                    <p className="font-medium text-gray-900 break-all">{user.workEmail || user.email}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-gray-400">Phone</p>
                                    <p className="font-medium text-gray-900">{user.workPhone || user.phone || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-gray-400">Emergency Contact</p>
                                    <p className="font-medium text-gray-900">{user.emergencyContact || "—"}</p>
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            )}

            {/* 2. EMPLOYMENT & IDENTITY */}
            {activeTab === "employment" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SectionCard title="Contract & Lifecycle" subtitle="Contractual terms and organizational placement">
                        <div className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-gray-400 text-[10px] uppercase font-bold">Employment Type</p>
                                    <p className="text-sm font-bold text-gray-900 mt-1">{user.employmentType || "—"}</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-gray-400 text-[10px] uppercase font-bold">Status</p>
                                    <p className="text-sm font-bold text-emerald-600 mt-1">{user.status || "ACTIVE"}</p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Official Designation</span>
                                    <span className="font-semibold text-gray-900">{user.designation || "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">System Role</span>
                                    <span className="font-mono text-gray-900">{user.role}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Joining Date</span>
                                    <span className="font-semibold text-gray-900">
                                        {user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : "Jan 15, 2024"}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Probation End Date</span>
                                    <span className="font-semibold text-gray-900">Confirmed (Apr 15, 2024)</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100 items-center">
                                    <span className="text-gray-500">Reports To (Primary)</span>
                                    {reporting.primaryManager?.id || user.reportingTo ? (
                                        <Link
                                            href={`/admin/team/${reporting.primaryManager?.id || user.reportingTo}`}
                                            className="font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 flex items-center gap-1"
                                            title="View manager profile"
                                        >
                                            {reporting.primaryManager?.name || user.reportingToName || "Manager"}
                                            <ExternalLink className="w-3 h-3 text-emerald-600 inline" />
                                        </Link>
                                    ) : (
                                        <span className="font-semibold text-gray-900">{user.reportingToName || "—"}</span>
                                    )}
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100 items-center">
                                    <span className="text-gray-500">Secondary / Functional Manager</span>
                                    {reporting.secondaryManager?.id ? (
                                        <Link
                                            href={`/admin/team/${reporting.secondaryManager.id}`}
                                            className="font-bold text-purple-700 hover:text-purple-900 underline underline-offset-2 flex items-center gap-1"
                                            title="View functional manager profile"
                                        >
                                            {reporting.secondaryManager.name}
                                            <ExternalLink className="w-3 h-3 text-purple-600 inline" />
                                        </Link>
                                    ) : (
                                        <span className="font-medium text-gray-700">{user.secondaryManagerName || "None assigned"}</span>
                                    )}
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Probation</span>
                                    <span className="font-semibold text-gray-900">{user.probationStatus ? `${user.probationStatus.replaceAll("_", " ").toLowerCase()}${user.probationEndDate ? ` · ends ${new Date(user.probationEndDate).toLocaleDateString("en-IN")}` : ""}` : "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-gray-500">Department</span>
                                    <span className="font-semibold text-gray-900">{user.department || "—"}</span>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Work Location & Work Mode" subtitle="Physical and remote arrangements">
                        <div className="space-y-4 text-xs">
                            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
                                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                                    <MapPin className="w-4 h-4 text-emerald-600" />
                                    Mumbai Headquarters
                                </div>
                                <p className="text-gray-600 text-xs mt-1">
                                    AbsoJob Global Hub, Level 8, Platina Tower, Bandra Kurla Complex (BKC), Mumbai, Maharashtra 400051.
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Work Policy</span>
                                    <span className="font-semibold text-gray-900">Hybrid (3 Days Office / 2 Days Remote)</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Shift Timing</span>
                                    <span className="font-semibold text-gray-900">{user.shift || "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-100">
                                    <span className="text-gray-500">Workstation ID</span>
                                    <span className="font-mono text-gray-900">WS-BKC-042</span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-gray-500">Access Keycard</span>
                                    <span className="font-mono text-gray-900">#HID-992014</span>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* 3. ORGANIZATION & REPORTING */}
            {activeTab === "organization" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Upward Reporting Lines */}
                        <SectionCard
                            title="Upward Reporting Hierarchy"
                            subtitle="Solid-line operational manager and dotted-line functional manager"
                        >
                            <div className="space-y-4">
                                {/* Solid Line */}
                                {reporting.primaryManager?.id || user.reportingTo ? (
                                    <Link
                                        href={`/admin/team/${reporting.primaryManager?.id || user.reportingTo}`}
                                        className="block p-4 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl border border-emerald-200 hover:border-emerald-300 transition-all shadow-xs group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                                <Network className="w-3.5 h-3.5" /> Primary / Solid-Line Manager
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-100/70 text-emerald-800 border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                                                View Profile <ChevronRight className="w-3 h-3" />
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                                                {(reporting.primaryManager?.name || user.reportingToName || "AM").slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 flex items-center gap-1">
                                                    {reporting.primaryManager?.name || user.reportingToName || "—"}
                                                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600" />
                                                </h4>
                                                <p className="text-xs text-gray-500">
                                                    {reporting.primaryManager?.designation || reporting.primaryManager?.role || "—"}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-emerald-100">
                                            Responsible for daily approvals, leave sign-offs, KPI appraisals, and compensation reviews.
                                        </p>
                                    </Link>
                                ) : (
                                    <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                                <Network className="w-3.5 h-3.5" /> Primary / Solid-Line Manager
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                                                Leadership Tier
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                                                AM
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900">Organization Top Level</h4>
                                                <p className="text-xs text-gray-500">Reports to Board of Directors</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Dotted Line */}
                                {reporting.secondaryManager?.id ? (
                                    <Link
                                        href={`/admin/team/${reporting.secondaryManager.id}`}
                                        className="block p-4 bg-purple-50/50 hover:bg-purple-50 rounded-xl border border-purple-200 hover:border-purple-300 transition-all shadow-xs group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5" /> Secondary / Dotted-Line Functional Manager
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-100/70 text-purple-700 border-purple-300 group-hover:bg-purple-200 transition-colors">
                                                View Profile <ChevronRight className="w-3 h-3" />
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                                                {(reporting.secondaryManager?.name || "AM").slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 group-hover:text-purple-700 flex items-center gap-1">
                                                    {reporting.secondaryManager?.name || "—"}
                                                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-purple-600" />
                                                </h4>
                                                <p className="text-xs text-gray-500">
                                                    {reporting.secondaryManager?.designation || "—"}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-purple-100">
                                            Guides client delivery strategy, quality audits, enterprise hiring best practices, and escalations.
                                        </p>
                                    </Link>
                                ) : (
                                    <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5" /> Secondary / Dotted-Line Functional Manager
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-50 text-purple-700 border-purple-200">
                                                Functional / Matrix
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                                                {(user.secondaryManagerName || "AM").slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900">
                                                    {user.secondaryManagerName || "None assigned"}
                                                </h4>
                                                <p className="text-xs text-gray-500">Functional Head</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </SectionCard>

                        {/* Downward Direct Reports */}
                        <SectionCard
                            title={`Direct Reports (${reporting.directReports?.length || 0})`}
                            subtitle="Team members directly reporting to this employee"
                        >
                            {reporting.directReports?.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-xs font-semibold text-gray-700">No Direct Reports</p>
                                    <p className="text-[11px] text-gray-500 max-w-xs mx-auto mt-1">
                                        This employee is configured as an individual contributor. Any recruiters added under them will display here.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {reporting.directReports.map((dr: any) => (
                                        <div
                                            key={dr.id}
                                            className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between hover:border-emerald-300 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                                    {dr.name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900">{dr.name}</p>
                                                    <p className="text-[11px] text-gray-500">{dr.designation || dr.role}</p>
                                                </div>
                                            </div>
                                            <Link
                                                href={`/admin/team/${dr.id}`}
                                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                                            >
                                                View 360° <ChevronRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* Department and Team Affiliations */}
                    <SectionCard title="Department & Squad Membership" subtitle="Cross-functional alignment">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Department</span>
                                <p className="text-sm font-bold text-gray-900 mt-1">{user.department}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">Talent Acquisition Division</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Primary Squad</span>
                                <p className="text-sm font-bold text-gray-900 mt-1">{user.team || "—"}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">Product & Engineering Accounts</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Matrix Focus</span>
                                <p className="text-sm font-bold text-gray-900 mt-1">Full-Stack & Cloud Hiring</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">High-velocity delivery</p>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* 4. RECRUITMENT ACTIVITY */}
            {activeTab === "recruitment" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                            <p className="text-xs font-semibold text-gray-500">Pipeline Candidates</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{candidates.length}</p>
                            <p className="text-xs text-emerald-600 mt-1">Across {jobs.length} active jobs</p>
                        </div>
                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                            <p className="text-xs font-semibold text-gray-500">Scheduled Interviews</p>
                            <p className="text-2xl font-bold text-purple-700 mt-1">{interviews.length}</p>
                            <p className="text-xs text-gray-500 mt-1">Technical & Client rounds</p>
                        </div>
                        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                            <p className="text-xs font-semibold text-gray-500">Joined / Placements</p>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">{placements.length}</p>
                            <p className="text-xs text-gray-500 mt-1">100% onboarding compliance</p>
                        </div>
                    </div>

                    <SectionCard title="Active Candidate Pipeline" subtitle="Candidates currently handled by this team member">
                        {candidates.length === 0 ? (
                            <p className="text-xs text-gray-500">No candidates in pipeline.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                                        <tr>
                                            <th className="py-2.5 px-4">Candidate</th>
                                            <th className="py-2.5 px-4">Job Title</th>
                                            <th className="py-2.5 px-4">Current Stage</th>
                                            <th className="py-2.5 px-4">Match Score</th>
                                            <th className="py-2.5 px-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {candidates.map((c: any) => (
                                            <tr key={c.id} className="hover:bg-gray-50">
                                                <td className="py-3 px-4 font-bold text-gray-900">
                                                    {c.candidateName || "Candidate"}
                                                </td>
                                                <td className="py-3 px-4 text-gray-600">{c.jobTitle || "Role"}</td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                                                        {c.stage || "INTERVIEW"}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-semibold text-emerald-600">{c.fitScore ?? "—"}%</span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <Link
                                                        href={`/admin/candidates/${c.candidateId || c.id}`}
                                                        className="text-xs font-semibold text-emerald-600 hover:underline"
                                                    >
                                                        Profile →
                                                    </Link>
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

            {/* 5. PERFORMANCE & SOURCING */}
            {activeTab === "performance" && (
                <div className="space-y-6">
                    <SectionCard title="Key Recruitment KPIs" subtitle="Computed from this recruiter's pipeline">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: "Profiles Worked", value: pipeline.applications ?? 0, note: `${pipeline.offersReleased ?? 0} reached offer`, tone: "text-gray-900" },
                                { label: "Screening Pass Rate", value: pipeline.screeningPassPct != null ? `${pipeline.screeningPassPct}%` : "—", note: "moved past screening", tone: "text-blue-600" },
                                { label: "Interview → Offer", value: pipeline.interviewToOfferPct != null ? `${pipeline.interviewToOfferPct}%` : "—", note: pipeline.avgDaysToOffer != null ? `${pipeline.avgDaysToOffer} days to offer on average` : "no offers yet", tone: "text-purple-600" },
                                { label: "Billing Contribution", value: `₹${((metrics.billingContributionInr ?? 0) / 100000).toFixed(1)}L`, note: metrics.billingPeriod ?? "", tone: "text-emerald-600" },
                            ].map((k) => (
                                <div key={k.label} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase">{k.label}</p>
                                    <p className={`text-2xl font-bold mt-1 ${k.tone}`}>{k.value}</p>
                                    <span className="text-[10px] text-gray-500">{k.note}</span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard title="Sourcing Channel Breakdown" subtitle="Where this recruiter's candidates came from">
                        <div className="space-y-3">
                            {(pipeline.sourcing ?? []).length === 0 && <p className="text-xs text-gray-400">No candidates in this recruiter's pipeline yet.</p>}
                            {(pipeline.sourcing ?? []).map((row: { source: string; count: number; pct: number }, i: number) => (
                                <div key={row.source}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-semibold text-gray-700">{row.source.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</span>
                                        <span className="text-gray-500">{row.pct}% · {row.count}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${["bg-blue-600", "bg-emerald-600", "bg-purple-600", "bg-amber-500", "bg-rose-500"][i % 5]}`} style={{ width: `${row.pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* 6. ATTENDANCE & LEAVES (Clean & Simple UI) */}
            {activeTab === "attendance" && (
                <div className="space-y-6">
                    {/* Top KPI Cards for Attendance */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <p className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">Attendance Rate</p>
                            <p className="text-2xl font-extrabold text-emerald-700 mt-1">{metrics.attendanceRate != null ? `${metrics.attendanceRate}%` : "—"}</p>
                            <span className="text-[10px] text-emerald-600 font-semibold">Past 30 Days</span>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <p className="text-[10px] font-bold uppercase text-blue-800 tracking-wider">Present Days</p>
                            <p className="text-2xl font-extrabold text-blue-700 mt-1">{metrics.presentDays ?? 0}</p>
                            <span className="text-[10px] text-blue-600 font-medium">Office / Hybrid</span>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                            <p className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">Late Check-Ins</p>
                            <p className="text-2xl font-extrabold text-amber-700 mt-1">{metrics.lateArrivalsCount ?? 0}</p>
                            <span className="text-[10px] text-amber-600 font-medium">Avg delay: 14 min</span>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                            <p className="text-[10px] font-bold uppercase text-purple-800 tracking-wider">Approved Leaves</p>
                            <p className="text-2xl font-extrabold text-purple-700 mt-1">{metrics.leaveDays ?? 0}</p>
                            <span className="text-[10px] text-purple-600 font-medium">Casual / Sick</span>
                        </div>
                        <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                            <p className="text-[10px] font-bold uppercase text-red-800 tracking-wider">Absences</p>
                            <p className="text-2xl font-extrabold text-red-700 mt-1">{metrics.absentDays ?? 0}</p>
                            <span className="text-[10px] text-red-600 font-medium">Zero unexcused</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Attendance Log Table */}
                        <div className="lg:col-span-2">
                            <SectionCard title="Recent Attendance Log" subtitle="Last 30 days check-in and check-out stamps">
                                {!data.attendance || data.attendance.length === 0 ? (
                                    <p className="text-xs text-gray-500">No attendance records logged.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                                                <tr>
                                                    <th className="py-2.5 px-4">Date</th>
                                                    <th className="py-2.5 px-4">Check In</th>
                                                    <th className="py-2.5 px-4">Check Out</th>
                                                    <th className="py-2.5 px-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {data.attendance.slice(0, 10).map((att: any) => (
                                                    <tr key={att.id} className="hover:bg-gray-50">
                                                        <td className="py-2.5 px-4 font-medium text-gray-900">{att.date}</td>
                                                        <td className="py-2.5 px-4 font-mono text-gray-600">
                                                            {att.checkIn ? att.checkIn.split("T")[1]?.slice(0, 5) : "--:--"}
                                                        </td>
                                                        <td className="py-2.5 px-4 font-mono text-gray-600">
                                                            {att.checkOut ? att.checkOut.split("T")[1]?.slice(0, 5) : "--:--"}
                                                        </td>
                                                        <td className="py-2.5 px-4">
                                                            <Badge value={att.status} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </SectionCard>
                        </div>

                        {/* Leave Balance & Requests */}
                        <div className="space-y-6">
                            <SectionCard title="Leave Balance" subtitle="Annual allocation summary">
                                <div className="space-y-3 text-xs">
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="font-medium text-gray-700">Casual Leave (CL)</span>
                                        <span className="font-bold text-gray-900">8 / 12 Days remaining</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="font-medium text-gray-700">Sick Leave (SL)</span>
                                        <span className="font-bold text-gray-900">6 / 8 Days remaining</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="font-medium text-gray-700">Earned Leave (EL)</span>
                                        <span className="font-bold text-gray-900">14 Days accrued</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <span className="font-medium text-gray-700">Comp Off</span>
                                        <span className="font-bold text-gray-900">1 Day available</span>
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Recent Leave Requests" subtitle="Applied leaves and approver notes">
                                {!data.leaves || data.leaves.length === 0 ? (
                                    <p className="text-xs text-gray-500">No leave requests found.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {data.leaves.map((lv: any) => (
                                            <div key={lv.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-gray-900">{lv.leaveType} LEAVE</span>
                                                    <Badge value={lv.status} />
                                                </div>
                                                <p className="text-[11px] text-gray-500">{lv.fromDate} to {lv.toDate}</p>
                                                <p className="text-[11px] text-gray-700 mt-1 italic">&ldquo;{lv.reason}&rdquo;</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. ROLE & PROMOTIONS TIMELINE (Clean & Easy to Read) */}
            {activeTab === "promotions" && (
                <div className="space-y-6">
                    <SectionCard title="Career Progression & Role History" subtitle="Chronological milestones since joining the company">
                        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-200">
                            {(data.promotions ?? []).length === 0 && <p className="text-xs text-gray-400">No role changes recorded yet.</p>}
                            {(data.promotions ?? []).map((p: any, idx: number) => (
                                <div key={idx} className="relative">
                                    <span className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-200" />
                                    <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                                            <h4 className="text-sm font-bold text-gray-900">
                                                {p.fromRole} <span className="text-emerald-600">→ {p.toRole}</span>
                                            </h4>
                                            <span className="text-[11px] font-mono font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-200">
                                                Effective: {p.date}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1">{p.reason}</p>
                                        <p className="text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-100 flex items-center gap-1">
                                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Approved by: <span className="font-semibold text-gray-700">{p.approvedBy}</span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* 8. COMPENSATION & INCENTIVES (Secure & Clean) */}
            {activeTab === "compensation" && (
                <div className="space-y-6">
                    <SectionCard title="Compensation & Incentive Structure" subtitle="Restricted view for authorized leadership & HR">
                        {!comp ? (
                            <p className="text-sm text-gray-500 mb-6">Compensation is visible only to Super Admin, HR and the employee.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Annual CTC</p>
                                    <p className="text-2xl font-extrabold text-gray-900 mt-1">{comp.currentBaseInr ? `₹${comp.currentBaseInr.toLocaleString("en-IN")}` : "Not set"}</p>
                                    <span className="text-[10px] text-emerald-600 font-semibold">{comp.monthlyNetInr ? `Net monthly: ₹${comp.monthlyNetInr.toLocaleString("en-IN")}` : "Add salary in HR › Employees"}</span>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Revisions</p>
                                    <p className="text-2xl font-extrabold text-purple-700 mt-1">{Math.max(0, (comp.history?.length ?? 0) - 1)}</p>
                                    <span className="text-[10px] text-purple-600 font-semibold">approved salary changes</span>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Billing Contribution</p>
                                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">₹{((metrics.billingContributionInr ?? 0) / 100000).toFixed(1)}L</p>
                                    <span className="text-[10px] text-gray-500 font-medium">placements in {metrics.billingPeriod ?? "this FY"}</span>
                                </div>
                            </div>
                        )}

                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">Revision & Appraisal History</h4>
                        <div className="space-y-2">
                            {(data.compensation?.history ?? []).length === 0 && <p className="text-xs text-gray-400">No revisions recorded.</p>}
                            {(data.compensation?.history ?? []).map((c: any, idx: number) => (
                                <div key={idx} className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between text-xs hover:border-emerald-300 transition-colors">
                                    <div>
                                        <p className="font-bold text-gray-900">{c.amount} — <span className="text-gray-600 font-normal">{c.type}</span></p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">Approved by: {c.approvedBy}</p>
                                    </div>
                                    <span className="font-mono text-gray-500 font-medium">{c.effectiveDate}</span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* 6. TASKS & WORKLOAD */}
            {activeTab === "tasks" && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-900">Assigned Tasks ({tasks.length})</h3>
                    </div>
                    {tasks.length === 0 ? (
                        <SectionCard>
                            <EmptyState
                                icon={CheckSquare}
                                message="This employee does not currently have any pending action items or tasks assigned."
                            />
                        </SectionCard>
                    ) : (
                        <div className="space-y-2">
                            {tasks.map((task: any) => (
                                <div
                                    key={task.id}
                                    className="p-4 bg-white border border-gray-200 rounded-xl flex items-center justify-between shadow-sm hover:border-emerald-300 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`w-5 h-5 mt-0.5 rounded border flex items-center justify-center ${
                                                task.completed
                                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                                    : "border-gray-300 bg-white"
                                            }`}
                                        >
                                            {task.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </div>
                                        <div>
                                            <h4 className={`text-xs font-bold ${task.completed ? "line-through text-gray-400" : "text-gray-900"}`}>
                                                {task.title}
                                            </h4>
                                            <p className="text-[11px] text-gray-500 mt-0.5">{task.description || "Recruitment action item"}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${task.completed ? "bg-neutral-100 text-neutral-600 border-neutral-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                            {task.completed ? "COMPLETED" : "PENDING"}
                                        </span>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "This week"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 7. DOCUMENTS */}
            {activeTab === "documents" && (
                <div className="space-y-4">
                    <SectionCard
                        title="Employee Document Repository"
                        subtitle="Verified onboarding documents, contracts, and identity proofs"
                    >
                        <div className="space-y-3">
                            {[
                                { name: "Signed_Offer_Letter_Employment_Agreement.pdf", size: "2.4 MB", date: "Jan 12, 2024", type: "Contract" },
                                { name: "Government_ID_Aadhaar_PAN_Verification.pdf", size: "1.1 MB", date: "Jan 12, 2024", type: "KYC / ID" },
                                { name: "Confidentiality_NDA_IP_Assignment_2024.pdf", size: "850 KB", date: "Jan 14, 2024", type: "Legal NDA" },
                            ].map((doc, idx) => (
                                <div
                                    key={idx}
                                    className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between hover:border-emerald-300 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-900">{doc.name}</p>
                                            <p className="text-[11px] text-gray-400">
                                                {doc.size} • Uploaded {doc.date} • <span className="text-emerald-700 font-semibold">{doc.type}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toast.success(`Downloading ${doc.name}`)}
                                        className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* 8. ACCESS & PERMISSIONS */}
            {activeTab === "permissions" && (
                <div className="space-y-6">
                    <SectionCard title="Assigned System Role & Permissions" subtitle="Enterprise role-based access control (RBAC)">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between mb-4">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">System Role</span>
                                <h4 className="text-base font-bold text-gray-900 mt-0.5">{user.role}</h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Access scope: <span className="font-semibold text-emerald-600">Assigned Records & Squad Requisitions</span>
                                </p>
                            </div>
                            <Badge value={user.role} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-3 border border-gray-200 rounded-xl">
                                <h5 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Candidate Management
                                </h5>
                                <ul className="space-y-1 text-gray-600 list-disc list-inside">
                                    <li>Create and import candidates</li>
                                    <li>Edit assigned candidates & resumes</li>
                                    <li>Schedule interviews and log notes</li>
                                </ul>
                            </div>

                            <div className="p-3 border border-gray-200 rounded-xl">
                                <h5 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Job Requisitions
                                </h5>
                                <ul className="space-y-1 text-gray-600 list-disc list-inside">
                                    <li>View assigned client openings</li>
                                    <li>Submit candidate shortlists</li>
                                    <li>Track candidate stage pipelines</li>
                                </ul>
                            </div>

                            <div className="p-3 border border-gray-200 rounded-xl">
                                <h5 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Placement & Offers
                                </h5>
                                <ul className="space-y-1 text-gray-600 list-disc list-inside">
                                    <li>Draft placement records</li>
                                    <li>Request offer approval from TA Manager</li>
                                </ul>
                            </div>

                            <div className="p-3 border border-gray-200 rounded-xl bg-gray-50/50">
                                <h5 className="font-bold text-gray-400 flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-4 h-4 text-gray-400" /> Restricted Access
                                </h5>
                                <ul className="space-y-1 text-gray-400 list-disc list-inside">
                                    <li>Organization-wide financial settings</li>
                                    <li>User invitation & privilege delegation</li>
                                </ul>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* 360° MASTER CHRONOLOGICAL TIMELINE (Section 42 & 43 of Spec) */}
            {activeTab === "timeline" && (
                <div className="space-y-6">
                    <SectionCard
                        title="360° Unified Organizational & Activity Timeline"
                        subtitle="Chronological stream of all employment events, recruitment actions, attendance logs, and approvals"
                    >
                        {/* Timeline Metrics summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-gray-400">Total Milestones</span>
                                <p className="text-xl font-bold text-gray-900 mt-0.5">
                                    {timeline.length} Events
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-gray-400">Career Tenure</span>
                                <p className="text-xl font-bold text-emerald-600 mt-0.5">
                                    {tenure}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-gray-400">Roles Held</span>
                                <p className="text-xl font-bold text-blue-600 mt-0.5">{Math.max(1, data.promotions?.length ?? 1)} Position(s)</p>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-gray-400">Audited Changes</span>
                                <p className="text-xl font-bold text-purple-600 mt-0.5">{auditLogs.length} Records</p>
                            </div>
                        </div>

                        {/* Interactive Timeline Events */}
                        <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                            {timeline.length === 0 && <p className="text-xs text-gray-400">No activity recorded yet.</p>}
                            {timeline.map((event, idx) => {
                                const EventIcon = event.icon;
                                return (
                                    <div key={idx} className="relative">
                                        <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-100" />
                                        <div className="p-3.5 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 transition-colors shadow-xs">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${event.badgeTone}`}>
                                                        {event.badge}
                                                    </span>
                                                    <h5 className="text-xs font-bold text-gray-900">{event.title}</h5>
                                                </div>
                                                <span className="text-[11px] font-mono text-gray-400">{event.date}</span>
                                            </div>
                                            <p className="text-xs text-gray-600 mt-1">{event.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* 9. AUDIT & HISTORY */}
            {activeTab === "audit" && (
                <div className="space-y-4">
                    <SectionCard title="Activity & Audit Logs" subtitle="Chronological record of status, role, and manager changes">
                        {auditLogs.length === 0 ? (
                            <p className="text-xs text-gray-500">No audit log entries recorded for this employee.</p>
                        ) : (
                            <div className="space-y-3">
                                {auditLogs.map((log: any) => (
                                    <div
                                        key={log.id}
                                        className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between text-xs"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs">
                                                <History className="w-4 h-4 text-gray-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{log.action || "Status Updated"}</p>
                                                <p className="text-[11px] text-gray-500">
                                                    By {log.actorName || "—"} • {log.details || "Administrative modification"}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-[11px] text-gray-400 font-mono">
                                            {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : "Recent"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* Edit Role & Department Modal */}
            <ModalShell
                open={editRoleModal}
                onClose={() => setEditRoleModal(false)}
                title="Change Role & Department"
            >
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Department</label>
                        <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="Talent Acquisition">Talent Acquisition</option>
                            <option value="Human Resources">Human Resources</option>
                            <option value="Sales & BD">Sales & BD</option>
                            <option value="Finance">Finance</option>
                            <option value="Operations">Operations</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">System Permission Role</label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="TA_RECRUITER">TA_RECRUITER (Recruiter)</option>
                            <option value="TA_MANAGER">TA_MANAGER (Team Lead / Manager)</option>
                            <option value="HR_ADMIN">HR_ADMIN (HR Administrator)</option>
                            <option value="SUPER_ADMIN">SUPER_ADMIN (Full Access)</option>
                            <option value="AGENT">AGENT (Field Partner)</option>
                            <option value="EMPLOYEE">EMPLOYEE (Standard Access)</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setEditRoleModal(false)}
                            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={updateStatusMutation.isPending}
                            onClick={() => {
                                updateStatusMutation.mutate({
                                    role: selectedRole,
                                    department: selectedDept,
                                });
                            }}
                            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            {updateStatusMutation.isPending ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </ModalShell>
        </div>
    );
}
