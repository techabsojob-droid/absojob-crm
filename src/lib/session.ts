// ─── Signed session tokens ────────────────────────────────────
// Cookie value: `<userId>.<issuedAtMs>.<expiresAtMs>.<hmacSha256Base64url>`
// Older cookies (`<userId>.<expiresAtMs>.<sig>`) are still accepted, with an unknown
// issue time, so a "sign everyone out" flush also ends them.
// Uses Web Crypto so it works in both the proxy and route handlers.

/** Hard ceiling on one login, however active the user stays. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const DEV_FALLBACK_SECRET = "absojob-dev-only-session-secret-change-me";

function getSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (secret && secret.length >= 32) return secret;
    if (process.env.NODE_ENV === "production") {
        throw new Error("SESSION_SECRET must be set (min 32 chars) in production");
    }
    return DEV_FALLBACK_SECRET;
}

function toBase64Url(bytes: ArrayBuffer): string {
    let bin = "";
    new Uint8Array(bytes).forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(getSecret()),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    return toBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export interface SessionInfo {
    userId: string;
    /** 0 for cookies issued before issue times were recorded. */
    issuedAt: number;
    expiresAt: number;
}

/**
 * Signs a session that lasts `ttlSeconds` (the inactivity timeout), never past
 * `issuedAt` + SESSION_MAX_AGE_SECONDS.
 */
export async function signSession(userId: string, opts: { ttlSeconds?: number; issuedAt?: number } = {}): Promise<string> {
    const issuedAt = opts.issuedAt ?? Date.now();
    const ttl = Math.min(opts.ttlSeconds ?? SESSION_MAX_AGE_SECONDS, SESSION_MAX_AGE_SECONDS);
    const expiresAt = Math.min(Date.now() + ttl * 1000, issuedAt + SESSION_MAX_AGE_SECONDS * 1000);
    const payload = `${userId}.${issuedAt}.${expiresAt}`;
    return `${payload}.${await hmac(payload)}`;
}

/** Returns the session if the token is authentic and unexpired, otherwise null. */
export async function readSession(token: string | undefined | null): Promise<SessionInfo | null> {
    if (!token) return null;
    const parts = token.split(".");
    let userId: string, issuedRaw: string, expiresRaw: string, sig: string;
    if (parts.length === 4) [userId, issuedRaw, expiresRaw, sig] = parts;
    else if (parts.length === 3) { [userId, expiresRaw, sig] = parts; issuedRaw = ""; }
    else return null;
    const expiresAt = Number(expiresRaw);
    const issuedAt = issuedRaw ? Number(issuedRaw) : 0;
    if (!userId || !Number.isFinite(expiresAt) || !Number.isFinite(issuedAt) || expiresAt < Date.now()) return null;
    const payload = issuedRaw ? `${userId}.${issuedRaw}.${expiresRaw}` : `${userId}.${expiresRaw}`;
    return safeEqual(sig, await hmac(payload)) ? { userId, issuedAt, expiresAt } : null;
}

/** Returns the user id if the token is authentic and unexpired, otherwise null. */
export async function verifySession(token: string | undefined | null): Promise<string | null> {
    return (await readSession(token))?.userId ?? null;
}

// ─── Short-lived signed tokens (MFA login step) ──────────────

/** Signs `purpose.subject` for `ttlSeconds`. */
export async function signToken(purpose: string, subject: string, ttlSeconds: number): Promise<string> {
    const payload = `${purpose}.${subject}.${Date.now() + ttlSeconds * 1000}`;
    return `${payload}.${await hmac(payload)}`;
}

/** Returns the subject if the token is authentic, unexpired and for `purpose`. */
export async function verifyToken(purpose: string, token: string | undefined | null): Promise<string | null> {
    if (!token) return null;
    const parts = String(token).split(".");
    if (parts.length !== 4) return null;
    const [p, subject, expRaw, sig] = parts;
    if (p !== purpose || !subject || !(Number(expRaw) > Date.now())) return null;
    return safeEqual(sig, await hmac(`${p}.${subject}.${expRaw}`)) ? subject : null;
}
