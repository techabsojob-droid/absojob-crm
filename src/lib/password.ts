// Password hashing (scrypt) — server only.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(plain: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(plain, salt, 64).toString("hex");
    return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
    const [algo, salt, hash] = stored.split("$");
    if (algo !== "scrypt" || !salt || !hash) return false;
    const a = Buffer.from(hash, "hex");
    const b = scryptSync(plain, salt, 64);
    return a.length === b.length && timingSafeEqual(a, b);
}

/** Minimum policy: 8+ chars with a letter and a number. */
export function passwordPolicyError(pw: string): string | null {
    if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must contain a letter and a number";
    if (pw.length > 128) return "Password is too long";
    return null;
}
