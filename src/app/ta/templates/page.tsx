"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareText, Plus, Trash2 } from "lucide-react";
import { PageHeader, SectionCard, Badge, EmptyState, ModalShell } from "@/components/shared/ui";
import { btn, inputCls, useAct } from "@/components/finance/kit";
import { api } from "@/lib/api";

interface Tpl { id: string; name: string; channel: string; audience: string; subject: string | null; body: string; createdByName: string; createdAt: string }
const PLACEHOLDERS = ["candidateName", "jobTitle", "clientName", "interviewDate", "recruiterName", "companyName", "contactPerson"];

export default function TemplatesPage() {
    const { data } = useQuery<Tpl[]>({ queryKey: ["ta-templates"], queryFn: () => api("/api/ta/templates") });
    const [open, setOpen] = useState(false);
    const [f, setF] = useState({ name: "", channel: "EMAIL", audience: "CANDIDATE", subject: "", body: "" });
    const create = useAct("/api/ta/templates", "POST", ["ta-templates"], "Template saved");
    const del = useAct("/api/ta/templates", "DELETE", ["ta-templates"], "Template deleted");

    return (
        <div className="space-y-6">
            <PageHeader title="Message Templates" subtitle="Reusable email / WhatsApp / SMS messages for candidates and clients — placeholders are filled in automatically"
                action={<button onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-1.5"><Plus size={14} /> New template</button>} />
            {!data?.length ? <SectionCard><EmptyState icon={MessageSquareText} message="No templates yet." /></SectionCard> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.map((t) => (
                        <SectionCard key={t.id} title={t.name} subtitle={`by ${t.createdByName}`} action={<div className="flex gap-1.5"><Badge value={t.channel} /><Badge value={t.audience} /></div>}>
                            {t.subject && <p className="text-xs font-bold text-neutral-700 mb-1">{t.subject}</p>}
                            <p className="text-xs text-neutral-600 whitespace-pre-line">{t.body}</p>
                            <button disabled={del.isPending} onClick={() => { if (window.confirm(`Delete "${t.name}"?`)) del.mutate({ id: t.id }); }} className={`${btn.danger} mt-3`}><Trash2 size={12} className="inline" /> Delete</button>
                        </SectionCard>
                    ))}
                </div>
            )}
            <ModalShell open={open} onClose={() => setOpen(false)} title="New template" wide>
                <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); create.mutate(f, { onSuccess: () => { setOpen(false); setF({ name: "", channel: "EMAIL", audience: "CANDIDATE", subject: "", body: "" }); } }); }}>
                    <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Template name" className={inputCls} />
                    <div className="grid grid-cols-2 gap-2">
                        <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} className={inputCls} aria-label="Channel"><option>EMAIL</option><option>WHATSAPP</option><option>SMS</option></select>
                        <select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} className={inputCls} aria-label="Audience"><option>CANDIDATE</option><option>CLIENT</option></select>
                    </div>
                    {f.channel === "EMAIL" && <input required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Subject" className={inputCls} />}
                    <textarea required rows={7} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Message" className={inputCls} />
                    <div className="flex flex-wrap gap-1">{PLACEHOLDERS.map((p) => <button type="button" key={p} onClick={() => setF({ ...f, body: `${f.body}{{${p}}}` })} className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-primary/10 font-mono">{`{{${p}}}`}</button>)}</div>
                    <button disabled={create.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Save template</button>
                </form>
            </ModalShell>
        </div>
    );
}
