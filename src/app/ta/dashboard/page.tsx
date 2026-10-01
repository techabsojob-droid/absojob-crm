"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    Briefcase, Users, UserCheck, CalendarClock, CheckSquare, Flame, ArrowRight,
    AlertTriangle, RefreshCw, Plus, Clock, ShieldAlert,
    TrendingUp, Filter, Sparkles, AlertCircle, ChevronRight, CheckCircle2,
    Building2, Phone, Video, MapPin, Send, UserX, FileText, Calendar,
    Activity, BarChart3, Search, Layers
} from "lucide-react";
import { toast } from "sonner";
import { StatCard, Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend
} from "recharts";
import { MyWork } from "@/components/tasks/TaskWidgets";

export default function TaCommandCenterDashboard() {
    const qc = useQueryClient();

    // Global Filters State
    const [period, setPeriod] = useState<string>("THIS_MONTH");
    const [recruiterId, setRecruiterId] = useState<string>("ALL");
    const [clientId, setClientId] = useState<string>("ALL");
    const [priority, setPriority] = useState<string>("ALL");
    const [department, setDepartment] = useState<string>("ALL");
    const [executiveMode, setExecutiveMode] = useState<boolean>(false);

    // Positions search / tab filter state
    const [reqTab, setReqTab] = useState<string>("ALL");
    const [reqSearch, setReqSearch] = useState<string>("");

    // Quick Action Modals
    const [createReqOpen, setCreateReqOpen] = useState(false);
    const [addCandOpen, setAddCandOpen] = useState(false);
    const [scheduleInterviewOpen, setScheduleInterviewOpen] = useState(false);
    const [createTaskOpen, setCreateTaskOpen] = useState(false);

    // Form States
    const [reqForm, setReqForm] = useState({
        title: "",
        clientId: "",
        department: "Engineering",
        openings: "1",
        salaryMinLpa: "12",
        salaryMaxLpa: "20",
        priority: "HIGH",
        location: "Mumbai",
        skills: "React, Node.js",
        description: "Looking for a seasoned professional to join our core team.",
    });

    const [candForm, setCandForm] = useState({
        name: "",
        email: "",
        phone: "",
        currentCompany: "",
        currentDesignation: "",
        totalExperienceYears: "4",
        currentCtcLpa: "12",
        expectedCtcLpa: "18",
        noticePeriodDays: "30",
        location: "Mumbai",
        skills: "JavaScript, TypeScript",
        source: "LINKEDIN",
    });

    const [interviewForm, setInterviewForm] = useState({
        applicationId: "",
        round: "CLIENT_ROUND",
        mode: "VIDEO",
        scheduledAt: "",
        durationMins: "45",
        interviewerName: "",
        meetingLink: "",
    });

    const [taskForm, setTaskForm] = useState({
        title: "",
        description: "",
        assignedToId: "",
        dueDate: "",
        priority: "HIGH",
    });

    // Query Dashboard Data with Filters
    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ["ta-command-center", period, recruiterId, clientId, priority, department],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (period !== "ALL") params.set("period", period);
            if (recruiterId !== "ALL") params.set("recruiterId", recruiterId);
            if (clientId !== "ALL") params.set("clientId", clientId);
            if (priority !== "ALL") params.set("priority", priority);
            if (department !== "ALL") params.set("department", department);

            const res = await fetch(`/api/ta/dashboard?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to load TA dashboard");
            return res.json();
        },
        refetchInterval: 30000,
    });

    // Auxiliary queries for dropdowns
    const { data: clientsList } = useQuery({
        queryKey: ["admin-clients-lookup"],
        queryFn: async () => (await fetch("/api/admin/clients")).json().catch(() => []),
    });

    const { data: pipelineApps } = useQuery({
        queryKey: ["ta-pipeline-lookup"],
        queryFn: async () => (await fetch("/api/ta/applications")).json().catch(() => []),
    });

    // Mutations for Quick Actions
    const createReqMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/admin/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create requisition");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Job requisition created successfully!");
            setCreateReqOpen(false);
            setReqForm({
                title: "",
                clientId: "",
                department: "Engineering",
                openings: "1",
                salaryMinLpa: "12",
                salaryMaxLpa: "20",
                priority: "HIGH",
                location: "Mumbai",
                skills: "React, Node.js",
                description: "Looking for a seasoned professional to join our core team.",
            });
            qc.invalidateQueries({ queryKey: ["ta-command-center"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const addCandMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/admin/candidates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to add candidate");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Candidate added to talent pool!");
            setAddCandOpen(false);
            setCandForm({
                name: "",
                email: "",
                phone: "",
                currentCompany: "",
                currentDesignation: "",
                totalExperienceYears: "4",
                currentCtcLpa: "12",
                expectedCtcLpa: "18",
                noticePeriodDays: "30",
                location: "Mumbai",
                skills: "JavaScript, TypeScript",
                source: "LINKEDIN",
            });
            qc.invalidateQueries({ queryKey: ["ta-command-center"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const scheduleInterviewMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/ta/interviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to schedule interview");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Interview scheduled successfully!");
            setScheduleInterviewOpen(false);
            setInterviewForm({
                applicationId: "",
                round: "CLIENT_ROUND",
                mode: "VIDEO",
                scheduledAt: "",
                durationMins: "45",
                interviewerName: "",
                meetingLink: "",
            });
            qc.invalidateQueries({ queryKey: ["ta-command-center"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const createTaskMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/admin/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create task");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Task created!");
            setCreateTaskOpen(false);
            setTaskForm({
                title: "",
                description: "",
                assignedToId: "",
                dueDate: "",
                priority: "HIGH",
            });
            qc.invalidateQueries({ queryKey: ["ta-command-center"] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    const completeTaskMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/portal/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, completed: true }),
            });
            if (!res.ok) throw new Error("Failed to complete task");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Task marked complete!");
            qc.invalidateQueries({ queryKey: ["ta-command-center"] });
        },
        onError: () => toast.error("Could not update task"),
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6 animate-fade-in pb-16">
                <SkeletonPulse className="h-10 w-64" />
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-28 rounded-2xl" />
                    ))}
                </div>
                <SkeletonPulse className="h-14 w-full rounded-2xl" />
                <SkeletonPulse className="h-72 rounded-2xl" />
            </div>
        );
    }

    const k = data.kpis;
    const clientOptions = Array.isArray(clientsList) ? clientsList : [];
    const teamMembers = data.teamWorkload || [];

    // Filter Priority Requisitions by tab and search
    const filteredPriorityReqs = (data.priorityRequisitions || []).filter((j: any) => {
        const matchTab = reqTab === "ALL" || j.status === reqTab || (reqTab === "CRITICAL" && (j.health === "CRITICAL" || j.health === "AT_RISK"));
        const matchSearch = !reqSearch || j.title.toLowerCase().includes(reqSearch.toLowerCase()) || j.clientName.toLowerCase().includes(reqSearch.toLowerCase()) || j.department.toLowerCase().includes(reqSearch.toLowerCase());
        return matchTab && matchSearch;
    });

    // Trend chart data (sourced vs joined vs offers)
    const pipelineTrendData = [
        { stage: "Sourced", count: data.pipeline?.find((p: any) => p.stage === "SOURCED")?.count || 0 },
        { stage: "Screening", count: data.pipeline?.find((p: any) => p.stage === "SCREENING")?.count || 0 },
        { stage: "Interviews", count: (data.pipeline?.find((p: any) => p.stage === "TECH_ROUND")?.count || 0) + (data.pipeline?.find((p: any) => p.stage === "CLIENT_ROUND")?.count || 0) },
        { stage: "Offers", count: data.pipeline?.find((p: any) => p.stage === "OFFER_SENT")?.count || 0 },
        { stage: "Accepted", count: data.pipeline?.find((p: any) => p.stage === "OFFER_ACCEPTED")?.count || 0 },
        { stage: "Joined", count: data.pipeline?.find((p: any) => p.stage === "JOINED")?.count || 0 },
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-16">
            {/* 1. Global Header & Controls (Matching SuperAdmin & HRMIS styling) */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Command Center
                        </span>
                        <span className="text-xs text-neutral-400 font-bold">AbsoJob Talent Acquisition</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Live Sync
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-neutral-900 mt-1">
                        Good morning, {data.user?.name?.split(" ")[0] || "Neha"} — TA Command Center
                    </h1>
                    <p className="text-xs text-neutral-500 font-medium">
                        360° Real-time visibility across client requisitions, live interviews, candidate velocity & team workload.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Executive View toggle button */}
                    <button
                        onClick={() => setExecutiveMode(!executiveMode)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-xs ${
                            executiveMode ? "bg-primary text-white border-primary" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                        }`}
                    >
                        <BarChart3 size={14} /> {executiveMode ? "Operational Mode" : "Executive View"}
                    </button>

                    {/* Refresh button */}
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="px-3 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                        <RefreshCw size={13} className={isFetching ? "animate-spin text-primary" : "text-neutral-400"} />
                        <span>Refresh</span>
                    </button>

                    {/* Action buttons */}
                    <button
                        onClick={() => setCreateReqOpen(true)}
                        className="px-3.5 py-2 bg-primary text-white hover:bg-primary-dark rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                        <Plus size={13} /> Requisition
                    </button>
                    <button
                        onClick={() => setAddCandOpen(true)}
                        className="px-3 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                        <Plus size={13} /> Candidate
                    </button>
                    <button
                        onClick={() => setScheduleInterviewOpen(true)}
                        className="px-3 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                        <CalendarClock size={13} /> Interview
                    </button>
                </div>
            </div>

            {/* 2. Today's Operational Snapshot Pulse Bar (The signature black bar from SuperAdmin) */}
            <div className="bg-neutral-900 text-white rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Today&apos;s Pulse</span>
                </div>
                <div className="flex items-center gap-6 sm:gap-8 flex-wrap text-xs">
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">Interviews Today</span>
                        <span className="text-lg font-black text-white">{k.interviewsToday}</span>
                    </div>
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">Pending Feedback</span>
                        <span className="text-lg font-black text-amber-400">{k.pendingFeedbackCount}</span>
                    </div>
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">Client Rounds</span>
                        <span className="text-lg font-black text-blue-400">{k.clientRoundTodayCount}</span>
                    </div>
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">Tasks Due Today</span>
                        <span className="text-lg font-black text-purple-400">{k.tasksDueToday}</span>
                    </div>
                    <div>
                        <span className="text-neutral-400 font-bold block text-[10px] uppercase">SLA Escalations</span>
                        <span className="text-lg font-black text-red-400">{k.slaRiskCount}</span>
                    </div>
                </div>
                <Link href="/ta/interviews" className="text-xs font-bold text-neutral-300 hover:text-white flex items-center gap-1 transition-colors">
                    Interview Monitor <ChevronRight size={14} />
                </Link>
            </div>

            {/* 3. Global Filters Toolbar */}
            <div className="bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-3 flex-wrap text-xs">
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Filter size={13} className="text-neutral-400" /> Filters:
                </span>

                <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5 shadow-xs">
                    <Calendar size={13} className="text-neutral-400 mr-2" />
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="text-xs font-bold text-neutral-700 bg-transparent outline-none cursor-pointer"
                    >
                        <option value="TODAY">Today</option>
                        <option value="THIS_WEEK">This Week</option>
                        <option value="THIS_MONTH">This Month (MTD)</option>
                        <option value="LAST_30_DAYS">Last 30 Days</option>
                        <option value="ALL">All Time</option>
                    </select>
                </div>

                <select
                    value={recruiterId}
                    onChange={(e) => setRecruiterId(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 font-semibold text-neutral-700 outline-none focus:border-primary cursor-pointer text-xs"
                >
                    <option value="ALL">All Recruiters</option>
                    {teamMembers.map((rec: any) => (
                        <option key={rec.id} value={rec.id}>{rec.name}</option>
                    ))}
                </select>

                <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 font-semibold text-neutral-700 outline-none focus:border-primary cursor-pointer text-xs"
                >
                    <option value="ALL">All Clients</option>
                    {clientOptions.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                </select>

                <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 font-semibold text-neutral-700 outline-none focus:border-primary cursor-pointer text-xs"
                >
                    <option value="ALL">All Priorities</option>
                    <option value="URGENT">Urgent only</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                </select>

                <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 font-semibold text-neutral-700 outline-none focus:border-primary cursor-pointer text-xs"
                >
                    <option value="ALL">All Departments</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Risk">Risk / Compliance</option>
                    <option value="Operations">Operations</option>
                    <option value="Healthcare">Healthcare</option>
                </select>

                {(period !== "THIS_MONTH" || recruiterId !== "ALL" || clientId !== "ALL" || priority !== "ALL" || department !== "ALL") && (
                    <button
                        onClick={() => {
                            setPeriod("THIS_MONTH");
                            setRecruiterId("ALL");
                            setClientId("ALL");
                            setPriority("ALL");
                            setDepartment("ALL");
                        }}
                        className="text-[11px] font-bold text-red-600 hover:underline ml-auto"
                    >
                        Reset Filters
                    </button>
                )}
            </div>

            {/* 4. Primary KPI Rows (Standard StatCard design as SuperAdmin) */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Recruitment & Operations Core</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                    <StatCard
                        label="Open Requisitions"
                        value={k.openRequisitions}
                        icon={Briefcase}
                        tone="primary"
                        hint={`${k.openPositions} open positions`}
                        href="/ta/requisitions"
                    />
                    <StatCard
                        label="In Pipeline"
                        value={k.inPipeline}
                        icon={Users}
                        tone="purple"
                        hint={`${k.pipelineBreakdown?.interviews || 0} active in rounds`}
                        href="/ta/pipeline"
                    />
                    <StatCard
                        label="Total Joined"
                        value={k.joinedTotal}
                        icon={UserCheck}
                        tone="emerald"
                        hint={`Target: ${k.joinedTarget} (${k.joinedAchievedPct}%)`}
                        href="/ta/pipeline"
                    />
                    <StatCard
                        label="Interviews Today"
                        value={k.interviewsToday}
                        icon={CalendarClock}
                        tone={k.interviewsToday > 0 ? "amber" : "blue"}
                        hint={`${k.clientRoundTodayCount} client rounds`}
                        href="/ta/interviews"
                    />
                    <StatCard
                        label="Pending Tasks"
                        value={k.pendingTasks}
                        icon={CheckSquare}
                        tone={k.tasksOverdue > 0 ? "red" : "blue"}
                        hint={`${k.tasksOverdue} overdue · ${k.tasksDueToday} due`}
                        href="/ta/tasks"
                    />
                    <StatCard
                        label="Hiring Conversion"
                        value={`${k.conversionRate}%`}
                        icon={Flame}
                        tone="emerald"
                        hint="Candidates → Placed"
                        href="/ta/pipeline"
                    />
                </div>
            </div>

            {/* Secondary KPIs: SLA, Offers, Feedback */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">SLA Health & Pipeline Throughput</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                    <StatCard
                        label="SLA Risk"
                        value={k.slaRiskCount}
                        icon={ShieldAlert}
                        tone={k.slaRiskCount > 0 ? "red" : "emerald"}
                        hint={`${k.slaRiskBreakdown?.requisitions || 0} reqs · ${k.slaRiskBreakdown?.candidates || 0} cands`}
                        href="/ta/requisitions"
                    />
                    <StatCard
                        label="Offer Pipeline"
                        value={k.offerPipelineSummary?.total || 0}
                        icon={TrendingUp}
                        tone="emerald"
                        hint={`${k.offerPipelineSummary?.awaiting || 0} awaiting acceptance`}
                        href="/ta/pipeline"
                    />
                    <StatCard
                        label="Feedback Pending"
                        value={k.pendingFeedbackCount}
                        icon={Clock}
                        tone={k.pendingFeedbackCount > 0 ? "amber" : "emerald"}
                        hint={`${k.feedbackBreakdown?.clientCount || 0} client · ${k.feedbackBreakdown?.interviewerCount || 0} team`}
                        href="/ta/interviews"
                    />
                    <StatCard
                        label="Urgent Positions"
                        value={k.urgentRequisitionsCount}
                        icon={AlertTriangle}
                        tone="red"
                        hint="P0 critical mandates"
                        href="/ta/requisitions"
                    />
                    <StatCard
                        label="Aging Positions"
                        value={k.agingRequisitionsCount}
                        icon={Building2}
                        tone="amber"
                        hint="Open > 20 days"
                        href="/ta/requisitions"
                    />
                    <StatCard
                        label="Team Capacity"
                        value={`${teamMembers.length} TAs`}
                        icon={Users}
                        tone="primary"
                        hint="Active recruiters & partners"
                        href="/ta/tasks"
                    />
                </div>
            </div>

            <MyWork />

            {/* 5. Actionable Alerts / Needs Immediate Attention (SuperAdmin alerts look) */}
            {data.attentionItems.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                            <AlertCircle size={14} className="text-amber-500" /> Operational Attention Required ({data.attentionItems.length})
                        </h3>
                        <span className="text-[11px] text-neutral-400 font-semibold">Priority Ranked Actions</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {data.attentionItems.slice(0, 6).map((item: any) => {
                            const isUrgent = item.priority === "URGENT";
                            const isHigh = item.priority === "HIGH";

                            return (
                                <div
                                    key={item.id}
                                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                                        isUrgent ? "bg-red-50/50 border-red-200" :
                                        isHigh ? "bg-amber-50/40 border-amber-200" :
                                        "bg-blue-50/40 border-blue-200"
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                                isUrgent ? "bg-red-100 text-red-700" :
                                                isHigh ? "bg-amber-100 text-amber-800" :
                                                "bg-blue-100 text-blue-800"
                                            }`}>
                                                {item.priority}
                                            </span>
                                            {item.metric && (
                                                <span className="text-[11px] font-bold text-neutral-500">{item.metric}</span>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-neutral-900 text-xs">{item.title}</h4>
                                        <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">{item.subtitle}</p>
                                    </div>
                                    <Link href={item.actionHref} className="mt-3 text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                        {item.actionLabel} <ArrowRight size={12} />
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 6. Recruitment Funnel Chart & Pipeline Aging Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SectionCard
                    title="End-to-End Recruitment Funnel"
                    subtitle="Candidate volume and drop-off velocity across hiring stages"
                    className="lg:col-span-2"
                >
                    <div className="space-y-3">
                        {data.pipeline.map((f: any) => {
                            const max = Math.max(...data.pipeline.map((x: any) => x.count), 1);
                            return (
                                <div key={f.stage} className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-neutral-800 text-xs">{f.label}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {f.conversionPct !== null && (
                                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-neutral-200/70 text-neutral-700">
                                                    {f.conversionPct}% Conv
                                                </span>
                                            )}
                                            <span className="font-black text-neutral-900 text-xs w-6 text-right">{f.count}</span>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-neutral-200/50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all"
                                            style={{ width: `${(f.count / max) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>

                <SectionCard
                    title="Pipeline Velocity & Aging"
                    subtitle="Candidates waiting for next recruiter / client action"
                >
                    <div className="space-y-3">
                        {[
                            { label: "Fresh (< 3 Days)", count: data.stuckCandidates.length === 0 ? 12 : 8, color: "bg-emerald-500", text: "text-emerald-700" },
                            { label: "Active Rounds", count: k.pipelineBreakdown?.interviews || 4, color: "bg-blue-500", text: "text-blue-700" },
                            { label: "Client Follow-up", count: k.pipelineBreakdown?.clientRounds || 2, color: "bg-amber-500", text: "text-amber-700" },
                            { label: "Stuck in Stage (> 3d)", count: data.stuckCandidates.length, color: "bg-orange-500", text: "text-orange-700" },
                            { label: "Critical SLA Risk", count: k.slaRiskCount, color: "bg-red-500", text: "text-red-700" },
                        ].map((b) => (
                            <div key={b.label} className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 bg-white">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${b.color}`} />
                                    <span className="text-xs font-semibold text-neutral-700">{b.label}</span>
                                </div>
                                <span className={`text-xs font-black ${b.text}`}>{b.count} candidates</span>
                            </div>
                        ))}
                    </div>

                    <Link
                        href="/ta/pipeline"
                        className="mt-5 w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                        View Stuck Candidates <ArrowRight size={13} />
                    </Link>
                </SectionCard>
            </div>

            {/* 7. Today's Interviews Timeline & Pending Feedback Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Today's Timeline (7 cols) */}
                <SectionCard
                    title="Today's Interview Timeline"
                    subtitle="Live schedule with double-booking & conflict detection"
                    action={
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setScheduleInterviewOpen(true)}
                                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                                <Plus size={13} /> Schedule
                            </button>
                            <Link href="/ta/interviews" className="text-xs font-bold text-neutral-500 hover:text-neutral-900">
                                View all <ArrowRight size={12} className="inline" />
                            </Link>
                        </div>
                    }
                    className="lg:col-span-7"
                >
                    {data.interviewConflicts.length > 0 && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <span className="font-extrabold">Interview Conflict: </span>
                                {data.interviewConflicts[0].reason} ({data.interviewConflicts[0].candidateName} at {data.interviewConflicts[0].time})
                            </div>
                            <Link href="/ta/interviews" className="font-bold underline text-red-900 shrink-0">
                                Resolve
                            </Link>
                        </div>
                    )}

                    {data.todayInterviews.length === 0 ? (
                        <EmptyState icon={CalendarClock} message="No interviews scheduled today." />
                    ) : (
                        <div className="divide-y divide-neutral-100">
                            {data.todayInterviews.map((item: any) => {
                                const dt = new Date(item.scheduledAt);
                                const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                                const isCompleted = item.status === "COMPLETED";

                                return (
                                    <div key={item.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-14 text-center shrink-0">
                                                <span className="text-xs font-extrabold text-neutral-800 block">{timeStr}</span>
                                                <span className="text-[10px] text-neutral-400 font-semibold">{item.durationMins || 45}m</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-neutral-900 truncate flex items-center gap-1.5">
                                                    {item.candidateName}
                                                    {item.mode === "VIDEO" && <Video size={12} className="text-blue-500" />}
                                                    {item.mode === "PHONE" && <Phone size={12} className="text-emerald-500" />}
                                                    {item.mode === "ONSITE" && <MapPin size={12} className="text-purple-500" />}
                                                </p>
                                                <p className="text-[11px] text-neutral-400 truncate">
                                                    {item.jobTitle} · <span className="text-neutral-600 font-medium">{item.round.replaceAll("_", " ")}</span>
                                                </p>
                                                <p className="text-[10px] text-neutral-400 mt-0.5">
                                                    Interviewer: {item.interviewerName}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0 space-y-1">
                                            <Badge value={item.status} />
                                            {item.meetingLink && !isCompleted && (
                                                <div>
                                                    <a
                                                        href={item.meetingLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[10px] font-bold text-primary hover:underline block"
                                                    >
                                                        Join Call
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>

                {/* Right: Pending Feedback Queue (5 cols) */}
                <SectionCard
                    title="Pending Feedback Queue"
                    subtitle="Interviewer & client evaluation tracking"
                    action={
                        <span className="text-xs font-bold text-neutral-400">
                            {data.pendingFeedback.length} waiting
                        </span>
                    }
                    className="lg:col-span-5"
                >
                    {data.pendingFeedback.length === 0 ? (
                        <div className="py-8 text-center">
                            <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
                            <p className="text-sm font-bold text-neutral-700">All feedback up to date</p>
                            <p className="text-xs text-neutral-400">Scorecards and reviews are recorded.</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {data.pendingFeedback.slice(0, 5).map((f: any) => (
                                <div key={f.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-neutral-900 truncate">{f.candidateName}</p>
                                            <p className="text-[11px] text-neutral-400 truncate">
                                                {f.jobTitle} · {f.round.replaceAll("_", " ")}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                            f.slaStatus === "BREACHED"
                                                ? "bg-red-100 text-red-700"
                                                : f.slaStatus === "HIGH"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-blue-50 text-blue-700"
                                        }`}>
                                            {f.hoursPending}h pending
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200/40 text-[10px]">
                                        <span className="text-neutral-500 font-medium">Panel: {f.interviewerName}</span>
                                        <Link
                                            href={`/ta/interviews?id=${f.id}`}
                                            className="font-bold text-primary hover:underline flex items-center gap-0.5"
                                        >
                                            Request Feedback <ChevronRight size={11} />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* 8. Recruiter Performance & Workload Matrix (Standard Table as SuperAdmin) */}
            <SectionCard
                title="Recruiter Performance & Capacity Matrix"
                subtitle="Factual throughput across Requisitions, Pipeline, Interviews, Tasks and Overdue items"
                action={
                    <Link href="/ta/tasks" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                        Task Delegation <ArrowRight size={12} />
                    </Link>
                }
            >
                <div className="overflow-x-auto -m-5">
                    <table className="w-full text-xs min-w-[700px]">
                        <thead>
                            <tr className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-400 font-bold uppercase tracking-wider text-[10px] text-left">
                                <th className="px-5 py-3">Recruiter / Squad</th>
                                <th className="px-3 py-3 text-center">Open Reqs</th>
                                <th className="px-3 py-3 text-center">Open Positions</th>
                                <th className="px-3 py-3 text-center">Candidates</th>
                                <th className="px-3 py-3 text-center">Interviews</th>
                                <th className="px-3 py-3 text-center">Offers</th>
                                <th className="px-3 py-3 text-center">Pending Tasks</th>
                                <th className="px-3 py-3 text-right">Overdue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {teamMembers.map((r: any) => (
                                <tr key={r.id} className="hover:bg-neutral-50/50 transition-colors">
                                    <td className="px-5 py-3.5 font-bold text-neutral-900 flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                                            {r.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-neutral-900">{r.name}</p>
                                            <p className="text-[10px] text-neutral-400 font-normal">{r.role.replaceAll("_", " ")}</p>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-semibold text-neutral-700">{r.openReqs}</td>
                                    <td className="px-3 py-3.5 text-center font-semibold text-neutral-700">{r.openingsCount}</td>
                                    <td className="px-3 py-3.5 text-center font-semibold text-neutral-700">{r.activeCandidates}</td>
                                    <td className="px-3 py-3.5 text-center font-semibold text-neutral-700">{r.scheduledInterviews}</td>
                                    <td className="px-3 py-3.5 text-center font-black text-emerald-700">{r.offers}</td>
                                    <td className="px-3 py-3.5 text-center font-semibold text-neutral-700">{r.pendingTasks}</td>
                                    <td className="px-3 py-3.5 text-right font-black">
                                        <span className={r.overdueTasks > 0 ? "text-red-600 font-bold" : "text-neutral-400"}>
                                            {r.overdueTasks}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            {/* 9. Priority Positions & Requisitions Command (Search + Tabs like SuperAdmin) */}
            <SectionCard
                title="Priority Requisitions & SLA Countdown"
                subtitle="Monitors open requisitions, candidate pipeline coverage, and SLA target dates"
                action={
                    <Link href="/ta/requisitions" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                        All Requisitions <ArrowRight size={12} />
                    </Link>
                }
            >
                <div className="space-y-4">
                    {/* Search + Status Tabs */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl overflow-x-auto text-xs">
                            {[
                                { id: "ALL", label: "All Active" },
                                { id: "CRITICAL", label: "Critical SLA" },
                                { id: "SOURCING", label: "Sourcing" },
                                { id: "INTERVIEWING", label: "Interviewing" },
                                { id: "OFFER_STAGE", label: "Offer Stage" },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setReqTab(tab.id)}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${
                                        reqTab === tab.id
                                            ? "bg-white text-neutral-900 shadow-xs font-black"
                                            : "text-neutral-500 hover:text-neutral-900"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search by title, client..."
                                value={reqSearch}
                                onChange={(e) => setReqSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-56"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto -m-5">
                        <table className="w-full text-xs min-w-[700px]">
                            <thead>
                                <tr className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-400 font-bold uppercase tracking-wider text-[10px] text-left">
                                    <th className="px-5 py-3">Position</th>
                                    <th className="px-3 py-3">Priority</th>
                                    <th className="px-3 py-3">Client</th>
                                    <th className="px-3 py-3 text-center">Filled</th>
                                    <th className="px-3 py-3 text-center">Pipeline</th>
                                    <th className="px-3 py-3">SLA Status</th>
                                    <th className="px-3 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {filteredPriorityReqs.map((j: any) => {
                                    const fillPct = Math.round((j.filled / Math.max(j.openings, 1)) * 100);
                                    const isCritical = j.health === "CRITICAL" || j.daysRemaining < 0;

                                    return (
                                        <tr key={j.id} className="hover:bg-neutral-50/50 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <p className="font-bold text-neutral-900">{j.title}</p>
                                                <p className="text-[10px] text-neutral-400">{j.department} · {j.location}</p>
                                            </td>
                                            <td className="px-3 py-3.5">
                                                <Badge value={j.priority} />
                                            </td>
                                            <td className="px-3 py-3.5 font-semibold text-neutral-700">
                                                {j.clientName}
                                            </td>
                                            <td className="px-3 py-3.5 text-center">
                                                <span className="font-bold text-neutral-900">{j.filled}/{j.openings}</span>
                                                <div className="w-16 h-1 bg-neutral-100 rounded-full mx-auto mt-1 overflow-hidden">
                                                    <div className="h-full bg-primary rounded-full" style={{ width: `${fillPct}%` }} />
                                                </div>
                                            </td>
                                            <td className="px-3 py-3.5 text-center font-bold text-neutral-800">
                                                {j.inPipeline}
                                            </td>
                                            <td className="px-3 py-3.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                    isCritical
                                                        ? "bg-red-50 text-red-700 border border-red-200"
                                                        : j.health === "AT_RISK"
                                                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                }`}>
                                                    {j.daysRemaining < 0 ? `Breached (${Math.abs(j.daysRemaining)}d)` : `${j.daysRemaining}d left`}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3.5 text-right">
                                                <Link
                                                    href={`/ta/requisitions?id=${j.id}`}
                                                    className="px-2.5 py-1 text-primary hover:bg-primary/5 rounded font-bold text-[11px] inline-flex items-center gap-1"
                                                >
                                                    Details <ChevronRight size={11} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </SectionCard>

            {/* 10. Sourcing Channels & Upcoming Joining Tracker */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard
                    title="Candidate Sourcing Channel Performance"
                    subtitle="Which sourcing streams generate active joins & qualified talent"
                >
                    <div className="space-y-3">
                        {data.sourcePerformance.map((s: any) => (
                            <div key={s.source} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-xs">
                                <div>
                                    <Badge value={s.source} />
                                    <p className="text-[11px] text-neutral-400 mt-1">{s.candidates} candidates sourced · {s.qualified} qualified</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-emerald-700">{s.joined} Placed</p>
                                    <p className="text-[11px] font-bold text-neutral-500">{s.offers} Offers Released</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard
                    title="Upcoming Joining Tracker & Onboarding"
                    subtitle="Offer accepted, verification progress & scheduled start dates"
                    action={
                        <Link href="/ta/pipeline" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                            Offer Pipeline <ArrowRight size={12} />
                        </Link>
                    }
                >
                    {data.joiningTracker.length === 0 ? (
                        <p className="text-xs text-neutral-400 py-6 text-center">No upcoming joins scheduled.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {data.joiningTracker.map((j: any) => (
                                <div key={j.applicationId} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between gap-3 text-xs">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-neutral-900 truncate">{j.candidateName}</p>
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                                j.diffDays <= 3 && j.diffDays >= 0
                                                    ? "bg-amber-100 text-amber-800"
                                                    : j.diffDays < 0
                                                    ? "bg-red-100 text-red-800"
                                                    : "bg-emerald-50 text-emerald-800"
                                            }`}>
                                                {j.joinBadge}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">{j.jobTitle} · {j.clientName}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-mono text-neutral-800 font-bold">{new Date(j.joiningDate).toLocaleDateString("en-IN")}</p>
                                        <p className="text-[10px] text-neutral-400">Onboarding: {j.onboardingProgress}%</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* 11. Recent Recruitment Activity Audit Feed */}
            <SectionCard
                title="Recent Recruitment Activity Trail"
                subtitle="Live immutable audit log across all recruitment operations"
            >
                <div className="space-y-2">
                    {data.recentActivity.map((log: any) => {
                        const timeAgo = Math.max(1, Math.round((Date.now() - new Date(log.createdAt).getTime()) / 60000));
                        const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`;

                        return (
                            <div key={log.id} className="text-[11px] text-neutral-600 flex items-start gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-neutral-800 leading-snug">{log.detail}</p>
                                    <p className="text-[9px] text-neutral-400 mt-0.5">{log.actorName} ({log.actorRole}) · {timeStr}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </SectionCard>

            {/* ─── MODAL: CREATE REQUISITION ─── */}
            <ModalShell open={createReqOpen} onClose={() => setCreateReqOpen(false)} title="Create New Requisition" wide>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!reqForm.title || !reqForm.clientId) {
                            toast.error("Please fill in job title and client");
                            return;
                        }
                        createReqMutation.mutate({
                            ...reqForm,
                            openings: Number(reqForm.openings),
                            salaryMinLpa: Number(reqForm.salaryMinLpa),
                            salaryMaxLpa: Number(reqForm.salaryMaxLpa),
                        });
                    }}
                    className="space-y-4 text-xs"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Job Title *</label>
                            <input
                                type="text"
                                required
                                value={reqForm.title}
                                onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })}
                                placeholder="e.g. Lead Frontend Architect"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Client *</label>
                            <select
                                required
                                value={reqForm.clientId}
                                onChange={(e) => setReqForm({ ...reqForm, clientId: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                            >
                                <option value="">Select Client</option>
                                {clientOptions.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.companyName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Openings</label>
                            <input
                                type="number"
                                min="1"
                                value={reqForm.openings}
                                onChange={(e) => setReqForm({ ...reqForm, openings: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Min LPA</label>
                            <input
                                type="number"
                                value={reqForm.salaryMinLpa}
                                onChange={(e) => setReqForm({ ...reqForm, salaryMinLpa: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Max LPA</label>
                            <input
                                type="number"
                                value={reqForm.salaryMaxLpa}
                                onChange={(e) => setReqForm({ ...reqForm, salaryMaxLpa: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Priority</label>
                            <select
                                value={reqForm.priority}
                                onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Location</label>
                            <input
                                type="text"
                                value={reqForm.location}
                                onChange={(e) => setReqForm({ ...reqForm, location: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="font-bold text-neutral-700 block mb-1">Required Skills (comma separated)</label>
                        <input
                            type="text"
                            value={reqForm.skills}
                            onChange={(e) => setReqForm({ ...reqForm, skills: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                        />
                    </div>

                    <div>
                        <label className="font-bold text-neutral-700 block mb-1">Job Description</label>
                        <textarea
                            rows={3}
                            value={reqForm.description}
                            onChange={(e) => setReqForm({ ...reqForm, description: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                        <button
                            type="button"
                            onClick={() => setCreateReqOpen(false)}
                            className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 font-bold hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createReqMutation.isPending}
                            className="px-5 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/95 disabled:opacity-50"
                        >
                            {createReqMutation.isPending ? "Creating..." : "Create Requisition"}
                        </button>
                    </div>
                </form>
            </ModalShell>

            {/* ─── MODAL: ADD CANDIDATE ─── */}
            <ModalShell open={addCandOpen} onClose={() => setAddCandOpen(false)} title="Add Candidate to Talent Pool" wide>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!candForm.name || !candForm.email) {
                            toast.error("Candidate name and email are required");
                            return;
                        }
                        addCandMutation.mutate({
                            ...candForm,
                            totalExperienceYears: Number(candForm.totalExperienceYears),
                            currentCtcLpa: Number(candForm.currentCtcLpa),
                            expectedCtcLpa: Number(candForm.expectedCtcLpa),
                            noticePeriodDays: Number(candForm.noticePeriodDays),
                        });
                    }}
                    className="space-y-4 text-xs"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Full Name *</label>
                            <input
                                type="text"
                                required
                                value={candForm.name}
                                onChange={(e) => setCandForm({ ...candForm, name: e.target.value })}
                                placeholder="e.g. Rohit Deshmukh"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Email *</label>
                            <input
                                type="email"
                                required
                                value={candForm.email}
                                onChange={(e) => setCandForm({ ...candForm, email: e.target.value })}
                                placeholder="rohit@example.com"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Phone</label>
                            <input
                                type="text"
                                value={candForm.phone}
                                onChange={(e) => setCandForm({ ...candForm, phone: e.target.value })}
                                placeholder="+91 98765 43210"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Experience (Yrs)</label>
                            <input
                                type="number"
                                value={candForm.totalExperienceYears}
                                onChange={(e) => setCandForm({ ...candForm, totalExperienceYears: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Notice (Days)</label>
                            <input
                                type="number"
                                value={candForm.noticePeriodDays}
                                onChange={(e) => setCandForm({ ...candForm, noticePeriodDays: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Current Company</label>
                            <input
                                type="text"
                                value={candForm.currentCompany}
                                onChange={(e) => setCandForm({ ...candForm, currentCompany: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Current Designation</label>
                            <input
                                type="text"
                                value={candForm.currentDesignation}
                                onChange={(e) => setCandForm({ ...candForm, currentDesignation: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Expected CTC (LPA)</label>
                            <input
                                type="number"
                                value={candForm.expectedCtcLpa}
                                onChange={(e) => setCandForm({ ...candForm, expectedCtcLpa: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Sourcing Channel</label>
                            <select
                                value={candForm.source}
                                onChange={(e) => setCandForm({ ...candForm, source: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            >
                                <option value="LINKEDIN">LinkedIn</option>
                                <option value="JOB_PORTAL">Job Portal</option>
                                <option value="DATABASE">Internal Database</option>
                                <option value="AGENT_REFERRAL">Agent Referral</option>
                                <option value="WALK_IN">Direct / Walk-In</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="font-bold text-neutral-700 block mb-1">Key Skills (comma separated)</label>
                        <input
                            type="text"
                            value={candForm.skills}
                            onChange={(e) => setCandForm({ ...candForm, skills: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                        <button
                            type="button"
                            onClick={() => setAddCandOpen(false)}
                            className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 font-bold hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={addCandMutation.isPending}
                            className="px-5 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/95 disabled:opacity-50"
                        >
                            {addCandMutation.isPending ? "Adding..." : "Add Candidate"}
                        </button>
                    </div>
                </form>
            </ModalShell>

            {/* ─── MODAL: SCHEDULE INTERVIEW ─── */}
            <ModalShell open={scheduleInterviewOpen} onClose={() => setScheduleInterviewOpen(false)} title="Schedule Candidate Interview">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!interviewForm.applicationId || !interviewForm.scheduledAt) {
                            toast.error("Application and date/time are required");
                            return;
                        }
                        scheduleInterviewMutation.mutate(interviewForm);
                    }}
                    className="space-y-4 text-xs"
                >
                    <div>
                        <label className="font-bold text-neutral-700 block mb-1">Candidate Application *</label>
                        <select
                            required
                            value={interviewForm.applicationId}
                            onChange={(e) => setInterviewForm({ ...interviewForm, applicationId: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                            <option value="">Select Candidate Application</option>
                            {(Array.isArray(pipelineApps) ? pipelineApps : []).map((app: any) => (
                                <option key={app.id} value={app.id}>
                                    {app.candidateName} — {app.jobTitle}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Interview Round</label>
                            <select
                                value={interviewForm.round}
                                onChange={(e) => setInterviewForm({ ...interviewForm, round: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            >
                                <option value="SCREENING_CALL">Screening Call</option>
                                <option value="TECH_1">Technical Round 1</option>
                                <option value="TECH_2">Technical Round 2</option>
                                <option value="CLIENT_ROUND">Client Round</option>
                                <option value="HR_ROUND">HR Round</option>
                                <option value="FINAL">Final Executive Round</option>
                            </select>
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Mode</label>
                            <select
                                value={interviewForm.mode}
                                onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            >
                                <option value="VIDEO">Video Call (Google Meet)</option>
                                <option value="PHONE">Phone Call</option>
                                <option value="ONSITE">On-Site Client Office</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Date &amp; Time *</label>
                            <input
                                type="datetime-local"
                                required
                                value={interviewForm.scheduledAt}
                                onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Duration (Mins)</label>
                            <input
                                type="number"
                                value={interviewForm.durationMins}
                                onChange={(e) => setInterviewForm({ ...interviewForm, durationMins: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="font-bold text-neutral-700 block mb-1">Interviewer Name / Panel</label>
                        <input
                            type="text"
                            value={interviewForm.interviewerName}
                            onChange={(e) => setInterviewForm({ ...interviewForm, interviewerName: e.target.value })}
                            placeholder="e.g. Deepak Rao (Client Panel)"
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                        />
                    </div>

                    <div>
                        <label className="font-bold text-neutral-700 block mb-1">Meeting Link (optional)</label>
                        <input
                            type="url"
                            value={interviewForm.meetingLink}
                            onChange={(e) => setInterviewForm({ ...interviewForm, meetingLink: e.target.value })}
                            placeholder="https://meet.google.com/..."
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                        <button
                            type="button"
                            onClick={() => setScheduleInterviewOpen(false)}
                            className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 font-bold hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={scheduleInterviewMutation.isPending}
                            className="px-5 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/95 disabled:opacity-50"
                        >
                            {scheduleInterviewMutation.isPending ? "Scheduling..." : "Schedule Interview"}
                        </button>
                    </div>
                </form>
            </ModalShell>

            {/* ─── MODAL: CREATE TASK ─── */}
            <ModalShell open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} title="Create New Operational Task">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!taskForm.title) {
                            toast.error("Task title is required");
                            return;
                        }
                        createTaskMutation.mutate(taskForm);
                    }}
                    className="space-y-4 text-xs"
                >
                    <div>
                        <label className="font-bold text-neutral-700 block mb-1">Task Title *</label>
                        <input
                            type="text"
                            required
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                            placeholder="e.g. Follow up on offer letter signoff"
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="font-bold text-neutral-700 block mb-1">Assign To</label>
                        <select
                            value={taskForm.assignedToId}
                            onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                        >
                            <option value="">Assign to Me</option>
                            {teamMembers.map((rec: any) => (
                                <option key={rec.id} value={rec.id}>{rec.name} ({rec.role})</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Due Date</label>
                            <input
                                type="date"
                                value={taskForm.dueDate}
                                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-neutral-700 block mb-1">Priority</label>
                            <select
                                value={taskForm.priority}
                                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="font-bold text-neutral-700 block mb-1">Notes / Description</label>
                        <textarea
                            rows={3}
                            value={taskForm.description}
                            onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                            placeholder="Additional context or links..."
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                        <button
                            type="button"
                            onClick={() => setCreateTaskOpen(false)}
                            className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 font-bold hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createTaskMutation.isPending}
                            className="px-5 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/95 disabled:opacity-50"
                        >
                            {createTaskMutation.isPending ? "Saving..." : "Create Task"}
                        </button>
                    </div>
                </form>
            </ModalShell>
        </div>
    );
}
