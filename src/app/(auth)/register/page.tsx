"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, CheckCircle2, Handshake, IndianRupee, ShieldCheck, Upload } from "lucide-react";
import { fileToPayload } from "@/components/finance/kit";

const field = "w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none";
const label = "block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5";

const EMPTY = { name: "", email: "", phone: "", city: "", experienceYears: "", specialization: "", sourcingChannels: "", pan: "", bankName: "", bankAccountNumber: "", bankIfsc: "", upiId: "", password: "", confirm: "", acceptAgreement: false };

export default function RegisterPartnerPage() {
    const [mode, setMode] = useState<"apply" | "resubmit">("apply");
    const [f, setF] = useState(EMPTY);
    const [idProof, setIdProof] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState("");
    const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (mode === "apply" && f.password !== f.confirm) return setError("Passwords do not match");
        setBusy(true);
        try {
            const payload = mode === "apply"
                ? { ...f, confirm: undefined, idProof: idProof ? await fileToPayload(idProof) : undefined }
                : { email: f.email, password: f.password, pan: f.pan || undefined, idProof: idProof ? await fileToPayload(idProof) : undefined };
            const res = await fetch("/api/auth/register", { method: mode === "apply" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not submit");
            setDone(data.message);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    if (done) return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
            <div className="max-w-md w-full bg-white rounded-3xl border border-neutral-200 p-8 text-center space-y-4">
                <CheckCircle2 className="mx-auto text-emerald-500" size={48} />
                <h1 className="text-2xl font-bold">Application received</h1>
                <p className="text-sm text-neutral-600">{done}</p>
                <Link href="/login" className="inline-block px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm">Back to sign in</Link>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5 bg-neutral-50">
            <div className="hidden lg:flex lg:col-span-2 flex-col justify-between p-12 bg-primary text-white">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center"><Briefcase className="text-primary" size={20} /></div><span className="text-2xl font-bold">Abso<span className="text-white/70">Job</span> Partners</span></div>
                <div className="space-y-6">
                    <h1 className="text-4xl font-bold leading-tight">Refer talent.<br />Earn on every joining.</h1>
                    <ul className="space-y-4 text-sm text-white/85">
                        <li className="flex gap-3"><Handshake size={18} className="shrink-0" /> Access live mandates from our clients — IT, BFSI, retail, healthcare and more.</li>
                        <li className="flex gap-3"><IndianRupee size={18} className="shrink-0" /> ₹5,000 – ₹25,000 per successful joining, by offered CTC. Paid within 30 days of joining.</li>
                        <li className="flex gap-3"><ShieldCheck size={18} className="shrink-0" /> Transparent tracking — interview status, offers, payouts and TDS in your portal.</li>
                    </ul>
                </div>
                <p className="text-xs text-white/60">© 2026 AbsoJob Inc.</p>
            </div>

            <div className="lg:col-span-3 flex justify-center p-6 lg:p-12">
                <div className="w-full max-w-2xl space-y-6">
                    <div>
                        <h2 className="text-3xl font-bold text-neutral-900">{mode === "apply" ? "Become a recruitment partner" : "Resubmit KYC"}</h2>
                        <p className="text-neutral-500 mt-1 text-sm">{mode === "apply" ? "Apply once — our team verifies your KYC (usually within 2 working days) and activates your account." : "Your KYC was sent back. Sign in with your registered email and password and upload the corrected details."}</p>
                        <div className="flex gap-2 mt-4">
                            {(["apply", "resubmit"] as const).map((m) => <button key={m} type="button" onClick={() => { setMode(m); setError(""); }} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${mode === m ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>{m === "apply" ? "New application" : "Resubmit KYC"}</button>)}
                        </div>
                    </div>

                    <form onSubmit={submit} className="space-y-6 bg-white rounded-3xl border border-neutral-200 p-6">
                        {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium">{error}</div>}

                        {mode === "apply" && (
                            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <legend className="text-sm font-bold text-neutral-900 mb-3">About you</legend>
                                <div><label className={label} htmlFor="name">Full name *</label><input id="name" required value={f.name} onChange={set("name")} className={field} /></div>
                                <div><label className={label} htmlFor="phone">Mobile *</label><input id="phone" required type="tel" value={f.phone} onChange={set("phone")} className={field} placeholder="+91 98xxxxxxx" /></div>
                                <div><label className={label} htmlFor="city">City *</label><input id="city" required value={f.city} onChange={set("city")} className={field} /></div>
                                <div><label className={label} htmlFor="exp">Recruiting experience (years)</label><input id="exp" type="number" min="0" max="50" value={f.experienceYears} onChange={set("experienceYears")} className={field} /></div>
                                <div><label className={label} htmlFor="spec">Industries you hire for</label><input id="spec" value={f.specialization} onChange={set("specialization")} className={field} placeholder="IT, BFSI, Retail" /></div>
                                <div><label className={label} htmlFor="src">Sourcing channels</label><input id="src" value={f.sourcingChannels} onChange={set("sourcingChannels")} className={field} placeholder="LinkedIn, Naukri, network" /></div>
                            </fieldset>
                        )}

                        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <legend className="text-sm font-bold text-neutral-900 mb-3">{mode === "apply" ? "Login" : "Your account"}</legend>
                            <div className="sm:col-span-2"><label className={label} htmlFor="email">Email *</label><input id="email" required type="email" value={f.email} onChange={set("email")} className={field} autoComplete="email" /></div>
                            <div><label className={label} htmlFor="pw">Password *</label><input id="pw" required type="password" minLength={mode === "apply" ? 8 : 1} value={f.password} onChange={set("password")} className={field} autoComplete={mode === "apply" ? "new-password" : "current-password"} />{mode === "apply" && <p className="text-[11px] text-neutral-400 mt-1">8+ characters with a letter and a number</p>}</div>
                            {mode === "apply" && <div><label className={label} htmlFor="pw2">Confirm password *</label><input id="pw2" required type="password" value={f.confirm} onChange={set("confirm")} className={field} autoComplete="new-password" /></div>}
                        </fieldset>

                        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <legend className="text-sm font-bold text-neutral-900 mb-3">KYC & payouts</legend>
                            <div><label className={label} htmlFor="pan">PAN {mode === "apply" && "*"}</label><input id="pan" required={mode === "apply"} value={f.pan} onChange={set("pan")} className={`${field} uppercase`} placeholder="ABCDE1234F" maxLength={10} /></div>
                            <div>
                                <label className={label}>ID proof (PAN / Aadhaar, PDF or image)</label>
                                <label className={`${field} flex items-center gap-2 cursor-pointer`}><Upload size={14} className="text-neutral-400" /><span className="truncate text-neutral-600">{idProof ? idProof.name : "Choose file (max 5 MB)"}</span><input type="file" accept=".pdf,image/*" hidden onChange={(e) => setIdProof(e.target.files?.[0] ?? null)} /></label>
                            </div>
                            {mode === "apply" && <>
                                <div><label className={label} htmlFor="bank">Bank name</label><input id="bank" value={f.bankName} onChange={set("bankName")} className={field} /></div>
                                <div><label className={label} htmlFor="acc">Account number</label><input id="acc" inputMode="numeric" value={f.bankAccountNumber} onChange={set("bankAccountNumber")} className={field} /></div>
                                <div><label className={label} htmlFor="ifsc">IFSC</label><input id="ifsc" value={f.bankIfsc} onChange={set("bankIfsc")} className={`${field} uppercase`} maxLength={11} /></div>
                                <div><label className={label} htmlFor="upi">or UPI ID</label><input id="upi" value={f.upiId} onChange={set("upiId")} className={field} placeholder="name@bank" /></div>
                                <p className="sm:col-span-2 text-[11px] text-neutral-400">Add a bank account or UPI ID. TDS under section 194H is deducted from incentives.</p>
                            </>}
                        </fieldset>

                        {mode === "apply" && (
                            <label className="flex items-start gap-2.5 text-xs text-neutral-600">
                                <input type="checkbox" checked={f.acceptAgreement} onChange={set("acceptAgreement")} className="mt-0.5" required />
                                <span>I accept the partner agreement: I will refer only candidates who have agreed to be represented, share accurate information, and understand that a candidate referred by another partner in the last 90 days cannot be claimed. Incentives are paid after joining and recovered if the candidate leaves within the client&apos;s guarantee period.</span>
                            </label>
                        )}

                        <button disabled={busy} className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-60">{busy ? "Submitting…" : mode === "apply" ? "Submit application" : "Resubmit for verification"}</button>
                        <p className="text-center text-sm text-neutral-500">Already a partner? <Link href="/login" className="font-bold text-primary">Sign in</Link></p>
                    </form>
                </div>
            </div>
        </div>
    );
}
