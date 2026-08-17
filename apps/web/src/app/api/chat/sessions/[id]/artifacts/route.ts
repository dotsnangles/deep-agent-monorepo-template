import { NextRequest, NextResponse } from "next/server";
import { chatRepository } from "@repo/db";
import { getAuthenticatedUserId } from "../../../_lib/auth-helper";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const session = await chatRepository.getSession(sessionId, userId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or unauthorized" },
        { status: 404 }
      );
    }

    const rawArtifacts = await chatRepository.getArtifactsBySession(sessionId);
    const artifacts = rawArtifacts.map((art) => ({
      ...art,
      downloadUrl: `/api/chat/sessions/${sessionId}/artifacts/${encodeURIComponent(art.name)}`,
    }));

    return NextResponse.json({ artifacts });
  } catch (error) {
    console.error("[API GET /api/chat/sessions/:id/artifacts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch artifacts" },
      { status: 500 }
    );
  }
}
