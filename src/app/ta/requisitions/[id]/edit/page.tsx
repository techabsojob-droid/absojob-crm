"use client";

import { use } from "react";
import RequisitionWizard from "@/components/ta/requisition/RequisitionWizard";

export default function EditRequisitionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <RequisitionWizard key={id} jobId={id} />;
}
