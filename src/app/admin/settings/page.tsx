"use client";

import { User, Bell, Shield, Globe, Lock, Smartphone, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Administrator",
    TA_MANAGER: "TA Manager",
    TA_RECRUITER: "Recruiter",
    AGENT: "Channel Agent",
    EMPLOYEE: "Employee",
};
import Image from "next/image";

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const [emailNotif, setEmailNotif] = useState(true);
    const [pushNotif, setPushNotif] = useState(false);
    const [activeTab, setActiveTab] = useState("Profile");

    // Form states
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    useEffect(() => {
        if (user) {
            setName(user.name || "");
            setEmail(user.email || "");
        }
    }, [user]);

    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-neutral-500 font-medium">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
                <p className="text-sm text-neutral-500 mt-1">Manage your account preferences and system configuration</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Navigation Sidebar */}
                <div className="space-y-1">
                    {[
                        { label: "Profile", icon: User },
                        { label: "Notifications", icon: Bell },
                        { label: "Security", icon: Shield },
                    ].map((item) => (
                        <button
                            key={item.label}
                            onClick={() => setActiveTab(item.label)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === item.label
                                ? "bg-primary text-white shadow-lg shadow-primary/25"
                                : "text-neutral-600 hover:bg-neutral-100"
                                }`}
                        >
                            <item.icon size={18} /> {item.label}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">

                    {/* Profile Section */}
                    {activeTab === "Profile" && (
                        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm card-shadow">
                            <h2 className="text-lg font-bold text-neutral-900 mb-6">Profile Details</h2>

                            <div className="flex items-center gap-6 mb-8">
                                <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center text-2xl font-bold text-neutral-400 border-4 border-white shadow-lg overflow-hidden relative">
                                    {user?.avatar ? (
                                        <Image src={user.avatar} alt="Avatar" fill className="object-cover" />
                                    ) : (
                                        user?.name?.charAt(0) || "U"
                                    )}
                                </div>
                                <button className="px-4 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-50 transition-colors shadow-sm">
                                    Change Avatar
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name</label>
                                    <input 
                                        type="text" 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium" 
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

                            <div className="mt-8 flex justify-end">
                                <button className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all">
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Notifications Section */}
                    {activeTab === "Notifications" && (
                        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm card-shadow">
                            <h2 className="text-lg font-bold text-neutral-900 mb-6">Notifications</h2>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm text-neutral-600"><Globe size={20} /></div>
                                        <div>
                                            <p className="font-bold text-neutral-900 text-sm">Email Notifications</p>
                                            <p className="text-xs text-neutral-500">Receive daily summaries and alerts</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setEmailNotif(!emailNotif)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${emailNotif ? 'bg-primary' : 'bg-neutral-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${emailNotif ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm text-neutral-600"><Smartphone size={20} /></div>
                                        <div>
                                            <p className="font-bold text-neutral-900 text-sm">Push Notifications</p>
                                            <p className="text-xs text-neutral-500">Instant alerts on your mobile device</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setPushNotif(!pushNotif)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${pushNotif ? 'bg-primary' : 'bg-neutral-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${pushNotif ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Security Section */}
                    {activeTab === "Security" && (
                        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm card-shadow">
                            <h2 className="text-lg font-bold text-neutral-900 mb-6">Security</h2>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Password</label>
                                    <input type="password" placeholder="Enter current password" className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">New Password</label>
                                    <input type="password" placeholder="Enter new password" className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Confirm Password</label>
                                    <input type="password" placeholder="Confirm new password" className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary outline-none" />
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all flex items-center gap-2">
                                        <Lock size={16} /> Update Password
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
