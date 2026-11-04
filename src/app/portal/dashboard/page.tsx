"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Gift, Wallet, TrendingUp, CalendarCheck, LogIn, LogOut, Megaphone, Users, Award, Clock } from "lucide-react";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState, inr } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { useAuth } from "@/lib/auth";
import EmployeeHome from "@/components/portal/EmployeeHome";
import { MyWork } from "@/components/tasks/TaskWidgets";

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

    const fmtTime = (iso: string | null) =>
        iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—";

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Hi ${user?.name.split(" ")[0]} 👋`}
                subtitle={isTa ? "Your recruitment desk at a glance" : data.partner ? "Your referrals, earnings and standing among partners" : "Your referrals, earnings & attendance"}
            />

            {/* Referral / earnings KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="My Referrals" value={data.referralStats.total} icon={Users} tone="primary" hint={`${data.referralStats.inPipeline} in pipeline`} />
                <StatCard label="Placed" value={data.referralStats.placed} icon={Award} tone="emerald" hint={`${Math.round((data.referralStats.placed / Math.max(data.referralStats.total, 1)) * 100)}% success`} />
                <StatCard label="Earned" value={inr(data.referralStats.totalEarned)} icon={Wallet} tone="purple" hint="lifetime incentives" />
                <StatCard label="Pending Payout" value={inr(data.pendingPayoutTotal)} icon={TrendingUp} tone={data.pendingPayoutTotal > 0 ? "amber" : "blue"} />
            </div>

            {data.employee && <EmployeeHome e={data.employee} />}

            {data.partner && (
                <>
                    {data.partner.kycStatus && data.partner.kycStatus !== "VERIFIED" && (
                        <Link href="/portal/profile?tab=payouts" className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <b>KYC {data.partner.kycStatus === "REJECTED" ? "needs attention" : "under verification"}</b> — {data.partner.kycNote ?? "payouts start once your KYC is verified."} <span className="underline font-bold">Update →</span>
                        </Link>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <SectionCard title="Your funnel" subtitle={`${data.partner.stats.conversion}% of your referrals joined`}>
                            <ul className="space-y-2 text-xs">
                                {([["Submitted", data.partner.stats.submitted], ["Under review", data.partner.stats.underReview], ["Shortlisted", data.partner.stats.shortlisted], ["Joined", data.partner.stats.hired], ["Not selected", data.partner.stats.rejected]] as [string, number][]).map(([k, v]) => (
                                    <li key={k} className="flex items-center gap-2"><span className="w-24 text-neutral-600">{k}</span><div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-[#2a78d6] rounded-full" style={{ width: `${(v / Math.max(1, data.partner.stats.total)) * 100}%` }} /></div><span className="w-6 text-right font-mono font-bold">{v}</span></li>
                                ))}
                            </ul>
                            <p className="text-xs text-neutral-500 mt-3">Potential earnings in pipeline: <b className="text-emerald-700">{inr(data.partner.stats.potential)}</b></p>
                        </SectionCard>
                        <SectionCard title="Partner leaderboard" subtitle={data.partner.rank ? `You are #${data.partner.rank} of ${data.partner.partners}` : "Joinings this year"}>
                            <ol className="space-y-2 text-sm">
                                {data.partner.leaderboard.map((l: any) => (
                                    <li key={l.rank} className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 ${l.me ? "bg-primary/10 font-bold" : ""}`}>
                                        <span>{l.rank === 1 ? "🥇" : l.rank === 2 ? "🥈" : l.rank === 3 ? "🥉" : `#${l.rank}`} {l.name}</span>
                                        <span className="text-xs text-neutral-500">{l.hired} joined · {l.conversion}%</span>
                                    </li>
                                ))}
                            </ol>
                        </SectionCard>
                        <SectionCard title="Quick actions">
                            <div className="space-y-2">
                                <Link href="/portal/jobs" className="block w-full text-center py-2.5 rounded-xl bg-primary text-white text-xs font-bold">Browse open jobs & refer</Link>
                                <Link href="/portal/referrals" className="block w-full text-center py-2.5 rounded-xl border border-neutral-200 text-xs font-bold">Track my referrals</Link>
                                <Link href="/portal/incentives" className="block w-full text-center py-2.5 rounded-xl border border-neutral-200 text-xs font-bold">Earnings & statement</Link>
                            </div>
                        </SectionCard>
                    </div>
                </>
            )}

            {!data.partner && (
                <>
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

                </>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MyWork limit={4} />

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
