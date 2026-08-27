"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";

export interface User {
    id: string;
    orgId: string;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function initAuth() {
            try {
                const response = await fetch("/api/auth/me");
                if (!response.ok) throw new Error("Session check failed");

                const data = await response.json();
                if (mounted) {
                    setUser(data?.user || null);
                    setLoading(false);
                }
            } catch {
                if (mounted) {
                    setUser(null);
                    setLoading(false);
                }
            }
        }

        initAuth();

        return () => {
            mounted = false;
        };
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        setLoading(true);
        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                setLoading(false);
                return { success: false, error: result.error || "Login failed" };
            }

            return { success: true };
        } catch {
            setLoading(false);
            return { success: false, error: "Login failed" };
        }
    }, []);

    const logout = useCallback(async () => {
        setLoading(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            setUser(null);
            router.refresh();
            setLoading(false);
            router.push("/login");
        } catch {
            setLoading(false);
        }
    }, [router]);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
