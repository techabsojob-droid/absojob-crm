"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Briefcase, Lock } from "lucide-react";
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

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-neutral-50 animate-fade-in">

            {/* Left: Branding */}
            <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-primary text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.15),transparent_50%)]" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                            <Briefcase className="text-primary" size={20} />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">Abso<span className="text-white/70">Job</span></span>
                    </div>
                </div>

                <div className="relative z-10 max-w-lg">
                    <h1 className="text-5xl font-bold leading-tight mb-6">Hire Faster.<br />Place Smarter.</h1>
                    <p className="text-lg text-white/80 leading-relaxed">
                        The recruitment operating system for staffing teams — requisitions, pipelines, interviews & referral incentives, all in one place.
                    </p>
                    <div className="mt-8 flex gap-8 text-sm">
                        {[["3 Portals", "Admin · TA · Partners"], ["End-to-end", "Sourcing → Joining"], ["Transparent", "Incentive ledger"]].map(([t, s]) => (
                            <div key={t}>
                                <p className="font-extrabold">{t}</p>
                                <p className="text-xs text-white/60 mt-0.5">{s}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 flex gap-4 text-xs font-medium text-white/60">
                    <span>© 2026 AbsoJob Inc.</span>
                    <span>Privacy Policy</span>
                    <span>Terms of Service</span>
                </div>
            </div>

            {/* Right: Login Form */}
            <div className="flex flex-col justify-center items-center p-6 lg:p-24">
                <div className="w-full max-w-md space-y-8">

                    <div className="text-center lg:text-left">
                        <div className="lg:hidden flex justify-center mb-6">
                            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                                <Briefcase className="text-white" size={24} />
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold text-neutral-900">Welcome Back</h2>
                        <p className="text-neutral-500 mt-2">Sign in to your AbsoJob workspace</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium text-center animate-fade-in">
                                {error}
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none placeholder:text-neutral-400"
                                    placeholder="name@absojob.com"
                                    required
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Password</label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none placeholder:text-neutral-400"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-[38px] text-neutral-400 hover:text-neutral-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/30 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Lock size={16} /> Sign In
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm text-neutral-500">
                        Recruiter or placement agency? <a href="/register" className="font-bold text-primary hover:underline">Become a recruitment partner</a>
                    </p>


                </div>
            </div>
        </div>
    );
}
