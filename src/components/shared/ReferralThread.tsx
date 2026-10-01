"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { ago, inputCls, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Msg { id: string; fromUserId: string; fromName: string; fromRole: string; text: string; createdAt: string }

/** Message thread between the referring partner and the recruitment team for one referral. */
export default function ReferralThread({ referralId }: { referralId: string }) {
    const { user } = useAuth();
    const { data = [] } = useQuery<Msg[]>({ queryKey: ["referral-thread", referralId], queryFn: () => api(`/api/referrals/${referralId}/messages`), refetchInterval: 20000 });
    const [text, setText] = useState("");
    const send = useAct(`/api/referrals/${referralId}/messages`, "POST", ["referral-thread", "portal-referral", "portal-referrals"]);
    return (
        <div className="space-y-3">
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {data.length === 0 ? <p className="text-xs text-neutral-400 text-center py-4">No messages yet — ask about availability, feedback or next steps.</p> : data.map((m) => {
                    const mine = m.fromUserId === user?.id;
                    return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${mine ? "bg-primary text-white" : "bg-neutral-100 text-neutral-800"}`}>
                                {!mine && <p className="font-bold text-[10px] opacity-70">{m.fromName} · {m.fromRole === "AGENT" ? "Partner" : "Recruitment team"}</p>}
                                <p className="whitespace-pre-line">{m.text}</p>
                                <p className={`text-[10px] mt-0.5 ${mine ? "text-white/70" : "text-neutral-400"}`}>{ago(m.createdAt)}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate({ text }, { onSuccess: () => setText("") }); }}>
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Write a message…" className={inputCls} aria-label="Message" />
                <button disabled={send.isPending || !text.trim()} className="px-3 rounded-xl bg-primary text-white disabled:opacity-50" aria-label="Send"><Send size={14} /></button>
            </form>
        </div>
    );
}
