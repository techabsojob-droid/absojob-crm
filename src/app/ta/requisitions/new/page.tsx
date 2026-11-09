"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import RequisitionWizard from "@/components/ta/requisition/RequisitionWizard";
import { useAuth } from "@/lib/auth";
import { canCreateRequisition } from "@/lib/access";

function NewRequisition() {
    const { user, loading } = useAuth();
    // ?from=<jobId> starts a copy of an existing requisition
    const from = useSearchParams().get("from") ?? undefined;
    if (loading || !user) return null;
    if (!canCreateRequisition(user.role)) {
        return (
            <div className="max-w-lg mx-auto mt-16 bg-white rounded-2xl border border-neutral-200/80 p-8 text-center space-y-3">
                <ShieldAlert size={28} className="mx-auto text-amber-500" />
                <h1 className="text-lg font-bold text-neutral-900">Requisitions are raised by your TA Manager</h1>
                <p className="text-sm text-neutral-500">Ask your TA Manager to create the requisition. Ones assigned to you appear in All Openings.</p>
                <Link href="/ta/requisitions" className="inline-flex h-9 px-4 items-center rounded-xl bg-primary text-white text-sm font-semibold">Go to All Openings</Link>
            </div>
        );
    }
    return <RequisitionWizard key={from ?? "new"} duplicateOf={from} />;
}

export default function NewRequisitionPage() {
    return <Suspense fallback={null}><NewRequisition /></Suspense>;
}
