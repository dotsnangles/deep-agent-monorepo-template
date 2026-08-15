import { describe, it, expect } from "vitest";
import { ChatEngine } from "../engine/chat-engine";
import { FakeChatTransport } from "../engine/transport";

describe("Message Tree Send Guard & Concurrency with ChatEngine", () => {
  it("guards against double sending when rapid requests arrive before async stream start", async () => {
    const transport = new FakeChatTransport();
    transport.setMockStreamDelay(30);
    transport.setMockStreamChunks(["Hello", " world"]);

    const engine = new ChatEngine({
      sessionId: "sess-guard-test",
      transport,
    });

    // Simulate rapid concurrent duplicate triggers (e.g. IME composition enter / fast clicks)
    const p1 = engine.send("Prompt 1");
    const p2 = engine.send("Prompt 1"); // should be ignored by isSending guard

    await Promise.all([p1, p2]);

    // Only one user message and one assistant message should exist
    expect(engine.getState().allNodes).toHaveLength(2);
    expect(engine.getState().activePath).toHaveLength(2);
    expect(engine.getState().activePath[0].content).toBe("Prompt 1");
    expect(engine.getState().activePath[1].content).toBe("Hello world");
  });
});
