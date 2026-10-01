// ─── Signed session tokens ────────────────────────────────────
// Cookie value: `<userId>.<expiresAtMs>.<hmacSha256Base64url>`
// Uses Web Crypto so it works in both the proxy and route handlers.

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

export async function signSession(userId: string): Promise<string> {
    const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
    const payload = `${userId}.${expiresAt}`;
    return `${payload}.${await hmac(payload)}`;
}

/** Returns the user id if the token is authentic and unexpired, otherwise null. */
export async function verifySession(token: string | undefined | null): Promise<string | null> {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [userId, expiresAtRaw, sig] = parts;
    const expiresAt = Number(expiresAtRaw);
    if (!userId || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
    const expected = await hmac(`${userId}.${expiresAtRaw}`);
    return safeEqual(sig, expected) ? userId : null;
}
