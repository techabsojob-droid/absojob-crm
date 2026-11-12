"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Plus, Search, X } from "lucide-react";
import { ModalShell } from "@/components/shared/ui";
import ResumeAutofill, { type ResumeFile, type ResumeMatch, type ResumeParseResult } from "@/components/ta/ResumeAutofill";
import { api } from "@/lib/api";

const NOTICE_OPTIONS = [["0", "Immediate"], ["15", "15 days"], ["30", "30 days"], ["60", "60 days"], ["90", "90 days"]] as const;
const NOT_ACCEPTING = ["DRAFT", "PENDING_APPROVAL", "FULFILLED", "CLOSED", "CANCELLED", "ON_HOLD"];
const EMPTY = {
    name: "", phone: "", email: "", currentCompany: "", currentDesignation: "", totalExperienceYears: "", relevantExperienceYears: "",
    location: "", preferredLocation: "", noticePeriodDays: "30", currentCtcLpa: "", expectedCtcLpa: "", skills: "", resumeUrl: "", screeningNotes: "",
    linkedinUrl: "", githubUrl: "", portfolioUrl: "", highestQualification: "", certifications: "", source: "DATABASE",
};
const SOURCES = [["DATABASE", "Database / sourcing"], ["JOB_PORTAL", "Job portal (Naukri, Indeed…)"], ["LINKEDIN", "LinkedIn"], ["WALK_IN", "Walk-in"], ["CAMPUS", "Campus"], ["OTHER", "Other"]] as const;
type CvWork = { company: string; designation: string; startDate: string; endDate: string; current: boolean };
type CvEdu = { degree: string; institution: string; year: string };
interface JobOpt { id: string; title: string; requisitionCode?: string; clientName?: string; status: string; skills?: string[] }
interface CandHit { id: string; name: string; candidateCode?: string; email?: string; phone?: string; currentDesignation?: string | null; currentCompany?: string | null; totalExperienceYears?: number; doNotContact?: boolean; blacklisted?: boolean }
export interface AddCandidateResult { candidateId: string; jobId: string | null; applicationId: string | null; created: boolean }

const fld = "w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary outline-none";
const lab = "block text-xs font-bold text-neutral-700 space-y-1";
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/**
 * The one "Add Candidate" flow used across the TA portal: pick an existing candidate from the database, or create
 * a new one (resume upload with auto-fill, duplicate check by email / phone) — optionally straight into a job.
 *  - jobId set: adds to that job (job page)
 *  - jobChoice "required": recruiter must pick a job (pipeline)
 *  - jobChoice "optional": job can be skipped, candidate goes to the talent pool (candidates page, dashboard)
 */
