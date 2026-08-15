import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatEngine } from "../chat-engine";
import { FakeChatTransport } from "../transport";
import type { MessageNode } from "../../lib/tree";

describe("ChatTransport & FakeChatTransport", () => {
  it("allows setting up mock tree responses", async () => {
    const transport = new FakeChatTransport();
    const mockNodes: MessageNode[] = [
      {
        id: "msg-1",
        sessionId: "session-1",
        parentId: null,
        role: "user",
        content: "Hello",
        createdAt: new Date(),
      },
    ];

    transport.setMockTree("session-1", {
      messages: mockNodes,
      activeLeafId: "msg-1",
    });

    const result = await transport.fetchTree("session-1");
    expect(result.messages).toHaveLength(1);
    expect(result.activeLeafId).toBe("msg-1");
  });

  it("simulates streaming token chunks and completion", async () => {
    const transport = new FakeChatTransport();
    transport.setMockStreamChunks(["Hello", " ", "world", "!"]);

    const chunks: string[] = [];
    const controller = new AbortController();

    await transport.streamResponse(
      {
        sessionId: "session-1",
        assistantMessageId: "asst-1",
        userMessageId: "user-1",
        contextMessages: [{ role: "user", content: "Hi" }],
      },
      (chunk) => chunks.push(chunk),
      controller.signal
    );

    expect(chunks.join("")).toBe("Hello world!");
  });
});

