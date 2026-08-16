import { EventEmitter } from "events";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RedisTitleSubscriber,
  TITLE_UPDATED_CHANNEL,
  type SessionTitleStore,
} from "../subscribers/title-subscriber";

class MockRedis extends EventEmitter {
  public subscribedChannels: string[] = [];
  public unsubscribedChannels: string[] = [];

  async subscribe(channel: string) {
    this.subscribedChannels.push(channel);
  }

  async unsubscribe(channel: string) {
    this.unsubscribedChannels.push(channel);
  }
}

class FakeTitleStore implements SessionTitleStore {
  public sessions: Map<string, { id: string; title: string }> = new Map();

  async updateSessionTitleById(sessionId: string, title: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.title = title;
    return true;
  }
}

describe("RedisTitleSubscriber (@repo/redis)", () => {
  let mockRedis: MockRedis;
  let titleStore: FakeTitleStore;

  beforeEach(() => {
    mockRedis = new MockRedis();
    titleStore = new FakeTitleStore();

    titleStore.sessions.set("session-1", {
      id: "session-1",
      title: "새로운 대화",
    });
  });

  it("subscribes to title update channel and updates session title in repository", async () => {
    const onTitleUpdated = vi.fn();
    const subscriber = new RedisTitleSubscriber({
      redisClient: mockRedis as any,
      titleStore,
      onTitleUpdated,
    });

    await subscriber.start();
    expect(mockRedis.subscribedChannels).toContain(TITLE_UPDATED_CHANNEL);

    // Simulate incoming Redis Pub/Sub message
    mockRedis.emit(
      "message",
      TITLE_UPDATED_CHANNEL,
      JSON.stringify({
        sessionId: "session-1",
        title: "React Next.js 아키텍처",
      })
    );

    // Let microtasks flush
    await new Promise((r) => setTimeout(r, 10));

    const updatedSession = titleStore.sessions.get("session-1");
    expect(updatedSession?.title).toBe("React Next.js 아키텍처");
    expect(onTitleUpdated).toHaveBeenCalledWith("session-1", "React Next.js 아키텍처");

    await subscriber.stop();
    expect(mockRedis.unsubscribedChannels).toContain(TITLE_UPDATED_CHANNEL);
  });

  it("resubscribes automatically on Redis ready event after connection drop", async () => {
    const subscriber = new RedisTitleSubscriber({
      redisClient: mockRedis as any,
      titleStore,
    });

    await subscriber.start();
    expect(mockRedis.subscribedChannels).toHaveLength(1);

    // Trigger reconnect ready event
    mockRedis.emit("ready");
    await new Promise((r) => setTimeout(r, 10));

    expect(mockRedis.subscribedChannels).toHaveLength(2);

    await subscriber.stop();
  });

  it("handles malformed JSON or empty payload gracefully without updating store", async () => {
    const onTitleUpdated = vi.fn();
    const subscriber = new RedisTitleSubscriber({
      redisClient: mockRedis as any,
      titleStore,
      onTitleUpdated,
    });

    await subscriber.start();

    // Invalid JSON
    const res1 = await subscriber.handleMessage("not a json");
    expect(res1).toBe(false);

    // Missing sessionId
    const res2 = await subscriber.handleMessage(JSON.stringify({ title: "No Session" }));
    expect(res2).toBe(false);

    // Empty title
    const res3 = await subscriber.handleMessage(JSON.stringify({ sessionId: "session-1", title: "   " }));
    expect(res3).toBe(false);

    // Non-existent session
    const res4 = await subscriber.handleMessage(JSON.stringify({ sessionId: "non-existent-session", title: "Some Title" }));
    expect(res4).toBe(false);

    expect(onTitleUpdated).not.toHaveBeenCalled();

    await subscriber.stop();
  });

  it("ignores messages published on other channels", async () => {
    const onTitleUpdated = vi.fn();
    const subscriber = new RedisTitleSubscriber({
      redisClient: mockRedis as any,
      titleStore,
      onTitleUpdated,
    });

    await subscriber.start();

    mockRedis.emit(
      "message",
      "some_other_channel",
      JSON.stringify({ sessionId: "session-1", title: "Ignored" })
    );

    await new Promise((r) => setTimeout(r, 10));

    const session = titleStore.sessions.get("session-1");
    expect(session?.title).toBe("새로운 대화");
    expect(onTitleUpdated).not.toHaveBeenCalled();

    await subscriber.stop();
  });
});
