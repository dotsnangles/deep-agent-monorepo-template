import { describe, it, expect } from "vitest";
import { getRandomGreeting, KOREAN_GREETINGS_GUEST, KOREAN_GREETINGS_WITH_NAME } from "../greetings";

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

  it("cycles correctly with arbitrary seed indices", () => {
    const count = KOREAN_GREETINGS_GUEST.length;
    expect(getRandomGreeting("정현", count + 3)).toBe(KOREAN_GREETINGS_WITH_NAME[3]("정현"));
  });
});
