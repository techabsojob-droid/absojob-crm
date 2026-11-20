// ─── TOTP (RFC 6238) for two-step sign-in — server only ──────
// Works with Google Authenticator, Microsoft Authenticator, Authy, 1Password, etc.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buf: Buffer): string {
    let bits = 0, value = 0, out = "";
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
}

function base32Decode(s: string): Buffer {
    const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = 0, value = 0;
    const out: number[] = [];
    for (const ch of clean) {
        value = (value << 5) | B32.indexOf(ch);
        bits += 5;
        if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return Buffer.from(out);
}

/** A new random 160-bit secret, base32 encoded. */
export function generateTotpSecret(): string {
    return base32Encode(randomBytes(20));
}

function codeAt(secret: Buffer, counter: number): string {
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(counter));
    const h = createHmac("sha1", secret).update(msg).digest();
    const o = h[h.length - 1] & 15;
    const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Accepts the current code and one step either side, for clock drift. */
export function verifyTotp(secretB32: string, code: string, now = Date.now()): boolean {
    const c = String(code ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(c)) return false;
    const secret = base32Decode(secretB32);
    const counter = Math.floor(now / 1000 / STEP_SECONDS);
    for (const d of [-1, 0, 1]) {
        const expected = Buffer.from(codeAt(secret, counter + d));
        if (timingSafeEqual(expected, Buffer.from(c))) return true;
    }
    return false;
}

/** otpauth:// link that authenticator apps read from a QR code. */
export function otpauthUrl(secretB32: string, account: string, issuer = "AbsoJob CRM"): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// ─── Secret storage: AES-256-GCM keyed from SESSION_SECRET ───

function key(): Buffer {
    const secret = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
        ? process.env.SESSION_SECRET
        : "absojob-dev-only-session-secret-change-me";
    return createHash("sha256").update(`totp:${secret}`).digest();
}

export function sealSecret(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key(), iv);
    const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function openSecret(sealed: string | null | undefined): string | null {
    if (!sealed) return null;
    const [v, iv, tag, data] = sealed.split(".");
    if (v !== "v1" || !iv || !tag || !data) return null;
    try {
        const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
        d.setAuthTag(Buffer.from(tag, "base64url"));
        return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
    } catch {
        return null;
    }
}
