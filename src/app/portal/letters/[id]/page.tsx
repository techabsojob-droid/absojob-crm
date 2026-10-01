"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import PrintArea from "@/components/shared/PrintArea";
import { api } from "@/lib/api";

interface Letter { reference: string; issuedOn: string; title: string; addressee: string; paragraphs: string[]; company: { name: string; address: string; gstin: string }; signatory: { name: string; designation: string } }

export default function LetterPage() {
    const { id } = useParams<{ id: string }>();
    const { data, isLoading, error } = useQuery<Letter>({ queryKey: ["letter", id], queryFn: () => api(`/api/portal/letters/${id}`) });
    if (isLoading) return <SkeletonPulse className="h-[600px] w-full" />;
    if (error || !data) return <SectionCard><EmptyState icon={AlertTriangle} message={(error as Error)?.message ?? "Letter not available"} /></SectionCard>;
    return (
        <PrintArea backHref="/portal/requests" backLabel="My requests">
            <div className="border-b-2 border-primary pb-3 mb-6"><p className="text-xl font-extrabold text-primary">{data.company.name}</p><p className="text-xs text-neutral-500">{data.company.address} · GSTIN {data.company.gstin}</p></div>
            <div className="flex justify-between text-xs text-neutral-600 mb-6"><span>Ref: {data.reference}</span><span>Date: {new Date(`${data.issuedOn}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</span></div>
            <p className="text-center text-lg font-extrabold underline underline-offset-4 mb-6">{data.title.toUpperCase()}</p>
            <p className="font-semibold mb-4">{data.addressee}</p>
            <div className="space-y-4 leading-relaxed">{data.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
            <div className="mt-14"><p>For {data.company.name}</p><div className="h-12" /><p className="font-bold">{data.signatory.name}</p><p className="text-xs text-neutral-500">{data.signatory.designation}</p></div>
            <p className="text-[10px] text-neutral-400 mt-10 text-center">Verify this letter with HR quoting reference {data.reference}.</p>
        </PrintArea>
    );
}
