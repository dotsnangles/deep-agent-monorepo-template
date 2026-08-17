import { describe, it, expect } from "vitest";
import {
  getRandomGreeting,
  getSessionGreeting,
  hashStringToIndex,
  KOREAN_GREETINGS_GUEST,
  KOREAN_GREETINGS_WITH_NAME,
} from "../greetings";

describe("greetings helper", () => {
  it("returns a guest greeting when no user name is provided", () => {
    const greeting = getRandomGreeting(null, 0);
    expect(greeting).toBe(KOREAN_GREETINGS_GUEST[0]);
    expect(greeting).toBe("어떤 이야기를 나눠볼까요?");
  });

  it("returns a personalized greeting when user name is provided", () => {
    const greeting = getRandomGreeting("정현", 1);
    expect(greeting).toBe("정현님, 무엇을 도와드릴까요?");
  });

  it("handles empty or whitespace-only name as guest", () => {
    const greeting = getRandomGreeting("   ", 2);
    expect(greeting).toBe("새로운 아이디어가 있으신가요?");
  });

  it("hashes string deterministically to a valid index", () => {
    const hash1 = hashStringToIndex("session-123", 5);
    const hash2 = hashStringToIndex("session-123", 5);
    expect(hash1).toBe(hash2);
    expect(hash1).toBeGreaterThanOrEqual(0);
    expect(hash1).toBeLessThan(5);
  });

  it("produces deterministic greetings for the same sessionId between SSR and Client", () => {
    const g1 = getSessionGreeting("863ea78a-75ab-41ea-92a8-5c73d9eccea9", "정현");
    const g2 = getSessionGreeting("863ea78a-75ab-41ea-92a8-5c73d9eccea9", "정현");
    expect(g1).toBe(g2);
    expect(g1).toContain("정현님");
  });
});
