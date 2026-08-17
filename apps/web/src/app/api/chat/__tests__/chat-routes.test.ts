import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sessionsRoute from "../sessions/route";
import * as sessionIdRoute from "../sessions/[id]/route";
import * as forkRoute from "../sessions/[id]/fork/route";
import * as messagesRoute from "../messages/route";
import * as streamRoute from "../stream/route";
import { auth } from "@repo/auth";

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

vi.mock("@/features/chat/server", () => ({
  generateSmartTitleInBackground: vi.fn(),
}));

describe("Zero-DB Chat API Route Handlers Integration", () => {
  const TEST_USER = {
    user: {
      id: "usr_mock_123",
      email: "test@example.com",
    },
  };

  beforeEach(() => {
    hoisted.fakeRepo.clear();
    vi.mocked(auth.api.getSession).mockResolvedValue(TEST_USER as any);
  });

  describe("/api/chat/sessions (GET, POST)", () => {
    it("returns 401 Unauthorized when user is not authenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null as any);

      const req = new NextRequest("http://localhost:3000/api/chat/sessions");
      const res = await sessionsRoute.GET(req);
      expect(res.status).toBe(401);
    });

    it("creates and lists chat sessions", async () => {
      const createReq = new NextRequest("http://localhost:3000/api/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ id: "sess-api-1", title: "API Created Chat" }),
      });
      const createRes = await sessionsRoute.POST(createReq);
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      expect(createData.session.id).toBe("sess-api-1");
      expect(createData.session.title).toBe("API Created Chat");

      const getReq = new NextRequest("http://localhost:3000/api/chat/sessions");
      const getRes = await sessionsRoute.GET(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.sessions).toHaveLength(1);
      expect(getData.sessions[0].id).toBe("sess-api-1");
    });
  });

  describe("/api/chat/sessions/[id] (PATCH, DELETE)", () => {
    it("returns 400 when PATCH title is invalid or empty", async () => {
      const patchReq = new NextRequest("http://localhost:3000/api/chat/sessions/sess-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "" }),
      });
      const patchRes = await sessionIdRoute.PATCH(patchReq, {
        params: Promise.resolve({ id: "sess-1" }),
      });
      expect(patchRes.status).toBe(400);
      const data = await patchRes.json();
      expect(data.error).toBe("Validation failed");
    });

    it("renames and deletes an existing session", async () => {
      await hoisted.fakeRepo.createSession({
        id: "sess-edit",
        userId: TEST_USER.user.id,
        title: "Old Title",
      });

      const patchReq = new NextRequest("http://localhost:3000/api/chat/sessions/sess-edit", {
        method: "PATCH",
        body: JSON.stringify({ title: "New Title" }),
      });
      const patchRes = await sessionIdRoute.PATCH(patchReq, {
        params: Promise.resolve({ id: "sess-edit" }),
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.session.title).toBe("New Title");

      const deleteReq = new NextRequest("http://localhost:3000/api/chat/sessions/sess-edit", {
        method: "DELETE",
      });
      const deleteRes = await sessionIdRoute.DELETE(deleteReq, {
        params: Promise.resolve({ id: "sess-edit" }),
      });
      expect(deleteRes.status).toBe(200);
      const deleteData = await deleteRes.json();
      expect(deleteData.success).toBe(true);

      const verifyDeleted = await hoisted.fakeRepo.getSession("sess-edit", TEST_USER.user.id);
      expect(verifyDeleted).toBeNull();
    });

    it("returns 404 when updating non-existent session", async () => {
      const patchReq = new NextRequest("http://localhost:3000/api/chat/sessions/sess-missing", {
        method: "PATCH",
        body: JSON.stringify({ title: "Valid Title" }),
      });
      const patchRes = await sessionIdRoute.PATCH(patchReq, {
        params: Promise.resolve({ id: "sess-missing" }),
      });
      expect(patchRes.status).toBe(404);
    });
  });

  describe("/api/chat/messages (GET, POST, PATCH, DELETE)", () => {
    it("returns 400 on invalid POST/PATCH/DELETE payloads", async () => {
      // POST invalid schema (missing content & role)
      const invalidPost = new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({ sessionId: "s1" }),
      });
      const postRes = await messagesRoute.POST(invalidPost);
      expect(postRes.status).toBe(400);

      // PATCH invalid schema (missing activeLeafId)
      const invalidPatch = new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "PATCH",
        body: JSON.stringify({ sessionId: "s1" }),
      });
      const patchRes = await messagesRoute.PATCH(invalidPatch);
      expect(patchRes.status).toBe(400);

      // DELETE invalid schema (missing messageId)
      const invalidDelete = new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "DELETE",
        body: JSON.stringify({ sessionId: "s1" }),
      });
      const deleteRes = await messagesRoute.DELETE(invalidDelete);
      expect(deleteRes.status).toBe(400);
    });

    it("persists message attachments via POST and returns them in tree query", async () => {
      const postReq = new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          id: "m-att-1",
          sessionId: "sess-att-test",
          role: "user",
          content: "See attachment",
          attachments: [
            {
              id: "att_1",
              name: "spec.pdf",
              url: "https://s3.example.com/spec.pdf",
              mimeType: "application/pdf",
              size: 2048,
              s3Key: "attachments/spec.pdf",
            },
          ],
        }),
      });

      const postRes = await messagesRoute.POST(postReq);
      expect(postRes.status).toBe(201);
      const postData = await postRes.json();
      expect(postData.message.attachments).toHaveLength(1);
      expect(postData.message.attachments[0].name).toBe("spec.pdf");

      const getTreeReq = new NextRequest(
        "http://localhost:3000/api/chat/messages?sessionId=sess-att-test"
      );
      const getTreeRes = await messagesRoute.GET(getTreeReq);
      const treeData = await getTreeRes.json();
      expect(treeData.messages[0].attachments).toHaveLength(1);
      expect(treeData.messages[0].attachments[0].name).toBe("spec.pdf");
    });

    it("performs full tree lifecycle: save -> active leaf switch -> prune", async () => {
      // 1. Send first message in lazy session
      const postUserReq = new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          id: "m-user-1",
          sessionId: "sess-tree-1",
          role: "user",
          content: "Calculate 10 * 10",
        }),
      });
      const postUserRes = await messagesRoute.POST(postUserReq);
      expect(postUserRes.status).toBe(201);
      const postUserData = await postUserRes.json();
      expect(postUserData.message.id).toBe("m-user-1");
      expect(postUserData.activeLeafId).toBe("m-user-1");

      // 2. Save assistant response
      const postAsstReq = new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          id: "m-asst-1",
          sessionId: "sess-tree-1",
          parentId: "m-user-1",
          role: "assistant",
          content: "100",
        }),
      });
      const postAsstRes = await messagesRoute.POST(postAsstReq);
      expect(postAsstRes.status).toBe(201);

      // 3. GET tree
      const getTreeReq = new NextRequest("http://localhost:3000/api/chat/messages?sessionId=sess-tree-1");
      const getTreeRes = await messagesRoute.GET(getTreeReq);
      expect(getTreeRes.status).toBe(200);
      const treeData = await getTreeRes.json();
      expect(treeData.messages).toHaveLength(2);
      expect(treeData.activePath.map((m: any) => m.id)).toEqual(["m-user-1", "m-asst-1"]);

      // 4. Switch active leaf
      const patchLeafReq = new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "PATCH",
        body: JSON.stringify({
          sessionId: "sess-tree-1",
          activeLeafId: "m-user-1",
        }),
      });
      const patchLeafRes = await messagesRoute.PATCH(patchLeafReq);
      expect(patchLeafRes.status).toBe(200);

      // 5. Delete subtree
      const deleteReq = new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "DELETE",
        body: JSON.stringify({
          sessionId: "sess-tree-1",
          messageId: "m-asst-1",
        }),
      });
      const deleteRes = await messagesRoute.DELETE(deleteReq);
      expect(deleteRes.status).toBe(200);
      const deleteData = await deleteRes.json();
      expect(deleteData.deletedIds).toContain("m-asst-1");
    });

    it("triggers smart title generation when first user message is saved in a pre-created session", async () => {
      const { generateSmartTitleInBackground } = await import("@/features/chat/server");

      // 1. Session was pre-created by client heuristic on initial send
      await hoisted.fakeRepo.createSession({
        id: "sess-precreated",
        userId: TEST_USER.user.id,
        title: "파이썬으로 최적화된 피보나치",
      });

      // 2. First user message arrives with parentId: null (or undefined)
      const postReq = new NextRequest("http://localhost:3000/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          id: "m-user-root",
          sessionId: "sess-precreated",
          role: "user",
          content: "파이썬으로 최적화된 피보나치 수열 생성 함수를 작성하고 시간 복잡도를 설명해줘.",
        }),
      });

      const postRes = await messagesRoute.POST(postReq);
      expect(postRes.status).toBe(201);

      expect(generateSmartTitleInBackground).toHaveBeenCalledWith(
        "sess-precreated",
        "파이썬으로 최적화된 피보나치 수열 생성 함수를 작성하고 시간 복잡도를 설명해줘."
      );
    });
  });

  describe("/api/chat/sessions/[id]/fork (POST)", () => {
    it("returns 401 when unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null as any);

      const req = new NextRequest("http://localhost:3000/api/chat/sessions/s1/fork", {
        method: "POST",
        body: JSON.stringify({ fromMessageId: "m1" }),
      });
      const res = await forkRoute.POST(req, {
        params: Promise.resolve({ id: "s1" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 400 when fromMessageId is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/chat/sessions/s1/fork", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await forkRoute.POST(req, {
        params: Promise.resolve({ id: "s1" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Validation failed");
    });

    it("returns 404 when session or target message is not found", async () => {
      const req = new NextRequest("http://localhost:3000/api/chat/sessions/non-existent/fork", {
        method: "POST",
        body: JSON.stringify({ fromMessageId: "m1" }),
      });
      const res = await forkRoute.POST(req, {
        params: Promise.resolve({ id: "non-existent" }),
      });
      expect(res.status).toBe(404);
    });

    it("successfully forks session and returns 201 with cloned messages", async () => {
      await hoisted.fakeRepo.createSession({
        id: "sess-source",
        userId: TEST_USER.user.id,
        title: "Source Session",
      });
      await hoisted.fakeRepo.saveMessage(
        { id: "msg-1", sessionId: "sess-source", parentId: null, role: "user", content: "Prompt 1" },
        TEST_USER.user.id
      );
      await hoisted.fakeRepo.saveMessage(
        { id: "msg-2", sessionId: "sess-source", parentId: "msg-1", role: "assistant", content: "Response 1" },
        TEST_USER.user.id
      );
      await hoisted.fakeRepo.saveMessage(
        { id: "msg-3", sessionId: "sess-source", parentId: "msg-2", role: "user", content: "Prompt 2" },
        TEST_USER.user.id
      );

      const req = new NextRequest("http://localhost:3000/api/chat/sessions/sess-source/fork", {
        method: "POST",
        body: JSON.stringify({
          fromMessageId: "msg-2",
          title: "Forked Chat",
        }),
      });
      const res = await forkRoute.POST(req, {
        params: Promise.resolve({ id: "sess-source" }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.session.id).toBeDefined();
      expect(data.session.id).not.toBe("sess-source");
      expect(data.session.title).toBe("Forked Chat");
      expect(data.messages).toHaveLength(2);
      expect(data.messages[0].content).toBe("Prompt 1");
      expect(data.messages[1].content).toBe("Response 1");
    });
  });

  describe("/api/chat/stream (POST)", () => {
    it("returns 401 when user is not authenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null as any);

      const req = new NextRequest("http://localhost:3000/api/chat/stream", {
        method: "POST",
        body: JSON.stringify({ threadId: "t1", messages: [] }),
      });
      const res = await streamRoute.POST(req);
      expect(res.status).toBe(401);
    });

    it("forwards userId from session to agent server request payload", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response("event: token\ndata: {}\n\n", {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      );
      vi.stubGlobal("fetch", mockFetch);

      const req = new NextRequest("http://localhost:3000/api/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          threadId: "sess-stream-1",
          messages: [{ role: "user", content: "Test prompt" }],
        }),
      });

      const res = await streamRoute.POST(req);
      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain("/chat/stream");
      const parsedBody = JSON.parse(calledOptions.body);
      expect(parsedBody.threadId).toBe("sess-stream-1");
      expect(parsedBody.userId).toBe(TEST_USER.user.id);
      expect(parsedBody.messages[0].content).toBe("Test prompt");

      vi.unstubAllGlobals();
    });
  });
});

