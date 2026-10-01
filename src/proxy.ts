import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, users } from '@/lib/mock/data'
import { roleHome } from '@/lib/types'
import { verifySession } from '@/lib/session'
import { canAccessWorkspace, workspaceOfPath } from '@/lib/access'
import { ensureFresh } from '@/lib/db/sync'

export default async function proxy(request: NextRequest) {
    const sessionId = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)
    // Logins live in Supabase; if it's unreachable the API routes report it, pages fall through to /login
    if (sessionId) await ensureFresh().catch(() => {})
    const user = sessionId ? users.find((u) => u.id === sessionId) : undefined

    const pathname = request.nextUrl.pathname
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
    const workspace = workspaceOfPath(pathname)
    const isProtectedRoute = workspace !== null
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
    if (user && workspace) {
        if (!canAccessWorkspace(user.role, workspace)) {
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
