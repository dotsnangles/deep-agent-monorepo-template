import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@repo/env/server";

const isSSL = env.MINIO_USE_SSL === "true";
const endpoint = `${isSSL ? "https" : "http"}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;

export const s3Client = new S3Client({
  endpoint,
  region: "us-east-1", // Default region for MinIO
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

export const defaultBucket = env.MINIO_BUCKET_NAME;

export async function getPresignedUploadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: defaultBucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: defaultBucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}
