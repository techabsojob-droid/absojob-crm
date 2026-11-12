"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/shared/ui";
import { api } from "@/lib/api";

interface Member { id: string; name: string; role: string; designation: string | null }

/**
 * Super Admin control for which TA Managers may work on a client. A TA Manager only sees
 * clients mapped to them here (or where they are the account manager) — enforced by the API.
 */
export function ClientTaManagers({ clientId, accountManagerId, value }: { clientId: string; accountManagerId: string | null; value: string[] }) {
    const qc = useQueryClient();
    const [sel, setSel] = useState<string[]>(value);
    const { data } = useQuery<{ users: Member[] }>({ queryKey: ["team-members"], queryFn: () => api("/api/admin/team-members") });
    const managers = (data?.users ?? []).filter((u) => u.role === "TA_MANAGER");
    const save = useMutation({
        mutationFn: () => api(`/api/admin/clients/${clientId}`, "PATCH", { taManagerIds: sel }),
        onSuccess: () => { toast.success("TA Manager access updated"); qc.invalidateQueries({ queryKey: ["client-details", clientId] }); qc.invalidateQueries({ queryKey: ["clients"] }); },
        onError: (e: Error) => toast.error(e.message),
    });
    const dirty = [...sel].sort().join() !== [...value].sort().join();

    return (
        <SectionCard title="TA Manager access" subtitle="Only TA Managers ticked here (and the account manager) can see this client and its requisitions">
            {managers.length === 0 ? <p className="text-xs text-neutral-400">No active TA Managers in your organisation.</p> : (
                <div className="space-y-2">
                    {managers.map((m) => {
                        const isAm = m.id === accountManagerId;
                        return (
                            <label key={m.id} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" disabled={isAm} checked={isAm || sel.includes(m.id)} onChange={(e) => setSel(e.target.checked ? [...sel, m.id] : sel.filter((x) => x !== m.id))} />
                                <span className="font-semibold">{m.name}</span>
                                {isAm && <span className="text-[10px] font-bold text-neutral-400">account manager</span>}
                            </label>
                        );
                    })}
                    <button disabled={!dirty || save.isPending} onClick={() => save.mutate()} className="mt-2 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium disabled:opacity-40">{save.isPending ? "Saving…" : "Save access"}</button>
                </div>
            )}
        </SectionCard>
    );
}
