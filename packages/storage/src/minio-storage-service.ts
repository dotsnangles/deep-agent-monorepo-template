import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@repo/env/server";
import {
  normalizeStorageKey,
  type PresignedDownloadParams,
  type PresignedUploadParams,
  type PresignedUploadResult,
  type StorageService,
} from "./storage-service";

export interface MinioStorageConfig {
  client?: S3Client;
  bucket?: string;
}

export class MinioStorageService implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor(config?: MinioStorageConfig) {
    if (config?.client) {
      this.client = config.client;
    } else {
      const isSSL = env.MINIO_USE_SSL === "true";
      const endpoint = `${isSSL ? "https" : "http"}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;
      this.client = new S3Client({
        endpoint,
        region: "us-east-1",
        credentials: {
          accessKeyId: env.MINIO_ACCESS_KEY,
          secretAccessKey: env.MINIO_SECRET_KEY,
        },
        forcePathStyle: true,
      });
    }
    this.bucket = config?.bucket || env.MINIO_BUCKET_NAME;
  }

  async generatePresignedUploadUrl(
    params: PresignedUploadParams
  ): Promise<PresignedUploadResult> {
    const key = normalizeStorageKey(params.key);
    const expiresIn = params.expiresInSeconds || 900; // 15 min default

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: params.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const downloadUrl = await this.generatePresignedDownloadUrl({
      key,
      expiresInSeconds: 86400 * 7,
    });

    return {
      uploadUrl,
      downloadUrl,
      key,
      expiresInSeconds: expiresIn,
    };
  }

  async generatePresignedDownloadUrl(
    params: PresignedDownloadParams
  ): Promise<string> {
    const key = normalizeStorageKey(params.key);
    const expiresIn = params.expiresInSeconds || 86400 * 7; // 7 days default

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteObject(key: string): Promise<boolean> {
    try {
      const normalizedKey = normalizeStorageKey(key);
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: normalizedKey,
      });
      await this.client.send(command);
      return true;
    } catch (err) {
      console.error(`[MinioStorageService] Failed to delete object '${key}':`, err);
      return false;
    }
  }
}
