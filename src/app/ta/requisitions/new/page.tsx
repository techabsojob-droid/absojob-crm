"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RequisitionWizard from "@/components/ta/requisition/RequisitionWizard";

function NewRequisition() {
    // ?from=<jobId> starts a copy of an existing requisition
    const from = useSearchParams().get("from") ?? undefined;
    return <RequisitionWizard key={from ?? "new"} duplicateOf={from} />;
}

export default function NewRequisitionPage() {
    return <Suspense fallback={null}><NewRequisition /></Suspense>;
}
