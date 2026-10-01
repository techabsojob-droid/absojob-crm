import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/mock/server"
import { notifications as allNotifications } from "@/lib/mock/data"

export async function GET() {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = allNotifications
        .filter((n) => n.userId === user.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 30)

    return NextResponse.json(data)
}

export async function PATCH(request: Request) {
    const { id, all } = await request.json()
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (all) {
        allNotifications.filter((n) => n.userId === user.id).forEach((n) => { n.isRead = true })
        return NextResponse.json({ success: true })
    }

    const notification = allNotifications.find((n) => n.id === id && n.userId === user.id)
    if (notification) {
        notification.isRead = true
    }

    return NextResponse.json({ success: true })
}
