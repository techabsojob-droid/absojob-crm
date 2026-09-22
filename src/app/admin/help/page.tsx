"use client";

import { HelpCircle, BookOpen, MessageSquare, Shield, Terminal, LifeBuoy, ExternalLink, Mail, Phone } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/shared/ui";

export default function HelpSupportPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Super Admin Help & Support Desk"
                subtitle="Documentation, standard operating procedures (SOPs), keyboard shortcuts, and enterprise technical support"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="Agency Playbook" subtitle="Recruitment Operations Manual">
                    <div className="space-y-3 pt-2 text-xs text-neutral-600 leading-relaxed">
                        <p>Learn end-to-end recruitment lifecycle flows: requisition raising, resume screening, scheduling client interviews, release of offer letters, and replacement guarantee terms.</p>
                        <a href="#" className="inline-flex items-center gap-1.5 text-primary font-bold hover:underline">
                            Read SOP Documentation <ExternalLink size={12} />
                        </a>
                    </div>
                </SectionCard>

                <SectionCard title="Keyboard Shortcuts" subtitle="Fast Navigation Controls">
                    <div className="space-y-2 pt-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-neutral-100">
                            <span className="text-neutral-600">Quick Search</span>
                            <kbd className="px-2 py-0.5 bg-neutral-100 rounded text-neutral-800 font-mono font-bold text-[10px]">⌘ / Ctrl + K</kbd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100">
                            <span className="text-neutral-600">Toggle Sidebar</span>
                            <kbd className="px-2 py-0.5 bg-neutral-100 rounded text-neutral-800 font-mono font-bold text-[10px]">⌘ / Ctrl + B</kbd>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-neutral-600">Add Candidate</span>
                            <kbd className="px-2 py-0.5 bg-neutral-100 rounded text-neutral-800 font-mono font-bold text-[10px]">⌘ / Ctrl + N</kbd>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Contact Engineering" subtitle="Priority CRM Support">
                    <div className="space-y-2 pt-2 text-xs text-neutral-600">
                        <p className="flex items-center gap-2">
                            <Mail size={14} className="text-primary" /> support@absojob.com
                        </p>
                        <p className="flex items-center gap-2">
                            <Phone size={14} className="text-primary" /> +91 98200 11223 (Emergency Hotline)
                        </p>
                        <div className="pt-2">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200">
                                System Status: Operational (99.98% Uptime)
                            </span>
                        </div>
                    </div>
                </SectionCard>
            </div>
        </div>
    );
}
