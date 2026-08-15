import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatEngineRegistry } from "../chat-engine-registry";
import { FakeChatTransport } from "../transport";
import type { RegistryEvent } from "../chat-engine-registry";

describe("ChatEngineRegistry (Multi-Session Lifecycle & Event Bus)", () => {
  let transport: FakeChatTransport;
  let registry: ChatEngineRegistry;

  beforeEach(() => {
    transport = new FakeChatTransport();
    registry = new ChatEngineRegistry({ defaultTransport: transport });
  });

  it("reuses existing ChatEngine instance for the same sessionId", () => {
    const engine1 = registry.getEngine("session-1");
    const engine2 = registry.getEngine("session-1");

    expect(engine1).toBe(engine2);
    expect(engine1.getState().sessionId).toBe("session-1");
  });

  it("creates separate ChatEngine instances for different sessionIds", () => {
    const engine1 = registry.getEngine("session-1");
    const engine2 = registry.getEngine("session-2");

    expect(engine1).not.toBe(engine2);
    expect(engine1.getState().sessionId).toBe("session-1");
    expect(engine2.getState().sessionId).toBe("session-2");
  });

  it("tracks generating sessions accurately across concurrent streams", async () => {
    transport.setMockStreamDelay(20);
    transport.setMockStreamChunks(["chunkA1", "chunkA2"]);

    const engine1 = registry.getEngine("session-1");
    const engine2 = registry.getEngine("session-2");

    expect(registry.isSessionGenerating("session-1")).toBe(false);
    expect(registry.getGeneratingSessionIds()).toEqual([]);

    const streamPromise1 = engine1.send("Prompt 1");
    const streamPromise2 = engine2.send("Prompt 2");

    expect(registry.isSessionGenerating("session-1")).toBe(true);
    expect(registry.isSessionGenerating("session-2")).toBe(true);
    expect(registry.getGeneratingSessionIds()).toContain("session-1");
    expect(registry.getGeneratingSessionIds()).toContain("session-2");

    await Promise.all([streamPromise1, streamPromise2]);

    expect(registry.isSessionGenerating("session-1")).toBe(false);
    expect(registry.isSessionGenerating("session-2")).toBe(false);
    expect(registry.getGeneratingSessionIds()).toEqual([]);
  });

  it("preserves stream generation and accumulated chunks in the background across view re-access", async () => {
    transport.setMockStreamDelay(15);
    transport.setMockStreamChunks(["Part 1 ", "Part 2 ", "Part 3"]);

    // View A gets engine and starts streaming
    const engine = registry.getEngine("session-1");
    const sendPromise = engine.send("Background task test");

    // Simulate view unmounting/switching: wait for partial streaming
    await new Promise((r) => setTimeout(r, 20));

    // View B connects to same session
    const reconnectedEngine = registry.getEngine("session-1");
    expect(reconnectedEngine).toBe(engine);
    expect(reconnectedEngine.getState().isGenerating).toBe(true);

    const activePath = reconnectedEngine.getState().activePath;
    expect(activePath[1].content.length).toBeGreaterThan(0);

    // Let stream finish
    await sendPromise;
    expect(reconnectedEngine.getState().isGenerating).toBe(false);
    expect(reconnectedEngine.getState().activePath[1].content).toBe("Part 1 Part 2 Part 3");
  });

  it("emits lifecycle events to global subscribers on stream events, chunk reception, and title updates", async () => {
    transport.setMockStreamChunks(["Chunk 1", " Chunk 2"]);

    const events: RegistryEvent[] = [];
    const unsubscribe = registry.subscribe((event) => {
      events.push(event);
    });

    const engine = registry.getEngine("session-1");
    await engine.send("Hi");

    registry.notifyTitleUpdated("session-1", "New Greeting Title");

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain("streamStarted");
    expect(eventTypes).toContain("streamChunk");
    expect(eventTypes).toContain("streamCompleted");
    expect(eventTypes).toContain("titleUpdated");

    const completedEvent = events.find((e) => e.type === "streamCompleted");
    expect(completedEvent?.payload?.assistantMessageId).toBeDefined();
    expect(completedEvent?.payload?.content).toBe("Chunk 1 Chunk 2");

    const titleEvent = events.find((e) => e.type === "titleUpdated");
    expect(titleEvent?.payload?.title).toBe("New Greeting Title");

    unsubscribe();
  });


  it("emits streamError event on network failure", async () => {
    transport.setMockStreamError(new Error("Stream timeout"));

    const events: RegistryEvent[] = [];
    registry.subscribe((event) => {
      events.push(event);
    });

    const engine = registry.getEngine("session-err");
    await engine.send("Fail me");

    const errorEvent = events.find((e) => e.type === "streamError");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.sessionId).toBe("session-err");
  });
});
