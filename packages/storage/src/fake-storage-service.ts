import {
  normalizeStorageKey,
  type PresignedDownloadParams,
  type PresignedUploadParams,
  type PresignedUploadResult,
  type StorageService,
} from "./storage-service";

export interface StoredFakeObject {
  key: string;
  mimeType: string;
  sizeBytes?: number;
}

export class FakeStorageService implements StorageService {
  public objects: Map<string, StoredFakeObject> = new Map();
  public deletedKeys: string[] = [];
  public baseUrl: string;

  constructor(baseUrl = "http://fake-storage.local") {
    this.baseUrl = baseUrl;
  }

  async generatePresignedUploadUrl(
    params: PresignedUploadParams
  ): Promise<PresignedUploadResult> {
    const key = normalizeStorageKey(params.key);
    const uploadUrl = `${this.baseUrl}/upload/${key}?expires=${params.expiresInSeconds || 900}`;
    const downloadUrl = `${this.baseUrl}/files/${key}`;

    this.objects.set(key, {
      key,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
    });

    return {
      uploadUrl,
      downloadUrl,
      key,
      expiresInSeconds: params.expiresInSeconds || 900,
    };
  }

  async generatePresignedDownloadUrl(
    params: PresignedDownloadParams
  ): Promise<string> {
    const key = normalizeStorageKey(params.key);
    return `${this.baseUrl}/files/${key}?expires=${params.expiresInSeconds || 3600}`;
  }

  async deleteObject(key: string): Promise<boolean> {
    const normalizedKey = normalizeStorageKey(key);
    this.deletedKeys.push(normalizedKey);
    return this.objects.delete(normalizedKey);
  }
}
