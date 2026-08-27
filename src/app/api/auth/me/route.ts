import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/mock/server"

export async function GET() {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ user: null })
    }
    return NextResponse.json({
        user: {
            id: user.id,
            orgId: user.orgId,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatarUrl,
        }
    })
}
