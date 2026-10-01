"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import {
    HeartHandshake, Shield, Sparkles, Utensils, Car,
    Users, Plus, Search, CheckCircle2, X
} from "lucide-react";
import type { EmployeeBenefit } from "@/lib/types";

export default function HRBenefitsPage() {
    const queryClient = useQueryClient();
    const [createModalOpen, setCreateModalOpen] = useState(false);

    // Form state
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState<"INSURANCE" | "WELLNESS" | "MEAL" | "ALLOWANCE" | "COMMUTE">("INSURANCE");
    const [provider, setProvider] = useState("");
    const [coverageAmount, setCoverageAmount] = useState("");
    const [description, setDescription] = useState("");

    const { data: benefits = [], isLoading } = useQuery<EmployeeBenefit[]>({
        queryKey: ["hr-benefits-list"],
        queryFn: async () => {
            const res = await fetch("/api/hr/benefits");
            if (!res.ok) throw new Error("Failed to fetch benefits");
            return res.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/hr/benefits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to create benefit");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr-benefits-list"] });
            toast.success("New benefit program added successfully");
            setCreateModalOpen(false);
            setTitle("");
            setProvider("");
            setCoverageAmount("");
            setDescription("");
        },
        onError: () => {
            toast.error("Failed to add benefit program");
        },
    });

    const totalEnrolled = benefits.reduce((acc, b) => acc + (b.enrolledCount || 0), 0);

    const getIcon = (cat: string) => {
        if (cat === "INSURANCE") return Shield;
        if (cat === "WELLNESS") return Sparkles;
        if (cat === "MEAL") return Utensils;
        if (cat === "COMMUTE") return Car;
        return HeartHandshake;
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Employee Benefits & Welfare"
                subtitle="Manage corporate group insurance policies, wellness programs, meal coupons, and corporate allowances."
                action={
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-xs"
                    >
                        <Plus size={16} /> Add Benefit Program
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Active Programs" value={benefits.length} icon={HeartHandshake} tone="primary" hint="Corporate offerings" />
                <StatCard label="Total Enrollments" value={totalEnrolled} icon={Users} tone="emerald" hint="Covered employees" />
                <StatCard label="Insurance Policies" value={benefits.filter((b) => b.category === "INSURANCE").length} icon={Shield} tone="blue" hint="Health & term life" />
                <StatCard label="Wellness & Perks" value={benefits.filter((b) => b.category !== "INSURANCE").length} icon={Sparkles} tone="purple" hint="Preventive & food" />
            </div>

            {/* Benefits Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <SectionCard key={i}>
                            <SkeletonPulse className="h-28 w-full" />
                        </SectionCard>
                    ))
                ) : benefits.length === 0 ? (
                    <div className="col-span-2">
                        <EmptyState icon={HeartHandshake} message="No benefit programs defined yet." />
                    </div>
                ) : (
                    benefits.map((b) => {
                        const Icon = getIcon(b.category);
                        return (
                            <SectionCard key={b.id}>
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                <Icon size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-neutral-900 leading-snug">{b.title}</h4>
                                                <span className="text-xs font-semibold text-neutral-500">Provider: {b.provider}</span>
                                            </div>
                                        </div>
                                        <Badge value={b.status} />
                                    </div>

                                    <p className="text-xs text-neutral-600 leading-relaxed">{b.description}</p>

                                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-neutral-400 block">Coverage</span>
                                            <span className="font-bold text-neutral-900">{b.coverageAmount}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-neutral-400 block">Enrolled Staff</span>
                                            <span className="font-bold text-primary flex items-center gap-1 justify-end">
                                                <Users size={13} /> {b.enrolledCount} Employees
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </SectionCard>
                        );
                    })
                )}
            </div>

            {/* Add Program Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-100 p-6 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <h3 className="font-bold text-base text-neutral-900">Add Benefit Program</h3>
                            <button onClick={() => setCreateModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Benefit Title *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Executive Dental & Optical Cover"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                    >
                                        <option value="INSURANCE">Insurance</option>
                                        <option value="WELLNESS">Wellness</option>
                                        <option value="MEAL">Meal Allowance</option>
                                        <option value="COMMUTE">Commute</option>
                                        <option value="ALLOWANCE">General Allowance</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">Partner / Provider</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. ICICI Lombard"
                                        value={provider}
                                        onChange={(e) => setProvider(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Coverage / Allowance Value</label>
                                <input
                                    type="text"
                                    placeholder="e.g. ₹2,00,000 Sum Insured"
                                    value={coverageAmount}
                                    onChange={(e) => setCoverageAmount(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm font-semibold border border-neutral-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-700 block mb-1">Description & Terms</label>
                                <textarea
                                    rows={3}
                                    placeholder="Coverage details, network hospitals, reimbursement rules..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 rounded-xl text-sm border border-neutral-200"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm font-bold text-neutral-600">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!title || !provider) {
                                        toast.error("Please fill required fields");
                                        return;
                                    }
                                    createMutation.mutate({ title, category, provider, coverageAmount, description });
                                }}
                                className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-xs hover:bg-primary/90"
                            >
                                Save Benefit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
