import { NextRequest, NextResponse } from "next/server";
import { chatRepository } from "@repo/db";
import {
  createChatMessageSchema,
  patchChatLeafSchema,
  deleteChatMessageSchema,
} from "@repo/validators";
import { generateSmartTitleInBackground } from "@/features/chat/server";
import { getAuthenticatedUserId } from "../_lib/auth-helper";

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
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

    const tree = await chatRepository.getTree(sessionId, userId);

    if (!tree) {
      return NextResponse.json({
        sessionId,
        activeLeafId: null,
        messages: [],
        activePath: [],
      });
    }

    return NextResponse.json({
      sessionId: tree.sessionId,
      activeLeafId: tree.activeLeafId,
      messages: tree.messages,
      activePath: tree.activePath,
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
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = createChatMessageSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, parentId = null, role, content, attachments, id } = parseResult.data;

    const result = await chatRepository.saveMessage(
      {
        id,
        sessionId,
        parentId: parentId || null,
        role,
        content,
        attachments,
      },
      userId
    );

    if (!result) {
      return NextResponse.json(
        { error: "Unauthorized or session belongs to another user" },
        { status: 403 }
      );
    }

    // Trigger smart title generation in background if first user message
    if ((result.isNewSession || !parentId) && role === "user") {
      generateSmartTitleInBackground(sessionId, content);
    }

    return NextResponse.json(
      {
        message: result.message,
        activeLeafId: result.session.activeLeafId,
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
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = patchChatLeafSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, activeLeafId } = parseResult.data;

    const updated = await chatRepository.updateSessionActiveLeaf(
      sessionId,
      userId,
      activeLeafId
    );

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
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = deleteChatMessageSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, messageId } = parseResult.data;

    const result = await chatRepository.deleteSubtree(sessionId, messageId, userId);

    if (!result) {
      return NextResponse.json(
        { error: "Message or session not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedIds: result.deletedIds,
      activeLeafId: result.activeLeafId,
    });
  } catch (error) {
    console.error("[API DELETE /api/chat/messages] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete message subtree" },
      { status: 500 }
    );
  }
}
