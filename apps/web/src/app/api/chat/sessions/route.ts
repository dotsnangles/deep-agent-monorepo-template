import { NextRequest, NextResponse } from "next/server";
import { auth } from "@repo/auth";
import { db, chatSession } from "@repo/db";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(_req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await db
      .select()
      .from(chatSession)
      .where(eq(chatSession.userId, session.user.id))
      .orderBy(desc(chatSession.updatedAt));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[API GET /api/chat/sessions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const id = body.id || crypto.randomUUID();
    const title = body.title?.trim() || "새로운 대화";

    const [newSession] = await db
      .insert(chatSession)
      .values({
        id,
        userId: session.user.id,
        title,
      })
      .onConflictDoUpdate({
        target: chatSession.id,
        set: {
          title,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ session: newSession }, { status: 201 });
  } catch (error) {
    console.error("[API POST /api/chat/sessions] Error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
