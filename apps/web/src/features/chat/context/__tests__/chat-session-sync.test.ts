import { describe, it, expect, beforeEach } from "vitest";
import { ChatEngineRegistry } from "../../engine/chat-engine-registry";
import { FakeChatTransport } from "../../engine/transport";

describe("Event-Driven Sidebar & Session Synchronization", () => {
  let transport: FakeChatTransport;
  let registry: ChatEngineRegistry;

  beforeEach(() => {
    transport = new FakeChatTransport();
    registry = new ChatEngineRegistry({ defaultTransport: transport });
  });

  it("broadcasts session creation and title update events to subscribers without polling", async () => {
    const receivedEvents: string[] = [];
    const unsubscribe = registry.subscribe((event) => {
      receivedEvents.push(event.type);
    });

    // 1. Send first message -> triggers sessionCreated event
    transport.setMockStreamChunks(["Welcome message"]);
    const engine = registry.getEngine("session-event-test");
    await engine.send("Hello world");

    expect(receivedEvents).toContain("sessionCreated");
    expect(receivedEvents).toContain("streamStarted");
    expect(receivedEvents).toContain("streamCompleted");

    // 2. Title generation notification
    registry.notifyTitleUpdated("session-event-test", "Generated Summary Title");
    expect(receivedEvents).toContain("titleUpdated");

    unsubscribe();
  });

  it("manages active generating session indicators across multiple sessions", async () => {
    transport.setMockStreamDelay(25);
    transport.setMockStreamChunks(["chunk1", "chunk2"]);

    const engineA = registry.getEngine("sess-A");
    const engineB = registry.getEngine("sess-B");

    expect(registry.getGeneratingSessionIds()).toEqual([]);

    const pA = engineA.send("Prompt A");
    const pB = engineB.send("Prompt B");

    expect(registry.isSessionGenerating("sess-A")).toBe(true);
    expect(registry.isSessionGenerating("sess-B")).toBe(true);
    expect(registry.getGeneratingSessionIds()).toHaveLength(2);

    await Promise.all([pA, pB]);

    expect(registry.isSessionGenerating("sess-A")).toBe(false);
    expect(registry.isSessionGenerating("sess-B")).toBe(false);
    expect(registry.getGeneratingSessionIds()).toEqual([]);
  });
});
