import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/server";
import { taskActivity, taskComments, tasks, users } from "@/lib/mock/data";
import { canViewTask, findMentions, newActivity, notifyTask, taskFollowers } from "@/lib/tasks";
import type { TaskComment } from "@/lib/types";

async function load(idOrKey: string) {
    const auth = await requireRole();
    if ("error" in auth) return { error: auth.error };
    const me = auth.user;
    const k = decodeURIComponent(idOrKey);
    const t = tasks.find((x) => x.orgId === me.orgId && (x.id === k || x.key === k));
    if (!t || !canViewTask(me, t, users)) return { error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };
    return { me, t };
}

// POST /api/tasks/:idOrKey/comments { body } — anyone who can see the task may comment
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const r = await load((await params).id);
    if ("error" in r) return r.error;
    const { me, t } = r;

    const { body } = await request.json().catch(() => ({ body: "" }));
    const text = String(body ?? "").trim().slice(0, 5000);
    if (!text) return NextResponse.json({ error: "Comment can't be empty" }, { status: 400 });

    const people = users.filter((u) => u.orgId === me.orgId && u.status === "ACTIVE");
    const mentionIds = findMentions(text, people).filter((id) => id !== me.id);
    const comment: TaskComment = {
        id: `tcm-${crypto.randomUUID().slice(0, 8)}`, orgId: me.orgId, taskId: t.id, authorId: me.id,
        body: text, mentionIds, createdAt: new Date().toISOString(), editedAt: null,
    };
    taskComments.push(comment);
    taskActivity.push(newActivity(t, me.id, "COMMENTED"));

    // Like Jira: commenting or being mentioned makes you a watcher
    t.watcherIds = [...new Set([...(t.watcherIds ?? []), ...mentionIds, ...(t.assignedToId === me.id || t.createdById === me.id ? [] : [me.id])])];
    t.updatedAt = comment.createdAt;

    const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text;
    notifyTask(t, mentionIds, "You were mentioned", `${me.name} mentioned you on ${t.key}: "${preview}"`);
    notifyTask(t, taskFollowers(t, me.id).filter((id) => !mentionIds.includes(id)), "New comment", `${me.name} commented on ${t.key}: "${preview}"`);

    return NextResponse.json({ ...comment, author: { id: me.id, name: me.name }, canEdit: true }, { status: 201 });
}

// PATCH /api/tasks/:idOrKey/comments { commentId, body } — authors edit their own comments
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const r = await load((await params).id);
    if ("error" in r) return r.error;
    const { me, t } = r;
    const { commentId, body } = await request.json().catch(() => ({}));
    const c = taskComments.find((x) => x.id === commentId && x.taskId === t.id);
    if (!c) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    if (c.authorId !== me.id) return NextResponse.json({ error: "You can only edit your own comments" }, { status: 403 });
    const text = String(body ?? "").trim().slice(0, 5000);
    if (!text) return NextResponse.json({ error: "Comment can't be empty" }, { status: 400 });
    c.body = text;
    c.editedAt = new Date().toISOString();
    return NextResponse.json({ ...c, author: { id: me.id, name: me.name }, canEdit: true });
}

// DELETE /api/tasks/:idOrKey/comments { commentId } — authors delete their own comments
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const r = await load((await params).id);
    if ("error" in r) return r.error;
    const { me, t } = r;
    const { commentId } = await request.json().catch(() => ({}));
    const i = taskComments.findIndex((x) => x.id === commentId && x.taskId === t.id);
    if (i === -1) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    if (taskComments[i].authorId !== me.id) return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 });
    taskComments.splice(i, 1);
    return NextResponse.json({ success: true });
}
