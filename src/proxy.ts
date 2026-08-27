import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, users } from '@/lib/mock/data'
import { roleHome } from '@/lib/types'

const PORTAL_PREFIXES: Record<string, RegExp> = {
    ADMIN: /^\/admin(\/|$)/,
    TA: /^\/ta(\/|$)/,
    PORTAL: /^\/portal(\/|$)/,
}

function allowedPortals(role: string): string[] {
    switch (role) {
        case "SUPER_ADMIN":
            return ["ADMIN", "TA", "PORTAL"]; // full access & control
        case "TA_MANAGER":
        case "TA_RECRUITER":
            return ["TA"];
        default:
            return ["PORTAL"];
    }
}

export default async function proxy(request: NextRequest) {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    const user = sessionId ? users.find((u) => u.id === sessionId) : undefined

    const pathname = request.nextUrl.pathname
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
    const isProtectedRoute =
        pathname.startsWith('/admin') || pathname.startsWith('/ta') || pathname.startsWith('/portal')
    const isRootRoute = pathname === '/'

    // 1. Unauthenticated → login
    if (!user && isProtectedRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    if (user && user.status !== "ACTIVE") {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        const res = NextResponse.redirect(url)
        res.cookies.delete(SESSION_COOKIE)
        return res
    }

    // 2. Authenticated hitting auth pages or '/' → role home
    if (user && (isAuthRoute || isRootRoute)) {
        const url = request.nextUrl.clone()
        url.pathname = roleHome(user.role)
        return NextResponse.redirect(url)
    }

    // 3. RBAC portal guard
    if (user && isProtectedRoute) {
        const portals = allowedPortals(user.role)
        const hasAccess = portals.some((p) => PORTAL_PREFIXES[p].test(pathname))
        if (!hasAccess) {
            const url = request.nextUrl.clone()
            url.pathname = roleHome(user.role)
            return NextResponse.redirect(url)
        }
    }

    // 4. Unauthenticated at '/' → login
    if (!user && isRootRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
