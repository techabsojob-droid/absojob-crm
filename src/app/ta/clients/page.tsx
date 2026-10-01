"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Mail, Phone, MessageSquare, Send, Clock } from "lucide-react";
import { PageHeader, SectionCard, Badge, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { ago, btn, inputCls, Tabs, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Sub { id: string; candidateId: string; candidateName: string; jobTitle: string; clientName: string; submittedBy: string; submittedAt: string; status: string; clientFeedback?: string; rejectionReason?: string; daysWaiting: number; applicationStage?: string | null; emailedTo?: string[] }
interface Comm { id: string; channel: string; direction: string; subject: string; body: string; byName: string; createdAt: string; nextFollowUpDate?: string | null }
interface ClientRow { id: string; companyName: string; industry: string; status: string; contactPerson: string; contactEmail: string; contactPhone: string; openJobs: { id: string; title: string; openings: number; status: string }[]; activeCandidates: number; joined: number; awaitingFeedback: Sub[]; communications: Comm[] }
interface Tpl { id: string; name: string; channel: string; audience: string; renderedSubject: string | null; renderedBody: string }

export default function MyClientsPage() {
    const [tab, setTab] = useState<"clients" | "submissions">("clients");
    const { data, isLoading } = useQuery<ClientRow[]>({ queryKey: ["ta-clients"], queryFn: () => api("/api/ta/clients") });
    const { data: subs } = useQuery<Sub[]>({ queryKey: ["ta-submissions"], queryFn: () => api("/api/ta/submissions") });
    const [log, setLog] = useState<ClientRow | null>(null);
    const [fb, setFb] = useState<Sub | null>(null);

    if (isLoading || !data) return <SkeletonPulse className="h-96 w-full" />;
    const pending = (subs ?? []).filter((s) => s.status === "PENDING_REVIEW").length;

    return (
        <div className="space-y-6">
            <PageHeader title="My Clients" subtitle="Client contacts, open roles, CVs awaiting feedback and every interaction in one place" />
            <Tabs tabs={[{ id: "clients", label: `Clients (${data.length})` }, { id: "submissions", label: `CV submissions${pending ? ` · ${pending} awaiting feedback` : ""}` }]} value={tab} onChange={setTab} />

            {tab === "clients" && (data.length === 0 ? <SectionCard><EmptyState icon={Building2} message="No clients yet — clients appear here once a requisition is assigned to you." /></SectionCard> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {data.map((c) => (
                        <SectionCard key={c.id} title={c.companyName} subtitle={`${c.industry} · ${c.activeCandidates} active candidate(s) · ${c.joined} joined`} action={<Badge value={c.status} />}>
                            <div className="space-y-3 text-sm">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                                    <span className="font-bold text-neutral-800">{c.contactPerson}</span>
                                    <a href={`mailto:${c.contactEmail}`} className="flex items-center gap-1 hover:text-primary"><Mail size={12} />{c.contactEmail}</a>
                                    <a href={`tel:${c.contactPhone}`} className="flex items-center gap-1 hover:text-primary"><Phone size={12} />{c.contactPhone}</a>
                                </div>
                                <div className="flex flex-wrap gap-1.5">{c.openJobs.length === 0 ? <span className="text-xs text-neutral-400">No open roles</span> : c.openJobs.map((j) => <Link key={j.id} href={`/ta/requisitions/${j.id}`} className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-primary/10">{j.title} · {j.openings}</Link>)}</div>
                                {c.awaitingFeedback.length > 0 && (
                                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs">
                                        <p className="font-bold text-amber-800 mb-1 flex items-center gap-1"><Clock size={12} /> {c.awaitingFeedback.length} CV(s) awaiting feedback</p>
                                        {c.awaitingFeedback.slice(0, 4).map((s) => <p key={s.id} className="flex justify-between"><span>{s.candidateName} — {s.jobTitle}</span><button className="font-bold text-primary" onClick={() => setFb(s)}>{s.daysWaiting}d · record</button></p>)}
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-neutral-500">{c.communications[0] ? <>Last: <b>{c.communications[0].subject}</b> · {ago(c.communications[0].createdAt)}</> : "No interactions logged"}</p>
                                    <button onClick={() => setLog(c)} className={btn.soft}><MessageSquare size={12} className="inline mr-1" />Log / email</button>
                                </div>
                            </div>
                        </SectionCard>
                    ))}
                </div>
            ))}

            {tab === "submissions" && (
                <SectionCard title="CVs shared with clients" subtitle="Record the client's response to keep the pipeline and incentives accurate">
                    {!subs?.length ? <EmptyState icon={Send} message="No CVs shared yet. Share a profile from the candidate page → Share with client." /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-[11px] text-neutral-500 uppercase"><th className="py-2">Candidate</th><th>Job / client</th><th>Shared</th><th>Status</th><th>Feedback</th><th /></tr></thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {subs.map((s) => (
                                        <tr key={s.id}>
                                            <td className="py-2.5"><Link href={`/ta/candidates/${s.candidateId}`} className="font-semibold hover:text-primary">{s.candidateName}</Link>{s.applicationStage && <span className="block"><Badge value={s.applicationStage} /></span>}</td>
                                            <td className="text-xs">{s.jobTitle}<span className="block text-neutral-400">{s.clientName}</span></td>
                                            <td className="text-xs">{s.submittedAt.slice(0, 10)}<span className="block text-neutral-400">by {s.submittedBy}</span></td>
                                            <td><Badge value={s.status} /></td>
                                            <td className="text-xs max-w-xs">{s.rejectionReason ?? s.clientFeedback ?? (s.status === "PENDING_REVIEW" ? <span className={s.daysWaiting > 3 ? "text-rose-600 font-bold" : "text-neutral-400"}>Waiting {s.daysWaiting}d</span> : "—")}</td>
                                            <td className="text-right"><button onClick={() => setFb(s)} className={btn.ghost}>Record feedback</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            {log && <ClientLogModal client={log} onClose={() => setLog(null)} />}
            {fb && <FeedbackModal sub={fb} onClose={() => setFb(null)} />}
        </div>
    );
}

function ClientLogModal({ client, onClose }: { client: ClientRow; onClose: () => void }) {
    const { data: tpls } = useQuery<Tpl[]>({ queryKey: ["ta-templates", "client", client.id], queryFn: () => api(`/api/ta/templates?clientId=${client.id}`) });
    const [f, setF] = useState({ channel: "EMAIL", direction: "OUTGOING", subject: "", body: "", jobId: "", nextFollowUpDate: "", send: true });
    const act = useAct<{ link: string | null; emailStatus: string | null }>("/api/ta/clients", "POST", ["ta-clients"], (r) => r.emailStatus ? `Email ${r.emailStatus === "LOGGED" ? "logged (no mail provider configured)" : "sent"}` : "Interaction logged");
    const clientTpls = (tpls ?? []).filter((t) => t.audience === "CLIENT");

    return (
        <ModalShell onClose={onClose} title={`${client.companyName} — communication`} wide>
            <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); act.mutate({ clientId: client.id, ...f, jobId: f.jobId || undefined, nextFollowUpDate: f.nextFollowUpDate || undefined }, { onSuccess: (r) => { if (r.link) window.open(r.link, "_blank", "noopener"); setF({ ...f, subject: "", body: "" }); } }); }}>
                <div className="grid grid-cols-3 gap-2">
                    <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} className={inputCls} aria-label="Channel">{["EMAIL", "PHONE", "MEETING", "WHATSAPP"].map((c) => <option key={c}>{c}</option>)}</select>
                    <select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })} className={inputCls} aria-label="Direction"><option value="OUTGOING">Outgoing</option><option value="INCOMING">Incoming</option></select>
                    <select value={f.jobId} onChange={(e) => setF({ ...f, jobId: e.target.value })} className={inputCls} aria-label="Job"><option value="">Any job</option>{client.openJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
                </div>
                {clientTpls.length > 0 && <select onChange={(e) => { const t = clientTpls.find((x) => x.id === e.target.value); if (t) setF({ ...f, channel: t.channel === "WHATSAPP" ? "WHATSAPP" : "EMAIL", subject: t.renderedSubject ?? t.name, body: t.renderedBody }); }} className={inputCls} defaultValue="" aria-label="Template"><option value="">Use a template…</option>{clientTpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
                <input required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Subject" className={inputCls} />
                <textarea required rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder={f.channel === "PHONE" ? "Call notes" : "Message"} className={inputCls} />
                <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-neutral-600 flex items-center gap-2">Follow up on <input type="date" value={f.nextFollowUpDate} onChange={(e) => setF({ ...f, nextFollowUpDate: e.target.value })} className={`${inputCls} w-40`} /></label>
                    {f.channel === "EMAIL" && f.direction === "OUTGOING" && <label className="text-xs font-semibold flex items-center gap-1.5"><input type="checkbox" checked={f.send} onChange={(e) => setF({ ...f, send: e.target.checked })} /> Send email to {client.contactEmail}</label>}
                </div>
                <button disabled={act.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">{f.channel === "EMAIL" && f.direction === "OUTGOING" && f.send ? "Send & log" : f.channel === "WHATSAPP" && f.direction === "OUTGOING" ? "Open WhatsApp & log" : "Log interaction"}</button>
            </form>
            <div className="mt-5 border-t border-neutral-100 pt-4">
                <p className="text-xs font-bold text-neutral-500 mb-2">History</p>
                {client.communications.length === 0 ? <p className="text-xs text-neutral-400">Nothing logged yet.</p> : (
                    <ul className="space-y-2.5 text-xs">
                        {client.communications.map((m) => <li key={m.id} className="border-l-2 border-primary/30 pl-3"><p className="font-bold">{m.channel} · {m.direction.toLowerCase()} — {m.subject}</p><p className="text-neutral-600 whitespace-pre-line">{m.body}</p><p className="text-neutral-400">{m.byName} · {ago(m.createdAt)}{m.nextFollowUpDate ? ` · follow-up ${m.nextFollowUpDate}` : ""}</p></li>)}
                    </ul>
                )}
            </div>
        </ModalShell>
    );
}

function FeedbackModal({ sub, onClose }: { sub: Sub; onClose: () => void }) {
    const [f, setF] = useState({ status: sub.status === "PENDING_REVIEW" ? "SHORTLISTED" : sub.status, clientFeedback: sub.clientFeedback ?? "", rejectionReason: sub.rejectionReason ?? "" });
    const act = useAct<{ nextStep: string | null }>("/api/ta/submissions", "PATCH", ["ta-submissions", "ta-clients", "candidate"], (r) => r.nextStep ?? "Feedback recorded");
    return (
        <ModalShell onClose={onClose} title={`${sub.clientName} feedback — ${sub.candidateName}`}>
            <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); act.mutate({ candidateId: sub.candidateId, submissionId: sub.id, ...f }, { onSuccess: onClose }); }}>
                <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inputCls} aria-label="Client decision">
                    <option value="SHORTLISTED">Shortlisted</option><option value="INTERVIEW_REQUESTED">Interview requested</option><option value="REJECTED">Rejected</option><option value="PENDING_REVIEW">Still reviewing</option>
                </select>
                <textarea rows={3} value={f.clientFeedback} onChange={(e) => setF({ ...f, clientFeedback: e.target.value })} placeholder="Client's comments" className={inputCls} />
                {f.status === "REJECTED" && <input required value={f.rejectionReason} onChange={(e) => setF({ ...f, rejectionReason: e.target.value })} placeholder="Rejection reason *" className={inputCls} />}
                <button disabled={act.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Save</button>
            </form>
        </ModalShell>
    );
}
