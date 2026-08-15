import { NextRequest, NextResponse } from "next/server";
import { auth } from "@repo/auth";
import { db, chatSession } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title?.trim();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(chatSession)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(chatSession.id, id),
          eq(chatSession.userId, session.user.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Session not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({ session: updated });
  } catch (error) {
    console.error("[API PATCH /api/chat/sessions/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [deleted] = await db
      .delete(chatSession)
      .where(
        and(
          eq(chatSession.id, id),
          eq(chatSession.userId, session.user.id)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Session not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("[API DELETE /api/chat/sessions/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
