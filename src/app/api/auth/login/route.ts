import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { MOCK_PASSWORD, SESSION_COOKIE, addAudit, organizations, users } from '@/lib/mock/data'
import type { User } from '@/lib/types'
import { dbEnabled } from '@/lib/db/sync'
import { roleHome } from '@/lib/types'
import { signToken, verifyToken } from '@/lib/session'
import { verifyPassword } from '@/lib/password'
import { dbErrorResponse, syncRequest } from '@/lib/db/request'
import { issueSessionCookie, maintenanceBlocks, mfaRequiredFor, securityPolicy } from '@/lib/security'
import { generateTotpSecret, openSecret, otpauthUrl, sealSecret, verifyTotp } from '@/lib/totp'

// Per IP + email throttle (also covers emails that don't exist): 8 within 15 minutes
const FAIL_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILS = 8
const failures = new Map<string, number[]>()

function recentFailures(key: string) {
    const now = Date.now()
    const list = (failures.get(key) ?? []).filter((t) => now - t < FAIL_WINDOW_MS)
    failures.set(key, list)
    return list
}

const MFA_STEP_SECONDS = 5 * 60
const MFA_SETUP_SECONDS = 10 * 60
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status })
const maintenanceResponse = () => fail('The CRM is in maintenance mode. Only the Super Admin can sign in right now.', 503, { code: 'MAINTENANCE' })

function lockedMessage(user: User) {
    const until = new Date(user.lockedUntil!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    return `Too many failed attempts. This account is locked until ${until} IST. Your admin can unlock it sooner.`
}

const isLocked = (user: User) => !!user.lockedUntil && Date.parse(user.lockedUntil) > Date.now()

/** Counts a failed password or code; locks the account once the Settings limit is reached. */
function recordFailure(user: User) {
    const policy = securityPolicy(user.orgId)
    user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1
    if (policy.failedLoginLockoutAttempts > 0 && user.failedLoginAttempts >= policy.failedLoginLockoutAttempts) {
        user.lockedUntil = new Date(Date.now() + policy.lockoutMinutes * 60_000).toISOString()
        user.failedLoginAttempts = 0
        addAudit({ orgId: user.orgId, actorUserId: user.id, actorRole: user.role, action: 'ACCOUNT_LOCKED', entity: 'User', entityId: user.id, detail: `${user.name} locked for ${policy.lockoutMinutes} minutes after ${policy.failedLoginLockoutAttempts} failed sign-in attempts` })
    }
}

function inactiveError(user: User) {
    const pending = user.role === 'AGENT' && user.status === 'INVITED'
    return fail(pending ? 'Your partner application is under review. You will get an email once your KYC is verified.' : 'Your account is not active. Please contact your administrator.', 403)
}

async function signIn(user: User) {
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    const response = NextResponse.json({
        success: true,
        redirect: maintenanceBlocks(user) ? '/maintenance' : roleHome(user.role),
        user: { id: user.id, email: user.email, role: user.role },
    })
    const cookie = await issueSessionCookie(user)
    response.cookies.set(SESSION_COOKIE, cookie.value, cookie.options)
    return response
}

export async function POST(request: Request) {
    try { await syncRequest() } catch (e) { return dbErrorResponse(e) }
    try {
        const body = await request.json()
        if (body.challenge) return await secondStep(body)

        const { email, password } = body
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
        const key = `${ip}|${String(email).toLowerCase()}`
        if (recentFailures(key).length >= MAX_FAILS) {
            return fail('Too many failed attempts. Try again in 15 minutes.', 429)
        }

        const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())

        // Maintenance applies to the whole organisation, so answer the same way whether or not the email exists
        const orgId = user?.orgId ?? organizations[0]?.id
        if (orgId && securityPolicy(orgId).maintenanceMode && user?.role !== 'SUPER_ADMIN') return maintenanceResponse()

        if (user && isLocked(user)) return fail(lockedMessage(user), 423)

        // Only real passwords are accepted. The shared demo password works only in offline mock mode.
        const valid = !!user && (user.passwordHash
            ? verifyPassword(String(password ?? ''), user.passwordHash)
            : !dbEnabled() && password === MOCK_PASSWORD)
        if (!user || !valid) {
            failures.get(key)!.push(Date.now())
            if (user) {
                recordFailure(user)
                if (isLocked(user)) return fail(lockedMessage(user), 423)
            }
            return fail('Invalid email or password', 401)
        }
        failures.delete(key)

        // Proxy and API guards only admit ACTIVE users, so reject others here with a clear message
        if (user.status !== 'ACTIVE') return inactiveError(user)

        // Two-step sign-in
        const secret = user.mfaEnabled ? openSecret(user.mfaSecretEnc) : null
        if (secret) {
            return NextResponse.json({ mfaRequired: true, challenge: await signToken('mfa', user.id, MFA_STEP_SECONDS) })
        }
        if (mfaRequiredFor(user)) {
            const pending = generateTotpSecret()
            user.mfaPendingSecretEnc = sealSecret(pending)
            const url = otpauthUrl(pending, user.email)
            return NextResponse.json({
                mfaSetupRequired: true,
                challenge: await signToken('mfa-setup', user.id, MFA_SETUP_SECONDS),
                secret: pending,
                otpauthUrl: url,
                qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 200 }),
            })
        }

        return await signIn(user)
    } catch {
        return fail('Internal server error', 500)
    }
}

/** Second step: a 6-digit code from the authenticator app (sign-in or first-time setup). */
async function secondStep(body: { challenge?: string; code?: string }) {
    const setupId = await verifyToken('mfa-setup', body.challenge)
    const userId = setupId ?? await verifyToken('mfa', body.challenge)
    if (!userId) return fail('This sign-in step has expired. Enter your password again.', 401, { restart: true })

    const user = users.find((u) => u.id === userId)
    if (!user) return fail('This sign-in step has expired. Enter your password again.', 401, { restart: true })
    if (user.status !== 'ACTIVE') return inactiveError(user)
    if (maintenanceBlocks(user)) return maintenanceResponse()
    if (isLocked(user)) return fail(lockedMessage(user), 423, { restart: true })

    const secret = openSecret(setupId ? user.mfaPendingSecretEnc : user.mfaSecretEnc)
    if (!secret) return fail('This sign-in step has expired. Enter your password again.', 401, { restart: true })

    if (!verifyTotp(secret, String(body.code ?? ''))) {
        recordFailure(user)
        if (isLocked(user)) return fail(lockedMessage(user), 423, { restart: true })
        return fail('That code is not right. Check the time on your phone and try the newest code.', 401)
    }

    if (setupId) {
        user.mfaSecretEnc = user.mfaPendingSecretEnc
        user.mfaPendingSecretEnc = null
        user.mfaEnabled = true
        addAudit({ orgId: user.orgId, actorUserId: user.id, actorRole: user.role, action: 'MFA_ENABLED', entity: 'User', entityId: user.id, detail: `${user.name} set up two-step sign-in` })
    }
    return await signIn(user)
}
