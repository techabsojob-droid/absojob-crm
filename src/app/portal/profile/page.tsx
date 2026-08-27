"use client";

import { useQuery } from "@tanstack/react-query";
import { UserCircle, Building2, Mail, Phone, MapPin, CalendarDays, ShieldCheck } from "lucide-react";
import { PageHeader, Badge, SectionCard, inr } from "@/components/shared/ui";
import { useAuth } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    TA_MANAGER: "Talent Acquisition Manager",
    TA_RECRUITER: "Recruiter",
    AGENT: "Channel Agent (Referral Partner)",
    EMPLOYEE: "Employee — Internal Referrals Enabled",
};

export default function PortalProfilePage() {
    const { user } = useAuth();

    const { data: ledger } = useQuery({
        queryKey: ["incentives"],
        queryFn: async () => (await fetch("/api/portal/incentives")).json().catch(() => null),
    });

    const entries = Array.isArray(ledger) ? ledger : [];
    const earned = entries.filter((e: any) => e.type === "CREDIT").reduce((s: number, e: any) => s + e.amount, 0);

    if (!user) return null;

    return (
        <div className="space-y-6 max-w-3xl">
            <PageHeader title="My Profile" subtitle="Your account & engagement details" />

            {/* Profile card */}
            <div className="bg-gradient-to-br from-primary to-[#0f2e1e] p-6 rounded-3xl text-white shadow-xl shadow-primary/20">
                <div className="flex items-center gap-5 flex-wrap">
                    <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center text-3xl font-black backdrop-blur">
                        {user.avatar ?? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold">{user.name}</h2>
                        <p className="text-sm font-semibold text-white/70 mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</p>
                        <p className="text-xs text-white/50 flex items-center gap-1.5 mt-1.5"><Mail size={12} /> {user.email}</p>
                    </div>
                </div>
            </div>

            <SectionCard title="Account Details">
                <dl className="divide-y divide-neutral-50 -mx-5 px-5">
                    {[
                        { icon: Mail, label: "Email", value: user.email },
                        { icon: ShieldCheck, label: "Role", value: ROLE_LABELS[user.role] ?? user.role },
                        { icon: Building2, label: "Organization", value: "AbsoJob Staffing Solutions Pvt Ltd" },
                        { icon: CalendarDays, label: "Member since", value: "Jan 2025" },
                    ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="py-3.5 flex items-center justify-between gap-4">
                            <dt className="flex items-center gap-2.5 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                <Icon size={14} /> {label}
                            </dt>
                            <dd className="text-sm font-bold text-neutral-900 text-right truncate max-w-[60%]">{value}</dd>
                        </div>
                    ))}
                </dl>
            </SectionCard>

            {(user.role === "AGENT" || user.role === "EMPLOYEE" || user.role === "SUPER_ADMIN") && (
                <SectionCard title="Engagement Snapshot">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase">Lifetime Incentives</p>
                            <p className="text-lg font-extrabold text-emerald-600 mt-1">{inr(earned)}</p>
                        </div>
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase">Ledger Entries</p>
                            <p className="text-lg font-extrabold text-neutral-900 mt-1">{entries.length}</p>
                        </div>
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 flex flex-col justify-center">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase">Status</p>
                            <span className="mt-1"><Badge value="ACTIVE" /></span>
                        </div>
                    </div>
                </SectionCard>
            )}
        </div>
    );
}
