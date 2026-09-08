"use client";

import { User, Bell, Shield, Database, Play, CheckCircle2, AlertCircle, RefreshCw, Terminal, Copy, Check, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import Image from "next/image";

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Administrator",
    TA_MANAGER: "TA Manager",
    TA_RECRUITER: "Recruiter",
    AGENT: "Channel Agent",
    EMPLOYEE: "Employee",
};

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const [emailNotif, setEmailNotif] = useState(true);
    const [pushNotif, setPushNotif] = useState(false);
    const [activeTab, setActiveTab] = useState("Database");

    // Form states
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    // Database states
    const [dbStatus, setDbStatus] = useState<any>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [connectionString, setConnectionString] = useState("");
    const [sqlQuery, setSqlQuery] = useState("SELECT * FROM jobs LIMIT 10;");
    const [runningQuery, setRunningQuery] = useState(false);
    const [queryResult, setQueryResult] = useState<any>(null);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || "");
            setEmail(user.email || "");
        }
    }, [user]);

    const fetchDbStatus = async () => {
        setLoadingStatus(true);
        try {
            const res = await fetch("/api/admin/database/status");
            const data = await res.json();
            setDbStatus(data);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoadingStatus(false);
        }
    };

    useEffect(() => {
        if (activeTab === "Database") {
            fetchDbStatus();
        }
    }, [activeTab]);

    const executeSql = async () => {
        if (!sqlQuery.trim()) return;
        setRunningQuery(true);
        setQueryError(null);
        setQueryResult(null);

        try {
            const res = await fetch("/api/admin/database/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sql: sqlQuery,
                    connectionString: connectionString.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setQueryError(data.error || "Execution failed");
            } else {
                setQueryResult(data);
            }
        } catch (err: any) {
            setQueryError(err.message || "Failed to execute query");
        } finally {
            setRunningQuery(false);
        }
    };

    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-neutral-500 font-medium">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Settings & Database Management</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Manage your account preferences, Supabase connection, and execute SQL queries directly.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Navigation Sidebar */}
                <div className="space-y-1 md:col-span-1">
                    {[
                        { label: "Database", icon: Database },
                        { label: "Profile", icon: User },
                        { label: "Notifications", icon: Bell },
                        { label: "Security", icon: Shield },
                    ].map((item) => (
                        <button
                            key={item.label}
                            onClick={() => setActiveTab(item.label)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                activeTab === item.label
                                    ? "bg-primary text-white shadow-lg shadow-primary/25 font-semibold"
                                    : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                        >
                            <item.icon size={18} /> {item.label}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="md:col-span-3 space-y-6">
                    {/* Database & SQL Runner Section */}
                    {activeTab === "Database" && (
                        <div className="space-y-6">
                            {/* Supabase Status Card */}
                            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                                            <Database size={22} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-neutral-900">Supabase Database</h2>
                                            <p className="text-xs text-neutral-500">
                                                {dbStatus?.supabaseUrl || "Connecting to Supabase..."}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={fetchDbStatus}
                                        disabled={loadingStatus}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                                    >
                                        <RefreshCw size={14} className={loadingStatus ? "animate-spin" : ""} />
                                        Refresh Status
                                    </button>
                                </div>

                                {dbStatus?.stats && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                                        {Object.entries(dbStatus.stats).slice(0, 8).map(([table, info]: [string, any]) => (
                                            <div
                                                key={table}
                                                className={`p-3 rounded-2xl border ${
                                                    info.exists
                                                        ? "bg-emerald-50/50 border-emerald-200"
                                                        : "bg-amber-50/50 border-amber-200"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-neutral-800 truncate capitalize">{table}</span>
                                                    {info.exists ? (
                                                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <AlertCircle size={14} className="text-amber-500 shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-lg font-extrabold text-neutral-900 mt-1">
                                                    {info.exists ? `${info.count} rows` : "Not migrated"}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Direct PostgreSQL Connection String */}
                            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-3">
                                <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
                                    Direct PostgreSQL Connection URI (Optional for DDL / Schema Migrations)
                                </label>
                                <input
                                    type="password"
                                    value={connectionString}
                                    onChange={(e) => setConnectionString(e.target.value)}
                                    placeholder="postgresql://postgres:[password]@db.zjhdqjwwrmanjgxqhnjh.supabase.co:5432/postgres"
                                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-mono focus:border-primary outline-none"
                                />
                                <p className="text-xs text-neutral-400">
                                    Agar direct SQL queries (SELECT, DDL, CREATE) chalani hain, toh aap Supabase PostgreSQL connection string use kar sakte hain.
                                </p>
                            </div>

                            {/* SQL Query Console */}
                            <div className="bg-neutral-900 rounded-3xl p-6 shadow-xl text-white space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Terminal size={18} className="text-emerald-400" />
                                        <span className="text-sm font-bold font-mono">SQL Query Runner</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSqlQuery("SELECT * FROM jobs LIMIT 10;")}
                                            className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-mono hover:bg-neutral-700"
                                        >
                                            SELECT jobs
                                        </button>
                                        <button
                                            onClick={() => setSqlQuery("SELECT * FROM companies LIMIT 10;")}
                                            className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-mono hover:bg-neutral-700"
                                        >
                                            SELECT companies
                                        </button>
                                    </div>
                                </div>

                                <textarea
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    rows={4}
                                    placeholder="Enter SQL query (e.g., SELECT * FROM jobs;)..."
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-sm font-mono text-emerald-400 focus:border-emerald-500 outline-none resize-y"
                                />

                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-xs text-neutral-400">
                                        Runs query directly against your Supabase backend
                                    </span>
                                    <button
                                        onClick={executeSql}
                                        disabled={runningQuery}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/40 transition-all disabled:opacity-50"
                                    >
                                        {runningQuery ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Play size={16} />
                                        )}
                                        Run Query
                                    </button>
                                </div>

                                {queryError && (
                                    <div className="p-4 bg-red-950/60 border border-red-800/80 rounded-2xl text-red-300 text-xs font-mono">
                                        <p className="font-bold mb-1 flex items-center gap-1.5">
                                            <AlertCircle size={14} /> Error:
                                        </p>
                                        {queryError}
                                    </div>
                                )}

                                {queryResult && (
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                                            <span>Duration: {queryResult.durationMs}ms</span>
                                            <span>
                                                Rows: {queryResult.result?.[0]?.rowCount ?? queryResult.result?.[0]?.rows?.length ?? 0}
                                            </span>
                                        </div>

                                        {queryResult.result?.[0]?.rows?.length > 0 ? (
                                            <div className="max-h-72 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950">
                                                <table className="w-full text-left text-xs font-mono">
                                                    <thead className="bg-neutral-900 text-neutral-300 sticky top-0">
                                                        <tr>
                                                            {queryResult.result[0].fields.map((f: string) => (
                                                                <th key={f} className="p-2.5 border-b border-neutral-800 font-bold">
                                                                    {f}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                                                        {queryResult.result[0].rows.map((row: any, i: number) => (
                                                            <tr key={i} className="hover:bg-neutral-900/50">
                                                                {queryResult.result[0].fields.map((f: string) => (
                                                                    <td key={f} className="p-2.5 truncate max-w-xs">
                                                                        {typeof row[f] === "object"
                                                                            ? JSON.stringify(row[f])
                                                                            : String(row[f] ?? "null")}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-neutral-950 rounded-xl text-center text-xs font-mono text-neutral-400">
                                                Query executed successfully (0 rows returned).
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Profile Section */}
                    {activeTab === "Profile" && (
                        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-neutral-900 mb-6">Profile Details</h2>

                            <div className="flex items-center gap-6 mb-8">
                                <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center text-2xl font-bold text-neutral-400 border-4 border-white shadow-lg overflow-hidden relative">
                                    {user?.avatar ? (
                                        <Image src={user.avatar} alt="Avatar" fill className="object-cover" />
                                    ) : (
                                        user?.name?.charAt(0) || "U"
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary font-medium"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        readOnly
                                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500 text-sm font-medium cursor-not-allowed"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Role</label>
                                    <input
                                        type="text"
                                        defaultValue={ROLE_LABELS[user?.role ?? ""] ?? user?.role}
                                        disabled
                                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500 text-sm font-medium cursor-not-allowed capitalize"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notifications Section */}
                    {activeTab === "Notifications" && (
                        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-neutral-900 mb-6">Notifications</h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                                    <div>
                                        <p className="font-bold text-neutral-900 text-sm">Email Notifications</p>
                                        <p className="text-xs text-neutral-500">Receive daily summaries and alerts</p>
                                    </div>
                                    <button
                                        onClick={() => setEmailNotif(!emailNotif)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${
                                            emailNotif ? "bg-primary" : "bg-neutral-300"
                                        }`}
                                    >
                                        <div
                                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                                                emailNotif ? "left-7" : "left-1"
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Security Section */}
                    {activeTab === "Security" && (
                        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-neutral-900 mb-6">Security</h2>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter current password"
                                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
