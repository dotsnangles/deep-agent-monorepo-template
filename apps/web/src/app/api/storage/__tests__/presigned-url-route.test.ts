import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as presignedRoute from "../presigned-url/route";
import { auth } from "@repo/auth";
import { FakeStorageService, setStorageService } from "@repo/storage";

vi.mock("@repo/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe("Storage Presigned URL Route Handler (/api/storage/presigned-url)", () => {
  const TEST_USER = {
    user: {
      id: "usr_storage_test",
      email: "storage@example.com",
    },
  };

  let fakeStorage: FakeStorageService;

  beforeEach(() => {
    fakeStorage = new FakeStorageService("http://test-storage.local");
    setStorageService(fakeStorage);
    vi.mocked(auth.api.getSession).mockResolvedValue(TEST_USER as any);
  });

  it("returns 401 Unauthorized when user session is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as any);

    const req = new NextRequest("http://localhost:3000/api/storage/presigned-url", {
      method: "POST",
      body: JSON.stringify({
        filename: "test.png",
        mimeType: "image/png",
        sizeBytes: 1024,
      }),
    });

    const res = await presignedRoute.POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when file type is not supported", async () => {
    const req = new NextRequest("http://localhost:3000/api/storage/presigned-url", {
      method: "POST",
      body: JSON.stringify({
        filename: "malicious.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 1024,
      }),
    });

    const res = await presignedRoute.POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("returns 400 when file size exceeds 20MB limit", async () => {
    const req = new NextRequest("http://localhost:3000/api/storage/presigned-url", {
      method: "POST",
      body: JSON.stringify({
        filename: "huge.pdf",
        mimeType: "application/pdf",
        sizeBytes: 25 * 1024 * 1024, // 25MB
      }),
    });

    const res = await presignedRoute.POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("issues presigned upload and download URLs for valid image and document files", async () => {
    const req = new NextRequest("http://localhost:3000/api/storage/presigned-url", {
      method: "POST",
      body: JSON.stringify({
        filename: "architecture diagram.png",
        mimeType: "image/png",
        sizeBytes: 204800,
        sessionId: "sess-123",
      }),
    });

    const res = await presignedRoute.POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toMatch(/^att_\d+_/);
    expect(data.uploadUrl).toContain("http://test-storage.local/upload/attachments/usr_storage_test/sess-123/");
    expect(data.downloadUrl).toContain("http://test-storage.local/files/attachments/usr_storage_test/sess-123/");
    expect(data.name).toBe("architecture diagram.png");
    expect(data.mimeType).toBe("image/png");
    expect(data.size).toBe(204800);
    expect(data.expiresInSeconds).toBe(900);

    // Verify stored object in FakeStorageService
    expect(fakeStorage.objects.has(data.key)).toBe(true);
  });
});
