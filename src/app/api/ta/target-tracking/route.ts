import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { recruiterTargets, users } from "@/lib/mock/data";
import { hasOrgWideRecruitmentAccess, isInRecruitmentTeam, recruitmentTeam } from "@/lib/mock/pipeline";
import { istNow } from "@/lib/mock/ess";
import { TARGET_METRICS, dailyProgress, kpiEvents, targetLines, userLabel, type TargetMetric } from "@/lib/mock/kpi";
import type { User } from "@/lib/types";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/ta/target-tracking?month=YYYY-MM&metric=joinings
// Assigned vs achieved for the signed-in user (a TA Manager's achievement rolls up their team)
// and, for leads, each team member. All numbers come from live CRM records.
export async function GET(request: Request) {
    const auth = await requireRole("SUPER_ADMIN", "TA_MANAGER", "TA_RECRUITER");
    if ("error" in auth) return auth.error;
    const me = auth.user;
    const p = new URL(request.url).searchParams;
    const month = MONTH_RE.test(p.get("month") ?? "") ? p.get("month")! : istNow().date.slice(0, 7);
    const metric = (TARGET_METRICS.some((m) => m.key === p.get("metric")) ? p.get("metric") : "joinings") as TargetMetric;

    const events = kpiEvents(me.orgId);
    const team = me.role === "TA_RECRUITER" ? [] : recruitmentTeam(me);
    // A manager's own achievement = their own work plus their team's (they own the team's output)
    const selfCredit = new Set<string>([me.id, ...(me.role === "TA_MANAGER" ? team.map((u) => u.id) : [])]);

    const meta = (u: User) => {
        const t = recruiterTargets.find((x) => x.orgId === me.orgId && x.userId === u.id && x.month === month);
        return t ? { setByName: t.setByName, updatedAt: t.updatedAt ?? null } : null;
    };
    const self = {
        user: userLabel(me),
        rollup: me.role === "TA_MANAGER" && team.length > 0,
        target: meta(me),
        lines: targetLines(me.orgId, me.id, selfCredit, month, events),
        progress: dailyProgress(me.orgId, selfCredit, month, metric, events),
    };

    const members = team.map((u) => {
        const lines = targetLines(me.orgId, u.id, new Set([u.id]), month, events);
        const head = lines.find((l) => l.metric === metric)!;
        return { user: userLabel(u), target: meta(u), lines, headline: head };
    });

    // Team totals: sum of each member's assigned target and achievement
    const teamTotals = TARGET_METRICS.map((m) => {
        const ls = members.map((x) => x.lines.find((l) => l.metric === m.key)!);
        const withTarget = ls.filter((l) => l.assigned !== null);
        const assigned = withTarget.length ? withTarget.reduce((s, l) => s + (l.assigned ?? 0), 0) : null;
        const achieved = ls.reduce((s, l) => s + l.achieved, 0);
        return {
            metric: m.key, label: m.label, money: m.money, assigned, achieved,
            achievementPct: assigned ? Math.round((achieved / assigned) * 1000) / 10 : null,
            remaining: assigned !== null ? Math.max(0, assigned - achieved) : null,
            shortfall: assigned !== null ? assigned - achieved : null,
            isShortfall: assigned !== null ? achieved < assigned : null,
            membersWithTarget: withTarget.length,
            membersShort: withTarget.filter((l) => l.isShortfall).length,
        };
    });

    return NextResponse.json({
        month,
        metric,
        metrics: TARGET_METRICS.map((m) => ({ key: m.key, label: m.label, money: m.money })),
        self,
        team: members,
        teamTotals,
        teamProgress: team.length ? dailyProgress(me.orgId, new Set(team.map((u) => u.id)), month, metric, events) : [],
        canSetTeamTargets: me.role !== "TA_RECRUITER",
        canSetOwnTarget: hasOrgWideRecruitmentAccess(me),
        assignable: me.role === "TA_RECRUITER" ? [] : users.filter((u) => u.orgId === me.orgId && u.status === "ACTIVE" && (hasOrgWideRecruitmentAccess(me) ? ["TA_RECRUITER", "TA_MANAGER"].includes(u.role) : isInRecruitmentTeam(me, u.id))).map(userLabel),
    });
}
