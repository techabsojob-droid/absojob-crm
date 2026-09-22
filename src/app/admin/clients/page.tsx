"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    Building2, Plus, Globe, Mail, Phone, Briefcase, UserCheck, ChevronRight,
    IndianRupee, Search, Filter, SlidersHorizontal, AlertCircle, CheckCircle2,
    Calendar, Clock, Download, MoreVertical, ShieldAlert, Tag
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, ModalShell, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";

export default function ClientsPage() {
    const qc = useQueryClient();
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [industryFilter, setIndustryFilter] = useState("ALL");
    const [modalOpen, setModalOpen] = useState(false);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);

    const [form, setForm] = useState({
        companyName: "",
        industry: "IT Services",
        website: "",
        contactPerson: "",
        contactEmail: "",
        contactPhone: "",
        address: "Mumbai",
        commissionRate: "8.33",
        creditDays: "30",
        estimatedValue: "₹25L",
        notes: "",
    });

    const { data: clients = [], isLoading } = useQuery<any[]>({
        queryKey: ["clients", q, statusFilter, industryFilter],
        queryFn: async () => {
            const res = await fetch(`/api/admin/clients?q=${encodeURIComponent(q)}&status=${statusFilter}&industry=${industryFilter}`);
            if (!res.ok) throw new Error("Failed to load clients");
            return res.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Client onboarded — agreement flow started.");
            setModalOpen(false);
            setForm({
                companyName: "", industry: "IT Services", website: "", contactPerson: "",
                contactEmail: "", contactPhone: "", address: "Mumbai", commissionRate: "8.33",
                creditDays: "30", estimatedValue: "₹25L", notes: ""
            });
            qc.invalidateQueries({ queryKey: ["clients"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const patchMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const res = await fetch("/api/admin/clients", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status }),
            });
            if (!res.ok) throw new Error();
            return res.json();
        },
        onSuccess: () => {
            toast.success("Client status updated.");
            qc.invalidateQueries({ queryKey: ["clients"] });
        },
        onError: () => toast.error("Update failed"),
    });

    const activeCount = clients.filter((c) => c.status === "ACTIVE").length;
    const onboardingCount = clients.filter((c) => c.status === "ONBOARDING").length;
    const prospectCount = clients.filter((c) => c.status === "PROSPECT").length;
    const pausedCount = clients.filter((c) => ["PAUSED", "CHURNED"].includes(c.status)).length;
    const needsAttentionCount = clients.filter((c) => c.healthState === "NEEDS_ATTENTION").length;

    const toggleSelect = (id: string) => {
        setSelectedClients((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    const exportCsv = () => {
        const rows = [
            ["ID", "Company Name", "Industry", "Status", "Open Jobs", "Placements", "Account Manager", "Contact Person", "Email", "Phone"],
            ...clients.map((c) => [c.id, c.companyName, c.industry, c.status, c.openJobs, c.placements, c.accountManagerName, c.contactPerson, c.contactEmail, c.contactPhone])
        ];
        const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `AbsoJob_Clients_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Client list exported as CSV");
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Client Accounts & Corporate CRM"
                subtitle="Companies whose positions we fill — 360° management of commercial agreements, job requisitions, candidate pipeline & billing"
                action={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportCsv}
                            className="px-3.5 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-xl text-xs font-bold hover:bg-neutral-50 transition-all flex items-center gap-1.5 shadow-xs"
                        >
                            <Download size={14} /> Export CSV
                        </button>
                        <button
                            onClick={() => setModalOpen(true)}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all shadow-md shadow-primary/25 flex items-center gap-1.5"
                        >
                            <Plus size={16} /> Onboard Client
                        </button>
                    </div>
                }
            />

            {/* Clickable KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div onClick={() => setStatusFilter("ACTIVE")} className="cursor-pointer">
                    <StatCard label="Active Accounts" value={activeCount} icon={Building2} tone="emerald" hint="active job requisitions" />
                </div>
                <div onClick={() => setStatusFilter("ONBOARDING")} className="cursor-pointer">
                    <StatCard label="Onboarding" value={onboardingCount} icon={UserCheck} tone="amber" hint="agreement under review" />
                </div>
                <div onClick={() => setStatusFilter("PROSPECT")} className="cursor-pointer">
                    <StatCard label="Prospects" value={prospectCount} icon={Globe} tone="blue" hint="commercial proposal sent" />
                </div>
                <div onClick={() => setStatusFilter("PAUSED")} className="cursor-pointer">
                    <StatCard label="Paused / Churned" value={pausedCount} icon={Briefcase} tone="neutral" hint="hiring freeze / inactive" />
                </div>
                <div onClick={() => { setStatusFilter("ALL"); setQ(""); }} className="cursor-pointer">
                    <StatCard label="Needs Attention" value={needsAttentionCount} icon={ShieldAlert} tone={needsAttentionCount > 0 ? "red" : "emerald"} hint="zero pipeline or pending action" />
                </div>
            </div>

            {/* Global Search and Filter Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search company, POC, email, industry, AM..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto justify-between md:justify-end">
                    <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl">
                        {["ALL", "ACTIVE", "ONBOARDING", "PROSPECT", "PAUSED"].map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    statusFilter === s
                                        ? "bg-white text-neutral-900 shadow-xs"
                                        : "text-neutral-500 hover:text-neutral-800"
                                }`}
                            >
                                {s.replace("_", " ")}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                            industryFilter !== "ALL"
                                ? "bg-primary text-white border-primary"
                                : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                        }`}
                        title="Filter by Industry"
                    >
                        <Filter size={15} />
                    </button>
                </div>
            </div>

            {/* Filter Drawer / Dropdown */}
            {filterDrawerOpen && (
                <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex items-center justify-between gap-4 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-neutral-700">Filter Industry:</span>
                        {["ALL", "IT Services", "Fintech", "Healthcare", "E-commerce", "SaaS"].map((ind) => (
                            <button
                                key={ind}
                                onClick={() => setIndustryFilter(ind)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                                    industryFilter === ind
                                        ? "bg-primary text-white border-primary"
                                        : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                                }`}
                            >
                                {ind}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => { setIndustryFilter("ALL"); setStatusFilter("ALL"); setQ(""); }}
                        className="text-xs text-primary font-bold hover:underline"
                    >
                        Reset Filters
                    </button>
                </div>
            )}

            {/* Client Cards Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-48 rounded-2xl" />
                    ))}
                </div>
            ) : clients.length === 0 ? (
                <SectionCard>
                    <EmptyState
                        icon={Building2}
                        message="No client accounts match your search or filter criteria."
                    />
                </SectionCard>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {clients.map((c) => (
                        <div
                            key={c.id}
                            className="group bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:border-primary/50 hover:shadow-lg transition-all space-y-3.5 relative"
                        >
                            {/* Card Top: Identity, Industry, Health & Status */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-12 h-12 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white rounded-xl flex items-center justify-center font-black shrink-0 transition-colors shadow-inner text-base">
                                        {c.companyName.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/admin/clients/${c.id}`}
                                                className="font-bold text-neutral-900 group-hover:text-primary transition-colors truncate text-sm hover:underline"
                                            >
                                                {c.companyName}
                                            </Link>
                                            <span className="text-[10px] text-neutral-400 font-mono">({c.id})</span>
                                        </div>
                                        <p className="text-xs text-neutral-400 font-medium">
                                            {c.industry} {c.address && `· ${c.address}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge value={c.status} />
                                    {c.healthState === "NEEDS_ATTENTION" ? (
                                        <span
                                            className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1"
                                            title={c.healthReason}
                                        >
                                            <AlertCircle size={10} /> Needs Attention
                                        </span>
                                    ) : c.healthState === "HEALTHY" ? (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Healthy
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-neutral-100 text-neutral-500">
                                            Inactive
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Operational Matrix Row */}
                            <div className="grid grid-cols-4 gap-2 text-center py-2 bg-neutral-50 rounded-xl border border-neutral-100 group-hover:bg-primary/5 transition-colors">
                                <div>
                                    <p className="text-base font-extrabold text-neutral-900">{c.openJobs}</p>
                                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Open Jobs</p>
                                </div>
                                <div className="border-x border-neutral-200">
                                    <p className="text-base font-extrabold text-neutral-900">{c.inPipeline}</p>
                                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">In Pipeline</p>
                                </div>
                                <div className="border-r border-neutral-200">
                                    <p className="text-base font-extrabold text-emerald-600">{c.placements}</p>
                                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Placements</p>
                                </div>
                                <div>
                                    <p className="text-base font-extrabold text-neutral-900">{c.commissionRate}%</p>
                                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Commission</p>
                                </div>
                            </div>

                            {/* Contact Person & Account Rep Details */}
                            <div className="space-y-1.5 text-xs text-neutral-500">
                                <p className="flex items-center gap-2">
                                    <UserCheck size={13} className="text-neutral-400" /> Account Manager: <strong className="text-neutral-700 font-semibold">{c.accountManagerName}</strong>
                                </p>
                                <p className="flex items-center gap-2">
                                    <Mail size={13} className="text-neutral-400" /> {c.contactPerson} · <a href={`mailto:${c.contactEmail}`} className="text-primary hover:underline">{c.contactEmail}</a>
                                </p>
                                {c.contactPhone && (
                                    <p className="flex items-center gap-2">
                                        <Phone size={13} className="text-neutral-400" /> {c.contactPhone}
                                    </p>
                                )}
                            </div>

                            {/* Card Footer: Commercial Credit Terms & 360 Link */}
                            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                                <div className="flex items-center gap-2">
                                    <span>Credit Terms: <strong className="text-neutral-700">{c.creditDays} days</strong></span>
                                    {c.outstandingAmount > 0 && (
                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                            {inr(c.outstandingAmount)} due
                                        </span>
                                    )}
                                </div>
                                <Link
                                    href={`/admin/clients/${c.id}`}
                                    className="text-primary font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform"
                                >
                                    View 360° Workspace <ChevronRight size={12} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Onboard Client Modal */}
            <ModalShell open={modalOpen} onClose={() => setModalOpen(false)} title="Onboard New Corporate Client" wide>
                <form
                    onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
                    className="space-y-4"
                >
                    <div className="grid grid-cols-2 gap-3.5">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Company Name *</span>
                            <input
                                required
                                value={form.companyName}
                                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                placeholder="e.g. Acme Health Corp"
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Industry</span>
                            <select
                                value={form.industry}
                                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            >
                                <option value="IT Services">IT Services</option>
                                <option value="Fintech">Fintech</option>
                                <option value="Healthcare">Healthcare</option>
                                <option value="E-commerce">E-commerce</option>
                                <option value="SaaS">SaaS</option>
                                <option value="Logistics">Logistics</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Primary Contact Person *</span>
                            <input
                                required
                                value={form.contactPerson}
                                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                                placeholder="HR Director / Head of TA"
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact Email *</span>
                            <input
                                required
                                type="email"
                                value={form.contactEmail}
                                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                                placeholder="ta.lead@company.com"
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact Phone</span>
                            <input
                                value={form.contactPhone}
                                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                                placeholder="+91 98200..."
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Headquarters / Location</span>
                            <input
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="City, State"
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Commission Fee (% of CTC)</span>
                            <input
                                type="number"
                                step="0.01"
                                value={form.commissionRate}
                                onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Payment Credit Terms (Days)</span>
                            <input
                                type="number"
                                value={form.creditDays}
                                onChange={(e) => setForm({ ...form, creditDays: e.target.value })}
                                className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </label>
                    </div>
                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Internal Notes & Commercial Terms</span>
                        <textarea
                            rows={3}
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="SLA terms, special interview processes, billing guidelines..."
                            className="mt-1 w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                        />
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setModalOpen(false)}
                            className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                        >
                            {createMutation.isPending ? "Onboarding..." : "Complete Client Onboarding"}
                        </button>
                    </div>
                </form>
            </ModalShell>
        </div>
    );
}
