"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard, Users, UserPlus, CalendarCheck, CalendarOff,
    Wallet, TrendingUp, Building2, FileText, Laptop,
    GraduationCap, UserMinus, BarChart3, Settings, ShieldCheck,
    CheckSquare, Bell, CalendarClock, Briefcase, Award,
    Clock, DollarSign, ShieldAlert, CreditCard, ChevronDown,
    ChevronRight, ChevronLeft, Search, Star, Pin, LogOut,
    HelpCircle, Layers, Network, Inbox, ArrowRightLeft,
    CheckCircle2, FileSpreadsheet, FileEdit, PieChart,
    ScrollText, Receipt, Percent, Target, Flag, RefreshCw,
    MessageSquare, HeartHandshake, ExternalLink, Zap, BookOpen,
    SlidersHorizontal, KeyRound, UserCheck, X, LucideIcon
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface HrmisSubItem {
    id: string;
    label: string;
    href: string;
    icon?: LucideIcon;
    badgeKey?: "approvals" | "notifications" | "onboarding" | "tasks" | "leave";
    badgeTone?: "red" | "amber" | "emerald" | "blue" | "neutral";
    roles?: UserRole[];
}

export interface HrmisNavItem {
    id: string;
    label: string;
    icon: LucideIcon;
    href: string;
    badgeKey?: "approvals" | "notifications" | "onboarding" | "tasks" | "leave";
    badgeTone?: "red" | "amber" | "emerald" | "blue" | "neutral";
    roles?: UserRole[];
    children?: HrmisSubItem[];
}

export interface HrmisNavSection {
    sectionTitle: string;
    roles?: UserRole[];
    items: HrmisNavItem[];
}

// ─── Master HRMIS Navigation Structure ────────────────────────────────────────

