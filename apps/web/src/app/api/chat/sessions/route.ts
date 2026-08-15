import { NextRequest, NextResponse } from "next/server";
import { chatRepository } from "@repo/db";
import { createChatSessionSchema } from "@repo/validators";
import { getAuthenticatedUserId } from "../_lib/auth-helper";

export async function GET(_req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await chatRepository.getSessions(userId);
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
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = createChatSessionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id = crypto.randomUUID(), title } = parseResult.data;

    const newSession = await chatRepository.createSession({
      id,
      userId,
      title,
    });

    return NextResponse.json({ session: newSession }, { status: 201 });
  } catch (error) {
    console.error("[API POST /api/chat/sessions] Error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
