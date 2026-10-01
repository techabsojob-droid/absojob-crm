"use client";

import { useQuery } from "@tanstack/react-query";

interface Assignee { id: string; name: string; role: string; designation: string | null; isMe: boolean }

const ROLE_GROUP: Record<string, string> = {
    SUPER_ADMIN: "Leadership",
    HR_ADMIN: "HR",
    FINANCE_ADMIN: "Finance",
    TA_MANAGER: "Talent Acquisition",
    TA_RECRUITER: "Talent Acquisition",
    AGENT: "Field partners",
    EMPLOYEE: "Employees",
};

/** "Assign to" picker for task forms. Empty value = assign to myself. Hidden when the user can only assign to themselves. */
export function AssigneeSelect({ value, onChange, className, labelClassName }: {
    value: string;
    onChange: (id: string) => void;
    className?: string;
    labelClassName?: string;
}) {
    const { data: people = [] } = useQuery<Assignee[]>({
        queryKey: ["task-assignees"],
        queryFn: async () => {
            const res = await fetch("/api/admin/tasks/assignees");
            if (!res.ok) return [];
            return res.json();
        },
        staleTime: 60_000,
    });

    const others = people.filter((p) => !p.isMe);
    if (others.length === 0) return null;

    const groups = new Map<string, Assignee[]>();
    for (const p of others) {
        const g = ROLE_GROUP[p.role] ?? "Other";
        groups.set(g, [...(groups.get(g) ?? []), p]);
    }

    return (
        <div>
            <label className={labelClassName ?? "text-xs font-bold text-neutral-700"}>Assign to</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={className ?? "w-full mt-1 p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl"}
            >
                <option value="">Myself</option>
                {[...groups.entries()].map(([group, list]) => (
                    <optgroup key={group} label={group}>
                        {list.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}{p.designation ? ` — ${p.designation}` : ""}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
        </div>
    );
}
