import { NextResponse } from 'next/server'
import { MOCK_PASSWORD, SESSION_COOKIE, users } from '@/lib/mock/data'
import { dbEnabled } from '@/lib/db/sync'
import { roleHome } from '@/lib/types'
import { signSession, SESSION_MAX_AGE_SECONDS } from '@/lib/session'
import { verifyPassword } from '@/lib/password'
import { dbErrorResponse, syncRequest } from '@/lib/db/request'

// Failed attempts per IP + email: 8 within 15 minutes locks that pair out for the rest of the window
const FAIL_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILS = 8
const failures = new Map<string, number[]>()

function recentFailures(key: string) {
    const now = Date.now()
    const list = (failures.get(key) ?? []).filter((t) => now - t < FAIL_WINDOW_MS)
    failures.set(key, list)
    return list
}

export async function POST(request: Request) {
    try { await syncRequest() } catch (e) { return dbErrorResponse(e) }
    try {
        const { email, password } = await request.json()
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local"
        const key = `${ip}|${String(email).toLowerCase()}`
        if (recentFailures(key).length >= MAX_FAILS) {
            return NextResponse.json({ error: "Too many failed attempts. Try again in 15 minutes." }, { status: 429 })
        }

        const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())

        // Only real passwords are accepted. The shared demo password works only in offline mock mode.
        const valid = !!user && (user.passwordHash
            ? verifyPassword(String(password ?? ""), user.passwordHash)
            : !dbEnabled() && password === MOCK_PASSWORD)
        if (!user || !valid) {
            failures.get(key)!.push(Date.now())
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
        }
        failures.delete(key)

        // Proxy and API guards only admit ACTIVE users, so reject others here with a clear message
        if (user.status !== "ACTIVE") {
            const pending = user.role === "AGENT" && user.status === "INVITED"
            return NextResponse.json({ error: pending ? "Your partner application is under review. You will get an email once your KYC is verified." : "Your account is not active. Please contact your administrator." }, { status: 403 })
        }

        const response = NextResponse.json({
            success: true,
            redirect: roleHome(user.role),
            user: { id: user.id, email: user.email, role: user.role }
        })

        response.cookies.set(SESSION_COOKIE, await signSession(user.id), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: SESSION_MAX_AGE_SECONDS
        })

        return response
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
