"use client";

import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TeamTaskMonitor } from "@/components/ta/team/TeamTaskMonitor";
import { useAuth } from "@/lib/auth";

export default function TaTasksPage() {
    const { user } = useAuth();
    const lead = user?.role === "TA_MANAGER" || user?.role === "SUPER_ADMIN";
    return (
        <div className="space-y-6">
            {lead && user && <TeamTaskMonitor meId={user.id} />}
            <TaskBoard title="Recruitment Tasks" />
        </div>
    );
}
