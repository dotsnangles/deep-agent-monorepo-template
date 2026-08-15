import { describe, it, expect, vi } from "vitest";
import { StreamManager } from "../lib/stream-manager";

describe("Message Tree Send Guard & Concurrency", () => {
  it("guards against double sending when rapid requests arrive before async stream start", async () => {
    const manager = new StreamManager();
    const sessionId = "sess-guard-test";

    let inFlight = false;
    let callCount = 0;

    const sendMessageSafely = async (content: string) => {
      // If already generating or in-flight, reject concurrent call
      if (!content.trim() || manager.isSessionGenerating(sessionId) || inFlight) {
        return false;
      }

      inFlight = true;
      try {
        // Simulate async DB save
        await new Promise((r) => setTimeout(r, 50));
        // Start stream
        const promise = manager.startStream({
          sessionId,
          assistantMessageId: "asst-" + ++callCount,
          userMessageId: "user-" + callCount,
          contextMessages: [{ role: "user", content }],
          fetchFn: vi.fn().mockResolvedValue({
            ok: true,
            body: new ReadableStream({
              start(c) {
                c.enqueue(new TextEncoder().encode("Hello"));
                c.close();
              },
            }),
          }) as any,
          saveMessageFn: vi.fn().mockResolvedValue(true),
        });
        await promise;
        return true;
      } finally {
        inFlight = false;
      }
    };

    // Simulate rapid concurrent duplicate triggers (e.g. IME composition enter / fast clicks)
    const [res1, res2] = await Promise.all([
      sendMessageSafely("쉇"),
      sendMessageSafely("쉇"),
    ]);

    // Exactly one should succeed, the other should be rejected
    expect(res1).toBe(true);
    expect(res2).toBe(false);
    expect(callCount).toBe(1);
  });
});
