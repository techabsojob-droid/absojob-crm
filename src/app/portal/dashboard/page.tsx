"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Gift, Wallet, TrendingUp, CalendarCheck, LogIn, LogOut, CheckSquare, Megaphone, Users, Award, Clock } from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { useAuth } from "@/lib/auth";

export default function PortalDashboard() {
    const { user } = useAuth();
    const isTa = user?.role === "TA_MANAGER" || user?.role === "TA_RECRUITER" || user?.role === "SUPER_ADMIN";

    const { data, isLoading } = useQuery({
        queryKey: ["portal-dashboard"],
        queryFn: async () => (await fetch("/api/portal/dashboard")).json(),
        refetchInterval: 30000,
    });

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <SkeletonPulse className="h-10 w-64" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonPulse key={i} className="h-24 rounded-2xl" />)}
                </div>
                <SkeletonPulse className="h-64 rounded-2xl" />
            </div>
        );
    }

    const today = new Date().toDateString();
    const fmtTime = (iso: string | null) =>
        iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—";

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Hi ${user?.name.split(" ")[0]} 👋`}
                subtitle={isTa ? "Your recruitment desk at a glance" : "Your referrals, earnings & attendance"}
            />

            {/* Referral / earnings KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="My Referrals" value={data.referralStats.total} icon={Users} tone="primary" hint={`${data.referralStats.inPipeline} in pipeline`} />
                <StatCard label="Placed" value={data.referralStats.placed} icon={Award} tone="emerald" hint={`${Math.round((data.referralStats.placed / Math.max(data.referralStats.total, 1)) * 100)}% success`} />
                <StatCard label="Earned" value={inr(data.referralStats.totalEarned)} icon={Wallet} tone="purple" hint="lifetime incentives" />
                <StatCard label="Pending Payout" value={inr(data.pendingPayoutTotal)} icon={TrendingUp} tone={data.pendingPayoutTotal > 0 ? "amber" : "blue"} />
            </div>

            {/* Attendance quick actions */}
            <SectionCard title={`Attendance — ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}`}>
                <div className="flex items-center gap-4 flex-wrap">
                    {data.todayAttendance ? (
                        <>
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                                <LogIn size={16} className="text-emerald-600" />
                                <div>
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase">Checked in</p>
                                    <p className="text-sm font-extrabold text-neutral-900">{fmtTime(data.todayAttendance.checkIn)}</p>
                                </div>
                            </div>
                            {data.todayAttendance.checkOut ? (
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                                    <LogOut size={16} className="text-neutral-500" />
                                    <div>
                                        <p className="text-[9px] font-bold text-neutral-400 uppercase">Checked out</p>
                                        <p className="text-sm font-extrabold text-neutral-900">{fmtTime(data.todayAttendance.checkOut)}</p>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5"><Clock size={13} /> Shift running…</span>
                            )}
                            {data.todayAttendance.hoursWorked > 0 && (
                                <span className="text-xs font-bold text-neutral-600">{data.todayAttendance.hoursWorked}h logged</span>
                            )}
                            <Link href="/portal/attendance" className="ml-auto text-xs font-bold text-primary hover:underline">Full history →</Link>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-neutral-500">You haven't checked in yet today.</p>
                            <Link href="/portal/attendance" className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2 ml-auto">
                                <CalendarCheck size={14} /> Go to Attendance
                            </Link>
                        </>
                    )}
                </div>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* My tasks */}
                <SectionCard title="My Tasks" action={<Link href="/portal/tasks" className="text-xs font-bold text-primary hover:underline">All →</Link>}>
                    {data.myTasks.length === 0 ? (
                        <EmptyState icon={CheckSquare} message="No pending tasks." />
                    ) : (
                        <div className="divide-y divide-neutral-50 -mx-5 px-5">
                            {data.myTasks.slice(0, 4).map((t: any) => (
                                <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                                    <p className="text-sm font-semibold text-neutral-800">{t.title}</p>
                                    <Badge value={t.priority} />
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Recent referrals */}
                <SectionCard title="Recent Referrals" action={<Link href="/portal/referrals" className="text-xs font-bold text-primary hover:underline">All →</Link>}>
                    {data.myReferrals.length === 0 ? (
                        <EmptyState icon={Gift} message="No referrals yet — refer a friend and earn!" />
                    ) : (
                        <div className="divide-y divide-neutral-50 -mx-5 px-5">
                            {data.myReferrals.slice(0, 4).map((r: any) => (
                                <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900 truncate">{r.candidateName}</p>
                                        <p className="text-[11px] text-neutral-400 truncate">{r.jobTitle ?? "—"} · {new Date(r.referredAt).toLocaleDateString("en-IN")}</p>
                                    </div>
                                    <Badge value={r.status} />
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Announcements */}
                <SectionCard title="Announcements" className="lg:col-span-2">
                    {data.announcements.length === 0 ? (
                        <EmptyState icon={Megaphone} message="Nothing new right now." />
                    ) : (
                        <div className="space-y-3">
                            {data.announcements.map((a: any) => (
                                <div key={a.id} className={`p-3.5 rounded-xl border ${a.pinned ? "bg-amber-50/60 border-amber-200" : "bg-neutral-50 border-neutral-100"}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-extrabold text-neutral-900 flex items-center gap-2">
                                            {a.pinned && "📌"} {a.title}
                                            <Badge value={a.priority} />
                                        </p>
                                        <span className="text-[10px] text-neutral-400 shrink-0">{new Date(a.createdAt).toLocaleDateString("en-IN")}</span>
                                    </div>
                                    <p className="text-xs text-neutral-600 mt-1 whitespace-pre-line">{a.body}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>
        </div>
    );
}
