import { describe, it, expect, beforeEach } from "vitest";
import { FakeChatRepository } from "../fake-chat-repository";
import type { ChatRepository } from "../chat-repository";

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

      const updatedLeaf = await repo.updateSessionActiveLeaf("sess-update", USER_A, "node-123");
      expect(updatedLeaf).toBe(true);

      let session = await repo.getSession("sess-update", USER_A);
      expect(session?.title).toBe("Renamed Title");
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

  describe("Message Tree Operations & Atomic Upsert", () => {
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
});
