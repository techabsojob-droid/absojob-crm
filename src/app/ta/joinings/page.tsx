"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileSignature, UserCheck, AlertTriangle, CalendarCheck, Phone } from "lucide-react";
import { PageHeader, StatCard, SectionCard, Badge, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { ago } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Row { applicationId: string; stage: string; candidateId: string; candidateName: string; candidatePhone: string; jobTitle: string; clientName: string; recruiterName: string; offerStatus: string | null; offeredCtcLpa: number | null; offerExpiry: string | null; joinDate: string | null; daysToJoin: number | null; noticePeriodDays: number | null; lastContactAt: string | null; silentDays: number | null; risk: "LOW" | "MEDIUM" | "HIGH" | null; placementStatus: string | null; guaranteeEndDate: string | null }
interface Data { offersOut: Row[]; awaitingJoin: Row[]; joined: Row[]; backedOut: Row[] }

const RISK: Record<string, string> = { HIGH: "bg-rose-50 text-rose-700 border-rose-200", MEDIUM: "bg-amber-50 text-amber-700 border-amber-200", LOW: "bg-emerald-50 text-emerald-700 border-emerald-200" };

function Table({ rows, cols }: { rows: Row[]; cols: ("offer" | "join" | "risk" | "contact" | "guarantee")[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] text-neutral-500 uppercase"><th className="py-2">Candidate</th><th>Job / client</th>{cols.includes("offer") && <th>Offer</th>}{cols.includes("join") && <th>Joining</th>}{cols.includes("contact") && <th>Last contact</th>}{cols.includes("risk") && <th>Dropout risk</th>}{cols.includes("guarantee") && <th>Guarantee till</th>}</tr></thead>
                <tbody className="divide-y divide-neutral-100">
                    {rows.map((r) => (
                        <tr key={r.applicationId}>
                            <td className="py-2.5"><Link href={`/ta/candidates/${r.candidateId}`} className="font-semibold hover:text-primary">{r.candidateName}</Link><a href={`tel:${r.candidatePhone}`} className="block text-[11px] text-neutral-400 hover:text-primary"><Phone size={10} className="inline" /> {r.candidatePhone}</a></td>
                            <td className="text-xs">{r.jobTitle}<span className="block text-neutral-400">{r.clientName} · {r.recruiterName}</span></td>
                            {cols.includes("offer") && <td className="text-xs">{r.offerStatus ? <Badge value={r.offerStatus} /> : "—"}{r.offeredCtcLpa ? <span className="block text-neutral-500">{r.offeredCtcLpa} LPA{r.offerExpiry ? ` · expires ${r.offerExpiry}` : ""}</span> : null}</td>}
                            {cols.includes("join") && <td className="text-xs">{r.joinDate ?? "—"}{r.daysToJoin !== null && <span className={`block font-bold ${r.daysToJoin < 0 ? "text-rose-600" : "text-neutral-500"}`}>{r.daysToJoin < 0 ? `${-r.daysToJoin}d overdue` : r.daysToJoin === 0 ? "today" : `in ${r.daysToJoin}d`}</span>}</td>}
                            {cols.includes("contact") && <td className={`text-xs ${r.silentDays !== null && r.silentDays > 7 ? "text-rose-600 font-bold" : ""}`}>{ago(r.lastContactAt)}</td>}
                            {cols.includes("risk") && <td>{r.risk && <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${RISK[r.risk]}`}>{r.risk}</span>}</td>}
                            {cols.includes("guarantee") && <td className="text-xs">{r.guaranteeEndDate ?? "—"}{r.placementStatus && <span className="block"><Badge value={r.placementStatus} /></span>}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function JoiningsPage() {
    const { data, isLoading } = useQuery<Data>({ queryKey: ["ta-joinings"], queryFn: () => api("/api/ta/joinings") });
    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const highRisk = data.awaitingJoin.filter((r) => r.risk === "HIGH").length;
    return (
        <div className="space-y-6">
            <PageHeader title="Offers & Joinings" subtitle="Track every offer to the joining date — stay in touch with candidates serving notice to prevent dropouts" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Offers out" value={data.offersOut.length} icon={FileSignature} tone="amber" />
                <StatCard label="Awaiting joining" value={data.awaitingJoin.length} icon={CalendarCheck} tone="blue" />
                <StatCard label="High dropout risk" value={highRisk} icon={AlertTriangle} tone={highRisk ? "amber" : "emerald"} hint="Overdue joining or no contact in 14+ days" />
                <StatCard label="Joined (90 days)" value={data.joined.length} icon={UserCheck} tone="emerald" hint={`${data.backedOut.length} backed out`} />
            </div>
            <SectionCard title="Accepted — awaiting joining" subtitle="Sorted by joining date. Call anyone silent for over a week.">
                {data.awaitingJoin.length ? <Table rows={data.awaitingJoin} cols={["join", "contact", "risk"]} /> : <EmptyState icon={CalendarCheck} message="No accepted offers waiting to join." />}
            </SectionCard>
            <SectionCard title="Offers awaiting candidate response">
                {data.offersOut.length ? <Table rows={data.offersOut} cols={["offer", "join", "contact"]} /> : <EmptyState icon={FileSignature} message="No offers pending." />}
            </SectionCard>
            <SectionCard title="Recently joined" subtitle="Keep in touch through the replacement guarantee period">
                {data.joined.length ? <Table rows={data.joined} cols={["join", "guarantee"]} /> : <EmptyState icon={UserCheck} message="No joinings in the last 90 days." />}
            </SectionCard>
            {data.backedOut.length > 0 && <SectionCard title="Backed out (90 days)"><Table rows={data.backedOut} cols={["offer", "join"]} /></SectionCard>}
        </div>
    );
}
