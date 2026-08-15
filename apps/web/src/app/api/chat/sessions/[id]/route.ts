import { NextRequest, NextResponse } from "next/server";
import { chatRepository } from "@repo/db";
import { patchChatSessionSchema } from "@repo/validators";
import { getAuthenticatedUserId } from "../../_lib/auth-helper";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = patchChatSessionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { title } = parseResult.data;

    const updated = await chatRepository.updateSessionTitle(id, userId, title);

    if (!updated) {
      return NextResponse.json(
        { error: "Session not found or unauthorized" },
        { status: 404 }
      );
    }

    const updatedSession = await chatRepository.getSession(id, userId);
    return NextResponse.json({ session: updatedSession });
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
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deleted = await chatRepository.deleteSession(id, userId);

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
