"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, Phone, Smartphone, Users as Meeting, AlertTriangle } from "lucide-react";
import { SectionCard, Badge } from "@/components/shared/ui";
import { ago, inputCls, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Tpl { id: string; name: string; channel: string; audience: string; renderedSubject: string | null; renderedBody: string }
interface Log { id: string; type: string; direction: string; subject: string; message: string; outcome: string; nextFollowUpDate?: string; createdByName: string; createdAt: string }
interface Data { communications: Log[]; emails: { id: string; subject: string; status: string; createdAt: string; sentByName: string }[]; doNotContact: boolean; doNotContactReason: string | null }

const CHANNELS = [
    { id: "EMAIL", label: "Email", icon: Mail },
    { id: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
    { id: "SMS", label: "SMS", icon: Smartphone },
    { id: "PHONE", label: "Call log", icon: Phone },
    { id: "MEETING", label: "Meeting", icon: Meeting },
];
const OUTCOMES = ["Connected", "No Answer", "Interested", "Not Interested", "Call Back", "Interview Confirmed", "Documents Pending", "Salary Discussion", "Offer Discussion"];

/** Candidate communication centre: templated email / WhatsApp / SMS, call & meeting logs, follow-ups. */
export default function CandidateComms({ candidateId, applications }: { candidateId: string; applications: { id: string; jobTitle: string; clientName: string; stage: string }[] }) {
    const [appId, setAppId] = useState(applications.find((a) => !["REJECTED", "JOINED", "BACKED_OUT"].includes(a.stage))?.id ?? "");
    const { data } = useQuery<Data>({ queryKey: ["cand-comms", candidateId], queryFn: () => api(`/api/ta/communications?candidateId=${candidateId}`) });
    const { data: tpls } = useQuery<Tpl[]>({ queryKey: ["ta-templates", candidateId, appId], queryFn: () => api(`/api/ta/templates?candidateId=${candidateId}${appId ? `&applicationId=${appId}` : ""}`) });
    const [f, setF] = useState({ channel: "EMAIL", direction: "OUTGOING", subject: "", message: "", outcome: "Connected", nextFollowUpDate: "" });
    const send = useAct<{ link: string | null; emailStatus: string | null; taskId: string | null }>("/api/ta/communications", "POST", ["cand-comms", "ta-candidate-detail"], (r) =>
        r.emailStatus ? `Email ${r.emailStatus === "LOGGED" ? "recorded (mail provider not configured)" : "sent"}${r.taskId ? " · follow-up task created" : ""}` : r.link ? "Opening… logged" : `Logged${r.taskId ? " · follow-up task created" : ""}`);

    const usable = (tpls ?? []).filter((t) => t.audience === "CANDIDATE" && (f.channel === "EMAIL" ? t.channel === "EMAIL" : ["WHATSAPP", "SMS"].includes(f.channel) ? t.channel !== "EMAIL" : false));
    const outgoingMsg = ["EMAIL", "WHATSAPP", "SMS"].includes(f.channel) && f.direction === "OUTGOING";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <SectionCard title="Contact candidate" className="lg:col-span-2">
                {data?.doNotContact && <p className="mb-3 text-xs rounded-xl bg-rose-50 border border-rose-100 text-rose-700 p-2.5 flex gap-1.5"><AlertTriangle size={14} /> Do not contact{data.doNotContactReason ? `: ${data.doNotContactReason}` : ""}. Only incoming contact can be logged.</p>}
                <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); send.mutate({ candidateId, applicationId: appId || undefined, ...f, nextFollowUpDate: f.nextFollowUpDate || undefined }, { onSuccess: (r) => { if (r.link) window.open(r.link, "_blank", "noopener"); setF({ ...f, subject: "", message: "", nextFollowUpDate: "" }); } }); }}>
                    <div className="flex flex-wrap gap-1.5">
                        {CHANNELS.map((c) => <button type="button" key={c.id} onClick={() => setF({ ...f, channel: c.id })} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${f.channel === c.id ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}><c.icon size={12} />{c.label}</button>)}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })} className={inputCls} aria-label="Direction"><option value="OUTGOING">Outgoing</option><option value="INCOMING">Incoming</option></select>
                        <select value={appId} onChange={(e) => setAppId(e.target.value)} className={inputCls} aria-label="Regarding"><option value="">General</option>{applications.map((a) => <option key={a.id} value={a.id}>{a.jobTitle} · {a.clientName}</option>)}</select>
                    </div>
                    {outgoingMsg && usable.length > 0 && (
                        <select value="" onChange={(e) => { const t = usable.find((x) => x.id === e.target.value); if (t) setF({ ...f, subject: t.renderedSubject ?? f.subject, message: t.renderedBody }); }} className={inputCls} aria-label="Template">
                            <option value="">Use a template…</option>{usable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    )}
                    {(f.channel === "EMAIL" || f.channel === "MEETING" || f.channel === "PHONE") && <input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required={f.channel === "EMAIL"} placeholder={f.channel === "EMAIL" ? "Subject" : "Topic (optional)"} className={inputCls} />}
                    <textarea required rows={6} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder={f.channel === "PHONE" ? "What was discussed?" : "Message"} className={inputCls} />
                    <div className="grid grid-cols-2 gap-2">
                        <select value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} className={inputCls} aria-label="Outcome">{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select>
                        <input type="date" value={f.nextFollowUpDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, nextFollowUpDate: e.target.value })} className={inputCls} title="Follow-up date (creates a task)" aria-label="Follow-up date" />
                    </div>
                    <button disabled={send.isPending || (data?.doNotContact && outgoingMsg)} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">
                        {!outgoingMsg ? "Log" : f.channel === "EMAIL" ? "Send email" : f.channel === "WHATSAPP" ? "Open WhatsApp & log" : "Open SMS & log"}
                    </button>
                </form>
            </SectionCard>
            <SectionCard title="History" subtitle={`${data?.communications.length ?? 0} interaction(s) · ${data?.emails.length ?? 0} email(s)`} className="lg:col-span-3">
                {!data?.communications.length ? <p className="text-xs text-neutral-400 py-6 text-center">No communication logged yet.</p> : (
                    <ul className="space-y-3 text-xs">
                        {data.communications.map((m) => (
                            <li key={m.id} className={`border-l-2 pl-3 ${m.direction === "INCOMING" ? "border-emerald-300" : "border-primary/40"}`}>
                                <p className="font-bold text-neutral-800 flex items-center gap-2 flex-wrap">{m.type} · {m.direction.toLowerCase()} — {m.subject} <Badge value={m.outcome.toUpperCase().replace(/ /g, "_")} label={m.outcome} /></p>
                                <p className="text-neutral-600 whitespace-pre-line mt-0.5">{m.message}</p>
                                <p className="text-neutral-400 mt-0.5">{m.createdByName} · {ago(m.createdAt)}{m.nextFollowUpDate ? ` · follow-up ${m.nextFollowUpDate}` : ""}</p>
                            </li>
                        ))}
                    </ul>
                )}
                {!!data?.emails.length && (
                    <div className="mt-4 pt-3 border-t border-neutral-100">
                        <p className="text-[11px] font-bold text-neutral-500 mb-1.5">Email delivery</p>
                        {data.emails.slice(0, 8).map((m) => <p key={m.id} className="text-[11px] flex justify-between"><span className="truncate">{m.subject}</span><span className={m.status === "FAILED" ? "text-rose-600" : "text-neutral-400"}>{m.status.toLowerCase()} · {ago(m.createdAt)}</span></p>)}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}

