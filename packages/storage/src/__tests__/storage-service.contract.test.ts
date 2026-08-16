import { describe, it, expect, beforeEach, vi } from "vitest";
import { FakeStorageService } from "../fake-storage-service";
import { MinioStorageService } from "../minio-storage-service";
import { normalizeStorageKey } from "../storage-service";
import { buildArtifactStorageKey } from "../index";
import * as presigner from "@aws-sdk/s3-request-presigner";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockImplementation((_client, command, options) => {
    const key = (command as any)?.input?.Key || "unknown";
    return Promise.resolve(`https://s3.mocked.url/${key}?expires=${options?.expiresIn}`);
  }),
}));

describe("StorageService Port Contract Tests", () => {
  it("normalizes leading slashes correctly", () => {
    expect(normalizeStorageKey("path/to/file.txt")).toBe("path/to/file.txt");
    expect(normalizeStorageKey("/path/to/file.txt")).toBe("path/to/file.txt");
    expect(normalizeStorageKey("///path/to/file.txt")).toBe("path/to/file.txt");
  });

  it("builds artifact storage keys correctly", () => {
    expect(buildArtifactStorageKey("sess-1", "chart.png")).toBe("artifacts/sessions/sess-1/chart.png");
    expect(buildArtifactStorageKey("sess-1", "chart.png", "msg-123")).toBe("artifacts/sessions/sess-1/msg-123/chart.png");
    expect(buildArtifactStorageKey("sess-1", "/nested/report.pdf", "msg-456")).toBe("artifacts/sessions/sess-1/msg-456/nested/report.pdf");
  });

  describe("FakeStorageService (@repo/storage in-memory double)", () => {
    let storage: FakeStorageService;

    beforeEach(() => {
      storage = new FakeStorageService("https://cdn.example.com");
    });

    it("generates presigned upload URL and records object metadata", async () => {
      const result = await storage.generatePresignedUploadUrl({
        key: "attachments/user-1/doc.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        expiresInSeconds: 600,
      });

      expect(result.uploadUrl).toContain("https://cdn.example.com/upload/attachments/user-1/doc.pdf");
      expect(result.uploadUrl).toContain("expires=600");
      expect(result.downloadUrl).toBe("https://cdn.example.com/files/attachments/user-1/doc.pdf");
      expect(result.key).toBe("attachments/user-1/doc.pdf");
      expect(result.expiresInSeconds).toBe(600);

      expect(storage.objects.has("attachments/user-1/doc.pdf")).toBe(true);
      const stored = storage.objects.get("attachments/user-1/doc.pdf");
      expect(stored?.mimeType).toBe("application/pdf");
      expect(stored?.sizeBytes).toBe(1024);
    });

    it("generates presigned download URL with expiration query", async () => {
      const downloadUrl = await storage.generatePresignedDownloadUrl({
        key: "/attachments/user-1/image.png",
        expiresInSeconds: 3600,
      });

      expect(downloadUrl).toBe("https://cdn.example.com/files/attachments/user-1/image.png?expires=3600");
    });

    it("handles deleteObject and records deletion history", async () => {
      await storage.generatePresignedUploadUrl({
        key: "attachments/temp.txt",
        mimeType: "text/plain",
      });

      expect(storage.objects.has("attachments/temp.txt")).toBe(true);

      const deleted = await storage.deleteObject("attachments/temp.txt");
      expect(deleted).toBe(true);
      expect(storage.objects.has("attachments/temp.txt")).toBe(false);
      expect(storage.deletedKeys).toContain("attachments/temp.txt");
    });
  });

  describe("MinioStorageService with Mocked S3 SDK", () => {
    let mockClient: any;
    let minio: MinioStorageService;

    beforeEach(() => {
      mockClient = {
        send: vi.fn().mockResolvedValue({}),
      };
      minio = new MinioStorageService({
        client: mockClient,
        bucket: "test-bucket",
      });
    });

    it("generates presigned upload URL and invokes getSignedUrl", async () => {
      const result = await minio.generatePresignedUploadUrl({
        key: "/attachments/test/file.png",
        mimeType: "image/png",
        expiresInSeconds: 900,
      });

      expect(result.uploadUrl).toBe("https://s3.mocked.url/attachments/test/file.png?expires=900");
      expect(result.downloadUrl).toBe("https://s3.mocked.url/attachments/test/file.png?expires=604800");
      expect(result.key).toBe("attachments/test/file.png");
      expect(result.expiresInSeconds).toBe(900);
      expect(presigner.getSignedUrl).toHaveBeenCalled();
    });

    it("generates presigned download URL with custom TTL", async () => {
      const url = await minio.generatePresignedDownloadUrl({
        key: "attachments/test/file.png",
        expiresInSeconds: 1800,
      });

      expect(url).toBe("https://s3.mocked.url/attachments/test/file.png?expires=1800");
    });

    it("delegates deleteObject to S3 DeleteObjectCommand", async () => {
      const deleted = await minio.deleteObject("/attachments/sample.csv");
      expect(deleted).toBe(true);
      expect(mockClient.send).toHaveBeenCalledTimes(1);
    });
  });
});
