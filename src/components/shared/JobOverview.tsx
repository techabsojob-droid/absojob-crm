"use client";

import { Building2, Calendar, User } from "lucide-react";
import { RichText } from "@/components/ta/requisition/controls";
import type { JobOverview as Overview, JobOverviewPerson } from "@/lib/mock/job-overview";

const TYPE: Record<string, string> = {
    FULL_TIME: "Full Time", PART_TIME: "Part Time", CONTRACT: "Contract", PERMANENT: "Permanent", INTERNSHIP: "Internship",
    FREELANCE: "Freelance", REMOTE: "Remote", HYBRID: "Hybrid", TEMPORARY: "Temporary", CONSULTANT: "Consultant",
};
const MODE: Record<string, string> = { ONSITE: "Work from office", HYBRID: "Hybrid", REMOTE: "Remote", WFH: "Work from home", FIELD: "Field" };

const rupees = (lpa: number) => `₹${Math.round(lpa * 100000).toLocaleString("en-IN")}`;
const posted = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" });
    const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).toLowerCase();
    return `${date} ${time}`;
};
const personText = (p: JobOverviewPerson) => p.email ? `${p.name} · ${p.email}` : p.name;

function Item({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
            <div className="text-sm text-neutral-900 mt-1 break-words">{children}</div>
        </div>
    );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
    if (!items.length) return null;
    return (
        <div>
            <h4 className="text-sm font-bold text-neutral-900 mb-2">{title}</h4>
            <ul className="space-y-1.5 text-sm text-neutral-700 list-disc pl-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
    );
}

/**
 * The standard job view used across portals: code + title, client / applications / posted,
 * a details grid and the full job description. Internal-only fields are null for partners
 * and employees and simply don't render.
 */
export function JobOverview({ job: o, actions, onApplicationsClick }: { job: Overview; actions?: React.ReactNode; onApplicationsClick?: () => void }) {
    const show = <T,>(v: T | null | undefined): v is T => v !== null && v !== undefined;
    const internal = show(o.selected);

    return (
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs">
            {/* Header */}
            <div className="p-6 pb-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <h2 className="text-xl font-extrabold text-neutral-900 leading-snug">
                        {o.code && <span className="text-[#1f5fa8] mr-2.5">{o.code}</span>}{o.title}
                    </h2>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-3 text-sm text-neutral-500">
                    {o.clientName && <span className="flex items-center gap-1.5"><Building2 size={14} />{o.clientName}</span>}
                    {show(o.applications) && (
                        onApplicationsClick
                            ? <button type="button" onClick={onApplicationsClick} className="flex items-center gap-1.5 font-bold text-[#1f5fa8] hover:underline"><User size={14} />{o.applications} Application{o.applications === 1 ? "" : "s"} Received</button>
                            : <span className="flex items-center gap-1.5 font-bold text-[#1f5fa8]"><User size={14} />{o.applications} Application{o.applications === 1 ? "" : "s"} Received</span>
                    )}
                    <span className="flex items-center gap-1.5"><Calendar size={14} />{posted(o.postedAt)}</span>
                </div>
            </div>

            {/* Details grid */}
            <div className="px-6 py-5 border-t border-neutral-100 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                <Item label="Salary">{rupees(o.salaryMinLpa)} – {rupees(o.salaryMaxLpa)}</Item>
                <Item label="Job location">{o.location}{o.workMode ? <span className="block text-xs text-neutral-500">{MODE[o.workMode] ?? o.workMode}</span> : null}</Item>
                <Item label="Job type">{TYPE[o.employmentType] ?? o.employmentType}</Item>
                <Item label="Education">{o.education || "—"}</Item>
                <Item label="Experience">{o.experience}</Item>
                {internal && <Item label="Created by">{o.createdBy ? personText(o.createdBy) : "—"}</Item>}
                {internal && <Item label="Selected">{o.selected}</Item>}
                {internal && <Item label="Joined">{o.joined}</Item>}
                <Item label="Open position">{o.openPositions}</Item>
                {o.noticePeriod && <Item label="Notice / joining">{o.noticePeriod}</Item>}
            </div>

            {internal && (
                <div className="px-6 py-5 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                    <Item label="Branch name">{o.branchName || "—"}</Item>
                    <Item label="HR / TA managers">{o.hrManagers?.length ? o.hrManagers.map((p) => <span key={p.name} className="block">{personText(p)}</span>) : "—"}</Item>
                    <Item label="Reporting managers">{o.reportingManagers?.length ? o.reportingManagers.join(", ") : "—"}</Item>
                    <Item label="Recruiters">{o.recruiters?.length ? o.recruiters.map((p) => <span key={p.name} className="block">{personText(p)}{p.phone ? ` (${p.phone})` : ""}</span>) : <span className="text-amber-700 font-semibold">Unassigned</span>}</Item>
                </div>
            )}

            {/* Job details */}
            <div className="px-6 py-6 border-t border-neutral-100 space-y-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Job details</p>
                {(o.department || o.reportsTo) && (
                    <div className="space-y-2 text-[15px] text-neutral-800">
                        {o.department && <p>Department: {o.department}</p>}
                        {o.reportsTo && <p>Reports to: {o.reportsTo}</p>}
                    </div>
                )}
                {(o.descriptionHtml || o.description) && (
                    <div>
                        <h4 className="text-sm font-bold text-neutral-900 mb-2">Purpose</h4>
                        <RichText html={o.descriptionHtml} text={o.description} className="!text-[15px] leading-relaxed" />
                    </div>
                )}
                {(o.responsibilitiesHtml || o.responsibilities) && (
                    <div>
                        <h4 className="text-sm font-bold text-neutral-900 mb-2">Key Responsibilities</h4>
                        <RichText html={o.responsibilitiesHtml} text={o.responsibilities} className="!text-[15px] leading-relaxed" />
                    </div>
                )}
                <Bullets title="Must Haves" items={o.mustHaves} />
                <Bullets title="Good to Have" items={o.goodToHave} />
                {o.qualification && <p className="text-[15px] text-neutral-800">Qualification: {o.qualification}</p>}
            </div>
        </div>
    );
}

/** Square icon button for the job header actions (link or button), with a tooltip label. */
export function JobIconButton({ label, href, onClick, children }: { label: string; href?: string; onClick?: () => void; children: React.ReactNode }) {
    const cls = "w-10 h-10 rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-primary flex items-center justify-center transition-colors";
    return href
        ? <a href={href} title={label} aria-label={label} className={cls}>{children}</a>
        : <button type="button" onClick={onClick} title={label} aria-label={label} className={cls}>{children}</button>;
}