describe("ChatEngine (In-Process State Machine)", () => {
  let transport: FakeChatTransport;

  beforeEach(() => {
    transport = new FakeChatTransport();
  });

  it("initializes with initial state and loads tree from transport", async () => {
    const mockNodes: MessageNode[] = [
      {
        id: "u-1",
        sessionId: "session-1",
        parentId: null,
        role: "user",
        content: "What is 2+2?",
        createdAt: new Date(),
      },
      {
        id: "a-1",
        sessionId: "session-1",
        parentId: "u-1",
        role: "assistant",
        content: "2+2 is 4.",
        createdAt: new Date(),
      },
    ];

    transport.setMockTree("session-1", {
      messages: mockNodes,
      activeLeafId: "a-1",
    });

    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
    });

    // Before load
    expect(engine.getState().isLoading).toBe(true);

    await engine.loadTree();

    const state = engine.getState();
    expect(state.isLoading).toBe(false);
    expect(state.allNodes).toHaveLength(2);
    expect(state.activeLeafId).toBe("a-1");
    expect(state.activePath).toHaveLength(2);
    expect(state.activePath[0].content).toBe("What is 2+2?");
    expect(state.activePath[1].content).toBe("2+2 is 4.");
  });

  it("sends message, streams chunks, accumulates content, and persists upon completion", async () => {
    transport.setMockStreamChunks(["Thinking...", " Answer is 42."]);
    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
    });
    await engine.loadTree();

    const subscriber = vi.fn();
    const unsubscribe = engine.subscribe(subscriber);

    await engine.send("What is the meaning of life?");

    const state = engine.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.allNodes).toHaveLength(2);
    expect(state.activePath).toHaveLength(2);
    expect(state.activePath[0].role).toBe("user");
    expect(state.activePath[0].content).toBe("What is the meaning of life?");
    expect(state.activePath[1].role).toBe("assistant");
    expect(state.activePath[1].content).toBe("Thinking... Answer is 42.");
    expect(state.activeLeafId).toBe(state.activePath[1].id);

    // Verify persistence calls
    expect(transport.persistedNodes).toHaveLength(2);
    expect(transport.persistedNodes[0].role).toBe("user");
    expect(transport.persistedNodes[1].role).toBe("assistant");
    expect(transport.persistedNodes[1].content).toBe("Thinking... Answer is 42.");

    unsubscribe();
  });

  it("handles stop generation (abort) and persists partial streamed content", async () => {
    transport.setMockStreamDelay(10);
    transport.setMockStreamChunks(["Chunk1", "Chunk2", "Chunk3", "Chunk4"]);

    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
    });
    await engine.loadTree();

    const sendPromise = engine.send("Tell me a long story");
    
    // Allow first chunk to process then stop
    await new Promise((r) => setTimeout(r, 15));
    engine.stop();
    await sendPromise;

    const state = engine.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.allNodes).toHaveLength(2);
    expect(state.activePath[1].content.length).toBeGreaterThan(0);
    expect(transport.persistedNodes).toHaveLength(2);
  });

  it("supports forkAndEdit creating an immutable sibling branch", async () => {
    const mockNodes: MessageNode[] = [
      {
        id: "u-1",
        sessionId: "session-1",
        parentId: null,
        role: "user",
        content: "Original prompt",
        createdAt: new Date(),
      },
      {
        id: "a-1",
        sessionId: "session-1",
        parentId: "u-1",
        role: "assistant",
        content: "Original response",
        createdAt: new Date(),
      },
    ];
    transport.setMockTree("session-1", {
      messages: mockNodes,
      activeLeafId: "a-1",
    });

    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
    });
    await engine.loadTree();

    transport.setMockStreamChunks(["Edited response"]);
    await engine.forkAndEdit("u-1", "Edited prompt");

    const state = engine.getState();
    // All nodes should now have 4 nodes (2 original + 2 in new branch)
    expect(state.allNodes).toHaveLength(4);
    // Active path should show the edited prompt and new response
    expect(state.activePath).toHaveLength(2);
    expect(state.activePath[0].content).toBe("Edited prompt");
    expect(state.activePath[1].content).toBe("Edited response");

    // Check branch info on the root
    const branchInfo = engine.getBranchInfo(state.activePath[0].id);
    expect(branchInfo.total).toBe(2);
    expect(branchInfo.current).toBe(2);
  });

  it("allows navigating between branches with selectBranch", async () => {
    const mockNodes: MessageNode[] = [
      {
        id: "u-1",
        sessionId: "session-1",
        parentId: null,
        role: "user",
        content: "Prompt v1",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "a-1",
        sessionId: "session-1",
        parentId: "u-1",
        role: "assistant",
        content: "Response v1",
        createdAt: new Date("2026-01-01T00:01:00Z"),
      },
      {
        id: "u-2",
        sessionId: "session-1",
        parentId: null,
        role: "user",
        content: "Prompt v2",
        createdAt: new Date("2026-01-01T00:02:00Z"),
      },
      {
        id: "a-2",
        sessionId: "session-1",
        parentId: "u-2",
        role: "assistant",
        content: "Response v2",
        createdAt: new Date("2026-01-01T00:03:00Z"),
      },
    ];

    transport.setMockTree("session-1", {
      messages: mockNodes,
      activeLeafId: "a-2",
    });

    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
    });
    await engine.loadTree();

    expect(engine.getState().activePath[0].content).toBe("Prompt v2");

    // Select previous branch
    await engine.selectBranch("u-2", "prev");
    expect(engine.getState().activePath[0].content).toBe("Prompt v1");
    expect(engine.getState().activeLeafId).toBe("a-1");

    // Select next branch
    await engine.selectBranch("u-1", "next");
    expect(engine.getState().activePath[0].content).toBe("Prompt v2");
    expect(engine.getState().activeLeafId).toBe("a-2");
  });

  it("supports regenerate creating a new assistant response under the same user message", async () => {
    const mockNodes: MessageNode[] = [
      {
        id: "u-1",
        sessionId: "session-1",
        parentId: null,
        role: "user",
        content: "Write a poem",
        createdAt: new Date(),
      },
      {
        id: "a-1",
        sessionId: "session-1",
        parentId: "u-1",
        role: "assistant",
        content: "Roses are red...",
        createdAt: new Date(),
      },
    ];

    transport.setMockTree("session-1", {
      messages: mockNodes,
      activeLeafId: "a-1",
    });

    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
    });
    await engine.loadTree();

    transport.setMockStreamChunks(["Violets are blue..."]);
    await engine.regenerate("a-1");

    const state = engine.getState();
    expect(state.allNodes).toHaveLength(3); // 1 user + 2 assistant variants
    expect(state.activePath).toHaveLength(2);
    expect(state.activePath[1].content).toBe("Violets are blue...");
    expect(state.activePath[1].parentId).toBe("u-1");
  });

  it("preserves error state and node on stream failure, allowing retry", async () => {
    transport.setMockStreamError(new Error("Network connection dropped"));

    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
    });
    await engine.loadTree();

    await engine.send("Hello world");

    const state = engine.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.error).toContain("Network connection dropped");
    // User message and assistant error message are preserved
    expect(state.activePath).toHaveLength(2);
    expect(state.activePath[1].status).toBe("error");

    // Now clear mock error and retry
    transport.setMockStreamError(null);
    transport.setMockStreamChunks(["Recovered response"]);

    await engine.retry(state.activePath[1].id);

    const retriedState = engine.getState();
    expect(retriedState.error).toBeNull();
    expect(retriedState.activePath[1].status).not.toBe("error");
    expect(retriedState.activePath[1].content).toBe("Recovered response");
  });

  it("handles deleteNode pruning subtrees and updating activeLeafId", async () => {
    const mockNodes: MessageNode[] = [
      {
        id: "u-1",
        sessionId: "session-1",
        parentId: null,
        role: "user",
        content: "Root",
        createdAt: new Date(),
      },
      {
        id: "a-1",
        sessionId: "session-1",
        parentId: "u-1",
        role: "assistant",
        content: "Branch 1",
        createdAt: new Date(),
      },
      {
        id: "u-2",
        sessionId: "session-1",
        parentId: "a-1",
        role: "user",
        content: "Leaf child",
        createdAt: new Date(),
      },
    ];

    transport.setMockTree("session-1", {
      messages: mockNodes,
      activeLeafId: "u-2",
    });

    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
    });
    await engine.loadTree();

    await engine.deleteNode("a-1");

    const state = engine.getState();
    // a-1 and u-2 should be pruned, leaving u-1
    expect(state.allNodes).toHaveLength(1);
    expect(state.activePath).toHaveLength(1);
    expect(state.activeLeafId).toBe("u-1");
  });
});
