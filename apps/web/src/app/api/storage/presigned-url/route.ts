import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getStorageService } from "@repo/storage";
import { presignedUploadRequestSchema } from "@repo/validators";

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = presignedUploadRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { filename, mimeType, sizeBytes, sessionId } = parseResult.data;
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const attachmentId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionFolder = sessionId ? sessionId.replace(/[^a-zA-Z0-9_-]/g, "_") : "global";
    const s3Key = `attachments/${session.user.id}/${sessionFolder}/${attachmentId}_${sanitizedFilename}`;

    const storageService = getStorageService();
    const result = await storageService.generatePresignedUploadUrl({
      key: s3Key,
      mimeType,
      sizeBytes,
      expiresInSeconds: 900, // 15 minutes
    });

    return NextResponse.json({
      id: attachmentId,
      uploadUrl: result.uploadUrl,
      downloadUrl: result.downloadUrl,
      key: result.key,
      name: filename,
      mimeType,
      size: sizeBytes,
      expiresInSeconds: result.expiresInSeconds,
    });
  } catch (error) {
    console.error("[API POST /api/storage/presigned-url] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate presigned upload URL" },
      { status: 500 }
    );
  }
}
