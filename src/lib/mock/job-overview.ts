// ─── Job overview (the standard "job card" every portal shows) ─
// One server-side shape so the TA, Admin and employee/partner portals render the same
// job header, details grid and job description. `internal: false` drops everything a
// partner or employee shouldn't see (who created it, team contacts, hiring progress).

import type { JobRequisition } from "@/lib/types";
import { applications, clients, users } from "./data";

export interface JobOverviewPerson { name: string; email: string | null; phone: string | null }
export interface JobOverview {
    code: string | null;
    title: string;
    clientName: string | null;
    applications: number | null;
    postedAt: string;
    salaryMinLpa: number;
    salaryMaxLpa: number;
    location: string;
    workMode: string | null;
    employmentType: string;
    education: string | null;
    experience: string;
    openPositions: number;
    // Internal-only (null = hidden)
    createdBy: JobOverviewPerson | null;
    selected: number | null;
    joined: number | null;
    branchName: string | null;
    hrManagers: JobOverviewPerson[] | null;
    reportingManagers: string[] | null;
    recruiters: JobOverviewPerson[] | null;
    // Job details
    department: string | null;
    reportsTo: string | null;
    descriptionHtml: string | null;
    description: string | null;
    responsibilitiesHtml: string | null;
    responsibilities: string | null;
    mustHaves: string[];
    goodToHave: string[];
    qualification: string | null;
    noticePeriod: string | null;
}

const SELECTED_OR_LATER = ["SELECTED", "OFFER_SENT", "OFFER_ACCEPTED", "ONBOARDING", "JOINED"];

const person = (id: string | null | undefined): JobOverviewPerson | null => {
    const u = id ? users.find((x) => x.id === id) : undefined;
    return u ? { name: u.name, email: u.email || null, phone: u.phone || null } : null;
};
const uniqPeople = (list: (JobOverviewPerson | null)[]) => {
    const seen = new Set<string>();
    return list.filter((p): p is JobOverviewPerson => !!p && !seen.has(p.name) && !!seen.add(p.name));
};

export function jobOverviewFor(j: JobRequisition, opts: { internal: boolean }): JobOverview {
    const client = clients.find((c) => c.id === j.clientId);
    const apps = applications.filter((a) => a.jobId === j.id);
    const joined = apps.filter((a) => a.stage === "JOINED").length;
    const filled = Math.min(j.openings || 0, Math.max(j.filled || 0, joined));
    const addr = j.officeAddress ?? null;
    const branch = [addr?.building, addr?.street, j.locationLocality].filter(Boolean).join(", ");
    const place = j.location || [j.city, j.locationState].filter(Boolean).join(", ") || (j.workMode === "REMOTE" ? "Remote" : "—");
    const location = j.locationState && !place.includes(j.locationState) ? `${place}, ${j.locationState}` : place;

    // "Must haves" = experience + primary skills + certifications/languages the requisition asks for
    const mustHaves = [
        `${j.experienceMinYears}–${j.experienceMaxYears} years' experience`,
        ...(j.skills?.length ? [`Skills: ${j.skills.join(", ")}`] : []),
        ...(j.certifications?.length ? [`Certifications: ${j.certifications.join(", ")}`] : []),
        ...(j.languages?.length ? [`Languages: ${j.languages.join(", ")}`] : []),
        ...(j.additionalRequirements ? [j.additionalRequirements] : []),
    ];
    const goodToHave = [
        ...(j.preferredSkills?.length ? [`Skills: ${j.preferredSkills.join(", ")}`] : []),
        ...(j.preferredQualification ? [`Qualification: ${j.preferredQualification}`] : []),
    ];

    return {
        code: j.requisitionCode ?? null,
        title: j.title,
        clientName: client?.companyName ?? null,
        applications: opts.internal ? apps.length : null,
        postedAt: j.publishedAt ?? j.approvedAt ?? j.createdAt,
        salaryMinLpa: j.salaryMinLpa,
        salaryMaxLpa: j.salaryMaxLpa,
        location,
        workMode: j.workMode ?? null,
        employmentType: j.employmentType,
        education: j.minimumQualification ?? j.education ?? null,
        experience: `${j.experienceMinYears}–${j.experienceMaxYears} yrs`,
        openPositions: Math.max(0, (j.openings || 0) - filled),
        createdBy: opts.internal ? person(j.requestedById) : null,
        selected: opts.internal ? apps.filter((a) => SELECTED_OR_LATER.includes(a.stage)).length : null,
        joined: opts.internal ? filled : null, // same "filled" the job listing shows
        branchName: opts.internal ? branch || null : null,
        hrManagers: opts.internal ? uniqPeople([person(j.taManagerId), person(j.accountManagerId ?? client?.accountManagerId)]) : null,
        reportingManagers: opts.internal ? [j.hiringManagerName].filter((x): x is string => !!x) : null,
        recruiters: opts.internal ? uniqPeople([person(j.primaryRecruiterId), ...(j.assignedTas ?? []).map(person)]) : null,
        department: j.department || null,
        reportsTo: opts.internal ? j.hiringManagerName ?? null : null,
        descriptionHtml: j.descriptionHtml ?? null,
        description: j.description || null,
        responsibilitiesHtml: j.responsibilitiesHtml ?? null,
        responsibilities: j.responsibilities ?? null,
        mustHaves,
        goodToHave,
        qualification: j.minimumQualification ?? j.education ?? null,
        noticePeriod: j.noticePeriodPreference ?? j.joiningPreference ?? null,
    };
}
