"use client";

import { useState } from "react";
import { ModalShell } from "@/components/shared/ui";
import { inputCls, useAct } from "@/components/finance/kit";

/** Change own password — current password required; 8+ chars with a letter and a number. */
export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [f, setF] = useState({ currentPassword: "", newPassword: "", confirm: "" });
    const [err, setErr] = useState("");
    const act = useAct("/api/auth/password", "PATCH", [], "Password changed — use it next time you sign in");
    return (
        <ModalShell open={open} onClose={onClose} title="Change password">
            <form className="space-y-3" onSubmit={(e) => {
                e.preventDefault();
                if (f.newPassword !== f.confirm) return setErr("New passwords do not match");
                setErr("");
                act.mutate({ currentPassword: f.currentPassword, newPassword: f.newPassword }, { onSuccess: () => { setF({ currentPassword: "", newPassword: "", confirm: "" }); onClose(); } });
            }}>
                {err && <p className="text-xs text-rose-600 font-semibold">{err}</p>}
                <input required type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} placeholder="Current password" className={inputCls} />
                <input required type="password" autoComplete="new-password" minLength={8} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} placeholder="New password" className={inputCls} />
                <input required type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} placeholder="Confirm new password" className={inputCls} />
                <p className="text-[11px] text-neutral-400">At least 8 characters, with a letter and a number.</p>
                <button disabled={act.isPending} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Update password</button>
            </form>
        </ModalShell>
    );
}
