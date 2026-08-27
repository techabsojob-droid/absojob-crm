import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/mock/data'

export async function POST() {
    try {
        const response = NextResponse.json({ success: true })
        response.cookies.delete(SESSION_COOKIE)
        return response
    } catch (err) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
