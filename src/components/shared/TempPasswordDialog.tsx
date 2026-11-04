"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

export interface IssuedLogin { name: string; email: string; password: string }

/** Shows a one-time password exactly once so the admin can hand it over. */
export function TempPasswordDialog({ login, onClose }: { login: IssuedLogin | null; onClose: () => void }) {
    const [copied, setCopied] = useState(false);
    if (!login) return null;
    const text = `Login: ${typeof window !== "undefined" ? window.location.origin : ""}/login\nEmail: ${login.email}\nTemporary password: ${login.password}`;
    const copy = () => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><KeyRound size={20} /></span>
                        <div>
                            <h3 className="font-bold text-neutral-900">Login created for {login.name}</h3>
                            <p className="text-xs text-neutral-500">Share these details privately. The password is shown only once.</p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-3"><span className="text-neutral-500">Email</span><span className="font-semibold text-neutral-900 break-all text-right">{login.email}</span></div>
                        <div className="flex justify-between gap-3 items-center">
                            <span className="text-neutral-500">Temporary password</span>
                            <code className="font-mono font-bold text-base text-neutral-900 bg-white border border-neutral-200 rounded-lg px-2 py-0.5 select-all">{login.password}</code>
                        </div>
                    </div>
                    <p className="text-[11px] text-neutral-500">They should change it after signing in (profile menu › Change password). You can issue a new one any time from their profile with “Reset password”.</p>
                </div>
                <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
                    <button onClick={copy} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-neutral-200 rounded-xl hover:bg-neutral-50">
                        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copied ? "Copied" : "Copy details"}
                    </button>
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-xl">Done</button>
                </div>
            </div>
        </div>
    );
}
