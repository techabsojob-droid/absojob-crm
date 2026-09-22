"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard, Badge, SectionCard, EmptyState } from "@/components/shared/ui";
import { SkeletonPulse } from "@/components/shared/UIStates";
import { GraduationCap, Calendar, Users, Award, BookOpen, Search, CheckCircle2, Filter, AlertCircle } from "lucide-react";

interface TrainingProgram {
    id: string;
    title: string;
    course: string;
    trainer: string;
    startDate: string;
    endDate: string;
    enrolledEmployeeIds: string[];
    status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED";
    description: string;
}

export default function HRTrainingPage() {
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");

    const { data: programs = [], isLoading } = useQuery<TrainingProgram[]>({
        queryKey: ["hr-training", statusFilter, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            if (search) params.set("q", search);
            const res = await fetch(`/api/hr/training?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch training programs");
            return res.json();
        },
    });

    const upcomingCount = programs.filter((p) => p.status === "UPCOMING" || p.status === "IN_PROGRESS").length;
    const completedCount = programs.filter((p) => p.status === "COMPLETED").length;
    const totalEnrolled = programs.reduce((acc, p) => acc + (p.enrolledEmployeeIds?.length || 0), 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Learning & Development (L&D)"
                subtitle="Organize employee training workshops, skill development bootcamps, and compliance certifications."
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Training Programs" value={programs.length} icon={GraduationCap} tone="primary" hint="Curriculum catalog" />
                <StatCard label="Active / Upcoming" value={upcomingCount} icon={Calendar} tone="amber" hint="Scheduled workshops" />
                <StatCard label="Completed Sessions" value={completedCount} icon={CheckCircle2} tone="emerald" hint="Certifications awarded" />
                <StatCard label="Total Enrollees" value={totalEnrolled} icon={Users} tone="purple" hint="Participant count" />
            </div>

            {/* Filters */}
            <SectionCard>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2 rounded-xl text-sm border border-neutral-200">
                            <Filter size={16} className="text-neutral-500" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent font-medium text-neutral-800 focus:outline-none"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="UPCOMING">Upcoming</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search title, course, trainer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Training Program Cards Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-4">
                            <SkeletonPulse className="h-6 w-3/4" />
                            <SkeletonPulse className="h-4 w-1/2" />
                            <SkeletonPulse className="h-16 w-full" />
                        </div>
                    ))}
                </div>
            ) : programs.length === 0 ? (
                <SectionCard>
                    <EmptyState icon={AlertCircle} message="No training programs found matching your search." />
                </SectionCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {programs.map((prog) => (
                        <div key={prog.id} className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-6 flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1">
                                        <BookOpen size={12} /> {prog.course}
                                    </span>
                                    <Badge value={prog.status} />
                                </div>

                                <div>
                                    <h3 className="font-bold text-neutral-900 text-lg leading-snug">{prog.title}</h3>
                                    <p className="text-xs text-neutral-500 font-medium mt-1">Trainer: <span className="text-neutral-800 font-semibold">{prog.trainer}</span></p>
                                </div>

                                <p className="text-xs text-neutral-600 line-clamp-3 font-normal leading-relaxed">{prog.description}</p>
                            </div>

                            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 text-neutral-500 font-medium">
                                    <Calendar size={14} className="text-primary" />
                                    <span>{prog.startDate} to {prog.endDate}</span>
                                </div>

                                <div className="flex items-center gap-1 bg-neutral-100 px-2.5 py-1 rounded-full font-bold text-neutral-700">
                                    <Users size={12} />
                                    <span>{prog.enrolledEmployeeIds?.length || 0} Enrolled</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
