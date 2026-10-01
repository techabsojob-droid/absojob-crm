"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft, Briefcase, Building2, MapPin, Calendar, GitBranch, AlertTriangle, MessageSquare,
    FileText, Upload, Send, UserPlus, Clock, Mail, Phone, Linkedin,
} from "lucide-react";
import { Badge, SectionCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { btn, fileToPayload, inputCls, Tabs, useAct } from "@/components/finance/kit";
import CandidateComms from "@/components/ta/CandidateComms";
import { api } from "@/lib/api";
import { RelatedTasks } from "@/components/tasks/TaskWidgets";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tab = "overview" | "applications" | "communicate" | "submissions" | "interviews" | "notes" | "activity";

export default function TaCandidateProfilePage() {
    const { id } = useParams<{ id: string }>();
    const [tab, setTab] = useState<Tab>("overview");
    const [noteOpen, setNoteOpen] = useState(false);
    const [note, setNote] = useState({ text: "", category: "General" });
    const [pipeOpen, setPipeOpen] = useState(false);
    const [pipe, setPipe] = useState({ jobId: "", screeningNotes: "", fitScore: "75" });
    const [share, setShare] = useState<any | null>(null);
    const [shareForm, setShareForm] = useState({ note: "", cc: "", attachResume: true });
    const [fb, setFb] = useState<any | null>(null);
    const [fbForm, setFbForm] = useState({ status: "SHORTLISTED", clientFeedback: "", rejectionReason: "" });
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const { data, isLoading, error, refetch } = useQuery<any>({ queryKey: ["ta-candidate-detail", id], queryFn: () => api(`/api/admin/candidates/${id}`) });
    const { data: jobs } = useQuery<any[]>({ queryKey: ["ta-jobs-active"], queryFn: () => api("/api/admin/jobs"), enabled: pipeOpen });

    const addNote = useAct(`/api/admin/candidates/${id}`, "PATCH", ["ta-candidate-detail"], "Note added");
    const addToPipe = useAct("/api/ta/applications", "POST", ["ta-candidate-detail", "pipeline"], "Added to pipeline");
    const shareAct = useAct<{ emailStatus: string; resumeAttached: boolean }>("/api/ta/submissions", "POST", ["ta-candidate-detail", "ta-submissions"], (r) => `Profile ${r.emailStatus === "LOGGED" ? "recorded (mail provider not configured)" : "emailed"} to client${r.resumeAttached ? " with resume" : ""}`);
    const fbAct = useAct<{ nextStep: string | null }>("/api/ta/submissions", "PATCH", ["ta-candidate-detail", "ta-submissions"], (r) => r.nextStep ?? "Feedback recorded");

    if (isLoading) return <SkeletonPulse className="h-[600px] w-full" />;
    if (error || !data?.candidate) return <SectionCard><EmptyState icon={AlertTriangle} message="Candidate not found or you don't have access." /></SectionCard>;

    const c = data.candidate;
    const apps: any[] = data.applications ?? [];
    const subs: any[] = c.clientSubmissions ?? [];
    const resumes = (c.documents ?? []).filter((d: any) => d.type === "RESUME");
    const openApps = apps.filter((a) => !["REJECTED", "BACKED_OUT", "BLACKLISTED", "JOINED"].includes(a.stage));

    const onResume = async (file?: File) => {
        if (!file) return;
        setUploading(true);
        try {
            const r = await api<{ version: number }>(`/api/ta/candidates/${id}/resume`, "POST", await fileToPayload(file));
            toast.success(`Resume v${r.version} uploaded`);
            refetch();
        } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
    };

    return (
        <div className="space-y-6 pb-16">
            <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                        <Link href="/ta/candidates" className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:bg-neutral-50" title="Back to candidates"><ArrowLeft size={16} /></Link>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-black text-neutral-900">{c.name}</h1>
                                <span className="font-mono text-xs font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md">{c.candidateCode}</span>
                                {data.stats?.currentStage && <Badge value={data.stats.currentStage} />}
                                {c.blacklisted && <Badge value="BLACKLISTED" />}
                                {c.doNotContact && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">DO NOT CONTACT</span>}
                            </div>
                            <div className="text-xs text-neutral-500 flex items-center gap-3 mt-1.5 flex-wrap">
                                <span className="font-bold text-neutral-800 flex items-center gap-1"><Briefcase size={13} /> {c.currentDesignation || c.headline || "—"}</span>
                                <span className="flex items-center gap-1"><Building2 size={13} /> {c.currentCompany || "—"}</span>
                                <span className="flex items-center gap-1"><MapPin size={12} /> {c.location || c.currentCity || "—"}</span>
                                <span>Exp <b className="text-neutral-800">{c.totalExperienceYears} yrs</b></span>
                                <span>Notice <b className="text-neutral-800">{c.noticePeriodDays} days</b></span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setPipeOpen(true)} disabled={c.blacklisted} className={`${btn.primary} flex items-center gap-1.5 py-2`}><GitBranch size={14} /> Add to job</button>
                        <button onClick={() => openApps[0] ? setShare(openApps[0]) : toast.error("Add the candidate to a job first")} className={`${btn.ghost} flex items-center gap-1.5 py-2`}><Send size={14} /> Share with client</button>
                        <button onClick={() => setTab("communicate")} className={`${btn.ghost} flex items-center gap-1.5 py-2`}><Mail size={14} /> Contact</button>
                        <button onClick={() => setNoteOpen(true)} className={`${btn.ghost} flex items-center gap-1.5 py-2`}><MessageSquare size={14} /> Note</button>
                        <Link href={`/ta/interviews?candidate=${c.id}`} className={`${btn.ghost} flex items-center gap-1.5 py-2`}><Calendar size={14} /> Interview</Link>
                    </div>
                </div>
                <div className="pt-3 border-t border-neutral-100 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                    <div><p className="text-neutral-400 font-bold uppercase text-[10px]">Contact</p><p className="font-bold text-neutral-800"><a href={`mailto:${c.email}`} className="hover:text-primary">{c.email}</a></p><p><a href={`tel:${c.phone}`} className="hover:text-primary"><Phone size={10} className="inline" /> {c.phone}</a></p></div>
                    <div><p className="text-neutral-400 font-bold uppercase text-[10px]">CTC current → expected</p><p className="font-bold text-neutral-800">₹{c.currentCtcLpa}L → <span className="text-emerald-700">₹{c.expectedCtcLpa}L</span></p></div>
                    <div><p className="text-neutral-400 font-bold uppercase text-[10px]">Source</p><p className="font-bold text-neutral-800">{String(c.source).replace(/_/g, " ")}{data.referredByUser ? ` · ${data.referredByUser.name}` : ""}</p></div>
                    <div><p className="text-neutral-400 font-bold uppercase text-[10px]">Resume</p>{resumes[0] ? <a href={resumes[0].fileUrl} target="_blank" rel="noopener" className="font-bold text-primary flex items-center gap-1"><FileText size={12} /> v{resumes[0].version} · {resumes[0].name}</a> : c.resumeUrl ? <a href={c.resumeUrl} target="_blank" rel="noopener" className="font-bold text-primary">Open</a> : <span className="text-amber-700 font-bold">Not uploaded</span>}</div>
                    <div className="flex items-end"><input ref={fileRef} type="file" accept=".pdf,.doc,.docx" hidden onChange={(e) => onResume(e.target.files?.[0])} /><button disabled={uploading} onClick={() => fileRef.current?.click()} className={`${btn.soft} flex items-center gap-1`}><Upload size={12} /> {uploading ? "Uploading…" : "Upload resume"}</button></div>
                </div>
            </div>

            <Tabs<Tab> value={tab} onChange={setTab} tabs={[
                { id: "overview", label: "Overview" },
                { id: "applications", label: `Applications (${apps.length})` },
                { id: "communicate", label: `Communicate (${c.communications?.length ?? 0})` },
                { id: "submissions", label: `Client submissions (${subs.length})` },
                { id: "interviews", label: `Interviews (${data.allInterviews?.length ?? 0})` },
                { id: "notes", label: `Notes (${c.notes?.length ?? 0})` },
                { id: "activity", label: "Timeline" },
            ]} />

            {tab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <RelatedTasks relatedType="CANDIDATE" relatedId={c.id} recordName={c.name} />
                        <SectionCard title="Summary"><p className="text-sm text-neutral-700 leading-relaxed">{c.bio || c.headline || "No summary added."}</p></SectionCard>
                        <SectionCard title="Skills"><div className="flex flex-wrap gap-2">{(c.skills ?? []).length ? c.skills.map((s: string) => <span key={s} className="px-3 py-1 bg-primary/10 text-primary font-bold rounded-lg text-xs">{s}</span>) : <span className="text-xs text-neutral-400">No skills listed</span>}</div></SectionCard>
                        <SectionCard title="Work experience">
                            {(c.workExperience ?? []).length === 0 ? <p className="text-xs text-neutral-400">Not added.</p> : (
                                <ul className="space-y-3 text-xs">{c.workExperience.map((w: any, i: number) => <li key={i}><p className="font-bold text-neutral-900">{w.designation ?? w.title} · {w.company ?? w.companyName}</p><p className="text-neutral-500">{w.startDate ?? w.from} – {w.endDate ?? w.to ?? "Present"}</p></li>)}</ul>
                            )}
                        </SectionCard>
                    </div>
                    <div className="space-y-6">
                        {data.referral && (
                            <SectionCard title="Referral">
                                <div className="text-xs space-y-1.5">
                                    <p className="flex items-center gap-1.5"><UserPlus size={12} /> <b>{data.referredByUser?.name ?? "—"}</b> <Badge value={data.referredByUser?.role ?? "AGENT"} /></p>
                                    <p>Status <Badge value={data.referral.status} /> {data.referral.jobTitle ? `· ${data.referral.jobTitle}` : ""}</p>
                                    {data.referral.agentNotes && <p className="text-neutral-600">“{data.referral.agentNotes}”</p>}
                                    <Link href="/ta/referrals" className="font-bold text-primary">Open referral thread →</Link>
                                </div>
                            </SectionCard>
                        )}
                        <SectionCard title="Documents">
                            {(c.documents ?? []).length === 0 ? <p className="text-xs text-neutral-400">No documents.</p> : (
                                <ul className="space-y-2 text-xs">{c.documents.map((d: any) => <li key={d.id} className="flex justify-between gap-2"><a href={d.fileUrl} target="_blank" rel="noopener" className="font-semibold hover:text-primary truncate">{d.name}</a><span className="text-neutral-400 shrink-0">{d.type.replace(/_/g, " ").toLowerCase()} v{d.version}</span></li>)}</ul>
                            )}
                        </SectionCard>
                        <SectionCard title="Links">
                            <div className="text-xs space-y-1.5">
                                {c.linkedinUrl ? <a href={c.linkedinUrl} target="_blank" rel="noopener" className="flex items-center gap-1 text-primary font-bold"><Linkedin size={12} /> LinkedIn</a> : <p className="text-neutral-400">No LinkedIn</p>}
                                {c.portfolioUrl && <a href={c.portfolioUrl} target="_blank" rel="noopener" className="text-primary font-bold block">Portfolio</a>}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            )}

            {tab === "applications" && (
                <SectionCard title="Job applications">
                    {apps.length === 0 ? <EmptyState icon={Briefcase} message="Not in any job pipeline yet." action={<button onClick={() => setPipeOpen(true)} className={btn.primary}>Add to job</button>} /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">
                            {apps.map((a) => {
                                const offer = (c.offers ?? []).find((o: any) => o.applicationId === a.id);
                                const shared = subs.find((s) => s.applicationId === a.id);
                                return (
                                    <li key={a.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="font-semibold">{a.jobTitle} <span className="text-neutral-400 font-normal">· {a.clientName}</span></p>
                                            <p className="text-[11px] text-neutral-500">Owner {a.recruiterName} · fit {a.fitScore}% · {a.interviews.length} interview(s){offer ? ` · offer ${offer.status.toLowerCase()} (${offer.offeredCtcLpa} LPA)` : ""}{shared ? ` · shared with client (${shared.status.replace(/_/g, " ").toLowerCase()})` : ""}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge value={a.stage} />
                                            {!shared && !["REJECTED", "BACKED_OUT", "BLACKLISTED", "JOINED"].includes(a.stage) && <button onClick={() => setShare(a)} className={btn.soft}><Send size={11} className="inline" /> Share CV</button>}
                                            <Link href={`/ta/pipeline?candidate=${c.id}`} className={btn.ghost}>Pipeline</Link>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </SectionCard>
            )}

            {tab === "communicate" && <CandidateComms candidateId={c.id} applications={apps.map((a) => ({ id: a.id, jobTitle: a.jobTitle, clientName: a.clientName, stage: a.stage }))} />}

            {tab === "submissions" && (
                <SectionCard title="Profiles shared with clients" action={openApps.length > 0 && <button onClick={() => setShare(openApps[0])} className={btn.primary}>Share with client</button>}>
                    {subs.length === 0 ? <EmptyState icon={Send} message="This profile has not been shared with any client yet." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">
                            {subs.map((s) => (
                                <li key={s.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                        <p className="font-semibold">{s.clientName} <span className="text-neutral-400 font-normal">· {s.jobTitle}</span></p>
                                        <p className="text-[11px] text-neutral-500">{s.submittedAt.slice(0, 10)} by {s.submittedBy}{s.emailedTo?.length ? ` · emailed ${s.emailedTo.join(", ")}` : ""}</p>
                                        {(s.clientFeedback || s.rejectionReason) && <p className="text-xs text-neutral-700 mt-0.5">“{s.rejectionReason ?? s.clientFeedback}”</p>}
                                    </div>
                                    <div className="flex items-center gap-2"><Badge value={s.status} /><button onClick={() => { setFb(s); setFbForm({ status: s.status === "PENDING_REVIEW" ? "SHORTLISTED" : s.status, clientFeedback: s.clientFeedback ?? "", rejectionReason: s.rejectionReason ?? "" }); }} className={btn.ghost}>Record feedback</button></div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            {tab === "interviews" && (
                <SectionCard title="Interviews" action={<Link href={`/ta/interviews?candidate=${c.id}`} className={btn.primary}>Schedule</Link>}>
                    {!data.allInterviews?.length ? <EmptyState icon={Calendar} message="No interviews yet." /> : (
                        <ul className="divide-y divide-neutral-100 text-sm">
                            {data.allInterviews.map((i: any) => (
                                <li key={i.id} className="py-3 flex justify-between gap-3">
                                    <div><p className="font-semibold">{i.round.replace(/_/g, " ")} · {i.jobTitle}</p><p className="text-[11px] text-neutral-500">{new Date(i.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {i.mode.toLowerCase()} · {i.interviewerName}</p>{i.feedback && <p className="text-xs text-neutral-700 mt-0.5">“{i.feedback}”{i.score ? ` · ${i.score}/10` : ""}</p>}</div>
                                    <div className="flex flex-col items-end gap-1"><Badge value={i.status} />{i.outcome !== "PENDING" && <Badge value={i.outcome} />}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            {tab === "notes" && (
                <SectionCard title="Recruiter notes" action={<button onClick={() => setNoteOpen(true)} className={btn.primary}>Add note</button>}>
                    {!(c.notes ?? []).length ? <p className="text-xs text-neutral-400 text-center py-6">No notes yet.</p> : (
                        <ul className="space-y-3">{c.notes.map((n: any) => <li key={n.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-xs"><div className="flex justify-between"><b>{n.category}</b><span className="text-neutral-400">{n.authorName} · {new Date(n.createdAt).toLocaleDateString("en-IN")}</span></div><p className="text-neutral-700 mt-1 whitespace-pre-line">{n.text}</p></li>)}</ul>
                    )}
                </SectionCard>
            )}

            {tab === "activity" && (
                <SectionCard title="Candidate journey">
                    {!(data.timeline ?? []).length ? <p className="text-xs text-neutral-400">No activity.</p> : (
                        <ol className="relative border-l border-neutral-200 ml-2 space-y-4">
                            {[...data.timeline].sort((a: any, b: any) => +new Date(b.date) - +new Date(a.date)).map((t: any, i: number) => (
                                <li key={i} className="ml-4 text-xs"><span className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary/70 border-2 border-white" /><p className="font-bold text-neutral-900">{t.title}</p><p className="text-neutral-500">{t.detail}</p><p className="text-neutral-400 flex items-center gap-1"><Clock size={10} /> {new Date(t.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></li>
                            ))}
                        </ol>
                    )}
                </SectionCard>
            )}

            {noteOpen && (
                <ModalShell title="Add note" onClose={() => setNoteOpen(false)}>
                    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); addNote.mutate({ newNote: note }, { onSuccess: () => { setNoteOpen(false); setNote({ text: "", category: "General" }); } }); }}>
                        <select value={note.category} onChange={(e) => setNote({ ...note, category: e.target.value })} className={inputCls} aria-label="Category">{["General", "Screening", "Salary", "Client Feedback", "Interview", "Compliance"].map((x) => <option key={x}>{x}</option>)}</select>
                        <textarea required rows={5} value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} className={inputCls} placeholder="Note" />
                        <button disabled={addNote.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50">Save note</button>
                    </form>
                </ModalShell>
            )}

            {pipeOpen && (
                <ModalShell title="Add to a job pipeline" onClose={() => setPipeOpen(false)}>
                    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); addToPipe.mutate({ candidateId: c.id, jobId: pipe.jobId, screeningNotes: pipe.screeningNotes, fitScore: Number(pipe.fitScore) || 0 }, { onSuccess: () => { setPipeOpen(false); setTab("applications"); } }); }}>
                        <select required value={pipe.jobId} onChange={(e) => setPipe({ ...pipe, jobId: e.target.value })} className={inputCls} aria-label="Job">
                            <option value="">Select job…</option>
                            {(jobs ?? []).filter((j) => !["FULFILLED", "CLOSED", "CANCELLED", "DRAFT", "PENDING_APPROVAL", "ON_HOLD"].includes(j.status) && !apps.some((a) => a.jobId === j.id)).map((j) => <option key={j.id} value={j.id}>{j.title} · {j.clientName ?? j.client?.companyName ?? ""}</option>)}
                        </select>
                        <label className="block text-xs font-bold text-neutral-600">Fit score (0–100)<input type="number" min="0" max="100" value={pipe.fitScore} onChange={(e) => setPipe({ ...pipe, fitScore: e.target.value })} className={inputCls} /></label>
                        <textarea rows={3} value={pipe.screeningNotes} onChange={(e) => setPipe({ ...pipe, screeningNotes: e.target.value })} className={inputCls} placeholder="Screening notes" />
                        <button disabled={addToPipe.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50">Add to pipeline</button>
                    </form>
                </ModalShell>
            )}

            {share && (
                <ModalShell title="Share profile with client" onClose={() => setShare(null)} wide>
                    <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); shareAct.mutate({ applicationId: share.id, note: shareForm.note, cc: shareForm.cc.split(",").map((x) => x.trim()).filter(Boolean), attachResume: shareForm.attachResume }, { onSuccess: () => { setShare(null); setShareForm({ note: "", cc: "", attachResume: true }); setTab("submissions"); } }); }}>
                        <select value={share.id} onChange={(e) => setShare(openApps.find((a) => a.id === e.target.value))} className={inputCls} aria-label="Application">{openApps.map((a) => <option key={a.id} value={a.id}>{a.jobTitle} · {a.clientName}</option>)}</select>
                        <p className="text-xs text-neutral-500">The client contact receives a profile summary (role, experience, CTC, notice, skills){resumes[0] ? " with the latest resume attached" : ""}. Replies come to your email.</p>
                        <textarea rows={4} value={shareForm.note} onChange={(e) => setShareForm({ ...shareForm, note: e.target.value })} className={inputCls} placeholder="Why this candidate fits (optional)" />
                        <input value={shareForm.cc} onChange={(e) => setShareForm({ ...shareForm, cc: e.target.value })} className={inputCls} placeholder="CC (comma separated, optional)" />
                        <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={shareForm.attachResume} disabled={!resumes[0] && !data.referral?.resumeFileId} onChange={(e) => setShareForm({ ...shareForm, attachResume: e.target.checked })} /> Attach resume{!resumes[0] && !data.referral?.resumeFileId ? " (none uploaded)" : ""}</label>
                        <button disabled={shareAct.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"><Send size={14} /> Email to client</button>
                    </form>
                </ModalShell>
            )}

            {fb && (
                <ModalShell title={`${fb.clientName} feedback`} onClose={() => setFb(null)}>
                    <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); fbAct.mutate({ candidateId: c.id, submissionId: fb.id, ...fbForm }, { onSuccess: () => setFb(null) }); }}>
                        <select value={fbForm.status} onChange={(e) => setFbForm({ ...fbForm, status: e.target.value })} className={inputCls} aria-label="Client decision"><option value="SHORTLISTED">Shortlisted</option><option value="INTERVIEW_REQUESTED">Interview requested</option><option value="REJECTED">Rejected</option><option value="PENDING_REVIEW">Still reviewing</option></select>
                        <textarea rows={3} value={fbForm.clientFeedback} onChange={(e) => setFbForm({ ...fbForm, clientFeedback: e.target.value })} className={inputCls} placeholder="Client's comments" />
                        {fbForm.status === "REJECTED" && <input required value={fbForm.rejectionReason} onChange={(e) => setFbForm({ ...fbForm, rejectionReason: e.target.value })} className={inputCls} placeholder="Rejection reason *" />}
                        <button disabled={fbAct.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Save</button>
                    </form>
                </ModalShell>
            )}
        </div>
    );
}
