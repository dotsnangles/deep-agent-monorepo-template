import { describe, expect, it } from "vitest";
import {
  type MessageNode,
  traverseActivePath,
  getBranchInfo,
  pruneSubtree,
  findNewActiveLeafAfterPrune,
} from "./tree";

describe("Message Tree Pure Traversal Engine (tree.ts)", () => {
  const baseDate = new Date("2026-08-15T10:00:00Z");

  const createNode = (
    id: string,
    parentId: string | null,
    role: "user" | "assistant",
    content: string,
    offsetSeconds = 0
  ): MessageNode => ({
    id,
    sessionId: "test-session",
    parentId,
    role,
    content,
    createdAt: new Date(baseDate.getTime() + offsetSeconds * 1000),
  });

  describe("traverseActivePath", () => {
    it("returns empty array when no nodes exist", () => {
      expect(traverseActivePath([])).toEqual([]);
    });

    it("traverses linear conversation correctly", () => {
      const nodes: MessageNode[] = [
        createNode("msg-1", null, "user", "Hello", 0),
        createNode("msg-2", "msg-1", "assistant", "Hi there!", 1),
        createNode("msg-3", "msg-2", "user", "How are you?", 2),
      ];

      const activePath = traverseActivePath(nodes, "msg-3");
      expect(activePath.map((n) => n.id)).toEqual(["msg-1", "msg-2", "msg-3"]);
    });

    it("resolves specific branch when activeLeafId is provided in a branched tree", () => {
      // Tree:
      // msg-1 (user)
      //  ├── msg-2a (assistant v1) -> msg-3a (user)
      //  └── msg-2b (assistant v2) -> msg-3b (user)
      const nodes: MessageNode[] = [
        createNode("msg-1", null, "user", "Hello", 0),
        createNode("msg-2a", "msg-1", "assistant", "Answer 1", 1),
        createNode("msg-3a", "msg-2a", "user", "Follow-up A", 2),
        createNode("msg-2b", "msg-1", "assistant", "Answer 2 (Regenerated)", 3),
        createNode("msg-3b", "msg-2b", "user", "Follow-up B", 4),
      ];

      const pathA = traverseActivePath(nodes, "msg-3a");
      expect(pathA.map((n) => n.id)).toEqual(["msg-1", "msg-2a", "msg-3a"]);

      const pathB = traverseActivePath(nodes, "msg-3b");
      expect(pathB.map((n) => n.id)).toEqual(["msg-1", "msg-2b", "msg-3b"]);
    });

    it("falls back to latest created leaf when activeLeafId is missing or null", () => {
      const nodes: MessageNode[] = [
        createNode("msg-1", null, "user", "Hello", 0),
        createNode("msg-2a", "msg-1", "assistant", "Answer 1", 1),
        createNode("msg-2b", "msg-1", "assistant", "Answer 2", 5),
      ];

      const activePath = traverseActivePath(nodes, null);
      expect(activePath.map((n) => n.id)).toEqual(["msg-1", "msg-2b"]);
    });
  });

  describe("getBranchInfo", () => {
    it("returns 1 of 1 when there are no siblings", () => {
      const nodes: MessageNode[] = [
        createNode("msg-1", null, "user", "Hello", 0),
        createNode("msg-2", "msg-1", "assistant", "Hi", 1),
      ];

      const info = getBranchInfo("msg-2", nodes);
      expect(info).toEqual({
        currentIndex: 1,
        totalBranches: 1,
        current: 1,
        total: 1,
        siblingIds: ["msg-2"],
      });
    });

    it("computes 1-based index and total count for siblings in chronological order", () => {
      const nodes: MessageNode[] = [
        createNode("msg-1", null, "user", "Hello", 0),
        createNode("msg-2a", "msg-1", "assistant", "Answer 1", 1),
        createNode("msg-2b", "msg-1", "assistant", "Answer 2", 2),
        createNode("msg-2c", "msg-1", "assistant", "Answer 3", 3),
      ];

      expect(getBranchInfo("msg-2a", nodes)).toEqual({
        currentIndex: 1,
        totalBranches: 3,
        current: 1,
        total: 3,
        siblingIds: ["msg-2a", "msg-2b", "msg-2c"],
      });

      expect(getBranchInfo("msg-2b", nodes)).toEqual({
        currentIndex: 2,
        totalBranches: 3,
        current: 2,
        total: 3,
        siblingIds: ["msg-2a", "msg-2b", "msg-2c"],
      });

      expect(getBranchInfo("msg-2c", nodes)).toEqual({
        currentIndex: 3,
        totalBranches: 3,
        current: 3,
        total: 3,
        siblingIds: ["msg-2a", "msg-2b", "msg-2c"],
      });

    });
  });

  describe("pruneSubtree and findNewActiveLeafAfterPrune", () => {
    it("recursively identifies target node and all its descendants for cascade deletion", () => {
      const nodes: MessageNode[] = [
        createNode("root", null, "user", "Root", 0),
        createNode("branch-a", "root", "assistant", "Branch A", 1),
        createNode("child-a1", "branch-a", "user", "Child A1", 2),
        createNode("child-a2", "child-a1", "assistant", "Child A2", 3),
        createNode("branch-b", "root", "assistant", "Branch B", 4),
      ];

      const { deletedIds, remainingNodes } = pruneSubtree(nodes, "branch-a");
      expect(deletedIds.sort()).toEqual(["branch-a", "child-a1", "child-a2"].sort());
      expect(remainingNodes.map((n) => n.id).sort()).toEqual(["root", "branch-b"].sort());
    });

    it("safely rebases active leaf to remaining sibling branch after pruning", () => {
      const remainingNodes: MessageNode[] = [
        createNode("root", null, "user", "Root", 0),
        createNode("branch-b", "root", "assistant", "Branch B", 4),
        createNode("child-b1", "branch-b", "user", "Child B1", 5),
      ];

      const newLeafId = findNewActiveLeafAfterPrune(remainingNodes, "root");
      expect(newLeafId).toBe("child-b1");
    });
  });
});
