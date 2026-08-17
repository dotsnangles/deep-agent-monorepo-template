import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as artifactsListRoute from "../sessions/[id]/artifacts/route";
import * as artifactDownloadRoute from "../sessions/[id]/artifacts/[filename]/route";
import { auth } from "@repo/auth";
import { FakeStorageService, setStorageService } from "@repo/storage";

const hoisted = vi.hoisted(() => {
  return { fakeRepo: null as any };
});

vi.mock("@repo/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/db")>();
  const repo = new actual.FakeChatRepository();
  hoisted.fakeRepo = repo;
  return {
    ...actual,
    chatRepository: repo,
  };
});

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

describe("Chat Artifact API Routes", () => {
  const TEST_USER = {
    user: {
      id: "usr_mock_123",
      email: "test@example.com",
    },
  };
  const OTHER_USER = {
    user: {
      id: "usr_other_456",
      email: "other@example.com",
    },
  };

  let fakeStorage: FakeStorageService;

  beforeEach(() => {
    hoisted.fakeRepo.clear();
    fakeStorage = new FakeStorageService("http://test-storage.local");
    setStorageService(fakeStorage);
    vi.mocked(auth.api.getSession).mockResolvedValue(TEST_USER as any);
  });

  describe("GET /api/chat/sessions/[id]/artifacts", () => {
    it("returns 401 when unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null as any);
      const req = new NextRequest("http://localhost:3000/api/chat/sessions/sess-1/artifacts");
      const res = await artifactsListRoute.GET(req, {
        params: Promise.resolve({ id: "sess-1" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when session belongs to another user", async () => {
      await hoisted.fakeRepo.createSession({
        id: "sess-other",
        userId: OTHER_USER.user.id,
        title: "Other Session",
      });

      const req = new NextRequest("http://localhost:3000/api/chat/sessions/sess-other/artifacts");
      const res = await artifactsListRoute.GET(req, {
        params: Promise.resolve({ id: "sess-other" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns artifacts for session with proxy URLs", async () => {
      await hoisted.fakeRepo.createSession({
        id: "sess-mine",
        userId: TEST_USER.user.id,
        title: "My Session",
      });
      await hoisted.fakeRepo.saveArtifact({
        id: "art-1",
        sessionId: "sess-mine",
        name: "summary.txt",
        storageKey: "artifacts/sessions/sess-mine/summary.txt",
        mimeType: "text/plain",
        sizeBytes: 1024,
      });

      const req = new NextRequest("http://localhost:3000/api/chat/sessions/sess-mine/artifacts");
      const res = await artifactsListRoute.GET(req, {
        params: Promise.resolve({ id: "sess-mine" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.artifacts).toHaveLength(1);
      expect(data.artifacts[0].name).toBe("summary.txt");
      expect(data.artifacts[0].downloadUrl).toContain("/api/chat/sessions/sess-mine/artifacts/summary.txt");
    });
  });

  describe("GET /api/chat/sessions/[id]/artifacts/[filename]", () => {
    it("redirects 302 to fresh presigned download URL when artifact exists", async () => {
      await hoisted.fakeRepo.createSession({
        id: "sess-mine",
        userId: TEST_USER.user.id,
        title: "My Session",
      });
      await hoisted.fakeRepo.saveArtifact({
        id: "art-1",
        sessionId: "sess-mine",
        name: "chart.png",
        storageKey: "artifacts/sessions/sess-mine/chart.png",
        mimeType: "image/png",
        sizeBytes: 2048,
      });

      const req = new NextRequest("http://localhost:3000/api/chat/sessions/sess-mine/artifacts/chart.png");
      const res = await artifactDownloadRoute.GET(req, {
        params: Promise.resolve({ id: "sess-mine", filename: "chart.png" }),
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBeDefined();
    });

    it("returns 404 when artifact is not found", async () => {
      await hoisted.fakeRepo.createSession({
        id: "sess-mine",
        userId: TEST_USER.user.id,
        title: "My Session",
      });

      const req = new NextRequest("http://localhost:3000/api/chat/sessions/sess-mine/artifacts/missing.png");
      const res = await artifactDownloadRoute.GET(req, {
        params: Promise.resolve({ id: "sess-mine", filename: "missing.png" }),
      });
      expect(res.status).toBe(404);
    });
  });
});
