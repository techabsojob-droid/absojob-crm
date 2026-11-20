// ─── Integrations, reported from what the server can actually do ──
// Only email delivery (Resend) is built; the rest are listed so the owner can see what's planned.

export type IntegrationAvailability = "LIVE" | "NEEDS_SETUP" | "NOT_BUILT";

export interface IntegrationStatus {
    id: string;
    name: string;
    provider: string;
    category: string;
    icon: string;
    availability: IntegrationAvailability;
    description: string;
    detail: string;
}

export function integrationCatalog(): IntegrationStatus[] {
    const resend = !!process.env.RESEND_API_KEY;
    return [
        {
            id: "email", name: "Email delivery", provider: "Resend", category: "COMMUNICATION", icon: "Mail",
            availability: resend ? "LIVE" : "NEEDS_SETUP",
            description: "Sends invoices, reminders and other system emails. Every message is also kept in Finance › Outbox.",
            detail: resend
                ? `Sending from ${process.env.MAIL_FROM || "the default sender"}.`
                : "Not configured: emails are logged in Finance › Outbox but not delivered. Set RESEND_API_KEY and MAIL_FROM on the server (Vercel › Settings › Environment Variables), then redeploy.",
        },
        { id: "whatsapp", name: "WhatsApp Business", provider: "Meta", category: "COMMUNICATION", icon: "MessageSquare", availability: "NOT_BUILT", description: "Interview reminders and candidate messages over WhatsApp.", detail: "Not built yet. Recruiters log WhatsApp conversations manually under each candidate's communication log." },
        { id: "naukri", name: "Naukri job portal", provider: "Info Edge", category: "RECRUITMENT", icon: "Briefcase", availability: "NOT_BUILT", description: "Publish jobs and pull applicants from Naukri.", detail: "Not built yet. Add Naukri candidates by CV upload or CSV import." },
        { id: "linkedin", name: "LinkedIn", provider: "LinkedIn", category: "RECRUITMENT", icon: "Briefcase", availability: "NOT_BUILT", description: "Job posting and candidate sourcing from LinkedIn.", detail: "Not built yet. Add LinkedIn candidates by CV upload or CSV import." },
        { id: "calendar", name: "Google Calendar / Meet", provider: "Google", category: "CALENDAR", icon: "Calendar", availability: "NOT_BUILT", description: "Put interviews on interviewers' calendars with a Meet link.", detail: "Not built yet. Interviews are scheduled inside the CRM only." },
        { id: "razorpay", name: "Razorpay payouts", provider: "Razorpay", category: "FINANCE", icon: "CreditCard", availability: "NOT_BUILT", description: "Pay partner commissions and collect client payments online.", detail: "Not built yet. Payouts are marked paid manually in Admin › Finance." },
    ];
}

