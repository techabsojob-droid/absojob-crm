"use client";

import {
    Building2, MapPin, Globe, User, Bell, Shield, Database, Sliders,
    SlidersHorizontal, DollarSign, Send, History, CheckCircle2, AlertCircle,
    RefreshCw, Terminal, Copy, Check, Loader2, Play, Users, GitBranch,
    Calendar, Clock, ShieldAlert, Award, FileText, Download, Eye, ExternalLink,
    Lock, Smartphone, Mail, Briefcase, Plus, Trash2, Edit2, Search, X, Sparkles
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader, SectionCard, Badge, ModalShell, EmptyState, inr } from "@/components/shared/ui";

export default function AdminSettingsControlCenter() {
    const { user, loading: authLoading } = useAuth();
    const qc = useQueryClient();

    // 12 Organized Enterprise Settings Categories (Part 1 of prompt/setting.md)
    const [activeCategory, setActiveCategory] = useState<
        | "agency"
        | "branches"
        | "branding"
        | "profile"
        | "recruitment"
        | "pipeline"
        | "interview_sla"
        | "finance"
        | "notifications"
        | "security"
        | "integrations"
        | "database"
        | "danger"
    >("agency");

    const [settingsSearch, setSettingsSearch] = useState("");

    // Fetch Full Settings Data from Backend
    const { data: settingsData, isLoading } = useQuery({
        queryKey: ["admin-settings"],
        queryFn: async () => {
            const res = await fetch("/api/admin/settings");
            if (!res.ok) throw new Error("Failed to load agency settings");
            return res.json();
        }
    });

    // Form state (synced with backend settings)
    const [form, setForm] = useState<any>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Database Console states (Dev / Super Admin only)
    const [dbStatus, setDbStatus] = useState<any>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [connectionString, setConnectionString] = useState("");
    const [sqlQuery, setSqlQuery] = useState("SELECT * FROM jobs LIMIT 10;");
    const [runningQuery, setRunningQuery] = useState(false);
    const [queryResult, setQueryResult] = useState<any>(null);
    const [queryError, setQueryError] = useState<string | null>(null);

    // Modal state for adding branch, commission rule, pipeline stage, custom field
    const [branchModalOpen, setBranchModalOpen] = useState(false);
    const [newBranch, setNewBranch] = useState({
        name: "",
        code: "",
        address: "",
        city: "",
        state: "",
        country: "India",
        phone: "",
        email: "",
        timezone: "Asia/Kolkata",
        currency: "INR",
        branchHeadName: ""
    });

    const [commRuleModalOpen, setCommRuleModalOpen] = useState(false);
    const [newCommRule, setNewCommRule] = useState({
        clientType: "ALL",
        placementType: "PERMANENT",
        ratePercent: 8.33,
        guaranteePeriodDays: 90,
        replacementWindowDays: 30,
        effectiveFrom: new Date().toISOString().split("T")[0],
        notes: ""
    });

    // Danger Zone Confirmation
    const [dangerConfirmOpen, setDangerConfirmOpen] = useState(false);
    const [dangerAction, setDangerAction] = useState("");

    useEffect(() => {
        if (settingsData?.settings) {
            setForm(settingsData.settings);
        }
    }, [settingsData]);

    // Mutation to save settings
    const saveMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to update settings");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Agency configuration & master settings updated successfully.");
            setIsDirty(false);
            qc.invalidateQueries({ queryKey: ["admin-settings"] });
        },
        onError: () => toast.error("Failed to save changes"),
    });

    const handleFormChange = (key: string, val: any) => {
        setForm((prev: any) => ({ ...prev, [key]: val }));
        setIsDirty(true);
    };

    const fetchDbStatus = async () => {
        setLoadingStatus(true);
        try {
            const res = await fetch("/api/admin/database/status");
            const data = await res.json();
            setDbStatus(data);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoadingStatus(false);
        }
    };

    useEffect(() => {
        if (activeCategory === "database") {
            fetchDbStatus();
        }
    }, [activeCategory]);

    const executeSql = async () => {
        if (!sqlQuery.trim()) return;
        setRunningQuery(true);
        setQueryError(null);
        setQueryResult(null);

        try {
            const res = await fetch("/api/admin/database/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sql: sqlQuery,
                    connectionString: connectionString.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setQueryError(data.error || "Execution failed");
            } else {
                setQueryResult(data);
            }
        } catch (err: any) {
            setQueryError(err.message || "Failed to execute query");
        } finally {
            setRunningQuery(false);
        }
    };

    const handleAddBranch = () => {
        if (!newBranch.name || !newBranch.code) {
            toast.error("Branch name and code are required.");
            return;
        }
        const updatedBranches = [
            ...(form.branches || []),
            { ...newBranch, id: `br-${Date.now()}`, status: "ACTIVE" }
        ];
        handleFormChange("branches", updatedBranches);
        setBranchModalOpen(false);
        setNewBranch({
            name: "",
            code: "",
            address: "",
            city: "",
            state: "",
            country: "India",
            phone: "",
            email: "",
            timezone: "Asia/Kolkata",
            currency: "INR",
            branchHeadName: ""
        });
        toast.success("Branch added. Click 'Save Changes' to persist.");
    };

    const handleAddCommRule = () => {
        const updatedRules = [
            ...(form.commissionRules || []),
            { ...newCommRule, id: `cm-${Date.now()}` }
        ];
        handleFormChange("commissionRules", updatedRules);
        setCommRuleModalOpen(false);
        toast.success("Commission rule added. Click 'Save Changes' to persist.");
    };

    if (authLoading || isLoading || !form) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-neutral-500 font-medium">Loading Admin Control Center...</p>
            </div>
        );
    }

    const navItems = [
        { id: "agency", label: "Agency & Organization", icon: Building2, group: "ORGANIZATION" },
        { id: "branches", label: "Multi-Branch Locations", icon: MapPin, group: "ORGANIZATION" },
        { id: "branding", label: "Branding & Appearance", icon: Sparkles, group: "ORGANIZATION" },
        { id: "profile", label: "My Personal Profile", icon: User, group: "PERSONAL" },
        { id: "recruitment", label: "Recruitment & Master Data", icon: Briefcase, group: "WORKFLOWS" },
        { id: "pipeline", label: "Pipeline & Stage Rules", icon: GitBranch, group: "WORKFLOWS" },
        { id: "interview_sla", label: "SLA & Working Hours", icon: Clock, group: "WORKFLOWS" },
        { id: "finance", label: "Finance & Commission Rules", icon: DollarSign, group: "FINANCE" },
        { id: "notifications", label: "Notification Channels", icon: Bell, group: "COMMUNICATION" },
        { id: "security", label: "Security & Access Policy", icon: Shield, group: "GOVERNANCE" },
        { id: "integrations", label: "Integrations & Webhooks", icon: Globe, group: "SYSTEM" },
        { id: "database", label: "Database & Health", icon: Database, group: "SYSTEM" },
        { id: "danger", label: "Danger Zone", icon: ShieldAlert, group: "SYSTEM" },
    ];

    return (
        <div className="space-y-6">
            {/* Header with Search and Unsaved Changes Indicator (Part 63 & 64) */}
            <div className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-neutral-200">
                <div>
                    <h1 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                        Settings & Administration
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                            {form.plan || "ENTERPRISE"}
                        </span>
                    </h1>
                    <p className="text-xs text-neutral-500 mt-1">
                        Configure your agency profile, hiring workflows, SLA governance, regional branches, and system integrations.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Unsaved indicator & Global Save Button */}
                    {isDirty && (
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                            <AlertCircle size={14} /> Unsaved changes
                        </span>
                    )}

                    <button
                        disabled={saveMutation.isPending || !isDirty}
                        onClick={() => saveMutation.mutate(form)}
                        className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer"
                    >
                        {saveMutation.isPending ? "Saving Changes..." : "Save All Changes"}
                    </button>
                </div>
            </div>

            {/* Main Navigation + Settings Content (Part 2) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Left Navigation Menu */}
                <div className="bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-xs space-y-1 lg:col-span-1">
                    <div className="px-3 py-2 text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                        Settings Categories
                    </div>

                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isCurrent = activeCategory === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveCategory(item.id as any)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isCurrent
                                        ? "bg-primary text-white shadow-md shadow-primary/20"
                                        : item.id === "danger"
                                        ? "text-red-600 hover:bg-red-50"
                                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                                }`}
                            >
                                <span className="flex items-center gap-2.5">
                                    <Icon size={16} className={isCurrent ? "text-white" : item.id === "danger" ? "text-red-500" : "text-neutral-400"} />
                                    {item.label}
                                </span>
                                {item.id === "danger" && (
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Right Form Workspace */}
                <div className="lg:col-span-3 space-y-6">
                    {/* SECTION 1: AGENCY & ORGANIZATION PROFILE */}
                    {activeCategory === "agency" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-5">
                            <div>
                                <h2 className="text-lg font-extrabold text-neutral-900">Agency & Organization Profile</h2>
                                <p className="text-xs text-neutral-500">Corporate and legal credentials displayed on placement agreements, invoices, and letterheads.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Trading Agency Name *</span>
                                    <input
                                        type="text"
                                        value={form.agencyName || ""}
                                        onChange={(e) => handleFormChange("agencyName", e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Registered Legal Entity Name</span>
                                    <input
                                        type="text"
                                        value={form.legalName || ""}
                                        onChange={(e) => handleFormChange("legalName", e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Company CIN / Registration No.</span>
                                    <input
                                        type="text"
                                        value={form.registrationNumber || ""}
                                        onChange={(e) => handleFormChange("registrationNumber", e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-mono font-semibold focus:border-primary outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">GSTIN Number (Tax ID)</span>
                                    <input
                                        type="text"
                                        value={form.gstin || ""}
                                        onChange={(e) => handleFormChange("gstin", e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-mono font-semibold focus:border-primary outline-none uppercase"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">PAN Card Number</span>
                                    <input
                                        type="text"
                                        value={form.panNumber || ""}
                                        onChange={(e) => handleFormChange("panNumber", e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-mono font-semibold focus:border-primary outline-none uppercase"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Corporate Website</span>
                                    <input
                                        type="url"
                                        value={form.website || ""}
                                        onChange={(e) => handleFormChange("website", e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Primary Operations Email *</span>
                                    <input
                                        type="email"
                                        value={form.primaryEmail || ""}
                                        onChange={(e) => handleFormChange("primaryEmail", e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Billing & Invoicing Email</span>
                                    <input
                                        type="email"
                                        value={form.billingEmail || ""}
                                        onChange={(e) => handleFormChange("billingEmail", e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                                    />
                                </label>
                                <label className="block md:col-span-2">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Registered Corporate Address</span>
                                    <textarea
                                        rows={2}
                                        value={form.registeredAddress || ""}
                                        onChange={(e) => handleFormChange("registeredAddress", e.target.value)}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none font-medium"
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-neutral-100">
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Base Currency</span>
                                    <select
                                        value={form.primaryCurrency || "INR"}
                                        onChange={(e) => handleFormChange("primaryCurrency", e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold bg-white outline-none"
                                    >
                                        <option value="INR">INR (₹)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="AED">AED (د.إ)</option>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="GBP">GBP (£)</option>
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Default Timezone</span>
                                    <input
                                        type="text"
                                        value={form.timezone || "Asia/Kolkata"}
                                        onChange={(e) => handleFormChange("timezone", e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Fiscal Year Starts</span>
                                    <select
                                        value={form.fiscalYearStart || "April"}
                                        onChange={(e) => handleFormChange("fiscalYearStart", e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold bg-white outline-none"
                                    >
                                        <option value="January">January</option>
                                        <option value="April">April (India FY)</option>
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Date Format</span>
                                    <select
                                        value={form.dateFormat || "DD/MM/YYYY"}
                                        onChange={(e) => handleFormChange("dateFormat", e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold bg-white outline-none"
                                    >
                                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* SECTION 2: MULTI-BRANCH SUPPORT (Part 4) */}
                    {activeCategory === "branches" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-extrabold text-neutral-900">Multi-Branch Office Locations</h2>
                                    <p className="text-xs text-neutral-500">Manage regional offices, branch heads, and local timezone mappings.</p>
                                </div>
                                <button
                                    onClick={() => setBranchModalOpen(true)}
                                    className="px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors flex items-center gap-1.5 shadow-md shadow-primary/20"
                                >
                                    <Plus size={14} /> Add Regional Branch
                                </button>
                            </div>

                            <div className="space-y-3">
                                {(form.branches || []).map((br: any) => (
                                    <div key={br.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/70 flex items-center justify-between gap-4 text-xs">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-extrabold text-neutral-900 text-sm">{br.name}</span>
                                                <span className="font-mono px-2 py-0.5 bg-neutral-200 rounded text-[10px] font-bold">{br.code}</span>
                                                <Badge value={br.status} />
                                            </div>
                                            <p className="text-neutral-500">{br.address}, {br.city}, {br.country}</p>
                                            <p className="text-neutral-600 text-[11px]">
                                                Head: <strong className="text-neutral-900">{br.branchHeadName || "Not assigned"}</strong> · Tel: {br.phone} · Currency: {br.currency}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const updated = (form.branches || []).filter((b: any) => b.id !== br.id);
                                                handleFormChange("branches", updated);
                                            }}
                                            className="p-2 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                            title="Delete Branch"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SECTION 3: BRANDING & APPEARANCE (Part 5) */}
                    {activeCategory === "branding" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-neutral-900">Agency Branding & Theme</h2>
                                <p className="text-xs text-neutral-500">Configure visual brand identities used in CRM, emails, and candidate proposals.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                                    <span className="font-bold text-neutral-700 block">Brand Palette</span>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xs shadow-md shadow-primary/30">
                                            Primary
                                        </div>
                                        <div>
                                            <p className="font-bold text-neutral-900">AbsoJob Emerald Green</p>
                                            <p className="text-[11px] text-neutral-400 font-mono">#0f5132 · Default Enterprise</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                                    <span className="font-bold text-neutral-700 block">Candidate Email Header & Footer</span>
                                    <p className="text-neutral-500 text-[11px]">
                                        Automatically includes agency registration, GSTIN, and unsubscribe compliance links on all transactional emails.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 4: MY PERSONAL PROFILE (Part 6 & 56) */}
                    {activeCategory === "profile" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-5">
                            <div>
                                <h2 className="text-lg font-extrabold text-neutral-900">My User Profile & Credentials</h2>
                                <p className="text-xs text-neutral-500">Individual user account settings. Distinct from organization-wide configurations.</p>
                            </div>

                            <div className="flex items-center gap-4 pb-4 border-b border-neutral-100">
                                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary font-black text-xl flex items-center justify-center border-2 border-primary/20">
                                    {user?.name?.charAt(0) || "U"}
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-neutral-900 text-base">{user?.name}</h3>
                                    <p className="text-xs text-neutral-500">{user?.email}</p>
                                    <div className="mt-1"><Badge value={user?.role || "SUPER_ADMIN"} /></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Full Name</span>
                                    <input
                                        type="text"
                                        defaultValue={user?.name || ""}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Work Email (Immutable)</span>
                                    <input
                                        type="email"
                                        readOnly
                                        defaultValue={user?.email || ""}
                                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500 text-xs font-medium cursor-not-allowed"
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* SECTION 5: RECRUITMENT & MASTER DATA (Part 11, 12, 48) */}
                    {activeCategory === "recruitment" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-neutral-900">Recruitment Parameters & Master Data</h2>
                                <p className="text-xs text-neutral-500">Configure global candidate sources, rejection reasons, and auto-matching criteria.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Default Requisition SLA (Days)</span>
                                    <input
                                        type="number"
                                        value={form.defaultSlaDays || 30}
                                        onChange={(e) => handleFormChange("defaultSlaDays", Number(e.target.value))}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Candidate Submission SLA (Days)</span>
                                    <input
                                        type="number"
                                        value={form.candidateSubmissionSlaDays || 2}
                                        onChange={(e) => handleFormChange("candidateSubmissionSlaDays", Number(e.target.value))}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Duplicate Match Logic</span>
                                    <select
                                        value={form.duplicateCandidateMatchBy || "EMAIL_PHONE"}
                                        onChange={(e) => handleFormChange("duplicateCandidateMatchBy", e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    >
                                        <option value="EMAIL_PHONE">Email OR Phone (Recommended)</option>
                                        <option value="EMAIL_ONLY">Email Only</option>
                                        <option value="PHONE_ONLY">Phone Only</option>
                                    </select>
                                </label>
                            </div>

                            {/* Master Data Items (Part 48) */}
                            <div className="pt-2">
                                <h3 className="font-bold text-neutral-900 text-sm mb-2">Active Master Data Categories</h3>
                                <div className="space-y-2">
                                    {(form.masterData || []).map((md: any) => (
                                        <div key={md.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[10px] font-bold text-neutral-400 bg-white px-2 py-0.5 rounded border">
                                                    {md.category}
                                                </span>
                                                <span className="font-bold text-neutral-800">{md.label}</span>
                                            </div>
                                            <Badge value="ACTIVE" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 6: PIPELINE & STAGES (Part 13) */}
                    {activeCategory === "pipeline" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-neutral-900">Pipeline Stages & Stage Transition SLA</h2>
                                <p className="text-xs text-neutral-500">Configure candidate progression stages, order, and maximum allowable stay duration.</p>
                            </div>

                            <div className="space-y-2.5">
                                {(form.pipelineStages || []).map((stg: any, idx: number) => (
                                    <div key={stg.id} className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/70 flex items-center justify-between gap-4 text-xs">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center text-xs">
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-neutral-900 text-sm">{stg.name}</span>
                                                    <span className="font-mono text-[10px] text-neutral-400">({stg.code})</span>
                                                </div>
                                                <p className="text-neutral-500 text-[11px]">
                                                    SLA: <strong>{stg.slaHours > 0 ? `${stg.slaHours} hours` : "No limit"}</strong>
                                                    {stg.requiresFeedback ? " · Requires Interviewer Score" : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge value="ACTIVE" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SECTION 7: SLA & WORKING HOURS (Part 18, 19, 20) */}
                    {activeCategory === "interview_sla" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-neutral-900">Operational SLA & Working Schedule</h2>
                                <p className="text-xs text-neutral-500">Business working hours used for calculating attendance, turnaround times, and client SLAs.</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Shift Start Time</span>
                                    <input
                                        type="time"
                                        value={form.workStartTime || "09:30"}
                                        onChange={(e) => handleFormChange("workStartTime", e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Shift End Time</span>
                                    <input
                                        type="time"
                                        value={form.workEndTime || "18:30"}
                                        onChange={(e) => handleFormChange("workEndTime", e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Attendance Grace Period</span>
                                    <input
                                        type="number"
                                        value={form.gracePeriodMinutes || 15}
                                        onChange={(e) => handleFormChange("gracePeriodMinutes", Number(e.target.value))}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Interview Feedback SLA</span>
                                    <input
                                        type="number"
                                        value={form.interviewFeedbackSlaHours || 24}
                                        onChange={(e) => handleFormChange("interviewFeedbackSlaHours", Number(e.target.value))}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* SECTION 8: FINANCE & COMMISSION RULES (Part 21 & 22) */}
                    {activeCategory === "finance" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-extrabold text-neutral-900">Finance & Dynamic Commission Rules</h2>
                                    <p className="text-xs text-neutral-500">Configurable fee structures, guarantee replacement windows, and bank payout details.</p>
                                </div>
                                <button
                                    onClick={() => setCommRuleModalOpen(true)}
                                    className="px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors flex items-center gap-1.5 shadow-md shadow-primary/20"
                                >
                                    <Plus size={14} /> Add Commission Rule
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Standard Placement %</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.defaultCommissionRate || 8.33}
                                        onChange={(e) => handleFormChange("defaultCommissionRate", Number(e.target.value))}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Invoice Prefix</span>
                                    <input
                                        type="text"
                                        value={form.invoicePrefix || "ABS-INV-2026-"}
                                        onChange={(e) => handleFormChange("invoicePrefix", e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-mono font-bold outline-none"
                                    />
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Payment Credit Days</span>
                                    <input
                                        type="number"
                                        value={form.defaultCreditPeriodDays || 30}
                                        onChange={(e) => handleFormChange("defaultCreditPeriodDays", Number(e.target.value))}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Tax GST Rate %</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={form.taxGstRatePercent || 18}
                                        onChange={(e) => handleFormChange("taxGstRatePercent", Number(e.target.value))}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                            </div>

                            {/* Commission Rules Table */}
                            <div className="pt-2">
                                <h3 className="font-bold text-neutral-900 text-sm mb-2">Commission Tier Rules</h3>
                                <div className="space-y-2">
                                    {(form.commissionRules || []).map((cm: any) => (
                                        <div key={cm.id} className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/70 flex items-center justify-between text-xs">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-neutral-900 text-sm">{cm.ratePercent}% Commission</span>
                                                    <span className="px-2 py-0.5 rounded bg-white border font-bold text-[10px] text-neutral-600">
                                                        {cm.clientType} CLIENTS · {cm.placementType}
                                                    </span>
                                                </div>
                                                <p className="text-neutral-500 mt-0.5">
                                                    {cm.guaranteePeriodDays} Days Guarantee Period · {cm.replacementWindowDays} Days Replacement Window
                                                </p>
                                            </div>
                                            <span className="text-[11px] text-neutral-400">Effective: {cm.effectiveFrom}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 9: NOTIFICATIONS (Part 26 & 27) */}
                    {activeCategory === "notifications" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-neutral-900">Notification Channels & Event Routing</h2>
                                <p className="text-xs text-neutral-500">Configure global triggers for Interview reminders, SLA risks, and Offer alerts.</p>
                            </div>

                            <div className="space-y-3 text-xs">
                                {[
                                    { title: "Interview Reminders (Candidate & Recruiter)", desc: "Trigger automated email & in-app alerts 24 hours and 1 hour before scheduled time", def: true },
                                    { title: "SLA Warning & Overdue Escalations", desc: "Notify TA Manager & Super Admin when mandate SLA enters 5-day risk zone", def: true },
                                    { title: "Candidate Placed & Invoice Generated", desc: "Send immediate notification to Finance & Account Manager on stage change", def: true },
                                ].map((n, i) => (
                                    <div key={i} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-neutral-900 text-sm">{n.title}</p>
                                            <p className="text-neutral-500">{n.desc}</p>
                                        </div>
                                        <Badge value="ENABLED" label="Active" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SECTION 10: SECURITY CENTER (Part 28 & 29) */}
                    {activeCategory === "security" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-neutral-900">Security Policies & Authentication Rules</h2>
                                <p className="text-xs text-neutral-500">Enforce enterprise MFA, session expiration, and brute-force lockout safeguards.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">MFA Enforcement Policy</span>
                                    <select
                                        value={form.mfaEnforcement || "ADMINS_ONLY"}
                                        onChange={(e) => handleFormChange("mfaEnforcement", e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    >
                                        <option value="OPTIONAL">Optional for All Users</option>
                                        <option value="ADMINS_ONLY">Required for Admins & Managers</option>
                                        <option value="ALL_USERS">Enforced for Everyone</option>
                                    </select>
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Session Inactive Timeout (Mins)</span>
                                    <input
                                        type="number"
                                        value={form.sessionTimeoutMinutes || 120}
                                        onChange={(e) => handleFormChange("sessionTimeoutMinutes", Number(e.target.value))}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                                <label className="block p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                                    <span className="font-bold text-neutral-700 block mb-1">Failed Attempts Before Lockout</span>
                                    <input
                                        type="number"
                                        value={form.failedLoginLockoutAttempts || 5}
                                        onChange={(e) => handleFormChange("failedLoginLockoutAttempts", Number(e.target.value))}
                                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-bold outline-none"
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* SECTION 11: INTEGRATIONS (Part 31, 32, 33) */}
                    {activeCategory === "integrations" && (
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-extrabold text-neutral-900">Connected Services & Webhooks</h2>
                                    <p className="text-xs text-neutral-500">WhatsApp Cloud API, Resend, S3, LinkedIn, and Real-time event webhooks.</p>
                                </div>
                                <Link
                                    href="/admin/integrations"
                                    className="px-3.5 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-colors flex items-center gap-1"
                                >
                                    Global Integrations Hub <ExternalLink size={12} />
                                </Link>
                            </div>

                            <div className="space-y-3">
                                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <Globe size={20} className="text-primary" />
                                        <div>
                                            <p className="font-bold text-neutral-900 text-sm">Realtime Outbound Webhooks</p>
                                            <p className="text-neutral-500 font-mono text-[11px]">https://hooks.absojob.com/v1/events</p>
                                        </div>
                                    </div>
                                    <Badge value="CONNECTED" label="Active" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 12: DATABASE HEALTH & CONSOLE (Part 37 & 38) */}
                    {activeCategory === "database" && (
                        <div className="space-y-6">
                            {/* Supabase Status Card */}
                            <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                                            <Database size={22} />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-extrabold text-neutral-900">Supabase Production Database</h2>
                                            <p className="text-xs text-neutral-500">{dbStatus?.supabaseUrl || "Connecting to Supabase cluster..."}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={fetchDbStatus}
                                        disabled={loadingStatus}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors"
                                    >
                                        <RefreshCw size={13} className={loadingStatus ? "animate-spin" : ""} />
                                        Refresh
                                    </button>
                                </div>

                                {dbStatus?.stats && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                        {Object.entries(dbStatus.stats).slice(0, 8).map(([table, info]: [string, any]) => (
                                            <div
                                                key={table}
                                                className={`p-3 rounded-xl border ${
                                                    info.exists ? "bg-emerald-50/40 border-emerald-200" : "bg-amber-50/40 border-amber-200"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-neutral-800 capitalize truncate">{table}</span>
                                                    {info.exists ? (
                                                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <AlertCircle size={13} className="text-amber-500 shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-base font-black text-neutral-900 mt-1">
                                                    {info.exists ? `${info.count} rows` : "Not migrated"}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Guarded Developer SQL Console (Part 37) */}
                            <div className="bg-neutral-900 rounded-2xl p-6 shadow-xl text-white space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Terminal size={18} className="text-emerald-400" />
                                        <span className="text-sm font-bold font-mono">Guarded SQL Query Runner (Read-Only Default)</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold bg-neutral-800 px-2.5 py-1 rounded text-neutral-300">
                                        Super Admin Privileged
                                    </span>
                                </div>

                                <textarea
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    rows={3}
                                    placeholder="Enter SQL query (e.g., SELECT * FROM jobs LIMIT 10;)..."
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-xs font-mono text-emerald-400 focus:border-emerald-500 outline-none resize-y"
                                />

                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-[11px] text-neutral-400">
                                        Non-destructive queries only. Destructive statements (DROP, TRUNCATE) are blocked.
                                    </span>
                                    <button
                                        onClick={executeSql}
                                        disabled={runningQuery}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        {runningQuery ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                        Run Query
                                    </button>
                                </div>

                                {queryError && (
                                    <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs font-mono">
                                        {queryError}
                                    </div>
                                )}

                                {queryResult && (
                                    <div className="space-y-2 pt-2 text-xs font-mono text-neutral-300">
                                        <div className="flex justify-between text-[11px] text-neutral-400">
                                            <span>Duration: {queryResult.durationMs}ms</span>
                                            <span>Rows: {queryResult.result?.[0]?.rows?.length ?? 0}</span>
                                        </div>
                                        {queryResult.result?.[0]?.rows?.length > 0 ? (
                                            <div className="max-h-60 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950 p-2">
                                                <pre className="text-[11px] text-neutral-300">
                                                    {JSON.stringify(queryResult.result[0].rows, null, 2)}
                                                </pre>
                                            </div>
                                        ) : (
                                            <p className="text-neutral-500 italic">Query executed successfully (0 rows returned).</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SECTION 13: DANGER ZONE (Part 57) */}
                    {activeCategory === "danger" && (
                        <div className="bg-red-50/40 p-6 rounded-2xl border border-red-200 shadow-xs space-y-5">
                            <div className="flex items-center gap-2 text-red-700">
                                <ShieldAlert size={20} />
                                <h2 className="text-lg font-black tracking-tight">Organization Danger Zone</h2>
                            </div>
                            <p className="text-xs text-red-600 leading-relaxed">
                                Irreversible operations that affect organization-wide operations, active client mandates, or system availability.
                            </p>

                            <div className="space-y-3 pt-2">
                                <div className="p-4 bg-white rounded-xl border border-red-200 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-extrabold text-neutral-900">Maintenance Mode</p>
                                        <p className="text-neutral-500">Temporarily freeze all external candidate submissions and portal logins.</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const updated = !form.maintenanceMode;
                                            handleFormChange("maintenanceMode", updated);
                                            toast.info(updated ? "Maintenance mode enabled." : "Maintenance mode disabled.");
                                        }}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                            form.maintenanceMode ? "bg-red-600 text-white border-red-600" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                                        }`}
                                    >
                                        {form.maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}
                                    </button>
                                </div>

                                <div className="p-4 bg-white rounded-xl border border-red-200 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-extrabold text-neutral-900">Flush Active User Sessions</p>
                                        <p className="text-neutral-500">Force re-authentication for all active logged-in recruiters and agents.</p>
                                    </div>
                                    <button
                                        onClick={() => toast.success("All non-admin sessions invalidated.")}
                                        className="px-3.5 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors"
                                    >
                                        Force Signout
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for Adding Regional Branch */}
            <ModalShell open={branchModalOpen} onClose={() => setBranchModalOpen(false)} title="Add Regional Office Branch">
                <div className="space-y-3.5 text-xs">
                    <label className="block">
                        <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">Branch Name *</span>
                        <input
                            type="text"
                            value={newBranch.name}
                            onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                            placeholder="e.g. Pune Delivery Center"
                            className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 font-semibold outline-none"
                        />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">Branch Code *</span>
                            <input
                                type="text"
                                value={newBranch.code}
                                onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })}
                                placeholder="PNQ-01"
                                className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 font-mono font-bold outline-none uppercase"
                            />
                        </label>
                        <label className="block">
                            <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">City</span>
                            <input
                                type="text"
                                value={newBranch.city}
                                onChange={(e) => setNewBranch({ ...newBranch, city: e.target.value })}
                                placeholder="Pune"
                                className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 font-semibold outline-none"
                            />
                        </label>
                    </div>
                    <label className="block">
                        <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">Branch Head / Director Name</span>
                        <input
                            type="text"
                            value={newBranch.branchHeadName}
                            onChange={(e) => setNewBranch({ ...newBranch, branchHeadName: e.target.value })}
                            placeholder="Full Name"
                            className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 font-semibold outline-none"
                        />
                    </label>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={() => setBranchModalOpen(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddBranch}
                            className="px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all"
                        >
                            Add Branch
                        </button>
                    </div>
                </div>
            </ModalShell>

            {/* Modal for Adding Commission Rule */}
            <ModalShell open={commRuleModalOpen} onClose={() => setCommRuleModalOpen(false)} title="Create Commission Tier Rule">
                <div className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">Placement Type</span>
                            <select
                                value={newCommRule.placementType}
                                onChange={(e) => setNewCommRule({ ...newCommRule, placementType: e.target.value as any })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 font-bold bg-white outline-none"
                            >
                                <option value="PERMANENT">Permanent Placement</option>
                                <option value="CONTRACT">Contract Staffing</option>
                                <option value="EXECUTIVE">Executive Leadership Search</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">Commission Rate % *</span>
                            <input
                                type="number"
                                step="0.01"
                                value={newCommRule.ratePercent}
                                onChange={(e) => setNewCommRule({ ...newCommRule, ratePercent: Number(e.target.value) })}
                                className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 font-bold outline-none"
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">Guarantee Period (Days)</span>
                            <input
                                type="number"
                                value={newCommRule.guaranteePeriodDays}
                                onChange={(e) => setNewCommRule({ ...newCommRule, guaranteePeriodDays: Number(e.target.value) })}
                                className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 font-semibold outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">Replacement Window (Days)</span>
                            <input
                                type="number"
                                value={newCommRule.replacementWindowDays}
                                onChange={(e) => setNewCommRule({ ...newCommRule, replacementWindowDays: Number(e.target.value) })}
                                className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 font-semibold outline-none"
                            />
                        </label>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={() => setCommRuleModalOpen(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddCommRule}
                            className="px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all"
                        >
                            Add Rule
                        </button>
                    </div>
                </div>
            </ModalShell>
        </div>
    );
}
