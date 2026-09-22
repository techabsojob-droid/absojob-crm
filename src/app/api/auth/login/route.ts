import { NextResponse } from 'next/server'
import { MOCK_PASSWORD, SESSION_COOKIE, users } from '@/lib/mock/data'

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json()

        const user = users.find(
            (u) => u.email.toLowerCase() === String(email).toLowerCase() && (u.status === "ACTIVE" || u.status === "INVITED")
        )

        if (!user || password !== MOCK_PASSWORD) {
            return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 })
        }

        const response = NextResponse.json({
            success: true,
            redirect:
                user.role === "SUPER_ADMIN" ? "/admin/dashboard"
                : user.role === "HR_ADMIN" ? "/hr/dashboard"
                : user.role === "TA_MANAGER" || user.role === "TA_RECRUITER" ? "/ta/dashboard"
                : "/portal/dashboard",
            user: { id: user.id, email: user.email, role: user.role }
        })

        response.cookies.set(SESSION_COOKIE, user.id, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30
        })

        return response
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
