import { NextRequest, NextResponse } from "next/server";
import { chatRepository } from "@repo/db";
import { forkChatSessionSchema } from "@repo/validators";
import { getAuthenticatedUserId } from "../../../_lib/auth-helper";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = forkChatSessionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { fromMessageId, title } = parseResult.data;

    const result = await chatRepository.forkSession(id, fromMessageId, userId, title);

    if (!result) {
      return NextResponse.json(
        { error: "Session or message not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        session: result.session,
        messages: result.messages,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API POST /api/chat/sessions/[id]/fork] Error:", error);
    return NextResponse.json(
      { error: "Failed to fork session" },
      { status: 500 }
    );
  }
}
