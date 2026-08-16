export interface PresignedUploadParams {
  key: string;
  mimeType: string;
  sizeBytes?: number;
  expiresInSeconds?: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  downloadUrl: string;
  key: string;
  expiresInSeconds: number;
}

export interface PresignedDownloadParams {
  key: string;
  expiresInSeconds?: number;
}

export interface StorageService {
  generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult>;
  generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<string>;
  deleteObject(key: string): Promise<boolean>;
}

export function normalizeStorageKey(key: string): string {
  return key.replace(/^\/+/, "");
}
