import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatEngine } from "../chat-engine";
import { FakeChatTransport } from "../transport";
import type { MessageNode, ToolApprovalRequest } from "../../lib/types";
import type { AttachmentEntity } from "@repo/validators";

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

  it("sends message, derives optimistic title, streams chunks, and persists upon completion", async () => {
    transport.setMockStreamChunks(["Thinking...", " Answer is 42."]);
    const sessionCreatedSpy = vi.fn();

    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
      onSessionCreated: sessionCreatedSpy,
    });
    await engine.loadTree();

    const subscriber = vi.fn();
    const unsubscribe = engine.subscribe(subscriber);

    await engine.send("# What is life?");

    const state = engine.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.title).toBe("What is life?");
    expect(sessionCreatedSpy).toHaveBeenCalledWith("session-1", "What is life?");
    expect(state.allNodes).toHaveLength(2);
    expect(state.activePath).toHaveLength(2);
    expect(state.activePath[0].role).toBe("user");
    expect(state.activePath[0].content).toBe("# What is life?");
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

  it("attaches file metadata to user message node and persists correctly", async () => {
    const mockAttachments: AttachmentEntity[] = [
      {
        id: "att_1",
        name: "test-doc.pdf",
        url: "https://s3.example.com/test-doc.pdf",
        mimeType: "application/pdf",
        size: 51200,
        s3Key: "attachments/usr/test-doc.pdf",
      },
    ];

    transport.setMockStreamChunks(["I analyzed your document."]);

    const engine = new ChatEngine({
      sessionId: "session-att-1",
      transport,
    });
    await engine.loadTree();

    await engine.send("Summarize this document", mockAttachments);

    const state = engine.getState();
    expect(state.allNodes).toHaveLength(2);
    const userNode = state.activePath[0];
    expect(userNode.attachments).toHaveLength(1);
    expect(userNode.attachments?.[0].name).toBe("test-doc.pdf");
    expect(userNode.attachments?.[0].mimeType).toBe("application/pdf");

    // Verify persisted payload in transport
    expect(transport.persistedNodes[0].attachments).toHaveLength(1);
    expect(transport.persistedNodes[0].attachments?.[0].name).toBe("test-doc.pdf");
  });

  it("captures approval_request events in node state and halts stream", async () => {
    const mockApproval: ToolApprovalRequest = {
      toolCallId: "call_test_123",
      tool: "execute_command",
      input: { command: "rm -rf /tmp" },
      description: "삭제 승인 요청",
      status: "pending",
    };

    transport.setMockApprovalRequest(mockApproval);

    const engine = new ChatEngine({
      sessionId: "session-hitl-1",
      transport,
    });
    await engine.loadTree();

    await engine.send("파일 정리해줘");

    const state = engine.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.allNodes).toHaveLength(2);
    const assistantNode = state.activePath[1];
    expect(assistantNode.toolApproval).toBeDefined();
    expect(assistantNode.toolApproval?.toolCallId).toBe("call_test_123");
    expect(assistantNode.toolApproval?.tool).toBe("execute_command");
    expect(assistantNode.toolApproval?.status).toBe("pending");
  });

  it("handles respondToApproval with approval and resumes stream", async () => {
    const mockApproval: ToolApprovalRequest = {
      toolCallId: "call_test_456",
      tool: "write_file",
      input: { filepath: "/tmp/a.txt", content: "data" },
      description: "파일 작성 승인",
      status: "pending",
    };

    transport.setMockApprovalRequest(mockApproval);
    transport.setMockResumeChunks([" 파일이 성공적으로 작성되었습니다."]);

    const engine = new ChatEngine({
      sessionId: "session-hitl-2",
      transport,
    });
    await engine.loadTree();

    await engine.send("파일 생성해줘");

    expect(engine.getState().activePath[1].toolApproval?.status).toBe("pending");

    // Respond with approval
    transport.setMockApprovalRequest(null);
    await engine.respondToApproval("call_test_456", true);

    const updatedState = engine.getState();
    expect(updatedState.isGenerating).toBe(false);
    const assistantNode = updatedState.activePath[1];
    expect(assistantNode.toolApproval?.status).toBe("approved");
    expect(assistantNode.content).toContain("파일이 성공적으로 작성되었습니다.");
  });

  it("handles respondToApproval with rejection and updates status", async () => {
    const mockApproval: ToolApprovalRequest = {
      toolCallId: "call_test_789",
      tool: "delete_resource",
      input: { resource_id: "res_99" },
      description: "리소스 삭제 승인",
      status: "pending",
    };

    transport.setMockApprovalRequest(mockApproval);
    transport.setMockResumeChunks([" 삭제 작업이 취소되었습니다."]);

    const engine = new ChatEngine({
      sessionId: "session-hitl-3",
      transport,
    });
    await engine.loadTree();

    await engine.send("리소스 삭제해줘");

    // Respond with rejection
    transport.setMockApprovalRequest(null);
    await engine.respondToApproval("call_test_789", false, "위험한 작업으로 거부함");

    const updatedState = engine.getState();
    expect(updatedState.isGenerating).toBe(false);
    const assistantNode = updatedState.activePath[1];
    expect(assistantNode.toolApproval?.status).toBe("rejected");
    expect(assistantNode.toolApproval?.reason).toBe("위험한 작업으로 거부함");
    expect(assistantNode.content).toContain("삭제 작업이 취소되었습니다.");
  });

  it("allows setting title explicitly and notifying subscribers", () => {
    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
    });
    const subscriber = vi.fn();
    engine.subscribe(subscriber);

    expect(engine.getState().title).toBe("새로운 대화");

    engine.setTitle("Promoted AI Title");
    expect(engine.getState().title).toBe("Promoted AI Title");
    expect(subscriber).toHaveBeenCalled();
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

  it("supports forkAndEdit creating an immutable sibling branch and inherits attachments", async () => {
    const mockAttachment: AttachmentEntity = {
      id: "att_orig",
      name: "original.png",
      url: "https://s3.example.com/original.png",
      mimeType: "image/png",
      size: 1024,
      s3Key: "attachments/original.png",
    };

    const mockNodes: MessageNode[] = [
      {
        id: "u-1",
        sessionId: "session-1",
        parentId: null,
        role: "user",
        content: "Original prompt with attachment",
        attachments: [mockAttachment],
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
    // Fork without explicit attachments -> should inherit original attachments
    await engine.forkAndEdit("u-1", "Edited prompt");

    const state = engine.getState();
    // All nodes should now have 4 nodes (2 original + 2 in new branch)
    expect(state.allNodes).toHaveLength(4);
    // Active path should show the edited prompt and new response
    expect(state.activePath).toHaveLength(2);
    expect(state.activePath[0].content).toBe("Edited prompt");
    expect(state.activePath[0].attachments).toHaveLength(1);
    expect(state.activePath[0].attachments?.[0].name).toBe("original.png");
    expect(state.activePath[1].content).toBe("Edited response");

    // Check branch info on the root
    const branchInfo = engine.getBranchInfo(state.activePath[0].id);
    expect(branchInfo.totalBranches).toBe(2);
    expect(branchInfo.currentIndex).toBe(2);
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
    expect(state.allNodes).toHaveLength(1);
    expect(state.activePath).toHaveLength(1);
    expect(state.activeLeafId).toBe("u-1");
  });

  it("forks session up to a specific message and invokes onSessionCreated callback", async () => {
    const mockNodes: MessageNode[] = [
      { id: "u-1", sessionId: "session-1", parentId: null, role: "user", content: "Prompt 1", createdAt: new Date() },
      { id: "a-1", sessionId: "session-1", parentId: "u-1", role: "assistant", content: "Answer 1", createdAt: new Date() },
      { id: "u-2", sessionId: "session-1", parentId: "a-1", role: "user", content: "Prompt 2", createdAt: new Date() },
    ];

    transport.setMockTree("session-1", {
      messages: mockNodes,
      activeLeafId: "u-2",
      title: "Research Topic",
    });

    const onSessionCreated = vi.fn();
    const engine = new ChatEngine({
      sessionId: "session-1",
      transport,
      onSessionCreated,
    });
    await engine.loadTree();

    const result = await engine.forkSession("a-1", "Forked Branch");
    expect(result).not.toBeNull();
    expect(result?.newSessionId).toBeDefined();
    expect(result?.title).toBe("Forked Branch");
    expect(onSessionCreated).toHaveBeenCalledWith(result?.newSessionId, "Forked Branch");
  });

  it("captures streaming todo_update and subagent execution in assistant message node", async () => {
    transport.setMockTodos([
      { id: "t1", content: "Plan data processing", status: "completed" },
      { id: "t2", content: "Run analysis in sandbox", status: "in_progress" },
    ]);

    transport.setMockSubagents([
      {
        subagent: "data_analyst",
        task: "Execute statistical aggregation",
        output: { median: 42 },
      },
    ]);

    transport.setMockStreamChunks(["Analysis complete."]);

    const engine = new ChatEngine({
      sessionId: "session-deep-agents",
      transport,
    });

    await engine.send("Analyze my data");

    const state = engine.getState();
    const assistantNode = state.activePath.find((n) => n.role === "assistant");
    expect(assistantNode).toBeDefined();
    expect(assistantNode?.content).toBe("Analysis complete.");
    expect(assistantNode?.todos).toHaveLength(2);
    expect(assistantNode?.todos?.[0].status).toBe("completed");
    expect(assistantNode?.subagents).toHaveLength(1);
    expect(assistantNode?.subagents?.[0].subagent).toBe("data_analyst");
    expect(assistantNode?.subagents?.[0].status).toBe("completed");
    expect(assistantNode?.subagents?.[0].output).toEqual({ median: 42 });
  });

  it("partitions <think>...</think> reasoning from final answer in assistant node", async () => {
    transport.setMockStreamChunks([
      "<think>\nLet me analyze the request step by step.\n1. Check inputs\n2. Compute result\n</think>\n",
      "The result is ",
      "42.",
    ]);

    const engine = new ChatEngine({
      sessionId: "session-reasoning-test",
      transport,
    });

    await engine.send("Calculate the ultimate answer");

    const state = engine.getState();
    const assistantNode = state.activePath.find((n) => n.role === "assistant");
    expect(assistantNode).toBeDefined();
    expect(assistantNode?.reasoning).toBe(
      "Let me analyze the request step by step.\n1. Check inputs\n2. Compute result\n"
    );
    expect(assistantNode?.content).toBe("The result is 42.");
    expect(assistantNode?.reasoningDuration).toBeDefined();
  });

  it("handles artifact_created stream event and binds artifacts to assistant node and persistence", async () => {
    transport.setMockArtifacts([
      {
        id: "art-chart-1",
        sessionId: "session-artifact-test",
        messageId: "asst-msg-1",
        name: "revenue_trend.png",
        storageKey: "artifacts/sessions/session-artifact-test/asst-msg-1/revenue_trend.png",
        url: "https://cdn.example.com/artifacts/revenue_trend.png",
        mimeType: "image/png",
        sizeBytes: 8192,
        metadata: { format: "png" },
        createdAt: new Date(),
      },
      {
        id: "art-csv-2",
        sessionId: "session-artifact-test",
        messageId: "asst-msg-1",
        name: "summary.csv",
        storageKey: "artifacts/sessions/session-artifact-test/asst-msg-1/summary.csv",
        url: "https://cdn.example.com/artifacts/summary.csv",
        mimeType: "text/csv",
        sizeBytes: 1024,
        metadata: {},
        createdAt: new Date(),
      },
    ]);

    transport.setMockStreamChunks(["Here is the revenue chart and data summary."]);

    const engine = new ChatEngine({
      sessionId: "session-artifact-test",
      transport,
    });

    await engine.send("Show me the revenue report");

    const state = engine.getState();
    const assistantNode = state.activePath.find((n) => n.role === "assistant");
    expect(assistantNode).toBeDefined();
    expect(assistantNode?.artifacts).toHaveLength(2);
    expect(assistantNode?.artifacts?.[0].name).toBe("revenue_trend.png");
    expect(assistantNode?.artifacts?.[0].url).toBe("https://cdn.example.com/artifacts/revenue_trend.png");

    expect(assistantNode?.attachments).toHaveLength(2);
    expect(assistantNode?.attachments?.[0].name).toBe("revenue_trend.png");
    expect(assistantNode?.attachments?.[0].url).toBe("https://cdn.example.com/artifacts/revenue_trend.png");
    expect(assistantNode?.attachments?.[1].name).toBe("summary.csv");

    // Verify persisted node contains the attachments
    const persistedAsst = transport.persistedNodes.find((n) => n.role === "assistant");
    expect(persistedAsst).toBeDefined();
    expect(persistedAsst?.attachments).toHaveLength(2);
    expect(persistedAsst?.attachments?.[0].name).toBe("revenue_trend.png");
  });
});
