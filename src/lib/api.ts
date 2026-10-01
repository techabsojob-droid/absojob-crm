"use client";

import { useQuery } from "@tanstack/react-query";

/** fetch wrapper that throws the server's error message on non-2xx responses. */
export async function api<T = any>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "GET", body?: unknown): Promise<T> {
    const res = await fetch(path, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`);
    return data as T;
}

export interface EmployeeOption {
    id: string;
    employeeId: string;
    name: string;
    department: string;
    designation: string;
    status: string;
    userId?: string | null;
}

/** Active employees for HR pickers (assign asset, enroll in training, etc.). */
export function useEmployeeOptions(includeExited = false) {
    return useQuery<EmployeeOption[]>({
        queryKey: ["hr-employee-options", includeExited],
        queryFn: async () => {
            const list = await api<EmployeeOption[]>("/api/hr/employees");
            return (Array.isArray(list) ? list : []).filter((e) => includeExited || e.status !== "EXITED");
        },
        staleTime: 60_000,
    });
}
