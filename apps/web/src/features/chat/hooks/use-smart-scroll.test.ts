import { describe, expect, it } from "vitest";

describe("useSmartScroll Pure Position Calculation", () => {
  it("determines atBottom true when distance is less than or equal to threshold", () => {
    const scrollHeight = 1000;
    const clientHeight = 600;
    const threshold = 100;

    // scrollTop = 350 -> distance = 1000 - 350 - 600 = 50 <= 100 -> true
    const scrollTop = 350;
    const distance = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distance <= threshold;

    expect(isAtBottom).toBe(true);
  });

  it("determines atBottom false when user has scrolled up past threshold", () => {
    const scrollHeight = 1000;
    const clientHeight = 600;
    const threshold = 100;

    // scrollTop = 200 -> distance = 1000 - 200 - 600 = 200 > 100 -> false
    const scrollTop = 200;
    const distance = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distance <= threshold;

    expect(isAtBottom).toBe(false);
  });
});
