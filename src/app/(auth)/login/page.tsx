"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { roleHome } from "@/lib/types";

/** The hiring flow the CRM runs, stage by stage. Descriptions name what the product actually does there. */
const STAGES = [
    { name: "Requisition", note: "Client brief, budget and SLA, approved before it goes live" },
    { name: "Sourcing", note: "Recruiters assigned and their sourcing tasks created" },
    { name: "Screening", note: "CVs parsed, calls logged, follow-ups scheduled" },
    { name: "Interview", note: "Rounds scheduled with feedback against each candidate" },
    { name: "Offer", note: "Offer approvals and documents in one place" },
    { name: "Joining", note: "Placement recorded, invoiced and paid out" },
];

function HiringTrack() {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);

    // Steps through the stages slowly; stays put for reduced-motion users or while hovered
    useEffect(() => {
        if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const t = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 2800);
        return () => clearInterval(t);
    }, [paused]);

    return (
        <ol className="relative" onMouseLeave={() => setPaused(false)}>
            {STAGES.map((s, i) => {
                const on = i === active;
                const done = i < active;
                return (
                    <li key={s.name} onMouseEnter={() => { setPaused(true); setActive(i); }}
                        className="relative pl-8 py-[9px] cursor-default">
                        {i < STAGES.length - 1 && (
                            <span className={`absolute left-[5px] top-[26px] -bottom-[15px] w-px transition-colors duration-500 ${done ? "bg-accent" : "bg-white/[0.12]"}`} aria-hidden />
                        )}
                        <span className={`absolute left-0 top-[15px] w-[11px] h-[11px] rounded-full border transition-colors duration-500
                            ${on ? "bg-accent border-accent" : done ? "bg-[#6A82A6] border-[#6A82A6]" : "bg-navy border-white/25"}`} aria-hidden />
                        <div className="flex items-baseline gap-3">
                            <span className="font-mono text-[11px] tabular-nums text-[#6A82A6] w-5">{String(i + 1).padStart(2, "0")}</span>
                            <span className={`text-[15px] transition-colors duration-500 ${on ? "text-white font-medium" : "text-[#94A6C3]"}`}>{s.name}</span>
                        </div>
                        <p className={`ml-8 text-[13px] leading-snug text-[#BDC9DC] overflow-hidden transition-all duration-500 ${on ? "max-h-10 opacity-100 mt-1" : "max-h-0 opacity-0"}`}>{s.note}</p>
                    </li>
                );
            })}
        </ol>
    );
}

const noSubscribe = () => () => {};