const HRMIS_SECTIONS: HrmisNavSection[] = [
    {
        sectionTitle: "MAIN",
        roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER", "AGENT", "EMPLOYEE"],
        items: [
            {
                id: "main-dashboard",
                label: "Command Center",
                icon: LayoutDashboard,
                href: "/hr/dashboard",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER"],
            },
            {
                id: "main-tasks",
                label: "My Tasks",
                icon: CheckSquare,
                href: "/hr/tasks",
                badgeKey: "tasks",
                badgeTone: "blue",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER", "EMPLOYEE", "AGENT"],
            },
            {
                id: "main-notifications",
                label: "Notifications",
                icon: Bell,
                href: "/hr/notifications",
                badgeKey: "notifications",
                badgeTone: "red",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER", "EMPLOYEE", "AGENT"],
            },
        ],
    },
    {
        sectionTitle: "PEOPLE",
        roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
        items: [
            {
                id: "people-employees",
                label: "Employees",
                icon: Users,
                href: "/hr/employees",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "people-org",
                label: "Organization",
                icon: Building2,
                href: "/hr/organization",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "people-org-chart",
                label: "Org Chart",
                icon: Network,
                href: "/hr/organization?tab=org-chart",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "people-departments",
                label: "Departments & Teams",
                icon: Layers,
                href: "/hr/organization?tab=departments",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "people-requests",
                label: "Employee Requests",
                icon: Inbox,
                href: "/hr/requests",
                badgeKey: "leave",
                badgeTone: "amber",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
        ],
    },
    {
        sectionTitle: "TALENT & RECRUITMENT",
        roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER"],
        items: [
            {
                id: "talent-recruitment",
                label: "Recruitment",
                icon: Briefcase,
                href: "/ta/dashboard",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER"],
            },
            {
                id: "talent-candidates",
                label: "Candidates",
                icon: UserCheck,
                href: "/ta/candidates",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER"],
            },
            {
                id: "talent-jobs",
                label: "Jobs / Requisitions",
                icon: FileSpreadsheet,
                href: "/ta/requisitions",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER"],
            },
            {
                id: "talent-interviews",
                label: "Interviews",
                icon: CalendarClock,
                href: "/ta/interviews",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER"],
            },
            {
                id: "talent-offers",
                label: "Offers",
                icon: Award,
                href: "/admin/placements",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "talent-to-onboarding",
                label: "Recruitment → Onboarding",
                icon: ArrowRightLeft,
                href: "/hr/onboarding",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER"],
            },
        ],
    },
    {
        sectionTitle: "EMPLOYEE LIFECYCLE",
        roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER"],
        items: [
            {
                id: "lifecycle-onboarding",
                label: "Onboarding",
                icon: UserPlus,
                href: "/hr/onboarding",
                badgeKey: "onboarding",
                badgeTone: "emerald",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER"],
            },
            {
                id: "lifecycle-probation-item",
                label: "Probation",
                icon: Clock,
                href: "/hr/lifecycle",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "lifecycle-confirmations",
                label: "Confirmations",
                icon: CheckCircle2,
                href: "/hr/lifecycle?tab=confirmations",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "lifecycle-promotions",
                label: "Promotions",
                icon: TrendingUp,
                href: "/hr/lifecycle?tab=promotions",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "lifecycle-transfers",
                label: "Transfers",
                icon: ArrowRightLeft,
                href: "/hr/lifecycle?tab=transfers",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "lifecycle-salary",
                label: "Salary Revisions",
                icon: DollarSign,
                href: "/hr/lifecycle?tab=revisions",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "lifecycle-exit",
                label: "Exit Management",
                icon: UserMinus,
                href: "/hr/exit",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
        ],
    },
    {
        sectionTitle: "TIME & ATTENDANCE",
        roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
        items: [
            {
                id: "time-attendance",
                label: "Attendance",
                icon: CalendarCheck,
                href: "/hr/attendance",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "time-calendar",
                label: "Attendance Calendar",
                icon: CalendarClock,
                href: "/hr/attendance?tab=calendar",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "time-late",
                label: "Late & Exceptions",
                icon: ShieldAlert,
                href: "/hr/attendance?tab=exceptions",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "time-wfh",
                label: "WFH / Remote",
                icon: Laptop,
                href: "/hr/attendance?tab=wfh",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "time-corrections",
                label: "Attendance Corrections",
                icon: FileEdit,
                href: "/hr/attendance?tab=corrections",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "time-shifts",
                label: "Shifts & Schedules",
                icon: Clock,
                href: "/hr/attendance?tab=shifts",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
        ],
    },
    {
        sectionTitle: "LEAVE",
        roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
        items: [
            {
                id: "leave-dashboard",
                label: "Leave Dashboard",
                icon: CalendarOff,
                href: "/hr/leave",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "leave-requests",
                label: "Leave Requests",
                icon: FileText,
                href: "/hr/leave?tab=applications",
                badgeKey: "leave",
                badgeTone: "amber",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "leave-calendar",
                label: "Leave Calendar",
                icon: CalendarClock,
                href: "/hr/leave?tab=calendar",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "leave-holidays",
                label: "Holiday Calendar",
                icon: CalendarClock,
                href: "/hr/holidays",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "leave-balances",
                label: "Leave Balances",
                icon: PieChart,
                href: "/hr/leave?tab=balances",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "leave-policies",
                label: "Leave Policies",
                icon: ScrollText,
                href: "/hr/leave?tab=policies",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
        ],
    },
    {
        sectionTitle: "PAYROLL & COMPENSATION",
        roles: ["SUPER_ADMIN", "HR_ADMIN"],
        items: [
            {
                id: "payroll-root",
                label: "Payroll",
                icon: Wallet,
                href: "/hr/payroll",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "payroll-processing",
                label: "Payroll Processing",
                icon: CreditCard,
                href: "/hr/payroll?tab=processing",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "payroll-structure",
                label: "Salary Structure",
                icon: Layers,
                href: "/hr/payroll?tab=structure",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "payroll-payslips",
                label: "Payslips",
                icon: Receipt,
                href: "/hr/payroll?tab=payslips",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "payroll-deductions",
                label: "Deductions & Benefits",
                icon: Percent,
                href: "/hr/payroll?tab=deductions",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "payroll-tax-declarations",
                label: "Tax Declarations",
                icon: ScrollText,
                href: "/hr/tax-declarations",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "payroll-reports",
                label: "Payroll Reports",
                href: "/hr/reports?tab=payroll",
                icon: FileSpreadsheet,
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
        ],
    },
    {
        sectionTitle: "PERFORMANCE",
        roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
        items: [
            {
                id: "perf-dashboard",
                label: "Performance Dashboard",
                icon: Target,
                href: "/hr/performance",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "perf-goals",
                label: "Goals / OKRs",
                icon: Flag,
                href: "/hr/performance?tab=goals",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "perf-cycles",
                label: "Review Cycles",
                icon: RefreshCw,
                href: "/hr/performance?tab=cycles",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "perf-appraisals",
                label: "Appraisals",
                icon: Award,
                href: "/hr/performance?tab=appraisals",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "perf-feedback",
                label: "Feedback",
                icon: MessageSquare,
                href: "/hr/performance?tab=feedback",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
        ],
    },
    {
        sectionTitle: "EMPLOYEE SERVICES",
        roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
        items: [
            {
                id: "services-docs",
                label: "Documents",
                icon: FileText,
                href: "/hr/documents",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "services-assets",
                label: "Assets",
                icon: Laptop,
                href: "/hr/assets",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "services-training",
                label: "Training & Learning",
                icon: GraduationCap,
                href: "/hr/training",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "services-benefits",
                label: "Benefits",
                icon: HeartHandshake,
                href: "/hr/benefits",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "services-ess",
                label: "Employee Self Service",
                icon: ExternalLink,
                href: "/portal/dashboard",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER", "TA_RECRUITER", "EMPLOYEE", "AGENT"],
            },
        ],
    },
    {
        sectionTitle: "INSIGHTS",
        roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
        items: [
            {
                id: "ins-overview",
                label: "HR Analytics",
                icon: BarChart3,
                href: "/hr/reports",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "ins-workforce",
                label: "Workforce Analytics",
                icon: Users,
                href: "/hr/reports?tab=workforce",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "ins-attendance",
                label: "Attendance Analytics",
                icon: CalendarCheck,
                href: "/hr/reports?tab=attendance",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "ins-recruitment",
                label: "Recruitment Analytics",
                icon: TrendingUp,
                href: "/hr/reports?tab=recruitment",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "ins-payroll",
                label: "Payroll Analytics",
                icon: DollarSign,
                href: "/hr/reports?tab=payroll",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "ins-attrition",
                label: "Attrition Analytics",
                icon: UserMinus,
                href: "/hr/reports?tab=attrition",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
            {
                id: "ins-reports",
                label: "Reports",
                icon: FileSpreadsheet,
                href: "/hr/reports?tab=all",
                roles: ["SUPER_ADMIN", "HR_ADMIN", "TA_MANAGER"],
            },
        ],
    },
    {
        sectionTitle: "ADMINISTRATION",
        roles: ["SUPER_ADMIN", "HR_ADMIN"],
        items: [
            {
                id: "admin-approvals",
                label: "Approvals",
                icon: ShieldCheck,
                href: "/hr/approvals",
                badgeKey: "approvals",
                badgeTone: "amber",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "admin-workflow",
                label: "Workflow Automation",
                icon: Zap,
                href: "/hr/settings?tab=automation",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "admin-policies",
                label: "HR Policies",
                icon: BookOpen,
                href: "/hr/settings?tab=policies",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "admin-custom-fields",
                label: "Custom Fields",
                icon: SlidersHorizontal,
                href: "/hr/settings?tab=custom-fields",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "admin-roles",
                label: "Roles & Permissions",
                icon: KeyRound,
                href: "/hr/settings?tab=roles",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "admin-audit",
                label: "Audit Logs",
                icon: ScrollText,
                href: "/hr/audit-logs",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
            {
                id: "admin-settings",
                label: "HR Settings",
                icon: Settings,
                href: "/hr/settings",
                roles: ["SUPER_ADMIN", "HR_ADMIN"],
            },
        ],
    },
];

// ─── Component Props ─────────────────────────────────────────────────────────

interface HrmisSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

const COLLAPSED_W = 80;
const EXPANDED_W = 264;
const TRANSITION = "all 250ms cubic-bezier(0.4, 0, 0.2, 1)";

export default function HrmisSidebar({
    collapsed,
    onToggle,
    mobileOpen = false,
    onMobileClose,
}: HrmisSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();

    // ─── State for Badges (Real Backend Data) ─────────────────────────────────
    const [badgeCounts, setBadgeCounts] = useState<{
        approvals?: number;
        notifications?: number;
        onboarding?: number;
        tasks?: number;
        leave?: number;
    }>({});

    // ─── Pinned Items State (LocalStorage) ───────────────────────────────────
    const [pinnedIds, setPinnedIds] = useState<string[]>([]);

    // ─── Expanded Nested Groups State ─────────────────────────────────────────
    const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});

    // ─── Workspace Switcher State ─────────────────────────────────────────────
    const [workspaceOpen, setWorkspaceOpen] = useState(false);
    const workspaceRef = useRef<HTMLDivElement>(null);

    // ─── Search Palette Modal State (⌘K) ──────────────────────────────────────
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchSelectedIdx, setSearchSelectedIdx] = useState(0);

    // ─── Fetch Badges Data ───────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;

        async function fetchBadges() {
            try {
                const results: typeof badgeCounts = {};

                // Approvals count
                try {
                    const res = await fetch("/api/admin/approvals?status=PENDING");
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data)) results.approvals = data.length;
                    }
                } catch { }

                // Notifications count
                try {
                    const res = await fetch("/api/notifications");
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data)) {
                            results.notifications = data.filter((n: any) => !n.is_read).length;
                        }
                    }
                } catch { }

                // Onboarding count
                try {
                    const res = await fetch("/api/hr/onboarding?status=IN_PROGRESS");
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data)) results.onboarding = data.length;
                    }
                } catch { }

                // Tasks count
                try {
                    const res = await fetch("/api/admin/tasks?completed=false");
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data)) results.tasks = data.length;
                    }
                } catch { }

                // Leave count
                try {
                    const res = await fetch("/api/hr/leave?status=PENDING");
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data)) results.leave = data.length;
                    }
                } catch { }

                if (mounted) {
                    setBadgeCounts(results);
                }
            } catch (err) {
                console.error("Error fetching HRMIS badges:", err);
            }
        }

        fetchBadges();
        const interval = setInterval(fetchBadges, 30000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    // ─── Load Pinned Items from localStorage ──────────────────────────────────
    useEffect(() => {
        try {
            const saved = localStorage.getItem("hrmis_pinned_items");
            if (saved) {
                setPinnedIds(JSON.parse(saved));
            }
        } catch { }
    }, []);

    const togglePin = useCallback((id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setPinnedIds((prev) => {
            const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
            try {
                localStorage.setItem("hrmis_pinned_items", JSON.stringify(next));
            } catch { }
            return next;
        });
    }, []);

    // ─── Contextual Auto-Expansion of Active Group ───────────────────────────
    useEffect(() => {
        if (!pathname) return;
        HRMIS_SECTIONS.forEach((section) => {
            section.items.forEach((item) => {
                if (item.children) {
                    const isParentMatch = pathname === item.href || (pathname.startsWith(item.href + "/") && !item.href.endsWith("/dashboard"));
                    const isChildMatch = item.children.some((c) => pathname === c.href);
                    if (isParentMatch || isChildMatch) {
                        setExpandedGroupIds((prev) => ({ ...prev, [item.id]: true }));
                    }
                }
            });
        });
    }, [pathname]);

    // ─── Global Keyboard Shortcut (⌘K / Ctrl+K) ──────────────────────────────
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setSearchOpen((prev) => !prev);
            } else if (e.key === "Escape") {
                setSearchOpen(false);
                setWorkspaceOpen(false);
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // ─── Click Outside Handler for Workspace Dropdown ─────────────────────────
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
                setWorkspaceOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ─── Role-Based Filter ───────────────────────────────────────────────────
    const userRole: UserRole = user?.role || "HR_ADMIN";

    const filteredSections = useMemo(() => {
        return HRMIS_SECTIONS.map((section) => {
            if (userRole !== "SUPER_ADMIN" && section.roles && !section.roles.includes(userRole)) {
                return null;
            }
            const visibleItems = section.items.filter((item) => {
                if (userRole === "SUPER_ADMIN") return true;
                if (item.roles && !item.roles.includes(userRole)) return false;
                return true;
            });
            if (visibleItems.length === 0) return null;
            return {
                ...section,
                items: visibleItems,
            };
        }).filter(Boolean) as HrmisNavSection[];
    }, [userRole]);

    // ─── Flat Map of All Searchable Items for ⌘K ─────────────────────────────
    const allSearchableItems = useMemo(() => {
        const list: {
            id: string;
            label: string;
            href: string;
            icon: LucideIcon;
            section: string;
            badge?: number;
        }[] = [];

        filteredSections.forEach((sec) => {
            sec.items.forEach((item) => {
                list.push({
                    id: item.id,
                    label: item.label,
                    href: item.href,
                    icon: item.icon,
                    section: sec.sectionTitle,
                    badge: item.badgeKey ? badgeCounts[item.badgeKey] : undefined,
                });
                if (item.children) {
                    item.children.forEach((child) => {
                        list.push({
                            id: child.id,
                            label: `${item.label} → ${child.label}`,
                            href: child.href,
                            icon: child.icon || item.icon,
                            section: sec.sectionTitle,
                            badge: child.badgeKey ? badgeCounts[child.badgeKey] : undefined,
                        });
                    });
                }
            });
        });
        return list;
    }, [filteredSections, badgeCounts]);

    // Filtered search list
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return allSearchableItems.slice(0, 15);
        const q = searchQuery.toLowerCase();
        return allSearchableItems
            .filter((item) => item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q))
            .slice(0, 20);
    }, [allSearchableItems, searchQuery]);

    // Handle search item select
    const handleSelectSearchItem = (item: (typeof searchResults)[0]) => {
        setSearchOpen(false);
        setSearchQuery("");
        router.push(item.href);
        if (onMobileClose) onMobileClose();
    };

    // ─── Pinned Items List ────────────────────────────────────────────────────
    const pinnedItems = useMemo(() => {
        if (pinnedIds.length === 0) return [];
        const map = new Map<string, (typeof allSearchableItems)[0]>();
        allSearchableItems.forEach((i) => map.set(i.id, i));
        return pinnedIds.map((id) => map.get(id)).filter(Boolean) as (typeof allSearchableItems);
    }, [pinnedIds, allSearchableItems]);

    // ─── Active Route Helper ─────────────────────────────────────────────────
    const isItemActive = (href: string) => {
        if (pathname === href) return true;
        if (pathname.startsWith(href + "/") && !href.endsWith("/dashboard")) return true;
        return false;
    };

    const isGroupActive = (item: HrmisNavItem) => {
        if (isItemActive(item.href)) return true;
        if (item.children) {
            return item.children.some((child) => isItemActive(child.href));
        }
        return false;
    };

    const sidebarWidth = collapsed ? COLLAPSED_W : EXPANDED_W;

    return (
        <>
            {/* ─── Mobile Backdrop Overlay ────────────────────────────────────── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-neutral-900/60 backdrop-blur-sm lg:hidden transition-opacity"
                    onClick={onMobileClose}
                    aria-hidden="true"
                />
            )}

            {/* ─── Sidebar Aside Container ───────────────────────────────────── */}
            <aside
                className={`fixed top-0 left-0 h-screen z-50 flex flex-col bg-white border-r border-neutral-200 select-none transition-transform duration-250 ease-out lg:translate-x-0 ${
                    mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
                }`}
                style={{
                    width: mobileOpen ? EXPANDED_W : sidebarWidth,
                    transition: TRANSITION,
                }}
                aria-label="HRMIS Sidebar Navigation"
            >
                {/* ─── Header: Brand + Workspace Switcher ──────────────────────── */}
                <div
                    ref={workspaceRef}
                    className="relative shrink-0 border-b border-neutral-100 bg-white"
                >
                    <div
                        onClick={() => !collapsed && setWorkspaceOpen((prev) => !prev)}
                        className={`flex items-center gap-3 py-4 cursor-pointer hover:bg-neutral-50/80 transition-colors ${
                            collapsed ? "justify-center px-2" : "px-5"
                        }`}
                        title={collapsed ? "AbsoJob HRMIS" : "Switch workspace"}
                    >
                        {/* Logo Mark */}
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white text-sm font-black tracking-tight shadow-md shadow-primary/25 shrink-0">
                            AJ
                        </div>

                        {/* Title & Badge */}
                        {!collapsed && (
                            <div className="flex-1 min-w-0 flex items-center justify-between">
                                <div className="truncate">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-bold text-neutral-900 tracking-tight">
                                            AbsoJob
                                        </span>
                                        <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase bg-primary/10 text-primary rounded">
                                            HRMIS
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-400 font-medium truncate">
                                        Enterprise HR Suite
                                    </p>
                                </div>
                                <ChevronDown
                                    size={15}
                                    className={`text-neutral-400 transition-transform shrink-0 ${
                                        workspaceOpen ? "rotate-180 text-primary" : ""
                                    }`}
                                />
                            </div>
                        )}
                    </div>

                    {/* Workspace Switcher Dropdown */}
                    {workspaceOpen && !collapsed && (
                        <div className="absolute top-full left-3 right-3 mt-1.5 bg-white rounded-2xl shadow-2xl border border-neutral-100 py-2 z-[70] animate-fade-in origin-top">
                            <p className="px-3.5 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                Switch Workspace
                            </p>
                            <div className="space-y-0.5 px-1.5">
                                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs">
                                    <span className="flex items-center gap-2">
                                        <Building2 size={15} /> HRMIS (Current)
                                    </span>
                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                </div>
                                <Link
                                    href="/admin/dashboard"
                                    onClick={() => setWorkspaceOpen(false)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-neutral-50 text-neutral-700 font-medium text-xs transition-colors"
                                >
                                    <Briefcase size={15} className="text-neutral-400" />
                                    Recruitment CRM
                                </Link>
                                <Link
                                    href="/ta/dashboard"
                                    onClick={() => setWorkspaceOpen(false)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-neutral-50 text-neutral-700 font-medium text-xs transition-colors"
                                >
                                    <Target size={15} className="text-neutral-400" />
                                    Talent Acquisition
                                </Link>
                                <Link
                                    href="/portal/dashboard"
                                    onClick={() => setWorkspaceOpen(false)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-neutral-50 text-neutral-700 font-medium text-xs transition-colors"
                                >
                                    <ExternalLink size={15} className="text-neutral-400" />
                                    Employee Self-Service
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Quick Search Bar (⌘K Trigger) ──────────────────────────── */}
                {!collapsed && (
                    <div className="px-4 pt-3 pb-1 shrink-0">
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200/80 rounded-xl text-neutral-400 hover:text-neutral-700 text-xs font-medium transition-all group shadow-2xs"
                        >
                            <span className="flex items-center gap-2">
                                <Search size={14} className="text-neutral-400 group-hover:text-primary transition-colors" />
                                <span>Quick search...</span>
                            </span>
                            <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-white text-neutral-400 group-hover:text-neutral-600 rounded border border-neutral-200 shadow-2xs">
                                ⌘K
                            </kbd>
                        </button>
                    </div>
                )}

                {/* ─── Scrollable Nav Area ────────────────────────────────────── */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-5 no-scrollbar">
                    {/* ── PINNED SECTION (If any pinned items) ── */}
                    {pinnedItems.length > 0 && (
                        <div className="space-y-1">
                            {!collapsed ? (
                                <div className="flex items-center justify-between px-3 pb-1">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                                        <Pin size={11} className="rotate-45" /> PINNED
                                    </p>
                                </div>
                            ) : (
                                <div className="h-px bg-amber-200 my-2 mx-2" />
                            )}
                            {pinnedItems.map((item) => {
                                const Icon = item.icon;
                                const active = isItemActive(item.href);
                                return (
                                    <Link
                                        key={`pinned-${item.id}`}
                                        href={item.href}
                                        onClick={onMobileClose}
                                        className={`group relative flex items-center gap-3 rounded-xl transition-all ${
                                            active
                                                ? "bg-primary text-white shadow-md shadow-primary/25"
                                                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                                        }`}
                                        style={{
                                            padding: collapsed ? "10px" : "8px 12px",
                                            justifyContent: collapsed ? "center" : "flex-start",
                                        }}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        <Icon size={18} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                                        {!collapsed && (
                                            <span className="text-xs font-semibold whitespace-nowrap overflow-hidden flex-1 truncate">
                                                {item.label}
                                            </span>
                                        )}
                                        {!collapsed && (
                                            <button
                                                onClick={(e) => togglePin(item.id, e)}
                                                className="text-amber-500 opacity-60 hover:opacity-100 hover:scale-110 transition-all p-0.5"
                                                title="Unpin"
                                            >
                                                <Star size={13} fill="currentColor" />
                                            </button>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* ── MASTER NAVIGATION SECTIONS ── */}
                    {filteredSections.map((section, sIdx) => (
                        <div key={sIdx} className="space-y-1">
                            {/* Section Header */}
                            {!collapsed ? (
                                <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                                    {section.sectionTitle}
                                </p>
                            ) : (
                                <div className="h-px bg-neutral-100 my-2 mx-2" />
                            )}

                            {/* Section Items */}
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const isGroupOpen = !!expandedGroupIds[item.id];
                                const hasChildren = item.children && item.children.length > 0;
                                const active = isGroupActive(item);
                                const isPinned = pinnedIds.includes(item.id);
                                const badgeVal = item.badgeKey ? badgeCounts[item.badgeKey] : undefined;

                                return (
                                    <div key={item.id} className="space-y-1">
                                        {/* Main Item Row */}
                                        <div className="relative group">
                                            <Link
                                                href={item.href}
                                                onClick={(e) => {
                                                    if (hasChildren && !collapsed) {
                                                        // Toggle children expansion
                                                        setExpandedGroupIds((prev) => ({
                                                            ...prev,
                                                            [item.id]: !prev[item.id],
                                                        }));
                                                    }
                                                    if (!hasChildren && onMobileClose) {
                                                        onMobileClose();
                                                    }
                                                }}
                                                className={`flex items-center gap-3 rounded-xl transition-all ${
                                                    active
                                                        ? "bg-primary text-white shadow-md shadow-primary/25 font-bold"
                                                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 font-semibold"
                                                }`}
                                                style={{
                                                    padding: collapsed ? "10px" : "8px 12px",
                                                    justifyContent: collapsed ? "center" : "flex-start",
                                                    transition: TRANSITION,
                                                }}
                                                title={collapsed ? item.label : undefined}
                                            >
                                                <Icon
                                                    size={19}
                                                    strokeWidth={active ? 2.5 : 2}
                                                    className="shrink-0"
                                                />
                                                {!collapsed && (
                                                    <span className="text-xs whitespace-nowrap overflow-hidden flex-1 truncate">
                                                        {item.label}
                                                    </span>
                                                )}

                                                {/* Pin Icon (hover only on desktop expanded) */}
                                                {!collapsed && (
                                                    <button
                                                        onClick={(e) => togglePin(item.id, e)}
                                                        className={`p-0.5 rounded transition-all ${
                                                            isPinned
                                                                ? "text-amber-400 opacity-100"
                                                                : "text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-amber-500 hover:scale-110"
                                                        }`}
                                                        title={isPinned ? "Unpin item" : "Pin item"}
                                                    >
                                                        <Star size={13} fill={isPinned ? "currentColor" : "none"} />
                                                    </button>
                                                )}

                                                {/* Badge Count */}
                                                {!collapsed && badgeVal !== undefined && badgeVal > 0 && (
                                                    <span
                                                        className={`px-1.5 py-0.5 text-[10px] font-black rounded-md leading-none ${
                                                            active
                                                                ? "bg-white/20 text-white"
                                                                : item.badgeTone === "red"
                                                                ? "bg-red-50 text-red-700 border border-red-200"
                                                                : item.badgeTone === "amber"
                                                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                                : item.badgeTone === "emerald"
                                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                : "bg-neutral-100 text-neutral-700"
                                                        }`}
                                                    >
                                                        {badgeVal}
                                                    </span>
                                                )}

                                                {/* Nested Expand Arrow */}
                                                {!collapsed && hasChildren && (
                                                    <ChevronRight
                                                        size={14}
                                                        className={`text-neutral-400 transition-transform ${
                                                            isGroupOpen ? "rotate-90 text-primary" : ""
                                                        }`}
                                                    />
                                                )}

                                                {/* Tooltip (collapsed state only) */}
                                                {collapsed && (
                                                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[70] flex items-center gap-2 shadow-xl">
                                                        <span>{item.label}</span>
                                                        {badgeVal !== undefined && badgeVal > 0 && (
                                                            <span className="bg-primary px-1.5 py-0.5 rounded text-[10px] font-bold text-white">
                                                                {badgeVal}
                                                            </span>
                                                        )}
                                                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-neutral-900 rotate-45" />
                                                    </div>
                                                )}
                                            </Link>
                                        </div>

                                        {/* Sub Items (Nested Navigation) */}
                                        {!collapsed && hasChildren && isGroupOpen && (
                                            <div className="pl-6 pr-1 py-1 space-y-0.5 border-l-2 border-neutral-100 ml-4 animate-fade-in">
                                                {item.children!.map((child) => {
                                                    const ChildIcon = child.icon;
                                                    const childActive = isItemActive(child.href);
                                                    const childBadge = child.badgeKey ? badgeCounts[child.badgeKey] : undefined;

                                                    return (
                                                        <Link
                                                            key={child.id}
                                                            href={child.href}
                                                            onClick={onMobileClose}
                                                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                                childActive
                                                                    ? "bg-primary/10 text-primary font-bold"
                                                                    : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                                                            }`}
                                                        >
                                                            {ChildIcon && (
                                                                <ChildIcon size={14} className="shrink-0 text-neutral-400" />
                                                            )}
                                                            <span className="truncate flex-1">{child.label}</span>
                                                            {childBadge !== undefined && childBadge > 0 && (
                                                                <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                                    {childBadge}
                                                                </span>
                                                            )}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* ─── Footer: User Profile & Actions ─────────────────────────── */}
                <div className="shrink-0 border-t border-neutral-200 bg-white p-3 space-y-2">
                    {/* User profile card */}
                    <div
                        className={`flex items-center gap-3 p-2 rounded-xl bg-neutral-50/80 border border-neutral-100 ${
                            collapsed ? "justify-center p-1.5" : ""
                        }`}
                        title={collapsed ? `${user?.name || "Ananya Sen"} (${user?.role || "HR_ADMIN"})` : undefined}
                    >
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {user?.name ? user.name.charAt(0) : "A"}
                        </div>
                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-neutral-900 truncate leading-tight">
                                    {user?.name || "Ananya Sen"}
                                </p>
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-black tracking-wider uppercase rounded bg-neutral-200/80 text-neutral-700">
                                    {user?.role || "HR_ADMIN"}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Quick Footer Links */}
                    {!collapsed && (
                        <div className="grid grid-cols-2 gap-1 pt-1">
                            <Link
                                href="/hr/settings"
                                onClick={onMobileClose}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                            >
                                <Settings size={13} /> Settings
                            </Link>
                            <Link
                                href="/admin/help"
                                onClick={onMobileClose}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                            >
                                <HelpCircle size={13} /> Help
                            </Link>
                        </div>
                    )}

                    {/* Logout Button */}
                    <button
                        onClick={logout}
                        className={`w-full flex items-center gap-2 rounded-xl text-neutral-500 hover:bg-red-50 hover:text-red-600 transition-colors ${
                            collapsed ? "justify-center p-2.5" : "px-3 py-2 text-xs font-semibold"
                        }`}
                        title={collapsed ? "Logout" : undefined}
                    >
                        <LogOut size={16} className="shrink-0" />
                        {!collapsed && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* ─── Edge Toggle Button (Desktop Only) ─────────────────────────── */}
            <button
                onClick={onToggle}
                className="hidden lg:flex fixed z-[60] items-center justify-center w-7 h-7 bg-white border border-neutral-200 rounded-full text-neutral-400 shadow-md hover:text-primary hover:border-primary hover:shadow-lg transition-all"
                style={{
                    top: "50%",
                    left: sidebarWidth - 14,
                    transform: "translateY(-50%)",
                    transition: TRANSITION,
                }}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {collapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
            </button>

            {/* ─── Global Navigation Search Modal (⌘K / Ctrl+K) ────────────── */}
            {searchOpen && (
                <div
                    className="fixed inset-0 z-[100] bg-neutral-900/50 backdrop-blur-xs flex items-start justify-center pt-24 px-4"
                    onClick={() => setSearchOpen(false)}
                >
                    <div
                        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Search Input Bar */}
                        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100">
                            <Search size={18} className="text-primary shrink-0" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search HRMIS navigation (e.g. Leave, Payroll, Org)..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setSearchSelectedIdx(0);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        setSearchSelectedIdx((prev) => (prev + 1) % Math.max(1, searchResults.length));
                                    } else if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        setSearchSelectedIdx((prev) => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
                                    } else if (e.key === "Enter" && searchResults[searchSelectedIdx]) {
                                        e.preventDefault();
                                        handleSelectSearchItem(searchResults[searchSelectedIdx]);
                                    }
                                }}
                                className="flex-1 bg-transparent text-sm font-semibold text-neutral-800 placeholder-neutral-400 focus:outline-none"
                            />
                            <button
                                onClick={() => setSearchOpen(false)}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Search Results List */}
                        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                            {searchResults.length === 0 ? (
                                <div className="py-8 text-center text-xs text-neutral-400">
                                    No navigation matches found for &quot;{searchQuery}&quot;
                                </div>
                            ) : (
                                searchResults.map((item, idx) => {
                                    const Icon = item.icon;
                                    const isSelected = idx === searchSelectedIdx;

                                    return (
                                        <button
                                            key={`${item.section}-${item.id}`}
                                            onClick={() => handleSelectSearchItem(item)}
                                            onMouseEnter={() => setSearchSelectedIdx(idx)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                                                isSelected
                                                    ? "bg-primary text-white"
                                                    : "text-neutral-700 hover:bg-neutral-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                        isSelected
                                                            ? "bg-white/20 text-white"
                                                            : "bg-neutral-100 text-neutral-500"
                                                    }`}
                                                >
                                                    <Icon size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-neutral-900"}`}>
                                                        {item.label}
                                                    </p>
                                                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? "text-white/80" : "text-neutral-400"}`}>
                                                        {item.section}
                                                    </span>
                                                </div>
                                            </div>

                                            {item.badge !== undefined && item.badge > 0 && (
                                                <span
                                                    className={`px-1.5 py-0.5 text-[10px] font-black rounded ${
                                                        isSelected
                                                            ? "bg-white/20 text-white"
                                                            : "bg-amber-100 text-amber-800"
                                                    }`}
                                                >
                                                    {item.badge}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Search Footer */}
                        <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400 font-medium">
                            <span>Use ↑ and ↓ to navigate</span>
                            <span>↵ to select • Esc to close</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
