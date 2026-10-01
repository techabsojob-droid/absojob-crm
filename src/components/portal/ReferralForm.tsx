"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { ModalShell } from "@/components/shared/ui";
import { fileToPayload, inputCls, money, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export interface OpenJob { id: string; title: string; clientName: string | null; location: string; experienceMinYears: number; experienceMaxYears: number; salaryMinLpa: number; salaryMaxLpa: number; skills: string[]; incentiveEstimate: number }

const EMPTY = { name: "", email: "", phone: "", currentCompany: "", currentDesignation: "", location: "", totalExperienceYears: "", currentCtcLpa: "", expectedCtcLpa: "", noticePeriodDays: "", skills: "", agentNotes: "", consent: false };

/** Full referral submission: candidate details, resume, consent. */
export default function ReferralForm({ open, onClose, jobId: initialJob }: { open: boolean; onClose: () => void; jobId?: string }) {
    const { user } = useAuth();
    const { data: jobs = [] } = useQuery<OpenJob[]>({ queryKey: ["portal-open-jobs"], queryFn: () => api("/api/portal/jobs"), enabled: open });
    const [jobId, setJobId] = useState(initialJob ?? "");
    const [f, setF] = useState(EMPTY);
    const [resume, setResume] = useState<File | null>(null);
    const submit = useAct("/api/portal/referrals", "POST", ["portal-referrals", "my-referrals", "portal-open-jobs", "portal-dashboard"], "Referral submitted — the recruitment team has been notified");
    const job = jobs.find((j) => j.id === (jobId || initialJob));
    const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
    const resumeRequired = user?.role === "AGENT";

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let payload;
        try { payload = resume ? await fileToPayload(resume) : undefined; } catch (err) { alert((err as Error).message); return; }
        submit.mutate({ ...f, jobId: jobId || initialJob || undefined, resume: payload }, { onSuccess: () => { setF(EMPTY); setResume(null); onClose(); } });
    };

    return (
        <ModalShell open={open} onClose={onClose} title="Refer a candidate" wide>
            <form onSubmit={onSubmit} className="space-y-4 text-sm">
                <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Job</label>
                    <select value={jobId || initialJob || ""} onChange={(e) => setJobId(e.target.value)} className={inputCls} aria-label="Job">
                        <option value="">General referral (no specific job)</option>
                        {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.clientName ? ` — ${j.clientName}` : ""} · {j.location}</option>)}
                    </select>
                    {job && <p className="text-[11px] text-neutral-500 mt-1">Needs {job.experienceMinYears}–{job.experienceMaxYears} yrs · {job.salaryMinLpa}–{job.salaryMaxLpa} LPA · {job.skills.slice(0, 5).join(", ")} · est. incentive <b className="text-emerald-700">{money(job.incentiveEstimate)}</b></p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input required value={f.name} onChange={set("name")} placeholder="Candidate full name *" className={inputCls} />
                    <input required type="email" value={f.email} onChange={set("email")} placeholder="Email *" className={inputCls} />
                    <input required type="tel" value={f.phone} onChange={set("phone")} placeholder="Mobile *" className={inputCls} />
                    <input value={f.currentCompany} onChange={set("currentCompany")} placeholder="Current company" className={inputCls} />
                    <input value={f.currentDesignation} onChange={set("currentDesignation")} placeholder="Current designation" className={inputCls} />
                    <input value={f.location} onChange={set("location")} placeholder="Current city" className={inputCls} />
                    <input type="number" min="0" max="50" step="0.5" value={f.totalExperienceYears} onChange={set("totalExperienceYears")} placeholder="Experience (yrs)" className={inputCls} />
                    <input type="number" min="0" step="0.1" value={f.currentCtcLpa} onChange={set("currentCtcLpa")} placeholder="Current CTC (LPA)" className={inputCls} />
                    <input type="number" min="0" step="0.1" value={f.expectedCtcLpa} onChange={set("expectedCtcLpa")} placeholder="Expected CTC (LPA)" className={inputCls} />
                    <input type="number" min="0" max="180" value={f.noticePeriodDays} onChange={set("noticePeriodDays")} placeholder="Notice (days)" className={inputCls} />
                    <input value={f.skills} onChange={set("skills")} placeholder="Key skills (comma separated)" className={`${inputCls} sm:col-span-2`} />
                </div>
                <label className={`${inputCls} flex items-center gap-2 cursor-pointer`}>
                    <Upload size={14} className="text-neutral-400" />
                    <span className="truncate text-neutral-600">{resume ? resume.name : `Resume (PDF / Word, max 5 MB)${resumeRequired ? " *" : ""}`}</span>
                    <input type="file" accept=".pdf,.doc,.docx" hidden onChange={(e) => setResume(e.target.files?.[0] ?? null)} />
                </label>
                <textarea rows={3} value={f.agentNotes} onChange={set("agentNotes")} placeholder="Why is this candidate a good fit? Availability for interviews, reason for change…" className={inputCls} />
                <label className="flex items-start gap-2 text-xs text-neutral-600">
                    <input type="checkbox" required checked={f.consent} onChange={set("consent")} className="mt-0.5" />
                    <span>The candidate has agreed to be referred to AbsoJob for this opportunity and to share their details with our clients.</span>
                </label>
                <button disabled={submit.isPending || (resumeRequired && !resume)} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">{submit.isPending ? "Submitting…" : "Submit referral"}</button>
            </form>
        </ModalShell>
    );
}
