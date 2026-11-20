// ─── Security policy enforcement (Settings › Security, Danger zone) ──
// One place that turns the saved settings into decisions. Used by the proxy,
// every API guard (requireRole) and the login route.

import type { User } from "@/lib/types";
import { readSession, signSession, SESSION_MAX_AGE_SECONDS, type SessionInfo } from "@/lib/session";
import { orgSettings } from "@/lib/org-settings";

export type MfaEnforcement = "OPTIONAL" | "ADMINS_ONLY" | "ALL_USERS";

export interface SecurityPolicy {
    mfaEnforcement: MfaEnforcement;
    minPasswordLength: number;
    sessionTimeoutMinutes: number;
    /** 0 turns account lockout off. */
    failedLoginLockoutAttempts: number;
    lockoutMinutes: number;
    maintenanceMode: boolean;
    maintenanceReason: string;
    /** Every non-Super-Admin session issued before this is signed out. */
    sessionsRevokedAt: string | null;
}

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export const POLICY_LIMITS = {
    minPasswordLength: [8, 64],
    sessionTimeoutMinutes: [5, 60 * 24 * 30],
    failedLoginLockoutAttempts: [0, 20],
} as const;

export function securityPolicy(orgId: string): SecurityPolicy {
    const s = orgSettings(orgId);
    const mfa = ["OPTIONAL", "ADMINS_ONLY", "ALL_USERS"].includes(s.mfaEnforcement) ? s.mfaEnforcement : "OPTIONAL";
    return {
        mfaEnforcement: mfa,
        minPasswordLength: clamp(s.minPasswordLength, ...POLICY_LIMITS.minPasswordLength, 8),
        sessionTimeoutMinutes: clamp(s.sessionTimeoutMinutes, ...POLICY_LIMITS.sessionTimeoutMinutes, 120),
        failedLoginLockoutAttempts: clamp(s.failedLoginLockoutAttempts, ...POLICY_LIMITS.failedLoginLockoutAttempts, 5),
        lockoutMinutes: 15,
        maintenanceMode: s.maintenanceMode === true,
        maintenanceReason: String(s.maintenanceReason ?? ""),
        sessionsRevokedAt: typeof s.sessionsRevokedAt === "string" ? s.sessionsRevokedAt : null,
    };
}

/** Roles that count as "admins & managers" for MFA enforcement. */
const ADMIN_ROLES: User["role"][] = ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "TA_MANAGER"];

export function mfaRequiredFor(user: Pick<User, "orgId" | "role">): boolean {
    const { mfaEnforcement } = securityPolicy(user.orgId);
    if (mfaEnforcement === "ALL_USERS") return true;
    if (mfaEnforcement === "ADMINS_ONLY") return ADMIN_ROLES.includes(user.role);
    return false;
}

/** Super Admin keeps working (and keeps their session) through maintenance and flushes. */
export const isOwner = (user: Pick<User, "role">) => user.role === "SUPER_ADMIN";

export function maintenanceBlocks(user: Pick<User, "orgId" | "role"> | null | undefined, orgId?: string): boolean {
    const org = user?.orgId ?? orgId;
    if (!org) return false;
    return securityPolicy(org).maintenanceMode && !(user && isOwner(user));
}

export type SessionProblem = "REVOKED" | null;

/** Whether a valid, unexpired session has since been signed out by an admin or a password reset. */
export function sessionProblem(user: User, session: SessionInfo): SessionProblem {
    const userCut = user.sessionsRevokedAt ? Date.parse(user.sessionsRevokedAt) : 0;
    if (userCut && session.issuedAt < userCut) return "REVOKED";
    const { sessionsRevokedAt } = securityPolicy(user.orgId);
    const orgCut = sessionsRevokedAt ? Date.parse(sessionsRevokedAt) : 0;
    if (orgCut && session.issuedAt < orgCut && !isOwner(user)) return "REVOKED";
    return null;
}

/** Reads the cookie and returns the signed-in user, or null if signed out, expired, revoked or inactive. */
export async function resolveSession(token: string | undefined | null, users: User[]): Promise<{ user: User; session: SessionInfo } | null> {
    const session = await readSession(token);
    if (!session) return null;
    const user = users.find((u) => u.id === session.userId);
    if (!user || user.status !== "ACTIVE") return null;
    if (sessionProblem(user, session)) return null;
    return { user, session };
}

export function sessionTtlSeconds(orgId: string): number {
    return Math.min(securityPolicy(orgId).sessionTimeoutMinutes * 60, SESSION_MAX_AGE_SECONDS);
}

/** A fresh cookie value for this user, honouring the inactivity timeout. Keeps the original issue time when refreshing. */
export async function issueSessionCookie(user: Pick<User, "id" | "orgId">, issuedAt?: number) {
    const ttl = sessionTtlSeconds(user.orgId);
    const value = await signSession(user.id, { ttlSeconds: ttl, issuedAt: issuedAt || undefined });
    return {
        value,
        options: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            path: "/",
            maxAge: ttl,
        },
    };
}

/** Signs this user out everywhere (password reset, suspension, MFA reset). */
export function revokeUserSessions(user: User) {
    user.sessionsRevokedAt = new Date().toISOString();
}
