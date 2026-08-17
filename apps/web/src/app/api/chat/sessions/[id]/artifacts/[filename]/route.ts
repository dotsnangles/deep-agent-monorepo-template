import { NextRequest, NextResponse } from "next/server";
import { chatRepository } from "@repo/db";
import { getStorageService } from "@repo/storage";
import { getAuthenticatedUserId } from "../../../../_lib/auth-helper";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId, filename } = await params;
    const decodedFilename = decodeURIComponent(filename);

    const session = await chatRepository.getSession(sessionId, userId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or unauthorized" },
        { status: 404 }
      );
    }

    const artifacts = await chatRepository.getArtifactsBySession(sessionId);
    const targetArtifact = artifacts.find(
      (a) => a.name === decodedFilename || a.id === decodedFilename
    );

    if (!targetArtifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    const storageService = getStorageService();
    const downloadUrl = await storageService.generatePresignedDownloadUrl({
      key: targetArtifact.storageKey,
      expiresInSeconds: 300, // 5 minutes fresh signature
    });

    return NextResponse.redirect(downloadUrl, 302);
  } catch (error) {
    console.error("[API GET /api/chat/sessions/:id/artifacts/:filename] Error:", error);
    return NextResponse.json(
      { error: "Failed to download artifact" },
      { status: 500 }
    );
  }
}
