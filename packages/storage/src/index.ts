import { MinioStorageService } from "./minio-storage-service";
import type { StorageService } from "./storage-service";

export * from "./storage-service";
export * from "./fake-storage-service";
export * from "./minio-storage-service";

let globalStorageService: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!globalStorageService) {
    globalStorageService = new MinioStorageService();
  }
  return globalStorageService;
}

export function setStorageService(service: StorageService | null): void {
  globalStorageService = service;
}

export async function getPresignedUploadUrl(
  key: string,
  expiresInSeconds = 3600,
  mimeType = "application/octet-stream"
): Promise<string> {
  const result = await getStorageService().generatePresignedUploadUrl({
    key,
    mimeType,
    expiresInSeconds,
  });
  return result.uploadUrl;
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  return getStorageService().generatePresignedDownloadUrl({
    key,
    expiresInSeconds,
  });
}

export function buildArtifactStorageKey(
  sessionId: string,
  filename: string,
  messageId?: string | null
): string {
  const cleanName = filename.replace(/^\/+/, "");
  if (messageId) {
    return `artifacts/sessions/${sessionId}/${messageId}/${cleanName}`;
  }
  return `artifacts/sessions/${sessionId}/${cleanName}`;
}
