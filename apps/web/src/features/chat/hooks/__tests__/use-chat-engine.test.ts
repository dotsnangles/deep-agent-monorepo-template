import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatEngineRegistry } from "../../engine/chat-engine-registry";
import { FakeChatTransport } from "../../engine/transport";

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
});
