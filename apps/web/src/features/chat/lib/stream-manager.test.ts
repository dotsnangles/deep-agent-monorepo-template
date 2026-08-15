import { describe, it, expect, vi, beforeEach } from "vitest";
import { StreamManager } from "./stream-manager";

describe("StreamManager", () => {
  let manager: StreamManager;

  beforeEach(() => {
    manager = new StreamManager();
  });

  it("tracks active stream state and accumulates chunks", async () => {
    const sessionId = "session-1";
    const chunks: string[] = [];

    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Hello "));
        controller.enqueue(new TextEncoder().encode("world!"));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
    });

    const mockSaveMessage = vi.fn().mockResolvedValue(true);

    const promise = manager.startStream({
      sessionId,
      assistantMessageId: "asst-1",
      userMessageId: "user-1",
      contextMessages: [{ role: "user", content: "Hi" }],
      fetchFn: mockFetch as any,
      saveMessageFn: mockSaveMessage,
    });

    expect(manager.isSessionGenerating(sessionId)).toBe(true);
    expect(manager.getGeneratingSessionIds()).toContain(sessionId);

    // Subscribe to stream updates
    const unsubscribe = manager.subscribe(sessionId, (state) => {
      chunks.push(state.content);
    });

    await promise;

    expect(manager.isSessionGenerating(sessionId)).toBe(false);
    expect(manager.getGeneratingSessionIds()).not.toContain(sessionId);
    expect(mockSaveMessage).toHaveBeenCalledWith({
      id: "asst-1",
      sessionId: "session-1",
      parentId: "user-1",
      role: "assistant",
      content: "Hello world!",
    });

    unsubscribe();
  });

  it("supports late subscriber reconnection and replay of accumulated buffer", async () => {
    const sessionId = "session-reconnect";

    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const mockStream = new ReadableStream({
      start(controller) {
        streamController = controller;
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
    });

    const mockSaveMessage = vi.fn().mockResolvedValue(true);

    const promise = manager.startStream({
      sessionId,
      assistantMessageId: "asst-recon",
      userMessageId: "user-recon",
      contextMessages: [{ role: "user", content: "Reconnect test" }],
      fetchFn: mockFetch as any,
      saveMessageFn: mockSaveMessage,
    });

    // Enqueue initial chunk
    streamController!.enqueue(new TextEncoder().encode("Part 1. "));
    // Allow microtask to process
    await new Promise((r) => setTimeout(r, 10));

    // Later subscriber joins (simulating switching back to session)
    let reconnectedContent = "";
    const unsubscribe = manager.subscribe(sessionId, (state) => {
      reconnectedContent = state.content;
    });

    expect(reconnectedContent).toBe("Part 1. ");

    // More chunks arrive
    streamController!.enqueue(new TextEncoder().encode("Part 2."));
    await new Promise((r) => setTimeout(r, 10));

    expect(reconnectedContent).toBe("Part 1. Part 2.");

    streamController!.close();
    await promise;
    unsubscribe();
  });

  it("handles stopStream and saves partial message with aborted note", async () => {
    const sessionId = "session-abort";
    const mockSaveMessage = vi.fn().mockResolvedValue(true);

    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const mockStream = new ReadableStream({
      start(controller) {
        streamController = controller;
        controller.enqueue(new TextEncoder().encode("Partial..."));
      },
      cancel(reason) {},
    });

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      init?.signal?.addEventListener("abort", () => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        try {
          streamController?.error(err);
        } catch {}
      });
      return Promise.resolve({
        ok: true,
        body: mockStream,
      });
    });

    const promise = manager.startStream({
      sessionId,
      assistantMessageId: "asst-abort",
      userMessageId: "user-abort",
      contextMessages: [{ role: "user", content: "Stop please" }],
      fetchFn: mockFetch as any,
      saveMessageFn: mockSaveMessage,
    });

    await new Promise((r) => setTimeout(r, 10));
    manager.stopStream(sessionId);
    await promise;

    expect(manager.isSessionGenerating(sessionId)).toBe(false);
    expect(mockSaveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "asst-abort",
        sessionId: "session-abort",
        role: "assistant",
      })
    );
  });

  it("handles multiple concurrent session streams independently", async () => {
    const s1 = "session-alpha";
    const s2 = "session-beta";

    const mockStream1 = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("Alpha"));
        c.close();
      },
    });

    const mockStream2 = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("Beta"));
        c.close();
      },
    });

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const parsed = JSON.parse(init.body);
      return Promise.resolve({
        ok: true,
        body: parsed.threadId === s1 ? mockStream1 : mockStream2,
      });
    });

    const saveAlpha = vi.fn().mockResolvedValue(true);
    const saveBeta = vi.fn().mockResolvedValue(true);

    const p1 = manager.startStream({
      sessionId: s1,
      assistantMessageId: "asst-a",
      userMessageId: "u-a",
      contextMessages: [{ role: "user", content: "A" }],
      fetchFn: mockFetch as any,
      saveMessageFn: saveAlpha,
    });

    const p2 = manager.startStream({
      sessionId: s2,
      assistantMessageId: "asst-b",
      userMessageId: "u-b",
      contextMessages: [{ role: "user", content: "B" }],
      fetchFn: mockFetch as any,
      saveMessageFn: saveBeta,
    });

    expect(manager.getGeneratingSessionIds()).toContain(s1);
    expect(manager.getGeneratingSessionIds()).toContain(s2);

    await Promise.all([p1, p2]);

    expect(manager.isSessionGenerating(s1)).toBe(false);
    expect(manager.isSessionGenerating(s2)).toBe(false);
    expect(saveAlpha).toHaveBeenCalledWith(expect.objectContaining({ content: "Alpha" }));
    expect(saveBeta).toHaveBeenCalledWith(expect.objectContaining({ content: "Beta" }));
  });

  it("handles 3 concurrent streams and tracks activeStreamStates with titles", async () => {
    const s1 = "sess-1";
    const s2 = "sess-2";
    const s3 = "sess-3";

    let c1: ReadableStreamDefaultController<Uint8Array>;
    let c2: ReadableStreamDefaultController<Uint8Array>;
    let c3: ReadableStreamDefaultController<Uint8Array>;

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const parsed = JSON.parse(init.body);
      const stream = new ReadableStream({
        start(c) {
          if (parsed.threadId === s1) c1 = c;
          if (parsed.threadId === s2) c2 = c;
          if (parsed.threadId === s3) c3 = c;
        },
      });
      return Promise.resolve({ ok: true, body: stream });
    });

    const p1 = manager.startStream({
      sessionId: s1,
      assistantMessageId: "a1",
      userMessageId: "u1",
      titleSnippet: "Question 1",
      contextMessages: [{ role: "user", content: "Q1" }],
      fetchFn: mockFetch as any,
    });

    const p2 = manager.startStream({
      sessionId: s2,
      assistantMessageId: "a2",
      userMessageId: "u2",
      titleSnippet: "Question 2",
      contextMessages: [{ role: "user", content: "Q2" }],
      fetchFn: mockFetch as any,
    });

    const p3 = manager.startStream({
      sessionId: s3,
      assistantMessageId: "a3",
      userMessageId: "u3",
      titleSnippet: "Question 3",
      contextMessages: [{ role: "user", content: "Q3" }],
      fetchFn: mockFetch as any,
    });

    const activeStates = manager.getActiveStreamStates();
    expect(activeStates.length).toBe(3);
    expect(activeStates.map((s) => s.titleSnippet)).toEqual([
      "Question 1",
      "Question 2",
      "Question 3",
    ]);

    // Close all
    c1!.close();
    c2!.close();
    c3!.close();

    await Promise.all([p1, p2, p3]);

    expect(manager.getActiveStreamStates().length).toBe(0);
  });
});
