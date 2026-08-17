import { describe, it, expect, beforeEach } from "vitest";
import { FakeChatRepository } from "../fake-chat-repository";
import type { ChatRepository } from "../chat-repository";
import type { AttachmentEntity } from "@repo/validators";

describe("ChatRepository Contract Tests (FakeChatRepository)", () => {
  let repo: ChatRepository;
  const USER_A = "user_alpha";
  const USER_B = "user_beta";

  beforeEach(() => {
    repo = new FakeChatRepository();
  });

  describe("Session Management & Multi-Tenant Isolation", () => {
    it("creates and retrieves sessions for the owner", async () => {
      const session = await repo.createSession({
        id: "sess-1",
        userId: USER_A,
        title: "Test Chat",
      });

      expect(session.id).toBe("sess-1");
      expect(session.userId).toBe(USER_A);
      expect(session.title).toBe("Test Chat");

      const fetched = await repo.getSession("sess-1", USER_A);
      expect(fetched).toEqual(session);

      const allA = await repo.getSessions(USER_A);
      expect(allA).toHaveLength(1);
      expect(allA[0].id).toBe("sess-1");
    });

    it("prevents other users from accessing sessions (multi-tenant isolation)", async () => {
      await repo.createSession({
        id: "sess-secret",
        userId: USER_A,
        title: "Alpha Secret",
      });

      const bResult = await repo.getSession("sess-secret", USER_B);
      expect(bResult).toBeNull();

      const bSessions = await repo.getSessions(USER_B);
      expect(bSessions).toHaveLength(0);

      const deletedByB = await repo.deleteSession("sess-secret", USER_B);
      expect(deletedByB).toBe(false);

      // Verify still intact for user A
      const stillThere = await repo.getSession("sess-secret", USER_A);
      expect(stillThere).not.toBeNull();
    });

    it("enforces tenant isolation on saveMessage and deleteSubtree", async () => {
      await repo.createSession({
        id: "sess-protected",
        userId: USER_A,
        title: "Protected Session",
      });
      await repo.saveMessage(
        { id: "m1", sessionId: "sess-protected", role: "user", content: "Secret" },
        USER_A
      );

      // User B cannot save message into User A's session (returns null)
      const saveByB = await repo.saveMessage(
        { id: "m2", sessionId: "sess-protected", role: "user", content: "Infiltrate" },
        USER_B
      );
      expect(saveByB).toBeNull();

      // User B cannot delete subtree in User A's session
      const pruneByB = await repo.deleteSubtree("sess-protected", "m1", USER_B);
      expect(pruneByB).toBeNull();
    });

    it("updates session title and active leaf pointer (including nullable)", async () => {
      await repo.createSession({
        id: "sess-update",
        userId: USER_A,
        title: "Initial Title",
      });

      const updatedTitle = await repo.updateSessionTitle("sess-update", USER_A, "Renamed Title");
      expect(updatedTitle).toBe(true);

      const updatedById = await repo.updateSessionTitleById("sess-update", "System AI Title");
      expect(updatedById).toBe(true);

      const updatedLeaf = await repo.updateSessionActiveLeaf("sess-update", USER_A, "node-123");
      expect(updatedLeaf).toBe(true);

      let session = await repo.getSession("sess-update", USER_A);
      expect(session?.title).toBe("System AI Title");
      expect(session?.activeLeafId).toBe("node-123");

      // Nullable active leaf support
      await repo.updateSessionActiveLeaf("sess-update", USER_A, null);
      session = await repo.getSession("sess-update", USER_A);
      expect(session?.activeLeafId).toBeNull();
    });

    it("deletes session and its associated messages", async () => {
      await repo.createSession({
        id: "sess-del",
        userId: USER_A,
        title: "To Delete",
      });
      await repo.saveMessage(
        {
          id: "m1",
          sessionId: "sess-del",
          role: "user",
          content: "Hello",
        },
        USER_A
      );

      const deleted = await repo.deleteSession("sess-del", USER_A);
      expect(deleted).toBe(true);

      const fetched = await repo.getSession("sess-del", USER_A);
      expect(fetched).toBeNull();

      const tree = await repo.getTree("sess-del", USER_A);
      expect(tree).toBeNull();
    });
  });

  describe("Message Tree Operations, Attachments & Atomic Upsert", () => {
    it("automatically creates a session on first message if not existing (lazy session)", async () => {
      const result = await repo.saveMessage(
        {
          id: "msg-first",
          sessionId: "lazy-sess-1",
          role: "user",
          content: "First message snippet for title",
        },
        USER_A
      );

      expect(result.isNewSession).toBe(true);
      expect(result.message.id).toBe("msg-first");
      expect(result.session.id).toBe("lazy-sess-1");
      expect(result.session.activeLeafId).toBe("msg-first");
      expect(result.session.title).toContain("First message snippet");

      const tree = await repo.getTree("lazy-sess-1", USER_A);
      expect(tree).not.toBeNull();
      expect(tree?.messages).toHaveLength(1);
      expect(tree?.activePath).toHaveLength(1);
    });

    it("persists and retrieves attachments on message nodes", async () => {
      const mockAttachments: AttachmentEntity[] = [
        {
          id: "att-1",
          url: "https://s3.example.com/image.png",
          name: "image.png",
          mimeType: "image/png",
          size: 10240,
          s3Key: "attachments/usr/image.png",
        },
      ];

      const saveResult = await repo.saveMessage(
        {
          id: "u-att",
          sessionId: "sess-att",
          role: "user",
          content: "Please analyze this image",
          attachments: mockAttachments,
        },
        USER_A
      );

      expect(saveResult?.message.attachments).toHaveLength(1);
      expect(saveResult?.message.attachments?.[0].name).toBe("image.png");

      const tree = await repo.getTree("sess-att", USER_A);
      expect(tree?.messages[0].attachments).toHaveLength(1);
      expect(tree?.messages[0].attachments?.[0].name).toBe("image.png");
      expect(tree?.messages[0].attachments?.[0].s3Key).toBe("attachments/usr/image.png");
    });

    it("appends user and assistant messages maintaining tree hierarchy", async () => {
      // 1. User message
      await repo.saveMessage(
        {
          id: "u1",
          sessionId: "tree-sess",
          role: "user",
          content: "What is 2+2?",
        },
        USER_A
      );

      // 2. Assistant message child of u1
      await repo.saveMessage(
        {
          id: "a1",
          sessionId: "tree-sess",
          parentId: "u1",
          role: "assistant",
          content: "4",
        },
        USER_A
      );

      const tree = await repo.getTree("tree-sess", USER_A);
      expect(tree?.messages).toHaveLength(2);
      expect(tree?.activeLeafId).toBe("a1");
      expect(tree?.activePath).toHaveLength(2);
      expect(tree?.activePath.map((m) => m.id)).toEqual(["u1", "a1"]);
    });

    it("supports branch forking and active leaf updates", async () => {
      // Create root branch: u1 -> a1
      await repo.saveMessage({ id: "u1", sessionId: "fork-sess", role: "user", content: "Q1" }, USER_A);
      await repo.saveMessage(
        { id: "a1", sessionId: "fork-sess", parentId: "u1", role: "assistant", content: "A1" },
        USER_A
      );

      // Fork new user branch u2 as sibling of u1 (parentId null)
      await repo.saveMessage({ id: "u2", sessionId: "fork-sess", role: "user", content: "Q1 edited" }, USER_A);
      await repo.saveMessage(
        { id: "a2", sessionId: "fork-sess", parentId: "u2", role: "assistant", content: "A1 edited" },
        USER_A
      );

      let tree = await repo.getTree("fork-sess", USER_A);
      expect(tree?.messages).toHaveLength(4);
      expect(tree?.activeLeafId).toBe("a2");
      expect(tree?.activePath.map((m) => m.id)).toEqual(["u2", "a2"]);

      // Switch active leaf back to a1
      await repo.updateSessionActiveLeaf("fork-sess", USER_A, "a1");
      tree = await repo.getTree("fork-sess", USER_A);
      expect(tree?.activeLeafId).toBe("a1");
      expect(tree?.activePath.map((m) => m.id)).toEqual(["u1", "a1"]);
    });

    it("cascades deletion of an active node and all its descendants while updating active leaf", async () => {
      // Tree: u1 -> a1 -> u2 -> a2
      await repo.saveMessage({ id: "u1", sessionId: "prune-sess", role: "user", content: "Q1" }, USER_A);
      await repo.saveMessage(
        { id: "a1", sessionId: "prune-sess", parentId: "u1", role: "assistant", content: "A1" },
        USER_A
      );
      await repo.saveMessage(
        { id: "u2", sessionId: "prune-sess", parentId: "a1", role: "user", content: "Q2" },
        USER_A
      );
      await repo.saveMessage(
        { id: "a2", sessionId: "prune-sess", parentId: "u2", role: "assistant", content: "A2" },
        USER_A
      );

      // Prune active subtree starting from u2 (should delete u2 and a2)
      const pruneResult = await repo.deleteSubtree("prune-sess", "u2", USER_A);
      expect(pruneResult).not.toBeNull();
      expect(pruneResult?.deletedIds).toContain("u2");
      expect(pruneResult?.deletedIds).toContain("a2");
      expect(pruneResult?.activeLeafId).toBe("a1");

      const tree = await repo.getTree("prune-sess", USER_A);
      expect(tree?.messages).toHaveLength(2);
      expect(tree?.messages.map((m) => m.id)).toEqual(["u1", "a1"]);
      expect(tree?.activeLeafId).toBe("a1");
    });

    it("preserves active leaf pointer when deleting an inactive sibling branch", async () => {
      // Branch 1: u1 -> a1
      await repo.saveMessage({ id: "u1", sessionId: "sibling-sess", role: "user", content: "B1" }, USER_A);
      await repo.saveMessage(
        { id: "a1", sessionId: "sibling-sess", parentId: "u1", role: "assistant", content: "A1" },
        USER_A
      );

      // Branch 2: u2 -> a2 (active)
      await repo.saveMessage({ id: "u2", sessionId: "sibling-sess", role: "user", content: "B2" }, USER_A);
      await repo.saveMessage(
        { id: "a2", sessionId: "sibling-sess", parentId: "u2", role: "assistant", content: "A2" },
        USER_A
      );

      // Active leaf is currently a2
      let tree = await repo.getTree("sibling-sess", USER_A);
      expect(tree?.activeLeafId).toBe("a2");

      // Prune inactive branch u1
      const pruneResult = await repo.deleteSubtree("sibling-sess", "u1", USER_A);
      expect(pruneResult?.deletedIds).toEqual(["u1", "a1"]);
      expect(pruneResult?.activeLeafId).toBe("a2"); // Remains a2!

      tree = await repo.getTree("sibling-sess", USER_A);
      expect(tree?.activeLeafId).toBe("a2");
      expect(tree?.messages.map((m) => m.id)).toEqual(["u2", "a2"]);
    });
  });

  describe("Linear Message Sequence & Session Forking", () => {
    it("retrieves messages in chronological linear order", async () => {
      await repo.createSession({ id: "linear-sess", userId: USER_A, title: "Linear Chat" });
      await repo.saveMessage({ id: "m1", sessionId: "linear-sess", role: "user", content: "Hello" }, USER_A);
      await repo.saveMessage({ id: "m2", sessionId: "linear-sess", role: "assistant", content: "Hi there" }, USER_A);
      await repo.saveMessage({ id: "m3", sessionId: "linear-sess", role: "user", content: "How are you?" }, USER_A);

      const messages = await repo.getMessages("linear-sess", USER_A);
      expect(messages).toHaveLength(3);
      expect(messages?.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
      expect(messages?.[0].content).toBe("Hello");
      expect(messages?.[1].content).toBe("Hi there");
      expect(messages?.[2].content).toBe("How are you?");
    });

    it("forks a session up to a specified message into a new independent session with correct parentId remapping and activeLeafId", async () => {
      await repo.createSession({ id: "orig-sess", userId: USER_A, title: "Original Research" });
      await repo.saveMessage({ id: "m1", sessionId: "orig-sess", parentId: null, role: "user", content: "Step 1" }, USER_A);
      await repo.saveMessage({ id: "m2", sessionId: "orig-sess", parentId: "m1", role: "assistant", content: "Result 1" }, USER_A);
      await repo.saveMessage({ id: "m3", sessionId: "orig-sess", parentId: "m2", role: "user", content: "Step 2" }, USER_A);
      await repo.saveMessage({ id: "m4", sessionId: "orig-sess", parentId: "m3", role: "assistant", content: "Result 2" }, USER_A);

      // Save an artifact attached to m2 in orig-sess
      await repo.saveArtifact({
        id: "art-1",
        sessionId: "orig-sess",
        messageId: "m2",
        name: "summary.txt",
        storageKey: "artifacts/orig-sess/summary.txt",
        mimeType: "text/plain",
      });

      // Fork from message m2 (Step 1 + Result 1)
      const forkResult = await repo.forkSession("orig-sess", "m2", USER_A, "Custom Forked Title");
      expect(forkResult).not.toBeNull();
      expect(forkResult?.session.id).toBeDefined();
      expect(forkResult?.session.id).not.toBe("orig-sess");
      expect(forkResult?.session.userId).toBe(USER_A);
      expect(forkResult?.session.title).toBe("Custom Forked Title");
      expect(forkResult?.messages).toHaveLength(2);
      expect(forkResult?.messages[0].content).toBe("Step 1");
      expect(forkResult?.messages[1].content).toBe("Result 1");
      expect(forkResult?.messages[0].sessionId).toBe(forkResult?.session.id);
      expect(forkResult?.messages[1].sessionId).toBe(forkResult?.session.id);

      // Verify parentId remapping
      const newM1 = forkResult!.messages[0];
      const newM2 = forkResult!.messages[1];
      expect(newM1.parentId).toBeNull();
      expect(newM2.parentId).toBe(newM1.id);
      expect(newM2.parentId).not.toBe("m1"); // MUST NOT point to source session message!

      // Verify session activeLeafId
      const newSession = await repo.getSession(forkResult!.session.id, USER_A);
      expect(newSession?.activeLeafId).toBe(newM2.id);

      // Verify the new session exists independently
      const newSessionMessages = await repo.getMessages(forkResult!.session.id, USER_A);
      expect(newSessionMessages).toHaveLength(2);
      expect(newSessionMessages![0].parentId).toBeNull();
      expect(newSessionMessages![1].parentId).toBe(newSessionMessages![0].id);

      // Verify artifacts are replicated to new session
      const newArtifacts = await repo.getArtifactsBySession(forkResult!.session.id);
      expect(newArtifacts).toHaveLength(1);
      expect(newArtifacts[0].sessionId).toBe(forkResult!.session.id);
      expect(newArtifacts[0].messageId).toBe(newM2.id);
      expect(newArtifacts[0].name).toBe("summary.txt");

      // Verify original session is unchanged
      const origMessages = await repo.getMessages("orig-sess", USER_A);
      expect(origMessages).toHaveLength(4);
    });

    it("replicates user attachments to new session during forkSession", async () => {
      await repo.createSession({ id: "attach-sess", userId: USER_A, title: "Attach Test" });
      await repo.saveMessage({ id: "am-1", sessionId: "attach-sess", parentId: null, role: "user", content: "With file" }, USER_A);
      await repo.saveMessage({ id: "am-2", sessionId: "attach-sess", parentId: "am-1", role: "assistant", content: "Got it" }, USER_A);

      await repo.saveAttachment({
        id: "att-1",
        sessionId: "attach-sess",
        messageId: "am-1",
        userId: USER_A,
        name: "data.csv",
        storageKey: "uploads/data.csv",
        mimeType: "text/csv",
        sizeBytes: 500,
        uploadStatus: "ready",
      });

      const forkResult = await repo.forkSession("attach-sess", "am-2", USER_A);
      expect(forkResult).not.toBeNull();

      const newAttachments = await repo.getAttachmentsBySession(forkResult!.session.id, USER_A);
      expect(newAttachments).toHaveLength(1);
      expect(newAttachments[0].sessionId).toBe(forkResult!.session.id);
      expect(newAttachments[0].messageId).toBe(forkResult!.messages[0].id);
      expect(newAttachments[0].name).toBe("data.csv");
    });

    it("forks from a specific branch in a tree session without including abandoned sibling branches", async () => {
      await repo.createSession({ id: "tree-sess", userId: USER_A, title: "Tree Research" });
      // Root
      await repo.saveMessage({ id: "t-root", sessionId: "tree-sess", parentId: null, role: "user", content: "Prompt 1" }, USER_A);
      // Branch A
      await repo.saveMessage({ id: "t-a1", sessionId: "tree-sess", parentId: "t-root", role: "assistant", content: "Branch A response" }, USER_A);
      await repo.saveMessage({ id: "t-a2", sessionId: "tree-sess", parentId: "t-a1", role: "user", content: "Branch A follow-up" }, USER_A);
      // Branch B (sibling of t-a1 off t-root)
      await repo.saveMessage({ id: "t-b1", sessionId: "tree-sess", parentId: "t-root", role: "assistant", content: "Branch B response" }, USER_A);

      // Fork from Branch B (t-b1)
      const forkResult = await repo.forkSession("tree-sess", "t-b1", USER_A);
      expect(forkResult).not.toBeNull();
      expect(forkResult?.messages).toHaveLength(2);
      expect(forkResult?.messages.map((m) => m.content)).toEqual(["Prompt 1", "Branch B response"]);

      // Verify parentId remapping
      expect(forkResult?.messages[0].parentId).toBeNull();
      expect(forkResult?.messages[1].parentId).toBe(forkResult?.messages[0].id);
    });

    it("prevents unauthorized users from forking other users' sessions", async () => {
      await repo.createSession({ id: "secret-sess", userId: USER_A, title: "Secret" });
      await repo.saveMessage({ id: "s1", sessionId: "secret-sess", role: "user", content: "Confidential" }, USER_A);

      const forkByB = await repo.forkSession("secret-sess", "s1", USER_B);
      expect(forkByB).toBeNull();
    });

    it("returns null if the target message does not exist in the session", async () => {
      await repo.createSession({ id: "valid-sess", userId: USER_A, title: "Valid" });
      await repo.saveMessage({ id: "v1", sessionId: "valid-sess", role: "user", content: "Hello" }, USER_A);

      const forkNonExistent = await repo.forkSession("valid-sess", "non_existent_id", USER_A);
      expect(forkNonExistent).toBeNull();
    });
  });

  describe("Chat Artifact Management", () => {
    it("creates and retrieves artifacts by session and message", async () => {
      await repo.createSession({ id: "sess-art", userId: USER_A, title: "Artifacts Test" });
      await repo.saveMessage({ id: "msg-1", sessionId: "sess-art", role: "assistant", content: "Here is chart" }, USER_A);

      const artifact1 = await repo.saveArtifact({
        id: "art-1",
        sessionId: "sess-art",
        messageId: "msg-1",
        name: "chart.png",
        storageKey: "artifacts/sessions/sess-art/msg-1/chart.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        metadata: { format: "png", dpi: 300 },
      });

      expect(artifact1.id).toBe("art-1");
      expect(artifact1.sessionId).toBe("sess-art");
      expect(artifact1.messageId).toBe("msg-1");
      expect(artifact1.name).toBe("chart.png");
      expect(artifact1.storageKey).toBe("artifacts/sessions/sess-art/msg-1/chart.png");
      expect(artifact1.mimeType).toBe("image/png");
      expect(artifact1.sizeBytes).toBe(1024);
      expect(artifact1.metadata).toEqual({ format: "png", dpi: 300 });

      // Save a second session-level artifact
      const artifact2 = await repo.saveArtifact({
        sessionId: "sess-art",
        name: "data.csv",
        storageKey: "artifacts/sessions/sess-art/data.csv",
        mimeType: "text/csv",
        sizeBytes: 2048,
      });

      expect(artifact2.id).toBeDefined();
      expect(artifact2.messageId).toBeNull();

      // Retrieve by session
      const sessionArtifacts = await repo.getArtifactsBySession("sess-art");
      expect(sessionArtifacts).toHaveLength(2);
      expect(sessionArtifacts.map((a) => a.name)).toEqual(["chart.png", "data.csv"]);

      // Retrieve by message
      const messageArtifacts = await repo.getArtifactsByMessage("msg-1");
      expect(messageArtifacts).toHaveLength(1);
      expect(messageArtifacts[0].id).toBe("art-1");

      // Retrieve single by ID
      const single = await repo.getArtifact("art-1");
      expect(single).toEqual(artifact1);

      const nonExistent = await repo.getArtifact("art-missing");
      expect(nonExistent).toBeNull();
    });
  });

  describe("Chat Attachment Management", () => {
    it("creates, retrieves, and updates attachment status with user isolation", async () => {
      await repo.createSession({ id: "sess-att-mgr", userId: USER_A, title: "Attachment Mgr" });
      await repo.saveMessage({ id: "msg-att-1", sessionId: "sess-att-mgr", role: "user", content: "Input file" }, USER_A);

      const attachment = await repo.saveAttachment({
        id: "att-mgr-1",
        sessionId: "sess-att-mgr",
        messageId: "msg-att-1",
        userId: USER_A,
        name: "report.pdf",
        storageKey: "uploads/sess-att-mgr/report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1048576,
        uploadStatus: "uploading",
        metadata: { pageCount: 5 },
      });

      expect(attachment.id).toBe("att-mgr-1");
      expect(attachment.sessionId).toBe("sess-att-mgr");
      expect(attachment.messageId).toBe("msg-att-1");
      expect(attachment.userId).toBe(USER_A);
      expect(attachment.name).toBe("report.pdf");
      expect(attachment.uploadStatus).toBe("uploading");
      expect(attachment.metadata).toEqual({ pageCount: 5 });

      // Update status
      const updated = await repo.updateAttachmentStatus("att-mgr-1", USER_A, "ready");
      expect(updated).toBe(true);

      const fetched = await repo.getAttachment("att-mgr-1", USER_A);
      expect(fetched?.uploadStatus).toBe("ready");

      // User B cannot access User A's attachment
      const unauthorizedFetch = await repo.getAttachment("att-mgr-1", USER_B);
      expect(unauthorizedFetch).toBeNull();

      const unauthorizedUpdate = await repo.updateAttachmentStatus("att-mgr-1", USER_B, "failed");
      expect(unauthorizedUpdate).toBe(false);

      // Retrieve by session
      const sessionAttachments = await repo.getAttachmentsBySession("sess-att-mgr", USER_A);
      expect(sessionAttachments).toHaveLength(1);
      expect(sessionAttachments[0].id).toBe("att-mgr-1");

      const sessionAttachmentsUserB = await repo.getAttachmentsBySession("sess-att-mgr", USER_B);
      expect(sessionAttachmentsUserB).toHaveLength(0);

      // Retrieve by message
      const messageAttachments = await repo.getAttachmentsByMessage("msg-att-1", USER_A);
      expect(messageAttachments).toHaveLength(1);
      expect(messageAttachments[0].id).toBe("att-mgr-1");
    });
  });
});
