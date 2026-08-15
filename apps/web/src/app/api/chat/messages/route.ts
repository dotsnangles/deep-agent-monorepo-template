import { NextRequest, NextResponse } from "next/server";
import { auth } from "@repo/auth";
import { db, chatSession, chatMessage } from "@repo/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import {
  type MessageNode,
  traverseActivePath,
  pruneSubtree,
  findNewActiveLeafAfterPrune,
} from "@/features/chat/lib/tree";

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Check session ownership
    const [sessionRecord] = await db
      .select()
      .from(chatSession)
      .where(
        and(
          eq(chatSession.id, sessionId),
          eq(chatSession.userId, session.user.id)
        )
      )
      .limit(1);

    if (!sessionRecord) {
      return NextResponse.json({
        sessionId,
        activeLeafId: null,
        messages: [],
        activePath: [],
      });
    }

    const messages = await db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.sessionId, sessionId))
      .orderBy(asc(chatMessage.createdAt));

    const nodes: MessageNode[] = messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      parentId: m.parentId,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      createdAt: m.createdAt,
    }));

    const activePath = traverseActivePath(nodes, sessionRecord.activeLeafId);

    return NextResponse.json({
      sessionId,
      activeLeafId: sessionRecord.activeLeafId,
      messages: nodes,
      activePath,
    });
  } catch (error) {
    console.error("[API GET /api/chat/messages] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
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
    const { sessionId, parentId = null, role, content, id } = body;

    if (!sessionId || !role || typeof content !== "string") {
      return NextResponse.json(
        { error: "sessionId, role, and content are required" },
        { status: 400 }
      );
    }

    const messageId = id || crypto.randomUUID();

    // Ensure session exists or create it lazily
    await db
      .insert(chatSession)
      .values({
        id: sessionId,
        userId: session.user.id,
        title: content.slice(0, 30).trim() || "새로운 대화",
        activeLeafId: messageId,
      })
      .onConflictDoUpdate({
        target: chatSession.id,
        set: {
          activeLeafId: messageId,
          updatedAt: new Date(),
        },
      });

    const [newMessage] = await db
      .insert(chatMessage)
      .values({
        id: messageId,
        sessionId,
        parentId: parentId || null,
        role,
        content,
      })
      .returning();

    return NextResponse.json(
      {
        message: newMessage,
        activeLeafId: messageId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API POST /api/chat/messages] Error:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { sessionId, activeLeafId } = body;

    if (!sessionId || !activeLeafId) {
      return NextResponse.json(
        { error: "sessionId and activeLeafId are required" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(chatSession)
      .set({
        activeLeafId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(chatSession.id, sessionId),
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

    return NextResponse.json({ success: true, activeLeafId });
  } catch (error) {
    console.error("[API PATCH /api/chat/messages] Error:", error);
    return NextResponse.json(
      { error: "Failed to update active leaf" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { sessionId, messageId } = body;

    if (!sessionId || !messageId) {
      return NextResponse.json(
        { error: "sessionId and messageId are required" },
        { status: 400 }
      );
    }

    // Verify session ownership
    const [sessionRecord] = await db
      .select()
      .from(chatSession)
      .where(
        and(
          eq(chatSession.id, sessionId),
          eq(chatSession.userId, session.user.id)
        )
      )
      .limit(1);

    if (!sessionRecord) {
      return NextResponse.json(
        { error: "Session not found or unauthorized" },
        { status: 404 }
      );
    }

    const allMessages = await db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.sessionId, sessionId))
      .orderBy(asc(chatMessage.createdAt));

    const nodes: MessageNode[] = allMessages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      parentId: m.parentId,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      createdAt: m.createdAt,
    }));

    const targetNode = nodes.find((n) => n.id === messageId);
    if (!targetNode) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    const { remainingNodes, deletedIds } = pruneSubtree(nodes, messageId);

    if (deletedIds.length > 0) {
      await db
        .delete(chatMessage)
        .where(inArray(chatMessage.id, deletedIds));
    }

    const newActiveLeafId = findNewActiveLeafAfterPrune(
      remainingNodes,
      targetNode.parentId
    );

    await db
      .update(chatSession)
      .set({
        activeLeafId: newActiveLeafId,
        updatedAt: new Date(),
      })
      .where(eq(chatSession.id, sessionId));

    return NextResponse.json({
      success: true,
      deletedIds,
      activeLeafId: newActiveLeafId,
    });
  } catch (error) {
    console.error("[API DELETE /api/chat/messages] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete message subtree" },
      { status: 500 }
    );
  }
}