export default function LoginPage() {
    const { user } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    // Explains why the person landed back here (set by the proxy / session watcher)
    const reason = useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).get("reason"), () => null);
    const notice = reason === "signed-out" || reason === "expired" ? "You were signed out (inactivity or an admin action). Please sign in again." : "";
    // Two-step sign-in: "code" asks for the app code, "setup" enrols an authenticator first
    const [step, setStep] = useState<"password" | "code" | "setup">("password");
    const [challenge, setChallenge] = useState("");
    const [code, setCode] = useState("");
    const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string; otpauthUrl: string } | null>(null);

    useEffect(() => {
        if (!user) return;
        window.location.href = roleHome(user.role);
    }, [user]);

    const backToPassword = () => {
        setStep("password");
        setChallenge("");
        setCode("");
        setSetup(null);
        setPassword("");
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(step === "password" ? { email, password } : { challenge, code }),
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                setError(result.error || "Login failed");
                if (result.restart) backToPassword();
                if (step !== "password") setCode("");
                setIsLoading(false);
                return;
            }

            if (result.mfaRequired || result.mfaSetupRequired) {
                setChallenge(result.challenge);
                setSetup(result.mfaSetupRequired ? { secret: result.secret, qrDataUrl: result.qrDataUrl, otpauthUrl: result.otpauthUrl } : null);
                setStep(result.mfaSetupRequired ? "setup" : "code");
                setCode("");
                setIsLoading(false);
                return;
            }

            if (result.redirect) {
                // Hard navigation so middleware + session cookie are picked up fresh
                window.location.href = result.redirect;
            }
        } catch {
            setError("Something went wrong");
            setIsLoading(false);
        }
    };

    const field = "w-full h-11 px-3 rounded-md border border-neutral-300 bg-white text-[14px] text-neutral-800 outline-none focus:border-navy placeholder:text-neutral-400";
    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] bg-white">
            {/* Brand panel */}
            <aside className="hidden lg:flex flex-col bg-navy text-white px-14 xl:px-20 py-12 relative overflow-hidden">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-[14px] font-bold">AJ</span>
                    <span className="text-[18px] font-semibold tracking-tight">AbsoJob</span>
                    <span className="ml-2 pl-3 border-l border-white/15 text-[12px] text-[#94A6C3]">Recruitment CRM</span>
                </div>

                <div className="flex-1 flex flex-col justify-center max-w-[460px] py-12">
                    <h1 className="text-[38px] xl:text-[42px] leading-[1.1] font-semibold text-white tracking-[-0.02em]">
                        From requisition<br />to joining, on<br />one record.
                    </h1>
                    <span className="block mt-6 w-10 h-[3px] bg-accent" aria-hidden />
                    <div className="mt-12">
                        <HiringTrack />
                    </div>
                </div>

                <div className="flex items-center justify-between text-[12px] text-[#6A82A6]">
                    <span>© {new Date().getFullYear()} AbsoJob</span>
                    <span>Authorised users only</span>
                </div>
            </aside>

            {/* Sign-in */}
            <main className="flex flex-col bg-background">
                {/* utility row */}
                <div className="h-16 shrink-0 px-5 sm:px-10 flex items-center justify-between border-b border-neutral-200 bg-white lg:bg-transparent lg:border-transparent">
                    <div className="lg:hidden flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-md bg-accent text-white flex items-center justify-center text-[13px] font-bold">AJ</span>
                        <span className="text-[16px] font-semibold text-navy">AbsoJob</span>
                    </div>
                    <span className="hidden lg:block" />
                    <a href="/register" className="text-[13px] text-neutral-600 hover:text-navy">
                        <span className="hidden sm:inline">Placement agency? </span><span className="font-medium text-navy underline underline-offset-4 decoration-neutral-300 hover:decoration-navy">Partner sign-up</span>
                    </a>
                </div>

                <div className="flex-1 flex items-center justify-center px-5 sm:px-10 py-10">
                    <div className="w-full max-w-[420px] bg-white rounded-lg border border-neutral-200 shadow-[0_1px_2px_rgba(20,43,74,0.06)]">
                        <div className="px-8 pt-8 pb-6 border-b border-neutral-100">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">{step === "password" ? "Staff login" : "Two-step sign-in"}</p>
                            <h2 className="mt-2 text-[24px] leading-tight font-semibold text-navy tracking-tight">
                                {step === "password" ? "Sign in to your workspace" : step === "setup" ? "Set up your authenticator" : "Enter your sign-in code"}
                            </h2>
                            <p className="text-[13.5px] text-neutral-500 mt-1.5">
                                {step === "password" ? <>You&apos;ll land on the dashboard for your role.</>
                                    : step === "setup" ? "Your organisation requires a code from an authenticator app for this account."
                                    : "Open your authenticator app and enter the 6-digit code for AbsoJob CRM."}
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="px-8 pt-6 pb-8 space-y-5">
                            {error && (
                                <div role="alert" className="px-3 py-2.5 rounded-md border-l-[3px] border-accent bg-accent-light text-[13px] text-accent-dark">{error}</div>
                            )}
                            {!error && notice && step === "password" && (
                                <div role="status" className="px-3 py-2.5 rounded-md border-l-[3px] border-navy bg-neutral-50 text-[13px] text-neutral-700">{notice}</div>
                            )}
                            {step !== "password" ? (
                                <>
                                    {step === "setup" && setup && (
                                        <div className="space-y-3">
                                            <ol className="text-[13px] text-neutral-600 list-decimal pl-5 space-y-1">
                                                <li>Install Google Authenticator, Microsoft Authenticator or a similar app.</li>
                                                <li>Scan this QR code, or type the key into the app.</li>
                                                <li>Enter the 6-digit code it shows.</li>
                                            </ol>
                                            <div className="flex items-center gap-4">
                                                {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated by the server */}
                                                <img src={setup.qrDataUrl} alt="QR code to add AbsoJob CRM to your authenticator app" width={132} height={132} className="rounded border border-neutral-200 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[12px] text-neutral-500">Setup key</p>
                                                    <p className="font-mono text-[13px] text-navy break-all select-all">{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
                                                    <a href={setup.otpauthUrl} className="text-[12px] text-navy underline underline-offset-4 decoration-neutral-300 sm:hidden">Open in authenticator app</a>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label htmlFor="code" className="block text-[13px] font-medium text-neutral-700 mb-1.5">6-digit code</label>
                                        <input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} pattern="[0-9 ]{6,7}"
                                            value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
                                            className={`${field} font-mono tracking-[0.3em] text-[16px]`} placeholder="123456" required />
                                    </div>
                                    <button type="submit" disabled={isLoading}
                                        className="group w-full h-11 px-4 rounded-md bg-navy text-white text-[14px] font-medium hover:bg-primary-dark flex items-center justify-between disabled:opacity-70 disabled:cursor-not-allowed">
                                        <span className="flex items-center gap-2"><ShieldCheck size={16} />{isLoading ? "Checking…" : step === "setup" ? "Confirm and sign in" : "Verify"}</span>
                                        {isLoading
                                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            : <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
                                    </button>
                                    <button type="button" onClick={() => { setError(""); backToPassword(); }} className="flex items-center gap-1.5 text-[13px] text-neutral-500 hover:text-navy">
                                        <ArrowLeft size={14} /> Use a different account
                                    </button>
                                </>
                            ) : (<>
                            <div>
                                <label htmlFor="email" className="block text-[13px] font-medium text-neutral-700 mb-1.5">Work email</label>
                                <input id="email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="name@company.com" required />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-[13px] font-medium text-neutral-700 mb-1.5">Password</label>
                                <div className="relative">
                                    <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-11`} placeholder="Enter your password" required />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}
                                        className="absolute right-1.5 top-1.5 h-8 w-8 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-700">
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" disabled={isLoading}
                                className="group w-full h-11 px-4 rounded-md bg-navy text-white text-[14px] font-medium hover:bg-primary-dark flex items-center justify-between disabled:opacity-70 disabled:cursor-not-allowed">
                                <span>{isLoading ? "Signing in…" : "Continue"}</span>
                                {isLoading
                                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
                            </button>
                            </>)}
                        </form>

                        <div className="px-8 py-4 border-t border-neutral-100 bg-neutral-50 rounded-b-lg text-[12.5px] text-neutral-500">
                            Locked out, lost your authenticator, or new here? Your workspace admin creates accounts and resets passwords and two-step sign-in.
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
