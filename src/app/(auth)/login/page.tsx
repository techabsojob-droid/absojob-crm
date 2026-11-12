"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { roleHome } from "@/lib/types";

export default function LoginPage() {
    const { user } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) return;
        window.location.href = roleHome(user.role);
    }, [user]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                setError(result.error || "Login failed");
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

    const field = "w-full h-10 px-3 rounded-md border border-neutral-300 bg-white text-[14px] text-neutral-800 outline-none focus:border-navy placeholder:text-neutral-400";
    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-background">
            {/* Brand panel */}
            <aside className="hidden lg:flex flex-col justify-between bg-navy text-white px-14 py-12">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-[14px] font-bold">AJ</span>
                    <span className="text-[18px] font-semibold tracking-tight">AbsoJob</span>
                </div>
                <div className="max-w-md">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A6C3] mb-4">Recruitment CRM</p>
                    <h1 className="text-[34px] leading-[1.15] font-semibold tracking-tight text-white">Every requisition, candidate and placement in one system.</h1>
                    <ul className="mt-8 space-y-3 text-[14px] text-[#BDC9DC]">
                        {["Requisitions, pipeline and interviews for client hiring", "Team attendance, targets and recruiter KPIs", "HR, payroll and finance on the same records"].map((t) => (
                            <li key={t} className="flex gap-3"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />{t}</li>
                        ))}
                    </ul>
                </div>
                <p className="text-[12px] text-[#6A82A6]">© {new Date().getFullYear()} AbsoJob</p>
            </aside>

            {/* Sign-in */}
            <main className="flex flex-col justify-center items-center px-5 py-12">
                <div className="w-full max-w-[380px]">
                    <div className="lg:hidden flex items-center gap-2.5 mb-8">
                        <span className="w-8 h-8 rounded-md bg-accent text-white flex items-center justify-center text-[13px] font-bold">AJ</span>
                        <span className="text-[17px] font-semibold text-navy">AbsoJob</span>
                    </div>
                    <h2 className="text-[24px] font-semibold text-neutral-900 tracking-tight">Sign in</h2>
                    <p className="text-[14px] text-neutral-500 mt-1">Use your AbsoJob work account.</p>

                    <form onSubmit={handleLogin} className="mt-7 space-y-4" noValidate={false}>
                        {error && (
                            <div role="alert" className="px-3 py-2.5 rounded-md border border-red-200 bg-danger-light text-[13px] text-red-700">{error}</div>
                        )}
                        <div>
                            <label htmlFor="email" className="block text-[13px] font-medium text-neutral-700 mb-1.5">Work email</label>
                            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="name@company.com" required />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-[13px] font-medium text-neutral-700 mb-1.5">Password</label>
                            <div className="relative">
                                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-10`} placeholder="Enter your password" required />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-1 top-1 h-8 w-8 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-700">
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" disabled={isLoading}
                            className="w-full h-10 rounded-md bg-accent text-white text-[14px] font-medium hover:bg-accent-dark flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                            {isLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Sign in"}
                        </button>
                    </form>

                    <p className="mt-8 pt-6 border-t border-neutral-200 text-[13px] text-neutral-500">
                        Recruiter or placement agency? <a href="/register" className="font-medium text-navy hover:underline">Apply to become a partner</a>
                    </p>
                </div>
            </main>
        </div>
    );
}
