import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, users } from '@/lib/mock/data'
import { roleHome } from '@/lib/types'
import { canAccessWorkspace, workspaceOfPath } from '@/lib/access'
import { ensureFresh } from '@/lib/db/sync'
import { issueSessionCookie, maintenanceBlocks, resolveSession, sessionTtlSeconds } from '@/lib/security'

// API calls allowed while maintenance mode is on (so people can still sign out or see why)
const MAINTENANCE_OPEN_API = ['/api/auth/logout', '/api/auth/me', '/api/status', '/api/auth/login']

export default async function proxy(request: NextRequest) {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    // Logins live in Supabase; if it's unreachable the API routes report it, pages fall through to /login
    if (token) await ensureFresh().catch(() => {})
    const resolved = token ? await resolveSession(token, users) : null
    const user = resolved?.user

    const pathname = request.nextUrl.pathname
    const isApi = pathname.startsWith('/api/')
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
    const isMaintenancePage = pathname === '/maintenance'
    const workspace = workspaceOfPath(pathname)
    const isProtectedRoute = workspace !== null
    const isRootRoute = pathname === '/'

    const redirect = (to: string, search = '') => {
        const url = request.nextUrl.clone()
        url.pathname = to
        url.search = search
        return NextResponse.redirect(url)
    }

    // 0. A cookie that no longer works (expired from inactivity, signed out by an admin, account disabled) is cleared
    if (token && !user) {
        if (isApi) {
            // Let the route answer (401); just drop the dead cookie
            const res = NextResponse.next()
            res.cookies.delete(SESSION_COOKIE)
            return res
        }
        const res = isProtectedRoute || isRootRoute ? redirect('/login', '?reason=signed-out') : NextResponse.next()
        res.cookies.delete(SESSION_COOKIE)
        return res
    }

    // 1. Maintenance mode: only the Super Admin gets in
    if (user && maintenanceBlocks(user)) {
        if (isApi) {
            if (!MAINTENANCE_OPEN_API.includes(pathname)) {
                return NextResponse.json({ error: 'The CRM is in maintenance mode. Please try again later.', code: 'MAINTENANCE' }, { status: 503 })
            }
        } else if (!isMaintenancePage) {
            return redirect('/maintenance')
        }
    } else if (isMaintenancePage && user) {
        return redirect(roleHome(user.role))
    }

    // 2. Unauthenticated → login
    if (!user && (isProtectedRoute || isRootRoute)) return redirect('/login')

    // 3. Authenticated hitting auth pages or '/' → role home
    if (user && (isAuthRoute || isRootRoute)) return redirect(roleHome(user.role))

    // 4. RBAC portal guard
    if (user && workspace && !canAccessWorkspace(user.role, workspace)) return redirect(roleHome(user.role))

    const res = NextResponse.next()

    // 5. Inactivity timeout: real activity (opening a page, saving something, or the
    //    browser's activity ping) pushes the expiry forward. Background polling doesn't.
    //    Auth routes set or clear the cookie themselves, so they are left alone.
    const authRouteSetsCookie = pathname.startsWith('/api/auth/') && pathname !== '/api/auth/activity'
    if (user && resolved && !authRouteSetsCookie) {
        const isActivity = !isApi || request.method !== 'GET' || pathname === '/api/auth/activity'
        const ttlMs = sessionTtlSeconds(user.orgId) * 1000
        const remaining = resolved.session.expiresAt - Date.now()
        // Re-sign at most once a minute, or at once if the timeout was shortened
        if ((isActivity && remaining < ttlMs - 60_000) || remaining > ttlMs + 60_000) {
            const cookie = await issueSessionCookie(user, resolved.session.issuedAt)
            res.cookies.set(SESSION_COOKIE, cookie.value, cookie.options)
        }
    }

    return res
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
