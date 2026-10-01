import { NextResponse } from 'next/server'
import { MOCK_PASSWORD, SESSION_COOKIE, users } from '@/lib/mock/data'
import { roleHome } from '@/lib/types'
import { signSession, SESSION_MAX_AGE_SECONDS } from '@/lib/session'
import { verifyPassword } from '@/lib/password'
import { dbErrorResponse, syncRequest } from '@/lib/db/request'

export async function POST(request: Request) {
    try { await syncRequest() } catch (e) { return dbErrorResponse(e) }
    try {
        const { email, password } = await request.json()

        const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())

        // Users who set their own password must use it; seeded demo users fall back to the demo password
        const valid = !!user && (user.passwordHash ? verifyPassword(String(password ?? ""), user.passwordHash) : password === MOCK_PASSWORD)
        if (!user || !valid) {
            return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 })
        }

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