export default function AddCandidateDialog({ jobId, jobTitle, jobSkills, jobChoice = "optional", defaultJobId, inJobCandidateIds, onClose, onDone }: {
    jobId?: string; jobTitle?: string; jobSkills?: string[]; jobChoice?: "required" | "optional"; defaultJobId?: string;
    inJobCandidateIds?: Set<string>; onClose: () => void; onDone?: (r: AddCandidateResult) => void;
}) {
    const qc = useQueryClient();
    const [pickedJob, setPickedJob] = useState(jobId ?? defaultJobId ?? "");
    const targetJob = jobId ?? (pickedJob || null);
    const [mode, setMode] = useState<"existing" | "new">(targetJob ? "existing" : "new");
    const [term, setTerm] = useState("");
    const q = useDeferredValue(term.trim());
    const [c, setC] = useState(EMPTY);
    const [existingMatch, setExistingMatch] = useState<string | null>(null);
    const [resumeFile, setResumeFile] = useState<ResumeFile | null>(null);
    const [cvMissing, setCvMissing] = useState<Set<string>>(new Set());
    const [cvMatches, setCvMatches] = useState<ResumeMatch[]>([]);
    const [cvWork, setCvWork] = useState<CvWork[]>([]);
    const [cvEdu, setCvEdu] = useState<CvEdu[]>([]);
    const [resumeKey, setResumeKey] = useState(0);
    const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });
    const miss = (k: string) => (resumeFile && cvMissing.has(k) ? <span className="ml-1 text-[10px] font-bold text-amber-600">· not in resume</span> : null);

    // Jobs that accept candidates (recruiters only see their own jobs — the API scopes the list)
    const jobs = useQuery<JobOpt[]>({ queryKey: ["ta-jobs"], queryFn: () => api("/api/admin/jobs"), enabled: !jobId });
    const openJobs = (jobs.data ?? []).filter((j) => !NOT_ACCEPTING.includes(j.status));
    const job = jobId ? { id: jobId, title: jobTitle ?? "this job", skills: jobSkills } : openJobs.find((j) => j.id === pickedJob);
    // Candidates already on the chosen job
    const jobApps = useQuery<{ candidateId: string; stage: string }[]>({ queryKey: ["pipeline", "job-apps", targetJob], queryFn: () => api(`/api/ta/applications?jobId=${targetJob}`), enabled: !!targetJob && !inJobCandidateIds });
    const inJob = inJobCandidateIds ?? new Set((Array.isArray(jobApps.data) ? jobApps.data : []).filter((a) => !["REJECTED", "BACKED_OUT", "NOT_INTERESTED", "WITHDRAWN", "BLACKLISTED"].includes(a.stage)).map((a) => a.candidateId));
    const hits = useQuery<CandHit[]>({ queryKey: ["cand-search", q], queryFn: () => api(`/api/admin/candidates?q=${encodeURIComponent(q)}`), enabled: mode === "existing" && q.length >= 2 });

    const reset = () => { setC(EMPTY); setResumeFile(null); setCvMissing(new Set()); setCvMatches([]); setCvWork([]); setCvEdu([]); setResumeKey((k) => k + 1); setExistingMatch(null); };
    const finish = (r: AddCandidateResult) => {
        toast.success(r.applicationId ? `Candidate added to ${job?.title ?? "the job"}` : "Candidate added to the talent pool");
        qc.invalidateQueries();
        onDone?.(r);
        onClose();
    };

    const applyResume = (r: ResumeParseResult, file: ResumeFile) => {
        setResumeFile(file);
        const f = r.fields;
        if (!Object.keys(f).length) { setCvMissing(new Set()); setCvMatches([]); return; } // could not parse: attach only
        // Only overwrite with values the resume actually contains; never invent the rest
        setC((p) => ({
            ...p,
            name: s(f.name) || p.name, email: s(f.email) || p.email, phone: s(f.phone) || p.phone,
            currentCompany: s(f.currentCompany) || p.currentCompany, currentDesignation: s(f.currentDesignation) || p.currentDesignation,
            totalExperienceYears: s(f.totalExperienceYears) || p.totalExperienceYears, relevantExperienceYears: s(f.relevantExperienceYears) || p.relevantExperienceYears,
            location: s(f.location) || p.location,
            noticePeriodDays: f.noticePeriodDays !== null && f.noticePeriodDays !== undefined ? String(f.noticePeriodDays) : "",
            currentCtcLpa: s(f.currentCtcLpa) || p.currentCtcLpa, expectedCtcLpa: s(f.expectedCtcLpa) || p.expectedCtcLpa,
            skills: f.skills?.length ? f.skills.join(", ") : p.skills,
            linkedinUrl: s(f.linkedinUrl) || p.linkedinUrl, githubUrl: s(f.githubUrl) || p.githubUrl, portfolioUrl: s(f.portfolioUrl) || p.portfolioUrl,
            highestQualification: s(f.highestQualification) || p.highestQualification,
            certifications: f.certifications?.length ? f.certifications.join(", ") : p.certifications,
        }));
        setCvWork((f.workExperience ?? []).map((w) => ({ company: s(w.company), designation: s(w.designation), startDate: s(w.startDate), endDate: s(w.endDate), current: !!w.current })));
        setCvEdu((f.education ?? []).map((e) => ({ degree: s(e.degree), institution: s(e.institution), year: s(e.year) })));
        setCvMissing(new Set(r.missing));
        setCvMatches(r.matches ?? []);
        if (f.totalExperienceSource === "FROM_DATES") toast.info("Total experience was calculated from the employment dates in the resume — please confirm.");
    };

    const addExisting = useMutation({
        mutationFn: async (candidateId: string) => {
            if (!targetJob) throw new Error("Pick a job first");
            const a = await api<{ id: string }>("/api/ta/applications", "POST", { candidateId, jobId: targetJob, screeningNotes: c.screeningNotes || null });
            return { candidateId, jobId: targetJob, applicationId: a.id ?? null, created: false };
        },
        onSuccess: finish,
        onError: (e: Error) => toast.error(e.message),
    });

    const create = useMutation({
        mutationFn: async (): Promise<AddCandidateResult> => {
            const res = await fetch("/api/admin/candidates", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...c, resumeUrl: resumeFile ? null : c.resumeUrl || null,
                    skills: c.skills.split(",").map((x) => x.trim()).filter(Boolean),
                    certifications: c.certifications.split(",").map((x) => x.trim()).filter(Boolean),
                    workExperience: cvWork.filter((w) => w.company.trim() || w.designation.trim()),
                    education: cvEdu.filter((e) => e.degree.trim()),
                }),
            });
            const d = await res.json().catch(() => ({}));
            if (res.status === 409 && d.candidateId) { setExistingMatch(d.candidateId); throw new Error(d.error); }
            if (!res.ok) throw new Error(d.error ?? "Could not create candidate");
            // Keep the original resume file on the new profile
            if (resumeFile) {
                const up = await fetch(`/api/ta/candidates/${d.id}/resume`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: resumeFile.name, mimeType: resumeFile.mimeType, dataBase64: resumeFile.dataBase64 }) });
                if (!up.ok) toast.warning(`Candidate saved, but the resume could not be attached: ${(await up.json().catch(() => ({}))).error ?? "upload failed"}. Upload it from the profile.`);
            }
            let applicationId: string | null = null;
            if (targetJob) {
                try { applicationId = (await api<{ id: string }>("/api/ta/applications", "POST", { candidateId: d.id, jobId: targetJob, screeningNotes: c.screeningNotes || null })).id ?? null; }
                catch (e) { toast.warning(`Candidate saved to the talent pool, but not added to the job: ${(e as Error).message}`); }
            }
            return { candidateId: d.id, jobId: targetJob, applicationId, created: true };
        },
        onSuccess: finish,
        onError: (e: Error) => toast.error(e.message),
    });

    const submitNew = (e: React.FormEvent) => {
        e.preventDefault();
        if (jobChoice === "required" && !targetJob) { toast.error("Pick the job to add this candidate to"); return; }
        const digits = c.phone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) { toast.error("Enter a valid phone number (10 digits, optional country code)"); return; }
        if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(c.email.trim())) { toast.error("Enter a valid email address"); return; }
        if (c.totalExperienceYears && c.relevantExperienceYears && Number(c.relevantExperienceYears) > Number(c.totalExperienceYears)) { toast.error("Relevant experience cannot be more than total experience"); return; }
        setExistingMatch(null);
        create.mutate();
    };
    const busy = create.isPending || addExisting.isPending;
    const title = jobId ? `Add Candidate · ${jobTitle ?? "Job"}` : jobChoice === "required" ? "Add Candidate to Pipeline" : "Add Candidate";

    return (
        <ModalShell title={title} onClose={() => { if (!busy) { reset(); onClose(); } }} wide>
            <div className="space-y-4">
                {!jobId && (
                    <label className={lab}>
                        {jobChoice === "required" ? "Job *" : "Add to a job (optional)"}
                        <select value={pickedJob} onChange={(e) => setPickedJob(e.target.value)} className={fld}>
                            <option value="">{jobChoice === "required" ? "Select the job" : "Talent pool only — no job"}</option>
                            {openJobs.map((j) => <option key={j.id} value={j.id}>{j.requisitionCode ? `${j.requisitionCode} · ` : ""}{j.title}{j.clientName ? ` · ${j.clientName}` : ""}</option>)}
                        </select>
                        {jobs.isSuccess && !openJobs.length && <span className="block text-[11px] text-neutral-400 font-medium">No open jobs available{jobChoice === "optional" ? " — the candidate goes to the talent pool" : ""}.</span>}
                    </label>
                )}

                <div className="flex items-center bg-neutral-100 p-0.5 rounded-xl border border-neutral-200/60 w-fit">
                    {([["existing", "From candidate database"], ["new", "New candidate"]] as const).map(([m, l]) => (
                        <button key={m} type="button" onClick={() => setMode(m)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${mode === m ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-800"}`}>{l}</button>
                    ))}
                </div>

                {mode === "existing" ? (
                    <div className="space-y-3">
                        {!targetJob && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Pick a job above to add an existing candidate to it. To add someone new to the talent pool, use “New candidate”.</p>}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name, email, phone, skill or code" className={`${fld} pl-9`} />
                        </div>
                        {q.length < 2 ? <p className="text-xs text-neutral-400 text-center py-4">Type at least 2 characters to search.</p>
                            : hits.isFetching && !hits.data ? <p className="text-xs text-neutral-400 text-center py-4">Searching…</p>
                                : !hits.data?.length ? (
                                    <p className="text-xs text-neutral-400 text-center py-4">No candidate found. <button type="button" onClick={() => setMode("new")} className="font-bold text-primary">Add a new candidate</button></p>
                                ) : (
                                    <ul className="divide-y divide-neutral-100 max-h-80 overflow-y-auto">
                                        {hits.data.slice(0, 25).map((h) => (
                                            <li key={h.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-neutral-900 truncate">{h.name}{h.candidateCode && <span className="font-medium text-neutral-400"> · {h.candidateCode}</span>}</p>
                                                    <p className="text-neutral-500 truncate">{[h.currentDesignation, h.currentCompany].filter(Boolean).join(" at ") || h.email}{h.totalExperienceYears ? ` · ${h.totalExperienceYears} yrs` : ""}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Link href={`/ta/candidates/${h.id}`} target="_blank" className="p-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:text-primary" title="Open profile"><ExternalLink size={12} /></Link>
                                                    {h.blacklisted || h.doNotContact ? <span className="font-bold text-red-600">{h.blacklisted ? "Blacklisted" : "Do not contact"}</span>
                                                        : inJob.has(h.id) ? <span className="font-bold text-emerald-700">Already on this job</span>
                                                            : <button type="button" disabled={!targetJob || busy} onClick={() => addExisting.mutate(h.id)} className="px-3 py-1.5 bg-primary text-white rounded-md font-medium disabled:opacity-40">Add to job</button>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                    </div>
                ) : (
                    <form className="space-y-3" onSubmit={submitNew}>
                        <ResumeAutofill key={resumeKey} jobId={targetJob ?? undefined} onParsed={applyResume} onCleared={reset} />
                        {cvMatches.length > 0 && (
                            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
                                <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5"><AlertTriangle size={13} /> This candidate may already be in your database</p>
                                {cvMatches.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-amber-100 px-3 py-2 text-xs">
                                        <div className="min-w-0">
                                            <p className="font-bold text-neutral-800 truncate">{m.name} <span className="text-neutral-400 font-medium">· {m.candidateCode}</span></p>
                                            <p className="text-neutral-500 truncate">{[m.currentDesignation, m.currentCompany].filter(Boolean).join(" at ") || m.email} · matched on {m.matchedOn.join(" & ")}{m.activeApplications ? ` · ${m.activeApplications} active application${m.activeApplications > 1 ? "s" : ""}` : ""}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Link href={`/ta/candidates/${m.id}`} target="_blank" className="px-2.5 py-1.5 rounded-lg border border-neutral-200 font-bold text-neutral-600 hover:bg-neutral-50 flex items-center gap-1"><ExternalLink size={12} /> Open profile</Link>
                                            {targetJob && (m.inThisJob || inJob.has(m.id)) ? <span className="font-bold text-amber-700">Already on this job</span>
                                                : targetJob ? <button type="button" disabled={busy} onClick={() => addExisting.mutate(m.id)} className="px-2.5 py-1.5 bg-amber-600 text-white rounded-lg font-bold disabled:opacity-50">Add existing to this job</button> : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className={lab}>Candidate Name *{miss("name")}<input required value={c.name} onChange={set("name")} className={fld} /></label>
                            <label className={lab}>Phone Number *{miss("phone")}<input required type="tel" value={c.phone} onChange={set("phone")} className={fld} /></label>
                            <label className={lab}>Email *{miss("email")}<input required type="email" value={c.email} onChange={set("email")} className={fld} /></label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className={lab}>Current Company{miss("currentCompany")}<input value={c.currentCompany} onChange={set("currentCompany")} className={fld} /></label>
                            <label className={lab}>Current Designation{miss("currentDesignation")}<input value={c.currentDesignation} onChange={set("currentDesignation")} className={fld} /></label>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <label className={lab}>Total Exp (yrs){miss("totalExperienceYears")}<input type="number" min="0" max="60" step="0.1" value={c.totalExperienceYears} onChange={set("totalExperienceYears")} className={fld} /></label>
                            <label className={lab}>Relevant Exp (yrs){miss("relevantExperienceYears")}<input type="number" min="0" max="60" step="0.1" value={c.relevantExperienceYears} onChange={set("relevantExperienceYears")} className={fld} /></label>
                            <label className={lab}>Current CTC (LPA){miss("currentCtcLpa")}<input type="number" min="0" step="0.1" value={c.currentCtcLpa} onChange={set("currentCtcLpa")} className={fld} /></label>
                            <label className={lab}>Expected CTC (LPA){miss("expectedCtcLpa")}<input type="number" min="0" step="0.1" value={c.expectedCtcLpa} onChange={set("expectedCtcLpa")} className={fld} /></label>
                            <label className={lab}>Notice Period{c.noticePeriodDays === "" ? " *" : ""}{miss("noticePeriodDays")}
                                <select required value={c.noticePeriodDays} onChange={set("noticePeriodDays")} className={fld}>
                                    {c.noticePeriodDays === "" && <option value="">Confirm with candidate</option>}
                                    {NOTICE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    {c.noticePeriodDays && !NOTICE_OPTIONS.some(([v]) => v === c.noticePeriodDays) && <option value={c.noticePeriodDays}>{c.noticePeriodDays} days</option>}
                                </select>
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className={lab}>Current Location{miss("location")}<input value={c.location} onChange={set("location")} className={fld} /></label>
                            <label className={lab}>Preferred Location<input value={c.preferredLocation} onChange={set("preferredLocation")} placeholder="Mumbai, Pune" className={fld} /></label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className={`${lab} sm:col-span-2`}>Skills (comma separated){miss("skills")}<input value={c.skills} onChange={set("skills")} placeholder={(job?.skills ?? []).join(", ")} className={fld} /></label>
                            <label className={lab}>Source<select value={c.source} onChange={set("source")} className={fld}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                        </div>
                        {resumeFile && (
                            <div className="space-y-3 p-3 rounded-xl border border-neutral-200 bg-neutral-50/50">
                                <p className="text-[11px] font-black uppercase tracking-wide text-neutral-500">From the resume · review & edit</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <label className={lab}>LinkedIn{miss("linkedinUrl")}<input type="url" value={c.linkedinUrl} onChange={set("linkedinUrl")} placeholder="https://linkedin.com/in/…" className={fld} /></label>
                                    <label className={lab}>GitHub<input type="url" value={c.githubUrl} onChange={set("githubUrl")} placeholder="https://github.com/…" className={fld} /></label>
                                    <label className={lab}>Portfolio<input type="url" value={c.portfolioUrl} onChange={set("portfolioUrl")} placeholder="https://…" className={fld} /></label>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <label className={lab}>Highest Qualification{miss("highestQualification")}<input value={c.highestQualification} onChange={set("highestQualification")} className={fld} /></label>
                                    <label className={`${lab} sm:col-span-2`}>Certifications (comma separated)<input value={c.certifications} onChange={set("certifications")} className={fld} /></label>
                                </div>
                                <RowsEditor title="Employment history" empty="No employment history found in the resume." rows={cvWork} onChange={setCvWork}
                                    blank={{ company: "", designation: "", startDate: "", endDate: "", current: false }}
                                    render={(w, upd) => (<>
                                        <input value={w.designation} onChange={(e) => upd({ designation: e.target.value })} placeholder="Designation" className={`${fld} col-span-4`} />
                                        <input value={w.company} onChange={(e) => upd({ company: e.target.value })} placeholder="Company" className={`${fld} col-span-3`} />
                                        <input value={w.startDate} onChange={(e) => upd({ startDate: e.target.value })} placeholder="From" className={`${fld} col-span-2`} />
                                        <input value={w.current ? "Present" : w.endDate} disabled={w.current} onChange={(e) => upd({ endDate: e.target.value })} placeholder="To" className={`${fld} col-span-2`} />
                                    </>)} />
                                <RowsEditor title="Education" empty="No education details found in the resume." rows={cvEdu} onChange={setCvEdu}
                                    blank={{ degree: "", institution: "", year: "" }}
                                    render={(ed, upd) => (<>
                                        <input value={ed.degree} onChange={(e) => upd({ degree: e.target.value })} placeholder="Degree" className={`${fld} col-span-4`} />
                                        <input value={ed.institution} onChange={(e) => upd({ institution: e.target.value })} placeholder="University / College" className={`${fld} col-span-5`} />
                                        <input value={ed.year} onChange={(e) => upd({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Year" className={`${fld} col-span-2`} />
                                    </>)} />
                            </div>
                        )}
                        {!resumeFile && <label className={lab}>Resume URL<input type="url" value={c.resumeUrl} onChange={set("resumeUrl")} placeholder="https://…" className={fld} /></label>}
                        {targetJob && <label className={lab}>Screening notes<textarea rows={2} value={c.screeningNotes} onChange={set("screeningNotes")} className={fld} /></label>}
                        {existingMatch && (
                            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-center justify-between gap-3">
                                <span>A candidate with this email or phone number is already in the database.</span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Link href={`/ta/candidates/${existingMatch}`} target="_blank" className="px-2.5 py-1.5 rounded-lg border border-amber-300 font-bold">Open profile</Link>
                                    {targetJob && (inJob.has(existingMatch) ? <span className="font-bold">Already on this job</span>
                                        : <button type="button" disabled={busy} onClick={() => addExisting.mutate(existingMatch)} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold disabled:opacity-50">Add existing profile</button>)}
                                </div>
                            </div>
                        )}
                        {!resumeFile && <p className="text-[11px] text-neutral-400">No resume uploaded — you can also attach it later from the candidate profile.</p>}
                        <button disabled={busy} className="w-full py-2.5 rounded-md bg-primary text-white font-medium text-xs disabled:opacity-50">
                            {busy ? "Adding…" : targetJob ? `Create candidate & add to ${job?.title ?? "this job"}` : "Create candidate"}
                        </button>
                    </form>
                )}
            </div>
        </ModalShell>
    );
}

function RowsEditor<T>({ title, empty, rows, onChange, blank, render }: {
    title: string; empty: string; rows: T[]; onChange: (r: T[]) => void; blank: T; render: (row: T, upd: (p: Partial<T>) => void) => React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-700">{title}</span>
                <button type="button" onClick={() => onChange([...rows, { ...blank }])} className="text-[11px] font-bold text-primary flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            {!rows.length && <p className="text-[11px] text-neutral-400">{empty}</p>}
            {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                    {render(r, (p) => onChange(rows.map((x, j) => (j === i ? { ...x, ...p } : x))))}
                    <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} title="Remove" className="col-span-1 p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 justify-self-center"><X size={13} /></button>
                </div>
            ))}
        </div>
    );
}
