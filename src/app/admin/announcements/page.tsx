"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pin, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, ModalShell, EmptyState } from "@/components/shared/ui";

export default function AnnouncementsPage() {
    const qc = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ title: "", body: "", pinned: false, audience: ["ALL"] as string[] });

    const { data: list, isLoading } = useQuery({
        queryKey: ["announcements"],
        queryFn: async () => (await fetch("/api/admin/announcements")).json(),
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Announcement broadcast to all targeted users.");
            setModalOpen(false);
            setForm({ title: "", body: "", pinned: false, audience: ["ALL"] });
            qc.invalidateQueries({ queryKey: ["announcements"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/admin/announcements", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error();
        },
        onSuccess: () => { toast.success("Deleted."); qc.invalidateQueries({ queryKey: ["announcements"] }); },
        onError: () => toast.error("Delete failed"),
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Announcements"
                subtitle="Broadcast updates to TA team, field agents & employees"
                action={
                    <button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 flex items-center gap-2">
                        <Plus size={16} /> New Announcement
                    </button>
                }
            />

            {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-neutral-100" />)}</div>
            ) : !Array.isArray(list) || list.length === 0 ? (
                <SectionCard><EmptyState icon={Megaphone} message="No announcements published yet." /></SectionCard>
            ) : (
                <div className="space-y-3">
                    {list.map((a: any) => (
                        <div key={a.id} className={`bg-white p-5 rounded-2xl border shadow-xs ${a.pinned ? "border-primary/30 bg-primary/[0.03]" : "border-neutral-200/80"}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.pinned ? "bg-primary text-white" : "bg-neutral-100 text-neutral-500"}`}>
                                        <Megaphone size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-neutral-900">{a.title}</h3>
                                        <p className="text-xs text-neutral-400 mt-0.5">
                                            {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })} · by {a.createdByName}
                                            · to {a.audience.join(", ").replaceAll("_", " ")}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {a.pinned && <Pin size={15} className="text-primary rotate-45" />}
                                    <button onClick={() => deleteMutation.mutate(a.id)} disabled={deleteMutation.isPending}
                                        className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-neutral-600 leading-relaxed mt-3 pl-[52px]">{a.body}</p>
                        </div>
                    ))}
                </div>
            )}

            <ModalShell open={modalOpen} onClose={() => setModalOpen(false)} title="Broadcast Announcement" wide>
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Title *</span>
                        <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" /></label>
                    <label className="block"><span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Message *</span>
                        <textarea required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none resize-none" /></label>

                    <div>
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Audience</span>
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {["ALL", "TA", "AGENTS", "EMPLOYEES"].map((aud) => (
                                <button type="button" key={aud}
                                    onClick={() =>
                                        setForm((f) => ({
                                            ...f,
                                            audience: f.audience.includes(aud)
                                                ? f.audience.filter((x) => x !== aud)
                                                : aud === "ALL" ? ["ALL"] : [...f.audience.filter((x) => x !== "ALL"), aud],
                                        }))
                                    }
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${form.audience.includes(aud) ? "bg-primary text-white" : "bg-white border border-neutral-200 text-neutral-500"}`}>
                                    {aud}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="w-4 h-4 accent-[#1B4332]" />
                        <span className="text-sm font-medium text-neutral-700">Pin to top</span>
                    </label>

                    <button disabled={createMutation.isPending} className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-primary/25">
                        {createMutation.isPending ? "Publishing..." : "Publish Announcement"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
