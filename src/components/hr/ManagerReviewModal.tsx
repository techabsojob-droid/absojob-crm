"use client";

import { useState } from "react";
import { ModalShell } from "@/components/shared/ui";

const inputCls = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none";

export interface ReviewLite {
    id: string;
    employeeName: string;
    reviewCycle: string;
    employeeFeedback?: string | null;
    goals: { id: string; title: string; progress: number }[];
}

/** Manager / HR review form: rating, feedback, increment and optional promotion. Shared by HRMIS and the manager's workspace. */
export default function ManagerReviewModal({ review, onClose, onSubmit, pending }: {
    review: ReviewLite | null;
    onClose: () => void;
    onSubmit: (body: Record<string, unknown>) => void;
    pending?: boolean;
}) {
    const [rating, setRating] = useState("4");
    const [feedback, setFeedback] = useState("");
    const [increment, setIncrement] = useState("");
    const [promote, setPromote] = useState(false);
    const [newDesignation, setNewDesignation] = useState("");

    return (
        <ModalShell open={!!review} onClose={onClose} title={review ? `Review ${review.employeeName} · ${review.reviewCycle}` : ""} wide>
            {review && (
                <form
                    className="space-y-3 text-sm"
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSubmit({
                            id: review.id, action: "manager_review", rating: Number(rating), managerFeedback: feedback,
                            incrementPercent: increment ? Number(increment) : null, promotionRecommended: promote,
                            newDesignation: promote ? newDesignation : undefined,
                        });
                    }}
                >
                    <div className="bg-neutral-50 rounded-xl p-3 space-y-1">
                        <p className="text-xs font-bold text-neutral-500 uppercase">Self review</p>
                        <p className="text-neutral-700">{review.employeeFeedback || <span className="italic text-neutral-400">Not submitted yet</span>}</p>
                        {review.goals.map((g) => <p key={g.id} className="text-xs text-neutral-500">• {g.title}: {g.progress}%</p>)}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1"><span className="text-xs font-bold text-neutral-500">Rating (1–5)</span>
                            <select value={rating} onChange={(e) => setRating(e.target.value)} className={inputCls}>
                                {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </label>
                        <label className="space-y-1"><span className="text-xs font-bold text-neutral-500">Increment %</span>
                            <input type="number" min="0" step="0.5" value={increment} onChange={(e) => setIncrement(e.target.value)} className={inputCls} />
                        </label>
                    </div>
                    <textarea required rows={3} placeholder="Manager feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} className={inputCls} />
                    <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} /> Recommend promotion
                    </label>
                    {promote && (
                        <input required placeholder="New designation" value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)} className={inputCls} />
                    )}
                    <p className="text-[11px] text-neutral-400">A recommended promotion goes to HR Approvals; it is applied to the employee once approved.</p>
                    <button disabled={pending} className="w-full py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Complete Review</button>
                </form>
            )}
        </ModalShell>
    );
}
