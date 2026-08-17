import { describe, it, expect, vi, beforeEach } from "vitest";
import { DrizzleChatRepository } from "../drizzle-chat-repository";

describe("DrizzleChatRepository Unit & Transaction Tests", () => {
  let mockDb: any;
  let repo: DrizzleChatRepository;
  const USER_ID = "usr_test_1";

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(async (cb: any) => cb(mockDb)),
    };
    repo = new DrizzleChatRepository(mockDb);
  });

  describe("Session Queries & Mutations", () => {
    it("fetches sessions ordered by updatedAt", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          {
            id: "s1",
            userId: USER_ID,
            title: "Chat 1",
            activeLeafId: "m1",
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-02"),
          },
        ]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const sessions = await repo.getSessions(USER_ID);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe("s1");
      expect(sessions[0].userId).toBe(USER_ID);
    });

    it("fetches single session by id and userId", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "s1",
            userId: USER_ID,
            title: "Chat 1",
            activeLeafId: "m1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const session = await repo.getSession("s1", USER_ID);
      expect(session).not.toBeNull();
      expect(session?.id).toBe("s1");
    });

    it("creates session record", async () => {
      const insertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "new-s",
            userId: USER_ID,
            title: "New Chat",
            activeLeafId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const created = await repo.createSession({
        id: "new-s",
        userId: USER_ID,
        title: "New Chat",
      });
      expect(created.id).toBe("new-s");
      expect(created.title).toBe("New Chat");
    });

    it("updates session title and active leaf", async () => {
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "s1" }]),
      };
      mockDb.update.mockReturnValue(updateChain);

      const titleResult = await repo.updateSessionTitle("s1", USER_ID, "Updated");
      expect(titleResult).toBe(true);

      const leafResult = await repo.updateSessionActiveLeaf("s1", USER_ID, "m2");
      expect(leafResult).toBe(true);
    });

    it("deletes session", async () => {
      const deleteChain = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "s1" }]),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      const deleted = await repo.deleteSession("s1", USER_ID);
      expect(deleted).toBe(true);
    });
  });

  describe("Message Tree Queries & Transactional Operations", () => {
    it("fetches message tree and calculates active path", async () => {
      const sessionChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "s1",
            userId: USER_ID,
            title: "Chat 1",
            activeLeafId: "a1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };
      const messagesChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { id: "u1", sessionId: "s1", parentId: null, role: "user", content: "Hi", createdAt: new Date() },
          { id: "a1", sessionId: "s1", parentId: "u1", role: "assistant", content: "Hello", createdAt: new Date() },
        ]),
      };

      mockDb.select
        .mockReturnValueOnce(sessionChain)
        .mockReturnValueOnce(messagesChain);

      const tree = await repo.getTree("s1", USER_ID);
      expect(tree).not.toBeNull();
      expect(tree?.messages).toHaveLength(2);
      expect(tree?.activePath).toHaveLength(2);
      expect(tree?.activePath.map((m) => m.id)).toEqual(["u1", "a1"]);
    });

    it("encapsulates saveMessage inside an atomic transaction", async () => {
      // 1. Existing session query returns null (new session)
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);

      // 2. Session upsert returning session record
      const insertSessionChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "sess-tx-1",
            userId: USER_ID,
            title: "New topic",
            activeLeafId: "msg-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      // 3. Message insert returning message record
      const insertMsgChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "msg-1",
            sessionId: "sess-tx-1",
            parentId: null,
            role: "user",
            content: "New topic message",
            createdAt: new Date(),
          },
        ]),
      };

      mockDb.insert
        .mockReturnValueOnce(insertSessionChain)
        .mockReturnValueOnce(insertMsgChain);

      const result = await repo.saveMessage(
        {
          id: "msg-1",
          sessionId: "sess-tx-1",
          role: "user",
          content: "New topic message",
        },
        USER_ID
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.isNewSession).toBe(true);
      expect(result?.message.id).toBe("msg-1");
      expect(result?.session.title).toBe("New topic");
    });

    it("rejects saveMessage when session belongs to another tenant", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "sess-other",
            userId: "other_user",
            title: "Other Chat",
            activeLeafId: "m1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await repo.saveMessage(
        {
          id: "m2",
          sessionId: "sess-other",
          role: "user",
          content: "Infiltrate",
        },
        USER_ID
      );

      expect(result).toBeNull();
    });

    it("rolls back transaction if message insertion throws an error", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const insertSessionChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "s-fail", userId: USER_ID, activeLeafId: "m1" }]),
      };

      const insertMsgChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(new Error("DB constraint violation")),
      };

      mockDb.insert
        .mockReturnValueOnce(insertSessionChain)
        .mockReturnValueOnce(insertMsgChain);

      await expect(
        repo.saveMessage(
          {
            id: "m1",
            sessionId: "s-fail",
            role: "user",
            content: "Fail content",
          },
          USER_ID
        )
      ).rejects.toThrow("DB constraint violation");

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("encapsulates deleteSubtree inside an atomic transaction", async () => {
      // 1. Session lookup returning owner record
      const sessionSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "sess-prune",
            userId: USER_ID,
            title: "Prune Test",
            activeLeafId: "msg-2",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      // 2. Messages lookup
      const messagesSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          {
            id: "msg-1",
            sessionId: "sess-prune",
            parentId: null,
            role: "user",
            content: "Hello",
            createdAt: new Date(),
          },
          {
            id: "msg-2",
            sessionId: "sess-prune",
            parentId: "msg-1",
            role: "assistant",
            content: "World",
            createdAt: new Date(),
          },
        ]),
      };

      mockDb.select
        .mockReturnValueOnce(sessionSelectChain)
        .mockReturnValueOnce(messagesSelectChain);

      // 3. Delete messages query
      const deleteChain = {
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      // 4. Update session query
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.update.mockReturnValue(updateChain);

      const result = await repo.deleteSubtree("sess-prune", "msg-2", USER_ID);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.deletedIds).toEqual(["msg-2"]);
      expect(result?.activeLeafId).toBe("msg-1");
    });

    it("fetches linear messages in chronological order", async () => {
      const sessionSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: "s1", userId: USER_ID, title: "Chat", activeLeafId: "m2", createdAt: new Date(), updatedAt: new Date() },
        ]),
      };
      const messagesSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { id: "m1", sessionId: "s1", role: "user", content: "Q1", createdAt: new Date() },
          { id: "m2", sessionId: "s1", role: "assistant", content: "A1", createdAt: new Date() },
        ]),
      };

      mockDb.select.mockReturnValueOnce(sessionSelectChain).mockReturnValueOnce(messagesSelectChain);

      const msgs = await repo.getMessages("s1", USER_ID);
      expect(msgs).toHaveLength(2);
      expect(msgs?.[0].content).toBe("Q1");
      expect(msgs?.[1].content).toBe("A1");
    });

    it("forks a session atomically in transaction", async () => {
      const sourceSessionSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: "s-source", userId: USER_ID, title: "Source Session", activeLeafId: "m2", createdAt: new Date(), updatedAt: new Date() },
        ]),
      };
      const messagesSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { id: "m1", sessionId: "s-source", parentId: null, role: "user", content: "Q1", createdAt: new Date() },
          { id: "m2", sessionId: "s-source", parentId: "m1", role: "assistant", content: "A1", createdAt: new Date() },
          { id: "m3", sessionId: "s-source", parentId: "m2", role: "user", content: "Q2", createdAt: new Date() },
        ]),
      };
      const artifactsSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.select
        .mockReturnValueOnce(sourceSessionSelect)
        .mockReturnValueOnce(messagesSelect)
        .mockReturnValueOnce(artifactsSelect);

      const sessionInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          { id: "s-new", userId: USER_ID, title: "Forked", activeLeafId: "cloned-2", createdAt: new Date(), updatedAt: new Date() },
        ]),
      };
      const messageInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          { id: "cloned-1", sessionId: "s-new", parentId: null, role: "user", content: "Q1", createdAt: new Date() },
          { id: "cloned-2", sessionId: "s-new", parentId: "cloned-1", role: "assistant", content: "A1", createdAt: new Date() },
        ]),
      };
      mockDb.insert.mockReturnValueOnce(sessionInsert).mockReturnValueOnce(messageInsert);

      const forkResult = await repo.forkSession("s-source", "m2", USER_ID, "Forked");
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(forkResult).not.toBeNull();
      expect(forkResult?.session.id).toBe("s-new");
      expect(forkResult?.session.title).toBe("Forked");
      expect(forkResult?.messages).toHaveLength(2);
      expect(forkResult?.messages[0].content).toBe("Q1");
      expect(forkResult?.messages[1].content).toBe("A1");
      expect(forkResult?.messages[0].parentId).toBeNull();
      expect(forkResult?.messages[1].parentId).toBe("cloned-1");
    });
  });
});
