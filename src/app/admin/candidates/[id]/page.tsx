"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, User, Briefcase, Building2, MapPin, Phone, Mail,
    Clock, Calendar, Star, GitBranch, AlertTriangle, ShieldCheck, CheckCircle2,
    CalendarCheck, UserPlus, GraduationCap, Link2, FileText, ExternalLink,
    Edit3, X, Award, Check, Video, Github, Globe, Linkedin, BookOpen, Layers,
    DollarSign, MessageSquare, PhoneCall, Send, ShieldAlert, FileCheck, CheckCircle,
    Download, Eye, UserCheck, MessageCircle, AlertCircle, FilePlus
} from "lucide-react";
import Link from "next/link";
import { PageHeader, Badge, SectionCard, StatCard, EmptyState, ModalShell } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { toast } from "sonner";
import { useState } from "react";

export default function CandidateProfilePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const qc = useQueryClient();

    const [activeTab, setActiveTab] = useState("overview");
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<any>({});

    // Quick Action Modals
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [newNoteText, setNewNoteText] = useState("");
    const [newNoteCategory, setNewNoteCategory] = useState<"General" | "Screening" | "Salary" | "Client Feedback" | "Interview">("General");
    const [newNoteIsPrivate, setNewNoteIsPrivate] = useState(false);

    const [commModalOpen, setCommModalOpen] = useState(false);
    const [commForm, setCommForm] = useState({
        type: "PHONE" as const,
        direction: "OUTGOING" as const,
        subject: "",
        message: "",
        outcome: "Connected" as const,
        nextFollowUpDate: ""
    });

    const { data, isLoading } = useQuery({
        queryKey: ["candidate", id],
        queryFn: async () => {
            const res = await fetch(`/api/admin/candidates/${id}`);
            if (!res.ok) throw new Error("Failed to fetch candidate details");
            return res.json();
        },
    });

    const updateCandidate = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch(`/api/admin/candidates/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to update candidate");
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["candidate", id] });
            toast.success("Profile updated successfully");
            setEditModalOpen(false);
            setNoteModalOpen(false);
            setCommModalOpen(false);
            setNewNoteText("");
            setCommForm({
                type: "PHONE",
                direction: "OUTGOING",
                subject: "",
                message: "",
                outcome: "Connected",
                nextFollowUpDate: ""
            });
        },
        onError: () => {
            toast.error("Failed to update profile");
        },
    });

    const openEditModal = () => {
        if (!data?.candidate) return;
        const c = data.candidate;
        setEditForm({
            name: c.name || "",
            email: c.email || "",
            alternateEmail: c.alternateEmail || "",
            phone: c.phone || "",
            alternatePhone: c.alternatePhone || "",
            whatsappNumber: c.whatsappNumber || "",
            location: c.location || "",
            currentCity: c.currentCity || "",
            currentState: c.currentState || "",
            currentCompany: c.currentCompany || "",
            currentDesignation: c.currentDesignation || "",
            previousCompany: c.previousCompany || "",
            headline: c.headline || "",
            bio: c.bio || "",
            totalExperienceYears: c.totalExperienceYears ?? 0,
            relevantExperienceYears: c.relevantExperienceYears ?? 0,
            currentCtcLpa: c.currentCtcLpa ?? 0,
            expectedCtcLpa: c.expectedCtcLpa ?? 0,
            noticePeriodDays: c.noticePeriodDays ?? 0,
            skills: (c.skills || []).join(", "),
            primarySkills: (c.primarySkills || []).join(", "),
            secondarySkills: (c.secondarySkills || []).join(", "),
            certifications: (c.certifications || []).join(", "),
            linkedinUrl: c.linkedinUrl || "",
            githubUrl: c.githubUrl || "",
            portfolioUrl: c.portfolioUrl || "",
            resumeUrl: c.resumeUrl || "",
            blacklisted: c.blacklisted || false,
            blacklistReason: c.blacklistReason || "",
            status: c.status || "ACTIVE",
            tags: (c.tags || []).join(", "),
        });
        setEditModalOpen(true);
    };

    const handleSaveEdit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...editForm,
            totalExperienceYears: Number(editForm.totalExperienceYears),
            relevantExperienceYears: Number(editForm.relevantExperienceYears),
            currentCtcLpa: Number(editForm.currentCtcLpa),
            expectedCtcLpa: Number(editForm.expectedCtcLpa),
            noticePeriodDays: Number(editForm.noticePeriodDays),
            skills: typeof editForm.skills === "string"
                ? editForm.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
                : editForm.skills,
            primarySkills: typeof editForm.primarySkills === "string"
                ? editForm.primarySkills.split(",").map((s: string) => s.trim()).filter(Boolean)
                : editForm.primarySkills,
            secondarySkills: typeof editForm.secondarySkills === "string"
                ? editForm.secondarySkills.split(",").map((s: string) => s.trim()).filter(Boolean)
                : editForm.secondarySkills,
            certifications: typeof editForm.certifications === "string"
                ? editForm.certifications.split(",").map((s: string) => s.trim()).filter(Boolean)
                : editForm.certifications,
            tags: typeof editForm.tags === "string"
                ? editForm.tags.split(",").map((s: string) => s.trim()).filter(Boolean)
                : editForm.tags,
        };
        updateCandidate.mutate(payload);
    };

    const handleAddNote = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoteText.trim()) return;
        updateCandidate.mutate({
            newNote: {
                text: newNoteText,
                category: newNoteCategory,
                isPrivate: newNoteIsPrivate
            }
        });
    };

    const handleAddComm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commForm.subject.trim() || !commForm.message.trim()) return;
        updateCandidate.mutate({
            newCommunication: commForm
        });
    };

    if (isLoading || !data) {
        return (
            <div className="space-y-6">
                <div className="flex gap-4 items-center mb-6">
                    <SkeletonPulse className="w-10 h-10 rounded-xl" />
                    <SkeletonPulse className="w-64 h-8" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <SkeletonPulse className="lg:col-span-1 h-96 rounded-2xl" />
                    <div className="lg:col-span-2 space-y-6">
                        <SkeletonPulse className="h-32 rounded-2xl" />
                        <SkeletonPulse className="h-64 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    const { candidate, referredByUser, referral, applications, timeline, stats, allInterviews } = data;

    const TimeIcon = ({ type }: { type: string }) => {
        const I = {
            USER_PLUS: UserPlus,
            BRIEFCASE: Briefcase,
            ARROW_RIGHT: GitBranch,
            CHECK_CIRCLE: CheckCircle2,
            X_CIRCLE: AlertTriangle,
            CALENDAR: CalendarCheck,
        }[type] || Clock;
        return <I size={14} className="text-white" />;
    };

    const TimeColor = (type: string) => {
        return {
            USER_PLUS: "bg-blue-500",
            BRIEFCASE: "bg-purple-500",
            ARROW_RIGHT: "bg-indigo-500",
            CHECK_CIRCLE: "bg-emerald-500",
            X_CIRCLE: "bg-red-500",
            CALENDAR: "bg-amber-500",
        }[type] || "bg-neutral-500";
    };

    const workExperience = candidate.workExperience || [];
    const educationList = candidate.education || [];
    const detailedSkills = candidate.detailedSkills || [];
    const preferences = candidate.preferences;
    const compensation = candidate.compensationDetails;
    const availability = candidate.availabilityDetails;
    const documents = candidate.documents || [];
    const communications = candidate.communications || [];
    const notes = candidate.notes || [];
    const screening = candidate.screeningEvaluation;
    const ownership = candidate.ownership;
    const compliance = candidate.compliance;
    const referenceChecks = candidate.referenceChecks || [];
    const tags = candidate.tags || [];

    const completionScore = candidate.profileCompletionScore || 85;

    return (
        <div className="space-y-6 animate-fade-in pb-16">
            {/* Top Bar with Navigation & Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()} 
                        className="w-10 h-10 bg-white border border-neutral-200 rounded-xl flex items-center justify-center text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors shadow-xs"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                                {candidate.candidateCode || "CAN-8901"}
                            </span>
                            <h1 className="text-2xl font-black text-neutral-900 leading-tight">
                                {candidate.name}
                            </h1>
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {candidate.status || "ACTIVE"}
                            </span>
                            {candidate.blacklisted && <Badge value="BLACKLISTED" label="Blacklisted" />}
                            {stats.currentStage === "JOINED" && <Badge value="JOINED" label="Placed Employee" />}
                        </div>
                        <p className="text-sm font-semibold text-primary mt-1 flex items-center gap-2 flex-wrap">
                            {candidate.currentDesignation ?? "Professional"}
                            {candidate.currentCompany && <span className="text-neutral-400 font-normal">at {candidate.currentCompany}</span>}
                            {candidate.location && <span className="text-neutral-400 font-normal">· {candidate.location}</span>}
                            <span className="text-neutral-300">|</span>
                            <span className="text-xs text-neutral-500 font-normal">
                                Owner: <strong className="text-neutral-700">{ownership?.assignedRecruiterName || "Neha Sharma"}</strong>
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Rating stars */}
                    <div className="flex items-center bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs px-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <button
                                key={s}
                                onClick={() => updateCandidate.mutate({ rating: s })}
                                className={`p-1.5 transition-colors ${
                                    candidate.rating >= s ? "text-amber-500" : "text-neutral-200 hover:text-amber-300"
                                }`}
                                title={`Rate ${s} Stars`}
                            >
                                <Star size={15} className={candidate.rating >= s ? "fill-amber-500" : ""} />
                            </button>
                        ))}
                    </div>

                    {/* Download Resume Quick Action Button */}
                    {(candidate.resumeUrl || documents.find((d: any) => d.type === "RESUME")?.fileUrl) && (
                        <a
                            href={candidate.resumeUrl || documents.find((d: any) => d.type === "RESUME")?.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                        >
                            <Download size={14} /> Download Resume
                        </a>
                    )}

                    <button
                        onClick={() => setNoteModalOpen(true)}
                        className="px-3.5 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                        <MessageSquare size={14} className="text-neutral-500" /> Add Note
                    </button>

                    <button
                        onClick={() => setCommModalOpen(true)}
                        className="px-3.5 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                        <PhoneCall size={14} className="text-neutral-500" /> Log Comm
                    </button>

                    <button
                        onClick={openEditModal}
                        className="px-3.5 py-2 bg-primary text-white hover:bg-primary-dark rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                        <Edit3 size={14} /> Edit Profile
                    </button>

                    <button
                        onClick={() => updateCandidate.mutate({ blacklisted: !candidate.blacklisted })}
                        className={`px-3 py-2 ${candidate.blacklisted ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'} border rounded-xl text-xs font-bold transition-all shadow-xs`}
                    >
                        {candidate.blacklisted ? "Restore" : "Blacklist"}
                    </button>
                </div>
            </div>

            {/* Profile Completion Bar */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                        {completionScore}%
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-neutral-800">Profile Completion Score</h4>
                        <p className="text-[11px] text-neutral-500">
                            {completionScore >= 90 ? "Candidate profile is enterprise-ready and verified." : "Complete missing preferences & verified documents for client submission."}
                        </p>
                    </div>
                </div>
                <div className="w-full md:w-64 bg-neutral-100 h-2.5 rounded-full overflow-hidden shrink-0">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${completionScore >= 80 ? "bg-emerald-500" : "bg-amber-500"}`} 
                        style={{ width: `${completionScore}%` }} 
                    />
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-600">
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={13} /> Resume Verified</span>
                    <span className="text-neutral-300">•</span>
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={13} /> GDPR Consent Active</span>
                </div>
            </div>

            {/* Main 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left Column: 360° Identity, Contact, Compensation, Preferences */}
                <div className="lg:col-span-1 space-y-6">
                    <SectionCard className="border-t-4 border-t-primary rounded-t-xl overflow-hidden p-0">
                        <div className="p-6 space-y-6">
                            
                            {/* Headline */}
                            {candidate.headline && (
                                <div className="bg-primary/5 border border-primary/10 rounded-xl p-3.5">
                                    <p className="text-xs font-bold text-primary leading-snug">{candidate.headline}</p>
                                </div>
                            )}

                            {/* Tags */}
                            {tags.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Candidate Badges & Tags</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {tags.map((t: string) => (
                                            <span key={t} className="px-2.5 py-0.5 bg-neutral-100 text-neutral-700 font-bold text-[11px] rounded-md border border-neutral-200/60 shadow-2xs">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Contact Box */}
                            <div className="bg-neutral-50 p-4 rounded-xl space-y-3 border border-neutral-100">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Direct Contact Details</p>
                                <div className="flex items-center gap-3 text-xs font-medium text-neutral-700">
                                    <Mail size={15} className="text-primary shrink-0" />
                                    <span className="truncate font-semibold" title={candidate.email}>{candidate.email}</span>
                                </div>
                                {candidate.alternateEmail && (
                                    <div className="flex items-center gap-3 text-xs font-medium text-neutral-500 pl-6">
                                        <span className="truncate">Alt: {candidate.alternateEmail}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-xs font-medium text-neutral-700">
                                    <Phone size={15} className="text-primary shrink-0" />
                                    <span className="font-semibold">{candidate.phone || "No phone added"}</span>
                                </div>
                                {candidate.whatsappNumber && (
                                    <div className="flex items-center gap-3 text-xs font-medium text-emerald-700">
                                        <MessageCircle size={15} className="text-emerald-600 shrink-0" />
                                        <span className="font-semibold">WA: {candidate.whatsappNumber}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-xs font-medium text-neutral-700">
                                    <MapPin size={15} className="text-primary shrink-0" />
                                    <span>{candidate.location || "No location set"}</span>
                                </div>
                                {candidate.permanentAddress && (
                                    <p className="text-[11px] text-neutral-500 pl-6 leading-relaxed">
                                        {candidate.permanentAddress} {candidate.pinCode && `(${candidate.pinCode})`}
                                    </p>
                                )}

                                {(candidate.resumeUrl || documents.find((d: any) => d.type === "RESUME")?.fileUrl) && (
                                    <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between text-xs">
                                        <span className="font-bold text-neutral-700 flex items-center gap-1.5">
                                            <FileText size={14} className="text-primary" /> Verified Resume
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <a 
                                                href={candidate.resumeUrl || documents.find((d: any) => d.type === "RESUME")?.fileUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-primary hover:underline font-bold flex items-center gap-1 text-[11px]"
                                            >
                                                Preview <ExternalLink size={11} />
                                            </a>
                                            <span className="text-neutral-300">•</span>
                                            <a 
                                                href={candidate.resumeUrl || documents.find((d: any) => d.type === "RESUME")?.fileUrl} 
                                                download 
                                                className="text-emerald-700 hover:underline font-bold flex items-center gap-1 text-[11px]"
                                            >
                                                <Download size={11} /> Download
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Social / Portfolio Links */}
                            {(candidate.linkedinUrl || candidate.githubUrl || candidate.portfolioUrl) && (
                                <div className="flex gap-2">
                                    {candidate.linkedinUrl && (
                                        <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-200 hover:border-blue-300 hover:bg-blue-50 text-neutral-700 hover:text-blue-700 text-xs font-bold transition-colors">
                                            <Linkedin size={14} className="text-blue-600" /> LinkedIn
                                        </a>
                                    )}
                                    {candidate.githubUrl && (
                                        <a href={candidate.githubUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-100 text-neutral-700 text-xs font-bold transition-colors">
                                            <Github size={14} /> GitHub
                                        </a>
                                    )}
                                    {candidate.portfolioUrl && (
                                        <a href={candidate.portfolioUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50 text-neutral-700 hover:text-emerald-700 text-xs font-bold transition-colors">
                                            <Globe size={14} className="text-emerald-600" /> Portfolio
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Vital Compensation & Availability */}
                            <div className="border-t border-neutral-100 pt-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Compensation Package</p>
                                    <span className="text-[10px] font-extrabold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                                        {compensation?.salaryCurrency || "INR"}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-neutral-50/80 p-3.5 rounded-xl border border-neutral-100">
                                    <div>
                                        <p className="text-[10px] font-bold text-neutral-400">Current Fixed</p>
                                        <p className="text-sm font-black text-neutral-800">
                                            ₹{compensation?.currentFixedLpa ?? candidate.currentCtcLpa}L
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-neutral-400">Variable / Bonus</p>
                                        <p className="text-sm font-black text-neutral-800">
                                            ₹{compensation?.currentVariableLpa ?? 0}L
                                        </p>
                                    </div>
                                    <div className="border-t border-neutral-200/50 pt-2">
                                        <p className="text-[10px] font-bold text-primary">Expected Total CTC</p>
                                        <p className="text-base font-black text-primary">
                                            ₹{candidate.expectedCtcLpa}L
                                        </p>
                                    </div>
                                    <div className="border-t border-neutral-200/50 pt-2">
                                        <p className="text-[10px] font-bold text-neutral-500">Min Acceptable</p>
                                        <p className="text-sm font-black text-neutral-700">
                                            ₹{compensation?.minimumAcceptableLpa ?? candidate.expectedCtcLpa * 0.9}L
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Notice Period & Joining Timeline */}
                            <div className="border-t border-neutral-100 pt-5 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Notice Period & Joining</p>
                                <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3.5 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-amber-900">
                                            {availability?.availabilityStatus || `${candidate.noticePeriodDays} Days Notice`}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${availability?.servingNotice ? "bg-amber-200 text-amber-800" : "bg-neutral-200 text-neutral-700"}`}>
                                            {availability?.servingNotice ? "Serving Notice" : "Not Serving"}
                                        </span>
                                    </div>
                                    {availability?.lastWorkingDay && (
                                        <p className="text-xs text-neutral-600">
                                            Last Working Day: <strong className="text-neutral-900">{availability.lastWorkingDay}</strong>
                                        </p>
                                    )}
                                    {availability?.buyoutPossible && (
                                        <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                                            <CheckCircle2 size={13} /> Buyout possible by new employer
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Work Preferences */}
                            {preferences && (
                                <div className="border-t border-neutral-100 pt-5 space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Work Preferences</p>
                                    <div className="space-y-1.5 text-xs text-neutral-700">
                                        <div className="flex justify-between">
                                            <span className="text-neutral-500">Mode:</span>
                                            <span className="font-bold text-neutral-800">{preferences.preferredWorkMode}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-500">Locations:</span>
                                            <span className="font-bold text-neutral-800">{preferences.preferredLocations.join(", ")}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-500">Relocation:</span>
                                            <span className="font-bold text-neutral-800">{preferences.willingToRelocate ? "Yes" : "No"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-500">Work Auth:</span>
                                            <span className="font-bold text-neutral-800">{preferences.workAuthorization || "Authorized"}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recruiter Ownership & Sourcing */}
                            <div className="border-t border-neutral-100 pt-5 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Recruiter Ownership</p>
                                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 space-y-2 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-neutral-500">Assigned TA:</span>
                                        <span className="font-bold text-neutral-900">{ownership?.assignedRecruiterName || "Neha Sharma"}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-neutral-500">TA Manager:</span>
                                        <span className="font-bold text-neutral-900">{ownership?.taManagerName || "Amit Joshi"}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-neutral-500">Team:</span>
                                        <span className="font-bold text-neutral-800">{ownership?.recruitmentTeam || "Enterprise Squad"}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-neutral-500">Source:</span>
                                        <Badge value={candidate.source} />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </SectionCard>
                </div>

                {/* Right Column: Multi-Tab 360° Recruiter Workspace */}
                <div className="lg:col-span-2 space-y-6">

                    {/* KPI Quick Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 items-center justify-center flex flex-col rounded-2xl border border-neutral-200/80 shadow-xs">
                            <span className="text-3xl font-black text-primary mb-1">{stats.totalApplications}</span>
                            <span className="text-[10px] font-bold uppercase text-neutral-400">Applications</span>
                        </div>
                        <div className="bg-white p-4 items-center justify-center flex flex-col rounded-2xl border border-neutral-200/80 shadow-xs">
                            <span className="text-3xl font-black text-indigo-600 mb-1">{stats.totalInterviews}</span>
                            <span className="text-[10px] font-bold uppercase text-neutral-400">Interviews</span>
                        </div>
                        <div className="bg-white p-4 items-center justify-center flex flex-col rounded-2xl border border-neutral-200/80 shadow-xs">
                            <span className="text-3xl font-black text-amber-500 mb-1">{stats.avgInterviewScore || "—"}</span>
                            <span className="text-[10px] font-bold uppercase text-neutral-400">Avg Score</span>
                        </div>
                        <div className="bg-white p-4 items-center justify-center flex flex-col rounded-2xl border border-neutral-200/80 shadow-xs">
                            <span className="text-3xl font-black text-emerald-600 mb-1">{stats.activeApplications}</span>
                            <span className="text-[10px] font-bold uppercase text-neutral-400">Active Pipeline</span>
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
                        <div className="flex items-center gap-1 border-b border-neutral-100 px-2 pt-2 overflow-x-auto no-scrollbar">
                            {[
                                { id: "overview", label: "Experience & Education", icon: BookOpen },
                                { id: "skills", label: "Skills Matrix", icon: Layers },
                                { id: "pipeline", label: "Applications & Pipeline", icon: Briefcase },
                                { id: "interviews", label: "Interviews", icon: Video },
                                { id: "documents", label: `Documents (${documents.length})`, icon: FileText },
                                { id: "communications", label: `Comms (${communications.length})`, icon: PhoneCall },
                                { id: "notes", label: `Notes (${notes.length})`, icon: MessageSquare },
                                { id: "screening", label: "Evaluation & Compliance", icon: ShieldCheck },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold transition-all border-b-2 rounded-t-xl shrink-0 ${
                                        activeTab === tab.id
                                            ? "border-primary text-primary bg-primary/5"
                                            : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                                    }`}
                                >
                                    <tab.icon size={14} /> {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            
                            {/* TAB 1: Experience & Education */}
                            {activeTab === "overview" && (
                                <div className="space-y-8">
                                    {/* Candidate Bio */}
                                    {candidate.bio && (
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                                <User size={14} className="text-primary" /> Professional Summary
                                            </h3>
                                            <p className="text-sm text-neutral-700 bg-neutral-50 border border-neutral-100 p-4 rounded-xl leading-relaxed">
                                                {candidate.bio}
                                            </p>
                                        </div>
                                    )}

                                    {/* Work Experience Timeline */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                                <Briefcase size={14} className="text-primary" /> Work Experience & Career History
                                            </h3>
                                            <span className="text-xs font-bold text-neutral-500">{candidate.totalExperienceYears} Years Total</span>
                                        </div>

                                        {workExperience.length === 0 ? (
                                            <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-100 text-center text-xs text-neutral-500">
                                                Currently with <strong className="text-neutral-800">{candidate.currentCompany || "Previous Employer"}</strong> as <strong className="text-neutral-800">{candidate.currentDesignation || "Engineer"}</strong>. Detailed past history not uploaded.
                                            </div>
                                        ) : (
                                            <div className="relative border-l-2 border-primary/20 ml-3 space-y-6 pb-2">
                                                {workExperience.map((exp: any) => (
                                                    <div key={exp.id} className="relative pl-6">
                                                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-xs" />
                                                        <div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs space-y-2 hover:border-primary/40 transition-colors">
                                                            <div className="flex items-start justify-between flex-wrap gap-2">
                                                                <div>
                                                                    <h4 className="font-extrabold text-neutral-900 text-sm">{exp.designation}</h4>
                                                                    <p className="text-xs font-bold text-primary flex items-center gap-1.5 mt-0.5">
                                                                        <Building2 size={13} /> {exp.company}
                                                                        {exp.location && <span className="text-neutral-400 font-normal">· {exp.location}</span>}
                                                                    </p>
                                                                </div>
                                                                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${exp.currentlyWorking ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-neutral-100 text-neutral-600"}`}>
                                                                    {exp.startDate} → {exp.currentlyWorking ? "Present" : exp.endDate}
                                                                </span>
                                                            </div>
                                                            {exp.description && (
                                                                <p className="text-xs text-neutral-600 leading-relaxed pt-1 border-t border-neutral-100 mt-2">
                                                                    {exp.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Education History */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                            <GraduationCap size={15} className="text-indigo-600" /> Education & Qualifications
                                        </h3>

                                        {educationList.length === 0 ? (
                                            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs text-neutral-500">
                                                Graduate Degree in Engineering / Technology.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {educationList.map((edu: any) => (
                                                    <div key={edu.id} className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs space-y-1.5 hover:border-indigo-300 transition-colors">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h4 className="font-extrabold text-neutral-900 text-sm">{edu.degree}</h4>
                                                            {edu.grade && (
                                                                <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                                                    {edu.grade}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs font-semibold text-neutral-700">{edu.fieldOfStudy}</p>
                                                        <p className="text-xs text-neutral-500 flex items-center gap-1">
                                                            <Building2 size={12} className="text-neutral-400" /> {edu.institution}
                                                        </p>
                                                        {(edu.startYear || edu.endYear) && (
                                                            <p className="text-[10px] text-neutral-400 font-bold pt-1">
                                                                Batch: {edu.startYear || "—"} – {edu.endYear || "—"}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: Skills Matrix */}
                            {activeTab === "skills" && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                                            Categorized Technical Competencies
                                        </h3>
                                        <span className="text-xs font-bold text-neutral-500">{detailedSkills.length || candidate.skills.length} skills indexed</span>
                                    </div>

                                    {detailedSkills.length > 0 ? (
                                        <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                                                    <tr>
                                                        <th className="py-3 px-4">Skill / Technology</th>
                                                        <th className="py-3 px-4">Category</th>
                                                        <th className="py-3 px-4">Experience</th>
                                                        <th className="py-3 px-4">Proficiency</th>
                                                        <th className="py-3 px-4">Verification</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-neutral-100">
                                                    {detailedSkills.map((sk: any, i: number) => (
                                                        <tr key={i} className="hover:bg-neutral-50/60 transition-colors">
                                                            <td className="py-3 px-4 font-bold text-neutral-900 flex items-center gap-1.5">
                                                                {sk.name}
                                                                {sk.primary && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">Core</span>}
                                                            </td>
                                                            <td className="py-3 px-4 text-neutral-500">{sk.category}</td>
                                                            <td className="py-3 px-4 text-neutral-700 font-semibold">{sk.experienceYears} Years</td>
                                                            <td className="py-3 px-4">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                                                    sk.proficiency === "Expert" ? "bg-purple-100 text-purple-700" :
                                                                    sk.proficiency === "Advanced" ? "bg-blue-100 text-blue-700" :
                                                                    "bg-neutral-100 text-neutral-600"
                                                                }`}>
                                                                    {sk.proficiency}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                {sk.verified ? (
                                                                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                                                                        <CheckCircle2 size={13} className="text-emerald-600" /> Verified
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-neutral-400">Self Reported</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {candidate.skills.map((s: string) => (
                                                <span key={s} className="px-3 py-1.5 bg-neutral-100 text-neutral-800 rounded-lg text-xs font-bold border border-neutral-200">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Certifications */}
                                    {candidate.certifications?.length > 0 && (
                                        <div className="pt-4 border-t border-neutral-100 space-y-3">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                                                <Award size={14} className="text-emerald-600" /> Official Certifications
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {candidate.certifications.map((c: string) => (
                                                    <div key={c} className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2.5">
                                                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                                        <span className="text-xs font-bold text-emerald-900">{c}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: Applications & Pipeline */}
                            {activeTab === "pipeline" && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                                            Job Applications & Submissions ({applications.length})
                                        </h3>
                                        <Link href="/admin/jobs" className="text-xs font-bold text-primary hover:underline">
                                            + Submit to Another Job
                                        </Link>
                                    </div>

                                    {applications.length === 0 ? (
                                        <EmptyState icon={Briefcase} message="Candidate has not been added to any pipelines." />
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {applications.map((app: any) => (
                                                <div key={app.id} className="border border-neutral-200/80 rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-start justify-between gap-2 mb-3">
                                                            <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 border border-neutral-200/50">
                                                                <Building2 size={18} className="text-neutral-500" />
                                                            </div>
                                                            <Badge value={app.stage} />
                                                        </div>
                                                        <h4 className="font-bold text-neutral-900 text-sm line-clamp-1">{app.jobTitle}</h4>
                                                        <p className="text-[11px] font-semibold text-primary mt-0.5">{app.clientName}</p>
                                                        
                                                        <div className="mt-4 space-y-1.5">
                                                            <div className="flex justify-between items-center text-[10px] font-bold bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-100">
                                                                <span className="text-neutral-400 uppercase tracking-widest">Fit Score</span>
                                                                <span className={app.fitScore >= 80 ? "text-emerald-600 font-extrabold" : "text-amber-600 font-extrabold"}>{app.fitScore}%</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px] font-bold bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-100">
                                                                <span className="text-neutral-400 uppercase tracking-widest">Recruiter</span>
                                                                <span className="text-neutral-800">{app.recruiterName}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px] font-bold bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-100">
                                                                <span className="text-neutral-400 uppercase tracking-widest">Interviews</span>
                                                                <span className="text-neutral-800">{app.interviews.length} rounds scheduled</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Link href={`/admin/jobs?id=${app.jobId}`} className="mt-5 text-[11px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg py-2 w-full flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                                                        View Job Requisition <Link2 size={12} />
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Timeline */}
                                    <div className="pt-6 border-t border-neutral-100 space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Complete Journey Timeline</h3>
                                        <div className="relative border-l-2 border-neutral-100 ml-4 space-y-6 pb-4">
                                            {timeline.map((event: any, i: number) => {
                                                const d = new Date(event.date);
                                                return (
                                                    <div key={i} className="relative pl-6 sm:pl-8 group">
                                                        <div className={`absolute -left-[17px] top-0.5 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm ${TimeColor(event.type)}`}>
                                                            <TimeIcon type={event.icon} />
                                                        </div>
                                                        <div className="bg-white border border-neutral-100 rounded-xl p-3.5 shadow-xs group-hover:border-primary/30 group-hover:shadow-md transition-all sm:flex sm:items-start sm:justify-between sm:gap-4">
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-neutral-900 text-sm">{event.title}</p>
                                                                <p className="text-xs text-neutral-500 mt-1 leading-snug">{event.detail}</p>
                                                            </div>
                                                            <div className="shrink-0 mt-2 sm:mt-0 text-left sm:text-right">
                                                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</p>
                                                                <p className="text-[10px] text-neutral-300 font-medium">{d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: Interviews */}
                            {activeTab === "interviews" && (
                                <div className="space-y-4">
                                    {allInterviews.length === 0 ? (
                                        <EmptyState icon={Clock} message="No interviews scheduled or completed yet." />
                                    ) : (
                                        <div className="divide-y divide-neutral-100">
                                            {allInterviews.map((int: any) => (
                                                <div key={int.id} className="py-4 hover:bg-neutral-50/50 transition-colors -mx-6 px-6 sm:flex sm:items-start sm:justify-between sm:gap-4">
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <Badge value={int.status} />
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                                                                {int.round.replaceAll("_", " ")}
                                                            </span>
                                                        </div>
                                                        <p className="font-bold text-neutral-900 text-sm">{int.jobTitle} <span className="text-neutral-400 font-normal">@ {int.clientName}</span></p>
                                                        <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                                                            <User size={12} className="text-neutral-400" /> Panel: <strong className="text-neutral-700">{int.interviewerName}</strong>
                                                            <span className="mx-1">•</span> <Building2 size={12} className="text-neutral-400" /> Mode: <strong>{int.mode}</strong>
                                                        </p>
                                                        {int.feedback && (
                                                            <div className="mt-2.5 bg-neutral-50 border border-neutral-100 p-2.5 rounded-lg text-[11px] text-neutral-600 prose-sm">
                                                                <span className="font-bold text-neutral-400 uppercase tracking-widest text-[9px] block mb-1">Feedback</span>
                                                                &quot;{int.feedback}&quot;
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="shrink-0 mt-3 sm:mt-0 text-left sm:text-right bg-white sm:bg-transparent rounded-lg border sm:border-0 border-neutral-100 p-3 sm:p-0">
                                                        <p className="text-xs font-bold text-neutral-900 flex items-center sm:justify-end gap-1.5 mb-1"><Calendar size={14} className="text-primary" /> {new Date(int.scheduledAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                                                        {int.score != null ? (
                                                            <p className="text-xs font-black text-amber-500 bg-amber-50 inline-block px-2 py-1 rounded-lg border border-amber-100">Score: {int.score}/10</p>
                                                        ) : (
                                                            <p className="text-[10px] text-neutral-400 font-medium">{int.durationMins} mins</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 5: Documents & Resumes */}
                            {activeTab === "documents" && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                                            Verified Candidate Records & Resumes
                                        </h3>
                                        <button 
                                            onClick={() => toast.info("Document upload dialog triggered.")}
                                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            <FilePlus size={14} /> Upload New Document
                                        </button>
                                    </div>

                                    {documents.length === 0 ? (
                                        <EmptyState icon={FileText} message="No documents or resumes uploaded." />
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {documents.map((doc: any) => (
                                                <div key={doc.id} className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-primary/40 transition-colors space-y-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-neutral-900 text-xs line-clamp-1">{doc.name}</h4>
                                                                <p className="text-[10px] text-neutral-400">{doc.type} · {doc.fileSizeKb} KB · v{doc.version}</p>
                                                            </div>
                                                        </div>
                                                        {doc.verified ? (
                                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                                                <Check size={11} /> Verified
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">Pending</span>
                                                        )}
                                                    </div>

                                                    <div className="text-[10px] text-neutral-500 space-y-1 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                                                        <p>Uploaded by: <strong className="text-neutral-700">{doc.uploadedBy}</strong> on {doc.uploadDate}</p>
                                                        {doc.verifiedBy && <p>Verified by: <strong className="text-neutral-700">{doc.verifiedBy}</strong> on {doc.verificationDate}</p>}
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                                                        <a 
                                                            href={doc.fileUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg flex items-center gap-1 transition-colors"
                                                        >
                                                            <Eye size={13} /> View
                                                        </a>
                                                        <a 
                                                            href={doc.fileUrl} 
                                                            download 
                                                            className="px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-100 rounded-lg flex items-center gap-1 transition-colors"
                                                        >
                                                            <Download size={13} /> Download
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 6: Communication History */}
                            {activeTab === "communications" && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                                            Recruitment Communication Timeline
                                        </h3>
                                        <button 
                                            onClick={() => setCommModalOpen(true)}
                                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            <PhoneCall size={14} /> + Log Interaction
                                        </button>
                                    </div>

                                    {communications.length === 0 ? (
                                        <EmptyState icon={PhoneCall} message="No communications logged yet." />
                                    ) : (
                                        <div className="space-y-4">
                                            {communications.map((c: any) => (
                                                <div key={c.id} className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 transition-colors space-y-2">
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                                                {c.type}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-neutral-400 uppercase">
                                                                {c.direction}
                                                            </span>
                                                            <h4 className="font-bold text-neutral-900 text-sm">{c.subject}</h4>
                                                        </div>
                                                        <span className="text-[10px] font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                                                            Outcome: {c.outcome}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-neutral-700 leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                                                        {c.message}
                                                    </p>
                                                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                                                        <span>Logged by <strong className="text-neutral-700">{c.createdByName}</strong></span>
                                                        <span>{new Date(c.createdAt).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 7: Internal Recruiter Notes */}
                            {activeTab === "notes" && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                                            Confidential Recruiter & Screening Notes
                                        </h3>
                                        <button 
                                            onClick={() => setNoteModalOpen(true)}
                                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            <MessageSquare size={14} /> + New Note
                                        </button>
                                    </div>

                                    {notes.length === 0 ? (
                                        <EmptyState icon={MessageSquare} message="No recruiter notes added yet." />
                                    ) : (
                                        <div className="space-y-3">
                                            {notes.map((n: any) => (
                                                <div key={n.id} className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 transition-colors space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                                                {n.category}
                                                            </span>
                                                            {n.isPrivate && (
                                                                <span className="text-[10px] font-extrabold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                                                                    Confidential (Admin Only)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-neutral-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-xs text-neutral-800 leading-relaxed">
                                                        {n.text}
                                                    </p>
                                                    <p className="text-[10px] font-semibold text-neutral-400 pt-1 border-t border-neutral-100">
                                                        By: {n.authorName}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 8: Evaluation & Compliance */}
                            {activeTab === "screening" && (
                                <div className="space-y-6">
                                    {/* Screening scorecard */}
                                    {screening && (
                                        <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600 flex items-center gap-2">
                                                    <UserCheck size={16} className="text-primary" /> Recruiter Screening Evaluation
                                                </h3>
                                                <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                                    {screening.recruiterRecommendation}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                                <div className="bg-white p-3 rounded-xl border border-neutral-200/60">
                                                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Communication</p>
                                                    <p className="text-sm font-black text-neutral-800 mt-1">{screening.communicationRating} / 5</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-neutral-200/60">
                                                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Technical Fit</p>
                                                    <p className="text-sm font-black text-neutral-800 mt-1">{screening.technicalRating} / 5</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-neutral-200/60">
                                                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Culture & Team Fit</p>
                                                    <p className="text-sm font-black text-neutral-800 mt-1">{screening.cultureFit} / 5</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-neutral-200/60">
                                                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Relevant Exp Fit</p>
                                                    <p className="text-sm font-black text-neutral-800 mt-1">{screening.relevantExperienceFit} / 5</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-neutral-200/60">
                                                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Salary Alignment</p>
                                                    <p className="text-sm font-black text-neutral-800 mt-1">{screening.salaryFit} / 5</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-neutral-200/60">
                                                    <p className="text-[10px] font-bold text-primary uppercase">Overall Fit Rating</p>
                                                    <p className="text-sm font-black text-primary mt-1">{screening.overallFitRating} / 5</p>
                                                </div>
                                            </div>

                                            <div className="bg-white p-3.5 rounded-xl border border-neutral-200/60 text-xs">
                                                <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px] mb-1">Recruiter Review Remarks</p>
                                                <p className="text-neutral-700 leading-relaxed">{screening.screeningNotes}</p>
                                                <p className="text-[10px] text-neutral-400 font-semibold mt-2">
                                                    Evaluated by {screening.evaluatedByName} on {screening.evaluatedAt}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Reference checks */}
                                    {referenceChecks.length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Reference Checks</h4>
                                            {referenceChecks.map((ref: any) => (
                                                <div key={ref.id} className="p-4 rounded-xl border border-neutral-200 bg-white space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h5 className="font-bold text-neutral-900 text-xs">{ref.name}</h5>
                                                            <p className="text-[11px] text-neutral-500">{ref.designation} at {ref.company} ({ref.relationship})</p>
                                                        </div>
                                                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                                                            {ref.status}
                                                        </span>
                                                    </div>
                                                    {ref.feedback && (
                                                        <p className="text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                                                            &quot;{ref.feedback}&quot;
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* GDPR & Compliance Box */}
                                    {compliance && (
                                        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck size={16} className="text-emerald-600" />
                                                <h4 className="text-xs font-bold text-emerald-900">GDPR & Candidate Consent Records</h4>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-emerald-800 font-semibold pt-1">
                                                <span className="flex items-center gap-1"><Check size={12} /> Data Processing</span>
                                                <span className="flex items-center gap-1"><Check size={12} /> Client Submission</span>
                                                <span className="flex items-center gap-1"><Check size={12} /> Resume Sharing</span>
                                                <span className="flex items-center gap-1"><Check size={12} /> Communication</span>
                                            </div>
                                            <p className="text-[10px] text-emerald-700 pt-2 border-t border-emerald-200/60">
                                                Consent obtained on {compliance.consentDate} via {compliance.consentSource}. Data retained until {compliance.dataRetentionUntil}.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Action: Add Recruiter Note Modal */}
            <ModalShell open={noteModalOpen} onClose={() => setNoteModalOpen(false)} title="Add Recruiter Note">
                <form onSubmit={handleAddNote} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Category</label>
                        <select 
                            value={newNoteCategory} 
                            onChange={(e: any) => setNewNoteCategory(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                        >
                            <option value="General">General Note</option>
                            <option value="Screening">Screening & Profile Assessment</option>
                            <option value="Salary">Salary Negotiation & CTC</option>
                            <option value="Client Feedback">Client Review & Comments</option>
                            <option value="Interview">Interview Performance</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Note Content *</label>
                        <textarea 
                            required
                            rows={4}
                            value={newNoteText} 
                            onChange={(e) => setNewNoteText(e.target.value)} 
                            placeholder="Enter notes on candidate discussion, technical feedback, or red flags..." 
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs leading-relaxed focus:border-primary outline-none"
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input 
                            type="checkbox" 
                            checked={newNoteIsPrivate} 
                            onChange={(e) => setNewNoteIsPrivate(e.target.checked)} 
                            className="rounded border-neutral-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-semibold text-neutral-700">Mark as confidential (Super Admin & TA Manager only)</span>
                    </label>

                    <button
                        type="submit"
                        disabled={updateCandidate.isPending}
                        className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-sm"
                    >
                        {updateCandidate.isPending ? "Saving Note..." : "Save Note"}
                    </button>
                </form>
            </ModalShell>

            {/* Quick Action: Log Communication Modal */}
            <ModalShell open={commModalOpen} onClose={() => setCommModalOpen(false)} title="Log Candidate Communication">
                <form onSubmit={handleAddComm} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Channel</label>
                            <select 
                                value={commForm.type} 
                                onChange={(e: any) => setCommForm({ ...commForm, type: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                            >
                                <option value="PHONE">Phone Call</option>
                                <option value="WHATSAPP">WhatsApp</option>
                                <option value="EMAIL">Email</option>
                                <option value="MEETING">Meeting</option>
                                <option value="LINKEDIN">LinkedIn</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Direction</label>
                            <select 
                                value={commForm.direction} 
                                onChange={(e: any) => setCommForm({ ...commForm, direction: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                            >
                                <option value="OUTGOING">Outgoing (Recruiter → Candidate)</option>
                                <option value="INCOMING">Incoming (Candidate → Recruiter)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Subject *</label>
                        <input 
                            required
                            value={commForm.subject} 
                            onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })} 
                            placeholder="e.g. Compensation alignment discussion" 
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Details & Minutes *</label>
                        <textarea 
                            required
                            rows={3}
                            value={commForm.message} 
                            onChange={(e) => setCommForm({ ...commForm, message: e.target.value })} 
                            placeholder="Key discussion points, next steps agreed upon..." 
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs leading-relaxed focus:border-primary outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Call Outcome</label>
                            <select 
                                value={commForm.outcome} 
                                onChange={(e: any) => setCommForm({ ...commForm, outcome: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold focus:border-primary outline-none"
                            >
                                <option value="Connected">Connected & Spoke</option>
                                <option value="No Answer">No Answer / Busy</option>
                                <option value="Interested">Interested in Job</option>
                                <option value="Not Interested">Not Interested</option>
                                <option value="Call Back">Requested Call Back</option>
                                <option value="Interview Confirmed">Interview Confirmed</option>
                                <option value="Salary Discussion">Salary Discussion</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Follow-up Date</label>
                            <input 
                                type="date"
                                value={commForm.nextFollowUpDate} 
                                onChange={(e) => setCommForm({ ...commForm, nextFollowUpDate: e.target.value })} 
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:border-primary outline-none"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={updateCandidate.isPending}
                        className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-sm"
                    >
                        {updateCandidate.isPending ? "Logging Interaction..." : "Log Interaction"}
                    </button>
                </form>
            </ModalShell>

            {/* Edit Candidate Profile Modal */}
            <ModalShell open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit 360° Candidate Record" wide>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name *</span>
                            <input required value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email Address *</span>
                            <input required type="email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Primary Phone *</span>
                            <input required value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">WhatsApp Number</span>
                            <input value={editForm.whatsappNumber || ""} onChange={(e) => setEditForm({ ...editForm, whatsappNumber: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Location</span>
                            <input value={editForm.location || ""} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Status</span>
                            <select value={editForm.status || "ACTIVE"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none font-semibold">
                                <option value="NEW">NEW</option>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="CONTACTED">CONTACTED</option>
                                <option value="QUALIFIED">QUALIFIED</option>
                                <option value="AVAILABLE">AVAILABLE</option>
                                <option value="ON_HOLD">ON HOLD</option>
                                <option value="PLACED">PLACED</option>
                                <option value="JOINED">JOINED</option>
                                <option value="REJECTED">REJECTED</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Employer</span>
                            <input value={editForm.currentCompany || ""} onChange={(e) => setEditForm({ ...editForm, currentCompany: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Designation</span>
                            <input value={editForm.currentDesignation || ""} onChange={(e) => setEditForm({ ...editForm, currentDesignation: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Experience (Years)</span>
                            <input type="number" value={editForm.totalExperienceYears || ""} onChange={(e) => setEditForm({ ...editForm, totalExperienceYears: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Notice Period (Days)</span>
                            <input type="number" value={editForm.noticePeriodDays || ""} onChange={(e) => setEditForm({ ...editForm, noticePeriodDays: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current CTC (LPA)</span>
                            <input type="number" step="0.5" value={editForm.currentCtcLpa || ""} onChange={(e) => setEditForm({ ...editForm, currentCtcLpa: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Expected CTC (LPA)</span>
                            <input type="number" step="0.5" value={editForm.expectedCtcLpa || ""} onChange={(e) => setEditForm({ ...editForm, expectedCtcLpa: e.target.value })} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Professional Headline</span>
                        <input value={editForm.headline || ""} onChange={(e) => setEditForm({ ...editForm, headline: e.target.value })} placeholder="e.g. Senior Backend Architect | Node.js, Distributed Systems" className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                    </label>

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Candidate Summary / Bio</span>
                        <textarea rows={3} value={editForm.bio || ""} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} placeholder="Brief background, achievements, and domain expertise..." className="mt-1 w-full px-4 py-2 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                    </label>

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Candidate Tags & Badges (comma separated)</span>
                        <input value={editForm.tags || ""} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="Immediate Joiner, Top Tech, Verified" className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                    </label>

                    <label className="block">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">All Skills (comma separated)</span>
                        <input value={editForm.skills || ""} onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })} placeholder="React, Node.js, PostgreSQL, Docker, AWS" className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">LinkedIn URL</span>
                            <input value={editForm.linkedinUrl || ""} onChange={(e) => setEditForm({ ...editForm, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">GitHub / Portfolio URL</span>
                            <input value={editForm.githubUrl || ""} onChange={(e) => setEditForm({ ...editForm, githubUrl: e.target.value })} placeholder="https://github.com/..." className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={updateCandidate.isPending}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                    >
                        {updateCandidate.isPending ? "Saving..." : "Save Candidate Profile"}
                    </button>
                </form>
            </ModalShell>
        </div>
    );
}
