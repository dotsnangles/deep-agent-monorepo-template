import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatEngineRegistry } from "../../engine/chat-engine-registry";
import { FakeChatTransport } from "../../engine/transport";
import type { ToolApprovalRequest } from "../../lib/tree";
import type { AttachmentEntity } from "@repo/validators";

describe("useChatEngine and UI Integration State Flow", () => {
  let transport: FakeChatTransport;
  let registry: ChatEngineRegistry;

  beforeEach(() => {
    transport = new FakeChatTransport();
    registry = new ChatEngineRegistry({ defaultTransport: transport });
  });

  it("handles reactive tree mutations, branch navigation, and edits seamlessly", async () => {
    const engine = registry.getEngine("test-session");

    let notificationCount = 0;
    const unsubscribe = engine.subscribe(() => {
      notificationCount++;
    });

    transport.setMockStreamChunks(["Answer 1"]);
    await engine.send("Question 1");

    expect(engine.getState().activePath).toHaveLength(2);
    expect(engine.getState().activePath[0].content).toBe("Question 1");
    expect(engine.getState().activePath[1].content).toBe("Answer 1");
    expect(notificationCount).toBeGreaterThan(0);

    // Edit user question -> fork new branch
    transport.setMockStreamChunks(["Answer 1 Edited"]);
    await engine.forkAndEdit(engine.getState().activePath[0].id, "Question 1 Edited");

    expect(engine.getState().activePath[0].content).toBe("Question 1 Edited");
    expect(engine.getState().activePath[1].content).toBe("Answer 1 Edited");
    expect(engine.getState().allNodes).toHaveLength(4);

    // Switch branch back to original
    await engine.selectBranch(engine.getState().activePath[0].id, "prev");
    expect(engine.getState().activePath[0].content).toBe("Question 1");
    expect(engine.getState().activePath[1].content).toBe("Answer 1");

    unsubscribe();
  });

  it("preserves error state and executes retry cleanly for UI retry buttons", async () => {
    const engine = registry.getEngine("error-session");
    transport.setMockStreamError(new Error("Connection reset by peer"));

    await engine.send("Will fail");
    expect(engine.getState().error).toBe("Connection reset by peer");

    const failedAssistant = engine.getState().activePath[1];
    expect(failedAssistant.status).toBe("error");
    expect(failedAssistant.error).toBe("Connection reset by peer");

    // Retry the failed node
    transport.setMockStreamError(null);
    transport.setMockStreamChunks(["Recovered response"]);
    await engine.retry(failedAssistant.id);

    expect(engine.getState().error).toBeNull();
    expect(engine.getState().activePath[1].status).toBe("complete");
    expect(engine.getState().activePath[1].content).toBe("Recovered response");
  });

  it("handles reactive tool approval request and subsequent resume stream", async () => {
    const engine = registry.getEngine("hitl-session");
    const mockApproval: ToolApprovalRequest = {
      toolCallId: "call_hook_1",
      tool: "execute_command",
      input: { command: "git status" },
      description: "Git 상태 확인",
      status: "pending",
    };

    transport.setMockApprovalRequest(mockApproval);
    transport.setMockResumeChunks([" On branch main"]);

    await engine.send("상태 확인해줘");

    const state = engine.getState();
    const assistantNode = state.activePath[1];
    expect(assistantNode.toolApproval?.status).toBe("pending");
    expect(assistantNode.toolApproval?.tool).toBe("execute_command");

    // Trigger approval response from UI button callback
    transport.setMockApprovalRequest(null);
    await engine.respondToApproval("call_hook_1", true);

    const resumedState = engine.getState();
    const resumedAssistant = resumedState.activePath[1];
    expect(resumedAssistant.toolApproval?.status).toBe("approved");
    expect(resumedAssistant.content).toContain("On branch main");
  });

  it("handles sending attachments and preserves them across tree state updates", async () => {
    const engine = registry.getEngine("attachments-session");
    const mockAttachments: AttachmentEntity[] = [
      {
        id: "att-hook-1",
        name: "diagram.png",
        url: "http://storage.local/diagram.png",
        mimeType: "image/png",
        size: 1024,
        s3Key: "attachments/diagram.png",
      },
    ];

    transport.setMockStreamChunks(["Diagram received"]);
    await engine.send("Analyze diagram", mockAttachments);

    const userNode = engine.getState().activePath[0];
    expect(userNode.attachments).toHaveLength(1);
    expect(userNode.attachments?.[0].name).toBe("diagram.png");
  });
});
